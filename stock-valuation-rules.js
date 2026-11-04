/*
 * 비상장주식 상증법 보충적 평가 약식 계산 로직 (순수 함수, 브라우저·Node 공용)
 * 근거: docs/16_비상장주식평가_로직.md (2026-11-04 법제처 현행 조회)
 *  - 상속세 및 증여세법 제63조, 시행령 제53조·제54조·제55조·제56조, 시행규칙 제17조, 소득세법 제94조제1항제4호다목
 * 입력: 백만원·주·%. 1주당 금액은 원 단위 버림.
 */
(function (root) {
  'use strict';

  var VERSION = '2026-11-04';
  var CAP_RATE_PCT = 10;     // 순손익가치 환원율 10% (시행규칙 제17조)
  var FLOOR_PCT = 80;        // 순자산가치 80% 하한 (시행령 제54조제1항 단서)
  var PREMIUM_PCT = 20;      // 최대주주 할증 (법 제63조제3항)
  var RE_HEAVY_PCT = 50;     // 부동산과다보유법인 (소득세법 제94조제1항제4호다목)
  var NAV_ONLY_PCT = 80;     // 부동산·주식 비율 80% 이상 (시행령 제54조제4항제3호·제5호)
  var M = 1000000;           // 백만원 → 원

  function blank(v) { return v === undefined || v === null || v === ''; }
  function int(v, name, errors, opt) {
    opt = opt || {};
    if (blank(v)) { if (opt.optional) return opt.def || 0; errors.push(name + ': 값을 입력해 주세요.'); return null; }
    var n = Number(v);
    if (!isFinite(n) || Math.floor(n) !== n) { errors.push(name + ': 정수로 입력해 주세요.'); return null; }
    if (opt.min !== undefined && n < opt.min) { errors.push(name + ': ' + opt.min + ' 이상이어야 합니다.'); return null; }
    if (opt.max !== undefined && n > opt.max) { errors.push(name + ': ' + opt.max + ' 이하여야 합니다.'); return null; }
    return n;
  }

  /**
   * @param {object} input
   *  shares: 발행주식총수(주)                netAssets: 순자산가액(백만원, 음수 가능)
   *  goodwill: 영업권평가액(백만원, 선택)    netIncome: [1년 전, 2년 전, 3년 전] 순손익액(백만원)
   *  realEstatePct, stockPct: 자산총액 중 부동산등·주식등 비율(%)
   *  underThreeYears: 사업개시 전·3년 미만·휴폐업    liquidation: 청산 중·사업 계속 곤란·잔여 존속기한 3년 이내
   *  lossThreeYears: 3년 연속 결손   largestShareholder: 최대주주등 주식   smeOrMidsize: 중소기업·중견기업(매출 5천억 미만)
   *  targetShares: 평가 대상 주식 수(선택)
   */
  function evaluate(input) {
    input = input || {};
    var errors = [];
    var r = { version: VERSION, status: null, errors: errors, nav: 0, eps: 0, weighted: null, value: 0, premium: 0, final: 0, total: null, method: null, ratio: null, goodwillAdded: false, basis: [], notes: [] };

    var shares = int(input.shares, '발행주식총수', errors, { min: 1 });
    var netAssets = int(input.netAssets, '순자산가액', errors);
    var goodwill = int(input.goodwill, '영업권평가액', errors, { optional: true, min: 0 });
    var ni = (input.netIncome || []).slice(0, 3);
    while (ni.length < 3) ni.push('');
    var niVals = ni.map(function (v, i) { return int(v, (i + 1) + '년 전 순손익액', errors); });
    var rePct = int(input.realEstatePct, '부동산등 비율', errors, { optional: true, min: 0, max: 100 });
    var stPct = int(input.stockPct, '주식등 비율', errors, { optional: true, min: 0, max: 100 });
    var target = int(input.targetShares, '평가 대상 주식 수', errors, { optional: true, min: 0 });
    if (shares !== null && target !== null && target > shares) errors.push('평가 대상 주식 수가 발행주식총수보다 많습니다.');
    if (errors.length) { r.status = 'INVALID'; return r; }

    var navOnlyAlways = !!(input.underThreeYears || input.liquidation);
    // 영업권 가산 (영 §55③): 청산·3년 미만·부동산 80% 이상·3년 연속 결손이면 가산하지 않음
    var gwAllowed = goodwill > 0 && !navOnlyAlways && rePct < NAV_ONLY_PCT && !input.lossThreeYears;
    r.goodwillAdded = gwAllowed;
    var navTotal = Math.max(0, netAssets + (gwAllowed ? goodwill : 0)); // 0원 이하면 0 (영 §55①)
    r.nav = Math.floor(navTotal * M / shares);
    r.basis.push('1주당 순자산가치 = 순자산가액 ÷ 발행주식총수 (시행령 제54조제2항, 제55조)');

    // 순손익가치 (영 §56①, 규칙 §17)
    var sum6 = niVals[0] * 3 + niVals[1] * 2 + niVals[2];
    var perShareWeighted = sum6 > 0 ? Math.floor(sum6 * M / (6 * shares)) : 0;
    r.niPerShare = perShareWeighted;
    r.eps = perShareWeighted * 100 / CAP_RATE_PCT;
    r.basis.push('1주당 순손익가치 = 최근 3년 순손익액 가중평균(3:2:1) ÷ 10% (시행령 제54조제1항, 제56조제1항, 시행규칙 제17조)');

    if (navOnlyAlways) {
      r.method = 'nav_only';
      r.value = r.nav;
      r.basis.push('청산 중, 사업개시 3년 미만, 휴폐업 등은 순자산가치로만 평가 (시행령 제54조제4항)');
    } else {
      var heavy = rePct >= RE_HEAVY_PCT;
      var a = heavy ? 2 : 3, b = heavy ? 3 : 2;
      r.ratio = a + ':' + b;
      r.weighted = Math.floor((r.eps * a + r.nav * b) / 5);
      r.basis.push('가중평균 = 순손익가치 × ' + a + ' + 순자산가치 × ' + b + ', ÷ 5' + (heavy ? ' (부동산과다보유법인, 시행령 제54조제1항 괄호)' : ' (시행령 제54조제1항)'));
      if ((rePct >= NAV_ONLY_PCT || stPct >= NAV_ONLY_PCT) && r.weighted < r.nav) {
        r.method = 'nav_only';
        r.value = r.nav;
        r.basis.push('부동산 또는 주식 비율 80% 이상이고 가중평균이 순자산가치보다 낮아 순자산가치로 평가 (시행령 제54조제4항제3호·제5호, 같은 항 단서)');
      } else {
        var floor = Math.floor(r.nav * FLOOR_PCT / 100);
        if (r.weighted < floor) {
          r.method = 'floor80';
          r.value = floor;
          r.basis.push('가중평균이 순자산가치의 80%보다 낮아 80% 금액으로 평가 (시행령 제54조제1항 단서)');
        } else {
          r.method = 'weighted';
          r.value = r.weighted;
        }
      }
    }

    // 최대주주 할증 (법 §63③, 영 §53⑥~⑧)
    if (input.largestShareholder) {
      if (input.smeOrMidsize || input.lossThreeYears) {
        r.notes.push('최대주주등의 주식이지만 ' + (input.smeOrMidsize ? '중소기업 또는 매출 5천억원 미만 중견기업' : '3년 연속 결손 법인') + '이어서 20% 할증을 하지 않았습니다(시행령 제53조제8항).');
      } else {
        r.premium = Math.floor(r.value * PREMIUM_PCT / 100);
        r.basis.push('최대주주등의 주식 20% 할증 (상속세 및 증여세법 제63조제3항)');
      }
    }
    r.final = r.value + r.premium;
    if (target) r.total = r.final * target;

    if (goodwill > 0 && !gwAllowed) r.notes.push('입력한 영업권평가액은 청산·사업개시 3년 미만·부동산 80% 이상·3년 연속 결손 중 하나에 해당해 순자산가액에 더하지 않았습니다(시행령 제55조제3항).');
    if (netAssets + (gwAllowed ? goodwill : 0) <= 0) r.notes.push('순자산가액이 0원 이하여서 0원으로 보았습니다(시행령 제55조제1항).');
    if (sum6 <= 0) r.notes.push('최근 3년 순손익액 가중평균이 0 이하여서 0으로 보았습니다(시행령 제56조제1항).');
    r.notes.push('매매사례가액 등 시가가 있으면 시가가 우선합니다. 이 계산은 시가가 없을 때 쓰는 보충적 평가방법입니다(상속세 및 증여세법 제60조, 제63조).');
    r.notes.push('3년간 발행주식총수가 같다고 가정했습니다. 증자·감자가 있었다면 주식 수를 환산해야 합니다(시행령 제56조제3항).');
    r.status = 'OK';
    return r;
  }

  var api = { evaluate: evaluate, VERSION: VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.StockValuationRules = api;
})(this);
