/*
 * 외부감사 대상 판정 로직 (순수 함수, 브라우저·Node 공용)
 *
 * 근거 법령 (2026-11-04 법제처 현행 조회 기준)
 *  - 주식회사 등의 외부감사에 관한 법률(외감법) 제4조  [법률, 시행 2025-04-01]
 *  - 같은 법 시행령 제5조                             [대통령령, 시행 2026-05-26, 제5조는 2020-10-13 개정 이후 변경 없음]
 *
 * 금액 입력 단위: 억원(소수 둘째 자리까지 = 백만원 단위). 내부 비교는 백만원 정수로 하여 부동소수 오차를 피한다.
 * "이상"은 기준값을 포함한다(>=).
 */
(function (root) {
  'use strict';

  var RULES_VERSION = '2026-11-04';

  // 기준값 (백만원)
  var T = {
    LARGE_ASSETS: 50000, // 500억 (영 §5①1)
    LARGE_SALES: 50000, // 500억 (영 §5①2)
    ASSETS: 12000, // 120억 (영 §5①3가, ②2가)
    LIABILITIES: 7000, // 70억  (영 §5①3나, ②2나)
    SALES: 10000, // 100억 (영 §5①3다, ②2다)
    EMPLOYEES: 100, // 100명 (영 §5①3라, ②2라)
    MEMBERS: 50, // 50명  (영 §5②2마, 유한회사 사원)
  };

  var NEAR_RATIO = 0.9; // 기준의 90% 이상~100% 미만이면 '근접' 표시

  // 면제 사유 (외감법 §4②, 영 §5③)
  var EXEMPTIONS = {
    public_enterprise: { label: '「공공기관의 운영에 관한 법률」상 공기업·준정부기관(비상장)', basis: '외감법 제4조제2항제1호', nonListedOnly: true },
    new_company: { label: '해당 사업연도에 최초로 설립등기를 한 회사', basis: '시행령 제5조제3항제1호' },
    local_public: { label: '「지방공기업법」에 따른 지방공기업(비상장)', basis: '시행령 제5조제3항제2호가목', nonListedOnly: true },
    investment_vehicle: { label: '자본시장법상 투자회사·투자유한회사·투자목적회사', basis: '시행령 제5조제3항제2호나목' },
    cr_company: { label: '기업구조조정투자회사', basis: '시행령 제5조제3항제2호다목' },
    abs_spc: { label: '「자산유동화에 관한 법률」상 유동화전문회사', basis: '시행령 제5조제3항제2호라목' },
    trade_suspended: { label: '금융결제원 거래정지처분 효력 지속 중(회생절차 개시 결정 회사 제외)', basis: '시행령 제5조제3항제2호마목' },
    dissolved: { label: '해산·청산·파산 사실이 등기되었거나 1년 이상 휴업 중', basis: '시행령 제5조제3항제2호바목' },
    merger_extinct: { label: '합병절차 진행 중으로 해당 사업연도 내 소멸 예정', basis: '시행령 제5조제3항제2호사목' },
    fsc_notice: { label: '그 밖에 금융위원회 고시 기준에 해당', basis: '시행령 제5조제3항제2호아목' },
  };

  function toMillion(eok) {
    // 억원 -> 백만원 정수
    return Math.round(Number(eok) * 100);
  }

  function isBlank(v) {
    return v === undefined || v === null || v === '';
  }

  function readAmount(v, name, errors) {
    if (isBlank(v)) { errors.push(name + ': 값을 입력해 주세요.'); return null; }
    var n = Number(v);
    if (!isFinite(n) || n < 0) { errors.push(name + ': 0 이상의 숫자를 입력해 주세요.'); return null; }
    return toMillion(n);
  }

  function readCount(v, name, errors) {
    if (isBlank(v)) { errors.push(name + ': 값을 입력해 주세요.'); return null; }
    var n = Number(v);
    if (!isFinite(n) || n < 0 || Math.floor(n) !== n) { errors.push(name + ': 0 이상의 정수를 입력해 주세요.'); return null; }
    return n;
  }

  function near(value, threshold) {
    return value < threshold && value >= threshold * NEAR_RATIO;
  }

  /**
   * @param {object} input
   *  companyType: 'stock' | 'llc'
   *  listed: boolean              주권상장법인
   *  planningListing: boolean     해당 또는 다음 사업연도 중 상장 예정
   *  exemptions: string[]         EXEMPTIONS 키
   *  assets, liabilities, sales   억원 (직전 사업연도 말 / 직전 사업연도)
   *  fiscalMonths: 1~12           직전 사업연도 개월 수 (1개월 미만은 1개월로 올려 입력)
   *  employees: 정수              직전 사업연도 말 종업원 수(일용·파견 제외)
   *  members: 정수                (유한회사) 직전 사업연도 말 사원 수
   *  llcRecentlyConverted: boolean (유한회사) 2019-11-01 이후 주식회사에서 조직변경, 변경 등기일부터 5년 이내
   */
  function evaluate(input) {
    input = input || {};
    var errors = [];
    var result = {
      version: RULES_VERSION,
      status: null, // 'TARGET' | 'NOT_TARGET' | 'EXEMPT' | 'INVALID'
      reason: '',
      basis: [],
      criteria: [],
      appliedRule: null, // 'stock' | 'llc'
      annualizedSales: null, // 억원
      notes: [],
      errors: errors,
    };

    var type = input.companyType;
    if (type !== 'stock' && type !== 'llc') {
      errors.push('회사 형태(주식회사/유한회사)를 선택해 주세요.');
      result.status = 'INVALID';
      return result;
    }

    var listed = !!input.listed;

    // 1) 면제 사유
    var ex = (input.exemptions || []).filter(function (k) { return EXEMPTIONS[k]; });
    var applicableEx = ex.filter(function (k) { return !(listed && EXEMPTIONS[k].nonListedOnly); });
    if (ex.length !== applicableEx.length) {
      result.notes.push('공기업·준정부기관·지방공기업 면제는 주권상장법인에는 적용되지 않아 제외했습니다.');
    }
    if (applicableEx.length > 0) {
      result.status = 'EXEMPT';
      result.reason = '외부감사를 받지 아니할 수 있는 회사에 해당합니다.';
      applicableEx.forEach(function (k) { result.basis.push(EXEMPTIONS[k].basis + ' — ' + EXEMPTIONS[k].label); });
      result.notes.push('면제는 "받지 아니할 수 있다"는 선택 규정입니다. 자발적으로 감사를 받는 것은 가능합니다.');
      if (applicableEx.some(function (k) { return k !== 'new_company' && k !== 'public_enterprise'; })) {
        result.notes.push('시행령 제5조제3항제2호의 사유는 감사인 선임기간 종료일 기준으로 판단합니다.');
      }
      return result;
    }

    // 2) 상장법인 / 상장 예정
    if (listed) {
      result.status = 'TARGET';
      result.reason = '주권상장법인은 규모와 관계없이 외부감사 대상입니다.';
      result.basis.push('외감법 제4조제1항제1호');
      return result;
    }
    if (input.planningListing) {
      result.status = 'TARGET';
      result.reason = '해당 사업연도 또는 다음 사업연도 중 주권상장법인이 되려는 회사는 외부감사 대상입니다.';
      result.basis.push('외감법 제4조제1항제2호');
      return result;
    }

    // 3) 규모 기준
    var assets = readAmount(input.assets, '자산총액', errors);
    var liabilities = readAmount(input.liabilities, '부채총액', errors);
    var sales = readAmount(input.sales, '매출액', errors);
    var employees = readCount(input.employees, '종업원 수', errors);
    var months = isBlank(input.fiscalMonths) ? 12 : Number(input.fiscalMonths);
    if (!isFinite(months) || months < 1 || months > 12 || Math.floor(months) !== months) {
      errors.push('직전 사업연도 개월 수는 1~12 사이의 정수여야 합니다.');
    }

    var useLlcRule = type === 'llc' && !input.llcRecentlyConverted;
    var members = null;
    if (useLlcRule) members = readCount(input.members, '사원 수', errors);

    if (errors.length) { result.status = 'INVALID'; return result; }

    // 매출액 연환산: 비교는 sales*12 >= threshold*months (정수 연산)
    var salesMeets = function (threshold) { return sales * 12 >= threshold * months; };
    var annualized = (sales * 12) / months; // 백만원 (표시용)
    result.annualizedSales = Math.round(annualized) / 100;
    if (months < 12) {
      result.notes.push('직전 사업연도가 ' + months + '개월이므로 매출액을 12개월로 환산(' + fmt(result.annualizedSales) + '억원)해 판정했습니다.');
    }

    result.appliedRule = useLlcRule ? 'llc' : 'stock';
    if (type === 'llc' && input.llcRecentlyConverted) {
      result.notes.push('2019.11.1 이후 주식회사에서 조직변경한 유한회사로서 변경 등기일부터 5년 이내이므로 주식회사 기준을 적용했습니다(시행령 제5조제2항 단서).');
    }

    // 3-1) 단독 기준: 자산 500억 이상 또는 매출 500억 이상
    var largeAssets = assets >= T.LARGE_ASSETS;
    var largeSales = salesMeets(T.LARGE_SALES);
    if (largeAssets || largeSales) {
      result.status = 'TARGET';
      result.reason = '직전 사업연도 ' + (largeAssets ? '자산총액' : '매출액') + '이 500억원 이상입니다.';
      if (largeAssets) result.basis.push(useLlcRule ? '시행령 제5조제2항제1호(제1항제1호 준용) — 자산총액 500억원 이상' : '시행령 제5조제1항제1호 — 자산총액 500억원 이상');
      if (largeSales) result.basis.push(useLlcRule ? '시행령 제5조제2항제1호(제1항제2호 준용) — 매출액 500억원 이상' : '시행령 제5조제1항제2호 — 매출액 500억원 이상');
    }

    // 3-2) 복수 기준 체크리스트 (항상 표시)
    var c = [
      { key: 'assets', label: '자산총액 120억원 이상', value: assets / 100, unit: '억원', met: assets >= T.ASSETS, near: near(assets, T.ASSETS) },
      { key: 'liabilities', label: '부채총액 70억원 이상', value: liabilities / 100, unit: '억원', met: liabilities >= T.LIABILITIES, near: near(liabilities, T.LIABILITIES) },
      { key: 'sales', label: '매출액 100억원 이상' + (months < 12 ? ' (연환산)' : ''), value: result.annualizedSales, unit: '억원', met: salesMeets(T.SALES), near: !salesMeets(T.SALES) && annualized >= T.SALES * NEAR_RATIO },
      { key: 'employees', label: '종업원 100명 이상', value: employees, unit: '명', met: employees >= T.EMPLOYEES, near: near(employees, T.EMPLOYEES) },
    ];
    if (useLlcRule) {
      c.push({ key: 'members', label: '사원 50명 이상', value: members, unit: '명', met: members >= T.MEMBERS, near: near(members, T.MEMBERS) });
    }
    result.criteria = c;
    var metCount = c.filter(function (x) { return x.met; }).length;
    var need = useLlcRule ? 3 : 2;
    result.metCount = metCount;
    result.required = need;

    if (result.status === 'TARGET') return result;

    if (metCount >= need) {
      result.status = 'TARGET';
      result.reason = (useLlcRule ? '5개' : '4개') + ' 기준 중 ' + metCount + '개에 해당합니다(' + need + '개 이상이면 대상).';
      result.basis.push(useLlcRule ? '시행령 제5조제2항제2호 — 5개 중 3개 이상 해당' : '시행령 제5조제1항제3호 — 4개 중 2개 이상 해당');
      return result;
    }

    result.status = 'NOT_TARGET';
    result.reason = (useLlcRule ? '5개' : '4개') + ' 기준 중 ' + metCount + '개만 해당하여 외부감사 대상이 아닙니다(' + need + '개 이상이면 대상).';
    result.basis.push(useLlcRule ? '시행령 제5조제2항' : '시행령 제5조제1항');
    if (c.some(function (x) { return x.near; })) {
      result.notes.push('기준의 90% 이상에 근접한 항목이 있습니다. 회사가 성장하면 다음 해에 대상이 될 수 있습니다.');
    }
    return result;
  }

  function fmt(n) {
    if (n === null || n === undefined) return '-';
    return Number(n).toLocaleString('ko-KR', { maximumFractionDigits: 2 });
  }

  var api = { evaluate: evaluate, EXEMPTIONS: EXEMPTIONS, THRESHOLDS: T, RULES_VERSION: RULES_VERSION, fmt: fmt };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AuditRules = api;
})(this);
