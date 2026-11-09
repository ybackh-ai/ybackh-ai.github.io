/*
 * 퇴직급여충당부채(퇴직금 추계액) 간이 계산 로직 (순수 함수, 브라우저·Node 공용). 근거: docs/37_퇴직급여_로직.md
 * 「근로자퇴직급여 보장법」 제4조제1항(1년 미만 제외), 제8조제1항(1년에 30일분 이상 평균임금),
 * 「법인세법」 제33조, 같은 법 시행령 제60조(퇴직급여충당금 손금 한도 — 2016년 이후 개시 사업연도 0%). 2026-11-09 확인.
 */
(function (root) {
  'use strict';
  var VERSION = '2026-11-09';
  function blank(v) { return v === undefined || v === null || v === ''; }

  /**
   * @param input employees [{monthlyWage(월평균임금), years(계속근로기간, 년), dc(DC형 가입)}],
   *              planAssets(DB형 사외적립자산), openingProvision(기초 충당부채)
   */
  function calculate(input) {
    input = input || {};
    var errors = [];
    var r = { version: VERSION, status: null, errors: errors, notes: [], basis: [], rows: [] };
    var list = Array.isArray(input.employees) ? input.employees.filter(function (e) { return e && !(blank(e.monthlyWage) && blank(e.years)); }) : [];
    if (!list.length) errors.push('직원 정보를 한 명 이상 입력해 주세요.');
    var est = 0, counted = 0, short = 0, dc = 0;
    list.forEach(function (e, i) {
      var w = Number(e.monthlyWage), y = Number(e.years);
      if (!isFinite(w) || w < 0) { errors.push((i + 1) + '번째: 월평균임금은 0 이상 숫자로 입력해 주세요.'); return; }
      if (!isFinite(y) || y < 0 || y > 60) { errors.push((i + 1) + '번째: 근속연수는 0~60 사이로 입력해 주세요.'); return; }
      var amt = 0, why = '';
      if (e.dc) { dc++; why = 'DC형(회사 부채 아님)'; }
      else if (y < 1) { short++; why = '1년 미만(지급 대상 아님)'; }
      else { amt = Math.floor(w * y + 1e-6); est += amt; counted++; }
      r.rows.push({ no: i + 1, monthlyWage: w, years: y, amount: amt, excluded: why });
    });
    function opt(k, label) { if (blank(input[k])) return null; var n = Number(input[k]); if (!isFinite(n) || n < 0) { errors.push(label + '은(는) 0 이상 숫자로 입력해 주세요.'); return null; } return n; }
    var assets = opt('planAssets', '사외적립자산');
    var opening = opt('openingProvision', '기초 충당부채');
    if (errors.length) { r.status = 'INVALID'; return r; }

    r.estimate = est;
    r.counted = counted;
    r.excludedShort = short;
    r.excludedDc = dc;
    r.netLiability = est - (assets || 0);
    if (opening !== null) { r.currentCharge = est - opening; r.taxDisallowed = Math.max(0, r.currentCharge); }
    r.status = 'OK';

    r.basis.push('퇴직금은 계속근로기간 1년에 대해 30일분 이상의 평균임금입니다(「근로자퇴직급여 보장법」 제8조제1항). 이 계산기는 30일분 평균임금을 월평균임금으로 근사해 "월평균임금 × 근속연수"로 계산합니다.');
    r.basis.push('계속근로기간 1년 미만 또는 4주 평균 주 15시간 미만 근로자는 퇴직급여 지급 대상이 아닙니다(같은 법 제4조제1항 단서).');
    r.basis.push('회계: 일반기업회계기준은 보고기간 말 전 임직원이 퇴직할 경우 지급할 금액(퇴직금 추계액)을 부채로 인식합니다. K-IFRS 적용 회사의 확정급여형은 보험수리적 평가(예측단위적립방식)가 필요해 이 계산과 다릅니다(기준서 원문 미대조).');
    r.basis.push('세법: 퇴직급여충당금 누적액 손금 한도가 2016년 1월 1일 이후 개시 사업연도부터 추계액의 0%이므로, 장부에 설정한 퇴직급여충당금은 손금으로 인정되지 않고 실제 퇴직금 지급 때 손금이 됩니다(「법인세법 시행령」 제60조제2항제7호). 퇴직연금 부담금은 별도 규정(같은 영 제44조의2)에 따릅니다.');
    if (short) r.notes.push('1년 미만 근속자 ' + short + '명은 제외했습니다. 결산일 이후 1년을 채울 예정이라도 결산일 현재 기준으로 계산합니다.');
    if (dc) r.notes.push('확정기여형(DC) 가입자 ' + dc + '명은 회사가 부담금을 납입하면 의무가 끝나므로 부채에서 제외했습니다(부담금 미납액이 있으면 부채로 인식).');
    if (assets) r.notes.push('확정급여형(DB) 사외적립자산 ' + assets.toLocaleString('ko-KR') + '원을 차감해 순부채를 표시했습니다. 재무상태표에는 표시 방법이 기준마다 다를 수 있습니다.');
    r.notes.push('평균임금은 퇴직 전 3개월 임금 총액 ÷ 그 기간 총일수이며 상여·연차수당 일부가 포함됩니다. 정확한 금액은 급여대장으로 계산해야 하고, 근속연수는 일 단위로 계산하는 것이 원칙입니다.');
    return r;
  }

  var api = { calculate: calculate, VERSION: VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RetirementRules = api;
})(this);
