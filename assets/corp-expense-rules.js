/*
 * 기업업무추진비(접대비) 한도 + 업무용승용차 관련비용 한도 (순수 함수, 브라우저·Node 공용). 근거: docs/42_법인비용한도_로직.md
 * 「법인세법」 제25조, 제27조의2, 「법인세법 시행령」 제41조, 제50조의2 (2026-11-09 조회). 금액 입력 만원 → 원 정수, 원 미만 버림.
 */
(function (root) {
  'use strict';
  var VERSION = '2026-11-09';
  var MAN = 10000, EOK = 100000000;
  function blank(v) { return v === undefined || v === null || v === ''; }
  function reader(errors) {
    return function (v, label, opt) {
      opt = opt || {};
      if (blank(v)) { if (opt.optional) return 0; errors.push(label + '을(를) 입력해 주세요.'); return 0; }
      var x = Number(v);
      if (!isFinite(x) || x < 0 || (opt.positive && x <= 0)) { errors.push(label + '은(는) ' + (opt.positive ? '0보다 큰' : '0 이상의') + ' 숫자로 입력해 주세요.'); return 0; }
      if (opt.max !== undefined && x > opt.max) { errors.push(label + '은(는) ' + opt.max + ' 이하로 입력해 주세요.'); return 0; }
      return x;
    };
  }
  function f6(x) { return Math.floor(x + 1e-6); }

  // 수입금액 기준 한도 (법 §25④2): 100억 이하 0.3%, 500억 이하 3천만 + 초과분 0.2%, 초과 1억1천만 + 초과분 0.03%
  function revenueAmount(x) {
    if (x <= 100 * EOK) return f6(x * 0.003);
    if (x <= 500 * EOK) return 3000 * MAN + f6((x - 100 * EOK) * 0.002);
    return 11000 * MAN + f6((x - 500 * EOK) * 0.0003);
  }

  /**
   * @param input sme, months(사업연도 월수 1~12), revenue(일반 수입금액, 만원), relatedRevenue(특수관계인 거래 수입금액, 만원),
   *              spent(기업업무추진비 지출액, 만원), noEvidence(1회 3만원(경조금 20만원) 초과인데 적격증빙 없는 금액, 만원), realEstate(§25⑤ 법인)
   */
  function entertainment(input) {
    input = input || {};
    var errors = [], num = reader(errors);
    var r = { version: VERSION, status: null, errors: errors, notes: [], basis: [] };
    var months = num(input.months, '사업연도 월수', { positive: true, max: 12 });
    if (months && months !== Math.floor(months)) errors.push('사업연도 월수는 정수로 입력해 주세요.');
    var gen = Math.round(num(input.revenue, '일반 수입금액', {}) * MAN);
    var rel = Math.round(num(input.relatedRevenue, '특수관계인 거래 수입금액', { optional: true }) * MAN);
    var spent = Math.round(num(input.spent, '기업업무추진비 지출액', {}) * MAN);
    var noEv = Math.round(num(input.noEvidence, '적격증빙 없는 금액', { optional: true }) * MAN);
    if (noEv > spent) errors.push('적격증빙 없는 금액이 지출액보다 클 수 없습니다.');
    if (errors.length) { r.status = 'INVALID'; return r; }
    var base = (input.sme ? 3600 : 1200) * MAN;
    r.baseLimit = f6(base * months / 12);
    var fg = revenueAmount(gen);
    r.revenueLimit = fg + f6((revenueAmount(gen + rel) - fg) * 0.1);
    var limit = r.baseLimit + r.revenueLimit;
    if (input.realEstate) limit = f6(limit * 0.5);
    r.limit = limit;
    r.evidenceDisallowed = noEv;
    r.overLimit = Math.max(0, spent - noEv - limit);
    r.disallowed = noEv + r.overLimit;
    r.deductible = spent - r.disallowed;
    r.basis.push('「법인세법」 제25조제4항제1호 — 기본 한도 ' + (input.sme ? '3,600만원(중소기업)' : '1,200만원') + ' × 사업연도 월수/12');
    r.basis.push('같은 항 제2호 — 수입금액 100억원 이하 0.3%, 100억~500억원 3천만원+0.2%, 500억원 초과 1억1천만원+0.03%. 특수관계인 거래 수입금액은 그 금액의 10%만 반영(일반 수입금액에 먼저 적용)');
    if (input.realEstate) r.basis.push('같은 조 제5항 — 부동산임대업 주업 등 법인은 한도의 50%');
    r.basis.push('같은 조 제2항, 「법인세법 시행령」 제41조제1항 — 1회 3만원(경조금 20만원) 초과 지출은 법인카드·세금계산서 등 적격증빙이 없으면 손금불산입');
    r.notes.push('문화 기업업무추진비·전통시장 사용분 추가 한도(「조세특례제한법」 제136조)는 반영하지 않았습니다(원문 대조 전).');
    r.notes.push('수입금액은 기업회계기준 매출액 기준입니다(같은 조 제4항). 특수관계인 범위는 법인세법 시행령을 따릅니다.');
    r.status = r.disallowed > 0 ? 'OVER' : 'WITHIN';
    return r;
  }

  /**
   * @param input price(취득가액, 만원), months(해당 사업연도 보유 월수), insured(업무전용자동차보험), log(운행기록 작성), businessRatio(%),
   *              otherCost(유류비·보험료·수선비·자동차세 등 감가상각비 외 비용, 만원), realEstateCorp(영 §42② 요건 법인)
   */
  function car(input) {
    input = input || {};
    var errors = [], num = reader(errors);
    var r = { version: VERSION, status: null, errors: errors, notes: [], basis: [] };
    var price = Math.round(num(input.price, '취득가액', { positive: true }) * MAN);
    var months = num(input.months, '보유 월수', { positive: true, max: 12 });
    var ratioIn = input.log ? num(input.businessRatio, '업무사용비율', { max: 100 }) : 100;
    var other = Math.round(num(input.otherCost, '감가상각비 외 차량 관련비용', { optional: true }) * MAN);
    if (errors.length) { r.status = 'INVALID'; return r; }
    var re = !!input.realEstateCorp;
    var depYear = f6(price / 5 * months / 12);
    r.depreciation = depYear;
    var total = depYear + other;
    r.totalCost = total;
    var fixedLimit = f6((re ? 500 : 1500) * MAN * months / 12);
    var ratio;
    if (!input.insured) ratio = 0;
    else if (input.log) ratio = ratioIn / 100;
    else ratio = total <= fixedLimit ? 1 : fixedLimit / total;
    r.ratioPct = Math.round(ratio * 10000) / 100;
    r.businessCost = f6(total * ratio);
    r.nonBusiness = total - r.businessCost;
    var depBusiness = f6(depYear * ratio);
    var depLimit = f6((re ? 400 : 800) * MAN * months / 12);
    r.depLimit = depLimit;
    r.depExcess = Math.max(0, depBusiness - depLimit);
    r.deductible = r.businessCost - r.depExcess;
    r.basis.push('「법인세법」 제27조의2제1항, 「법인세법 시행령」 제50조의2 — 감가상각비는 정액법·내용연수 5년으로 강제 계상 (연 ' + depYear.toLocaleString('ko-KR') + '원)');
    r.basis.push(!input.insured ? '업무전용자동차보험 미가입 → 업무사용비율 0%, 관련비용 전액 손금불산입' : input.log ? '운행기록 작성 → 업무사용비율 = 업무용 사용거리 / 총 주행거리 (' + r.ratioPct + '%)' :
      '운행기록 미작성 → 관련비용 ' + (fixedLimit / MAN).toLocaleString('ko-KR') + '만원 이하면 100%, 초과하면 ' + (fixedLimit / MAN).toLocaleString('ko-KR') + '만원/관련비용 (' + r.ratioPct + '%)');
    r.basis.push('업무사용 감가상각비 중 연 ' + (re ? '400' : '800') + '만원(보유 월수 비례 ' + (depLimit / MAN).toLocaleString('ko-KR') + '만원) 초과분은 손금불산입 후 다음 연도로 이월(같은 조 제3항)');
    if (re) r.basis.push('「법인세법 시행령」 제42조제2항 요건(부동산임대업 주업 등) 법인 → 1,500만원은 500만원, 800만원은 400만원');
    r.notes.push('업무 외 사용금액은 사용자에게 상여 등으로 소득처분됩니다. 리스·렌트 차량은 리스료 중 감가상각비 상당액 계산 방법이 따로 있어 이 계산에 넣지 않았습니다.');
    r.notes.push('처분손실은 연 800만원(요건 법인 400만원)을 넘는 금액을 이월합니다. 경차·9인승 이상 승합·화물차 등은 대상이 아닙니다.');
    r.status = (r.nonBusiness + r.depExcess) > 0 ? 'OVER' : 'WITHIN';
    return r;
  }

  var api = { entertainment: entertainment, car: car, revenueAmount: revenueAmount, VERSION: VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CorpExpenseRules = api;
})(this);
