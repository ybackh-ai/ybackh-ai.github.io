/*
 * 세금·연금·보험료 7종 (순수 함수, 브라우저·Node 공용). 근거: docs/63 (법령 원문 2026-11-20 확인)
 *  homePropertyTax 주택 재산세 / carTax 자동차세 / incomeTax 종합소득세(근로+사업) / dailyWorkerTax 일용직 세금
 *  pensionTax 연금소득세 / nationalPension 국민연금 예상액(베타) / healthInsurance 지역가입자 건강보험료(베타)
 * 세율표는 tax-tools-rules.js(window.TaxTools). 금액 입력 만원, 결과 원.
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
  function prog(table, x) {
    var prev = 0, acc = 0;
    for (var i = 0; i < table.length; i++) {
      var t = table[i];
      if (x <= t[0]) return acc + (x - prev) * t[1];
      acc += (t[0] - prev) * t[1]; prev = t[0];
    }
    return acc;
  }
  function earnedDeduction(g) {
    var d = g <= 5e6 ? g * 0.7 : g <= 15e6 ? 3.5e6 + (g - 5e6) * 0.4 : g <= 45e6 ? 7.5e6 + (g - 15e6) * 0.15 : g <= 1e8 ? 12e6 + (g - 45e6) * 0.05 : 14.75e6 + (g - 1e8) * 0.02;
    return fl(Math.min(d, 2e7, g));
  }
  function earnedCreditLimit(g) {
    return fl(g <= 3.3e7 ? 740000 : g <= 7e7 ? Math.max(660000, 740000 - (g - 3.3e7) * 8 / 1000) : g <= 1.2e8 ? Math.max(500000, 660000 - (g - 7e7) / 2) : Math.max(200000, 500000 - (g - 1.2e8) / 2));
  }

  // 1. 주택 재산세 (지방세법 제110조·제111조·제111조의2·제112조·제151조, 시행령 제109조)
  var PT_STD = [[6e7, 0.001], [1.5e8, 0.0015], [3e8, 0.0025], [Infinity, 0.004]];
  var PT_ONE = [[6e7, 0.0005], [1.5e8, 0.001], [3e8, 0.002], [Infinity, 0.0035]];
  function homePropertyTax(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var price = num(input.price, '주택 공시가격', { positive: true });
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    var P = Math.round(price * MAN), one = !!input.oneHouse;
    r.fairRatio = one ? (P <= 3e8 ? 43 : P <= 6e8 ? 44 : 45) : 60;
    r.taxBase = fl(P * r.fairRatio / 100);
    r.special = one && P <= 9e8;
    r.tax = fl(prog(r.special ? PT_ONE : PT_STD, r.taxBase));
    r.cityTax = input.cityArea === false ? 0 : fl(r.taxBase * 0.0014);
    r.eduTax = fl(r.tax * 0.2);
    r.total = r.tax + r.cityTax + r.eduTax;
    r.status = 'OK';
    r.basis.push('「지방세법」 제110조제1항, 시행령 제109조제1항제2호: 과세표준 = 공시가격 × 60%(2026년 1세대 1주택은 3억원 이하 43%, 6억원 이하 44%, 초과 45%)');
    r.basis.push('「지방세법」 제111조제1항제3호나목(0.1~0.4%), 제111조의2(1세대 1주택·공시가격 9억원 이하 특례 0.05~0.35%), 제112조(도시지역분 과세표준의 0.14%), 제151조제1항제6호(지방교육세 20%, 도시지역분 제외)');
    r.notes.push('과세표준상한(제110조제3항, 직전 연도 대비 상한율)과 지방자치단체 조례에 따른 세율 가감, 건축물분 지역자원시설세는 반영하지 않아 실제 고지액과 다를 수 있습니다.');
    return r;
  }

  // 2. 자동차세 (지방세법 제127조·제128조, 시행령 제125조제6항, 제150조제7호·제151조제1항제7호)
  function carTax(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var kind = input.kind || 'cc';
    var biz = !!input.commercial;
    var cc = kind === 'cc' ? num(input.cc, '배기량', { positive: true }) : 0;
    var age = num(input.age, '차령(최초 등록 후 연수)', { optional: true, def: 1 }) || 1;
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    var A;
    if (kind === 'cc') {
      r.perCc = biz ? (cc <= 1600 ? 18 : cc <= 2500 ? 19 : 24) : (cc <= 1000 ? 80 : cc <= 1600 ? 140 : 200);
      A = Math.round(cc * r.perCc);
    } else A = biz ? 20000 : 100000;
    r.baseTax = A;
    r.reduction = 0;
    if (kind === 'cc' && !biz && age >= 3) {
      var n = Math.min(age, 12);
      r.reductionPct = 5 * (n - 2);
      var half = fl(A / 2 - A / 2 * 0.05 * (n - 2));
      r.reduction = A - half * 2;
      A = half * 2;
    }
    r.tax = A;
    r.prepayDiscount = input.prepay ? fl(A * 334 / 365 * 0.05) : 0;
    var due = A - r.prepayDiscount;
    r.eduTax = biz ? 0 : fl(due * 0.3);
    r.total = due + r.eduTax;
    r.status = 'OK';
    r.basis.push('「지방세법」 제127조제1항제1호(비영업용 1,000cc 이하 80원·1,600cc 이하 140원·초과 200원/cc, 영업용 18~24원)·제2호(차령 3년부터 1년에 5%씩, 최대 50% 경감)·제3호(그 밖의 승용 비영업용 10만원)');
    r.basis.push('「지방세법」 제128조제3항, 시행령 제125조제6항: 1월 연납 시 연세액 × 납부기한 다음 날~12월 31일 일수 ÷ 365 × 5% 공제. 제150조제7호·제151조제1항제7호: 비영업용 승용차는 지방교육세 30%');
    r.notes.push('연납 공제는 1월 16~31일 납부(334일, 평년) 기준입니다. 3월·6월·9월 연납은 공제가 줄어듭니다. 지방자치단체 조례로 세율을 50%까지 올릴 수 있고, 하이브리드·경차 등 감면은 반영하지 않았습니다.');
    return r;
  }

  // 3. 종합소득세 (근로 + 사업) (소득세법 제47조·제50조·제55조·제59조·제59조의4제9항)
  function incomeTax(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var wage = num(input.wage, '총급여', { optional: true });
    var biz = num(input.bizIncome, '사업소득금액', { optional: true });
    var dep = num(input.dependents, '기본공제 인원', { optional: true, def: 1 }) || 1;
    var od = num(input.otherDeduction, '그 밖의 소득공제', { optional: true });
    var pre = num(input.prepaid, '이미 낸 세금', { optional: true });
    if (!r.errors.length && wage + biz <= 0) r.errors.push('총급여 또는 사업소득금액을 입력해 주세요.');
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    var W = Math.round(wage * MAN), B = Math.round(biz * MAN);
    r.earnedIncome = W - earnedDeduction(W);
    r.totalIncome = r.earnedIncome + B;
    r.taxBase = Math.max(0, r.totalIncome - Math.round(dep * 1500000) - Math.round(od * MAN));
    r.calcTax = TT.incomeTax(r.taxBase);
    r.earnedCredit = 0;
    if (W > 0 && r.totalIncome > 0) {
      var part = r.calcTax * r.earnedIncome / r.totalIncome;
      var c = part <= 1.3e6 ? fl(part * 0.55) : 715000 + fl((part - 1.3e6) * 0.3);
      r.earnedCredit = Math.min(c, earnedCreditLimit(W));
    }
    r.standardCredit = W > 0 ? 130000 : 70000;
    r.determinedTax = Math.max(0, r.calcTax - r.earnedCredit - r.standardCredit);
    r.localTax = fl(r.determinedTax * 0.1);
    r.prepaid = Math.round(pre * MAN);
    r.due = r.determinedTax - r.prepaid;
    r.status = 'OK';
    r.basis.push('「소득세법」 제47조(근로소득공제), 제50조(기본공제 1명 150만원), 제55조(기본세율), 제59조(근로소득세액공제: 근로소득분 산출세액 기준, 총급여별 한도), 제59조의4제9항(표준세액공제 근로소득자 13만원, 그 밖 7만원)');
    r.notes.push('사업소득금액은 수입금액에서 필요경비(장부 또는 경비율)를 뺀 금액을 넣습니다. 특별소득·세액공제(보험·의료·교육·기부), 자녀세액공제, 기장세액공제, 가산세는 반영하지 않았습니다.');
    r.notes.push('이미 낸 세금에는 연말정산 결정세액과 3.3% 중 소득세 3%분, 중간예납세액을 넣습니다. 지방소득세는 따로 신고합니다.');
    return r;
  }

  // 4. 일용직 세금 (소득세법 제47조제2항·제129조제1항제4호·제59조제3항·제86조)
  function dailyWorkerTax(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var w = num(input.dailyWage, '일당', { positive: true });
    var d = num(input.days, '지급 1회에 포함된 일수', { optional: true, def: 1 }) || 1;
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    var W = Math.round(w);
    r.taxablePerDay = Math.max(0, W - 150000);
    r.calcPerDay = fl(r.taxablePerDay * 0.06);
    r.creditPerDay = fl(r.calcPerDay * 0.55);
    r.taxPerDay = r.calcPerDay - r.creditPerDay;
    var t = r.taxPerDay * d;
    r.smallExempt = t > 0 && t < 1000;
    r.tax = r.smallExempt ? 0 : t;
    r.localTax = fl(r.tax * 0.1);
    r.pay = W * d;
    r.net = r.pay - r.tax - r.localTax;
    r.status = 'OK';
    r.basis.push('「소득세법」 제47조제2항(일용근로자 근로소득공제 1일 15만원), 제129조제1항제4호(세율 6%), 제59조제3항(산출세액의 55% 세액공제), 제86조제1호(원천징수세액 1천원 미만 소액부징수)');
    r.notes.push('일용근로소득은 원천징수로 납세가 끝나 종합소득세 신고에 합산하지 않습니다. 고용보험료 등 4대보험료는 빼지 않았습니다.');
    return r;
  }

  // 5. 연금소득세 (소득세법 제14조제3항제9호·제20조의3·제47조의2·제64조의4·제129조제1항제5호의2)
  function pensionDed(x) { var d = x <= 3.5e6 ? x : x <= 7e6 ? 3.5e6 + (x - 3.5e6) * 0.4 : x <= 14e6 ? 4.9e6 + (x - 7e6) * 0.2 : 6.3e6 + (x - 14e6) * 0.1; return fl(Math.min(d, 9e6)); }
  function pensionTax(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var priv = num(input.privatePension, '연금계좌(연금저축·IRP) 연 수령액', { optional: true });
    var pub = num(input.publicPension, '국민연금 등 공적연금 연 수령액', { optional: true });
    var age = num(input.age, '나이', { positive: true });
    var ob = num(input.otherBase, '다른 종합소득 과세표준', { optional: true });
    if (!r.errors.length && priv + pub <= 0) r.errors.push('연금 수령액을 입력해 주세요.');
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    var PV = Math.round(priv * MAN), PB = Math.round(pub * MAN), OB = Math.round(ob * MAN);
    var t0 = TT.incomeTax(OB);
    r.withholdRate = age >= 80 ? 3 : age >= 70 ? 4 : 5;
    r.withheld = fl(PV * r.withholdRate / 100);
    var pubTax = TT.incomeTax(OB + PB - pensionDed(PB)) - t0;
    if (PV <= 15e6) {
      r.status = 'SEPARATE';
      r.privateTax = r.withheld;
      r.publicTax = pubTax;
      r.tax = r.privateTax + r.publicTax;
    } else {
      r.status = 'CHOOSE';
      r.combinedTax = TT.incomeTax(OB + PB + PV - pensionDed(PB + PV)) - t0;
      r.separate15Tax = pubTax + fl(PV * 0.15);
      r.best = r.combinedTax <= r.separate15Tax ? 'combined' : 'separate15';
      r.tax = Math.min(r.combinedTax, r.separate15Tax);
    }
    r.localTax = fl(r.tax * 0.1);
    r.total = r.tax + r.localTax;
    r.basis.push('「소득세법」 제14조제3항제9호다목: 연금계좌 연금(퇴직소득 재원 등 제외) 연 1,500만원 이하이면 분리과세 선택 가능, 제129조제1항제5호의2: 원천징수 70세 미만 5%·80세 미만 4%·80세 이상 3%');
    r.basis.push('「소득세법」 제64조의4: 1,500만원을 넘으면 종합과세 또는 그 연금소득 15% 분리과세 중 선택, 제47조의2: 연금소득공제(최대 900만원)');
    r.notes.push('세액은 다른 소득에 대한 세금을 뺀, 연금 때문에 생기는 소득세입니다. 다른 종합소득 과세표준에 연금을 더하는 방식이라 소득공제가 남아 있는 경우와 다를 수 있습니다. 퇴직소득을 연금으로 받는 부분(퇴직소득세의 50~70%, 제129조제1항제5호의3)과 종신계약 3%는 따로 계산합니다.');
    return r;
  }

  // 6. 국민연금 예상액 (국민연금법 제51조·제63조) — 베타
  function nationalPension(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var b = num(input.income, '가입기간 평균 월소득(현재 가치)', { positive: true });
    var y = num(input.years, '가입기간', { positive: true });
    var a = num(input.aValue, 'A값', { optional: true, def: 3193511 }) || 3193511;
    var early = num(input.earlyYears, '조기 수령 연수', { optional: true });
    if (early > 5) r.errors.push('조기 수령은 5년까지입니다.');
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    var B = b * MAN;
    r.aValue = a;
    r.basicAnnual = 1.29 * (a + B);
    if (y < 10) { r.status = 'LUMP'; r.monthly = 0; r.notes.push('가입기간 10년 미만이면 노령연금 대신 반환일시금을 받습니다.'); r.basis.push('「국민연금법」 제61조: 가입기간 10년 이상이면 노령연금'); return r; }
    var factor = y >= 20 ? 1 + 0.05 * (y - 20) : 0.5 + 0.05 * (y - 10);
    var m = r.basicAnnual * factor / 12;
    r.earlyRate = [100, 94, 88, 82, 76, 70][Math.round(early)];
    r.monthly = Math.round(m * r.earlyRate / 100);
    r.annual = r.monthly * 12;
    r.status = 'OK';
    r.basis.push('「국민연금법」 제51조제1항: 기본연금액 = 1.29 × (A값 + 본인 평균소득월액 B값), 20년 초과 1년마다 5% 가산(2025년 개정, 소득대체율 43%)');
    r.basis.push('「국민연금법」 제63조: 가입 10~20년은 기본연금액의 50% + 1년마다 5%, 조기노령연금은 1년 앞당길 때마다 6%씩 감액(94·88·82·76·70%)');
    r.notes.push('모든 가입기간에 2026년 이후 계수 1.29를 적용했습니다. 실제로는 가입 연도별 계수가 다르고 과거 계수가 더 높아 오래 가입했을수록 실제 금액이 더 많을 수 있습니다. 기준소득월액 상·하한, 부양가족연금, 크레딧, 물가 반영은 계산하지 않았습니다(베타). 정확한 금액은 국민연금공단 「내 연금 알아보기」에서 확인하세요.');
    return r;
  }

  // 7. 지역가입자 건강보험료 (국민건강보험법 시행령 제41조·제42조·제44조, 별표 4) — 베타
  var GRADES = [450, 900, 1350, 1800, 2250, 2700, 3150, 3600, 4050, 4500, 5020, 5590, 6220, 6930, 7710, 8590, 9570, 10700, 11900, 13300, 14800, 16400, 18300, 20400, 22700, 25300, 28100, 31300, 34900, 38800,
    43200, 48100, 53600, 59700, 66500, 74000, 82400, 91800, 103000, 114000, 127000, 142000, 158000, 176000, 196000, 218000, 242000, 270000, 300000, 330000, 363000, 399300, 439230, 483153, 531468, 584615, 643077, 707385, 778124];
  var POINTS = [22, 44, 66, 97, 122, 146, 171, 195, 219, 244, 268, 294, 320, 344, 365, 386, 412, 439, 465, 490, 516, 535, 559, 586, 611, 637, 659, 681, 706, 731,
    757, 785, 812, 841, 881, 921, 961, 1001, 1041, 1091, 1141, 1191, 1241, 1291, 1341, 1391, 1451, 1511, 1571, 1641, 1711, 1781, 1851, 1921, 1991, 2061, 2131, 2201, 2271, 2341];
  function healthInsurance(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var inc = num(input.income, '보험료 부과 대상 연 소득', {});
    var prop = num(input.propertyBase, '재산세 과세표준 합계', { optional: true });
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    r.incomePremium = fl(inc * MAN / 12 * 0.0719);
    var net = prop - 10000; // 만원, 1억원 공제
    r.grade = 0; r.points = 0;
    if (net > 0) {
      var g = 0; while (g < GRADES.length && net > GRADES[g]) g++;
      r.grade = g + 1; r.points = POINTS[g];
    }
    r.propertyPremium = fl(r.points * 211.5);
    r.health = r.incomePremium + r.propertyPremium;
    r.ltc = fl(r.health * 0.9448 / 7.19);
    r.total = r.health + r.ltc;
    r.status = 'OK';
    r.basis.push('「국민건강보험법 시행령」 제44조: 보험료율 7.19%, 재산보험료부과점수당 211.5원. 제41조: 소득월액은 이자·배당·사업·근로·연금·기타소득(비과세 제외). 별표 4: 재산세 과세표준(전월세는 평가액)에서 1억원을 빼고 60개 등급 점수');
    r.basis.push('「노인장기요양보험법」 제9조, 시행령 제4조: 장기요양보험료 = 건강보험료 × 0.9448% ÷ 7.19%');
    r.notes.push('근로·연금소득 등 소득 종류별 반영 비율(보건복지부령), 전월세 보증금 평가, 재산 추가 공제(시행령 제42조의2), 최저보험료, 경감 제도는 반영하지 않았습니다(베타). 소득은 전전년도(11·12월은 전년도) 자료가 반영됩니다. 정확한 금액은 국민건강보험공단 모의 계산으로 확인하세요.');
    return r;
  }

  var api = { homePropertyTax: homePropertyTax, carTax: carTax, incomeTax: incomeTax, dailyWorkerTax: dailyWorkerTax, pensionTax: pensionTax, nationalPension: nationalPension, healthInsurance: healthInsurance, VERSION: VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PersonalTax3Rules = api;
})(this);
