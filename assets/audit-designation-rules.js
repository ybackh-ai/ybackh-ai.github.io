/*
 * 감사인 지정 대상 여부 확인 로직 (순수 함수, 브라우저·Node 공용). 근거: docs/33_감사인지정_로직.md
 * 외감법 제11조(2026-11-04 법제처 현행), 시행령 제14조·제15조.
 * 증선위가 "지정할 수 있다"는 재량 조항이므로 결과는 "지정 사유에 해당할 수 있음"까지만 말한다.
 */
(function (root) {
  'use strict';
  var VERSION = '2026-11-04';
  var T = { bigPrivateAssets: 500000, bigPrivateAssetsGroup: 100000, majorHolding: 50 }; // 백만원, %

  function num(v) { if (v === undefined || v === null || v === '') return null; var n = Number(v); return isFinite(n) ? n : NaN; }

  /**
   * @param input
   *  isListed: boolean, market: 'kospi'|'kosdaq'|'konex'|''   주권상장법인 여부·시장
   *  ipoPlanned: boolean            해당 또는 다음 사업연도 중 주권상장법인이 되려는 회사
   *  ipoExcluded: boolean           코넥스 상장 예정, 시장 이전, 기업인수목적회사 등 제외 사유
   *  freeYears: number              연속으로 자유선임(법 §10①)한 사업연도 수
   *  managed: boolean, managedMarketOnly: boolean   관리종목 지정 / 주식분산·거래량·시가총액 사유만으로 지정
   *  loss3, ocf3, icr3: boolean     3개 사업연도 연속 영업손실 / 영업현금흐름 음수 / 이자보상배율 1 미만 (상장사)
   *  ownerChange2, ceoChange3: boolean  3년간 최대주주 변경 2회 이상 / 대표이사 교체 3회 이상 (상장사)
   *  notAppointed: boolean          선임기간 내 감사인 미선임
   *  violation: boolean             재무제표 제출·내부회계 운영·선임 보고 등 위반(영 §14⑥3)
   *  embezzlement: boolean          횡령·배임 고소·공소 제기(상장사, 영 §14⑥5)
   *  totalAssets: 백만원            직전 사업연도 말 자산총액 (비상장)
   *  inGroupOrReport: boolean       공시대상기업집단 소속 또는 사업보고서 제출대상
   *  majorPct: number               대주주와 특수관계인 합산 지분율(%) (의결권 없는 주식 제외)
   *  ownerIsCeo: boolean            대주주 또는 특수관계인이 대표이사
   */
  function evaluate(input) {
    input = input || {};
    var errors = [];
    var r = { version: VERSION, status: null, errors: errors, reasons: [], periodic: null, basis: [], notes: [] };
    var listed = !!input.isListed;
    var freeYears = num(input.freeYears); if (freeYears === null) freeYears = 0;
    if (isNaN(freeYears) || freeYears < 0) errors.push('자유선임 연속 사업연도 수를 0 이상 숫자로 입력해 주세요.');
    var assets = num(input.totalAssets), major = num(input.majorPct);
    if (!listed) {
      if (assets !== null && (isNaN(assets) || assets < 0)) errors.push('자산총액을 0 이상 숫자(백만원)로 입력해 주세요.');
      if (major !== null && (isNaN(major) || major < 0 || major > 100)) errors.push('지분율은 0~100 사이 숫자로 입력해 주세요.');
    }
    if (errors.length) { r.status = 'INVALID'; return r; }

    function add(key, text, basis) { r.reasons.push({ key: key, text: text, basis: basis }); }

    // 1) 직권 지정 사유 (법 §11①)
    if (input.notAppointed) add('notAppointed', '감사인 선임기간 내에 감사인을 선임하지 않았습니다.', '외감법 제11조제1항제2호');
    if (listed && input.loss3) add('loss3', '3개 사업연도 연속 영업이익이 0보다 작습니다.', '외감법 제11조제1항제6호가목');
    if (listed && input.ocf3) add('ocf3', '3개 사업연도 연속 영업현금흐름이 0보다 작습니다.', '외감법 제11조제1항제6호나목');
    if (listed && input.icr3) add('icr3', '3개 사업연도 연속 이자보상배율이 1 미만입니다.', '외감법 제11조제1항제6호다목');
    if (listed && input.managed && !input.managedMarketOnly) add('managed', '관리종목으로 지정되어 있습니다(주식분산·거래량·시가총액 사유 제외). 증선위가 공정한 감사가 필요하다고 인정하면 지정할 수 있습니다.', '외감법 제11조제1항제7호, 시행령 제14조제3항');
    if (listed && (input.ownerChange2 || input.ceoChange3)) add('control', '직전 사업연도를 포함한 과거 3년간 최대주주 변경 2회 이상 또는 대표이사 교체 3회 이상입니다.', '외감법 제11조제1항제11호');
    if (input.ipoPlanned && !input.ipoExcluded) add('ipo', '해당 사업연도 또는 다음 사업연도 중 주권상장법인이 되려는 회사입니다(상장 예정 지정).', '외감법 제11조제1항제12호, 시행령 제14조제6항제1호');
    if (input.violation) add('violation', '재무제표 제출·공시, 내부회계관리제도 운영, 감사인 선임 보고 등 외감법 의무를 위반했습니다(경미한 위반 제외).', '외감법 제11조제1항제12호, 시행령 제14조제6항제3호');
    if (listed && input.embezzlement) add('embezzlement', '금융위원회가 정하는 금액 이상의 횡령·배임으로 임직원을 고소했거나 공소가 제기되었습니다.', '외감법 제11조제1항제12호, 시행령 제14조제6항제5호');

    // 2) 주기적 지정 (법 §11②, 영 §15)
    var periodicEligible = false, periodicWhy = '';
    if (listed) {
      if (input.market === 'konex') { r.notes.push('코넥스시장 상장법인은 주기적 지정 대상에서 제외됩니다(시행령 제15조제5항).'); }
      else { periodicEligible = true; periodicWhy = '주권상장법인(코넥스 제외)'; }
    } else if (assets !== null && major !== null) {
      var threshold = input.inGroupOrReport ? T.bigPrivateAssetsGroup : T.bigPrivateAssets;
      if (assets >= threshold && major >= T.majorHolding && input.ownerIsCeo) {
        periodicEligible = true;
        periodicWhy = '자산총액 ' + (threshold / 100) + '억원 이상, 대주주 등 지분 50% 이상, 대주주 등이 대표이사인 비상장회사(소유·경영 미분리)';
      } else {
        r.notes.push('비상장회사의 주기적 지정 요건(자산총액 ' + (threshold / 100) + '억원 이상 + 대주주 등 지분 50% 이상 + 대주주 등이 대표이사)에 해당하지 않습니다.');
      }
    } else if (!listed) {
      r.notes.push('비상장회사의 주기적 지정 여부는 자산총액과 대주주 지분율을 입력하면 확인합니다.');
    }
    if (periodicEligible) {
      r.periodic = { eligible: true, why: periodicWhy, freeYears: freeYears, due: freeYears >= 6, yearsLeft: Math.max(0, 6 - freeYears) };
      if (freeYears >= 6) add('periodic', periodicWhy + '로서 연속 6개 사업연도 자유선임을 마쳤으므로, 다음 3개 사업연도에 주기적 지정 대상이 될 수 있습니다.', '외감법 제11조제2항, 시행령 제15조제1항');
      else r.notes.push(periodicWhy + '입니다. 연속 자유선임 ' + freeYears + '년째로, 6년을 채우면(' + r.periodic.yearsLeft + '년 뒤) 주기적 지정 대상이 될 수 있습니다.');
    }

    r.status = r.reasons.length ? 'LIKELY' : (r.periodic && r.periodic.eligible ? 'WATCH' : 'NONE');
    r.reason = r.status === 'LIKELY' ? '감사인 지정 사유에 해당할 수 있습니다 (' + r.reasons.length + '건).' :
      r.status === 'WATCH' ? '지금은 지정 사유가 없지만 주기적 지정 요건 회사이므로 자유선임 연수를 관리해야 합니다.' :
        '입력하신 내용으로는 감사인 지정 사유가 확인되지 않습니다.';

    r.basis.push('「주식회사 등의 외부감사에 관한 법률」 제11조제1항: 증권선물위원회는 각 호의 회사에 3개 사업연도의 범위에서 지정하는 회계법인을 감사인으로 선임·변경선임할 것을 요구할 수 있습니다.');
    r.basis.push('같은 법 제11조제2항, 시행령 제15조제1항: 주권상장법인(코넥스 제외)과 소유·경영 미분리 대형비상장회사가 연속 6개 사업연도 자유선임하면 다음 3개 사업연도에 지정감사인 선임을 요구할 수 있습니다(주기적 지정).');
    r.basis.push('시행령 제15조제6항: 대형비상장회사 기준 자산총액은 직전 사업연도 말 5천억원(공시대상기업집단 소속 또는 사업보고서 제출대상이면 1천억원).');
    r.notes.push('지정은 증권선물위원회의 판단으로 이루어지므로, 사유에 해당해도 반드시 지정되는 것은 아니며 반대로 다른 사유(감리 결과 위반, 감사인 선임 절차 위반, 표준 감사시간 미달 등)로 지정될 수도 있습니다.');
    r.notes.push('주기적 지정은 감사위원회 설치 등 요건을 갖춘 회사가 지배구조 평가를 신청해 3개 사업연도 유예받을 수 있고(시행령 제15조제2항~제4항), 과거 6년 이내 감리에서 위반이 없었던 회사 등은 제외될 수 있습니다(법 제11조제3항).');
    r.notes.push('법 제11조제1항제6호라목의 "대통령령으로 정하는 재무기준"은 시행령 제14조제1항·제2항이 삭제(2020.10.13)된 상태로 확인되어 별도 기준을 적용하지 않았습니다(확실하지 않음).');
    return r;
  }

  var api = { evaluate: evaluate, T: T, VERSION: VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AuditDesignationRules = api;
})(this);
