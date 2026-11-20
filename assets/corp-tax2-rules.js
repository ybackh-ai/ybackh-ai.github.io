/*
 * 법인 세무 추가 3종 (순수 함수, 브라우저·Node 공용). 근거: docs/62 (법령 원문 2026-11-20 확인)
 *  registrationTax 법인 설립·증자 등록면허세 / interimTax 법인세 중간예납 / semiannualWithholding 원천세 반기납부 대상
 * 법인세율은 tax-tools-rules.js(window.TaxTools). 금액 입력 만원, 결과 원.
 */
(function (root) {
  'use strict';
  var TT = (typeof module !== 'undefined' && module.exports) ? require('./tax-tools-rules.js') : root.TaxTools;
  var VERSION = '2026-11-20';
  var MAN = 10000;
  function blank(v) { return v === undefined || v === null || v === ''; }
  function fl(x) { return Math.floor(x + 1e-6); }
  function reader(errors) {
    return function (v, label, opt) {
      opt = opt || {};
      if (blank(v)) { if (opt.optional) return opt.def !== undefined ? opt.def : 0; errors.push(label + '을(를) 입력해 주세요.'); return 0; }
      var x = Number(String(v).replace(/,/g, ''));
      if (!isFinite(x) || x < 0 || (opt.positive && x <= 0)) { errors.push(label + '은(는) ' + (opt.positive ? '0보다 큰' : '0 이상의') + ' 숫자로 입력해 주세요.'); return 0; }
      return x;
    };
  }
  function base() { return { version: VERSION, status: null, errors: [], notes: [], basis: [] }; }

  // 1. 등록면허세 (지방세법 제28조제1항제6호가목·제2항, 제151조제1항제2호)
  function registrationTax(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var amt = num(input.amount, input.kind === 'increase' ? '증자 납입액' : '설립 자본금(납입액)', { positive: true });
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    var inc = input.kind === 'increase';
    var A = Math.round(amt * MAN);
    r.normalTax = Math.max(112500, fl(A * 0.004));
    r.heavy = !!input.metro && (!inc || !!input.withinFive);
    r.tax = r.heavy ? r.normalTax * 3 : r.normalTax;
    r.minApplied = fl(A * 0.004) < 112500;
    r.eduTax = fl(r.tax * 0.2);
    r.total = r.tax + r.eduTax;
    r.status = r.heavy ? 'HEAVY' : 'OK';
    r.basis.push('「지방세법」 제28조제1항제6호가목: 영리법인 설립·증자 납입액의 1천분의 4, 최저 112,500원');
    r.basis.push('「지방세법」 제28조제2항제1호: 대도시(과밀억제권역, 산업단지 제외)에서 법인 설립 또는 설립 후 5년 이내 증자 시 3배(대도시 중과 제외 업종은 예외)');
    r.basis.push('「지방세법」 제151조제1항제2호: 지방교육세는 등록면허세의 20%');
    r.notes.push('법무사 수수료, 등기 신청 수수료(대법원), 국민주택채권 등은 포함하지 않았습니다. 지방자치단체 조례로 세율이 조정된 경우 금액이 다를 수 있습니다.');
    return r;
  }

  // 2. 법인세 중간예납 (법인세법 제63조·제63조의2·제55조제2항·제64조제2항, 시행령 제101조제2항)
  function interimTax(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var a = num(input.prevTax, '직전 사업연도 산출세액', { optional: true });
    var b = num(input.prevReduction, '직전 감면세액', { optional: true });
    var c = num(input.prevWithheld, '직전 원천징수·수시부과세액', { optional: true });
    var months = num(input.prevMonths, '직전 사업연도 개월 수', { optional: true, def: 12 }) || 12;
    var hb = num(input.halfBase, '상반기 과세표준', { optional: true, def: -1 });
    var hr = num(input.halfReduction, '상반기 감면·원천징수세액', { optional: true });
    if (!r.errors.length && blank(input.prevTax) && hb < 0) r.errors.push('직전 사업연도 산출세액 또는 상반기 과세표준을 입력해 주세요.');
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    if (!blank(input.prevTax)) {
      r.method1 = Math.max(0, fl((a - b - c) * MAN * 6 / months));
    }
    if (hb >= 0) {
      var annual = Math.round(hb * MAN) * 12 / 6;
      r.halfCalcTax = fl(TT.corpTax(annual) * 6 / 12);
      r.method2 = Math.max(0, r.halfCalcTax - Math.round(hr * MAN));
    }
    r.exempt = !!input.isSme && r.method1 !== undefined && r.method1 < 500000;
    var cands = [];
    if (r.method1 !== undefined) cands.push(r.method1);
    if (r.method2 !== undefined) cands.push(r.method2);
    r.payable = r.exempt ? 0 : Math.min.apply(null, cands);
    r.chosen = r.exempt ? 'exempt' : (r.method2 !== undefined && r.payable === r.method2 && (r.method1 === undefined || r.method2 < r.method1)) ? 'half' : 'prev';
    r.installment = r.payable > 2e7 ? fl(r.payable / 2) : r.payable > 1e7 ? r.payable - 1e7 : 0;
    r.payNow = r.payable - r.installment;
    r.status = r.exempt ? 'EXEMPT' : 'OK';
    r.basis.push('「법인세법」 제63조(중간예납기간 = 사업연도 개시일부터 6개월, 2개월 이내 납부, 직전 기준 50만원 미만 중소기업은 납부 의무 없음, 1천만원 초과 분납)');
    r.basis.push('「법인세법」 제63조의2제1항: 직전 사업연도 기준 (산출세액 − 감면 − 원천징수 − 수시부과) × 6 ÷ 직전 개월 수, 또는 상반기 가결산 기준(제55조제2항에 따라 연 환산 후 6/12)');
    r.basis.push('「법인세법」 제64조제2항, 시행령 제101조제2항: 2천만원 이하 1천만원 초과분, 2천만원 초과 50% 이하 분납(1개월, 중소기업 2개월 이내)');
    r.notes.push('두 방법 중 적은 쪽을 고를 수 있다고 보고 비교했습니다. 공시대상기업집단 소속 법인은 상반기 가결산 방법만 쓸 수 있고, 직전 산출세액이 없으면 가결산 방법으로 계산합니다(제63조의2).');
    r.notes.push('합병·분할하지 않고 새로 설립한 법인의 최초 사업연도는 중간예납 대상이 아닙니다. 12월 결산법인은 8월 31일까지 냅니다.');
    return r;
  }

  // 3. 원천세 반기납부 대상 (소득세법 제128조제2항, 시행령 제186조)
  function semiannualWithholding(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var religious = !!input.religious;
    var avg = num(input.avgEmployees, '직전 연도 상시고용인원(월말 평균)', { optional: religious });
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    r.avgEmployees = avg;
    r.eligible = religious || (avg <= 20 && !input.finance);
    r.reason = religious ? '종교단체' : input.finance ? '금융·보험업은 상시고용인원과 관계없이 제외' : avg <= 20 ? '직전 연도 상시고용인원 20명 이하' : '직전 연도 상시고용인원 20명 초과';
    r.status = r.eligible ? 'ELIGIBLE' : 'NOT';
    r.basis.push('「소득세법」 제128조제2항: 반기 마지막 달의 다음 달 10일까지 납부 가능(법인세법 제67조 소득처분 상여·배당 등은 제외)');
    r.basis.push('「소득세법 시행령」 제186조: 직전 연도 상시고용인원(1~12월 매월 말일 평균) 20명 이하, 금융·보험업 제외, 종교단체. 반기 직전 달(6월·12월)에 신청해 승인 또는 지정');
    r.notes.push('반기납부를 해도 원천징수는 매달 하고, 지급명세서·간이지급명세서 제출 기한은 그대로입니다. 상반기(1~6월)분은 7월 10일, 하반기(7~12월)분은 다음 해 1월 10일까지 냅니다.');
    return r;
  }

  var api = { registrationTax: registrationTax, interimTax: interimTax, semiannualWithholding: semiannualWithholding, VERSION: VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CorpTax2Rules = api;
})(this);
