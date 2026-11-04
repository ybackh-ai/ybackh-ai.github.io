/*
 * DCF·WACC 간이 기업가치 계산 로직 (순수 함수, 브라우저·Node 공용)
 * 산식: docs/22_DCF_WACC_로직.md. 법령 기준 없음. 비율은 %로 받는다.
 */
(function (root) {
  'use strict';

  var VERSION = '2026-11-04';

  function blank(v) { return v === undefined || v === null || v === ''; }
  function reader(errors) {
    return function (v, name, opt) {
      opt = opt || {};
      if (blank(v)) { if (opt.optional) return opt.def; errors.push(name + ': 값을 입력해 주세요.'); return null; }
      var n = Number(v);
      if (!isFinite(n)) { errors.push(name + ': 숫자를 입력해 주세요.'); return null; }
      if (opt.min !== undefined && n < opt.min) { errors.push(name + ': ' + opt.min + ' 이상이어야 합니다.'); return null; }
      if (opt.max !== undefined && n > opt.max) { errors.push(name + ': ' + opt.max + ' 이하여야 합니다.'); return null; }
      if (opt.lt !== undefined && !(n < opt.lt)) { errors.push(name + ': ' + opt.lt + '보다 작아야 합니다.'); return null; }
      if (opt.gt !== undefined && !(n > opt.gt)) { errors.push(name + ': ' + opt.gt + '보다 커야 합니다.'); return null; }
      return n;
    };
  }

  /**
   * WACC
   *  rf, mrp, sizePremium(선택), kd, taxRate, debtWeight(D/V): %
   *  beta(레버드) 또는 betaUnlevered(언레버드, 하마다 공식으로 리레버)
   */
  function wacc(input) {
    input = input || {};
    var errors = [], num = reader(errors);
    var r = { version: VERSION, status: null, errors: errors, notes: [] };
    var rf = num(input.rf, '무위험이자율', { min: -5, max: 30 });
    var mrp = num(input.mrp, '시장위험프리미엄', { min: 0, max: 30 });
    var sp = num(input.sizePremium, '규모위험프리미엄', { optional: true, def: 0, min: 0, max: 30 });
    var kd = num(input.kd, '세전 차입이자율', { min: 0, max: 50 });
    var t = num(input.taxRate, '법인세율', { min: 0, lt: 100 });
    var dv = num(input.debtWeight, '부채 비중(D/V)', { min: 0, lt: 100 });
    var hasL = !blank(input.beta), hasU = !blank(input.betaUnlevered);
    if (!hasL && !hasU) errors.push('베타(레버드 또는 언레버드)를 입력해 주세요.');
    var bl = hasL ? num(input.beta, '레버드 베타', { gt: 0, max: 10 }) : null;
    var bu = !hasL && hasU ? num(input.betaUnlevered, '언레버드 베타', { gt: 0, max: 10 }) : null;
    if (errors.length) { r.status = 'INVALID'; return r; }

    var de = dv / (100 - dv); // D/E
    if (bl === null) {
      bl = bu * (1 + (1 - t / 100) * de);
      r.relevered = true;
      r.notes.push('언레버드 베타 ' + bu + '를 목표 부채비율(D/E ' + (de * 100).toFixed(1) + '%)로 하마다 공식에 따라 리레버했습니다.');
    }
    r.beta = bl;
    r.de = de * 100;
    r.ke = rf + bl * mrp + sp;
    r.kdAfterTax = kd * (1 - t / 100);
    r.wacc = (100 - dv) / 100 * r.ke + dv / 100 * r.kdAfterTax;
    r.equityWeight = 100 - dv;
    r.debtWeight = dv;
    r.status = 'OK';
    return r;
  }

  function parseGrowth(g, years, errors) {
    if (typeof g === 'string' && g.indexOf(',') >= 0) {
      var arr = g.split(',').map(function (x) { return x.trim(); }).filter(function (x) { return x !== ''; }).map(Number);
      if (arr.some(function (x) { return !isFinite(x) || x <= -100; })) { errors.push('연도별 성장률을 숫자로 입력해 주세요.'); return null; }
      if (arr.length !== years) { errors.push('연도별 성장률 개수(' + arr.length + '개)가 추정 기간(' + years + '년)과 같아야 합니다.'); return null; }
      return arr;
    }
    var n = Number(g);
    if (blank(g) || !isFinite(n) || n <= -100) { errors.push('매출 성장률을 입력해 주세요.'); return null; }
    var out = [];
    for (var i = 0; i < years; i++) out.push(n);
    return out;
  }

  function project(p, w, gT) {
    var rev = p.revenue0, rows = [], sumPV = 0;
    for (var i = 0; i < p.years; i++) {
      var prev = rev;
      rev = prev * (1 + p.growth[i] / 100);
      var ebit = rev * p.margin / 100;
      var nopat = ebit * (1 - p.taxRate / 100);
      var da = rev * p.daPct / 100, capex = rev * p.capexPct / 100, dnwc = p.nwcPct / 100 * (rev - prev);
      var fcff = nopat + da - capex - dnwc;
      var df = Math.pow(1 + w / 100, i + 1);
      var pv = fcff / df;
      sumPV += pv;
      rows.push({ year: i + 1, revenue: rev, ebit: ebit, nopat: nopat, da: da, capex: capex, dnwc: dnwc, fcff: fcff, discount: 1 / df, pv: pv });
    }
    var last = rows[rows.length - 1];
    var tv = last.fcff * (1 + gT / 100) / ((w - gT) / 100);
    var pvTV = tv * last.discount;
    var ev = sumPV + pvTV;
    var equity = ev - p.netDebt + p.nonOperating;
    return { rows: rows, sumPV: sumPV, tv: tv, pvTV: pvTV, ev: ev, equity: equity };
  }

  /**
   * DCF
   *  revenue0: 기준연도 매출, years: 3~10, growth: % 하나 또는 "10,8,6" 쉼표 목록
   *  margin(영업이익률), taxRate, daPct, capexPct, nwcPct: %
   *  wacc, terminalGrowth: %
   *  netDebt, nonOperating, shares: 선택
   */
  function dcf(input) {
    input = input || {};
    var errors = [], num = reader(errors);
    var r = { version: VERSION, status: null, errors: errors, notes: [], rows: [], grid: [] };
    var p = {};
    p.revenue0 = num(input.revenue0, '기준연도 매출액', { gt: 0 });
    p.years = num(input.years, '추정 기간', { min: 3, max: 10 });
    if (p.years !== null && Math.floor(p.years) !== p.years) { errors.push('추정 기간은 정수(년)로 입력해 주세요.'); p.years = null; }
    p.margin = num(input.margin, '영업이익률', { min: -100, max: 100 });
    p.taxRate = num(input.taxRate, '법인세율', { min: 0, lt: 100 });
    p.daPct = num(input.daPct, '감가상각비 비율', { optional: true, def: 0, min: 0, max: 100 });
    p.capexPct = num(input.capexPct, '설비투자 비율', { optional: true, def: 0, min: 0, max: 100 });
    p.nwcPct = num(input.nwcPct, '순운전자본 비율', { optional: true, def: 0, min: -100, max: 100 });
    var w = num(input.wacc, '할인율(WACC)', { gt: 0, max: 50 });
    var gT = num(input.terminalGrowth, '영구성장률', { min: -10, max: 20 });
    p.netDebt = num(input.netDebt, '순차입금', { optional: true, def: 0 });
    p.nonOperating = num(input.nonOperating, '비영업자산', { optional: true, def: 0, min: 0 });
    var shares = num(input.shares, '발행주식 수', { optional: true, def: null, gt: 0 });
    if (p.years !== null) p.growth = parseGrowth(input.growth, p.years, errors);
    if (w !== null && gT !== null && !(w > gT)) errors.push('할인율(WACC)이 영구성장률보다 커야 영구가치를 계산할 수 있습니다.');
    if (errors.length) { r.status = 'INVALID'; return r; }

    var base = project(p, w, gT);
    r.rows = base.rows; r.sumPV = base.sumPV; r.tv = base.tv; r.pvTV = base.pvTV; r.ev = base.ev; r.equity = base.equity;
    r.tvShare = base.ev ? base.pvTV / base.ev * 100 : null;
    r.wacc = w; r.terminalGrowth = gT; r.netDebt = p.netDebt; r.nonOperating = p.nonOperating;
    if (shares) { r.shares = shares; r.perShare = base.equity / shares; }

    // 범위: WACC ±1%p × 영구성장률 ±0.5%p
    [w - 1, w, w + 1].forEach(function (wi) {
      [gT - 0.5, gT, gT + 0.5].forEach(function (gi) {
        if (wi > gi && wi > 0) {
          var x = project(p, wi, gi);
          r.grid.push({ wacc: Math.round(wi * 100) / 100, g: Math.round(gi * 100) / 100, equity: x.equity, perShare: shares ? x.equity / shares : null });
        }
      });
    });
    var eqs = r.grid.map(function (x) { return x.equity; });
    r.rangeLow = Math.min.apply(null, eqs);
    r.rangeHigh = Math.max.apply(null, eqs);

    if (r.tvShare !== null && r.tvShare > 75) r.notes.push('기업가치의 ' + r.tvShare.toFixed(0) + '%가 영구가치에서 나옵니다. 영구성장률과 할인율 가정에 결과가 크게 좌우됩니다.');
    r.notes.push('현금흐름은 연말에 발생한다고 보고 할인했습니다(기간 중간 할인 미반영).');
    r.notes.push('영구가치는 마지막 추정연도 현금흐름이 영구성장률로 계속 늘어난다고 가정한 고든 성장모형으로 계산했습니다.');
    r.status = 'OK';
    return r;
  }

  var api = { wacc: wacc, dcf: dcf, VERSION: VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DcfRules = api;
})(this);
