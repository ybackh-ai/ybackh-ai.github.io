/*
 * 부가세·인건비·퇴직금·대표 보수·법인전환·실수령액 (순수 함수, 브라우저·Node 공용). 근거: docs/60 (법령 원문 2026-11-19 확인)
 * 소득세·법인세 세율은 tax-tools-rules.js(window.TaxTools)를 그대로 쓴다. 금액 입력 만원, 결과 원. 지방소득세는 실수령액 외에는 넣지 않는다.
 * 2026년 요율: 국민연금 각 4.75%(국민연금법 부칙 제20903호 제4조), 건강보험 7.19%(건보령 §44), 장기요양 0.9448%(장기요양령 §4),
 *   고용보험 실업급여 1.8%(각 0.9%)·고용안정 0.25~0.85%(징수령 §12). 산재보험은 업종별 고시라 입력받는다.
 */
(function (root) {
  'use strict';
  var TT = (typeof module !== 'undefined' && module.exports) ? require('./tax-tools-rules.js') : root.TaxTools;
  var VERSION = '2026-11-19';
  var MAN = 10000;
  var INS = { pension: 0.0475, health: 0.0719, ltc: 0.009448, unemp: 0.009, stab: { u150: 0.0025, prio: 0.0045, u1000: 0.0065, over1000: 0.0085 } };
  var VAT_RATE = { retail: 15, mfg: 20, lodging: 25, construction: 30, finance: 40, other: 30 };
  var VAT_RATE_LABEL = { retail: '소매업·음식점업·재생용 재료수집 판매업 15%', mfg: '제조업·농림어업·소화물 전문 운송업 20%', lodging: '숙박업 25%', construction: '건설업·운수 및 창고업·정보통신업 30%', finance: '금융보험 서비스·전문과학기술·사업시설관리·부동산 관련·부동산임대업 40%', other: '그 밖의 서비스업 30%' };

  function blank(v) { return v === undefined || v === null || v === ''; }
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
  function pd(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); if (!m) return null; var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); return d.getUTCMonth() === +m[2] - 1 ? d : null; }
  function earnedDeduction(g) {
    var d = g <= 5e6 ? g * 0.7 : g <= 15e6 ? 3.5e6 + (g - 5e6) * 0.4 : g <= 45e6 ? 7.5e6 + (g - 15e6) * 0.15 : g <= 1e8 ? 12e6 + (g - 45e6) * 0.05 : 14.75e6 + (g - 1e8) * 0.02;
    return Math.floor(Math.min(d, 2e7, g));
  }
  function earnedCredit(tax, g) {
    var c = tax <= 1.3e6 ? Math.floor(tax * 0.55) : 715000 + Math.floor((tax - 1.3e6) * 0.3);
    var lim = g <= 3.3e7 ? 740000 : g <= 7e7 ? Math.max(660000, 740000 - (g - 3.3e7) * 8 / 1000) : g <= 1.2e8 ? Math.max(500000, 660000 - (g - 7e7) / 2) : Math.max(200000, 500000 - (g - 1.2e8) / 2);
    return Math.min(c, Math.floor(lim));
  }
  // 부동소수 오차(예: 19599.9999…)로 1원 덜 나오는 것을 막고 원 미만을 버린다
  function fl(x) { return Math.floor(x + 1e-6); }
  function employeeIns(pay) {
    return { pension: fl(pay * INS.pension), health: fl(pay * INS.health / 2), ltc: fl(pay * INS.ltc / 2), emp: fl(pay * INS.unemp) };
  }

  // 1. 부가가치세
  function vatCalc(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var type = input.type === 'simple' ? 'simple' : 'general';
    var sales = num(input.sales, type === 'simple' ? '공급대가(부가세 포함 매출)' : '매출 공급가액');
    var pur = num(input.purchases, type === 'simple' ? '세금계산서 등 수취 공급대가' : '매입 공급가액(공제 가능분)', { optional: true });
    var card = num(input.cardSales, '신용카드·현금영수증 발행금액', { optional: true });
    var prev = blank(input.prevYearSupply) ? null : num(input.prevYearSupply, '직전 연도 공급대가');
    if (type === 'simple' && !(input.industry in VAT_RATE)) r.errors.push('업종을 골라 주세요.');
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    r.type = type;
    var cardCredit = Math.min(Math.floor(card * MAN * 0.013), 10000000);
    if (type === 'general') {
      r.outputTax = Math.round(sales * MAN * 0.1); r.inputTax = Math.round(pur * MAN * 0.1);
      var t = r.outputTax - r.inputTax;
      r.cardCredit = t > 0 ? Math.min(cardCredit, t) : 0;
      r.payable = t > 0 ? t - r.cardCredit : t;
      r.basis.push('「부가가치세법」 제37조(납부세액 = 매출세액 − 매입세액), 제46조(신용카드 등 발행세액공제: 2026년 12월 31일까지 1.3%, 연 1천만원 한도)');
    } else {
      r.rate = VAT_RATE[input.industry]; r.rateLabel = VAT_RATE_LABEL[input.industry];
      r.grossTax = Math.floor(sales * MAN * r.rate / 100 * 0.1);
      r.invoiceCredit = Math.floor(pur * MAN * 0.005);
      r.cardCredit = cardCredit;
      r.payable = Math.max(0, r.grossTax - r.invoiceCredit - r.cardCredit);
      r.basis.push('「부가가치세법」 제63조(간이과세자 납부세액 = 공급대가 × 업종별 부가가치율 × 10%, 세금계산서 등 수취 공급대가 0.5% 공제, 공제 합계는 납부세액 한도), 제69조(연 공급대가 4,800만원 미만 납부의무 면제)');
      r.basis.push('같은 법 시행령 제111조제2항(업종별 부가가치율)');
    }
    if (prev !== null) {
      r.simpleEligible = prev < 10400;
      r.notes.push('간이과세는 직전 연도 공급대가 합계가 1억4백만원 미만인 개인사업자에게 적용됩니다(법 제61조, 시행령 제109조제1항). 광업·제조업(일부 제외)·도매업·부동산매매업·전문직 사업 등과 부동산임대업·과세유흥장소(4,800만원 이상)는 금액과 관계없이 제외됩니다.');
      r.basis.push('「부가가치세법」 제61조, 시행령 제109조(간이과세 기준 1억4백만원, 배제 업종)');
    }
    if (type === 'simple' && sales < 4800) { r.status = 'EXEMPT'; r.payable = 0; r.notes.push('해당 과세기간(1년) 공급대가가 4,800만원 미만이라 납부의무가 면제됩니다. 신고는 해야 합니다.'); }
    else r.status = r.payable < 0 ? 'REFUND' : 'PAY';
    if (card > 0) r.notes.push('신용카드 발행세액공제는 법인과 직전 연도 공급가액이 일정 금액(시행령)을 넘는 개인사업자는 받을 수 없습니다. 한도 1천만원은 연간 기준입니다.');
    r.notes.push('면세 매출, 대손세액, 의제매입세액, 가산세는 반영하지 않았습니다.');
    return r;
  }

  // 2. 인건비 총액
  function laborCost(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var m = num(input.monthly, '월 급여(세전)', { positive: true });
    var nt = num(input.nonTaxable, '월 비과세 수당', { optional: true });
    var acc = num(input.accidentPct, '산재보험료율', { optional: true });
    if (!r.errors.length && nt > m) r.errors.push('비과세 수당이 월 급여보다 클 수 없습니다.');
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    var pay = (m - nt) * MAN, gross = m * MAN;
    var stab = INS.stab[input.band] !== undefined ? INS.stab[input.band] : INS.stab.u150;
    r.pension = fl(pay * INS.pension); r.health = fl(pay * INS.health / 2); r.ltc = fl(pay * INS.ltc / 2);
    r.employment = fl(pay * (INS.unemp + stab)); r.accident = fl(pay * acc / 100);
    r.monthlyEmployer = r.pension + r.health + r.ltc + r.employment + r.accident;
    r.annualSalary = gross * 12; r.annualEmployer = r.monthlyEmployer * 12;
    r.severanceReserve = input.noSeverance ? 0 : gross;
    r.annualTotal = r.annualSalary + r.annualEmployer + r.severanceReserve;
    r.ratio = Math.round(r.annualTotal / r.annualSalary * 1000) / 10;
    r.status = 'OK';
    r.basis.push('국민연금 사용자 부담 4.75%(「국민연금법」 부칙 법률 제20903호 제4조, 2026년), 건강보험 7.19%의 절반(「국민건강보험법 시행령」 제44조), 장기요양 0.9448%의 절반(「노인장기요양보험법 시행령」 제4조)');
    r.basis.push('고용보험 실업급여 0.9% + 고용안정·직업능력개발 0.25~0.85%(「고용보험 및 산업재해보상보험의 보험료징수 등에 관한 법률 시행령」 제12조), 퇴직금 적립 = 1년에 30일분 평균임금(「근로자퇴직급여 보장법」 제8조)을 월 급여 1개월분으로 추정');
    r.notes.push('보험료는 비과세 수당을 뺀 보수에 요율을 곱해 원 단위로 계산했습니다. 국민연금 기준소득월액 상·하한(고시)과 고지액의 10원 미만 절사는 반영하지 않았습니다.');
    r.notes.push('산재보험료율은 업종마다 고용노동부 고시로 정해집니다. 근로복지공단 고지서의 요율을 넣으세요.');
    return r;
  }

  // 3. 퇴직금·퇴직소득세
  function retireDeduction(y) { return y <= 5 ? 1e6 * y : y <= 10 ? 5e6 + 2e6 * (y - 5) : y <= 20 ? 15e6 + 2.5e6 * (y - 10) : 40e6 + 3e6 * (y - 20); }
  function convDeduction(c) { return c <= 8e6 ? c : c <= 7e7 ? 8e6 + (c - 8e6) * 0.6 : c <= 1e8 ? 45.2e6 + (c - 7e7) * 0.55 : c <= 3e8 ? 61.7e6 + (c - 1e8) * 0.45 : 151.7e6 + (c - 3e8) * 0.35; }
  function severancePay(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var s = pd(input.startDate), e = pd(input.lastDate);
    if (!s) r.errors.push('입사일을 입력해 주세요.');
    if (!e) r.errors.push('마지막 근무일을 입력해 주세요.');
    if (s && e && e < s) r.errors.push('마지막 근무일은 입사일 뒤여야 합니다.');
    var w = num(input.wage3m, '퇴직 전 3개월 임금 총액', { positive: true });
    var d = num(input.days3m, '그 3개월의 총일수', { positive: true });
    var bonus = num(input.annualBonus, '연간 상여금', { optional: true });
    var leave = num(input.leavePay, '연차수당(직전 1년)', { optional: true });
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    r.basis.push('「근로기준법」 제2조제1항제6호(평균임금 = 이전 3개월 임금 총액 ÷ 그 기간 총일수), 「근로자퇴직급여 보장법」 제8조(계속근로 1년에 30일분 이상)');
    r.basis.push('「소득세법」 제48조(근속연수공제·환산급여공제), 제55조제2항(퇴직소득 산출세액 = 환산 과세표준 × 기본세율 ÷ 12 × 근속연수)');
    var avg = (w * MAN + bonus * MAN * 3 / 12 + leave * MAN * 3 / 12) / d;
    r.avgDaily = Math.round(avg);
    r.servedDays = Math.round((e - s) / 86400000) + 1;
    var full = 0, t = new Date(s.getTime());
    while (true) { var n = new Date(t.getTime()); n.setUTCFullYear(n.getUTCFullYear() + 1); if (n <= new Date(e.getTime() + 86400000)) { full++; t = n; } else break; }
    r.years = full + (t <= e ? 1 : 0);
    if (r.servedDays < 365) { r.status = 'NOT_ELIGIBLE'; r.severance = 0; r.tax = 0; r.notes.push('계속근로기간이 1년 미만이면 법정 퇴직금 지급 대상이 아닙니다(같은 법 제4조). 회사 규정이 따로 있으면 그에 따릅니다.'); return r; }
    r.severance = Math.floor(avg * 30 * r.servedDays / 365);
    var ded1 = Math.min(retireDeduction(r.years), r.severance);
    var conv = (r.severance - ded1) * 12 / r.years;
    var taxBase = Math.max(0, Math.floor(conv - convDeduction(conv)));
    r.convPay = Math.floor(conv); r.taxBase = taxBase;
    r.tax = Math.floor(TT.incomeTax(taxBase) / 12 * r.years);
    r.localTax = Math.floor(r.tax * 0.1);
    r.net = r.severance - r.tax - r.localTax;
    r.status = 'PAY';
    r.notes.push('상여금과 연차수당은 연간 금액의 3/12를 3개월 임금에 더했습니다(실무 관행, 고용노동부 행정해석). 평균임금이 통상임금보다 적으면 통상임금으로 계산합니다(근로기준법 제2조제2항).');
    r.notes.push('근속연수는 1년 미만 기간을 1년으로 올려 계산했습니다. 퇴직연금(DB·DC) 가입자는 제도에 따라 받는 금액이 다릅니다.');
    return r;
  }

  // 4. 대표 보수 설계
  function personal(salary, dividend) {
    var g = salary;
    var earned = Math.max(0, g - earnedDeduction(g));
    var basic = 1500000;
    var wageBase = Math.max(0, earned - basic);
    var wageTax = TT.incomeTax(wageBase);
    var credit = g > 0 ? earnedCredit(wageTax, g) : 0;
    var tax;
    if (dividend <= 20000000) tax = Math.floor(dividend * 0.14) + wageTax;
    else {
      var gu = Math.floor((dividend - 20000000) * 0.11);
      var normal = Math.floor(20000000 * 0.14) + TT.incomeTax(Math.max(0, earned + dividend - 20000000 + gu - basic));
      var compare = Math.floor(dividend * 0.14) + TT.incomeTax(wageBase);
      tax = Math.max(normal - gu, compare);
    }
    return Math.max(0, tax - credit);
  }
  function ownerPay(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var p = num(input.profit, '대표 보수 지급 전 법인 세전이익', { positive: true });
    var s = num(input.salary, '대표 급여(연)', { optional: true });
    var po = num(input.payoutPct, '세후이익 중 배당 비율', { optional: true });
    if (!r.errors.length && s > p) r.errors.push('대표 급여가 법인 이익보다 클 수 없습니다(이 도구는 결손을 만들지 않는 범위만 계산).');
    if (!r.errors.length && po > 100) r.errors.push('배당 비율은 100% 이하여야 합니다.');
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    function plan(salW, pct) {
      var taxable = p * MAN - salW, corp = TT.corpTax(taxable), after = taxable - corp;
      var div = Math.floor(after * pct / 100), pers = personal(salW, div);
      return { salary: salW, corpTax: corp, dividend: div, personalTax: pers, totalTax: corp + pers, netToOwner: salW + div - pers, retained: after - div };
    }
    var mine = plan(s * MAN, po);
    Object.keys(mine).forEach(function (k) { r[k] = mine[k]; });
    r.scenarios = [{ name: '급여만', v: plan(p * MAN, 0) }, { name: '입력한 안', v: mine }, { name: '배당만(급여 0)', v: plan(0, 100) }];
    r.status = 'OK';
    r.basis.push('법인세율 「법인세법」 제55조, 근로소득공제 「소득세법」 제47조, 기본공제 제50조(본인 150만원), 기본세율 제55조, 근로소득세액공제 제59조');
    r.basis.push('배당: 원천징수 14%(제129조), 연 2천만원 이하 분리과세(제14조제3항제6호), 초과분은 11% 가산(Gross-up, 제17조제3항) 후 종합과세와 비교과세 중 큰 금액(제62조), 배당세액공제(제56조)');
    r.notes.push('지방소득세(약 10%), 대표의 4대보험(급여에는 국민연금·건강보험 등 본인·회사 부담, 배당이 연 2천만원을 넘으면 건강보험 소득월액보험료), 다른 종합소득, 각종 공제는 넣지 않은 비교용 계산입니다.');
    r.notes.push('급여는 법인 비용(손금)이 되지만 임원 보수는 정관·주주총회 결의 한도 안이어야 합니다. 배당은 상법상 배당가능이익 한도 안에서만 할 수 있습니다.');
    return r;
  }

  // 5. 법인전환 이월과세·취득세 감면
  function incorporation(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var na = num(input.netAssets, '사업장 순자산가액(시가 기준)', { positive: true });
    var cap = num(input.capital, '새 법인의 자본금', { positive: true });
    var acq = num(input.acqTax, '감면 전 예상 취득세', { optional: true });
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    r.basis.push('「조세특례제한법」 제32조(현물출자·사업양수도 법인전환 시 사업용고정자산 양도소득세 이월과세, 주택 제외, 소비성서비스업 제외, 5년 사후관리), 시행령 제29조(사업양수도는 법인설립일부터 3개월 이내 포괄양도, 자본금 ≥ 순자산가액)');
    r.basis.push('「지방세특례제한법」 제57조의2제4항(2027년 12월 31일까지 취득하는 사업용 고정자산 취득세 50% 경감, 부동산 임대 및 공급업 제외, 5년 내 폐업·처분·주식 처분 시 추징)');
    var fails = [];
    if (cap < na) fails.push('새 법인 자본금(' + cap.toLocaleString('ko-KR') + '만원)이 순자산가액보다 적습니다');
    if (input.consumption) fails.push('소비성서비스업(호텔·여관업, 유흥주점업 등)은 제외됩니다');
    if (input.method === 'transfer' && !input.within3m) fails.push('사업양수도는 법인설립일부터 3개월 이내에 사업을 포괄적으로 넘겨야 합니다');
    r.fails = fails;
    r.status = fails.length ? 'NOT' : 'ELIGIBLE';
    r.acqReduction = r.status === 'ELIGIBLE' && !input.realEstateLease ? Math.floor(acq * MAN * 0.5) : 0;
    if (input.housing) r.notes.push('주택과 주택을 취득할 수 있는 권리는 이월과세 대상에서 빠집니다.');
    if (input.realEstateLease) r.notes.push('부동산 임대 및 공급업은 취득세 감면 대상이 아닙니다.');
    r.notes.push('이월과세는 개인이 내야 할 양도소득세를 법인이 나중에 그 자산을 팔 때 법인세로 내는 제도입니다. 설립등기일부터 5년 안에 승계한 사업을 폐지(사업용고정자산 1/2 이상 처분 포함)하거나 받은 주식의 50% 이상을 처분하면 개인이 이월과세액을 양도소득세로 냅니다.');
    r.notes.push('순자산가액은 시가로 평가한 자산에서 부채를 뺀 금액입니다(시행령 제28조제1항제2호 준용). 감정평가 등으로 시가를 정하는 경우가 많습니다. 신청은 현물출자·양수도한 날이 속하는 과세연도의 양도소득세 신고 때 합니다.');
    return r;
  }

  // 6. 연봉 실수령액
  function netSalary(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var m = num(input.monthly, '월 급여(세전)', { positive: true });
    var nt = num(input.nonTaxable, '월 비과세 수당', { optional: true });
    var dep = num(input.dependents, '기본공제 인원(본인 포함)', { optional: true, def: 1 });
    if (!r.errors.length && nt > m) r.errors.push('비과세 수당이 월 급여보다 클 수 없습니다.');
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    dep = Math.max(1, Math.floor(dep));
    var pay = (m - nt) * MAN;
    var ins = employeeIns(pay);
    r.pension = ins.pension; r.health = ins.health; r.ltc = ins.ltc; r.employment = ins.emp;
    r.monthlyInsurance = ins.pension + ins.health + ins.ltc + ins.emp;
    var g = pay * 12;
    var earned = g - earnedDeduction(g);
    var taxBase = Math.max(0, earned - 1500000 * dep - ins.pension * 12 - (ins.health + ins.ltc + ins.emp) * 12);
    var calc = TT.incomeTax(taxBase);
    var credit = earnedCredit(calc, g);
    r.taxBase = taxBase; r.calcTax = calc; r.earnedCredit = credit;
    r.annualTax = Math.max(0, calc - credit - 130000);
    r.localTax = Math.floor(r.annualTax * 0.1);
    r.monthlyTax = Math.round((r.annualTax + r.localTax) / 12);
    r.monthlyNet = m * MAN - r.monthlyInsurance - r.monthlyTax;
    r.annualNet = r.monthlyNet * 12;
    r.status = 'OK';
    r.basis.push('근로자 부담 국민연금 4.75%, 건강보험 3.595%, 장기요양 0.4724%, 고용보험 0.9% (2026년)');
    r.basis.push('「소득세법」 제47조(근로소득공제), 제50조(기본공제 1명 150만원), 제51조의3(연금보험료공제), 제52조(건강·고용보험료 공제), 제55조(세율), 제59조(근로소득세액공제), 제59조의4제9항(표준세액공제 13만원), 지방소득세는 소득세의 10%');
    r.notes.push('매달 떼는 세금은 근로소득 간이세액표(시행령 별표)로 정해져 이 계산과 조금 다를 수 있습니다. 이 계산은 1년치 결정세액을 12로 나눈 값이라, 연말정산 뒤의 실제 부담에 가깝습니다.');
    r.notes.push('자녀세액공제, 신용카드·의료비·교육비·월세 공제 등은 넣지 않았습니다. 넣으면 세금이 더 줄어듭니다.');
    return r;
  }

  var api = { vatCalc: vatCalc, laborCost: laborCost, severancePay: severancePay, ownerPay: ownerPay, incorporation: incorporation, netSalary: netSalary, INS: INS, VAT_RATE_LABEL: VAT_RATE_LABEL, VERSION: VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BizTaxRules = api;
})(this);
