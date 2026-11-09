/*
 * 감사위원회·상근감사·감사 설치 의무 판정 로직 (순수 함수, 브라우저·Node 공용). 근거: docs/38_감사위원회_로직.md
 * 「상법」 제409조제4항, 제542조의10제1항, 제542조의11제1항, 「상법 시행령」 제36조제1항, 제37조제1항 (2026-11-09 현행, 2027-01-01 시행본 문언 동일 확인)
 */
(function (root) {
  'use strict';
  var VERSION = '2026-11-09';
  var T = { committeeAssets: 20000, fullTimeAssets: 1000, smallCapital: 10 }; // 억원
  function blank(v) { return v === undefined || v === null || v === ''; }

  /**
   * @param input listed(상장), assets(최근 사업연도 말 자산총액, 억원), capital(자본금, 억원 — 비상장),
   *              exemption ''|'reit'|'public'|'rehab'|'newlyListed', voluntaryCommittee(요건 갖춘 감사위원회 자율 설치)
   */
  function evaluate(input) {
    input = input || {};
    var errors = [];
    var r = { version: VERSION, status: null, errors: errors, notes: [], basis: [] };
    var listed = !!input.listed;
    var assets = blank(input.assets) ? null : Number(input.assets);
    var capital = blank(input.capital) ? null : Number(input.capital);
    if (listed && (assets === null || !isFinite(assets) || assets < 0)) errors.push('상장회사는 최근 사업연도 말 자산총액(억원)을 입력해 주세요.');
    if (!listed && (capital === null || !isFinite(capital) || capital < 0)) errors.push('비상장회사는 자본금(억원)을 입력해 주세요.');
    if (errors.length) { r.status = 'INVALID'; return r; }

    r.committeeRequired = false; r.fullTimeAuditorRequired = false; r.auditorOptional = false;
    if (listed) {
      var exempt = ['reit', 'public', 'rehab', 'newlyListed'].indexOf(input.exemption) >= 0;
      r.committeeRequired = assets >= T.committeeAssets && !exempt;
      var hasCommittee = r.committeeRequired || !!input.voluntaryCommittee;
      r.fullTimeAuditorRequired = assets >= T.fullTimeAssets && !hasCommittee;
      r.status = r.committeeRequired ? 'COMMITTEE' : input.voluntaryCommittee ? 'COMMITTEE_VOLUNTARY' : r.fullTimeAuditorRequired ? 'FULLTIME_AUDITOR' : 'AUDITOR';
      r.basis.push('「상법」 제542조의11제1항, 같은 법 시행령 제37조제1항: 최근 사업연도 말 자산총액 2조원 이상인 상장회사는 감사위원회를 설치해야 합니다(부동산투자회사, 공공기관·공기업, 회생절차 개시 회사, 신규상장 후 첫 정기주주총회 전날까지의 회사는 제외).');
      r.basis.push('「상법」 제542조의10제1항, 같은 법 시행령 제36조제1항: 최근 사업연도 말 자산총액 1천억원 이상인 상장회사는 상근감사를 1명 이상 두어야 합니다. 다만 감사위원회를 설치한 경우(설치 의무가 없는 회사가 요건을 갖춰 설치한 경우 포함)는 제외합니다.');
      if (exempt && assets >= T.committeeAssets) r.notes.push(input.exemption === 'newlyListed' ? '신규상장 회사는 상장 후 처음 소집되는 정기주주총회 전날까지만 감사위원회 설치 의무에서 제외됩니다. 그 총회에서 감사위원회를 구성해야 합니다.' : '감사위원회 설치 의무 제외 대상으로 보았습니다. 해당 법률에서 별도의 감사 기구를 정하고 있는지 확인하세요.');
      if (r.committeeRequired) r.notes.push('감사위원회 위원 중 1명 이상은 회계·재무 전문가(예: 공인회계사로 관련 업무 5년 이상)여야 하고, 대표는 독립이사여야 합니다(「상법」 제542조의11제2항, 시행령 제37조제2항).');
      if (r.fullTimeAuditorRequired) r.notes.push('상근감사는 회사의 상무에 종사하는 이사·피용자나 최근 2년 이내 상무 종사자, 주요주주 등은 될 수 없습니다(「상법」 제542조의10제2항, 시행령 제36조제2항).');
    } else {
      r.auditorOptional = capital < T.smallCapital;
      r.status = r.auditorOptional ? 'AUDITOR_OPTIONAL' : 'AUDITOR';
      r.basis.push('「상법」 제409조제1항·제4항: 감사는 주주총회에서 선임하며, 자본금 총액이 10억원 미만인 회사는 감사를 선임하지 않을 수 있습니다.');
      if (r.auditorOptional) r.notes.push('감사를 두지 않으면 이사와 회사 간 소송에서 법원에 대표자 선임을 신청해야 하고, 감사의 일부 권한은 주주총회가 맡습니다(「상법」 제409조제5항·제6항).');
      r.notes.push('비상장회사도 정관으로 감사위원회를 둘 수 있습니다(「상법」 제415조의2 — 이 사이트에서 조문 원문을 대조하지 않음).');
    }
    r.notes.push('외부감사 대상 회사의 감사인 선임 절차(감사인선임위원회 등)는 「주식회사 등의 외부감사에 관한 법률」에서 따로 정합니다.');
    return r;
  }

  var api = { evaluate: evaluate, T: T, VERSION: VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GovernanceRules = api;
})(this);
