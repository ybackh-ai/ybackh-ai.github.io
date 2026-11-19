/*
 * 개인 세금 6종 (순수 함수, 브라우저·Node 공용). 근거: docs/61 (법령 원문 2026-11-19 확인)
 *  pensionCredit 연금저축·IRP 세액공제 / yearEndTax 연말정산 미리보기(베타) / freelancerTax 프리랜서 3.3% 환급
 *  foreignStockTax 해외주식 양도세(베타) / homeSaleTax 1세대 1주택 양도세(베타) / acquisitionTax 주택 취득세(베타)
 * 세율표는 tax-tools-rules.js(window.TaxTools)를 쓴다. 금액 입력 만원, 결과 원. 지방소득세는 국세의 10%.
 */
(function (root) {
  'use strict';
  var TT = (typeof module !== 'undefined' && module.exports) ? require('./tax-tools-rules.js') : root.TaxTools;
  var VERSION = '2026-11-19';
  var MAN = 10000;
  var EMP_INS = 0.0475 + 0.03595 + 0.004724 + 0.009; // 2026 근로자 부담 합계(국민연금·건강·장기요양·고용)
  function blank(v) { return v === undefined || v === null || v === ''; }
  function fl(x) { return Math.floor(x + 1e-6); }
  function reader(errors) {
    return function (v, label, opt) {
      opt = opt || {};
      if (blank(v)) { if (opt.optional) return opt.def !== undefined ? opt.def : 0; errors.push(label + '을(를) 입력해 주세요.'); return 0; }
      var x = Number(String(v).replace(/,/g, ''));
      if (!isFinite(x) || x < 0 || (opt.positive && x <= 0)) { errors.push(label + '은(는) ' + (opt.positive ? '0보다 큰' : '0 이상의') + ' 숫자로 입력해 주세요.'); return 0; }
      return x;
    };
  }
  function base() { return { version: VERSION, status: null, errors: [], notes: [], basis: [] }; }
  function earnedDeduction(g) {
    var d = g <= 5e6 ? g * 0.7 : g <= 15e6 ? 3.5e6 + (g - 5e6) * 0.4 : g <= 45e6 ? 7.5e6 + (g - 15e6) * 0.15 : g <= 1e8 ? 12e6 + (g - 45e6) * 0.05 : 14.75e6 + (g - 1e8) * 0.02;
    return fl(Math.min(d, 2e7, g));
  }
  function earnedCredit(tax, g) {
    var c = tax <= 1.3e6 ? fl(tax * 0.55) : 715000 + fl((tax - 1.3e6) * 0.3);
    var lim = g <= 3.3e7 ? 740000 : g <= 7e7 ? Math.max(660000, 740000 - (g - 3.3e7) * 8 / 1000) : g <= 1.2e8 ? Math.max(500000, 660000 - (g - 7e7) / 2) : Math.max(200000, 500000 - (g - 1.2e8) / 2);
    return Math.min(c, fl(lim));
  }

  // 1. 연금저축·IRP
  function pensionCredit(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var inc = num(input.income, input.incomeType === 'other' ? '종합소득금액' : '총급여', { positive: true });
    var sv = num(input.savings, '연금저축 납입액', { optional: true });
    var irp = num(input.irp, 'IRP 등 퇴직연금계좌 납입액', { optional: true });
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    var low = input.incomeType === 'other' ? inc <= 4500 : inc <= 5500;
    r.rate = low ? 15 : 12;
    var svE = Math.min(sv, 600), el = Math.min(svE + irp, 900);
    r.eligible = Math.round(el * MAN);
    r.credit = fl(r.eligible * r.rate / 100);
    r.localCredit = fl(r.credit * 0.1);
    r.room = Math.round((900 - el) * MAN);
    r.extraCredit = fl(r.room * r.rate / 100);
    r.status = 'OK';
    r.basis.push('「소득세법」 제59조의3(연금저축 연 600만원, 퇴직연금 합산 연 900만원 한도, 공제율 12% · 총급여 5,500만원(종합소득 4,500만원) 이하 15%), 지방소득세 공제는 그 10%');
    if (sv > 600) r.notes.push('연금저축만으로는 600만원까지만 공제됩니다. 나머지는 IRP 등 퇴직연금계좌로 채우면 900만원까지 공제됩니다.');
    r.notes.push('세액공제는 낼 세금(산출세액) 범위 안에서만 효과가 있습니다. 55세 전 중도 인출하면 공제받은 금액에 기타소득세(16.5%)가 부과될 수 있습니다.');
    return r;
  }

  // 2. 연말정산 미리보기
  function cardDeduction(g, C, D, M, U, kids) {
    var low = g <= 7e7;
    if (!low) { C += U; U = 0; }
    var T = C + D + M + U, min = g * 0.25;
    if (T <= min) return 0;
    var gross = M * 0.4 + U * 0.3 + D * 0.3 + C * 0.15, sub;
    if (min <= C) sub = min * 0.15;
    else if (min <= C + D + U) sub = C * 0.15 + (min - C) * 0.3;
    else sub = C * 0.15 + (D + U) * 0.3 + (min - C - D - U) * 0.4;
    var ded = Math.max(0, gross - sub);
    var lim = low ? (kids >= 2 ? 4e6 : kids === 1 ? 3.5e6 : 3e6) : (kids >= 2 ? 3e6 : kids === 1 ? 2.75e6 : 2.5e6);
    var extra = ded > lim ? Math.min(ded - lim, Math.min(M * 0.4 + (low ? U * 0.3 : 0), low ? 3e6 : 2e6)) : 0;
    return fl(Math.min(ded, lim) + extra);
  }
  function yearEndTax(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var g = num(input.salary, '총급여', { positive: true }) * MAN;
    var pre = num(input.prepaid, '기납부세액(원천징수된 소득세)', { optional: true }) * MAN;
    var dep = Math.max(1, Math.floor(num(input.dependents, '기본공제 인원', { optional: true, def: 1 })));
    var kids = Math.floor(num(input.children, '8세 이상 자녀 수', { optional: true }));
    // 카드 한도의 "자녀등" = 20세 이하 직계비속(기본공제 대상) — 조특령 §121의2⑱. 비우면 8세 이상 자녀 수로 대신함
    var cardKids = blank(input.cardKids) ? kids : Math.floor(num(input.cardKids, '20세 이하 자녀 수'));
    var insIn = blank(input.insurance) ? null : num(input.insurance, '본인 부담 4대보험료(연)') * MAN;
    var C = num(input.credit, '신용카드', { optional: true }) * MAN, D = num(input.debit, '체크카드·현금영수증', { optional: true }) * MAN;
    var M = num(input.market, '전통시장·대중교통', { optional: true }) * MAN, U = num(input.culture, '도서·공연·박물관·영화·체육시설', { optional: true }) * MAN;
    var medG = num(input.medical, '일반 의료비', { optional: true }) * MAN, medS = num(input.medicalSelf, '본인·65세 이상·장애인 의료비', { optional: true }) * MAN;
    var edu = num(input.education, '교육비', { optional: true }) * MAN, insP = num(input.insurancePremium, '보장성 보험료', { optional: true }) * MAN;
    var don = num(input.donation, '기부금', { optional: true }) * MAN, rent = num(input.rent, '월세(연)', { optional: true }) * MAN;
    var pen = num(input.pension, '연금저축·IRP 납입액', { optional: true });
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    var earned = g - earnedDeduction(g);
    var ins = insIn === null ? fl(g * EMP_INS) : insIn;
    r.insurance = ins;
    r.cardDeduction = cardDeduction(g, C, D, M, U, cardKids);
    r.taxBase = Math.max(0, earned - 1500000 * dep - ins - r.cardDeduction);
    r.calcTax = TT.incomeTax(r.taxBase);
    r.earnedCredit = earnedCredit(r.calcTax, g);
    r.childCredit = kids <= 0 ? 0 : kids === 1 ? 250000 : 550000 + (kids - 2) * 400000;
    var penEl = Math.min(pen * MAN, 9e6); // 연금저축(600만원 이내)·IRP 합계 입력, 900만원 한도
    r.pensionCredit = fl(penEl * (g <= 5.5e7 ? 0.15 : 0.12));
    var thr = g * 0.03;
    var medEx = Math.min(Math.max(0, medG - thr), 7e6), medSelf = Math.max(0, medS - Math.max(0, thr - medG));
    r.medicalCredit = fl((medEx + medSelf) * 0.15);
    r.educationCredit = fl(edu * 0.15);
    r.insuranceCredit = fl(Math.min(insP, 1e6) * 0.12);
    r.donationCredit = fl(Math.min(don, 1e7) * 0.15 + Math.max(0, don - 1e7) * 0.3);
    r.rentCredit = g <= 8e7 ? fl(Math.min(rent, 1e7) * (g <= 5.5e7 ? 0.17 : 0.15)) : 0;
    var special = r.medicalCredit + r.educationCredit + r.insuranceCredit + r.donationCredit + r.rentCredit;
    r.useStandard = special < 130000;
    r.specialCredit = r.useStandard ? 130000 : special;
    r.determinedTax = Math.max(0, r.calcTax - r.earnedCredit - r.childCredit - r.pensionCredit - r.specialCredit);
    r.localTax = fl(r.determinedTax * 0.1);
    r.refund = pre - r.determinedTax;
    r.localRefund = fl(pre * 0.1) - r.localTax;
    r.status = r.refund >= 0 ? 'REFUND' : 'PAY';
    r.basis.push('「소득세법」 제47조(근로소득공제), 제50조(기본공제), 제51조의3·제52조(보험료 공제), 제55조(세율), 제59조(근로소득세액공제), 제59조의2(자녀 1명 25만·2명 55만·3명부터 1명당 40만), 제59조의3(연금계좌), 제59조의4(보험 12%·의료비 3% 초과분 15%·교육비 15%·기부금 15/30%, 표준세액공제 13만원)');
    r.basis.push('「조세특례제한법」 제126조의2(신용카드 등 총급여 25% 초과분, 신용 15%·체크·현금 30%·전통시장·대중교통 40%·문화 30%, 한도 300만/250만원, 자녀 수별 한도, 전통시장·대중교통 추가 한도), 제95조의2(월세 15%·17%, 연 1천만원 한도)');
    r.notes.push('4대보험료를 넣지 않으면 2026년 요율로 총급여에서 추정합니다. 교육비·의료비는 대상자별 한도와 요건을 맞춘 금액을 넣으세요(교육비 1명당 한도 등은 계산하지 않음).');
    r.notes.push('카드 공제 자녀별 한도·추가 한도와 월세 공제 개정(2025년 12월)은 2026년 사용·지급분부터 적용됩니다(조특법 부칙 법률 제21223호 제17조·제47조). 카드 한도의 자녀는 20세 이하 직계비속으로 기본공제 대상인 사람입니다(조특법 시행령 제121조의2제18항).');
    r.notes.push('주택자금 공제, 정치자금, 중소기업 취업자 감면, 교육비 1명당 한도는 계산하지 않습니다. 해당하면 실제 세금은 더 줄어듭니다.');
    return r;
  }

  // 3. 프리랜서 3.3%
  var SIMPLE_LIMIT = { a: 6000, b: 3600, c: 2400 };
  function freelancerTax(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var rev = num(input.revenue, '연 수입금액(3.3% 떼기 전 금액)', { positive: true });
    var method = input.method === 'books' ? 'books' : input.method === 'standard' ? 'standard' : 'simple';
    var sr = method === 'simple' ? num(input.simpleRate, '단순경비율', {}) : 0;
    var exp = method === 'books' ? num(input.expenses, '장부상 필요경비') : 0;
    var major = method === 'standard' ? num(input.majorExpenses, '증빙 있는 주요경비', { optional: true }) : 0;
    var stdr = method === 'standard' ? num(input.standardRate, '기준경비율') : 0;
    var dep = Math.max(1, Math.floor(num(input.dependents, '기본공제 인원', { optional: true, def: 1 })));
    var pen = num(input.pensionPaid, '국민연금 납부액', { optional: true });
    var prev = blank(input.prevRevenue) ? null : num(input.prevRevenue, '직전 연도 수입금액');
    if (!r.errors.length && (sr > 100 || stdr > 100)) r.errors.push('경비율은 100% 이하여야 합니다.');
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    var R = rev * MAN;
    r.method = method;
    r.income = Math.max(0, Math.round(method === 'simple' ? R * (1 - sr / 100) : method === 'books' ? R - exp * MAN : R - major * MAN - R * stdr / 100));
    // 기준경비율 소득은 단순경비율 소득 × 배율(간편장부대상자 2.8, 복식부기의무자 3.4)을 넘지 않음 — 시행령 §143③1 단서, 시행규칙 §67
    var srCap = method === 'standard' && !blank(input.simpleRate) ? num(input.simpleRate, '단순경비율') : null;
    if (srCap !== null) {
      r.capIncome = Math.round(R * (1 - srCap / 100) * (input.doubleEntry ? 3.4 : 2.8));
      if (r.income > r.capIncome) { r.income = r.capIncome; r.capped = true; }
    }
    r.taxBase = Math.max(0, r.income - 1500000 * dep - pen * MAN);
    r.tax = Math.max(0, TT.incomeTax(r.taxBase) - 70000);
    r.localTax = fl(r.tax * 0.1);
    r.prepaidTotal = fl(R * 0.03) + fl(R * 0.003);
    r.refund = r.prepaidTotal - r.tax - r.localTax;
    if (prev !== null) r.simpleEligible = prev < SIMPLE_LIMIT[input.group in SIMPLE_LIMIT ? input.group : 'c'];
    r.status = r.refund >= 0 ? 'REFUND' : 'PAY';
    r.basis.push('「소득세법」 제55조(세율), 제50조(기본공제), 제51조의3(연금보험료 공제), 제59조의4제9항제2호(근로소득 없는 사람 표준세액공제 7만원), 제129조제1항제3호(사업소득 원천징수 3%)');
    r.basis.push('「소득세법 시행령」 제143조제3항(기준경비율·단순경비율 추계 방법), 제4항(단순경비율 대상: 신규 사업자 또는 직전 연도 수입 6천만원·3,600만원·2,400만원 미만)');
    r.basis.push('「소득세법 시행령」 제143조제3항제1호 단서, 시행규칙 제67조(기준경비율 소득금액 상한 = 단순경비율 소득금액 × 2.8, 복식부기의무자 3.4, 2027년 귀속까지)');
    r.notes.push('단순경비율·기준경비율은 업종코드별로 국세청이 매년 고시합니다(홈택스에서 업종코드로 조회). 기준경비율 방식에서 단순경비율도 넣으면 배율 상한을 적용합니다.' + (r.capped ? ' 이번 계산은 상한이 적용됐습니다.' : ''));
    r.notes.push('해당 연도 수입이 복식부기의무 기준 이상이면 장부를 쓰지 않을 때 가산세가 붙을 수 있고, 다른 종합소득(근로소득 등)이 있으면 합산해 세율이 달라집니다.');
    return r;
  }

  // 4. 해외주식 양도세
  function cgt(gainWon) { var b = Math.max(0, gainWon - 2500000); var t = fl(b * 0.2); return { base: b, tax: t, local: fl(t * 0.1) }; }
  function foreignStockTax(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var gain = num(input.gain, '이익 본 종목의 양도차익 합계', { optional: true });
    var loss = num(input.loss, '손실 본 종목의 양도차손 합계', { optional: true });
    var hasGift = !blank(input.giftValue);
    var gv = hasGift ? num(input.giftValue, '증여할 주식 시가', { positive: true }) : 0;
    var dc = hasGift ? num(input.donorCost, '원래 취득가액') : 0;
    var mo = hasGift ? num(input.monthsAfterGift, '증여 후 양도까지 개월 수', { optional: true, def: 13 }) : 0;
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    var x = cgt(Math.max(0, gain - loss) * MAN);
    r.netGain = Math.max(0, gain - loss) * MAN; r.taxBase = x.base; r.tax = x.tax; r.localTax = x.local; r.total = x.tax + x.local;
    if (hasGift) {
      var d = cgt(Math.max(0, gv - dc) * MAN);
      r.directTotal = d.tax + d.local;
      r.giftTaxable = Math.max(0, gv - 60000) * MAN;
      r.giftTotal = mo >= 12 ? 0 : r.directTotal;
      r.giftSaving = r.directTotal - r.giftTotal;
      r.notes.push(mo >= 12 ? '배우자에게 증여한 뒤 1년이 지나 같은 가격에 팔면 증여 당시 시가가 취득가액이 되어 양도차익이 거의 없습니다. 배우자 증여재산공제는 10년간 6억원입니다.' : '증여받은 주식을 1년 안에 팔면 증여한 사람의 취득가액으로 계산하므로(제97조의2) 절세 효과가 없습니다.');
      if (r.giftTaxable > 0) r.notes.push('증여 금액이 배우자 공제 6억원을 넘어 넘는 부분에 증여세가 붙습니다. 상속·증여세 계산기로 확인하세요.');
    }
    r.status = r.total > 0 ? 'TAX' : 'NONE';
    r.basis.push('「소득세법」 제94조제1항제3호다목(외국법인 주식), 제102조(같은 그룹 안 양도차손 통산), 제103조(주식 그룹 연 250만원 기본공제), 제104조제1항제12호(중소기업 외 20%), 지방소득세 10%(합계 22%)');
    r.basis.push('「소득세법」 제97조의2제1항(배우자·직계존비속에게 증여받은 주식을 1년 안에 양도하면 증여자 취득가액 적용, 2025년 12월 개정)');
    r.notes.push('양도차익은 원화로 환산한 금액을 넣습니다(증권사가 주는 해외주식 양도소득 자료의 원화 금액을 쓰면 됩니다). 국내 상장주식 소액주주 손익은 과세 대상이 아니라 통산하지 않습니다. 다음 해 5월에 확정신고합니다.');
    r.notes.push('증여받은 주식을 1년 안에 팔면 증여자 취득가액을 쓰는 규정은 2026년 1월 1일 이후 양도분부터 적용됩니다(소득세법 부칙 법률 제21221호 제7조).');
    return r;
  }

  // 5. 1세대 1주택 양도세
  function homeSaleTax(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var sp = num(input.salePrice, '양도가액', { positive: true }), ap = num(input.acqPrice, '취득가액');
    var ex = num(input.expenses, '필요경비(취득세·중개수수료 등)', { optional: true });
    var hy = num(input.holdYears, '보유기간(년)'), ly = num(input.liveYears, '거주기간(년)', { optional: true });
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    var gain = (sp - ap - ex) * MAN;
    var exemptOk = !!input.oneHouse && hy >= 2 && (!input.adjustedAtAcq || ly >= 2);
    r.exemptRequirement = exemptOk;
    if (gain <= 0) { r.status = 'NONE'; r.total = 0; r.tax = 0; r.taxableGain = 0; r.notes.push('양도차익이 없습니다.'); r.basis.push('「소득세법」 제95조'); return r; }
    var heavyAdd = !input.oneHouse && input.adjustedNow ? (Number(input.houseCount) >= 3 ? 30 : Number(input.houseCount) === 2 ? 20 : 0) : 0;
    if (exemptOk && sp <= 120000) { r.status = 'EXEMPT'; r.total = 0; r.tax = 0; r.taxableGain = 0; }
    else if (heavyAdd) {
      // 조정대상지역 다주택 중과(소득세법 §104⑦): 장기보유특별공제 없음(§95②), 기본세율 + 20%p·30%p. 중과 배제 유예(시행령 §167의10①12의2)는 2026-05-09 양도분까지
      r.taxableGain = gain; r.ltcgRate = 0; r.heavyAdd = heavyAdd;
      r.taxBase = Math.max(0, gain - 2500000);
      var heavy = TT.incomeTax(r.taxBase) + fl(r.taxBase * heavyAdd / 100);
      if (hy < 2) heavy = Math.max(heavy, fl(r.taxBase * (hy < 1 ? 0.7 : 0.6)));
      r.tax = heavy; r.localTax = fl(r.tax * 0.1); r.total = r.tax + r.localTax;
      r.status = 'HEAVY';
    }
    else {
      var tg = exemptOk ? Math.round(gain * (sp - 120000) / sp) : gain;
      var H = Math.floor(hy), L = Math.floor(ly), rate = 0;
      if (exemptOk && H >= 3 && L >= 2) rate = Math.min(40, 4 * H) + Math.min(40, 4 * L);
      else if (H >= 3) rate = Math.min(30, 2 * H);
      r.taxableGain = tg; r.ltcgRate = rate;
      var inc = tg - fl(tg * rate / 100);
      r.taxBase = Math.max(0, inc - 2500000);
      r.tax = hy < 1 ? fl(r.taxBase * 0.7) : hy < 2 ? fl(r.taxBase * 0.6) : TT.incomeTax(r.taxBase);
      r.localTax = fl(r.tax * 0.1); r.total = r.tax + r.localTax;
      r.status = 'TAX';
    }
    r.basis.push('「소득세법」 제89조제1항제3호(1세대 1주택 비과세, 양도가액 12억원 초과 고가주택 제외), 시행령 제154조제1항(보유 2년, 취득 당시 조정대상지역이면 거주 2년), 시행령 제160조(12억원 초과분 비율 과세)');
    r.basis.push('「소득세법」 제95조제2항(장기보유특별공제 표 1: 3년부터 연 2%, 최대 30% / 표 2: 1세대 1주택 보유 연 4%·거주 연 4%, 각 최대 40%), 제103조(기본공제 250만원), 제104조제1항(1년 미만 70%, 2년 미만 60%, 그 밖 기본세율)');
    r.basis.push('「소득세법」 제104조제7항(조정대상지역 2주택 +20%p, 3주택 이상 +30%p), 시행령 제159조의4(장특 표 2는 보유기간 중 거주 2년 이상), 제167조의10제1항제12호의2(보유 2년 이상 중과 배제는 2026년 5월 9일 양도분까지)');
    r.notes.push('일시적 2주택·상속·혼인·동거봉양 특례, 중과 배제 주택(지방 기준시가 3억원 이하, 장기임대주택 등 시행령 제167조의10·제167조의3), 분양권·입주권, 부수토지 면적 초과분은 반영하지 않았습니다. 보유·거주기간은 년 단위로 내림해 장기보유특별공제율을 정했습니다.');
    return r;
  }

  // 6. 주택 취득세
  function acquisitionTax(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var p = num(input.price, '취득가액', { positive: true });
    var h = Math.max(1, Math.floor(num(input.houses, '이번 주택을 포함한 세대의 주택 수', { optional: true, def: 1 })));
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    var std;
    if (p <= 60000) std = 0.01; else if (p <= 90000) std = Math.round((p / 30000 * 2 - 3) / 100 * 10000) / 10000; else std = 0.03;
    var rate, reason;
    if (input.isCorp) { rate = 0.12; reason = '법인의 주택 취득 중과(4% + 중과기준세율 2% × 4)'; }
    else if (input.adjusted && h >= 3 || !input.adjusted && h >= 4) { rate = 0.12; reason = (input.adjusted ? '조정대상지역 3주택 이상' : '조정대상지역 외 4주택 이상') + ' 중과(12%)'; }
    else if (input.adjusted && h === 2 && input.tempTwo) { rate = std; reason = '일시적 2주택(종전 주택을 기한 안에 처분) — 일반세율 적용(지방세법 시행령 제28조의5)'; }
    else if (input.adjusted && h === 2 || !input.adjusted && h === 3) { rate = 0.08; reason = (input.adjusted ? '조정대상지역 2주택' : '조정대상지역 외 3주택') + ' 중과(8%)'; }
    else { rate = std; reason = '유상거래 주택 표준세율(6억원 이하 1%, 9억원 초과 3%, 그 사이 계산식)'; }
    r.ratePct = Math.round(rate * 10000) / 100; r.reason = reason;
    r.tax = fl(p * MAN * rate);
    r.status = rate > 0.03 ? 'HEAVY' : 'NORMAL';
    r.basis.push('「지방세법」 제11조제1항제8호(주택 유상취득 1~3%, 6억~9억원은 (취득가액 × 2/3억원 − 3) × 1/100, 소수 넷째 자리까지), 제13조의2제1항(법인·다주택 중과: 4% + 중과기준세율 2%의 200% 또는 400%)');
    r.basis.push('「지방세법 시행령」 제28조의5(일시적 2주택: 신규 주택 취득 후 3년, 종전·신규 모두 조정대상지역이면 2년 안에 종전 주택 처분)');
    r.notes.push('취득세 본세만 계산했습니다. 지방교육세, 농어촌특별세(전용 85㎡ 초과 등)가 별도로 붙습니다. 주택 수에는 조합원입주권·분양권·주거용 오피스텔도 들어갈 수 있고, 시가표준액 1억원 이하 주택 등은 빠질 수 있습니다(시행령). 생애최초 주택 감면은 반영하지 않았습니다.');
    if (input.tempTwo) r.notes.push('일시적 2주택으로 일반세율을 적용했습니다. 기한 안에 종전 주택을 처분하지 않으면 중과세율과의 차액이 추징됩니다.');
    return r;
  }

  var api = { pensionCredit: pensionCredit, yearEndTax: yearEndTax, freelancerTax: freelancerTax, foreignStockTax: foreignStockTax, homeSaleTax: homeSaleTax, acquisitionTax: acquisitionTax, VERSION: VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PersonalTaxRules = api;
})(this);
