/*
 * 결산·회계처리 계산 7종 (순수 함수, 브라우저·Node 공용) — docs/57_결산회계처리7종_로직.md
 *  devCost        개발비 자산화 요건 진단      K-IFRS 1038 ¶53·54·57·65 / 일반기업회계기준 11.18~11.21
 *  fxTranslation  외화환산 손익                K-IFRS 1021 ¶16·23·28 / 일반기업회계기준 23.9
 *  inventoryLcm   재고자산 저가법 평가손실     K-IFRS 1002 ¶6·28·29·32·33 / 일반기업회계기준 7.16~7.20
 *  govGrant       정부보조금 회계처리          K-IFRS 1020 ¶12·17·24·26·29 / 일반기업회계기준 17.5~17.7
 *  unusedLeave    미사용 연차수당 부채         K-IFRS 1019 ¶13·15·16
 *  accrualPrepaid 선급·미지급비용 기간 배분    일반 산식(월할·일할), 법령·기준서 숫자 없음
 *  effectiveInterest 차입금·사채 유효이자율 상각표  K-IFRS 1109 부록 A(유효이자율·상각후원가) / 일반기업회계기준 제6장 용어의 정의
 * 원문 확인: 2026-11-19 한국회계기준원 회계기준열람서비스(db.kasb.or.kr).
 * 금액 입력은 만원(외화 금액·환율·일급은 표시된 단위), 결과는 원 정수.
 */
(function (root) {
  'use strict';
  var VERSION = '2026-11-19';
  var MAN = 10000;

  function blank(v) { return v === undefined || v === null || v === ''; }
  function reader(errors) {
    return function (v, name, opt) {
      opt = opt || {};
      if (blank(v)) {
        if (opt.optional) return opt.def !== undefined ? opt.def : 0;
        errors.push(name + ': 값을 입력해 주세요.'); return null;
      }
      var x = Number(String(v).replace(/,/g, ''));
      if (!isFinite(x)) { errors.push(name + ': 숫자를 입력해 주세요.'); return null; }
      if (opt.min !== undefined && x < opt.min) { errors.push(name + ': ' + opt.min + ' 이상이어야 합니다.'); return null; }
      if (opt.gt !== undefined && x <= opt.gt) { errors.push(name + ': ' + opt.gt + '보다 커야 합니다.'); return null; }
      if (opt.max !== undefined && x > opt.max) { errors.push(name + ': ' + opt.max + ' 이하여야 합니다.'); return null; }
      return x;
    };
  }
  function base(basis) { return { version: VERSION, status: null, errors: [], notes: [], basis: basis }; }

  // ── 1. 개발비 자산화 요건 ──
  var DEV_CRITERIA = [
    ['tech', '완성할 수 있는 기술적 실현가능성'],
    ['intent', '완성해서 사용하거나 판매하려는 회사의 의도'],
    ['ability', '사용하거나 판매할 수 있는 회사의 능력'],
    ['benefit', '미래경제적효익을 창출하는 방법(시장이 있거나 내부에서 쓸모가 있음)'],
    ['resources', '개발을 끝내는 데 필요한 기술적·재정적 자원의 확보'],
    ['measure', '개발 지출을 신뢰성 있게 구분해 측정할 수 있는 능력']
  ];
  function devCost(input) {
    input = input || {};
    var r = base(['K-IFRS 1038 문단 53·54·57·65', '일반기업회계기준 제11장 문단 11.18~11.21']);
    var num = reader(r.errors);
    var stage = input.stage;
    if (['research', 'development', 'unclear'].indexOf(stage) < 0) r.errors.push('프로젝트 단계를 골라 주세요.');
    var before = num(input.spendBefore, '요건 충족 전 지출', { optional: true, min: 0 });
    var after = num(input.spendAfter, '요건 충족 후 지출', { optional: true, min: 0 });
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    var met = Array.isArray(input.criteria) ? input.criteria : [];
    r.metCount = DEV_CRITERIA.filter(function (c) { return met.indexOf(c[0]) >= 0; }).length;
    r.missing = DEV_CRITERIA.filter(function (c) { return met.indexOf(c[0]) < 0; }).map(function (c) { return c[1]; });
    var total = Math.round((before + after) * MAN);
    if (stage !== 'development') {
      r.status = 'EXPENSE'; r.capitalized = 0; r.expensed = total;
      r.notes.push(stage === 'research' ? '연구단계 지출은 무형자산으로 인식하지 않고 발생한 기간의 비용으로 처리합니다.' : '연구단계와 개발단계를 구분할 수 없으면 모두 연구단계 지출로 봅니다.');
    } else if (r.metCount < 6) {
      r.status = 'EXPENSE'; r.capitalized = 0; r.expensed = total;
      r.notes.push('여섯 가지 요건을 모두 제시할 수 있어야 자산으로 인식합니다. 충족하지 못한 요건이 있어 전액 비용으로 계산했습니다.');
    } else {
      r.capitalized = Math.round(after * MAN); r.expensed = Math.round(before * MAN);
      r.status = r.capitalized > 0 ? 'CAPITALIZE' : 'EXPENSE';
      r.notes.push('요건을 처음 충족한 뒤의 지출만 원가가 되며, 이미 비용으로 처리한 지출은 나중에 자산으로 되돌리지 않습니다(K-IFRS 1038 문단 65).');
    }
    if (total === 0) r.notes.push('지출 금액을 넣지 않아 요건 진단만 표시했습니다.');
    return r;
  }

  // ── 2. 외화환산 ──
  function fxTranslation(input) {
    input = input || {};
    var r = base(['K-IFRS 1021 문단 16·23·28', '일반기업회계기준 제23장 문단 23.9']);
    var num = reader(r.errors);
    var kind = input.kind;
    if (['monetaryAsset', 'monetaryLiability', 'nonmonetary'].indexOf(kind) < 0) r.errors.push('항목 구분을 골라 주세요.');
    var fcy = num(input.fcy, '외화 금액', { gt: 0 });
    var bookRate = num(input.bookRate, '장부상 환율', { gt: 0 });
    var closingRate = num(input.closingRate, '보고기간 말 마감환율', { gt: 0 });
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    r.bookKrw = Math.round(fcy * bookRate);
    if (kind === 'nonmonetary') {
      r.translated = r.bookKrw; r.gain = 0; r.status = 'NONE';
      r.notes.push('역사적원가로 측정하는 비화폐성 항목(선급금·재고·유형자산 등)은 거래일 환율 그대로 두고 다시 환산하지 않습니다. 공정가치로 측정하는 항목은 공정가치를 정한 날의 환율을 씁니다.');
      return r;
    }
    r.translated = Math.round(fcy * closingRate);
    var diff = r.translated - r.bookKrw;
    r.gain = kind === 'monetaryAsset' ? diff : -diff;
    r.status = r.gain > 0 ? 'GAIN' : r.gain < 0 ? 'LOSS' : 'NONE';
    r.notes.push('화폐성 항목은 마감환율로 환산하고, 그 차이(외화환산이익·손실)는 당기손익으로 인식합니다.');
    return r;
  }

  // ── 3. 재고자산 저가법 ──
  function inventoryLcm(input) {
    input = input || {};
    var r = base(['K-IFRS 1002 문단 6·28·29·32·33', '일반기업회계기준 제7장 문단 7.16~7.20']);
    var num = reader(r.errors);
    var cost = num(input.cost, '취득원가(장부상 원가)', { gt: 0 });
    var sales = num(input.sales, '예상 판매가격', { min: 0 });
    var complete = num(input.completion, '추가 완성원가', { optional: true, min: 0 });
    var selling = num(input.selling, '예상 판매비용', { optional: true, min: 0 });
    var prior = num(input.prior, '기존 평가충당금', { optional: true, min: 0 });
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    r.nrv = Math.round((sales - complete - selling) * MAN);
    var costW = Math.round(cost * MAN), priorW = Math.round(prior * MAN);
    var exempt = input.kind === 'raw' && !!input.finishedAboveCost;
    r.allowance = exempt ? 0 : Math.max(0, costW - r.nrv);
    r.carrying = costW - r.allowance;
    r.charge = r.allowance - priorW;
    r.status = r.charge > 0 ? 'LOSS' : r.charge < 0 ? 'REVERSAL' : 'NONE';
    if (exempt) r.notes.push('이 원재료로 만들 제품이 원가 이상으로 팔릴 것으로 예상되면 원재료는 감액하지 않습니다.');
    if (r.status === 'REVERSAL') r.notes.push('평가손실 환입은 처음 장부금액(취득원가)을 넘지 않는 범위에서만 인식합니다.');
    r.notes.push('저가법은 항목별로 적용합니다. 비슷한 제품군만 묶을 수 있고, 재고 전체를 합쳐 비교하면 안 됩니다.');
    return r;
  }

  // ── 4. 정부보조금 ──
  function govGrant(input) {
    input = input || {};
    var r = base(['K-IFRS 1020 문단 12·17·24·26·29', '일반기업회계기준 제17장 문단 17.5~17.7']);
    var num = reader(r.errors);
    var type = input.type === 'income' ? 'income' : 'asset';
    var grant = num(input.grant, '보조금 금액', { gt: 0 });
    if (type === 'income') {
      if (r.errors.length) { r.status = 'INVALID'; return r; }
      var g = Math.round(grant * MAN);
      if (input.conditionMet) { r.status = 'INCOME'; r.grantIncome = g; r.deferred = 0; r.notes.push('수익관련보조금은 보전하려는 비용을 인식하는 기간에 당기손익으로 인식합니다. 별도 수익으로 표시하거나 관련 비용에서 빼서 표시할 수 있습니다.'); }
      else { r.status = 'DEFERRED'; r.grantIncome = 0; r.deferred = g; r.notes.push('사용 조건을 아직 충족하지 못했다면 받은 보조금은 선수수익(부채)으로 두었다가 조건을 충족하는 기간에 손익으로 옮깁니다.'); }
      return r;
    }
    var cost = num(input.assetCost, '자산 취득원가', { gt: 0 });
    var life = num(input.life, '내용연수', { gt: 0, max: 100 });
    var residual = num(input.residual, '잔존가치', { optional: true, min: 0 });
    var months = num(input.months, '첫해 사용 개월 수', { optional: true, def: 12, gt: 0, max: 12 });
    if (!r.errors.length && grant > cost) r.errors.push('보조금이 자산 취득원가보다 클 수 없습니다.');
    if (!r.errors.length && residual >= cost) r.errors.push('잔존가치는 취득원가보다 작아야 합니다.');
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    var method = input.method === 'deferred' ? 'deferred' : 'deduct';
    if (input.standard === 'kgaap' && method === 'deferred') { method = 'deduct'; r.notes.push('일반기업회계기준은 자산관련보조금을 관련 자산의 차감계정으로만 처리합니다(17.5). 이연수익 방식 대신 자산 차감 방식으로 계산했습니다.'); }
    r.methodUsed = method;
    var costW = Math.round(cost * MAN), grantW = Math.round(grant * MAN), resW = Math.round(residual * MAN);
    r.depreciation = Math.round((costW - resW) / life * months / 12);
    r.grantAmort = Math.round(grantW * r.depreciation / (costW - resW));
    r.netDep = r.depreciation - r.grantAmort;
    r.netCarrying = costW - grantW - r.netDep;
    r.status = 'ASSET';
    r.notes.push(method === 'deduct' ? '보조금을 자산에서 빼서 표시하고, 감가상각비와 같은 비율로 상계합니다. 자산을 처분하면 남은 보조금은 처분손익에 반영합니다.' : '보조금을 이연수익(부채)으로 두고 자산의 내용연수에 걸쳐 감가상각 비율대로 수익으로 옮깁니다.');
    if (months < 12) r.notes.push('첫해는 ' + months + '개월만 월할로 상각했습니다.');
    return r;
  }

  // ── 5. 미사용 연차수당 ──
  function unusedLeave(input) {
    input = input || {};
    var r = base(['K-IFRS 1019 문단 13·15·16']);
    var num = reader(r.errors);
    var daysV = num(input.days, '미사용 연차 일수 합계', { min: 0 });
    var wage = num(input.dailyWage, '1일 통상임금', { gt: 0 });
    var payout = num(input.payoutPct, '수당으로 지급할 것으로 예상하는 비율', { optional: true, def: 100, min: 0, max: 100 });
    var burden = num(input.burdenPct, '사업주 부담 사회보험료율', { optional: true, min: 0, max: 30 });
    var prior = num(input.prior, '전기 말 미지급 연차수당', { optional: true, min: 0 });
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    r.base = Math.round(daysV * wage * payout / 100);
    r.burden = Math.round(r.base * burden / 100);
    r.liability = r.base + r.burden;
    r.change = r.liability - Math.round(prior * MAN);
    r.status = r.liability > 0 ? 'LIABILITY' : 'NONE';
    r.notes.push('다음 해로 넘어가거나 수당으로 받을 수 있는 누적 유급휴가는 근무를 제공한 기간에 부채로 인식하고, 회사가 추가로 지급할 것으로 예상하는 금액으로 측정합니다.');
    if (payout < 100) r.notes.push('사용 촉진 등으로 수당 없이 소멸할 것으로 예상되는 일수를 빼고 계산했습니다(지급 예상 비율 ' + payout + '%).');
    return r;
  }

  // ── 6. 선급·미지급비용 기간 배분 ──
  function parseDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    var t = Date.UTC(y, mo - 1, d);
    var chk = new Date(t);
    if (chk.getUTCMonth() !== mo - 1 || chk.getUTCDate() !== d) return null;
    return { y: y, m: mo, d: d, t: t };
  }
  function accrualPrepaid(input) {
    input = input || {};
    var r = base(['일반 산식(월할·일할 기간 배분). 법령·기준서의 숫자 기준은 없습니다']);
    var num = reader(r.errors);
    var amount = num(input.amount, '총 금액', { gt: 0 });
    var s = parseDate(input.start), e = parseDate(input.end), c = parseDate(input.closing);
    if (!s) r.errors.push('시작일을 입력해 주세요.');
    if (!e) r.errors.push('종료일을 입력해 주세요.');
    if (!c) r.errors.push('결산일을 입력해 주세요.');
    if (s && e && e.t < s.t) r.errors.push('종료일은 시작일 뒤여야 합니다.');
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    var method = input.method === 'day' ? 'day' : 'month';
    var total, elapsed;
    if (method === 'month') {
      total = (e.y * 12 + e.m) - (s.y * 12 + s.m) + 1;
      elapsed = (c.y * 12 + c.m) - (s.y * 12 + s.m) + 1;
    } else {
      total = Math.round((e.t - s.t) / 86400000) + 1;
      elapsed = Math.round((c.t - s.t) / 86400000) + 1;
    }
    elapsed = Math.max(0, Math.min(total, elapsed));
    var amt = Math.round(amount * MAN);
    r.method = method; r.totalUnits = total; r.elapsedUnits = elapsed;
    r.currentExpense = Math.round(amt * elapsed / total);
    var type = input.type === 'accrued' ? 'accrued' : 'prepaid';
    r.type = type;
    r.balance = type === 'prepaid' ? amt - r.currentExpense : r.currentExpense;
    r.status = r.balance > 0 ? (type === 'prepaid' ? 'PREPAID' : 'ACCRUED') : 'NONE';
    r.notes.push(method === 'month' ? '월할 계산: 시작한 달과 결산일이 속한 달을 한 달로 셉니다.' : '일할 계산: 시작일과 결산일을 모두 포함해 셉니다.');
    if (type === 'accrued') r.notes.push('아직 지급하지 않았지만 결산일까지 발생한 비용을 미지급비용으로 잡습니다(이자는 미지급이자).');
    return r;
  }

  // ── 7. 유효이자율 상각표 ──
  function pv(face, coupon, rate, periods) {
    if (rate === 0) return face + coupon * periods;
    var d = Math.pow(1 + rate, -periods);
    return face * d + coupon * (1 - d) / rate;
  }
  function effectiveInterest(input) {
    input = input || {};
    var r = base(['K-IFRS 1109 부록 A 용어의 정의(유효이자율, 상각후원가)', '일반기업회계기준 제6장 용어의 정의(유효이자율법)']);
    var num = reader(r.errors);
    var face = num(input.face, '액면금액', { gt: 0 });
    var coupon = num(input.couponRate, '표면이자율', { min: 0, max: 100 });
    var years = num(input.years, '만기(년)', { gt: 0, max: 30 });
    var freq = input.freq === '2' || input.freq === 2 ? 2 : input.freq === '4' || input.freq === 4 ? 4 : 1;
    var market = num(input.marketRate, '발행 시 시장이자율', { optional: true, def: null, min: 0, max: 100 });
    var price = num(input.issuePrice, '발행가액(받은 금액)', { optional: true, def: null, gt: 0 });
    var tc = num(input.transactionCost, '거래원가(발행비용)', { optional: true, min: 0 });
    if (!r.errors.length && market === null && price === null) r.errors.push('발행 시 시장이자율이나 발행가액 중 하나를 입력해 주세요.');
    var periods = years * freq;
    if (!r.errors.length && Math.abs(periods - Math.round(periods)) > 1e-9) r.errors.push('만기 × 연 이자 지급 횟수가 정수가 되어야 합니다.');
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    periods = Math.round(periods);
    var faceW = Math.round(face * MAN);
    var cpn = Math.round(faceW * coupon / 100 / freq);
    r.issuePrice = price !== null ? Math.round(price * MAN) : Math.round(pv(faceW, cpn, market / 100 / freq, periods));
    var tcW = Math.round(tc * MAN);
    r.initialCarrying = r.issuePrice - tcW;
    if (r.initialCarrying <= 0) { r.errors.push('발행가액에서 거래원가를 뺀 금액이 0보다 커야 합니다.'); r.status = 'INVALID'; return r; }
    var rate;
    if (market !== null && price === null && tcW === 0) rate = market / 100 / freq;
    else {
      var lo = -0.99, hi = 1;
      for (var k = 0; k < 200; k++) { var mid = (lo + hi) / 2; if (pv(faceW, cpn, mid, periods) > r.initialCarrying) lo = mid; else hi = mid; }
      rate = (lo + hi) / 2;
    }
    r.eirPct = Math.round(rate * freq * 10000) / 100;
    r.rows = [];
    var bal = r.initialCarrying, totalInt = 0;
    for (var p = 1; p <= periods; p++) {
      var interest = p === periods ? faceW + cpn - bal : Math.round(bal * rate);
      var end = bal + interest - cpn;
      r.rows.push({ period: p, begin: bal, interest: interest, cash: cpn, amort: interest - cpn, end: end });
      totalInt += interest; bal = end;
    }
    r.firstInterest = r.rows[0].interest;
    r.totalInterest = totalInt;
    r.couponTotal = cpn * periods;
    r.status = r.initialCarrying < faceW ? 'DISCOUNT' : r.initialCarrying > faceW ? 'PREMIUM' : 'PAR';
    r.notes.push('유효이자율은 남은 현금흐름의 현재가치를 최초 장부금액(받은 금액 − 거래원가)과 같게 만드는 이자율입니다. 이자비용 = 기초 장부금액 × 유효이자율, 차액이 할인(할증)발행차금 상각액입니다.');
    if (tcW > 0) r.notes.push('거래원가를 장부금액에서 빼고 유효이자율을 다시 구해, 만기까지 이자비용으로 나눠 인식했습니다.');
    r.notes.push('기간별 이자는 원 단위로 반올림하고, 마지막 회차에서 단수 차이를 맞췄습니다.');
    return r;
  }

  var api = { devCost: devCost, fxTranslation: fxTranslation, inventoryLcm: inventoryLcm, govGrant: govGrant, unusedLeave: unusedLeave, accrualPrepaid: accrualPrepaid, effectiveInterest: effectiveInterest, DEV_CRITERIA: DEV_CRITERIA, VERSION: VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ClosingRules = api;
})(this);
