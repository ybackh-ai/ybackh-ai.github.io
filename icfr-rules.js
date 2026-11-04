/*
 * 내부회계관리제도 적용 대상 판정 로직 (순수 함수, 브라우저·Node 공용)
 * 근거: docs/15_내부회계대상_로직.md (2026-11-04 법제처 현행 조회)
 *  - 외감법 제2조제1호, 제8조제1항·제6항, 시행령 제9조제1항
 * 금액 입력: 억원 → 내부 백만원 정수. "미만"은 <.
 */
(function (root) {
  'use strict';

  var VERSION = '2026-11-04';
  var T = { SMALL: 100000, LARGE: 500000 }; // 1천억원, 5천억원 (백만원)

  function blank(v) { return v === undefined || v === null || v === ''; }

  /**
   * @param {object} input
   *  audited: boolean          외부감사 대상 회사
   *  companyType: 'stock'|'llc'
   *  listed: boolean           주권상장법인
   *  assets: 억원              직전 사업연도 말 자산총액
   *  groupAffiliate: boolean   공시대상기업집단 소속 국내 회사
   *  reportingEntity: boolean  사업보고서 제출대상법인
   *  financial: boolean        금융회사
   *  specialVehicle: boolean   법인세법 §51조의2① 각 호 / 조특법 §104조의31① 해당(유동화전문회사 등)
   */
  function evaluate(input) {
    input = input || {};
    var errors = [];
    var r = { version: VERSION, status: null, reason: '', basis: [], auditorRole: null, duties: [], notes: [], errors: errors };

    if (input.companyType !== 'stock' && input.companyType !== 'llc') errors.push('회사 형태를 선택해 주세요.');
    if (input.companyType === 'llc' && input.listed) errors.push('유한회사는 주권상장법인이 될 수 없습니다. 회사 형태나 상장 여부를 확인해 주세요.');
    var assets = null;
    if (blank(input.assets)) errors.push('직전 사업연도 말 자산총액을 입력해 주세요.');
    else {
      var a = Number(input.assets);
      if (!isFinite(a) || a < 0) errors.push('자산총액은 0 이상의 숫자로 입력해 주세요.');
      else assets = Math.round(a * 100);
    }
    if (errors.length) { r.status = 'INVALID'; return r; }

    if (!input.audited) {
      r.status = 'NOT_COMPANY';
      r.reason = '외부감사 대상이 아닌 회사는 외감법상 내부회계관리제도 의무가 없습니다.';
      r.basis.push('외감법 제2조제1호("회사"는 외부감사 대상 주식회사·유한회사)');
      r.notes.push('외부감사 대상 여부는 외부감사 대상 판정기로 먼저 확인하실 수 있습니다.');
      return r;
    }
    if (input.companyType === 'llc') {
      r.status = 'EXEMPT';
      r.reason = '유한회사는 내부회계관리제도 적용 대상에서 제외됩니다.';
      r.basis.push('외감법 제8조제1항 단서, 시행령 제9조제1항제1호');
      return r;
    }
    if (input.specialVehicle) {
      r.status = 'EXEMPT';
      r.reason = '유동화전문회사 등 시행령에서 정한 회사는 적용 대상에서 제외됩니다.';
      r.basis.push('외감법 제8조제1항 단서, 시행령 제9조제1항제2호');
      return r;
    }

    var apply = false;
    if (input.listed) {
      apply = true;
      r.reason = '주권상장법인은 규모와 관계없이 내부회계관리제도를 갖추어야 합니다.';
      r.basis.push('외감법 제8조제1항(단서는 주권상장법인이 아닌 회사에만 적용)');
    } else if (assets < T.SMALL) {
      r.status = 'EXEMPT';
      r.reason = '주권상장법인이 아니고 직전 사업연도 말 자산총액이 1천억원 미만입니다.';
      r.basis.push('외감법 제8조제1항 단서');
      return r;
    } else if (assets < T.LARGE && !input.groupAffiliate && !input.reportingEntity && !input.financial) {
      r.status = 'EXEMPT';
      r.reason = '직전 사업연도 말 자산총액이 5천억원 미만이고 공시대상기업집단 소속·사업보고서 제출대상법인·금융회사에 해당하지 않습니다.';
      r.basis.push('외감법 제8조제1항 단서, 시행령 제9조제1항제3호');
      return r;
    } else {
      apply = true;
      if (assets >= T.LARGE) r.reason = '직전 사업연도 말 자산총액이 5천억원 이상입니다.';
      else {
        var why = [];
        if (input.groupAffiliate) why.push('공시대상기업집단 소속');
        if (input.reportingEntity) why.push('사업보고서 제출대상법인');
        if (input.financial) why.push('금융회사');
        r.reason = '자산총액이 1천억원 이상이고 ' + why.join('·') + '에 해당합니다.';
      }
      r.basis.push('외감법 제8조제1항, 시행령 제9조제1항제3호 단서');
    }

    if (apply) {
      r.status = 'APPLY';
      r.auditorRole = (input.listed && assets >= T.SMALL) ? 'audit' : 'review';
      r.basis.push(r.auditorRole === 'audit'
        ? '외감법 제8조제6항 단서 — 주권상장법인(자산 1천억원 미만 제외)의 감사인은 운영실태를 감사'
        : '외감법 제8조제6항 본문 — 감사인은 운영실태 보고 내용을 검토');
      r.duties = [
        '내부회계관리규정과 이를 관리·운영하는 조직을 갖춥니다. 규정을 만들거나 고칠 때는 감사의 승인과 이사회 결의를 거칩니다(외감법 제8조제1항, 시행령 제9조제3항).',
        '대표자는 상근이사 1명을 내부회계관리자로 지정합니다(외감법 제8조제3항).',
        '대표자는 사업연도마다 주주총회·이사회·감사에 운영실태를 보고합니다. 이사회와 감사에는 대면 보고합니다(외감법 제8조제4항, 시행령 제9조제4항).',
        '감사는 운영실태를 평가해 정기총회 1주 전까지 이사회에 대면 보고하고, 평가보고서를 본점에 5년간 비치합니다(외감법 제8조제5항, 시행령 제9조제7항).',
        '감사인은 검토 또는 감사 결과에 대한 종합의견을 감사보고서에 표명합니다(외감법 제8조제7항).',
      ];
      if (input.reportingEntity || input.listed) r.duties.push('사업보고서 제출대상법인은 운영실태보고서와 평가보고서를 공시합니다(시행령 제9조제9항).');
    }
    r.notes.push('금융위원회가 고시하는 기준에 맞는 회사는 적용이 제외될 수 있습니다(시행령 제9조제1항제4호). 고시 내용은 이 계산기에 반영하지 않았습니다.');
    if (input.listed) r.notes.push('주권상장법인의 연결 내부회계관리제도 적용 시기는 자산 규모별 부칙 일정에 따르며, 이 계산기는 반영하지 않았습니다.');
    return r;
  }

  var api = { evaluate: evaluate, THRESHOLDS: T, VERSION: VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.IcfrRules = api;
})(this);
