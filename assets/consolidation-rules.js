/*
 * 연결재무제표 작성 대상 안내 로직 (순수 함수, 브라우저·Node 공용). 근거: docs/29_연결대상_로직.md
 * 외감법 제2조제3호·시행령 제3조제1항: 지배·종속 관계는 회사가 적용하는 회계처리기준(K-IFRS 또는 일반기업회계기준)이 정하는 바에 따른다.
 * 따라서 이 도구는 법령이 정한 "틀"과 회계기준의 일반적 판단 요소만 안내하고, 지배력의 최종 판단은 하지 않는다.
 */
(function (root) {
  'use strict';
  var VERSION = '2026-11-04';

  /**
   * @param input
   *  hasInvestee: boolean           다른 회사(조합 포함)에 출자하고 있는지
   *  votingPct: number 0~100        의결권 지분율 (가장 큰 피투자회사 기준)
   *  boardMajority: boolean         이사 과반 선임·해임 권한
   *  contractControl: boolean       계약·약정으로 재무·영업정책 결정 권한
   *  standard: 'kifrs' | 'kgaap'    적용 회계처리기준
   *  isListed: boolean              주권상장법인
   *  ultimateParentConsolidates: boolean  최상위 지배회사가 이 회사를 포함한 연결재무제표를 공시
   */
  function evaluate(input) {
    input = input || {};
    var errors = [];
    var r = { version: VERSION, status: null, errors: errors, reason: '', basis: [], notes: [], nextSteps: [] };
    if (!input.hasInvestee) {
      r.status = 'NONE';
      r.reason = '다른 회사에 출자하고 있지 않으면 지배·종속 관계가 생기지 않으므로 연결재무제표 작성 대상이 아닙니다.';
      r.basis.push('「주식회사 등의 외부감사에 관한 법률」 제2조제3호: 연결재무제표는 지배·종속 관계가 있을 때 지배회사가 작성합니다.');
      return r;
    }
    var pct = Number(input.votingPct);
    if (input.votingPct === '' || input.votingPct === undefined || input.votingPct === null || !isFinite(pct) || pct < 0 || pct > 100) errors.push('의결권 지분율을 0~100 사이 숫자로 입력해 주세요.');
    if (input.standard !== 'kifrs' && input.standard !== 'kgaap') errors.push('적용 회계처리기준을 선택해 주세요.');
    if (errors.length) { r.status = 'INVALID'; return r; }

    var other = !!input.boardMajority || !!input.contractControl;
    if (pct > 50) {
      r.status = 'CONSOLIDATE';
      r.reason = '의결권 과반(' + pct + '%)을 보유해 일반적으로 지배력이 있는 것으로 보며, 연결재무제표 작성 대상으로 판단됩니다.';
    } else if (other || pct === 50) {
      r.status = 'LIKELY';
      r.reason = pct === 50 && !other ? '의결권이 정확히 50%여서 과반은 아니지만, 약정·이사 선임권 등을 함께 보아 지배력이 있는지 판단해야 합니다.' :
        '의결권은 과반이 아니지만 이사 과반 선임권이나 계약상 정책 결정권이 있어 지배력이 인정될 수 있습니다. 회계기준의 지배력 요건을 따져 판단해야 합니다.';
    } else if (pct >= 20) {
      r.status = 'EQUITY';
      r.reason = '의결권 20% 이상 50% 이하로 일반적으로 유의적 영향력이 있는 관계기업에 해당하며, 연결이 아니라 지분법 적용 대상일 수 있습니다.';
    } else {
      r.status = 'NONE';
      r.reason = '의결권 20% 미만이고 다른 지배 요소가 없으면 일반적으로 지배·종속 관계가 아니어서 연결재무제표 작성 대상이 아닙니다.';
    }

    r.basis.push('「주식회사 등의 외부감사에 관한 법률」 제2조제3호: 회사와 다른 회사(조합 등 법인격 없는 기업 포함)가 대통령령으로 정하는 지배·종속 관계에 있으면 지배회사가 연결재무제표를 작성합니다.');
    r.basis.push('같은 법 시행령 제3조제1항: 지배·종속 관계란 회사가 다른 회사의 재무정책과 영업정책을 결정할 수 있는 능력을 가지는 경우로서, 회사가 적용하는 회계처리기준(법 제5조제1항)에서 정하는 지배회사와 종속회사의 관계입니다.');
    r.basis.push('지분율 50%·20% 기준은 회계기준(K-IFRS 제1110호·제1028호, 일반기업회계기준 제4장·제8장)의 일반적인 판단 요소이며 법령이 정한 숫자가 아닙니다. 잠재적 의결권, 약정, 사실상 지배력 등으로 결론이 달라질 수 있습니다.');

    if (input.standard === 'kifrs') {
      r.notes.push('K-IFRS 적용 회사입니다. 지배력은 K-IFRS 제1110호의 세 요소(피투자자에 대한 힘, 변동이익 노출, 힘을 이용해 이익에 영향을 미치는 능력)로 판단합니다.');
      if (input.ultimateParentConsolidates) r.notes.push('최상위 지배회사가 이 회사를 포함한 연결재무제표를 공시한다면, K-IFRS 제1110호의 중간지배기업 면제 요건(다른 소유주의 반대가 없을 것, 상장·공모 중이 아닐 것 등)을 충족하는지 확인해 보세요. 요건은 기준서 원문으로 확인해야 합니다(이 사이트에서 원문 대조하지 않음).');
    } else {
      r.notes.push('일반기업회계기준 적용 회사입니다. 지배력 판단과 연결 범위는 같은 기준 제4장을 따릅니다. 일반기업회계기준에는 일정 요건의 지배회사에 대한 연결 면제 규정이 있을 수 있으나, 이 사이트에서 기준 원문을 확인하지 못했으므로 "확실하지 않음"으로 표시합니다. 회계기준원 원문으로 확인하세요.');
    }
    if (input.isListed) r.notes.push('주권상장법인은 「자본시장과 금융투자업에 관한 법률」에 따른 사업보고서 등에 연결재무제표를 기재하므로, 연결 대상이 되면 공시 일정도 함께 확인해야 합니다.');

    if (r.status === 'CONSOLIDATE' || r.status === 'LIKELY') {
      r.nextSteps.push('연결재무제표를 작성하면 감사 전 연결재무제표 제출 기한(K-IFRS 적용: 정기총회 4주 전, 미적용: 사업연도 종료 후 90일 이내)이 추가됩니다. 외부감사 일정 계산기에서 "연결재무제표 작성"을 켜고 확인하세요.');
      r.nextSteps.push('종속회사의 결산 일정, 내부거래·미실현손익 자료, 회계정책 통일 여부를 미리 점검하세요.');
      if (input.standard === 'kgaap') r.nextSteps.push('처음 연결재무제표를 작성하는 회사는 취득일의 공정가치 평가(PPA)와 영업권 계산이 필요할 수 있습니다.');
    }
    if (r.status === 'EQUITY') r.nextSteps.push('지분법 적용 여부와 범위는 유의적 영향력 요건으로 다시 확인하세요. 별도재무제표만 작성하는 경우에도 주석 공시가 필요할 수 있습니다.');
    return r;
  }

  var api = { evaluate: evaluate, VERSION: VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ConsolidationRules = api;
})(this);
