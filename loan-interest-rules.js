/*
 * 가지급금 인정이자 계산 로직 (순수 함수, 브라우저·Node 공용)
 * 근거: docs/14_가지급금인정이자_로직.md (2026-11-04 법제처 현행 조회)
 *  - 법인세법 제52조, 시행령 제88조제1항제6호·제3항, 제89조제3항·제5항, 시행규칙 제43조·제44조
 * 금액 입력: 만원 → 내부 원 정수(BigInt로 계산 후 버림). 이자율: %(소수 둘째 자리까지).
 */
(function (root) {
  'use strict';

  var VERSION = '2026-11-04';
  var OVERDRAFT_RATE = 4.6; // 당좌대출이자율 연 4.6% (시행규칙 제43조제2항)
  var THRESHOLD_ABS = 300000000; // 3억원 (시행령 제88조제3항)
  var THRESHOLD_PCT = 5; // 시가의 5% (시행령 제88조제3항)
  var DAY = 86400000;

  function parse(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    var p = s.split('-').map(Number);
    var d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    return d.toISOString().slice(0, 10) === s ? d : null;
  }
  function iso(d) { return d.toISOString().slice(0, 10); }
  function daysBetween(a, b) { return Math.round((b - a) / DAY); } // b - a (일)
  function addYears(d, n) { var x = new Date(d.getTime()); x.setUTCFullYear(x.getUTCFullYear() + n); return x; }
  function blank(v) { return v === undefined || v === null || v === ''; }
  function bp(rate) { return BigInt(Math.round(rate * 100)); } // 4.6% → 460

  /**
   * @param {object} input
   *  fyStart, fyEnd: 'YYYY-MM-DD'  사업연도 개시일·종료일
   *  rateType: 'overdraft' | 'weighted'   적용 이자율
   *  weightedRate: number(%)       가중평균차입이자율 (weighted일 때)
   *  received: 만원                 사업연도 중 실제로 받은(받을) 약정이자 합계
   *  loans: [{ amount: 만원, lendDate, repayDate(선택) }]
   */
  function calculate(input) {
    input = input || {};
    var errors = [];
    var r = { version: VERSION, status: null, errors: errors, loans: [], interest: 0, received: 0, diff: 0, applies: false, inclusion: 0, notes: [] };

    var fs = parse(input.fyStart), fe = parse(input.fyEnd);
    if (!fs || !fe) errors.push('사업연도 개시일과 종료일을 입력해 주세요.');
    else if (fe < fs) errors.push('사업연도 종료일이 개시일보다 앞설 수 없습니다.');
    else if (daysBetween(fs, fe) + 1 > 366) errors.push('사업연도는 1년을 넘을 수 없습니다.');

    var type = input.rateType === 'weighted' ? 'weighted' : 'overdraft';
    var wRate = null;
    if (type === 'weighted') {
      var w = Number(input.weightedRate);
      if (blank(input.weightedRate) || !isFinite(w) || w < 0 || w > 30) errors.push('가중평균차입이자율을 0~30% 사이로 입력해 주세요.');
      else wRate = Math.round(w * 100) / 100;
    }
    var received = 0;
    if (!blank(input.received)) {
      var rv = Number(input.received);
      if (!isFinite(rv) || rv < 0 || Math.floor(rv) !== rv) errors.push('받은 이자는 0 이상의 정수(만원)로 입력해 주세요.');
      else received = rv * 10000;
    }

    // 지급이자 손금불산입용 (선택): 만원
    function optMan(v, name) {
      if (blank(v)) return null;
      var n = Number(v);
      if (!isFinite(n) || n < 0 || Math.floor(n) !== n) { errors.push(name + ': 0 이상의 정수(만원)로 입력해 주세요.'); return null; }
      return n * 10000;
    }
    var interestPaid = optMan(input.interestPaid, '지급이자');
    var avgBorrow = optMan(input.avgBorrowings, '평균 차입금');
    var avgDeposit = optMan(input.avgDeposit, '같은 사람 가수금 평균잔액');
    var avgNbAssets = optMan(input.nonBusinessAssets, '업무무관자산');
    if (interestPaid !== null && interestPaid > 0 && !(avgBorrow > 0)) errors.push('지급이자 손금불산입을 계산하려면 사업연도 평균 차입금을 입력해 주세요.');

    var loans = (input.loans || []).filter(function (l) { return !(blank(l.amount) && blank(l.lendDate)); });
    if (!loans.length) errors.push('가지급금(대여금)을 1건 이상 입력해 주세요.');
    var parsed = loans.map(function (l, i) {
      var label = '대여금 ' + (i + 1);
      var amt = Number(l.amount);
      if (blank(l.amount) || !isFinite(amt) || amt <= 0 || Math.floor(amt) !== amt) errors.push(label + ': 금액을 1 이상의 정수(만원)로 입력해 주세요.');
      var ld = parse(l.lendDate);
      if (!ld) errors.push(label + ': 대여일을 입력해 주세요.');
      var rd = blank(l.repayDate) ? null : parse(l.repayDate);
      if (!blank(l.repayDate) && !rd) errors.push(label + ': 상환일 형식이 올바르지 않습니다.');
      if (ld && rd && rd <= ld) errors.push(label + ': 상환일은 대여일보다 뒤여야 합니다.');
      return { amount: amt * 10000, lendDate: ld, repayDate: rd };
    });
    if (errors.length) { r.status = 'INVALID'; return r; }

    var yearDays = daysBetween(fs, fe) + 1;
    r.yearDays = yearDays;
    var total = 0n;
    parsed.forEach(function (l) {
      // 잔액 일수: max(대여일, 개시일) ~ min(상환일 전날, 종료일), 양 끝 포함
      var from = l.lendDate > fs ? l.lendDate : fs;
      var lastBal = l.repayDate ? new Date(l.repayDate.getTime() - DAY) : fe;
      var to = lastBal < fe ? lastBal : fe;
      var days = to >= from ? daysBetween(from, to) + 1 : 0;
      // 5년 초과 판정: 사업연도 종료일(사업연도 중 상환하면 상환일)이 대여일 + 5년보다 뒤
      var periodEnd = (l.repayDate && l.repayDate <= fe) ? l.repayDate : fe;
      var over5y = periodEnd > addYears(l.lendDate, 5);
      var rate = type === 'overdraft' || over5y ? OVERDRAFT_RATE : wRate;
      var interest = days ? (BigInt(l.amount) * BigInt(days) * bp(rate)) / (10000n * BigInt(yearDays)) : 0n;
      total += interest;
      r.loans.push({
        amount: l.amount, lendDate: iso(l.lendDate), repayDate: l.repayDate ? iso(l.repayDate) : null,
        days: days, balanceDays: BigInt(l.amount) * BigInt(days) + '', // 적수(원·일), 문자열
        over5y: over5y, rate: rate, interest: Number(interest),
      });
    });

    r.interest = Number(total);
    r.received = received;
    r.diff = Math.max(0, r.interest - received);
    r.thresholdPct = Math.floor(r.interest * THRESHOLD_PCT / 100);
    r.applies = r.diff > 0 && (r.diff >= THRESHOLD_ABS || r.diff >= r.thresholdPct);
    r.inclusion = r.applies ? r.diff : 0;

    // 소득처분 (시행령 제106조제1항제1호): 인정이자 익금산입액은 귀속자에 따라
    var DISP = { officer: '상여', shareholder: '배당', corp: '기타사외유출', other: '기타소득' };
    r.dispositionInterest = DISP[input.borrowerType] || null;

    // 업무무관 가지급금 등 지급이자 손금불산입 (법 제28조제1항제4호, 시행령 제53조)
    r.disallowed = null;
    if (interestPaid !== null && interestPaid > 0) {
      var loanBD = r.loans.reduce(function (s, l) { return s + BigInt(l.balanceDays); }, 0n);
      var depBD = avgDeposit ? BigInt(avgDeposit) * BigInt(yearDays) : 0n;        // 같은 사람 가수금 상계(영 §53③)
      var netLoanBD = loanBD > depBD ? loanBD - depBD : 0n;
      var assetBD = avgNbAssets ? BigInt(avgNbAssets) * BigInt(yearDays) : 0n;    // 업무무관자산(영 §49①)
      var borrowBD = BigInt(avgBorrow) * BigInt(yearDays);
      var numer = netLoanBD + assetBD;
      if (numer > borrowBD) numer = borrowBD;                                       // 총차입금 한도
      r.disallowed = Number((BigInt(interestPaid) * numer) / borrowBD);
      r.disallowRatio = Number(numer * 10000n / borrowBD) / 100;
      r.interestPaid = interestPaid;
      r.dispositionDisallowed = '기타사외유출';                                    // 영 §106①3마
      r.notes.push('업무와 관련 없는 가지급금·자산이 있으면 지급이자 중 (가지급금 등 적수 ÷ 총차입금 적수) 비율만큼 손금에 넣지 않으며, 이 금액은 기타사외유출로 처분합니다(법인세법 제28조제1항제4호, 시행령 제53조, 제106조제1항제3호마목). 같은 사람의 가수금은 상계했습니다.');
    }

    if (type === 'weighted' && r.loans.some(function (l) { return l.over5y; })) {
      r.notes.push('대여한 날부터 5년을 넘은 대여금은 가중평균차입이자율 대신 당좌대출이자율(연 4.6%)을 적용했습니다(시행령 제89조제3항제1호의2).');
    }
    if (type === 'overdraft') {
      r.notes.push('당좌대출이자율을 선택해 신고하면 그 사업연도와 이후 2개 사업연도에도 당좌대출이자율을 적용합니다(시행령 제89조제3항제2호).');
    }
    r.notes.push('직원 급여 가불(월정급여 범위), 직원 경조사비·학자금 대여, 중소기업 직원(지배주주등 제외) 주택자금 대여 등은 인정이자 계산에서 제외됩니다(시행규칙 제44조).');
    r.notes.push('익금에 산입한 금액은 귀속자에 따라 상여·배당 등으로 소득처분되어 대표자 등에게 소득세가 생길 수 있습니다. 업무와 관련 없는 가지급금이 있으면 지급이자 일부가 손금으로 인정되지 않을 수 있습니다.');
    r.status = 'OK';
    return r;
  }

  var api = { calculate: calculate, OVERDRAFT_RATE: OVERDRAFT_RATE, VERSION: VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LoanInterestRules = api;
})(this);
