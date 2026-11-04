/*
 * 세율 공통 모듈 + 스톡옵션 행사 세금 + 법인 vs 개인 세 부담 비교 (순수 함수, 브라우저·Node 공용)
 * 근거: docs/25_세금계산도구_로직.md — 소득세법 제55조제1항, 법인세법 제55조제1항, 소득세법 시행령 제38조제1항제17호,
 *       소득세법 제21조제1항제22호, 조세특례제한법 제16조의2 (2026-11-04 조회). 지방소득세 미반영.
 * 금액 입력: 만원 → 원 정수. 세액은 원 미만 버림.
 */
(function (root) {
  'use strict';
  var VERSION = '2026-11-04';
  var MAN = 10000, EOK = 100000000;

  // [하한(초과), 기본세액, 세율%] — 소득세법 제55조제1항
  var INCOME = [[10 * EOK, 384060000, 45], [5 * EOK, 174060000, 42], [3 * EOK, 94060000, 40], [1.5 * EOK, 37060000, 38],
    [8800 * MAN, 15360000, 35], [5000 * MAN, 6240000, 24], [1400 * MAN, 840000, 15], [0, 0, 6]];
  // 법인세법 제55조제1항제1호 / 제2호
  var CORP1 = [[3000 * EOK, 65580000000, 25], [200 * EOK, 3980000000, 22], [2 * EOK, 20000000, 20], [0, 0, 10]];
  var CORP2 = [[3000 * EOK, 65600000000, 25], [200 * EOK, 4000000000, 22], [0, 0, 20]];

  function progressive(table, base) {
    if (!(base > 0)) return 0;
    for (var i = 0; i < table.length; i++) {
      var t = table[i];
      if (base > t[0] || t[0] === 0) return t[1] + Math.floor((base - t[0]) * t[2] / 100);
    }
    return 0;
  }
  function incomeTax(base) { return progressive(INCOME, Math.floor(base)); }
  function corpTax(base, special) { return progressive(special ? CORP2 : CORP1, Math.floor(base)); }

  function blank(v) { return v === undefined || v === null || v === ''; }
  function reader(errors) {
    return function (v, name, opt) {
      opt = opt || {};
      if (blank(v)) { if (opt.optional) return opt.def; errors.push(name + ': 값을 입력해 주세요.'); return null; }
      var n = Number(v);
      if (!isFinite(n) || n < 0) { errors.push(name + ': 0 이상의 숫자로 입력해 주세요.'); return null; }
      return n;
    };
  }

  var EXEMPT_YEAR = 2 * EOK, EXEMPT_TOTAL = 5 * EOK; // 조특법 제16조의2제1항

  /**
   * 스톡옵션 행사 세금
   *  fairValue, strike: 원(1주당), shares: 주, inService: 근무 중 행사, venture: 벤처 비과세 특례 대상
   *  yearExempt, priorExempt: 만원(올해 이미 비과세 / 해당 회사 누적 비과세), existingBase: 만원(행사이익 외 종합소득 과세표준)
   */
  function stockOptionTax(input) {
    input = input || {};
    var errors = [], num = reader(errors);
    var r = { version: VERSION, status: null, errors: errors, notes: [] };
    var fv = num(input.fairValue, '행사 당시 시가'), k = num(input.strike, '행사가격'), sh = num(input.shares, '행사 주식 수');
    var yearUsed = num(input.yearExempt, '올해 비과세 사용액', { optional: true, def: 0 }) * MAN;
    var priorUsed = num(input.priorExempt, '누적 비과세 사용액', { optional: true, def: 0 }) * MAN;
    var base = num(input.existingBase, '기존 과세표준', { optional: true, def: 0 }) * MAN;
    if (errors.length) { r.status = 'INVALID'; return r; }
    r.gain = Math.max(0, Math.floor((fv - k) * sh));
    r.incomeType = input.inService ? '근로소득' : '기타소득';
    r.exempt = 0;
    if (input.venture) r.exempt = Math.max(0, Math.min(r.gain, EXEMPT_YEAR - yearUsed, EXEMPT_TOTAL - priorUsed));
    r.taxable = r.gain - r.exempt;
    r.taxBefore = incomeTax(base);
    r.taxAfter = incomeTax(base + r.taxable);
    r.extraTax = r.taxAfter - r.taxBefore;
    r.marginalRate = r.taxable > 0 ? Math.round(r.extraTax / r.taxable * 1000) / 10 : 0;
    r.basis = [input.inService ? '근무 중 행사 이익은 근로소득 — 소득세법 시행령 제38조제1항제17호' : '퇴직 후 행사(또는 고용관계 없이 부여) 이익은 기타소득 — 소득세법 제21조제1항제22호', '세율 — 소득세법 제55조제1항'];
    if (input.venture) r.basis.push('벤처기업 주식매수선택권 행사이익 비과세(연 2억원, 회사별 누적 5억원) — 조세특례제한법 제16조의2');
    r.notes.push('행사이익을 기존 과세표준에 더했을 때 늘어나는 소득세만 추정했습니다. 근로소득공제·세액공제 변동, 지방소득세, 4대보험은 반영하지 않았습니다.');
    if (input.venture) r.notes.push('비과세 특례는 2027년 12월 31일 이전에 부여받은 벤처기업 주식매수선택권 등 요건을 갖춘 경우에만 적용됩니다.');
    r.notes.push('벤처기업 스톡옵션은 납부 특례·과세 이연(조세특례제한법 제16조의3·제16조의4)을 선택할 수 있는 경우가 있으나 이 계산에는 반영하지 않았습니다.');
    r.status = 'OK';
    return r;
  }

  /**
   * 법인 vs 개인사업자 세 부담
   *  profit: 만원(연간 사업이익, 세무상 소득 가정), personalDeduction: 만원(개인 소득공제), ceoSalary: 만원(법인 대표자 급여, 근로소득 과세표준으로 가정)
   *  smallRental: 법인세법 제60조의2제1항제1호 법인(제55조제1항제2호 세율)
   */
  function corpVsPersonal(input) {
    input = input || {};
    var errors = [], num = reader(errors);
    var r = { version: VERSION, status: null, errors: errors, notes: [] };
    var p = num(input.profit, '연간 사업이익');
    var ded = num(input.personalDeduction, '개인 소득공제', { optional: true, def: 0 });
    var sal = num(input.ceoSalary, '대표자 급여', { optional: true, def: 0 });
    if (p !== null && sal > p) errors.push('대표자 급여가 사업이익보다 클 수 없습니다.');
    if (errors.length) { r.status = 'INVALID'; return r; }
    p *= MAN; ded *= MAN; sal *= MAN;
    r.personalBase = Math.max(0, p - ded);
    r.personalTax = incomeTax(r.personalBase);
    r.corpBase = p - sal;
    r.corpTaxAmt = corpTax(r.corpBase, !!input.smallRental);
    r.ceoTax = incomeTax(sal);
    r.corpTotal = r.corpTaxAmt + r.ceoTax;
    r.diff = r.personalTax - r.corpTotal;
    r.retained = r.corpBase - r.corpTaxAmt;
    r.basis = ['개인: 소득세법 제55조제1항', '법인: 법인세법 제55조제1항' + (input.smallRental ? '제2호(같은 법 제60조의2제1항제1호 법인)' : '제1호')];
    r.notes.push('법인에 남은 이익(세후 ' + Math.round(r.retained / MAN).toLocaleString('ko-KR') + '만원)을 대표자가 배당으로 가져가면 배당소득세가 추가됩니다. 이 비교는 그 세금을 반영하지 않았습니다.');
    r.notes.push('대표자 급여는 근로소득공제 등을 뺀 과세표준으로 보고 계산했습니다. 지방소득세, 4대보험, 각종 감면·공제는 반영하지 않았습니다.');
    r.status = 'OK';
    return r;
  }

  var api = { incomeTax: incomeTax, corpTax: corpTax, stockOptionTax: stockOptionTax, corpVsPersonal: corpVsPersonal, VERSION: VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TaxTools = api;
})(this);
