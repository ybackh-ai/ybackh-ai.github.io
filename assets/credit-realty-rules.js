/*
 * 세액공제·감면 5종 + 부동산·대출 5종 (순수 함수, 브라우저·Node 공용). 근거: docs/65 (2026-11-26 법제처 원문 확인)
 *  rentCredit 월세 세액공제 / specialCredits 의료비·교육비·기부금 / smeSpecialRelief 중소기업 특별세액감면
 *  refundClaim 경정청구 환급 / carryforward 세액공제 이월·최저한세
 *  giftVsSale 부동산 증여 vs 매매(베타) / ltvLimit LTV·DSR 대출 한도(베타) / prepaymentFee 중도상환수수료·갈아타기
 *  rentalYield 임대수익률 / subscriptionScore 청약 가점
 * 금액 입력 만원, 결과 원. 브라우저에서는 tax-credit-rules.js, inherit-gift-rules.js, personal-tax-rules.js(tax-tools-rules.js 먼저), finance-rules.js 뒤에 로드.
 */
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;
  function dep(file, name) { return node ? require('./' + file) : root[name]; }
  var TC = dep('tax-credit-rules.js', 'TaxCreditRules'), IG = dep('inherit-gift-rules.js', 'InheritGiftRules');
  var PT = dep('personal-tax-rules.js', 'PersonalTaxRules'), FR = dep('finance-rules.js', 'FinanceRules');
  var VERSION = '2026-11-26';
  var MAN = 10000, EOK = 100000000;
  function blank(v) { return v === undefined || v === null || v === ''; }
  function fl(x) { return Math.floor(x + 1e-6); }
  function r2(x) { return Math.round(x * 100) / 100; }
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
  function bad(r) { if (r.errors.length) { r.status = 'INVALID'; return true; } return false; }

  // 1. 월세 세액공제 — 조특법 §95의2①: 총급여 8천만 이하(종합소득금액 7천만 초과 제외) 15%, 5,500만 이하(4,500만 초과 제외) 17%, 월세 1천만원 한도
  function rentCredit(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var g = num(input.salary, '총급여', { positive: true });
    var inc = blank(input.income) ? null : num(input.income, '종합소득금액');
    var m = num(input.monthly, '월세(월)', { positive: true });
    var months = Math.min(12, Math.floor(num(input.months, '낸 개월 수', { optional: true, def: 12 }) || 12));
    if (bad(r)) return r;
    r.eligible = g <= 8000 && (inc === null || inc <= 7000);
    r.ratePct = g <= 5500 && (inc === null || inc <= 4500) ? 17 : 15;
    r.paid = m * months * MAN;
    r.base = Math.min(r.paid, 1000 * MAN);
    r.credit = r.eligible ? fl(r.base * r.ratePct / 100) : 0;
    r.localTax = fl(r.credit * 0.1);
    r.status = r.eligible ? 'OK' : 'NOT_ELIGIBLE';
    r.basis.push('「조세특례제한법」 제95조의2제1항(총급여 8천만원 이하·종합소득금액 7천만원 이하 15%, 총급여 5,500만원 이하·종합소득금액 4,500만원 이하 17%, 월세 연 1천만원 한도), 제2항(2026년 지급분부터 요건을 갖춘 배우자 추가 공제, 합계 1천만원 한도)');
    r.notes.push('과세기간 종료일(12월 31일) 현재 무주택 세대의 세대주(세대주가 공제받지 않으면 세대원)이고, 국민주택규모(85㎡) 이하이거나 기준시가 4억원 이하인 주택(오피스텔·고시원 포함, 기본공제 자녀·손자녀 3명 이상이면 100㎡ 이하)이어야 합니다. 임대차계약서 주소와 주민등록 주소가 같아야 합니다(조특법 시행령 제95조제1항·제2항).');
    r.notes.push('세액공제는 결정세액을 넘을 수 없습니다. 실제 환급액은 다른 공제와 함께 <a href="year-end-tax.html">연말정산 미리보기</a>로 확인해 보세요.');
    return r;
  }

  // 2. 의료비·교육비·기부금 — 소득세법 §59의4②③④, 고향사랑 조특법 §58, 정치자금 §76
  function specialCredits(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var g = num(input.salary, '총급여', { positive: true }) * MAN;
    function o(k, l) { return num(input[k], l, { optional: true }) * MAN; }
    var gen = o('medical', '일반 의료비'), self = o('medicalSelf', '본인·6세 이하·65세 이상·장애인 의료비'), pre = o('preemie', '미숙아·선천성이상아 의료비'), ivf = o('ivf', '난임시술비');
    var eSelf = o('eduSelf', '본인 교육비'), eUni = o('eduUni', '대학생 교육비'), eSch = o('eduSchool', '취학 전·초중고 교육비'), eDis = o('eduDisabled', '장애인 특수교육비');
    var uniN = Math.max(1, Math.floor(num(input.uniCount, '대학생 수', { optional: true, def: 1 }) || 1));
    var schN = Math.max(1, Math.floor(num(input.schoolCount, '취학 전·초중고 자녀 수', { optional: true, def: 1 }) || 1));
    var don = o('donation', '기부금'), home = o('hometown', '고향사랑 기부금'), pol = o('political', '정치자금 기부금');
    if (bad(r)) return r;
    // 의료비: 총급여 3% 문턱을 일반 → 본인 등 → 미숙아 → 난임 순서로 뺌(§59의4② 각 호 단서)
    var thr = g * 0.03;
    var genEx = Math.min(Math.max(0, gen - thr), 700 * MAN), rem = Math.max(0, thr - gen);
    var selfEx = Math.max(0, self - rem); rem = Math.max(0, rem - self);
    var preEx = Math.max(0, pre - rem); rem = Math.max(0, rem - pre);
    var ivfEx = Math.max(0, ivf - rem);
    r.threshold = fl(thr);
    r.medicalCredit = fl((genEx + selfEx) * 0.15) + fl(preEx * 0.2) + fl(ivfEx * 0.3);
    r.educationCredit = fl((eSelf + Math.min(eUni, 900 * MAN * uniN) + Math.min(eSch, 300 * MAN * schN) + eDis) * 0.15);
    r.donationCredit = fl(Math.min(don, 1000 * MAN) * 0.15 + Math.max(0, don - 1000 * MAN) * 0.3);
    var h = Math.min(home, 2000 * MAN);
    r.hometownCredit = fl(Math.min(h, 10 * MAN) * 100 / 110) + fl(Math.min(Math.max(0, h - 10 * MAN), 10 * MAN) * 0.4) + fl(Math.max(0, h - 20 * MAN) * 0.15);
    r.politicalCredit = fl(Math.min(pol, 10 * MAN) * 100 / 110) + fl(Math.min(Math.max(0, pol - 10 * MAN), 3000 * MAN) * 0.15) + fl(Math.max(0, pol - 3010 * MAN) * 0.25);
    r.total = r.medicalCredit + r.educationCredit + r.donationCredit + r.hometownCredit + r.politicalCredit;
    r.status = 'OK';
    r.basis.push('「소득세법」 제59조의4제2항(의료비: 총급여 3% 초과분 15%, 일반 의료비 연 700만원 한도, 본인·6세 이하·65세 이상·장애인·중증질환자 한도 없음, 미숙아·선천성이상아 20%, 난임시술 30%), 제3항(교육비 15%: 대학생 1명당 900만원, 취학 전·초중고 1명당 300만원, 본인·장애인 특수교육비 한도 없음), 제4항(기부금 15%, 1천만원 초과분 30%)');
    r.basis.push('「조세특례제한법」 제58조(고향사랑 기부금: 10만원까지 100/110, 20만원까지 40%, 2천만원까지 15%), 제76조(정치자금: 10만원까지 100/110, 초과분 15%, 3천만원 초과분 25%)');
    r.notes.push('세액공제 합계는 산출세액을 넘을 수 없고, 특별세액공제를 받지 않으면 표준세액공제 13만원이 적용됩니다. 기부금은 소득금액의 30%(종교단체 10%) 등 한도가 있어 큰 금액이면 줄어들 수 있습니다.');
    r.notes.push('고향사랑·정치자금의 10만원 이하 100/110은 지방소득세 공제 10%와 합쳐 기부금 전액이 돌아오도록 만든 비율입니다. 실손보험금으로 받은 의료비는 빼고 넣으세요.');
    return r;
  }

  // 3. 중소기업 특별세액감면 — 조특법 §7① 감면 비율·한도, ② 110%
  function smeSpecialRelief(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var tax = num(input.tax, '감면 대상 사업장 소득에 대한 산출세액', { positive: true });
    var drop = Math.floor(num(input.empDrop, '상시근로자 감소 인원', { optional: true }));
    if (bad(r)) return r;
    var small = input.size !== 'medium', metro = input.region === 'metro', ind = input.industry || 'general';
    var rate = 0;
    if (ind === 'none') rate = 0;
    else if (small) rate = ind === 'retail' ? 10 : metro ? 20 : 30;
    else if (ind === 'retail') rate = metro ? 0 : 5;
    else if (metro) rate = ind === 'publish' ? 10 : 0;
    else rate = 15;
    if (input.long10 && rate > 0) rate = Math.round(rate * 1.1 * 100) / 100;
    r.ratePct = rate;
    r.limit = Math.max(0, EOK - drop * 500 * MAN);
    var raw = fl(tax * MAN * rate / 100);
    r.capped = raw > r.limit;
    r.relief = Math.min(raw, r.limit);
    r.eligible = r.relief > 0;
    r.status = r.eligible ? 'OK' : 'NOT_ELIGIBLE';
    r.basis.push('「조세특례제한법」 제7조제1항제2호(소기업 도소매·의료업 10%, 소기업 수도권 20%·그 밖 지역 30%, 중기업 수도권 밖 도소매·의료업 5%, 중기업 수도권 출판업 10%, 중기업 수도권 밖 15%), 제3호(한도 1억원, 상시근로자 감소 1명당 500만원 차감), 제2항(10년 이상 계속 경영·종합소득금액 1억원 이하·성실사업자 요건이면 감면 비율 × 110%), 2028년 12월 31일 이전 끝나는 과세연도까지');
    r.notes.push('본점이 수도권에 있는 법인은 모든 사업장을 수도권으로 봅니다. 소기업은 「중소기업기본법 시행령」 제8조의 업종별 매출액 기준(10억~120억원)으로 판단합니다. 감면 업종이 아닌 소득은 산출세액에서 빼고 넣으세요.');
    r.notes.push('최저한세 적용 대상이고, 통합투자세액공제·고용 관련 공제 등과 같은 과세연도에 함께 받을 수 없는 경우가 있습니다(조특법 제127조·제132조). 감면을 받으려면 신고할 때 감면신청서를 내야 합니다.');
    return r;
  }

  // 4. 경정청구 환급 — 국세기본법 §45의2①: 법정신고기한(원천징수는 납부기한)이 지난 후 5년 이내
  var DUE = { corp: ['03', '31'], indiv: ['05', '31'], wage: ['03', '10'] };
  function refundClaim(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var kind = DUE[input.kind] ? input.kind : 'corp';
    var today = /^\d{4}-\d{2}-\d{2}$/.test(input.today || '') ? input.today : new Date().toISOString().slice(0, 10);
    var ty = Number(today.slice(0, 4)), rows = [];
    for (var y = ty - 7; y <= ty; y++) {
      if (blank(input['y' + y])) continue;
      var a = num(input['y' + y], y + '년 귀속 놓친 공제·감면액');
      if (a > 0) rows.push({ year: y, amount: a * MAN });
    }
    if (!rows.length && !r.errors.length) r.errors.push('놓친 공제·감면액을 한 해 이상 입력해 주세요.');
    if (bad(r)) return r;
    r.rows = rows.map(function (x) {
      var d = (x.year + 6) + '-' + DUE[kind][0] + '-' + DUE[kind][1];
      return { year: x.year, amount: x.amount, deadline: d, ok: today <= d, local: fl(x.amount * 0.1) };
    });
    var ok = r.rows.filter(function (x) { return x.ok; });
    r.claimableCount = ok.length;
    r.national = ok.reduce(function (s, x) { return s + x.amount; }, 0);
    r.local = ok.reduce(function (s, x) { return s + x.local; }, 0);
    r.total = r.national + r.local;
    r.firstDeadline = ok.length ? ok.map(function (x) { return x.deadline; }).sort()[0] : null;
    r.status = ok.length ? 'OK' : 'NOT_ELIGIBLE';
    r.basis.push('「국세기본법」 제45조의2제1항제2호(신고한 세액공제액이 세법에 따라 신고해야 할 금액에 미치지 못할 때, 법정신고기한이 지난 후 5년 이내 경정청구), 제5항(연말정산 근로소득은 원천징수세액 납부기한 다음 날부터 5년), 제3항(청구 후 2개월 이내 결과 통지)');
    r.notes.push('기한은 12월 결산 법인(3월 31일 신고), 개인 종합소득세(5월 31일, 성실신고확인 대상은 6월 30일), 연말정산 근로자(다음 해 3월 10일 납부) 기준입니다. 결산월이 다르거나 성실신고확인 대상이면 기한이 늦어질 수 있습니다.');
    r.notes.push('지방소득세(10%)는 지방자치단체에 따로 경정청구합니다. 환급금에는 국세환급가산금(국세기본법 제52조)이 더해질 수 있고, 최저한세·이월공제 때문에 실제 환급액은 달라질 수 있습니다.');
    return r;
  }

  // 5. 세액공제 이월·최저한세 — 조특법 §132(최저한세), §144(10년 이월, 이월분 먼저 공제)
  function carryforward(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var tb = num(input.taxBase, '과세표준', { positive: true }) * MAN;
    var ct = num(input.calcTax, '산출세액', { positive: true }) * MAN;
    function o(k, l) { return num(input[k], l, { optional: true }) * MAN; }
    var relief = o('relief', '최저한세 대상 세액감면'), carried = o('carried', '이월된 미공제 세액공제'), credit = o('credit', '당기 최저한세 대상 세액공제'), other = o('other', '최저한세 적용 제외 세액공제');
    if (bad(r)) return r;
    r.minTax = TC.minimumTax(tb, !!input.sme, '');
    var room = Math.max(0, ct - r.minTax);
    // 최저한세에 걸리면 세액공제를 먼저 배제(감면은 이월되지 않으므로 감면부터 적용), 공제 중에서는 이월분을 먼저 공제
    r.usedRelief = Math.min(relief, room); room -= r.usedRelief;
    r.usedCarried = Math.min(carried, room); room -= r.usedCarried;
    r.usedCredit = Math.min(credit, room);
    r.lostRelief = relief - r.usedRelief;
    r.carryOver = (carried - r.usedCarried) + (credit - r.usedCredit);
    var left = ct - r.usedRelief - r.usedCarried - r.usedCredit;
    r.usedOther = Math.min(other, left);
    r.payable = left - r.usedOther;
    r.status = r.carryOver > 0 || r.lostRelief > 0 ? 'LIMITED' : 'OK';
    r.basis.push('「조세특례제한법」 제132조제1항(법인 최저한세: 중소기업 과세표준의 7%, 일반 100억원 이하 10%·1천억원 이하 12%·초과 17%), 제144조제1항(최저한세에 미달해 공제받지 못한 세액공제는 다음 과세연도 개시일부터 10년 이내 이월공제), 제2항(이월된 미공제액을 먼저, 먼저 발생한 것부터 공제)');
    r.notes.push('최저한세 때문에 줄일 항목의 순서는 법인세법 시행령 등에 따르며, 이 계산기는 세액공제를 먼저 배제하고 세액감면은 남기는 일반적인 순서로 계산했습니다. 감면은 이월되지 않습니다. 중소기업 졸업 유예(8%·9%)와 개인사업자 최저한세(35%·45%)는 반영하지 않았습니다.');
    return r;
  }

  // 6. 부동산 증여 vs 매매 (베타) — 증여세(IG), 저가양수 증여의제 상증법 §35·시행령 §26, 양도 부당행위 소득세법 시행령 §167③, 취득세 지방세법 §11①2·§13의2②·시행령 §28의6·§18의2
  function giftVsSale(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var p = num(input.price, '시가', { positive: true });
    var sp = blank(input.salePrice) ? p : num(input.salePrice, '가족 간 매매 가격', { positive: true });
    var std = blank(input.stdPrice) ? p : num(input.stdPrice, '시가표준액(공시가격)');
    var gain = num(input.parentGain, '부모 양도소득세 예상액', { optional: true }) * MAN;
    var houses = Math.max(1, Math.floor(num(input.buyerHouses, '자녀 주택 수', { optional: true, def: 1 }) || 1));
    var rel = input.relation || 'asc_adult';
    if (bad(r)) return r;
    var g = IG.calculate({ type: 'gift', relation: rel, amount: p });
    if (g.status === 'INVALID') { r.errors = g.errors; r.status = 'INVALID'; return r; }
    r.giftTax = g.payable;
    r.giftHeavy = !!input.adjusted && std >= 30000 && !input.giverOneHouse;
    r.giftAcqRate = r.giftHeavy ? 12 : 3.5;
    r.giftAcq = fl(p * MAN * r.giftAcqRate / 100);
    r.giftTotal = r.giftTax + r.giftAcq;
    var diff = Math.max(0, p - sp) * MAN;
    r.unfair = diff > 0 && (diff >= 3 * EOK || diff >= p * MAN * 0.05);
    r.deemedGift = Math.max(0, diff - Math.min(p * MAN * 0.3, 3 * EOK));
    r.deemedGiftTax = 0;
    if (r.deemedGift > 0) r.deemedGiftTax = IG.calculate({ type: 'gift', relation: rel, amount: Math.round(r.deemedGift / MAN) }).payable;
    var acq = PT.acquisitionTax({ price: r.unfair ? p : sp, houses: houses, adjusted: !!input.adjusted });
    r.saleAcq = acq.tax; r.saleAcqRate = acq.ratePct;
    r.parentGain = gain;
    r.saleTotal = r.deemedGiftTax + r.saleAcq + gain;
    r.cheaper = r.saleTotal < r.giftTotal ? 'sale' : 'gift';
    r.status = 'OK';
    r.basis.push('증여세: 「상속세 및 증여세법」 제53조(증여재산공제)·제56조(세율)·제69조(신고세액공제 3%). 저가 양수: 제35조제1항, 시행령 제26조제2항(시가와 대가의 차액에서 시가 30%와 3억원 중 적은 금액을 뺀 금액이 증여재산)');
    r.basis.push('양도소득세 부당행위: 「소득세법」 제101조, 시행령 제167조제3항(특수관계인에게 시가보다 낮게 양도하고 차액이 3억원 이상이거나 시가의 5% 이상이면 시가로 양도한 것으로 계산)');
    r.basis.push('취득세: 「지방세법」 제11조제1항제2호(무상취득 3.5%), 제13조의2제2항·시행령 제28조의6(조정대상지역 시가표준액 3억원 이상 주택 증여 12%, 1세대 1주택자가 배우자·직계존비속에게 증여하면 제외), 제10조의3·시행령 제18조의2(특수관계인 저가 취득 차액이 3억원 이상이거나 시가 5% 이상이면 시가인정액이 과세표준), 제11조제1항제8호(유상 주택 1~3%)');
    r.notes.push('베타: 부모의 양도소득세는 이 계산기에서 계산하지 않습니다. <a href="home-sale-tax.html">1주택 양도세 계산기</a>로 구한 금액을 넣으세요(부당행위면 시가로 계산). 취득세 본세만 비교했고 지방교육세·농어촌특별세, 10년 내 다른 증여 합산, 자녀의 매매 자금 출처, 부담부증여는 반영하지 않았습니다.');
    r.notes.push('가족 간 매매는 실제로 대금을 주고받아야 하며, 그렇지 않으면 전체가 증여로 볼 수 있습니다. 시가는 감정가·유사 매매가 등 상증법 평가액입니다.');
    return r;
  }

  // 7. LTV + DSR 대출 한도 (베타) — LTV 비율·상한은 이용자 입력, DSR은 finance-rules dsrLimit
  function ltvLimit(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var p = num(input.price, '주택 시세', { positive: true });
    var ltv = num(input.ltv, 'LTV 비율', { positive: true });
    var ded = num(input.deduct, '선순위·소액임차보증금 차감', { optional: true });
    var cap = num(input.cap, '대출 금액 상한', { optional: true });
    if (ltv > 100) r.errors.push('LTV 비율은 100% 이하로 입력해 주세요.');
    if (bad(r)) return r;
    var d = FR.dsrLimit({ income: input.income, existing: input.existing, rate: input.rate, stress: input.stress, years: input.years, limit: input.limit });
    if (d.status === 'INVALID') { r.errors = d.errors; r.status = 'INVALID'; return r; }
    r.ltvLoan = Math.max(0, fl((p * ltv / 100 - ded) * MAN));
    r.dsrLoan = d.maxLoan;
    var c = cap > 0 ? cap * MAN : Infinity;
    r.maxLoan = Math.min(r.ltvLoan, r.dsrLoan, c);
    r.binding = r.maxLoan === c && c < Math.min(r.ltvLoan, r.dsrLoan) ? 'cap' : r.dsrLoan < r.ltvLoan ? 'dsr' : 'ltv';
    r.dsrLimitPct = d.limit; r.calcRate = d.calcRate;
    r.status = 'OK';
    r.basis.push('LTV(담보인정비율) = 대출 금액 ÷ 주택 가격, DSR(총부채원리금상환비율) = 모든 대출의 연 원리금 ÷ 연 소득. 실제 한도는 LTV 한도, DSR 한도, 금액 상한 중 가장 작은 금액');
    r.notes.push('베타: LTV 비율(지역·주택 수·생애최초 여부에 따라 다름), 주택담보대출 금액 상한, 스트레스 금리, 방공제(소액임차보증금) 금액은 금융위원회·금융감독원 규정과 은행 정책에 따라 자주 바뀝니다. 이 계산기는 입력한 기준으로만 계산하니 대출 전에 은행에 확인하세요.');
    return r;
  }

  // 8. 중도상환수수료·갈아타기 — 일반 산식(잔여기간 비례, 면제기간 기본 3년)
  function annuity(i, n) { return i === 0 ? 1 / n : i / (1 - Math.pow(1 + i, -n)); }
  function prepaymentFee(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var amt = num(input.amount, '상환할 금액', { positive: true }) * MAN;
    var rate = num(input.feeRate, '중도상환수수료율', {});
    var el = num(input.elapsed, '대출 후 지난 개월 수', {});
    var per = num(input.period, '수수료 부과 기간(개월)', { optional: true, def: 36 }) || 36;
    var rem = num(input.remaining, '남은 대출 기간(개월)', { optional: true });
    var oldR = num(input.oldRate, '지금 금리', { optional: true }), newR = num(input.newRate, '갈아탈 금리', { optional: true });
    var extra = num(input.extra, '갈아타기 부대비용', { optional: true }) * MAN;
    if (bad(r)) return r;
    r.left = Math.max(0, per - el);
    r.fee = fl(amt * rate / 100 * r.left / per);
    if (rem > 0) {
      var n = Math.round(rem);
      var oi = annuity(oldR / 1200, n) * amt * n - amt, ni = annuity(newR / 1200, n) * amt * n - amt;
      r.oldInterest = Math.round(oi); r.newInterest = Math.round(ni);
      r.saving = r.oldInterest - r.newInterest;
      r.net = r.saving - r.fee - extra;
      r.worth = r.net > 0;
    }
    r.status = 'OK';
    r.basis.push('중도상환수수료 = 상환 금액 × 수수료율 × (부과 기간 − 지난 기간) ÷ 부과 기간(일반적인 은행 약정 방식, 보통 3년). 이자는 원리금균등 상환으로 남은 기간 동안 비교');
    r.notes.push('수수료율·부과 기간·면제 조건은 금융회사와 대출 시기마다 달라 대출 약정서를 확인하세요. 인지세·감정료 등 갈아타기 비용은 부대비용 칸에 넣으세요.');
    return r;
  }

  // 9. 임대수익률 — 일반 산식
  function rentalYield(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var p = num(input.price, '매입가', { positive: true }) * MAN;
    var dep = num(input.deposit, '보증금', { optional: true }) * MAN, mon = num(input.monthly, '월세', { optional: true }) * MAN;
    var costs = num(input.costs, '취득 부대비용', { optional: true }) * MAN, exp = num(input.expense, '연간 보유 비용', { optional: true }) * MAN;
    var loan = num(input.loan, '대출금', { optional: true }) * MAN, lr = num(input.loanRate, '대출 금리', { optional: true });
    if (bad(r)) return r;
    r.annualRent = mon * 12;
    r.interest = fl(loan * lr / 100);
    r.annualNet = r.annualRent - exp - r.interest;
    r.equity = p + costs - dep - loan;
    if (r.equity <= 0) { r.errors.push('보증금과 대출금이 매입가와 부대비용보다 커서 실투자금이 0 이하입니다. 숫자를 확인해 주세요.'); r.status = 'INVALID'; return r; }
    r.grossPct = r2(r.annualRent / p * 100);
    r.netPct = r2(r.annualNet / r.equity * 100);
    r.status = 'OK';
    r.basis.push('표면 수익률 = 연 월세 ÷ 매입가, 실투자 수익률 = (연 월세 − 연간 보유 비용 − 대출 이자) ÷ (매입가 + 부대비용 − 보증금 − 대출금). 법령이 아닌 일반 산식');
    r.notes.push('세금(임대소득세·재산세·종부세)과 공실, 보증금 운용 수익, 시세 변동은 반영하지 않았습니다. 연간 보유 비용에 재산세·관리비·수선비를 넣으면 더 정확합니다. 취득세는 <a href="acquisition-tax.html">취득세 계산기</a>로 구해 부대비용에 넣으세요.');
    return r;
  }

  // 10. 청약 가점 — 주택공급에 관한 규칙 별표 1 (2026-11-24 개정본)
  function accScore(y) { return y < 0.5 ? 1 : y < 1 ? 2 : Math.min(17, 2 + Math.floor(y)); }
  function subscriptionScore(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var own = !!input.ownsHouse;
    if (!own && blank(input.noHouseYears)) r.errors.push('무주택 기간을 입력하거나 주택 소유를 선택해 주세요.');
    var nh = own ? 0 : num(input.noHouseYears, '무주택 기간(년)', { optional: true });
    var dp = Math.floor(num(input.dependents, '부양가족 수', { optional: true }));
    var ac = num(input.accountYears, '청약통장 가입 기간(년)', { optional: true });
    var sp = num(input.spouseAccountYears, '배우자 청약통장 가입 기간(년)', { optional: true });
    if (bad(r)) return r;
    r.noHouse = own ? 0 : nh < 1 ? 2 : Math.min(32, 2 + 2 * Math.floor(nh));
    r.family = Math.min(35, 5 + 5 * dp);
    r.spouseBonus = sp > 0 ? Math.min(3, accScore(sp / 2)) : 0;
    r.account = Math.min(17, accScore(ac) + r.spouseBonus);
    r.total = r.noHouse + r.family + r.account;
    r.status = 'OK';
    r.basis.push('「주택공급에 관한 규칙」 제2조제8호·별표 1(무주택기간 최대 32점: 1년 미만 2점부터 1년마다 2점, 부양가족 최대 35점: 0명 5점부터 1명마다 5점, 청약통장 최대 17점: 6개월 미만 1점·1년 미만 2점·1년 이상 1년마다 1점, 배우자 통장 기간의 50%로 최대 3점 합산)');
    r.notes.push('무주택 기간은 만 30세가 된 날(그 전에 혼인했으면 혼인신고일)부터 신청자와 배우자 모두 무주택인 기간입니다. 주택을 가진 세대는 가점제에서 빠지고 추첨제 대상입니다. 직계존속은 3년 이상 같은 주민등록표에 올라 있어야 부양가족으로 봅니다.');
    return r;
  }

  var api = { rentCredit: rentCredit, specialCredits: specialCredits, smeSpecialRelief: smeSpecialRelief, refundClaim: refundClaim, carryforward: carryforward,
    giftVsSale: giftVsSale, ltvLimit: ltvLimit, prepaymentFee: prepaymentFee, rentalYield: rentalYield, subscriptionScore: subscriptionScore, VERSION: VERSION };
  if (node) module.exports = api;
  else root.CreditRealtyRules = api;
})(this);
