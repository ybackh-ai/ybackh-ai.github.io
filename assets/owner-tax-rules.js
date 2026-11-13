/*
 * 임원 퇴직금 한도 · 불공정 증자·감자 증여이익 · 성실신고확인 대상 판정 (순수 함수, 브라우저·Node 공용). 근거: docs/49
 * 「법인세법 시행령」 제44조제4항, 같은 법 시행규칙 제22조제5항, 「소득세법」 제22조제3항·제4항, 같은 법 시행령 제42조의2,
 * 「상속세 및 증여세법」 제39조·제39조의2, 같은 법 시행령 제29조·제29조의2, 「소득세법」 제70조의2, 같은 법 시행령 제133조·제208조 (2026-11-13 조회)
 */
(function (root) {
  'use strict';
  var VERSION = '2026-11-13';
  var MAN = 10000;
  var EPS = 1e-6;
  function blank(v) { return v === undefined || v === null || v === ''; }
  function reader(errors) {
    return function (v, label, opt) {
      opt = opt || {};
      if (blank(v)) { if (opt.optional) return 0; errors.push(label + '을(를) 입력해 주세요.'); return 0; }
      var x = Number(v);
      if (!isFinite(x) || x < 0 || (opt.positive && x <= 0)) { errors.push(label + '은(는) ' + (opt.positive ? '0보다 큰' : '0 이상의') + ' 숫자로 입력해 주세요.'); return 0; }
      return x;
    };
  }

  // ── 날짜·개월 수 ──
  function parseDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '').trim());
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    var dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
    return dt;
  }
  function ymd(y, m, d) { return new Date(Date.UTC(y, m - 1, d)); }
  /** 시작일~종료일(양끝 포함)의 개월 수. ceil=true면 1개월 미만을 1개월로, 아니면 버림. 기간이 없으면 0 */
  function months(s, e, ceil) {
    if (!s || !e || e < s) return 0;
    var n = new Date(e.getTime() + 86400000); // 종료일 다음 날
    var m = (n.getUTCFullYear() - s.getUTCFullYear()) * 12 + (n.getUTCMonth() - s.getUTCMonth());
    var rem;
    if (n.getUTCDate() >= s.getUTCDate()) rem = n.getUTCDate() > s.getUTCDate();
    else { m -= 1; rem = true; }
    return m + (ceil && rem ? 1 : 0);
  }
  function maxD(a, b) { return a > b ? a : b; }
  function minD(a, b) { return a < b ? a : b; }

  /**
   * 임원 퇴직금 한도
   * @param input pay(지급액, 만원), hasRule('yes'|'no' 정관·위임규정), ruleAmount(정관상 금액, 만원), salary1y(퇴직 전 1년 총급여, 만원),
   *   start(임원 취임일), end(퇴직일), empStart(직원 기간 합산 시작일, 선택), avg2019(2012~2019 중 마지막 3년 연평균 총급여, 만원), avgRetire(퇴직 전 3년 연평균 총급여, 만원)
   */
  function execRetire(input) {
    input = input || {};
    var errors = [], num = reader(errors);
    var r = { version: VERSION, status: null, errors: errors, notes: [], basis: [] };
    var pay = Math.round(num(input.pay, '퇴직금 지급액', { positive: true }) * MAN);
    var rule = input.hasRule === 'yes';
    var s = parseDate(input.start), e = parseDate(input.end);
    if (!s) errors.push('임원 취임일을 날짜로 입력해 주세요.');
    if (!e) errors.push('퇴직일을 날짜로 입력해 주세요.');
    if (s && e && e < s) errors.push('퇴직일은 임원 취임일 이후여야 합니다.');
    var es = rule || blank(input.empStart) ? null : parseDate(input.empStart);
    if (!rule && !blank(input.empStart) && !es) errors.push('직원 입사일을 날짜로 입력해 주세요.');
    if (es && s && es > s) errors.push('직원 입사일은 임원 취임일보다 앞이어야 합니다.');
    var ruleAmount = rule ? Math.round(num(input.ruleAmount, '정관(퇴직급여지급규정)에 따른 금액') * MAN) : 0;
    var salary1y = rule ? 0 : Math.round(num(input.salary1y, '퇴직 전 1년 총급여') * MAN);
    if (errors.length) { r.status = 'INVALID'; return r; }

    // 1) 법인세 손금 한도
    r.corpMonths = months(es || s, e, false);
    r.corpYears = Math.floor(r.corpMonths / 12);
    r.corpLimit = rule ? ruleAmount : Math.floor(salary1y * r.corpMonths / 120 + EPS);
    r.corpExcess = Math.max(0, pay - r.corpLimit);
    r.retireBase = pay - r.corpExcess;

    // 2) 소득세법 임원 퇴직소득 한도
    var d2011 = ymd(2011, 12, 31), d2012 = ymd(2012, 1, 1), d2019 = ymd(2019, 12, 31), d2020 = ymd(2020, 1, 1);
    r.totalMonths = months(s, e, true);
    r.monthsC = months(s, minD(e, d2011), true);
    r.monthsA = months(maxD(s, d2012), minD(e, d2019), true);
    r.monthsB = months(maxD(s, d2020), e, true);
    var avg2019 = r.monthsA ? Math.round(num(input.avg2019, '2019년 말 기준 3년 연평균 총급여') * MAN) : 0;
    var avgRetire = r.monthsB ? Math.round(num(input.avgRetire, '퇴직 전 3년 연평균 총급여') * MAN) : 0;
    if (errors.length) { r.status = 'INVALID'; return r; }
    r.pre2012 = r.totalMonths ? Math.floor(r.retireBase * r.monthsC / r.totalMonths + EPS) : 0;
    r.subject = r.retireBase - r.pre2012;
    r.limitA = avg2019 * r.monthsA * 3 / 120;
    r.limitB = avgRetire * r.monthsB * 2 / 120;
    r.taxLimit = Math.floor(r.limitA + r.limitB + EPS);
    r.limitA = Math.floor(r.limitA + EPS); r.limitB = Math.floor(r.limitB + EPS);
    r.taxExcess = Math.max(0, r.subject - r.taxLimit);
    r.finalRetire = r.retireBase - r.taxExcess;
    r.wageTotal = r.corpExcess + r.taxExcess;

    r.basis.push('「법인세법 시행령」 제44조제4항' + (rule ? '제1호·제5항 — 정관(위임 규정 포함)에 정한 금액까지 손금' : '제2호 — 퇴직 전 1년 총급여 × 1/10 × 근속연수까지 손금'));
    r.basis.push('「법인세법 시행규칙」 제22조제5항 — 근속연수는 역년 기준, 1년 미만은 월수, 1개월 미만은 버림');
    r.basis.push('「소득세법」 제22조제3항 — 임원 퇴직소득 한도: 2012~2019 근무분 × 3배, 2020년 이후 근무분 × 2배 (연평균 총급여 × 1/10 × 근무기간/12), 초과분은 근로소득');
    r.basis.push('같은 조 제4항, 같은 법 시행령 제42조의2제6항 — 근무기간은 개월 수(1개월 미만은 1개월), 2011년 이전 근무분은 기간 비율로 제외');
    if (es) r.notes.push('직원에서 임원이 될 때 퇴직금을 받지 않은 경우로 보고 직원 기간을 법인세 근속연수에 합산했습니다(같은 영 제44조제4항제2호 후단). 소득세법 한도는 임원 취임일부터 계산했습니다.');
    r.notes.push('법인세법상 한도를 넘어 손금불산입된 금액은 상여로 처분되어 근로소득이 된다고 보고, 남은 금액에 소득세법 한도를 적용했습니다(실무 처리, 관련 시행령 원문 대조 전).');
    r.notes.push('2011년 말 정관 규정 금액을 선택하는 방법(같은 영 제42조의2제6항 괄호), 임원 퇴직급여지급규정의 적정성(급격한 지급배수 인상 등)에 대한 세무상 판단, 퇴직소득세 계산은 반영하지 않았습니다.');
    r.status = 'OK';
    return r;
  }

  /**
   * 불공정 증자·감자 증여이익. 금액은 원(1주당), 주식수는 주
   * mode: issue-low(저가 증자 가·다·라목) | issue-forfeit(저가 증자 나목) | cut-low(저가 감자) | cut-high(고가 감자)
   */
  function capitalGift(input) {
    input = input || {};
    var errors = [], num = reader(errors);
    var r = { version: VERSION, status: null, errors: errors, notes: [], basis: [] };
    var mode = input.mode || 'issue-low';
    r.mode = mode;
    var threshold30 = false;
    if (mode === 'issue-low' || mode === 'issue-forfeit') {
      var pre = num(input.preValue, '증자 전 1주당 평가액');
      var preShares = num(input.preShares, '증자 전 발행주식총수', { positive: true });
      var price = num(input.issuePrice, '신주 1주당 인수가액');
      if (mode === 'issue-low') {
        var newShares = num(input.newShares, '증자로 늘어난 주식수', { positive: true });
        var got = num(input.gotShares, '배정받은 실권주·신주 수(균등 초과분)', { positive: true });
        if (errors.length) { r.status = 'INVALID'; return r; }
        r.postValue = (pre * preShares + price * newShares) / (preShares + newShares);
        r.diff = r.postValue - price;
        r.applies = price < pre && !(pre <= 0 && r.postValue <= 0);
        r.gain = r.applies && r.diff > 0 ? Math.floor(r.diff * got + EPS) : 0;
        r.taxable = r.gain > 0;
        r.basis.push('「상속세 및 증여세법」 제39조제1항제1호가목·다목·라목 — 저가 신주를 실권주 배정, 제3자 직접 배정, 균등 비율 초과 배정으로 받은 이익');
        r.basis.push('같은 법 시행령 제29조제2항제1호 — (증자 후 1주당 가액 − 인수가액) × 배정받은 주식수. 기준금액 조건 없음');
      } else {
        var equalNew = num(input.equalNew, '균등 증자 시 증가할 주식수', { positive: true });
        var forfeitTotal = num(input.forfeitTotal, '실권주 총수', { positive: true });
        var acqPost = num(input.acqPostShares, '신주인수자의 증자 후 주식수');
        var postTotal = num(input.postTotalShares, '증자 후 발행주식총수', { positive: true });
        var relatedForfeit = num(input.relatedForfeit, '신주인수자의 특수관계인 실권주수');
        if (!errors.length && relatedForfeit > forfeitTotal) errors.push('특수관계인 실권주수는 실권주 총수 이하여야 합니다.');
        if (!errors.length && acqPost > postTotal) errors.push('신주인수자 주식수는 증자 후 발행주식총수 이하여야 합니다.');
        if (errors.length) { r.status = 'INVALID'; return r; }
        r.postValue = (pre * preShares + price * equalNew) / (preShares + equalNew);
        r.diff = r.postValue - price;
        r.applies = price < pre && !(pre <= 0 && r.postValue <= 0);
        r.gain = r.applies && r.diff > 0 ? Math.floor(r.diff * relatedForfeit * acqPost / postTotal + EPS) : 0;
        threshold30 = r.postValue > 0 && r.diff >= r.postValue * 0.3 - EPS;
        r.diffPct = r.postValue > 0 ? Math.round(r.diff / r.postValue * 1000) / 10 : null;
        r.taxable = r.gain > 0 && (threshold30 || r.gain >= 300000000);
        r.basis.push('「상속세 및 증여세법」 제39조제1항제1호나목 — 실권주를 배정하지 않을 때 포기한 주주의 특수관계인이 신주를 인수해 얻은 이익');
        r.basis.push('같은 법 시행령 제29조제2항제2호 — 균등 증자 기준 1주당 가액으로 계산, 차액이 그 가액의 30% 이상이거나 이익이 3억원 이상일 때만 과세');
      }
      r.postValue = Math.round(r.postValue * 100) / 100;
      r.notes.push('비상장법인 기준입니다. 주권상장법인 등은 증자 후 실제 평가가액이 산식 가액보다 적으면 그 가액을 씁니다(같은 영 제29조제2항 각 호 단서). 증자 전 1주당 평가액은 상증법 제60조·제63조 시가(비상장주식은 보충적 평가액)입니다.');
      r.notes.push('고가 증자(같은 법 제39조제1항제2호), 전환주식(제3호), 소액주주가 2명 이상일 때 1명으로 보는 규정(제2항)은 반영하지 않았습니다.');
    } else if (mode === 'cut-low' || mode === 'cut-high') {
      var value = num(input.value, '감자한 주식 1주당 평가액');
      var paid = num(input.paid, '소각 때 지급한 1주당 금액');
      if (mode === 'cut-low') {
        var cutTotal = num(input.cutTotal, '총감자 주식수', { positive: true });
        var majorPost = num(input.majorPostShares, '대주주의 감자 후 주식수');
        var postTotal2 = num(input.postTotalShares, '감자 후 발행주식총수', { positive: true });
        var relatedCut = num(input.relatedCut, '대주주의 특수관계인이 감자한 주식수');
        if (!errors.length && relatedCut > cutTotal) errors.push('특수관계인 감자 주식수는 총감자 주식수 이하여야 합니다.');
        if (!errors.length && majorPost > postTotal2) errors.push('대주주 주식수는 감자 후 발행주식총수 이하여야 합니다.');
        if (errors.length) { r.status = 'INVALID'; return r; }
        r.diff = value - paid;
        r.applies = r.diff > 0;
        r.gain = r.applies ? Math.floor(r.diff * relatedCut * majorPost / postTotal2 + EPS) : 0;
        r.basis.push('「상속세 및 증여세법」 제39조의2제1항제1호 — 시가보다 낮은 대가로 소각: 소각한 주주의 특수관계인인 대주주가 얻은 이익');
        r.basis.push('같은 법 시행령 제29조의2제1항제1호 — (1주당 평가액 − 지급액) × 총감자 주식수 × 대주주 감자 후 지분비율 × 특수관계인 감자 주식수/총감자 주식수');
      } else {
        var face = num(input.face, '1주당 액면가액', { positive: true });
        var holderCut = num(input.holderCut, '해당 주주의 감자 주식수', { positive: true });
        if (errors.length) { r.status = 'INVALID'; return r; }
        r.diff = paid - value;
        r.cap = paid < face ? paid : face;
        r.applies = r.diff > 0 && value < r.cap;
        r.gain = r.applies ? Math.floor(r.diff * holderCut + EPS) : 0;
        r.basis.push('「상속세 및 증여세법」 제39조의2제1항제2호 — 시가보다 높은 대가로 소각: 대주주의 특수관계인인 소각 주주가 얻은 이익');
        r.basis.push('같은 법 시행령 제29조의2제1항제2호 — 1주당 평가액이 액면가액(대가가 액면보다 낮으면 대가)에 못 미칠 때만, (지급액 − 평가액) × 감자 주식수');
        if (!r.applies && r.diff > 0) r.notes.push('1주당 평가액이 액면가액(또는 대가) 이상이라 이 규정의 계산 대상이 아닙니다. 다른 증여 규정이나 의제배당 검토는 별도입니다.');
      }
      threshold30 = value <= 0 ? r.diff > 0 : Math.abs(r.diff) >= value * 0.3 - EPS;
      r.diffPct = value > 0 ? Math.round(Math.abs(r.diff) / value * 1000) / 10 : null;
      r.taxable = r.gain > 0 && (threshold30 || r.gain >= 300000000);
      r.basis.push('같은 영 제29조의2제2항 — 이익이 3억원 미만이면 제외. 다만 차액이 1주당 평가액의 30% 이상이면 기준금액 0');
      r.notes.push('1주당 평가액은 상증법 제60조·제63조 시가(비상장주식은 보충적 평가액)입니다. 감자 대가를 받은 주주의 의제배당(소득세·법인세)은 별도로 검토해야 합니다.');
    } else {
      errors.push('계산 유형을 골라 주세요.');
      r.status = 'INVALID'; return r;
    }
    r.threshold30 = threshold30;
    r.notes.push('증여일은 증자는 주식대금 납입일 등(같은 영 제29조제1항), 감자는 감자 주주총회 결의일입니다. 특수관계 여부는 따로 확인해야 합니다.');
    r.status = 'OK';
    return r;
  }

  var SF = {
    1: { label: '농업·임업·어업, 광업, 도소매업(상품중개업 제외), 부동산매매업, 그 밖의 업종', limit: 150000, book: 30000 },
    2: { label: '제조업, 숙박·음식점업, 건설업, 운수·창고업, 정보통신업, 금융·보험업, 상품중개업 등', limit: 75000, book: 15000 },
    3: { label: '부동산임대업, 전문·과학·기술 서비스업, 교육·보건 서비스업, 사업지원 서비스업 등', limit: 50000, book: 7500 }
  };
  /** 성실신고확인 대상 판정. @param input g1, g2, g3 (업종군별 해당 과세기간 수입금액, 만원) */
  function sincereFiling(input) {
    input = input || {};
    var errors = [], num = reader(errors);
    var r = { version: VERSION, status: null, errors: errors, notes: [], basis: [] };
    var g = { 1: num(input.g1, '1군 수입금액', { optional: true }), 2: num(input.g2, '2군 수입금액', { optional: true }), 3: num(input.g3, '3군 수입금액', { optional: true }) };
    if (!errors.length && g[1] + g[2] + g[3] <= 0) errors.push('업종별 수입금액을 하나 이상 입력해 주세요.');
    if (errors.length) { r.status = 'INVALID'; return r; }
    var main = 1;
    [2, 3].forEach(function (k) { if (g[k] > g[main]) main = k; });
    function conv(key) {
      var t = 0;
      [1, 2, 3].forEach(function (k) { if (g[k]) t += k === main ? g[k] : g[k] * SF[main][key] / SF[k][key]; });
      return Math.round(t * MAN);
    }
    r.main = main;
    r.mainLabel = SF[main].label;
    r.revenue = Math.round((g[1] + g[2] + g[3]) * MAN);
    r.converted = conv('limit');
    r.limit = SF[main].limit * MAN;
    r.target = r.converted >= r.limit;
    r.bookConverted = conv('book');
    r.bookLimit = SF[main].book * MAN;
    r.bookkeeping = r.bookConverted >= r.bookLimit;
    r.groups = [1, 2, 3].map(function (k) { return { key: k, label: SF[k].label, revenue: Math.round(g[k] * MAN), limit: SF[k].limit * MAN }; });
    r.basis.push('「소득세법」 제70조의2제1항·제2항 — 업종별 수입금액 기준 이상이면 성실신고확인서 제출, 확정신고 기한 다음 해 6월 30일');
    r.basis.push('「소득세법 시행령」 제133조제1항 — 15억원(1호), 7억5천만원(2호), 5억원(3호). 1·2호 업종 중 별표 3의3 사업서비스업은 5억원');
    if ([1, 2, 3].filter(function (k) { return g[k] > 0; }).length > 1) r.basis.push('같은 영 제133조제2항, 제208조제7항 — 겸영 시 주업종 수입금액 + 다른 업종 수입금액 × (주업종 기준금액 / 그 업종 기준금액)');
    r.basis.push('같은 영 제208조제5항제2호 — 복식부기의무 기준 3억원·1억5천만원·7천500만원(직전 과세기간 수입금액으로 다음 해 판단)');
    r.notes.push('수입금액에서 사업용 유형자산 양도로 생긴 수입금액은 뺍니다(같은 영 제133조제1항). 1·2군 업종이라도 별표 3의3 사업서비스업이면 3군에 넣어 주세요.');
    r.notes.push('성실신고확인대상 개인사업자가 현물출자 등으로 법인 전환하면, 전환 후 3년 이내 사업연도에는 법인도 성실신고확인서를 내야 합니다(「법인세법」 제60조의2제1항제2호, 외부감사를 받은 법인은 제외 가능).');
    r.notes.push('수입금액이 가장 큰 업종을 주업종으로 보며, 금액이 같을 때의 기준은 조문에 없어 번호가 작은 업종군을 골랐습니다(확실하지 않음).');
    r.status = 'OK';
    return r;
  }

  var api = { execRetire: execRetire, capitalGift: capitalGift, sincereFiling: sincereFiling, months: months, SF: SF, VERSION: VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OwnerTaxRules = api;
})(this);
