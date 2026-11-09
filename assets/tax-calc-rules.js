/*
 * 법인세 간이 계산 + 원천징수세액 계산 (순수 함수, 브라우저·Node 공용). 근거: docs/45_법인세_원천징수_로직.md
 * 「법인세법」 제13조제1항, 제55조, 「소득세법」 제129조제1항, 같은 법 시행령 제87조 (2026-11-09 조회). 세율표는 tax-tools-rules.js 단일 출처.
 */
(function (root) {
  'use strict';
  var VERSION = '2026-11-09';
  var MAN = 10000;
  var TT = (typeof module !== 'undefined' && module.exports) ? require('./tax-tools-rules.js') : root.TaxTools;
  function blank(v) { return v === undefined || v === null || v === ''; }
  function reader(errors) {
    return function (v, label, opt) {
      opt = opt || {};
      if (blank(v)) { if (opt.optional) return 0; errors.push(label + '을(를) 입력해 주세요.'); return 0; }
      var x = Number(v);
      if (!isFinite(x) || (!opt.allowNeg && x < 0) || (opt.positive && x <= 0)) { errors.push(label + '은(는) ' + (opt.positive ? '0보다 큰' : '0 이상의') + ' 숫자로 입력해 주세요.'); return 0; }
      if (opt.max !== undefined && x > opt.max) { errors.push(label + '은(는) ' + opt.max + ' 이하로 입력해 주세요.'); return 0; }
      return x;
    };
  }

  /**
   * @param input income(각 사업연도 소득, 만원, 음수 = 결손), loss(공제 가능한 15년 이내 이월결손금, 만원), sme(중소기업·회생계획 이행 법인 등 100%),
   *              nontax(비과세·소득공제, 만원), months(사업연도 월수), special(성실신고확인 대상 소규모 법인), credits(세액공제·감면, 만원), prepaid(중간예납·원천징수 등 기납부, 만원)
   */
  function corpTax(input) {
    input = input || {};
    var errors = [], num = reader(errors);
    var r = { version: VERSION, status: null, errors: errors, notes: [], basis: [] };
    var income = Math.round(num(input.income, '각 사업연도 소득', { allowNeg: true }) * MAN);
    var loss = Math.round(num(input.loss, '이월결손금', { optional: true }) * MAN);
    var nontax = Math.round(num(input.nontax, '비과세소득·소득공제', { optional: true }) * MAN);
    var months = blank(input.months) ? 12 : num(input.months, '사업연도 월수', { positive: true, max: 12 });
    var credits = Math.round(num(input.credits, '세액공제·감면', { optional: true }) * MAN);
    var prepaid = Math.round(num(input.prepaid, '기납부세액', { optional: true }) * MAN);
    if (months && months !== Math.floor(months)) errors.push('사업연도 월수는 정수로 입력해 주세요.');
    if (errors.length) { r.status = 'INVALID'; return r; }
    r.newLoss = income < 0 ? -income : 0;
    var pos = Math.max(0, income);
    var cap = input.sme ? pos : Math.floor(pos * 0.8);
    r.lossUsed = Math.min(loss, cap);
    r.lossRemain = loss - r.lossUsed;
    r.base = Math.max(0, pos - r.lossUsed - nontax);
    if (months < 12) {
      r.annualBase = Math.floor(r.base / months * 12);
      r.grossTax = Math.floor(TT.corpTax(r.annualBase, !!input.special) * months / 12);
    } else r.grossTax = TT.corpTax(r.base, !!input.special);
    r.creditsUsed = Math.min(credits, r.grossTax);
    r.determinedTax = r.grossTax - r.creditsUsed;
    r.payable = r.determinedTax - prepaid;
    r.localTax = Math.floor(r.grossTax / 10);
    r.basis.push('「법인세법」 제13조제1항 — 과세표준 = 소득 − 이월결손금(15년 이내, ' + (input.sme ? '중소기업 등 소득의 100%' : '소득의 80%') + ' 한도) − 비과세소득 − 소득공제');
    r.basis.push('「법인세법」 제55조제1항' + (input.special ? '제2호 — 성실신고확인 대상 소규모 법인: 200억원 이하 20%, 3천억원 이하 22%, 초과 25%' : '제1호 — 2억원 이하 10%, 200억원 이하 20%, 3천억원 이하 22%, 초과 25%'));
    if (months < 12) r.basis.push('같은 조 제2항 — 사업연도 1년 미만: 과세표준을 12개월로 환산해 세율 적용 후 월수/12 곱함');
    r.notes.push('지방소득세는 산출세액의 10%로 어림했습니다(「지방세법」 세율 원문 대조 전). 최저한세(「조세특례제한법」 제132조), 토지등 양도소득, 미환류소득 법인세, 농어촌특별세는 반영하지 않았습니다.');
    r.notes.push('각 사업연도 소득은 결산 손익에 세무조정(익금·손금 산입·불산입)을 반영한 금액입니다.');
    r.status = 'OK';
    return r;
  }

  var WH = {
    business: { label: '사업소득(프리랜서 인적용역 등)', exp: 0, rate: 3, basis: '「소득세법」 제129조제1항제3호 — 원천징수대상 사업소득 3%' },
    other60: { label: '기타소득 — 일시적 강연료·인적용역·원고료 등', exp: 60, rate: 20, basis: '「소득세법」 제129조제1항제6호라목 20%, 같은 법 시행령 제87조제1호의2 — 받은 금액의 60% 필요경비' },
    other80: { label: '기타소득 — 공익법인 상금·경연대회 상금 등', exp: 80, rate: 20, basis: '「소득세법」 제129조제1항제6호라목 20%, 같은 법 시행령 제87조제1호 — 받은 금액의 80% 필요경비' },
    interest: { label: '이자소득(비영업대금 외)', exp: 0, rate: 14, basis: '「소득세법」 제129조제1항제1호라목 — 14%' },
    loan: { label: '이자소득 — 비영업대금의 이익(개인 간 대여금 이자 등)', exp: 0, rate: 25, basis: '「소득세법」 제129조제1항제1호나목 — 25%' },
    dividend: { label: '배당소득', exp: 0, rate: 14, basis: '「소득세법」 제129조제1항제2호나목 — 14%' }
  };
  function whCalc(type, gross) {
    var w = WH[type];
    var incomeAmount = gross - Math.floor(gross * w.exp / 100 + 1e-6);
    var tax = Math.floor(incomeAmount * w.rate / 100 + 1e-6);
    var localTax = Math.floor(tax / 10);
    return { gross: gross, incomeAmount: incomeAmount, tax: tax, localTax: localTax, net: gross - tax - localTax };
  }
  /** @param input type(WH 키), amount(원 — 지급액, grossUp이면 세후 실수령액), grossUp */
  function withholding(input) {
    input = input || {};
    var errors = [], num = reader(errors);
    var r = { version: VERSION, status: null, errors: errors, notes: [], basis: [] };
    var type = WH[input.type] ? input.type : 'business';
    var amount = Math.round(num(input.amount, input.grossUp ? '세후 실수령액' : '지급액(세전)', { positive: true }));
    if (errors.length) { r.status = 'INVALID'; return r; }
    var gross = amount;
    if (input.grossUp) {
      var w = WH[type], eff = (100 - w.exp) / 100 * w.rate / 100 * 1.1;
      // 원 미만 절사 때문에 같은 실수령액이 되는 세전 금액이 여러 개일 수 있음 → 이론값에 가장 가까운 금액을 고른다
      var g0 = Math.round(amount / (1 - eff)), best = null;
      for (var d = 0; d <= 50 && best === null; d++) {
        if (whCalc(type, g0 - d).net === amount) best = g0 - d;
        else if (whCalc(type, g0 + d).net === amount) best = g0 + d;
      }
      if (best === null) { best = Math.ceil(amount / (1 - eff)); while (whCalc(type, best).net < amount) best++; }
      gross = best;
    }
    var c = whCalc(type, gross);
    Object.keys(c).forEach(function (k) { r[k] = c[k]; });
    r.label = WH[type].label;
    r.effectivePct = Math.round((c.tax + c.localTax) / gross * 10000) / 100;
    r.basis.push(WH[type].basis);
    r.basis.push('지방소득세(특별징수) = 원천징수 소득세의 10%');
    r.notes.push('원 미만은 버렸습니다. 기타소득은 건별 기타소득금액이 일정 금액 이하이면 과세하지 않는 과세최저한(「소득세법」 제84조)이 있으며 이 계산에는 반영하지 않았습니다(원문 대조 전).');
    r.notes.push('계속·반복적으로 하는 강의·용역은 기타소득이 아니라 사업소득입니다. 일용근로자 급여는 별도 계산식(근로소득공제·세액공제)을 적용합니다.');
    r.status = 'OK';
    return r;
  }

  var api = { corpTax: corpTax, withholding: withholding, WH: WH, VERSION: VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TaxCalcRules = api;
})(this);
