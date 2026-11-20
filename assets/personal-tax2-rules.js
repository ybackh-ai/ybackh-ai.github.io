/*
 * 개인 세금 추가 6종 (순수 함수, 브라우저·Node 공용). 근거: docs/62 (법령 원문 2026-11-20 확인)
 *  depositInterest 예·적금 이자 세후 / isaTax ISA 비과세·분리과세 / financialIncome 금융소득 종합과세
 *  rentalIncomeTax 주택임대소득 분리과세(베타) / propertyTax 종합부동산세(베타) / workIncentive 근로·자녀장려금(베타)
 * 세율표는 tax-tools-rules.js(window.TaxTools). 금액 입력 만원, 결과 원. 지방소득세는 소득세의 10%.
 */
(function (root) {
  'use strict';
  var TT = (typeof module !== 'undefined' && module.exports) ? require('./tax-tools-rules.js') : root.TaxTools;
  var VERSION = '2026-11-20';
  var MAN = 10000;
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
  function prog(table, x) { // [[상한, 누적세액, 세율]]
    var prev = 0, acc = 0;
    for (var i = 0; i < table.length; i++) {
      var t = table[i];
      if (x <= t[0]) return acc + (x - prev) * t[1];
      acc += (t[0] - prev) * t[1]; prev = t[0];
    }
    return acc;
  }

  // 1. 예·적금 이자 세후 (소득세법 제129조제1항제1호라목 14%, 조특법 제88조의2 비과세종합저축)
  function depositInterest(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var savings = input.type === 'savings';
    var p = num(input.principal, savings ? '월 납입액' : '예치 원금', { positive: true });
    var rate = num(input.rate, '연 이율', { positive: true });
    var m = num(input.months, '기간(개월)', { positive: true });
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    var P = p * MAN, i = rate / 100;
    var interest;
    if (savings) { interest = P * i / 12 * m * (m + 1) / 2; r.principalTotal = Math.round(P * m); }
    else if (input.compound === 'monthly') { interest = P * (Math.pow(1 + i / 12, m) - 1); r.principalTotal = Math.round(P); }
    else { interest = P * i * m / 12; r.principalTotal = Math.round(P); }
    r.interest = fl(interest);
    r.exempt = input.taxType === 'exempt';
    r.tax = r.exempt ? 0 : fl(r.interest * 0.14);
    r.localTax = fl(r.tax * 0.1);
    r.net = r.interest - r.tax - r.localTax;
    r.maturity = r.principalTotal + r.net;
    r.effectiveRate = Math.round(rate * (r.interest ? r.net / r.interest : 0) * 1000) / 1000;
    r.status = 'OK';
    r.basis.push('「소득세법」 제129조제1항제1호라목: 이자소득 원천징수세율 14%(지방소득세 1.4%를 더해 15.4%)');
    if (r.exempt) r.basis.push('「조세특례제한법」 제88조의2: 비과세종합저축(65세 이상 기초연금 수급자·장애인 등, 1명당 원금 5천만원, 2028년 12월 31일까지 가입) 이자 비과세, 「농어촌특별세법」 제4조제4호: 농어촌특별세도 비과세');
    r.notes.push('금융회사마다 이자 계산 일수(일 단위·월 단위)와 원 단위 끝수 처리가 달라 실제 지급액과 몇 원~몇십 원 차이가 날 수 있습니다.');
    r.notes.push('이자·배당이 1년에 2천만원을 넘으면 금융소득 종합과세 대상이 될 수 있습니다.');
    return r;
  }

  // 2. ISA (조특법 제91조의18)
  function isaTax(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var profit = num(input.profit, '만기 때 순이익(이자·배당 − 손실)', {});
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    r.limit = input.kind === 'low' ? 4000000 : 2000000;
    var P = Math.round(profit * MAN);
    r.profit = P;
    r.taxable = Math.max(0, P - r.limit);
    r.tax = fl(r.taxable * 0.09);
    r.localTax = fl(r.tax * 0.1);
    r.total = r.tax + r.localTax;
    r.normalTax = fl(P * 0.14);
    r.normalTotal = r.normalTax + fl(r.normalTax * 0.1);
    r.saving = Math.max(0, r.normalTotal - r.total);
    r.status = 'OK';
    r.basis.push('「조세특례제한법」 제91조의18제1항(비과세 한도 초과분 9% 분리과세, 종합과세 제외)·제2항(비과세 한도: 직전 연도 총급여 5천만원 또는 종합소득 3,800만원 이하 400만원, 그 밖 200만원)·제3항(의무 가입 3년, 연 2천만원·총 1억원 납입 한도)');
    r.basis.push('「농어촌특별세법」 제4조제4호: ISA 감면분 농어촌특별세 비과세');
    r.notes.push('일반 계좌와의 비교는 순이익 전부가 이자·배당소득으로 14% 원천징수된다고 가정했습니다. 국내 상장주식 매매차익처럼 원래 과세되지 않는 이익이 섞여 있으면 절세 효과가 이보다 작습니다.');
    r.notes.push('가입 후 3년 전에 해지하면 감면받은 세금을 추징합니다(사망·해외이주 등 부득이한 사유 제외).');
    return r;
  }

  // 3. 금융소득 종합과세 (소득세법 제14조제3항제6호, 제17조제3항, 제56조, 제62조)
  function financialIncome(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var it = num(input.interest, '이자소득', { optional: true });
    var dg = num(input.dividendGU, 'Gross-up 대상 배당', { optional: true });
    var dn = num(input.dividendOther, '그 밖의 배당', { optional: true });
    var ob = num(input.otherBase, '다른 종합소득 과세표준', { optional: true });
    if (!r.errors.length && it + dg + dn <= 0) r.errors.push('이자 또는 배당 금액을 입력해 주세요.');
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    var I = Math.round(it * MAN), DG = Math.round(dg * MAN), DN = Math.round(dn * MAN), OB = Math.round(ob * MAN);
    var F = I + DG + DN, TH = 20000000;
    r.financial = F;
    r.withheld = fl(F * 0.14);
    r.guRate = Number(input.payYear) >= 2027 ? 11 : 10;
    if (F <= TH) {
      r.status = 'SEPARATE';
      r.grossUp = 0; r.extra = 0; r.localExtra = 0;
    } else {
      r.status = 'COMBINED';
      r.grossUp = fl(Math.min(DG, F - TH) * r.guRate / 100);
      r.generalTax = TT.incomeTax(OB + F + r.grossUp - TH) + fl(TH * 0.14);
      r.compareTax = TT.incomeTax(OB) + fl(F * 0.14);
      r.dividendCredit = Math.max(0, Math.min(r.grossUp, r.generalTax - r.compareTax));
      r.finalTax = Math.max(r.generalTax - r.grossUp, r.compareTax);
      r.extra = Math.max(0, r.finalTax - r.compareTax);
      r.localExtra = fl(r.extra * 0.1);
    }
    r.basis.push('「소득세법」 제14조제3항제6호: 원천징수된 이자·배당 합계 2천만원 이하이면 분리과세(14%)로 끝');
    r.basis.push('「소득세법」 제62조: 종합과세 시 (과세표준 − 2천만원) × 기본세율 + 2천만원 × 14%와 (과세표준 − 금융소득) × 기본세율 + 금융소득 × 14% 중 큰 금액');
    r.basis.push('「소득세법」 제17조제3항·제56조: 2천만원을 넘는 Gross-up 대상 배당에 가산율(2026년 지급분 10%, 2027년부터 11% — 부칙 법률 제21221호 제14조)을 더하고 같은 금액을 배당세액공제');
    r.notes.push('2천만원은 이자 → Gross-up 대상이 아닌 배당 → Gross-up 대상 배당 순서로 채운다고 보고 계산했습니다. 다른 종합소득 과세표준은 근로·사업소득 등에서 소득공제를 뺀 금액을 넣습니다.');
    r.notes.push('추가 납부액은 이미 원천징수된 14%를 뺀 금액이며, 세액공제·감면은 반영하지 않았습니다.');
    return r;
  }

  // 4. 주택임대소득 분리과세 (소득세법 제12조제2호나목, 제14조제3항제7호, 제64조의2) — 베타
  function rentalIncomeTax(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var rev = num(input.revenue, '연 주택임대 수입금액', {});
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    var R = Math.round(rev * MAN);
    r.revenue = R;
    r.basis.push('「소득세법」 제12조제2호나목: 1주택 소유자의 주택임대소득 비과세(기준시가 12억원 초과·국외 주택 제외)');
    r.basis.push('「소득세법」 제14조제3항제7호·제64조의2: 수입 2천만원 이하는 분리과세 선택 가능, 필요경비 50%(등록임대 60%), 다른 종합소득금액 2천만원 이하이면 200만원(등록임대 400만원) 추가 공제, 세율 14%');
    if (String(input.houses) === '1' && !input.over12) {
      r.status = 'EXEMPT'; r.tax = 0; r.localTax = 0; r.total = 0;
      r.notes.push('1주택이면 보증금(간주임대료)도 과세하지 않습니다(「소득세법」 제25조제1항).');
      return r;
    }
    if (R > 20000000) {
      r.status = 'COMBINED';
      r.notes.push('수입금액이 2천만원을 넘으면 분리과세를 선택할 수 없고 다른 종합소득과 합산해 신고합니다. 장부 또는 경비율에 따라 세금이 달라져 이 계산기는 금액을 계산하지 않습니다.');
      return r;
    }
    var reg = !!input.registered;
    r.expenseRate = reg ? 60 : 50;
    r.deduction = input.otherLow ? (reg ? 4000000 : 2000000) : 0;
    r.income = Math.max(0, fl(R * (100 - r.expenseRate) / 100) - r.deduction);
    r.tax = fl(r.income * 0.14);
    r.localTax = fl(r.tax * 0.1);
    r.total = r.tax + r.localTax;
    r.status = 'SEPARATE';
    r.notes.push('등록임대주택의 세액 감면(「조세특례제한법」 제96조), 보증금 간주임대료 계산, 종합과세와의 비교는 반영하지 않았습니다(베타). 등록임대 공제를 받고 10년 안에 임대를 그만두면 차액을 추징합니다.');
    return r;
  }

  // 5. 종합부동산세(주택분) (종합부동산세법 제8조·제9조, 시행령 제2조의4·제4조의3) — 베타
  var JB_LOW = [[3e8, 0.005], [6e8, 0.007], [12e8, 0.01], [25e8, 0.013], [50e8, 0.015], [94e8, 0.02], [Infinity, 0.027]];
  var JB_HIGH = [[3e8, 0.005], [6e8, 0.007], [12e8, 0.01], [25e8, 0.02], [50e8, 0.03], [94e8, 0.04], [Infinity, 0.05]];
  var PROP = [[6e7, 0.001], [1.5e8, 0.0015], [3e8, 0.0025], [Infinity, 0.004]];
  function propertyTax(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var price = num(input.price, '주택 공시가격 합계', { positive: true });
    var paid = num(input.propertyTaxPaid, '주택분 재산세 부과액', { optional: true });
    var age = num(input.age, '나이', { optional: true });
    var hold = num(input.holdYears, '보유기간', { optional: true });
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    var P = Math.round(price * MAN);
    var one = !!input.oneHouse;
    r.deductionBase = one ? 12e8 : 9e8;
    r.taxBase = Math.max(0, fl((P - r.deductionBase) * 0.6));
    r.heavy = !one && String(input.houses) === '3';
    r.basis.push('「종합부동산세법」 제8조제1항(공시가격 합계 − 9억원, 1세대 1주택자 12억원) × 공정시장가액비율 60%(시행령 제2조의4제1항)');
    r.basis.push('「종합부동산세법」 제9조제1항(2주택 이하 0.5~2.7%, 3주택 이상 0.5~5.0%)·제3항(재산세 공제)·제5항~제8항(1세대 1주택 고령자 20~40%, 장기보유 20~50%, 합계 80% 한도), 「농어촌특별세법」 제5조제1항제8호(종부세의 20%)');
    if (r.taxBase <= 0) { r.status = 'NONE'; r.tax = 0; r.ruralTax = 0; r.total = 0; return r; }
    r.calcTax = fl(prog(r.heavy ? JB_HIGH : JB_LOW, r.taxBase));
    r.propertyCredit = 0;
    if (paid > 0) {
      var num1 = r.taxBase * 0.6 * 0.004, den = prog(PROP, P * 0.6);
      r.propertyCredit = Math.min(Math.round(paid * MAN), fl(paid * MAN * num1 / den));
    }
    var t = r.calcTax - r.propertyCredit;
    r.ageRate = one ? (age >= 70 ? 40 : age >= 65 ? 30 : age >= 60 ? 20 : 0) : 0;
    r.holdRate = one ? (hold >= 15 ? 50 : hold >= 10 ? 40 : hold >= 5 ? 20 : 0) : 0;
    r.creditRate = Math.min(80, r.ageRate + r.holdRate);
    r.seniorCredit = fl(t * r.creditRate / 100);
    r.tax = t - r.seniorCredit;
    r.ruralTax = fl(r.tax * 0.2);
    r.total = r.tax + r.ruralTax;
    r.status = 'TAX';
    r.notes.push('재산세 공제는 시행령 제4조의3 산식을 재산세 공정시장가액비율 60%·표준세율 0.4%로 단순화해 추정했습니다. 1세대 1주택 재산세 특례 비율, 세부담 상한(직전 연도 150%), 합산배제 주택, 주택 수 특례는 반영하지 않았습니다(베타).');
    return r;
  }

  // 6. 근로·자녀장려금 (조특법 제100조의3·제100조의5·제100조의7·제100조의28·제100조의29) — 베타
  function workIncentive(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var e = num(input.earned, '총급여액 등(근로·사업소득)', {});
    var tot = num(input.totalIncome, '연간 총소득', { optional: true, def: -1 });
    var asset = num(input.assets, '가구원 재산 합계', {});
    var kids = num(input.kids, '부양자녀 수', { optional: true });
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    var h = input.household === 'two' ? 'two' : input.household === 'one' ? 'one' : 'single';
    if (h === 'single') kids = 0;
    var E = Math.round(e * MAN), T = tot < 0 ? E : Math.round(tot * MAN), A = Math.round(asset * MAN);
    r.household = h;
    var lim = { single: 22e6, one: 32e6, two: 44e6 }[h];
    r.workEligible = T < lim && A < 24e7;
    r.work = 0;
    if (r.workEligible) {
      var p = { single: [4e6, 9e6, 1650000, 13e6], one: [7e6, 14e6, 2850000, 18e6], two: [8e6, 17e6, 3300000, 27e6] }[h];
      var seg = E < p[0] ? 'up' : E < p[1] ? 'flat' : 'down';
      var w = seg === 'up' ? E * p[2] / p[0] : seg === 'flat' ? p[2] : p[2] - (E - p[1]) * p[2] / p[3];
      w = Math.max(0, w);
      if (A >= 17e7) { w = w / 2; r.assetHalf = true; }
      w = fl(w);
      if (w < 15000) w = 0;
      else if (seg === 'up' && w < 100000) w = 100000;
      else if (seg === 'down' && w < 30000) w = 30000;
      r.work = w;
    }
    r.childEligible = kids > 0 && T < 7e7 && A < 24e7;
    r.child = 0;
    if (r.childEligible) {
      var c = h === 'two' ? [25e6, 45e6] : [21e6, 49e6];
      var per = E < c[0] ? 1000000 : 1000000 - (E - c[0]) * 500000 / c[1];
      r.child = fl(kids * Math.max(0, per));
    }
    r.total = r.work + r.child;
    r.status = 'OK';
    r.basis.push('「조세특례제한법」 제100조의3(총소득 단독 2,200만원·홑벌이 3,200만원·맞벌이 4,400만원 미만, 재산 2억4천만원 미만), 제100조의5(가구별 산식, 재산 1억7천만원 이상 50%), 제100조의7제3항(최소 지급액)');
    r.basis.push('「조세특례제한법」 제100조의28(자녀장려금: 총소득 7천만원 미만, 재산 2억4천만원 미만), 제100조의29(자녀 1명당 최대 100만원)');
    r.notes.push('실제 지급액은 법 제100조의5제5항·제100조의29제2항의 구간별 산정표로 정해져 이 산식 결과와 조금 다를 수 있습니다. 자녀장려금의 재산 감액, 사업소득의 업종별 조정률, 기한 후 신청 감액(95%)은 반영하지 않았습니다(베타).');
    return r;
  }

  var api = { depositInterest: depositInterest, isaTax: isaTax, financialIncome: financialIncome, rentalIncomeTax: rentalIncomeTax, propertyTax: propertyTax, workIncentive: workIncentive, VERSION: VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PersonalTax2Rules = api;
})(this);
