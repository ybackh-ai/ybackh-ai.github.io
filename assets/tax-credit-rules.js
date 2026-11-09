/*
 * 세액공제·감면 계산 (순수 함수, 브라우저·Node 공용). 근거: docs/41_세액공제감면_로직.md
 * 「조세특례제한법」 제6조, 제10조, 제16조, 제24조, 제29조의8, 제132조 (법제처 현행, 2026-09-18 시행본, 2026-11-09 조회)
 * 금액 입력 만원 → 원 정수, 세액은 원 미만 버림.
 */
(function (root) {
  'use strict';
  var VERSION = '2026-11-09';
  var MAN = 10000, EOK = 100000000;
  var TT = (typeof module !== 'undefined' && module.exports) ? require('./tax-tools-rules.js') : root.TaxTools;

  function blank(v) { return v === undefined || v === null || v === ''; }
  function reader(errors) {
    return function (v, label, opt) {
      opt = opt || {};
      if (blank(v)) { if (opt.optional) return null; errors.push(label + '을(를) 입력해 주세요.'); return 0; }
      var x = Number(v);
      if (!isFinite(x) || x < 0 || (opt.positive && x <= 0)) { errors.push(label + '은(는) ' + (opt.positive ? '0보다 큰' : '0 이상의') + ' 숫자로 입력해 주세요.'); return 0; }
      if (opt.max !== undefined && x > opt.max) { errors.push(label + '은(는) ' + opt.max + ' 이하로 입력해 주세요.'); return 0; }
      return x;
    };
  }
  function won(x) { return x === null ? null : Math.round(x * MAN); }
  function pct(amount, rate) { return Math.floor(amount * rate / 100 + 1e-6); }

  // ── 통합고용세액공제 §29의8 (2026~2028 과세연도) — 1인당 금액(만원) [직전, 전전, 전전전] ──
  var EMP = {
    sme: { youth: [700, 1600, 1700], youthLocal: [1000, 1900, 2000], other: [400, 900, 1000], otherLocal: [700, 1200, 1300] },
    mid: { youth: [500, 900, 900], other: [300, 500, 500] },
    large: { youth: [300, 500], other: [] }
  };
  function increases(a) {
    // a = [당해, 직전, 전전, 전전전] (null = 비교 제외 연도)
    var out = [0, 0, 0];
    if (a[1] !== null) out[0] = a[0] - a[1];
    if (a[2] !== null) out[1] = Math.min(a[0], a[1] === null ? a[0] : a[1]) - a[2];
    if (a[3] !== null) out[2] = Math.min(a[0], a[1] === null ? a[0] : a[1], a[2] === null ? a[0] : a[2]) - a[3];
    return out;
  }

  /**
   * @param input size 'sme'|'mid'|'large', nonCapital(수도권 밖 증가), youth/other: [당해, 직전, 전전, 전전전] 상시근로자 수,
   *              minIncrease(최소고용증가인원수, 중소기업 외 필수), returners(육아휴직 복귀자 수)
   */
  function employment(input) {
    input = input || {};
    var errors = [], num = reader(errors);
    var r = { version: VERSION, status: null, errors: errors, notes: [], basis: [] };
    var size = EMP[input.size] ? input.size : 'sme';
    var names = ['당해', '직전', '전전', '전전전'];
    var y = [], o = [];
    for (var i = 0; i < 4; i++) {
      var yy = input.youth ? input.youth[i] : '', oo = input.other ? input.other[i] : '';
      y.push(num(yy, names[i] + ' 과세연도 청년등 상시근로자 수', { optional: i > 0 }));
      o.push(num(oo, names[i] + ' 과세연도 청년등외 상시근로자 수', { optional: i > 0 }));
      if (i > 0 && (y[i] === null) !== (o[i] === null)) errors.push(names[i] + ' 과세연도는 청년등·청년등외 인원을 모두 입력하거나 모두 비워 주세요.');
    }
    if (y[1] === null) errors.push('직전 과세연도 인원을 입력해 주세요.');
    var m = size === 'sme' ? 0 : num(input.minIncrease, '최소고용증가인원수', {});
    var returners = num(input.returners, '육아휴직 복귀자 수', { optional: true }) || 0;
    if (errors.length) { r.status = 'INVALID'; return r; }

    var t = y.map(function (v, k) { return v === null ? null : v + o[k]; });
    var ti = increases(t), yi = increases(y), oi = increases(o);
    var yc = yi.map(function (v, k) { return Math.max(0, Math.min(v, ti[k])); });
    var oc = oi.map(function (v, k) { return Math.max(0, Math.min(v, ti[k])); });
    r.totalIncrease = ti; r.youthIncrease = yc; r.otherIncrease = oc;

    var grew = [t[1], t[2], t[3]].some(function (p) { return p !== null && t[0] > p; });
    var minOk = size === 'sme' || ti[0] > m;
    r.eligible = grew && minOk;
    var tbl = EMP[size], local = size === 'sme' && !!input.nonCapital;
    var yRate = local ? tbl.youthLocal : tbl.youth, oRate = local ? tbl.otherLocal : tbl.other;
    var parts = [];
    var youthAmt = 0, otherAmt = 0;
    for (var k = 0; k < 3; k++) {
      if (yRate[k] !== undefined && yc[k] > 0) { youthAmt += yc[k] * yRate[k] * MAN; parts.push('청년등 ' + ['직전', '전전', '전전전'][k] + ' 대비 ' + yc[k] + '명 × ' + yRate[k] + '만원'); }
      if (oRate[k] !== undefined && oc[k] > 0) { otherAmt += oc[k] * oRate[k] * MAN; parts.push('청년등외 ' + ['직전', '전전', '전전전'][k] + ' 대비 ' + oc[k] + '명 × ' + oRate[k] + '만원'); }
    }
    var deduct = 0;
    if (size !== 'sme') {
      var oi1 = oc[0];
      if (size === 'mid') deduct = oi1 >= m ? m * 300 * MAN : (oi1 * 300 + (m - oi1) * 500) * MAN;
      else deduct = oi1 >= m ? 0 : (m - oi1) * 300 * MAN;
      if (deduct) parts.push('최소고용증가인원수 ' + m + '명에 대한 차감 ' + (deduct / MAN).toLocaleString('ko-KR') + '만원');
    }
    r.youthAmount = youthAmt; r.otherAmount = otherAmt; r.deduction = deduct;
    r.mainCredit = r.eligible ? Math.max(0, youthAmt + otherAmt - deduct) : 0;
    var notDecreased = t[0] >= t[1];
    var perReturner = size === 'sme' ? 1300 : size === 'mid' ? 900 : 0;
    r.returnerCredit = notDecreased ? returners * perReturner * MAN : 0;
    r.credit = r.mainCredit + r.returnerCredit;
    r.parts = parts;

    r.basis.push('「조세특례제한법」 제29조의8제1항 — 2026~2028년 과세연도, 상시근로자 수가 직전 3개 과세연도 중 1개 이상보다 증가한 경우 (2024년 이전 개시 과세연도는 비교 제외)');
    r.basis.push(size === 'sme' ? '중소기업 1인당: 청년등 ' + yRate.join('·') + '만원, 청년등외 ' + oRate.join('·') + '만원 (직전·전전·전전전 대비)' + (local ? ' — 수도권 밖 금액' : '')
      : size === 'mid' ? '중견기업 1인당: 청년등 500·900·900만원, 청년등외 300·500·500만원. 최소고용증가인원수 초과 증가 시에만 공제, 같은 항 제3호 금액 차감'
      : '그 밖의 기업 1인당: 청년등 300·500만원(직전·전전 대비). 최소고용증가인원수 초과 증가 시에만 공제, 같은 항 제3호 금액 차감');
    if (returners) r.basis.push('같은 조 제5항 — 육아휴직 복귀자 1인당 ' + perReturner + '만원 (2026-12-31까지 복직, 상시근로자 수가 직전보다 감소하면 제외)');
    r.notes.push('각 증가 인원은 같은 기준의 전체 상시근로자 증가 인원을 한도로 계산했습니다. 상시근로자·청년등 범위와 인원 계산(월평균 등)은 시행령에서 정하며, 시행령 원문은 아직 대조 전입니다(확실하지 않음).');
    if (size !== 'sme') r.notes.push('중소기업이 아닌 경우 차감액(제3호)은 직전 과세연도 대비 증가 기준으로만 계산했습니다. 전전·전전전 기준 차감과 최소고용증가인원수(시행령)는 직접 확인해 주세요.');
    r.notes.push('공제받지 못한 금액은 이월공제(같은 법 제144조)될 수 있고, 최저한세(같은 법 제132조) 적용 대상입니다. 소비성서비스업 등은 제외됩니다.');
    r.status = r.credit > 0 ? 'CREDIT' : 'NONE';
    return r;
  }

  // ── 최저한세 §132①: 감면 전 과세표준 × 세율 ──
  function minimumTax(base, sme) {
    if (sme) return pct(base, 7);
    var a = Math.min(base, 100 * EOK), b = Math.min(Math.max(base - 100 * EOK, 0), 900 * EOK), c = Math.max(base - 1000 * EOK, 0);
    return pct(a, 10) + pct(b, 12) + pct(c, 17);
  }

  /**
   * 연구·인력개발비 세액공제 §10 + 최저한세 §132
   * @param input size 'sme'|'mid'|'large', graduated ''|'g1'|'g2'(중소기업 졸업 후 3년 이내 / 그 후 2년 이내),
   *              current·prior·avg4(일반 연구·인력개발비 당기·직전·4년 연평균, 만원), revenue(수입금액), newGrowth, strategic, taxBase(과세표준)
   */
  function rnd(input) {
    input = input || {};
    var errors = [], num = reader(errors);
    var r = { version: VERSION, status: null, errors: errors, notes: [], basis: [] };
    var size = ['sme', 'mid', 'large'].indexOf(input.size) >= 0 ? input.size : 'sme';
    var sme = size === 'sme', grad = sme ? '' : (input.graduated === 'g1' || input.graduated === 'g2' ? input.graduated : '');
    var cur = won(num(input.current, '당기 일반 연구·인력개발비', {}));
    var prior = won(num(input.prior, '직전 과세연도 일반 연구·인력개발비', { optional: true }));
    var avg4 = won(num(input.avg4, '4년간 연평균 발생액', { optional: true }));
    var revenue = won(num(input.revenue, '수입금액(매출액)', { optional: true }));
    var ng = won(num(input.newGrowth, '신성장·원천기술 연구개발비', { optional: true })) || 0;
    var st = won(num(input.strategic, '국가전략기술 연구개발비', { optional: true })) || 0;
    var taxBase = won(num(input.taxBase, '과세표준', { optional: true }));
    if (size === 'large' && !grad && cur > 0 && !(revenue > 0)) errors.push('중소·중견기업이 아니면 당기분 공제율 계산에 수입금액(매출액)이 필요합니다.');
    if (errors.length) { r.status = 'INVALID'; return r; }

    // 당기분 공제율 (제1항제3호나목)
    var curRate;
    if (sme) curRate = 25; else if (grad === 'g1') curRate = 20; else if (grad === 'g2') curRate = 15; else if (size === 'mid') curRate = 8;
    else curRate = Math.min(2, (cur / revenue * 100) / 2);
    var curCredit = Math.floor(cur * curRate / 100 + 1e-6);
    // 증가분 (제1항제3호가목) — 직전 발생액이 4년 연평균 이상일 때만
    var incRate = sme ? 50 : size === 'mid' ? 40 : 25;
    var incOk = prior !== null && avg4 !== null && prior > 0 && avg4 > 0 && prior >= avg4 && cur > prior;
    var incCredit = incOk ? pct(cur - prior, incRate) : 0;
    r.curRate = Math.round(curRate * 1000) / 1000; r.curCredit = curCredit; r.incCredit = incCredit; r.incAvailable = incOk;
    r.method = incCredit > curCredit ? 'increase' : 'current';
    r.generalCredit = Math.max(curCredit, incCredit);
    // 신성장·국가전략 기본 공제율 (가산율 제외)
    var ngRate = sme ? 30 : grad === 'g1' ? 25 : 20, stRate = sme ? 40 : grad === 'g1' ? 35 : 30;
    r.newGrowthCredit = pct(ng, ngRate); r.strategicCredit = pct(st, stRate);
    r.credit = r.generalCredit + r.newGrowthCredit + r.strategicCredit;

    r.basis.push('「조세특례제한법」 제10조제1항제3호 — 일반 연구·인력개발비: 당기분 ' + (sme ? '25%' : grad === 'g1' ? '20%(중소기업 졸업 3년 이내)' : grad === 'g2' ? '15%(졸업 후 그다음 2년)' : size === 'mid' ? '8%(중견기업)' : '수입금액 대비 비율 × 1/2 (2% 한도) → ' + r.curRate + '%') +
      ', 증가분 ' + incRate + '% 중 선택 (직전 발생액이 4년 연평균보다 적으면 당기분만)');
    if (ng || st) r.basis.push('같은 항 제1호·제2호 — 신성장·원천기술 기본 ' + ngRate + '%, 국가전략기술 기본 ' + stRate + '% (수입금액 비중에 따른 가산율은 미반영)');

    if (taxBase !== null) {
      r.grossTax = TT.corpTax(taxBase, false);
      r.minTax = minimumTax(taxBase, sme);
      // 중소기업의 §10 공제는 최저한세 배제 (§132①), 그 외는 산출세액 − 최저한세 범위까지
      var room = sme ? r.grossTax : Math.max(0, r.grossTax - r.minTax);
      r.allowed = Math.min(r.credit, room);
      r.carry = r.credit - r.allowed;
      r.basis.push('「법인세법」 제55조 산출세액 ' + r.grossTax.toLocaleString('ko-KR') + '원, 「조세특례제한법」 제132조제1항 최저한세 ' + r.minTax.toLocaleString('ko-KR') + '원 (' + (sme ? '중소기업 7%, 연구·인력개발비 공제는 최저한세 적용 제외' : '과세표준 100억 이하 10%, 100억~1천억 12%, 1천억 초과 17%') + ')');
    }
    r.notes.push('신성장·국가전략기술 가산율(수입금액 대비 비율 × 시행령 일정배수, 10% 한도)과 대상 기술 범위는 시행령 원문 대조 전이라 반영하지 않았습니다(확실하지 않음). 실제 공제액은 더 클 수 있습니다.');
    r.notes.push('최저한세 계산은 이 공제만 있다고 가정했습니다. 다른 감면·공제, 중소기업 졸업 유예 세율(8%·9%), 지방소득세는 반영하지 않았습니다. 공제받지 못한 금액은 이월공제(같은 법 제144조) 대상입니다.');
    r.status = r.credit > 0 ? 'CREDIT' : 'NONE';
    return r;
  }

  // ── 통합투자세액공제 §24 — 기본공제율 [중소, 졸업 3년 이내, 중견, 그 외] ──
  var INV = {
    general: { label: '일반 사업용 자산', rates: [10, 7.5, 5, 1] },
    newGrowth: { label: '신성장사업화·연구개발 시설', rates: [12, 9, 6, 3] },
    strategic: { label: '국가전략기술사업화·연구개발 시설', rates: [25, 20, 15, 15] },
    semiconductor: { label: '반도체 분야 국가전략기술 시설', rates: [30, 25, 20, 20] }
  };
  /** @param input size, graduated(bool), type, amount(당기 투자액, 만원), avg3(직전 3년 연평균 투자액, 만원) */
  function investment(input) {
    input = input || {};
    var errors = [], num = reader(errors);
    var r = { version: VERSION, status: null, errors: errors, notes: [], basis: [] };
    var size = ['sme', 'mid', 'large'].indexOf(input.size) >= 0 ? input.size : 'sme';
    var type = INV[input.type] ? input.type : 'general';
    var amount = won(num(input.amount, '당기 투자금액', { positive: true }));
    var avg3 = won(num(input.avg3, '직전 3년 연평균 투자금액', { optional: true }));
    if (errors.length) { r.status = 'INVALID'; return r; }
    var idx = size === 'sme' ? 0 : input.graduated ? 1 : size === 'mid' ? 2 : 3;
    var rate = INV[type].rates[idx];
    r.rate = rate;
    r.basic = pct(amount, rate);
    var add = 0;
    if (avg3 !== null && amount > avg3) add = pct(amount - avg3, 10);
    if (add > r.basic) add = Math.min(add, r.basic * 2);
    r.additional = add;
    r.credit = r.basic + r.additional;
    r.basis.push('「조세특례제한법」 제24조제1항제2호가목 — ' + INV[type].label + ' 기본공제율 ' + rate + '% (' + ['중소기업', '중소기업 졸업 후 3년 이내', '중견기업', '그 밖의 기업'][idx] + ')');
    r.basis.push('같은 호 나목 — 직전 3년 연평균 투자액 초과분의 10% 추가공제, 추가공제가 기본공제보다 크면 기본공제의 2배 한도' + (avg3 === null ? ' (연평균 미입력 → 추가공제 0)' : ''));
    r.notes.push('중고품, 리스 투자, 시행령이 정하는 임대용 자산 등은 제외됩니다. 공제대상 자산 범위와 연평균 투자액 계산 방법은 시행령에서 정하며 원문 대조 전입니다.');
    r.notes.push('투자 후 5년 이내 다른 목적으로 전용하면 공제액과 이자상당액을 납부합니다(제3항). 최저한세(제132조)와 이월공제(제144조)를 함께 검토하세요.');
    r.status = 'CREDIT';
    return r;
  }

  /**
   * 벤처투자 등 소득공제 §16
   * @param input type 'direct'(개인투자조합 경유·벤처기업 직접투자·온라인소액투자중개) | 'fund'(벤처투자조합 등), amount, income(종합소득금액), taxBase(공제 전 과세표준, 선택)
   */
  function angel(input) {
    input = input || {};
    var errors = [], num = reader(errors);
    var r = { version: VERSION, status: null, errors: errors, notes: [], basis: [] };
    var direct = input.type !== 'fund';
    var amount = won(num(input.amount, '투자금액', { positive: true }));
    var income = won(num(input.income, '종합소득금액', { positive: true }));
    var taxBase = won(num(input.taxBase, '공제 전 과세표준', { optional: true }));
    if (errors.length) { r.status = 'INVALID'; return r; }
    var raw;
    if (direct) {
      var a = Math.min(amount, 3000 * MAN), b = Math.min(Math.max(amount - 3000 * MAN, 0), 2000 * MAN), c = Math.max(amount - 5000 * MAN, 0);
      raw = a + pct(b, 70) + pct(c, 30);
    } else raw = pct(amount, 10);
    var cap = Math.floor(income / 2);
    r.rawDeduction = raw; r.cap = cap; r.capped = raw > cap;
    r.deduction = Math.min(raw, cap);
    if (taxBase !== null) {
      var after = Math.max(0, taxBase - r.deduction);
      r.taxSaving = TT.incomeTax(taxBase) - TT.incomeTax(after);
      r.localSaving = Math.floor(r.taxSaving / 10);
    }
    r.basis.push('「조세특례제한법」 제16조제1항 — ' + (direct ? '벤처기업 등 직접투자(제3호·제4호·제6호): 3천만원 이하 100%, 3천만~5천만원 70%, 5천만원 초과 30%' : '벤처투자조합 등 출자(제1호·제2호·제5호): 10%') + ', 종합소득금액의 50% 한도, 2028-12-31까지 투자분');
    if (taxBase !== null) r.basis.push('절세액 = 「소득세법」 제55조 세율로 공제 전·후 산출세액 차이 (지방소득세 10% 별도)');
    r.notes.push('투자일부터 3년 안에 지분을 이전·회수하면 공제받은 세액이 추징됩니다(제2항). 타인의 지분을 양수한 경우는 제외됩니다.');
    r.notes.push('투자 연도 또는 그 후 2년 중 한 해를 골라 공제받을 수 있습니다. 같은 해 여러 건을 투자한 경우 구간 적용 방법은 시행령 원문 대조 전입니다(확실하지 않음).');
    r.status = 'CREDIT';
    return r;
  }

  /**
   * 창업중소기업 세액감면 §6
   * @param input era '2026'(2026-01-01 이후 창업)|'2025'(이전), youth(청년창업), region 'overcrowded'|'capitalOther'|'capitalDepop'|'nonCapital',
   *              industryOk, notStartup, revenue(수입금액, 만원), venture(창업 후 3년 이내 벤처 확인), tax(해당 사업 소득에 대한 세액, 만원)
   */
  function startup(input) {
    input = input || {};
    var errors = [], num = reader(errors);
    var r = { version: VERSION, status: null, errors: errors, notes: [], basis: [] };
    var region = ['overcrowded', 'capitalOther', 'capitalDepop', 'nonCapital'].indexOf(input.region) >= 0 ? input.region : null;
    if (!region) errors.push('창업 지역을 선택해 주세요.');
    var revenue = won(num(input.revenue, '연 수입금액', { optional: true }));
    var tax = won(num(input.tax, '감면 대상 세액', { optional: true }));
    if (errors.length) { r.status = 'INVALID'; return r; }
    var era26 = input.era !== '2025', youth = !!input.youth;
    var cands = [];
    if (input.industryOk && !input.notStartup) {
      var main;
      if (era26) main = youth ? { nonCapital: 100, capitalDepop: 100, capitalOther: 75, overcrowded: 50 }[region] : { nonCapital: 50, capitalDepop: 50, capitalOther: 25, overcrowded: 0 }[region];
      else main = region === 'overcrowded' ? (youth ? 50 : 0) : (youth ? 100 : 50);
      if (main) cands.push({ rate: main, why: '제1항제1호' + (era26 ? '나목' : '가목') + ' — ' + (youth ? '청년창업중소기업' : '창업중소기업') });
      if (!youth && revenue !== null && revenue <= 10400 * MAN) {
        var small = era26 ? { nonCapital: 100, capitalDepop: 100, capitalOther: 75, overcrowded: 50 }[region] : (region === 'overcrowded' ? 50 : 100);
        cands.push({ rate: small, why: '제6항 — 수입금액 1억4백만원 이하' });
      }
      if (input.venture) cands.push({ rate: 50, why: '제2항 — 창업 후 3년 이내 벤처기업 확인(제1항과 중복 불가)' });
    }
    var best = cands.reduce(function (a, b) { return !a || b.rate > a.rate ? b : a; }, null);
    r.rate = best ? best.rate : 0;
    r.eligible = r.rate > 0;
    r.why = best ? best.why : '';
    if (tax !== null) { var red = pct(tax, r.rate); r.capped = red > 5 * EOK; r.reduction = Math.min(red, 5 * EOK); }
    r.basis.push('「조세특례제한법」 제6조 — 최초 소득 발생 과세연도와 그 후 4년(총 5년) 감면, 2027-12-31까지 창업');
    if (best) r.basis.push('적용: ' + best.why + ' ' + best.rate + '%');
    else if (!input.industryOk) r.basis.push('같은 조 제3항 대상 업종이 아니면 감면되지 않습니다.');
    else if (input.notStartup) r.basis.push('같은 조 제10항 — 사업 승계·개인사업 법인전환·폐업 후 재개·업종 추가 등은 창업으로 보지 않습니다.');
    else r.basis.push('선택한 지역·유형은 감면 비율이 없습니다(예: 2026년 이후 과밀억제권역 일반 창업, 수입금액 1억4백만원 초과).');
    r.basis.push('같은 조 제13항 — 감면세액은 과세연도마다 5억원 한도');
    r.notes.push('청년(창업 당시 나이 기준)·업종 세부 범위·인구감소지역·수도권과밀억제권역 지역 범위는 시행령과 관련 법령에서 정하며 원문 대조 전입니다(확실하지 않음).');
    r.notes.push('상시근로자 증가에 따른 추가 감면(제7항)은 반영하지 않았습니다. 최저한세·농어촌특별세 해당 여부도 함께 확인하세요.');
    r.status = r.eligible ? 'ELIGIBLE' : 'NOT_ELIGIBLE';
    return r;
  }

  var api = { employment: employment, rnd: rnd, minimumTax: minimumTax, investment: investment, angel: angel, startup: startup, EMP: EMP, INV: INV, VERSION: VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TaxCreditRules = api;
})(this);
