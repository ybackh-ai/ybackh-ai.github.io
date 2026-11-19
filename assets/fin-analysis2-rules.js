/*
 * 재무분석 추가 6종 (순수 함수, 브라우저·Node 공용). 근거: docs/58
 *  runway 런웨이·번레이트 / dupont 듀폰 분석 / indirectCashflow 간접법 영업현금흐름
 *  dscr 원리금상환능력 / redFlags 재무제표 이상 신호 / creditMetrics 신용평가 주요 지표
 * 법령 기준이 아니라 재무분석 일반 산식이다. 이상 신호의 점검 기준(10%p, 50%)은 이 사이트가 정한 참고 기준이다.
 * 금액 입력은 만원, 결과 금액은 원. 백분율 소수 1자리, 배수 소수 2자리.
 */
(function (root) {
  'use strict';
  var VERSION = '2026-11-19';
  var MAN = 10000;
  function blank(v) { return v === undefined || v === null || v === ''; }
  function r1(x) { return Math.round(x * 10) / 10; }
  function r2(x) { return Math.round(x * 100) / 100; }
  function reader(errors) {
    return function (v, label, opt) {
      opt = opt || {};
      if (blank(v)) { if (opt.optional) return opt.def !== undefined ? opt.def : 0; errors.push(label + '을(를) 입력해 주세요.'); return 0; }
      var x = Number(String(v).replace(/,/g, ''));
      if (!isFinite(x) || (!opt.signed && x < 0) || (opt.positive && x <= 0)) {
        errors.push(label + '은(는) ' + (opt.positive ? '0보다 큰' : opt.signed ? '' : '0 이상의') + ' 숫자로 입력해 주세요.'); return 0;
      }
      return x;
    };
  }
  function base() { return { version: VERSION, status: null, errors: [], notes: [], basis: [] }; }
  function pct(cur, prev) { return prev ? (cur - prev) / Math.abs(prev) * 100 : null; }

  // 1. 런웨이·번레이트
  function runway(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var cash = num(input.cash, '현재 현금 잔고');
    var rev = num(input.monthlyRevenue, '월 매출', { optional: true });
    var cost = num(input.monthlyCost, '월 지출(비용)', { positive: true });
    var g = num(input.revenueGrowthPct, '월 매출 성장률', { optional: true, signed: true }) / 100;
    var cg = num(input.costGrowthPct, '월 비용 증가율', { optional: true, signed: true }) / 100;
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    r.burn = Math.round((cost - rev) * MAN);
    r.runwayMonths = null; r.breakevenMonth = null; r.fundingGap = null;
    r.basis.push('번레이트 = 월 지출 − 월 매출 (한 달에 줄어드는 현금)');
    r.basis.push('런웨이 = 현금이 바닥나기 전까지 버틸 수 있는 개월 수. 매달 매출은 성장률만큼, 지출은 증가률만큼 늘어난다고 보고 120개월까지 계산합니다');
    if (rev >= cost) { r.status = 'PROFITABLE'; r.breakevenMonth = 0; r.notes.push('지금 매출이 지출 이상이라 현금이 줄지 않습니다.'); return r; }
    var c = cash, R = rev, C = cost, burned = 0;
    for (var m = 1; m <= 120; m++) {
      if (R >= C) { r.breakevenMonth = m; break; }
      c -= (C - R); burned += (C - R);
      if (c < 0 && r.runwayMonths === null) r.runwayMonths = m - 1;
      R *= (1 + g); C *= (1 + cg);
    }
    if (r.breakevenMonth !== null && r.runwayMonths === null) r.status = 'REACH';
    else if (r.runwayMonths !== null) r.status = 'RUNOUT';
    else r.status = 'LONG';
    if (r.breakevenMonth !== null && r.runwayMonths !== null) r.fundingGap = Math.round((burned - cash) * MAN);
    r.minCash = Math.round((cash - burned) * MAN);
    if (r.status === 'RUNOUT') r.notes.push('투자 유치나 대출은 보통 3~6개월 이상 걸립니다. 런웨이가 그보다 짧다면 지출 조정과 자금 조달을 함께 검토하는 것이 좋습니다.');
    r.notes.push('매출 성장률은 가정입니다. 낮춰 넣어 보면 보수적인 런웨이를 볼 수 있습니다.');
    return r;
  }

  // 2. 듀폰 분석
  function dupont(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var ni = num(input.netIncome, '당기순이익', { signed: true });
    var rev = num(input.revenue, '매출액', { positive: true });
    var a = num(input.assets, '자산총계', { positive: true });
    var e = num(input.equity, '자본총계', { positive: true, signed: true });
    var hasPrev = !blank(input.prevRevenue);
    var pni, prev, pa, pe;
    if (hasPrev) {
      pni = num(input.prevNetIncome, '전기 당기순이익', { signed: true });
      prev = num(input.prevRevenue, '전기 매출액', { positive: true });
      pa = num(input.prevAssets, '전기 자산총계', { positive: true });
      pe = num(input.prevEquity, '전기 자본총계', { positive: true, signed: true });
    }
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    r.margin = r1(ni / rev * 100); r.turnover = r2(rev / a); r.leverage = r2(a / e); r.roe = r1(ni / e * 100);
    r.driver = null;
    if (hasPrev) {
      r.prevMargin = r1(pni / prev * 100); r.prevTurnover = r2(prev / pa); r.prevLeverage = r2(pa / pe); r.prevRoe = r1(pni / pe * 100);
      var ch = { margin: pct(ni / rev, pni / prev), turnover: pct(rev / a, prev / pa), leverage: pct(a / e, pa / pe) };
      r.changes = { margin: ch.margin === null ? null : r1(ch.margin), turnover: r1(ch.turnover), leverage: r1(ch.leverage) };
      var best = null;
      Object.keys(ch).forEach(function (k) { if (ch[k] !== null && (best === null || Math.abs(ch[k]) > Math.abs(ch[best]))) best = k; });
      r.driver = best;
    }
    r.status = 'OK';
    r.basis.push('ROE = 순이익률(순이익 ÷ 매출) × 총자산회전율(매출 ÷ 자산) × 재무레버리지(자산 ÷ 자본)');
    r.notes.push('기말 잔액 대신 기초·기말 평균 자산·자본을 쓰면 더 정확합니다.');
    r.notes.push('재무레버리지로 높아진 ROE는 부채가 늘어난 결과일 수 있어, 부채비율과 이자보상배율을 함께 보는 것이 좋습니다.');
    return r;
  }

  // 3. 간접법 영업현금흐름
  function indirectCashflow(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var ni = num(input.netIncome, '당기순이익', { signed: true });
    var dep = num(input.dep, '감가상각비·무형자산상각비', { optional: true });
    var other = num(input.otherNonCash, '기타 비현금 손익 조정', { optional: true, signed: true });
    var o = {};
    ['arBegin', 'arEnd', 'invBegin', 'invEnd', 'apBegin', 'apEnd'].forEach(function (k) { o[k] = num(input[k], k, { optional: true }); });
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    var dAr = o.arEnd - o.arBegin, dInv = o.invEnd - o.invBegin, dAp = o.apEnd - o.apBegin;
    var wc = -dAr - dInv + dAp;
    var ocf = ni + dep + other + wc;
    r.arEffect = Math.round(-dAr * MAN); r.invEffect = Math.round(-dInv * MAN); r.apEffect = Math.round(dAp * MAN);
    r.wcEffect = Math.round(wc * MAN); r.ocf = Math.round(ocf * MAN);
    r.conversion = ni > 0 ? r1(ocf / ni * 100) : null;
    r.status = ocf < 0 ? 'NEGATIVE' : (ni > 0 && ocf < ni ? 'LOW' : 'OK');
    r.basis.push('영업활동 현금흐름(간이) = 당기순이익 + 감가상각비 등 비현금비용 ± 기타 조정 − 매출채권 증가 − 재고자산 증가 + 매입채무 증가');
    r.notes.push('법인세·이자 지급, 기타 채권·채무 변동, 투자·재무활동 손익 조정은 넣지 않은 간이 계산입니다. 재무제표의 현금흐름표와는 차이가 날 수 있습니다.');
    return r;
  }

  // 4. DSCR
  function dscr(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var ebitda = num(input.ebitda, 'EBITDA', { signed: true });
    var tax = num(input.tax, '법인세 납부액', { optional: true });
    var capex = num(input.capex, '유지보수 설비투자', { optional: true });
    var pr = num(input.principal, '연간 원금 상환액', { optional: true });
    var it = num(input.interest, '연간 이자', { optional: true });
    var cov = blank(input.covenant) ? null : num(input.covenant, '약정 DSCR', { positive: true });
    if (!r.errors.length && pr + it <= 0) r.errors.push('원금 상환액이나 이자를 입력해 주세요.');
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    var cf = ebitda - tax - capex, ds = pr + it;
    r.cfads = Math.round(cf * MAN); r.debtService = Math.round(ds * MAN);
    r.dscr = r2(cf / ds);
    r.covenantMet = cov === null ? null : cf / ds >= cov;
    r.maxDebtService = cov === null ? null : Math.round(cf / cov * MAN);
    r.status = cf / ds < 1 ? 'SHORT' : (r.covenantMet === false ? 'BREACH' : 'OK');
    r.basis.push('DSCR = 원리금 상환 재원(EBITDA − 법인세 − 유지보수 설비투자) ÷ 연간 원리금(원금 + 이자)');
    r.notes.push('대출 약정서마다 DSCR 정의(분자에 넣는 항목, 측정 기간)가 다릅니다. 약정 점검은 계약서 정의대로 다시 계산하세요.');
    return r;
  }

  // 7. 재무제표 이상 신호
  function redFlags(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var rp = num(input.revPrev, '전기 매출액', { positive: true }), rc = num(input.revCur, '당기 매출액', { positive: true });
    var ap = num(input.arPrev, '전기 매출채권'), ac = num(input.arCur, '당기 매출채권');
    var hasInv = !blank(input.invPrev) || !blank(input.invCur);
    var ip = num(input.invPrev, '전기 재고자산', { optional: true }), ic = num(input.invCur, '당기 재고자산', { optional: true });
    var hasCf = !blank(input.netIncome) && !blank(input.ocf);
    var ni = num(input.netIncome, '당기순이익', { optional: true, signed: true }), ocf = num(input.ocf, '영업활동 현금흐름', { optional: true, signed: true });
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    r.flags = [];
    r.revGrowth = r1(pct(rc, rp));
    r.arGrowth = ap ? r1(pct(ac, ap)) : null;
    r.arDaysPrev = r1(ap / rp * 365); r.arDaysCur = r1(ac / rc * 365);
    if (r.arGrowth !== null && r.arGrowth - r.revGrowth >= 10) r.flags.push('매출채권 증가율(' + r.arGrowth + '%)이 매출 증가율(' + r.revGrowth + '%)보다 10%p 이상 높습니다. 회수 지연이나 매출 인식 시점을 확인해 볼 신호입니다.');
    r.invGrowth = hasInv && ip ? r1(pct(ic, ip)) : null;
    if (r.invGrowth !== null && r.invGrowth - r.revGrowth >= 10) r.flags.push('재고자산 증가율(' + r.invGrowth + '%)이 매출 증가율보다 10%p 이상 높습니다. 체화 재고·저가법 평가를 확인해 볼 신호입니다.');
    if (hasCf && ni > 0) {
      if (ocf < 0) r.flags.push('흑자인데 영업활동 현금흐름이 마이너스입니다. 이익이 현금으로 들어오지 않고 있습니다.');
      else if (ocf < ni * 0.5) r.flags.push('영업활동 현금흐름이 순이익의 50%에 못 미칩니다(' + r1(ocf / ni * 100) + '%).');
    }
    r.flagCount = r.flags.length;
    r.status = r.flagCount ? 'FLAGS' : 'CLEAR';
    r.basis.push('점검 기준(이 사이트가 정한 참고 기준, 법령·감사기준 아님): 매출채권·재고 증가율이 매출 증가율보다 10%p 이상 높음, 흑자인데 영업현금흐름 마이너스 또는 순이익의 50% 미만');
    r.notes.push('신호가 있다고 문제가 있다는 뜻은 아닙니다. 성장기 회사나 계절 변동이 큰 업종은 정상적으로도 이런 숫자가 나올 수 있어 원인을 확인하는 출발점으로 쓰세요.');
    return r;
  }

  // 8. 신용평가 주요 지표 (등급은 추정하지 않음)
  function creditMetrics(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var a = num(input.assets, '자산총계', { positive: true });
    var l = num(input.liabilities, '부채총계');
    var debt = num(input.debt, '총차입금', { optional: true });
    var cash = num(input.cash, '현금성자산', { optional: true });
    var rev = num(input.revenue, '매출액', { positive: true });
    var op = num(input.op, '영업이익', { signed: true });
    var dep = num(input.dep, '감가상각비', { optional: true });
    var it = num(input.interest, '이자비용', { optional: true });
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    var e = a - l, ebitda = op + dep, nd = debt - cash;
    r.equity = Math.round(e * MAN); r.ebitda = Math.round(ebitda * MAN);
    r.impaired = e <= 0;
    r.debtRatio = e > 0 ? r1(l / e * 100) : null;
    r.equityRatio = r1(e / a * 100);
    r.debtDependence = r1(debt / a * 100);
    r.opMargin = r1(op / rev * 100);
    r.ebitdaIcr = it > 0 ? r2(ebitda / it) : null;
    r.ndEbitda = nd > 0 && ebitda > 0 ? r2(nd / ebitda) : null;
    r.netCash = nd <= 0;
    r.status = 'OK';
    r.basis.push('부채비율 = 부채 ÷ 자본, 자기자본비율 = 자본 ÷ 자산, 차입금의존도 = 차입금 ÷ 자산');
    r.basis.push('EBITDA 이자보상배율 = (영업이익 + 감가상각비) ÷ 이자비용, 순차입금/EBITDA = (차입금 − 현금) ÷ EBITDA');
    r.notes.push('신용평가사는 업종별로 다른 평가 기준과 정성 요소(시장 지위, 지배구조 등)를 함께 보므로, 이 도구는 등급을 추정하지 않고 평가에 자주 쓰이는 지표만 계산합니다.');
    return r;
  }

  var api = { runway: runway, dupont: dupont, indirectCashflow: indirectCashflow, dscr: dscr, redFlags: redFlags, creditMetrics: creditMetrics, VERSION: VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FinAnalysis2Rules = api;
})(this);
