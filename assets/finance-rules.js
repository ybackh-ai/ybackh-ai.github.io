/*
 * 대출·부동산 거래 4종 (순수 함수, 브라우저·Node 공용). 근거: docs/63 (2026-11-20 확인)
 *  loanRepayment 대출 상환 / dsrLimit DSR 대출 한도(베타) / rentConversion 전월세 전환 / brokerageFee 중개보수
 * 금액 입력 만원, 결과 원.
 */
(function (root) {
  'use strict';
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
  // 원리금균등 월 상환액 계수 (원금 1원당)
  function annuity(rMonthly, n) { return rMonthly === 0 ? 1 / n : rMonthly / (1 - Math.pow(1 + rMonthly, -n)); }

  // 1. 대출 상환
  function loanRepayment(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var p = num(input.principal, '대출 원금', { positive: true });
    var rate = num(input.rate, '연 이자율', {});
    var n = num(input.months, '대출 기간(개월)', { positive: true });
    if (n > 600) r.errors.push('대출 기간은 600개월 이하로 입력해 주세요.');
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    n = Math.round(n);
    var P = p * MAN, i = rate / 100 / 12, method = input.method || 'equal';
    var bal = P, totalInt = 0, rows = [], yearly = {};
    var pay = annuity(i, n) * P;
    for (var k = 1; k <= n; k++) {
      var it = bal * i, pr;
      if (method === 'principal') pr = P / n;
      else if (method === 'bullet') pr = k === n ? bal : 0;
      else pr = pay - it;
      if (k === n) pr = bal;
      bal -= pr; totalInt += it;
      var y = Math.ceil(k / 12);
      yearly[y] = yearly[y] || { year: y, principal: 0, interest: 0, balance: 0 };
      yearly[y].principal += pr; yearly[y].interest += it; yearly[y].balance = Math.max(0, bal);
      if (k <= 12) rows.push({ month: k, payment: Math.round(pr + it), principal: Math.round(pr), interest: Math.round(it), balance: Math.round(Math.max(0, bal)) });
    }
    r.method = method;
    r.firstPayment = rows[0].payment;
    r.monthlyPayment = method === 'equal' ? Math.round(pay) : r.firstPayment;
    r.lastPayment = method === 'bullet' ? Math.round(P + P * i) : undefined;
    r.totalInterest = Math.round(totalInt);
    r.totalPayment = Math.round(P + totalInt);
    r.firstYear = rows;
    r.yearly = Object.keys(yearly).map(function (k2) { var o = yearly[k2]; return { year: o.year, principal: Math.round(o.principal), interest: Math.round(o.interest), balance: Math.round(o.balance) }; });
    r.status = 'OK';
    r.basis.push('일반 금융 산식: 원리금균등 월 상환액 = 원금 × 월이율 ÷ (1 − (1 + 월이율)^−개월 수), 원금균등은 매달 같은 원금 + 남은 원금의 이자, 만기일시는 매달 이자만 내고 마지막에 원금 상환');
    r.notes.push('금융회사는 실제 일수(일할)로 이자를 계산하고 원 단위 끝수 처리가 달라 실제 상환액과 조금 다를 수 있습니다. 거치기간, 금리 변동, 중도상환수수료는 반영하지 않았습니다.');
    return r;
  }

  // 2. DSR 대출 한도 (베타)
  function dsrLimit(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var inc = num(input.income, '연 소득', { positive: true });
    var ex = num(input.existing, '기존 대출 연간 원리금', { optional: true });
    var rate = num(input.rate, '연 이자율', {});
    var stress = num(input.stress, '스트레스 금리', { optional: true });
    var years = num(input.years, '대출 기간(년)', { positive: true });
    var lim = num(input.limit, 'DSR 기준', { optional: true, def: 40 }) || 40;
    var loan = num(input.loan, '받으려는 대출 금액', { optional: true });
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    var I = inc * MAN, EX = ex * MAN, n = Math.round(years * 12);
    var f = annuity((rate + stress) / 100 / 12, n);
    r.calcRate = rate + stress;
    r.annualCap = I * lim / 100 - EX;
    r.maxLoan = r.annualCap > 0 ? fl(r.annualCap / 12 / f) : 0;
    if (loan > 0) {
      r.newAnnual = Math.round(loan * MAN * f * 12);
      r.dsr = Math.round((r.newAnnual + EX) / I * 10000) / 100;
      r.over = r.dsr > lim;
    }
    r.limit = lim;
    r.status = 'OK';
    r.basis.push('DSR(총부채원리금상환비율) = 모든 대출의 연간 원리금 상환액 ÷ 연 소득. 원리금균등 상환으로 계산');
    r.notes.push('DSR 기준(은행권 40% 등)과 스트레스 금리, 소득 인정 방식, 대출 종류별 만기 산정은 금융위원회·금융감독원 규정과 금융회사 정책에 따르며 자주 바뀝니다. 이 계산기는 이용자가 넣은 기준으로만 계산합니다(베타). LTV(담보인정비율) 한도는 따로 확인하세요.');
    return r;
  }

  // 3. 전월세 전환 (주택임대차보호법 제7조의2, 시행령 제9조)
  function rentConversion(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var toDeposit = input.mode === 'toDeposit';
    var amt = num(input.amount, toDeposit ? '월세' : '월세로 바꿀 보증금', { positive: true });
    var br = num(input.baseRate, '한국은행 기준금리', { optional: true, def: 3.0 });
    if (blank(input.baseRate)) br = 3.0;
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    r.baseRate = br;
    r.capRate = Math.round(Math.min(10, br + 2) * 1000) / 1000;
    if (toDeposit) { r.monthly = Math.round(amt * MAN); r.deposit = Math.round(amt * MAN * 12 / (r.capRate / 100)); }
    else { r.deposit = Math.round(amt * MAN); r.monthly = Math.round(amt * MAN * r.capRate / 100 / 12); }
    r.status = 'OK';
    r.basis.push('「주택임대차보호법」 제7조의2: 보증금을 월차임으로 전환할 때 월차임 산정률 상한은 연 10%(시행령 제9조제1항)와 한국은행 기준금리 + 연 2%(시행령 제9조제2항) 중 낮은 비율');
    r.notes.push('기준금리 기본값 3.00%는 2026년 10월 22일 금융통화위원회 결정(언론 보도 기준)입니다. 바뀌었으면 직접 넣으세요.');
    r.notes.push(toDeposit ? '월세를 보증금으로 바꾸는 경우(역전환)는 법에 상한이 없어 같은 비율로 환산한 참고값입니다.' : '계약 기간 중이나 갱신 때 보증금을 월세로 바꾸면 이 금액을 넘는 월세는 받을 수 없습니다. 새 계약은 당사자가 정합니다.');
    return r;
  }

  // 4. 중개보수 (공인중개사법 시행규칙 제20조, 별표 1·2)
  var SALE = [[5e7, 0.006, 250000], [2e8, 0.005, 800000], [9e8, 0.004, 0], [12e8, 0.005, 0], [15e8, 0.006, 0], [Infinity, 0.007, 0]];
  var LEASE = [[5e7, 0.005, 200000], [1e8, 0.004, 300000], [6e8, 0.003, 0], [12e8, 0.004, 0], [15e8, 0.005, 0], [Infinity, 0.006, 0]];
  function brokerageFee(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var lease = input.kind === 'lease';
    var price = num(input.price, lease ? '보증금' : '매매가', lease ? {} : { positive: true });
    var rent = num(input.monthly, '월세', { optional: true });
    if (!r.errors.length && lease && price + rent <= 0) r.errors.push('보증금 또는 월세를 입력해 주세요.');
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    var amt = price * MAN;
    if (lease && rent > 0) { amt = (price + rent * 100) * MAN; if (amt < 5e7) amt = (price + rent * 70) * MAN; }
    r.amount = Math.round(amt);
    var type = input.type || 'house', rate, cap = 0;
    if (type === 'house') {
      var t = lease ? LEASE : SALE;
      for (var i = 0; i < t.length; i++) if (amt < t[i][0]) { rate = t[i][1]; cap = t[i][2]; break; }
    } else if (type === 'officetel') rate = lease ? 0.004 : 0.005;
    else rate = 0.009;
    r.ratePct = Math.round(rate * 10000) / 100;
    r.cap = cap;
    var fee = fl(amt * rate);
    r.capped = cap > 0 && fee > cap;
    r.fee = r.capped ? cap : fee;
    r.vat = fl(r.fee * 0.1);
    r.feeWithVat = r.fee + r.vat;
    r.status = 'OK';
    r.basis.push('「공인중개사법 시행규칙」 제20조제1항·별표 1(주택 상한요율·한도액), 제4항·별표 2(전용 85㎡ 이하 주거용 오피스텔), 제4항제2호(그 밖 0.9% 이내), 제5항(월세는 월차임 × 100 + 보증금, 5천만원 미만이면 × 70)');
    r.notes.push('상한요율 안에서 중개의뢰인과 중개사가 협의해 정합니다. 매도인·매수인(임대인·임차인) 각각 냅니다. 주택은 중개사무소가 있는 시·도의 조례로 정한 요율 한도를 따르며, 이 계산기는 시행규칙 별표 1의 상한요율로 계산합니다.');
    r.notes.push('부가가치세 10%는 일반과세자 중개사무소일 때 붙을 수 있어 참고로 표시했습니다(간이과세자는 다름).');
    return r;
  }

  var api = { loanRepayment: loanRepayment, dsrLimit: dsrLimit, rentConversion: rentConversion, brokerageFee: brokerageFee, VERSION: VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FinanceRules = api;
})(this);
