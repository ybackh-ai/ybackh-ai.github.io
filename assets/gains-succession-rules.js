/*
 * 비상장주식 양도소득세 + 가업상속공제 요건 (순수 함수, 브라우저·Node 공용). 근거: docs/43_양도세_가업상속_로직.md
 * 「소득세법」 제103조, 제104조제1항제11호, 「상속세 및 증여세법」 제18조의2 (2026-11-09 조회)
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
      return x;
    };
  }
  function f6(x) { return Math.floor(x + 1e-6); }

  /**
   * @param input sale(양도가액, 만원), cost(취득가액, 만원), expenses(필요경비, 만원), major(대주주), sme(중소기업 주식), under1y(1년 미만 보유), deductionUsed(올해 기본공제 이미 사용)
   */
  function shareGains(input) {
    input = input || {};
    var errors = [], num = reader(errors);
    var r = { version: VERSION, status: null, errors: errors, notes: [], basis: [] };
    var sale = Math.round(num(input.sale, '양도가액', { positive: true }) * MAN);
    var cost = Math.round(num(input.cost, '취득가액', {}) * MAN);
    var exp = Math.round(num(input.expenses, '필요경비', { optional: true }) * MAN);
    if (errors.length) { r.status = 'INVALID'; return r; }
    r.gain = sale - cost - exp;
    r.deduction = input.deductionUsed ? 0 : Math.min(250 * MAN, Math.max(0, r.gain));
    r.base = Math.max(0, r.gain - r.deduction);
    var major = !!input.major, sme = !!input.sme, rateText;
    if (major) {
      if (input.under1y && !sme) { r.tax = f6(r.base * 0.3); rateText = '대주주, 중소기업 외 법인 주식 1년 미만 보유 30%'; }
      else if (r.base <= 3 * EOK) { r.tax = f6(r.base * 0.2); rateText = '대주주 과세표준 3억원 이하 20%'; }
      else { r.tax = 6000 * MAN + f6((r.base - 3 * EOK) * 0.25); rateText = '대주주 3억원 초과: 6천만원 + 초과분 25%'; }
    } else { r.tax = f6(r.base * (sme ? 0.1 : 0.2)); rateText = '대주주가 아닌 자, ' + (sme ? '중소기업 주식 10%' : '중소기업 외 주식 20%'); }
    r.localTax = Math.floor(r.tax / 10);
    r.totalTax = r.tax + r.localTax;
    r.basis.push('양도차익 = 양도가액 − 취득가액 − 필요경비 (「소득세법」 제97조)');
    r.basis.push('「소득세법」 제103조제1항제2호 — 주식 양도소득 기본공제 연 250만원' + (input.deductionUsed ? ' (이미 사용 → 0)' : ''));
    r.basis.push('「소득세법」 제104조제1항제11호 — ' + rateText);
    r.basis.push('지방소득세 = 양도소득세의 10%');
    r.notes.push('대주주 기준(지분율·시가총액)은 「소득세법 시행령」 제157조에서 정하며 원문 대조 전입니다. 본인과 특수관계인 지분을 합산하므로 직접 확인해 주세요(확실하지 않음).');
    r.notes.push('증권거래세, 같은 해 다른 주식 양도차손 통산, 특수관계인 간 저가 양도(시가 적용)는 반영하지 않았습니다. 양도일이 속하는 반기 말일부터 2개월 이내 예정신고가 원칙입니다.');
    r.status = r.tax > 0 ? 'TAX' : 'NONE';
    return r;
  }

  /**
   * 가업상속공제 기본 요건 (억원)
   * @param input size 'sme'|'mid'|'other', avgSales(직전 3년 평균 매출액, 억원 — 중견), years(피상속인 계속 경영기간), assetValue(가업상속재산가액, 억원), fraud
   */
  function succession(input) {
    input = input || {};
    var errors = [], num = reader(errors);
    var r = { version: VERSION, status: null, errors: errors, notes: [], basis: [], checks: [] };
    var size = ['sme', 'mid', 'other'].indexOf(input.size) >= 0 ? input.size : 'sme';
    var years = num(input.years, '피상속인의 계속 경영기간');
    var asset = num(input.assetValue, '가업상속재산가액');
    var sales = size === 'mid' ? num(input.avgSales, '직전 3년 평균 매출액') : null;
    if (errors.length) { r.status = 'INVALID'; return r; }
    var sizeOk = size === 'sme' || (size === 'mid' && sales < 5000);
    var yearsOk = years >= 10;
    r.checks.push({ label: '중소기업 또는 중견기업(직전 3년 평균 매출액 5천억원 미만)', ok: sizeOk });
    r.checks.push({ label: '피상속인이 10년 이상 계속 경영', ok: yearsOk });
    r.checks.push({ label: '조세포탈·회계부정으로 형 확정 없음', ok: !input.fraud });
    r.eligible = sizeOk && yearsOk && !input.fraud;
    r.limit = years >= 30 ? 600 : years >= 20 ? 400 : years >= 10 ? 300 : 0;
    r.deduction = r.eligible ? Math.min(asset, r.limit) : 0;
    r.basis.push('「상속세 및 증여세법」 제18조의2제1항 — 중소기업 또는 중견기업(직전 3년 평균 매출액 5천억원 이상 제외), 피상속인 10년 이상 계속 경영');
    r.basis.push('공제 한도: 10년 이상 300억원, 20년 이상 400억원, 30년 이상 600억원 → 가업상속재산가액과 한도 중 적은 금액');
    r.basis.push('같은 조 제8항 — 피상속인·상속인의 조세포탈·회계부정 형이 확정되면 공제 배제 또는 추징');
    if (size === 'mid') r.notes.push('중견기업은 상속인의 가업상속재산 외 재산이 납부할 상속세 × 시행령 비율을 넘으면 공제가 배제됩니다(제2항, 비율은 시행령 원문 대조 전).');
    r.notes.push('사후관리(제5항, 상속개시일부터 5년): 가업용 자산 40% 이상 처분, 상속인 가업 미종사, 지분 감소, 정규직 근로자 수와 총급여액이 모두 직전 2년 평균의 90% 미달 → 추징.');
    r.notes.push('피상속인 지분 요건(최대주주 등 지분 보유 비율·기간), 대표이사 재직 요건, 상속인 요건(나이·가업 종사·대표이사 취임) 등은 시행령 제15조에서 정하며 원문 대조 전입니다(확실하지 않음). 반드시 사전에 전문가 검토를 받으세요.');
    r.status = r.eligible ? 'ELIGIBLE' : 'NOT_ELIGIBLE';
    return r;
  }

  var api = { shareGains: shareGains, succession: succession, VERSION: VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GainsSuccessionRules = api;
})(this);
