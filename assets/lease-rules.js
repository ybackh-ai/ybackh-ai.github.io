/*
 * 리스 회계(리스이용자) 간이 계산 로직 (순수 함수, 브라우저·Node 공용). 근거: docs/34_리스_로직.md
 * K-IFRS 제1116호의 일반 원칙 요약: 리스부채 = 리스료의 현재가치(내재이자율 또는 증분차입이자율),
 * 사용권자산 = 리스부채 + 리스개설직접원가 + 선급 리스료, 사용권자산은 리스기간에 걸쳐 정액 상각.
 * 기준서 원문 문단은 대조하지 않음 → 베타.
 */
(function (root) {
  'use strict';
  var VERSION = '2026-11-09';
  function r2(n) { return Math.round(n * 100) / 100; }
  function blank(v) { return v === undefined || v === null || v === ''; }

  /**
   * @param input payment(기간별 리스료), periods(지급 횟수), frequency 'monthly'|'annual',
   *              rate(연 할인율 %), timing 'arrears'(기말)|'advance'(기초), initialCosts, prepaid
   */
  function calculate(input) {
    input = input || {};
    var errors = [];
    var r = { version: VERSION, status: null, errors: errors, notes: [], basis: [], schedule: [] };
    function num(k, label, opt) { if (blank(input[k])) { if (!opt) errors.push(label + '을(를) 입력해 주세요.'); return opt ? 0 : null; } var n = Number(input[k]); if (!isFinite(n)) { errors.push(label + '은(는) 숫자로 입력해 주세요.'); return null; } return n; }
    var pay = num('payment', '리스료'), n = num('periods', '지급 횟수'), rate = num('rate', '할인율');
    var idc = num('initialCosts', '리스개설직접원가', true), pre = num('prepaid', '선급 리스료', true);
    var freq = input.frequency === 'monthly' ? 'monthly' : 'annual';
    var timing = input.timing === 'advance' ? 'advance' : 'arrears';
    if (pay !== null && pay <= 0) errors.push('리스료는 0보다 커야 합니다.');
    if (n !== null && (n < 1 || Math.floor(n) !== n || n > 600)) errors.push('지급 횟수는 1~600 사이 정수로 입력해 주세요.');
    if (rate !== null && (rate < 0 || rate > 50)) errors.push('할인율은 0~50% 사이로 입력해 주세요.');
    if ((idc !== null && idc < 0) || (pre !== null && pre < 0)) errors.push('리스개설직접원가와 선급 리스료는 0 이상이어야 합니다.');
    if (errors.length) { r.status = 'INVALID'; return r; }

    var perYear = freq === 'monthly' ? 12 : 1;
    var i = rate / 100 / perYear;
    // 현재가치
    var pv = 0;
    for (var k = 1; k <= n; k++) { var t = timing === 'advance' ? k - 1 : k; pv += pay / Math.pow(1 + i, t); }
    var liability = pv;
    var rou = pv + idc + pre;

    // 상각표 (반올림은 표시 단계에서만)
    var bal = liability, sched = [], totalInterest = 0, prevInterest = 0;
    for (var p = 1; p <= n; p++) {
      var opening = bal, interest, principal;
      if (timing === 'advance') {
        // 기초 지급: 기초에 지급(직전 기간 발생 이자 먼저 상환) → 남은 잔액에 이번 기간 이자 발생
        principal = pay - prevInterest;
        var afterPay = opening - pay;
        interest = p === n ? 0 : afterPay * i;
        bal = p === n ? 0 : afterPay + interest;
        prevInterest = interest;
        sched.push({ period: p, opening: r2(opening), payment: pay, interest: r2(interest), principal: r2(principal), closing: r2(Math.abs(bal) < 1e-9 ? 0 : bal) });
      } else {
        interest = opening * i;
        principal = pay - interest;
        bal = opening - principal;
        if (p === n) bal = 0;
        sched.push({ period: p, opening: r2(opening), payment: pay, interest: r2(interest), principal: r2(principal), closing: r2(Math.abs(bal) < 1e-9 ? 0 : bal) });
      }
      totalInterest += interest;
      sched[sched.length - 1]._interest = interest;
    }

    // 첫 1년 비용 비교
    var firstN = Math.min(n, perYear);
    var fyInterest = 0; for (var q = 0; q < firstN; q++) fyInterest += sched[q]._interest;
    sched.forEach(function (row) { delete row._interest; });
    var termYears = n / perYear;
    var fyDep = rou / termYears * (firstN / perYear);
    var fyRent = pay * firstN;

    r.liability = r2(liability);
    r.rouAsset = r2(rou);
    r.totalPayments = r2(pay * n);
    r.totalInterest = r2(pay * n - liability);
    r.schedule = sched;
    r.termMonths = freq === 'monthly' ? n : n * 12;
    r.shortTerm = r.termMonths <= 12;
    r.firstYearInterest = r2(fyInterest);
    r.firstYearDepreciation = r2(fyDep);
    r.firstYearExpense = r2(fyInterest + fyDep);
    r.firstYearRent = r2(fyRent);
    r.firstYearDiff = r2(fyInterest + fyDep - fyRent);
    r.status = 'OK';

    r.basis.push('리스부채 = 리스기간 동안 지급할 리스료를 할인율로 할인한 현재가치입니다. 할인율은 리스의 내재이자율을 쉽게 산정할 수 없으면 리스이용자의 증분차입이자율을 씁니다.');
    r.basis.push('사용권자산 = 리스부채 최초 측정액 + 리스개설직접원가 + 개시일 전 지급 리스료(받은 리스 인센티브 차감)이며, 리스기간(또는 내용연수 중 짧은 기간)에 걸쳐 상각합니다.');
    r.basis.push('매기 이자비용 = 기초 리스부채 × 기간 이자율, 리스료 중 나머지가 원금 상환입니다. 그래서 리스 초기에는 비용(이자+상각)이 기존 임차료보다 크고 후기로 갈수록 작아집니다.');
    r.basis.push('근거: K-IFRS 제1116호 「리스」의 일반 원칙(기준서 원문 문단은 이 사이트에서 대조하지 않음 — 확실하지 않음). 일반기업회계기준 적용 회사는 운용리스를 임차료 비용으로 처리하는 등 처리가 다릅니다.');
    if (r.shortTerm) r.notes.push('리스기간이 12개월 이하인 단기리스입니다. 인식 면제를 선택하면 사용권자산·리스부채를 인식하지 않고 리스료를 비용으로 처리할 수 있습니다(구매선택권이 있으면 단기리스가 아닙니다).');
    r.notes.push('기초자산이 소액(예: 노트북, 사무용 가구 등)이면 인식 면제를 선택할 수 있습니다. 소액 기준 금액은 기준서가 정하지 않아 회사 정책으로 정합니다.');
    r.notes.push('연장선택권·종료선택권, 변동리스료, 보증잔존가치, 리스 변경은 반영하지 않은 간이 계산입니다. 월 지급이면 연 할인율을 12로 나눈 월 이율을 썼습니다.');
    return r;
  }

  var api = { calculate: calculate, VERSION: VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LeaseRules = api;
})(this);
