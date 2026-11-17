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
    // 시행령 §15③ 세부 요건: 'yes' 충족, 'no' 미충족, 그 밖(미입력) 확인 필요
    var detail = [
      ['ownerShare', '피상속인이 최대주주등이고 특수관계인 포함 지분 40%(상장법인 20%) 이상을 10년 이상 보유(영 §15③1가)'],
      ['ceoTenure', '피상속인이 대표이사로 가업 영위기간의 50% 이상, 또는 10년 이상(상속인이 승계해 계속 재직), 또는 상속개시일 전 10년 중 5년 이상 재직(영 §15③1나)'],
      ['heirReq', '상속인(또는 그 배우자)이 18세 이상, 상속개시 전 2년 이상 가업 종사, 신고기한까지 임원 취임, 신고기한부터 2년 이내 대표이사 취임(영 §15③2)']];
    var detailFail = false;
    r.pending = 0;
    detail.forEach(function (d) {
      var v = input[d[0]];
      if (v === 'yes') r.checks.push({ label: d[1], ok: true });
      else if (v === 'no') { r.checks.push({ label: d[1], ok: false }); detailFail = true; }
      else { r.checks.push({ label: d[1], ok: null }); r.pending++; }
    });
    r.midExcluded = false;
    if (size === 'mid' && !blank(input.otherAssets) && !blank(input.heirTax)) {
      var oa = num(input.otherAssets, '가업상속재산 외 상속재산'), ht = num(input.heirTax, '상속인이 낼 상속세(공제 전)');
      if (errors.length) { r.status = 'INVALID'; return r; }
      r.midExcluded = oa > ht * 2;
      r.checks.push({ label: '중견기업: 가업상속재산 외 상속재산이 상속세(공제 전) × 200% 이하(법 §18조의2②, 영 §15⑦)', ok: !r.midExcluded });
    } else if (size === 'mid') { r.checks.push({ label: '중견기업: 가업상속재산 외 상속재산이 상속세(공제 전) × 200% 이하(법 §18조의2②, 영 §15⑦)', ok: null }); r.pending++; }
    r.eligible = sizeOk && yearsOk && !input.fraud && !detailFail && !r.midExcluded;
    r.limit = years >= 30 ? 600 : years >= 20 ? 400 : years >= 10 ? 300 : 0;
    r.deduction = r.eligible ? Math.min(asset, r.limit) : 0;
    r.basis.push('「상속세 및 증여세법」 제18조의2제1항 — 중소기업 또는 중견기업(직전 3년 평균 매출액 5천억원 이상 제외), 피상속인 10년 이상 계속 경영');
    r.basis.push('공제 한도: 10년 이상 300억원, 20년 이상 400억원, 30년 이상 600억원 → 가업상속재산가액과 한도 중 적은 금액');
    r.basis.push('같은 법 시행령 제15조제3항 — 피상속인 지분·대표이사 재직, 상속인 나이·종사·임원·대표이사 취임 요건 (2026-11-17 확인)');
    if (size === 'mid') r.basis.push('같은 법 제18조의2제2항, 시행령 제15조제6항·제7항 — 중견기업은 가업상속재산 외 상속재산(채무·가업상속재산 차감)이 공제 전 상속세의 200%를 넘으면 공제 배제');
    r.basis.push('같은 법 제18조의2제8항 — 피상속인·상속인의 조세포탈·회계부정 형이 확정되면 공제 배제 또는 추징');
    r.notes.push('사후관리(제5항, 상속개시일부터 5년): 가업용 자산 40% 이상 처분, 상속인 가업 미종사(대표이사 미종사·주된 업종 변경·1년 이상 휴폐업 포함), 지분 감소, 정규직 근로자 수와 총급여액이 모두 직전 2년 평균의 90% 미달 → 추징.');
    r.notes.push('가업상속재산가액은 법인 주식이면 사업무관자산(비사업용 토지, 임대 부동산, 과다보유현금 등) 비율만큼 줄어듭니다(시행령 제15조제5항). 넣은 금액이 그 기준으로 계산한 값인지 확인해 주세요.');
    r.notes.push('중소기업은 시행령 별표 업종이고 자산총액 5천억원 미만이어야 합니다(같은 조 제1항). 피상속인이 65세 이전에 사망하는 등 부득이한 경우 상속인의 2년 종사 요건은 적용하지 않습니다.');
    r.status = r.eligible ? 'ELIGIBLE' : 'NOT_ELIGIBLE';
    return r;
  }

  var api = { shareGains: shareGains, succession: succession, VERSION: VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GainsSuccessionRules = api;
})(this);
