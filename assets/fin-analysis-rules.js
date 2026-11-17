/*
 * 운전자본·현금전환주기 · 손익분기점 · EBITDA·순차입금(부채상환능력) (순수 함수, 브라우저·Node 공용). 근거: docs/51
 * 법령 기준이 아니라 재무분석 일반 산식이다. 금액 입력은 만원, 결과 금액은 원.
 * 반올림: 일수 소수 1자리, 배수 소수 2자리, 백분율 소수 1자리.
 */
(function (root) {
  'use strict';
  var VERSION = '2026-11-17';
  var MAN = 10000, DAYS = 365;
  function blank(v) { return v === undefined || v === null || v === ''; }
  function r1(x) { return Math.round(x * 10) / 10; }
  function r2(x) { return Math.round(x * 100) / 100; }
  function reader(errors) {
    return function (v, label, opt) {
      opt = opt || {};
      if (blank(v)) { if (opt.optional) return 0; errors.push(label + '을(를) 입력해 주세요.'); return 0; }
      var x = Number(v);
      if (!isFinite(x) || (!opt.signed && x < 0) || (opt.positive && x <= 0)) {
        errors.push(label + '은(는) ' + (opt.positive ? '0보다 큰' : opt.signed ? '' : '0 이상의') + ' 숫자로 입력해 주세요.'); return 0;
      }
      return x;
    };
  }

  /**
   * 운전자본·현금전환주기
   * @param input revenue(연 매출액), cogs(연 매출원가), ar(매출채권), inv(재고자산), ap(매입채무) — 모두 만원
   */
  function workingCapital(input) {
    input = input || {};
    var errors = [], num = reader(errors);
    var r = { version: VERSION, status: null, errors: errors, notes: [], basis: [] };
    var rev = num(input.revenue, '연 매출액', { positive: true });
    var cogs = num(input.cogs, '연 매출원가');
    var ar = num(input.ar, '매출채권');
    var inv = num(input.inv, '재고자산', { optional: true });
    var ap = num(input.ap, '매입채무', { optional: true });
    if (!cogs && (inv || ap)) errors.push('재고자산이나 매입채무가 있으면 매출원가를 입력해 주세요.');
    if (errors.length) { r.status = 'INVALID'; return r; }
    var arD = ar / rev * DAYS, invD = cogs ? inv / cogs * DAYS : 0, apD = cogs ? ap / cogs * DAYS : 0;
    var ccc = arD + invD - apD;
    r.arDays = r1(arD); r.invDays = r1(invD); r.apDays = r1(apD); r.ccc = r1(ccc);
    r.nwc = Math.round((ar + inv - ap) * MAN);
    r.perDay = Math.round(rev * MAN / DAYS);
    r.cashTied = Math.round(ccc * rev * MAN / DAYS);
    r.basis.push('매출채권회전일수 = 매출채권 ÷ 매출액 × 365');
    r.basis.push('재고자산회전일수 = 재고자산 ÷ 매출원가 × 365, 매입채무회전일수 = 매입채무 ÷ 매출원가 × 365');
    r.basis.push('현금전환주기(CCC) = 매출채권회전일수 + 재고자산회전일수 − 매입채무회전일수');
    r.basis.push('운전자본에 묶인 돈(추정) = 현금전환주기 × 하루 매출액, 순운전자본 = 매출채권 + 재고자산 − 매입채무');
    r.notes.push('기말 잔액 대신 기초·기말 평균 잔액을 넣으면 계절 변동이 큰 회사에서 더 정확합니다.');
    r.notes.push('회전일수는 업종마다 차이가 커서, 같은 업종 회사나 우리 회사의 지난해 숫자와 비교해 보는 것이 좋습니다.');
    r.status = 'OK';
    return r;
  }

  /**
   * 손익분기점
   * @param input revenue(연 매출액), variable(변동비 합계), fixed(고정비 합계), target(목표 영업이익, 선택) — 만원
   */
  function breakEven(input) {
    input = input || {};
    var errors = [], num = reader(errors);
    var r = { version: VERSION, status: null, errors: errors, notes: [], basis: [] };
    var rev = num(input.revenue, '연 매출액', { positive: true });
    var vc = num(input.variable, '변동비');
    var fc = num(input.fixed, '고정비');
    var hasTarget = !blank(input.target);
    var tg = hasTarget ? num(input.target, '목표 영업이익') : 0;
    if (!errors.length && vc >= rev) errors.push('변동비가 매출액 이상이면 공헌이익이 없어 손익분기점을 계산할 수 없습니다.');
    if (errors.length) { r.status = 'INVALID'; return r; }
    var cm = rev - vc;
    r.cmRatio = r1(cm / rev * 100);
    r.bep = Math.round(fc * MAN * rev / cm);
    r.safety = r1((rev - fc * rev / cm) / rev * 100);
    var op = cm - fc;
    r.opIncome = Math.round(op * MAN);
    r.dol = op > 0 ? r2(cm / op) : null;
    r.targetSales = hasTarget ? Math.round((fc + tg) * MAN * rev / cm) : null;
    r.basis.push('공헌이익 = 매출액 − 변동비, 공헌이익률 = 공헌이익 ÷ 매출액');
    r.basis.push('손익분기점 매출액 = 고정비 ÷ 공헌이익률, 목표 이익 매출액 = (고정비 + 목표 영업이익) ÷ 공헌이익률');
    r.basis.push('안전한계율 = (실제 매출액 − 손익분기점 매출액) ÷ 실제 매출액');
    r.basis.push('영업레버리지도(DOL) = 공헌이익 ÷ 영업이익 (매출이 1% 변할 때 영업이익이 몇 % 변하는지)');
    r.notes.push('변동비는 매출에 비례해 늘어나는 비용(재료비, 외주비, 판매수수료 등), 고정비는 매출과 관계없이 나가는 비용(임차료, 정규직 급여, 감가상각비 등)입니다. 나누는 기준에 따라 결과가 달라집니다.');
    r.status = 'OK';
    return r;
  }

  /**
   * EBITDA·순차입금(부채상환능력)
   * @param input op(영업이익, 음수 가능), dep(감가상각비+무형자산상각비), interest(이자비용), debt(총차입금), cash(현금성자산) — 만원
   */
  function debtCapacity(input) {
    input = input || {};
    var errors = [], num = reader(errors);
    var r = { version: VERSION, status: null, errors: errors, notes: [], basis: [] };
    var op = num(input.op, '영업이익', { signed: true });
    var dep = num(input.dep, '감가상각비', { optional: true });
    var it = num(input.interest, '이자비용', { optional: true });
    var debt = num(input.debt, '총차입금', { optional: true });
    var cash = num(input.cash, '현금성자산', { optional: true });
    if (errors.length) { r.status = 'INVALID'; return r; }
    var ebitda = op + dep, nd = debt - cash;
    r.ebitda = Math.round(ebitda * MAN);
    r.netDebt = Math.round(nd * MAN);
    r.netCash = nd < 0;
    r.ndEbitda = nd > 0 && ebitda > 0 ? r2(nd / ebitda) : null;
    r.icr = it > 0 ? r2(op / it) : null;
    r.ebitdaIcr = it > 0 ? r2(ebitda / it) : null;
    r.basis.push('EBITDA = 영업이익 + 감가상각비 + 무형자산상각비 (현금 지출이 없는 상각비를 더한 영업 현금창출력의 근사치)');
    r.basis.push('순차입금 = 총차입금(단기·장기차입금, 사채, 리스부채 포함 여부는 기준에 따라 다름) − 현금성자산');
    r.basis.push('순차입금/EBITDA = 영업에서 번 돈으로 순차입금을 갚는 데 걸리는 대략의 햇수');
    r.basis.push('이자보상배율 = 영업이익 ÷ 이자비용, EBITDA 이자보상배율 = EBITDA ÷ 이자비용');
    r.notes.push('순차입금/EBITDA의 적정 수준은 업종과 금융기관마다 다릅니다. 대출 약정에 재무 비율 조건이 있으면 계약서의 정의(리스부채 포함 여부 등)대로 다시 계산해야 합니다.');
    r.notes.push('EBITDA는 법인세, 운전자본 증가, 설비투자를 반영하지 않아 실제로 쓸 수 있는 현금보다 크게 나올 수 있습니다.');
    r.status = 'OK';
    return r;
  }

  var api = { workingCapital: workingCapital, breakEven: breakEven, debtCapacity: debtCapacity, VERSION: VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FinAnalysisRules = api;
})(this);
