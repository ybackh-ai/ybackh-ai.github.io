/*
 * 스톡옵션 공정가치(블랙-숄즈-머튼) 계산 로직 (순수 함수, 브라우저·Node 공용)
 * 산식: docs/20_스톡옵션공정가치_로직.md. 법령 기준 없음.
 */
(function (root) {
  'use strict';

  var VERSION = '2026-11-04';

  // 표준정규분포 누적확률: Zelen & Severo (Abramowitz·Stegun 26.2.17), |오차| < 7.5e-8
  function normCdf(x) {
    var b1 = 0.319381530, b2 = -0.356563782, b3 = 1.781477937, b4 = -1.821255978, b5 = 1.330274429, p = 0.2316419;
    var ax = Math.abs(x);
    var t = 1 / (1 + p * ax);
    var pdf = Math.exp(-ax * ax / 2) / Math.sqrt(2 * Math.PI);
    var upper = pdf * t * (b1 + t * (b2 + t * (b3 + t * (b4 + t * b5))));
    return x >= 0 ? 1 - upper : upper;
  }

  function bs(S, K, r, q, sigma, T) {
    var sq = sigma * Math.sqrt(T);
    var d1 = (Math.log(S / K) + (r - q + sigma * sigma / 2) * T) / sq;
    var d2 = d1 - sq;
    var value = S * Math.exp(-q * T) * normCdf(d1) - K * Math.exp(-r * T) * normCdf(d2);
    return { value: Math.max(0, value), d1: d1, d2: d2, nd1: normCdf(d1), nd2: normCdf(d2) };
  }

  function blank(v) { return v === undefined || v === null || v === ''; }

  /**
   * @param {object} input
   *  spot, strike: 원 (부여일 주가, 행사가격)
   *  term: 기대존속기간(년), vol: 연 변동성(%), rate: 무위험이자율(%), dividend: 배당수익률(%, 선택)
   *  quantity: 부여 수량(선택), forfeiture: 예상 가득 전 퇴사율(%, 선택), vestYears: 가득기간(년, 선택)
   */
  function calculate(input) {
    input = input || {};
    var errors = [];
    var r = { version: VERSION, status: null, errors: errors, notes: [], sensitivity: [], schedule: [] };
    function num(v, name, opt) {
      if (blank(v)) { if (opt.optional) return opt.def; errors.push(name + ': 값을 입력해 주세요.'); return null; }
      var n = Number(v);
      if (!isFinite(n)) { errors.push(name + ': 숫자를 입력해 주세요.'); return null; }
      if (opt.gt !== undefined && !(n > opt.gt)) { errors.push(name + ': ' + opt.gt + '보다 커야 합니다.'); return null; }
      if (opt.min !== undefined && n < opt.min) { errors.push(name + ': ' + opt.min + ' 이상이어야 합니다.'); return null; }
      if (opt.lt !== undefined && !(n < opt.lt)) { errors.push(name + ': ' + opt.lt + '보다 작아야 합니다.'); return null; }
      if (opt.max !== undefined && n > opt.max) { errors.push(name + ': ' + opt.max + ' 이하여야 합니다.'); return null; }
      return n;
    }
    var S = num(input.spot, '부여일 주가', { gt: 0 });
    var K = num(input.strike, '행사가격', { gt: 0 });
    var T = num(input.term, '기대존속기간', { gt: 0, max: 30 });
    var vol = num(input.vol, '변동성', { gt: 0, max: 300 });
    var rate = num(input.rate, '무위험이자율', { min: -5, max: 30 });
    var div = num(input.dividend, '배당수익률', { optional: true, def: 0, min: 0, max: 30 });
    var qty = num(input.quantity, '부여 수량', { optional: true, def: null, min: 0 });
    var forf = num(input.forfeiture, '예상 퇴사율', { optional: true, def: 0, min: 0, lt: 100 });
    var vest = num(input.vestYears, '가득기간', { optional: true, def: null, gt: 0, max: 20 });
    if (errors.length) { r.status = 'INVALID'; return r; }

    var res = bs(S, K, rate / 100, div / 100, vol / 100, T);
    r.value = res.value; r.d1 = res.d1; r.d2 = res.d2; r.nd1 = res.nd1; r.nd2 = res.nd2;
    r.intrinsic = Math.max(0, S - K);
    r.timeValue = r.value - r.intrinsic;
    r.input = { S: S, K: K, T: T, vol: vol, rate: rate, div: div };

    if (qty !== null) {
      r.quantity = qty;
      r.expectedVesting = qty * (1 - forf / 100);
      r.total = r.value * r.expectedVesting;
      if (vest) {
        r.vestYears = vest;
        r.annual = r.total / vest;
        var years = Math.ceil(vest), left = r.total;
        for (var i = 1; i <= years; i++) {
          var portion = i < years || vest === years ? r.annual : r.annual * (vest - (years - 1));
          if (i === years) portion = left; // 마지막 해에 잔액 정리
          r.schedule.push({ year: i, expense: portion, cumulative: r.total - left + portion });
          left -= portion;
        }
      }
    }

    // 민감도: 변동성 ±10%p, 기대존속기간 ±1년
    [vol - 10, vol, vol + 10].forEach(function (v) {
      [T - 1, T, T + 1].forEach(function (t) {
        if (v > 0 && t > 0) r.sensitivity.push({ vol: Math.round(v * 100) / 100, term: Math.round(t * 100) / 100, value: bs(S, K, rate / 100, div / 100, v / 100, t).value });
      });
    });

    r.notes.push('유럽형 콜옵션을 가정한 블랙-숄즈-머튼 모형입니다. 조기 행사 가능성, 시장성과조건이 중요하면 이항모형이나 몬테카를로 모형이 필요할 수 있습니다.');
    r.notes.push('무위험이자율과 배당수익률은 연속복리율로 보고 계산했습니다.');
    r.notes.push('비상장회사는 부여일 주가와 변동성을 직접 관측할 수 없어 별도 평가와 유사 상장회사 변동성 등으로 추정합니다. 이 가정이 결과를 가장 크게 바꿉니다.');
    if (r.schedule.length) r.notes.push('보상원가를 가득기간에 걸쳐 정액으로 나눴습니다. 단계별 가득, 성과조건, 실제 퇴사에 따른 재추정은 반영하지 않았습니다.');
    r.status = 'OK';
    return r;
  }

  var api = { calculate: calculate, normCdf: normCdf, VERSION: VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.StockOptionRules = api;
})(this);
