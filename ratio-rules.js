/*
 * 재무비율 간이 진단 로직 (순수 함수, 브라우저·Node 공용). 산식: docs/26_재무비율_로직.md
 */
(function (root) {
  'use strict';
  var VERSION = '2026-11-04';
  var FIELDS = ['currentAssets', 'currentLiabilities', 'totalLiabilities', 'equity', 'totalAssets', 'revenue', 'operatingIncome', 'interestExpense', 'netIncome'];
  function r2(n) { return Math.round(n * 100) / 100; }
  function blank(v) { return v === undefined || v === null || v === ''; }

  function analyze(input) {
    input = input || {};
    var errors = [], v = {}, any = false;
    var r = { version: VERSION, status: null, errors: errors, notes: [] };
    FIELDS.forEach(function (k) {
      if (blank(input[k])) { v[k] = null; return; }
      var n = Number(input[k]);
      if (!isFinite(n)) { errors.push('숫자로 입력해 주세요: ' + k); v[k] = null; return; }
      v[k] = n; any = true;
    });
    if (!any && !errors.length) errors.push('재무제표 금액을 하나 이상 입력해 주세요.');
    if (errors.length) { r.status = 'INVALID'; return r; }
    function ratio(a, b, pct) { return v[a] !== null && v[b] !== null && v[b] > 0 ? r2(v[a] / v[b] * (pct ? 100 : 1)) : null; }

    r.currentRatio = ratio('currentAssets', 'currentLiabilities', true);
    r.capitalImpaired = v.equity !== null && v.equity <= 0;
    r.debtRatio = r.capitalImpaired ? null : ratio('totalLiabilities', 'equity', true);
    r.equityRatio = ratio('equity', 'totalAssets', true);
    r.interestCoverage = ratio('operatingIncome', 'interestExpense', false);
    r.operatingMargin = ratio('operatingIncome', 'revenue', true);
    r.netMargin = ratio('netIncome', 'revenue', true);
    r.roe = r.capitalImpaired ? null : ratio('netIncome', 'equity', true);
    r.roa = ratio('netIncome', 'totalAssets', true);
    r.coverageBelowOne = r.interestCoverage !== null && r.interestCoverage < 1;

    if (r.capitalImpaired) r.notes.push('자본총계가 0 이하인 자본잠식 상태입니다. 부채비율과 ROE는 의미가 없어 계산하지 않았습니다.');
    if (r.coverageBelowOne) r.notes.push('이자보상배율이 1 미만입니다. 영업이익으로 이자비용을 감당하지 못하는 수준입니다.');
    r.notes.push('적정 수준은 업종과 사업 단계에 따라 크게 다릅니다. 이 진단은 업종 평균과 비교하지 않으며, 기초·기말 평균이 아닌 입력한 기말 금액 기준입니다.');
    r.status = 'OK';
    return r;
  }

  /**
   * 자본잠식·채무초과 진단 (docs/26 2절)
   *  capital: 자본금(납입자본금), equity: 자본총계(선택), totalAssets·totalLiabilities: 자본총계 대신 입력 가능
   *  잠식액 = 자본금 − 자본총계, 잠식률 = 잠식액 ÷ 자본금 × 100. 자본총계 ≤ 0 이면 전액잠식, < 0 이면 채무초과(부채 > 자산)
   */
  function capitalImpairment(input) {
    input = input || {};
    var errors = [];
    var r = { version: VERSION, status: null, errors: errors, notes: [], basis: [] };
    function num(k) { if (blank(input[k])) return null; var n = Number(input[k]); if (!isFinite(n)) { errors.push('숫자로 입력해 주세요: ' + k); return null; } return n; }
    var capital = num('capital'), equity = num('equity'), ta = num('totalAssets'), tl = num('totalLiabilities');
    if (capital === null || capital <= 0) errors.push('자본금을 0보다 큰 숫자로 입력해 주세요.');
    var derived = (ta !== null && tl !== null) ? ta - tl : null;
    if (equity === null && derived === null) errors.push('자본총계를 입력하거나, 자산총계와 부채총계를 함께 입력해 주세요.');
    if (errors.length) { r.status = 'INVALID'; return r; }
    r.mismatch = equity !== null && derived !== null && Math.abs(equity - derived) > 0.5;
    if (equity === null) equity = derived;
    r.equity = equity;
    r.capital = capital;
    r.impairment = equity >= capital ? 0 : r2(capital - equity);
    r.impairmentRate = equity >= capital ? 0 : r2((capital - equity) / capital * 100);
    r.status = equity <= 0 ? 'FULL' : equity < capital ? 'PARTIAL' : 'NONE';
    r.over50 = r.impairmentRate >= 50;
    r.insolvent = equity < 0;
    r.insolvencyAmount = equity < 0 ? r2(-equity) : 0;
    if (r.mismatch) r.notes.push('입력한 자본총계와 자산−부채가 다릅니다. 자본총계 입력값으로 계산했습니다.');
    if (r.status === 'FULL') r.notes.push('자본총계가 0 이하로 자본금이 전액 잠식된 상태입니다.');
    if (r.insolvent) r.notes.push('부채총계가 자산총계보다 큰 채무초과 상태입니다.');
    if (r.over50 && r.status === 'PARTIAL') r.notes.push('잠식률이 50% 이상입니다. 상장회사라면 거래소 상장규정의 관리종목 지정 사유에 해당할 수 있습니다(규정 원문은 이 사이트에서 확인하지 못했으므로 거래소 규정을 직접 확인하세요).');
    r.basis.push('자본잠식률 = (자본금 − 자본총계) ÷ 자본금 × 100. 자본총계가 자본금보다 작으면 부분잠식, 0 이하이면 전액잠식입니다.');
    r.basis.push('채무초과 = 부채총계 > 자산총계(자본총계가 음수)입니다.');
    return r;
  }

  var api = { analyze: analyze, capitalImpairment: capitalImpairment, FIELDS: FIELDS, VERSION: VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RatioRules = api;
})(this);
