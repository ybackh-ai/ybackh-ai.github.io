/*
 * 거래·가치평가·회계 계산 (순수 함수, 브라우저·Node 공용). 근거: docs/44_거래가치평가_로직.md
 * 기업가치→지분가치 브리지, 유사기업 멀티플, SAFE·CB 전환 주식수, 부동산 PF 사업성, 이연법인세, 수익인식(K-IFRS 1115) 검토 항목.
 * 법령 기준이 아닌 산식 도구 — 단위는 입력 단위를 그대로 따른다. 결과는 소수 둘째 자리 반올림.
 */
(function (root) {
  'use strict';
  var VERSION = '2026-11-09';
  var MAN = 10000;
  function blank(v) { return v === undefined || v === null || v === ''; }
  function r2(x) { return Math.round(x * 100 + (x >= 0 ? 1e-9 : -1e-9)) / 100; }
  function reader(errors) {
    return function (v, label, opt) {
      opt = opt || {};
      if (blank(v)) { if (opt.optional) return null; errors.push(label + '을(를) 입력해 주세요.'); return 0; }
      var x = Number(v);
      if (!isFinite(x) || (!opt.allowNeg && x < 0) || (opt.positive && x <= 0)) { errors.push(label + '은(는) ' + (opt.positive ? '0보다 큰' : '0 이상의') + ' 숫자로 입력해 주세요.'); return 0; }
      if (opt.max !== undefined && x > opt.max) { errors.push(label + '은(는) ' + opt.max + ' 이하로 입력해 주세요.'); return 0; }
      return x;
    };
  }
  function z(x) { return x === null ? 0 : x; }

  /** EV → Equity (단위 자유, 보통 백만원) — shares(주식수)가 있으면 주당가치 = 지분가치 × 1,000,000 / 주식수 (백만원 → 원) */
  function bridge(input) {
    input = input || {};
    var errors = [], num = reader(errors);
    var r = { version: VERSION, status: null, errors: errors, notes: [], basis: [] };
    var ev = num(input.ev, '기업가치(EV)', { positive: true });
    var debt = z(num(input.debt, '차입금·사채', { optional: true })), debtLike = z(num(input.debtLike, '부채성 항목', { optional: true }));
    var cash = z(num(input.cash, '현금성자산', { optional: true })), nonOp = z(num(input.nonOp, '비영업자산', { optional: true }));
    var minority = z(num(input.minority, '비지배지분', { optional: true }));
    var nwcA = num(input.nwcActual, '실제 순운전자본', { optional: true, allowNeg: true }), nwcT = num(input.nwcTarget, '목표 순운전자본', { optional: true, allowNeg: true });
    var shares = num(input.shares, '발행주식수', { optional: true });
    if (errors.length) { r.status = 'INVALID'; return r; }
    r.netDebt = r2(debt + debtLike - cash);
    r.nwcAdj = nwcA !== null && nwcT !== null ? r2(nwcA - nwcT) : 0;
    r.equity = r2(ev - r.netDebt + nonOp - minority + r.nwcAdj);
    if (shares) r.perShare = Math.round(r.equity * 1000000 / shares);
    r.lines = [['기업가치(EV)', ev], ['(−) 차입금·사채', -debt], ['(−) 부채성 항목', -debtLike], ['(+) 현금성자산', cash], ['(+) 비영업자산', nonOp], ['(−) 비지배지분', -minority], ['(±) 순운전자본 조정', r.nwcAdj]];
    r.basis.push('지분가치 = 기업가치 − 순부채(차입금 + 부채성 항목 − 현금성자산) + 비영업자산 − 비지배지분 ± 순운전자본 조정');
    r.basis.push('순운전자본 조정 = 거래종결일 실제 순운전자본 − 목표(정상) 순운전자본. 실제가 크면 매수인이 더 지급');
    r.notes.push('부채성 항목 예: 미지급 법인세, 미적립 퇴직급여, 리스부채, 미지급 배당, 이연 설비투자, 소송 충당부채. 어느 항목을 순부채로 볼지는 계약서(SPA)의 정의에 따릅니다.');
    if (r.equity < 0) r.notes.push('지분가치가 음수입니다. 순부채가 기업가치보다 큽니다.');
    r.status = 'OK';
    return r;
  }

  function stats(arr) {
    var a = arr.filter(function (x) { return isFinite(x) && x > 0; }).sort(function (p, q) { return p - q; });
    if (!a.length) return null;
    var mid = Math.floor(a.length / 2);
    var med = a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
    var mean = a.reduce(function (s, x) { return s + x; }, 0) / a.length;
    return { n: a.length, median: r2(med), mean: r2(mean), min: a[0], max: a[a.length - 1] };
  }
  /** @param input comps: [{name, evEbitda, per, pbr}], ebitda, netIncome, bookEquity, netDebt, discount(%) */
  function multiples(input) {
    input = input || {};
    var errors = [], num = reader(errors);
    var r = { version: VERSION, status: null, errors: errors, notes: [], basis: [], methods: [] };
    var comps = Array.isArray(input.comps) ? input.comps : [];
    var ebitda = num(input.ebitda, '대상회사 EBITDA', { optional: true, allowNeg: true }), ni = num(input.netIncome, '대상회사 순이익', { optional: true, allowNeg: true });
    var book = num(input.bookEquity, '대상회사 순자산', { optional: true, allowNeg: true }), nd = z(num(input.netDebt, '순부채', { optional: true, allowNeg: true }));
    var disc = z(num(input.discount, '비유동성 할인율', { optional: true, max: 90 }));
    var sE = stats(comps.map(function (c) { return Number(c.evEbitda); })), sP = stats(comps.map(function (c) { return Number(c.per); })), sB = stats(comps.map(function (c) { return Number(c.pbr); }));
    if (!sE && !sP && !sB) errors.push('비교회사 배수를 1개 이상 입력해 주세요.');
    if (errors.length) { r.status = 'INVALID'; return r; }
    var k = 1 - disc / 100;
    function add(key, label, s, metric, toEquity) {
      if (!s) return;
      r[key + 'Median'] = s.median; r[key + 'Mean'] = s.mean;
      if (metric === null || !(metric > 0)) { r.methods.push({ label: label, s: s, equity: null }); return; }
      var eq = r2(toEquity(s.median * metric) * k), eqMean = r2(toEquity(s.mean * metric) * k);
      r['equity' + key.charAt(0).toUpperCase() + key.slice(1)] = eq;
      r.methods.push({ label: label, s: s, equity: eq, equityMean: eqMean });
    }
    add('evEbitda', 'EV/EBITDA', sE, ebitda, function (v) { return v - nd; });
    add('per', 'PER', sP, ni, function (v) { return v; });
    add('pbr', 'PBR', sB, book, function (v) { return v; });
    var eqs = r.methods.filter(function (m) { return m.equity !== null; }).map(function (m) { return m.equity; });
    if (eqs.length) { r.low = Math.min.apply(null, eqs); r.high = Math.max.apply(null, eqs); }
    r.basis.push('배수별 중앙값(괄호 안 평균)을 대상회사 지표에 곱함. EV/EBITDA는 기업가치이므로 순부채를 빼 지분가치로 환산');
    if (disc) r.basis.push('비상장 비유동성 할인 ' + disc + '% 적용');
    r.notes.push('적자 등으로 지표가 0 이하이면 그 배수는 쓸 수 없습니다. 비교회사는 업종·규모·성장률이 비슷한 상장사를 고르고, 일회성 손익을 조정한 지표를 쓰는 것이 일반적입니다.');
    r.notes.push('세법(상증법)·자본시장법 평가나 회계상 공정가치 평가를 대신하지 않습니다.');
    r.status = 'OK';
    return r;
  }

  /**
   * @param input mode 'safe'|'cb', investment(만원), cap(밸류에이션 캡, 만원), discount(%), roundPrice(원), preShares(캡 기준 주식수),
   *              conversionPrice(원), currentPrice(원), refixFloor(%), existingShares
   */
  function convert(input) {
    input = input || {};
    var errors = [], num = reader(errors);
    var r = { version: VERSION, status: null, errors: errors, notes: [], basis: [] };
    var safe = input.mode !== 'cb';
    var inv = num(input.investment, safe ? '투자금액' : '사채 원금', { positive: true }) * MAN;
    var existing = num(input.existingShares, '기존 발행주식수', { optional: true });
    if (safe) {
      var cap = num(input.cap, '밸류에이션 캡', { optional: true }), disc = num(input.discount, '할인율', { optional: true, max: 99 });
      var rp = num(input.roundPrice, '후속 투자 주당 가격', { optional: true }), pre = num(input.preShares, '캡 산정 기준 주식수', { optional: true });
      var cands = [];
      if (cap && pre) cands.push({ p: cap * MAN / pre, why: '캡 가격 = 캡 ÷ 기준 주식수' });
      if (rp) cands.push({ p: rp * (1 - z(disc) / 100), why: disc ? '할인 가격 = 후속 주당가격 × (1 − ' + disc + '%)' : '후속 투자 주당가격' });
      if (!errors.length && !cands.length) errors.push('캡과 기준 주식수, 또는 후속 투자 주당 가격을 입력해 주세요.');
      if (errors.length) { r.status = 'INVALID'; return r; }
      var best = cands.reduce(function (a, b) { return b.p < a.p ? b : a; });
      r.price = r2(best.p); r.shares = Math.floor(inv / best.p + 1e-9);
      r.basis.push('전환가격 = 아래 후보 중 낮은 가격 → ' + best.why);
      cands.forEach(function (c) { r.basis.push(c.why + ': ' + r2(c.p).toLocaleString('ko-KR') + '원'); });
      r.notes.push('Post-money SAFE는 캡 기준 주식수에 SAFE 전환분이 포함되는 등 계약마다 정의가 다릅니다. 국내 조건부지분인수계약도 계약서 산식을 우선합니다.');
    } else {
      var cp = num(input.conversionPrice, '최초 전환가액', { positive: true });
      var cur = num(input.currentPrice, '현재 시가', { optional: true }), floor = num(input.refixFloor, '리픽싱 하한(%)', { optional: true, max: 100 });
      if (errors.length) { r.status = 'INVALID'; return r; }
      var price = cp, why = '최초 전환가액';
      if (cur !== null && cur < cp) {
        var fl = floor ? cp * floor / 100 : 0;
        price = Math.max(cur, fl); why = cur >= fl ? '시가로 조정(리픽싱)' : '리픽싱 하한 ' + floor + '%';
      }
      r.price = r2(price); r.shares = Math.floor(inv / price + 1e-9);
      r.basis.push('전환 주식수 = 사채 원금 ÷ 전환가액 (' + why + ', 1주 미만 절사)');
      r.notes.push('리픽싱 조건(하한, 조정 주기·산식)은 발행 조건과 「증권의 발행 및 공시 등에 관한 규정」을 따릅니다. 이 계산은 입력한 하한만 반영합니다.');
    }
    if (existing) { r.ownershipPct = r2(r.shares / (existing + r.shares) * 100); r.basis.push('전환 후 지분율 = 전환 주식수 ÷ (기존 주식수 + 전환 주식수)'); }
    r.notes.push('RCPS·CB의 회계상 분류와 파생상품 평가는 "RCPS·CB 평가 필요 여부" 도구를 함께 보세요.');
    r.status = 'OK';
    return r;
  }

  /** 부동산 PF 사업성 (억원): totalSales, salesRate(%), land, construction, other, loan, rate(%), months, feeRate(%), equity */
  function pf(input) {
    input = input || {};
    var errors = [], num = reader(errors);
    var r = { version: VERSION, status: null, errors: errors, notes: [], basis: [] };
    var ts = num(input.totalSales, '총 분양 예정액', { positive: true }), sr = num(input.salesRate, '분양률', { max: 100 });
    var land = num(input.land, '토지비'), cons = num(input.construction, '공사비'), other = z(num(input.other, '기타 사업비', { optional: true }));
    var loan = z(num(input.loan, 'PF 대출', { optional: true })), rate = z(num(input.rate, '대출 금리', { optional: true, max: 100 }));
    var months = z(num(input.months, '대출 기간(개월)', { optional: true })), fee = z(num(input.feeRate, '금융 수수료율', { optional: true, max: 100 }));
    var equity = num(input.equity, '자기자본', { optional: true });
    if (errors.length) { r.status = 'INVALID'; return r; }
    r.revenue = r2(ts * sr / 100);
    r.interest = r2(loan * rate / 100 * months / 12);
    r.fee = r2(loan * fee / 100);
    r.totalCost = r2(land + cons + other + r.interest + r.fee);
    r.profit = r2(r.revenue - r.totalCost);
    r.marginPct = r.revenue ? r2(r.profit / r.revenue * 100) : 0;
    r.breakEvenPct = r2(r.totalCost / ts * 100);
    if (loan) r.loanToCostPct = r2(loan / r.totalCost * 100);
    if (equity !== null) { r.equityPct = r2(equity / r.totalCost * 100); if (equity > 0) r.roePct = r2(r.profit / equity * 100); }
    r.sensitivity = [100, 90, 80, 70, 60].map(function (s) { var rev = ts * s / 100; return { rate: s, profit: r2(rev - r.totalCost) }; });
    r.basis.push('분양수입 = 총 분양 예정액 × 분양률, 금융비용 = 대출 × 금리 × 기간/12 + 대출 × 수수료율 (기간 내내 전액 인출 가정)');
    r.basis.push('손익분기 분양률 = 총사업비 ÷ 총 분양 예정액');
    r.notes.push('부가가치세, 법인세, 분양 대금 유입 시기(공정률), 중도금 대출, 브릿지론 차환, 공사비 인상, 시공사 책임준공 조건은 반영하지 않았습니다. 대주단 검토용 현금흐름 모델을 대신하지 않습니다.');
    r.status = r.profit >= 0 ? 'PROFIT' : 'LOSS';
    return r;
  }

  /** 이연법인세 (단위 자유): rows [{name, amount, type 'taxable'|'deductible'}], rate(%), recoverable, priorDta, priorDtl */
  function deferredTax(input) {
    input = input || {};
    var errors = [], num = reader(errors);
    var r = { version: VERSION, status: null, errors: errors, notes: [], basis: [] };
    var rate = num(input.rate, '적용 세율(%)', { positive: true, max: 60 });
    var rows = (Array.isArray(input.rows) ? input.rows : []).filter(function (x) { return !blank(x.amount); });
    if (!rows.length) errors.push('일시적차이를 1개 이상 입력해 주세요.');
    var tax = 0, ded = 0;
    rows.forEach(function (x) { var a = Number(x.amount); if (!isFinite(a) || a < 0) errors.push('일시적차이 금액은 0 이상으로 입력해 주세요.'); else if (x.type === 'deductible') ded += a; else tax += a; });
    var pa = z(num(input.priorDta, '기초 이연법인세자산', { optional: true })), pl = z(num(input.priorDtl, '기초 이연법인세부채', { optional: true }));
    if (errors.length) { r.status = 'INVALID'; return r; }
    r.taxableTotal = r2(tax); r.deductibleTotal = r2(ded);
    r.dtl = r2(tax * rate / 100);
    r.dtaGross = r2(ded * rate / 100);
    r.dta = input.recoverable ? r.dtaGross : 0;
    r.net = r2(r.dta - r.dtl);
    r.priorNet = r2(pa - pl);
    r.expense = r2(r.priorNet - r.net);
    r.basis.push('이연법인세부채 = 가산할 일시적차이 × 세율, 이연법인세자산 = 차감할 일시적차이 × 세율 (실현 가능성이 높을 때만 인식)');
    r.basis.push('이연법인세비용 = 기초 순자산(자산 − 부채) − 기말 순자산 (음수면 이연법인세수익)');
    r.notes.push('세율은 일시적차이가 소멸할 연도에 적용될 세율(지방소득세 포함 여부 일관 적용)을 씁니다. 기타포괄손익·자본에 직접 반영되는 항목, 이월결손금·세액공제 이월분, 종속기업 투자 관련 차이는 따로 검토가 필요합니다.');
    r.notes.push('K-IFRS 1012·일반기업회계기준 제22장 원문 대조 전 간이 계산입니다(베타).');
    r.status = 'OK';
    return r;
  }

  var REV_ITEMS = {
    bundle: { label: '여러 재화·용역을 묶어 판매(설치·유지보수·보증 포함)', check: '수행의무 식별과 거래가격 배분(개별 판매가격 비율)' },
    variable: { label: '할인·리베이트·반품·성과보수 등 변동대가', check: '변동대가 추정(기댓값·최빈값)과 유의적 환원 가능성 제약' },
    financing: { label: '대금 수령과 이행 시점 차이가 1년을 넘음(선수금·장기 할부)', check: '유의적인 금융요소 — 화폐의 시간가치 조정' },
    agent: { label: '다른 회사 상품을 중개·위탁 판매하거나 플랫폼 운영', check: '본인 vs 대리인 판단 — 총액 또는 순액(수수료) 인식' },
    overTime: { label: '공사·용역·주문 제작처럼 오랜 기간 이행', check: '기간에 걸쳐 인식 요건 3가지와 진행률 측정' },
    license: { label: '소프트웨어·IP 라이선스 제공', check: '접근권(기간 인식) vs 사용권(한 시점 인식) 구분' },
    billHold: { label: '대금은 청구했지만 제품을 회사가 보관(미인도청구)', check: '통제 이전 요건 충족 여부' },
    consignment: { label: '대리점·유통사에 위탁 공급', check: '위탁약정 — 최종 판매 전 수익 인식 불가 여부' },
    modification: { label: '계약 기간 중 범위·가격 변경이 잦음', check: '계약변경 회계처리(별도 계약 vs 기존 계약 수정)' }
  };
  /** 수익인식 검토 항목 진단: REV_ITEMS 키 → boolean */
  function revenue(input) {
    input = input || {};
    var r = { version: VERSION, status: null, errors: [], notes: [], basis: [], flags: [] };
    Object.keys(REV_ITEMS).forEach(function (k) { if (input[k]) r.flags.push({ key: k, label: REV_ITEMS[k].label, check: REV_ITEMS[k].check }); });
    r.flagCount = r.flags.length;
    r.basis.push('K-IFRS 1115 수익 인식 5단계: ① 계약 식별 ② 수행의무 식별 ③ 거래가격 산정 ④ 거래가격 배분 ⑤ 수행의무 이행 시 수익 인식');
    r.notes.push('일반기업회계기준(제16장) 적용 회사도 같은 쟁점을 검토하지만 세부 규정이 다릅니다. 기준서 문단 원문 대조 전 간이 진단입니다(베타).');
    r.status = r.flagCount ? (r.flagCount >= 3 ? 'HIGH' : 'MEDIUM') : 'LOW';
    return r;
  }

  var api = { bridge: bridge, multiples: multiples, convert: convert, pf: pf, deferredTax: deferredTax, revenue: revenue, REV_ITEMS: REV_ITEMS, VERSION: VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DealRules = api;
})(this);
