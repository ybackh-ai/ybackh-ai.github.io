/*
 * 투자 유치 지분 희석 계산 로직 (순수 함수, 브라우저·Node 공용)
 * 산식: docs/13_지분희석_로직.md. 법령 기준 없음.
 * 금액 입력: 억원(소수 넷째 자리까지 = 만원) → 내부는 만원 정수, 주식 수 계산은 BigInt로 정확히 버림.
 */
(function (root) {
  'use strict';

  var VERSION = '2026-11-04';
  var MAX_HOLDERS = 6, MAX_ROUNDS = 5;

  function blank(v) { return v === undefined || v === null || v === ''; }
  function round2(n) { return Math.round(n * 100) / 100; }

  /**
   * @param {object} input
   *  holders: [{ name, shares }]                     기존 주주 (1~6명, 주식 수 양의 정수)
   *  rounds:  [{ name, pre, invest, poolPct }]       투자 라운드 (1~5개). pre·invest 억원, poolPct 투자 후 풀 비율(%)
   */
  function calculate(input) {
    input = input || {};
    var errors = [];
    var r = { version: VERSION, status: null, errors: errors, holders: [], rounds: [], notes: [] };

    var holders = (input.holders || []).filter(function (h) { return !(blank(h.name) && blank(h.shares)); });
    if (holders.length < 1) errors.push('기존 주주를 1명 이상 입력해 주세요.');
    if (holders.length > MAX_HOLDERS) errors.push('기존 주주는 ' + MAX_HOLDERS + '명까지 입력할 수 있습니다.');
    holders.forEach(function (h, i) {
      var n = Number(h.shares);
      if (blank(h.shares) || !isFinite(n) || n <= 0 || Math.floor(n) !== n) errors.push('주주 ' + (h.name || i + 1) + ': 보유 주식 수를 1 이상의 정수로 입력해 주세요.');
    });

    var rounds = (input.rounds || []).filter(function (x) { return !(blank(x.pre) && blank(x.invest)); });
    if (rounds.length < 1) errors.push('투자 라운드를 1개 이상 입력해 주세요.');
    if (rounds.length > MAX_ROUNDS) errors.push('투자 라운드는 ' + MAX_ROUNDS + '개까지 입력할 수 있습니다.');
    rounds.forEach(function (x, i) {
      var label = x.name || ('라운드 ' + (i + 1));
      var pre = Number(x.pre), inv = Number(x.invest);
      if (blank(x.pre) || !isFinite(pre) || pre <= 0) errors.push(label + ': 투자 전 기업가치를 0보다 크게 입력해 주세요.');
      if (blank(x.invest) || !isFinite(inv) || inv <= 0) errors.push(label + ': 투자 금액을 0보다 크게 입력해 주세요.');
      if (!blank(x.poolPct)) {
        var p = Number(x.poolPct);
        if (!isFinite(p) || p < 0 || p >= 100) errors.push(label + ': 스톡옵션 풀 비율은 0 이상 100 미만이어야 합니다.');
      }
    });
    if (errors.length) { r.status = 'INVALID'; return r; }

    // 주주 장부: { name, shares(BigInt), history: [] }
    var book = holders.map(function (h, i) { return { name: String(h.name || ('주주' + (i + 1))), shares: BigInt(h.shares), kind: 'existing', history: [] }; });
    function total() { return book.reduce(function (s, h) { return s + h.shares; }, 0n); }
    var initialTotal = total();
    book.forEach(function (h) { h.pctInitial = round2(Number(h.shares * 1000000n / initialTotal) / 10000); });

    for (var i = 0; i < rounds.length; i++) {
      var x = rounds[i];
      var name = String(x.name || ('라운드 ' + (i + 1)));
      var preMan = BigInt(Math.round(Number(x.pre) * 10000));
      var invMan = BigInt(Math.round(Number(x.invest) * 10000));
      var S = total();
      var poolBp = blank(x.poolPct) ? 0n : BigInt(Math.round(Number(x.poolPct) * 100)); // 1% = 100bp
      var poolShares = 0n;
      if (poolBp > 0n) {
        var denom = 10000n * preMan - poolBp * (preMan + invMan);
        if (denom <= 0n) {
          errors.push(name + ': 스톡옵션 풀 비율이 너무 커서 투자 전 기업가치 안에서 확보할 수 없습니다.');
          r.status = 'INVALID';
          return r;
        }
        poolShares = (poolBp * S * (preMan + invMan)) / denom; // BigInt 나눗셈 = 버림
      }
      var preShares = S + poolShares;
      var newShares = (invMan * preShares) / preMan; // = ⌊투자금 ÷ 주당가격⌋
      if (newShares < 1n) {
        errors.push(name + ': 투자 금액이 주당 가격보다 작아 신주가 1주도 발행되지 않습니다.');
        r.status = 'INVALID';
        return r;
      }
      var pricePerShare = Number(preMan) * 10000 / Number(preShares); // 원
      if (poolShares > 0n) book.push({ name: '스톡옵션 풀(' + name + ')', shares: poolShares, kind: 'pool', history: [] });
      book.push({ name: name, shares: newShares, kind: 'investor', history: [] });
      var post = total();
      r.rounds.push({
        name: name,
        pre: Number(x.pre), invest: Number(x.invest), postMoney: round2(Number(x.pre) + Number(x.invest)),
        poolPct: Number(poolBp) / 100,
        price: round2(pricePerShare),
        poolShares: Number(poolShares), newShares: Number(newShares), postShares: Number(post),
        actualInvest: Math.round(Number(newShares) * pricePerShare), // 원, 1주 미만 버림 반영
      });
      // 라운드 후 지분율 스냅샷
      book.forEach(function (h) {
        while (h.history.length < i) h.history.push(null);
        h.history.push(round2(Number(h.shares * 1000000n / post) / 10000));
      });
    }

    var finalTotal = total();
    r.totalShares = Number(finalTotal);
    r.holders = book.map(function (h) {
      return { name: h.name, kind: h.kind, shares: Number(h.shares), pctInitial: h.pctInitial === undefined ? null : h.pctInitial, history: h.history, pctFinal: h.history[h.history.length - 1] };
    });

    var founders = r.holders.filter(function (h) { return h.kind === 'existing'; });
    var fInit = founders.reduce(function (s, h) { return s + h.shares; }, 0);
    r.existingFinalPct = round2(fInit / r.totalShares * 100);

    r.notes.push('보통주 기준의 단순 계산입니다. 우선주 전환비율 조정(리픽싱), 청산우선권, 전환사채·SAFE 전환, 기존 스톡옵션 행사는 반영하지 않았습니다.');
    r.notes.push('신주 수는 1주 미만을 버렸습니다. 그래서 실제 납입 금액은 입력한 투자 금액보다 조금 작을 수 있습니다.');
    if (rounds.some(function (x) { return !blank(x.poolPct) && Number(x.poolPct) > 0; })) {
      r.notes.push('스톡옵션 풀은 투자 전 기업가치 안에서 확보하는 방식(pre-money pool)으로 계산했습니다. 이 방식에서는 신규 풀만큼 기존 주주만 희석됩니다.');
    }
    r.status = 'OK';
    return r;
  }

  var api = { calculate: calculate, VERSION: VERSION, MAX_HOLDERS: MAX_HOLDERS, MAX_ROUNDS: MAX_ROUNDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DilutionRules = api;
})(this);
