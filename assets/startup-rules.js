/*
 * 스타트업 투자 2종 (순수 함수, 브라우저·Node 공용). 근거: docs/62 (법령 아닌 일반 계약 산식)
 *  capTable 멀티 라운드 캡테이블(옵션 풀 확대 포함) / exitWaterfall 엑싯 분배(청산우선권)
 * 금액 입력 만원, 결과 원. 주식 수는 주.
 */
(function (root) {
  'use strict';
  var VERSION = '2026-11-20';
  var MAN = 10000;
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
  var NAMES = ['시드', '시리즈 A', '시리즈 B'];

  // 1. 멀티 라운드 캡테이블
  function capTable(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var founders = num(input.founderShares, '기존 주주(창업자 등) 주식 수', { positive: true });
    var pool = num(input.poolShares, '기존 옵션 풀 주식 수', { optional: true });
    var rounds = [];
    for (var i = 1; i <= 3; i++) {
      if (blank(input['pre' + i]) && blank(input['inv' + i])) continue;
      var pre = num(input['pre' + i], NAMES[i - 1] + ' 프리머니', { positive: true });
      var inv = num(input['inv' + i], NAMES[i - 1] + ' 투자금', { positive: true });
      var t = num(input['pool' + i], NAMES[i - 1] + ' 목표 옵션 풀', { optional: true });
      if (t >= 100) r.errors.push(NAMES[i - 1] + ' 목표 옵션 풀은 100% 미만으로 입력해 주세요.');
      rounds.push({ name: NAMES[i - 1], pre: pre * MAN, inv: inv * MAN, t: t / 100 });
    }
    if (!r.errors.length && !rounds.length) r.errors.push('라운드를 하나 이상 입력해 주세요.');
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    var holders = [{ name: '기존 주주', shares: Math.round(founders) }, { name: '옵션 풀', shares: Math.round(pool) }];
    var S = holders[0].shares + holders[1].shares;
    r.rounds = [];
    for (var k = 0; k < rounds.length; k++) {
      var R = rounds[k], kk = (R.pre + R.inv) / R.pre;
      if (R.t * kk >= 1) { r.errors.push(R.name + ' 목표 옵션 풀이 너무 커서 계산할 수 없습니다.'); r.status = 'INVALID'; return r; }
      var X = Math.max(0, Math.round((R.t * S * kk - holders[1].shares) / (1 - R.t * kk)));
      holders[1].shares += X;
      var preShares = S + X;
      var price = R.pre / preShares;
      var newShares = Math.round(R.inv * preShares / R.pre);
      holders.push({ name: R.name + ' 투자자', shares: newShares });
      S = preShares + newShares;
      r.rounds.push({ name: R.name, poolAdd: X, price: Math.round(price), newShares: newShares, totalShares: S, post: R.pre + R.inv });
    }
    r.holders = holders.map(function (h) { return { name: h.name, shares: h.shares, pct: Math.round(h.shares / S * 1e6) / 1e4 }; });
    r.totalShares = S;
    r.founderPct = r.holders[0].pct;
    r.status = 'OK';
    r.basis.push('일반 계약 산식: 주당 가격 = 프리머니 ÷ 투자 전 완전희석 주식 수(옵션 풀 확대분 포함), 신주 = 투자금 ÷ 주당 가격');
    r.basis.push('옵션 풀 확대는 투자 후 지분율 목표를 맞추도록 투자 전에 늘린다고 가정(프리머니에 포함, 이른바 option pool shuffle)');
    r.notes.push('전환우선주는 1:1 전환, 리픽싱·SAFE·전환사채는 없다고 보고 계산했습니다. 주식 수는 반올림해 실제 계약과 몇 주 차이가 날 수 있습니다. 스톡옵션 부여 한도는 상법·벤처기업법에 따로 있습니다.');
    return r;
  }

  // 2. 엑싯 분배 (청산우선권)
  function exitWaterfall(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var exit = num(input.exitValue, '매각 대금(주주에게 돌아갈 금액)', { positive: true });
    var common = num(input.common, '보통주 주식 수(옵션 행사분 포함)', { positive: true });
    var ser = [];
    for (var i = 1; i <= 3; i++) {
      if (blank(input['shares' + i]) && blank(input['invested' + i])) continue;
      var sh = num(input['shares' + i], NAMES[i - 1] + ' 주식 수', { positive: true });
      var iv = num(input['invested' + i], NAMES[i - 1] + ' 투자금', { positive: true });
      var mul = num(input['multiple' + i], NAMES[i - 1] + ' 우선권 배수', { optional: true, def: 1 });
      ser.push({ idx: i, name: NAMES[i - 1], shares: sh, pref: Math.round(iv * MAN * (mul || 1)), part: !!input['part' + i] });
    }
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    var E = Math.round(exit * MAN);
    var pari = input.seniority === 'pari';
    function distribute(conv) {
      var out = {}, rem = E, active = ser.filter(function (s) { return !conv[s.idx]; });
      if (pari) {
        var tot = active.reduce(function (a, s) { return a + s.pref; }, 0);
        var payAll = Math.min(rem, tot);
        active.forEach(function (s) { out[s.idx] = tot ? payAll * s.pref / tot : 0; });
        rem -= payAll;
      } else {
        active.slice().sort(function (a, b) { return b.idx - a.idx; }).forEach(function (s) { var p = Math.min(rem, s.pref); out[s.idx] = p; rem -= p; });
      }
      var shares = common + ser.reduce(function (a, s) { return a + ((conv[s.idx] || s.part) ? s.shares : 0); }, 0);
      var ps = rem / shares;
      ser.forEach(function (s) { out[s.idx] = (out[s.idx] || 0) + ((conv[s.idx] || s.part) ? s.shares * ps : 0); });
      out.common = common * ps;
      out.perShare = ps;
      return out;
    }
    var conv = {};
    for (var guard = 0; guard < 10; guard++) {
      var cur = distribute(conv), changed = false;
      for (var j = 0; j < ser.length; j++) {
        var s = ser[j];
        if (s.part || conv[s.idx]) continue;
        var trial = Object.assign({}, conv); trial[s.idx] = true;
        if (distribute(trial)[s.idx] > cur[s.idx] + 0.5) { conv = trial; changed = true; break; }
      }
      if (!changed) break;
    }
    var res = distribute(conv);
    r.rows = ser.map(function (s) { return { name: s.name, shares: s.shares, pref: s.pref, participating: s.part, converted: !!conv[s.idx], payout: Math.round(res[s.idx]) }; });
    r.commonPayout = Math.round(res.common);
    r.commonPerShare = Math.round(res.perShare);
    ser.forEach(function (s) { r['payout' + s.idx] = Math.round(res[s.idx]); });
    r.status = 'OK';
    r.basis.push('일반 계약 산식: 우선주는 청산우선권(투자금 × 배수)을 먼저 받고, 비참가형은 보통주로 전환하는 편이 유리하면 전환한다고 가정, 참가형은 우선권 뒤 남은 금액도 지분율대로 나눔');
    r.basis.push(pari ? '우선권 순위: 모든 시리즈 동순위(pari passu, 우선권 금액 비율로 안분)' : '우선권 순위: 나중 라운드가 먼저(스택형)');
    r.notes.push('실제 분배는 투자계약서·정관의 청산우선권 조항(참가 상한, 전환 비율 조정, 순위)에 따릅니다. 세금·거래 비용·부채 상환은 매각 대금에서 먼저 빼고 넣으세요. 계약 해석은 변호사와 상의하시기 바랍니다.');
    return r;
  }

  var api = { capTable: capTable, exitWaterfall: exitWaterfall, VERSION: VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.StartupRules = api;
})(this);
