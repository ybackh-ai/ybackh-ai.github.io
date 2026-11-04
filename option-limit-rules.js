/*
 * 스톡옵션(주식매수선택권) 부여 한도 계산 로직 (순수 함수, 브라우저·Node 공용). 근거: docs/30_스톡옵션한도_로직.md
 * 한도(2026-11-04 법제처 확인):
 *  - 일반 주식회사: 발행주식총수의 10% (상법 제340조의2제3항)
 *  - 상장회사: 발행주식총수의 15% (상법 제542조의3제2항, 시행령 제30조제3항). 이사회 결의 부여는 자본금 3천억원 이상 1%, 미만 3% (법 제542조의3제3항, 영 제30조제4항)
 *  - 벤처기업(주식회사): 발행주식총수의 50%, 그중 외부 전문가(법 제16조의3제1항제3호)에게는 10% (벤처기업육성에 관한 특별법 제16조의3제3항)
 */
(function (root) {
  'use strict';
  var VERSION = '2026-11-04';
  var LIMIT = { general: 10, listed: 15, venture: 50, ventureOutsider: 10, listedBoardLarge: 1, listedBoardSmall: 3, listedBoardCapital: 300000000000 };

  function blank(v) { return v === undefined || v === null || v === ''; }
  function floorPct(total, pct) { return Math.floor(total * pct / 100); }

  /**
   * @param input
   *  companyType: 'general' | 'listed' | 'venture'
   *  totalShares: 발행주식총수(주)
   *  granted: 이미 부여해 아직 행사·취소되지 않은 수량(주), 선택
   *  newGrant: 이번에 부여하려는 수량(주), 선택
   *  outsiderGranted / outsiderNew: 벤처기업의 외부 전문가 부여 수량(기존/이번), 선택
   *  capital: 상장회사 최근 사업연도 말 자본금(원) — 이사회 결의 한도 계산용, 선택
   *  boardGrant: 상장회사가 이사회 결의로 부여하려는 수량(주), 선택
   */
  function evaluate(input) {
    input = input || {};
    var errors = [];
    var r = { version: VERSION, status: null, errors: errors, basis: [], notes: [], checks: [] };
    var type = input.companyType;
    if (type !== 'general' && type !== 'listed' && type !== 'venture') errors.push('회사 구분을 선택해 주세요.');
    function nonneg(k, label) {
      if (blank(input[k])) return 0;
      var n = Number(input[k]);
      if (!isFinite(n) || n < 0 || Math.floor(n) !== n) { errors.push(label + '은(는) 0 이상의 정수(주)로 입력해 주세요.'); return 0; }
      return n;
    }
    var total = Number(input.totalShares);
    if (blank(input.totalShares) || !isFinite(total) || total <= 0 || Math.floor(total) !== total) errors.push('발행주식총수를 1 이상의 정수로 입력해 주세요.');
    var granted = nonneg('granted', '기부여 수량'), newGrant = nonneg('newGrant', '이번 부여 수량');
    var outG = nonneg('outsiderGranted', '외부 전문가 기부여 수량'), outN = nonneg('outsiderNew', '외부 전문가 이번 부여 수량');
    var boardGrant = nonneg('boardGrant', '이사회 결의 부여 수량');
    var capital = blank(input.capital) ? null : Number(input.capital);
    if (capital !== null && (!isFinite(capital) || capital < 0)) errors.push('자본금은 0 이상의 숫자(원)로 입력해 주세요.');
    if (errors.length) { r.status = 'INVALID'; return r; }
    if (outG + outN > granted + newGrant) { errors.push('외부 전문가 부여 수량은 전체 부여 수량 안에 포함되어야 합니다.'); r.status = 'INVALID'; return r; }

    var pct = LIMIT[type];
    r.limitPct = pct;
    r.limitShares = floorPct(total, pct);
    r.granted = granted;
    r.newGrant = newGrant;
    r.afterGrant = granted + newGrant;
    r.remaining = Math.max(0, r.limitShares - granted);
    r.exceeds = r.afterGrant > r.limitShares;
    r.usedPct = Math.round(r.afterGrant / total * 10000) / 100;
    r.checks.push({ key: 'total', label: '전체 부여 한도 (발행주식총수의 ' + pct + '%)', limit: r.limitShares, value: r.afterGrant, ok: !r.exceeds });

    if (type === 'general') {
      r.basis.push('「상법」 제340조의2제3항: 주식매수선택권으로 발행할 신주 또는 양도할 자기주식은 발행주식총수의 100분의 10을 초과할 수 없습니다.');
      r.basis.push('「상법」 제340조의2제1항: 정관 규정과 주주총회 특별결의(제434조)가 필요합니다.');
      r.notes.push('발행주식총수의 10% 이상을 가진 주주, 주요 경영사항에 사실상 영향력을 행사하는 자와 그 배우자·직계존비속에게는 부여할 수 없습니다(제340조의2제2항).');
    } else if (type === 'listed') {
      r.basis.push('「상법」 제542조의3제2항, 같은 법 시행령 제30조제3항: 상장회사는 발행주식총수의 100분의 15까지 부여할 수 있습니다(이사회 결의로 부여한 것을 포함해 계산).');
      var boardPct = capital !== null && capital >= LIMIT.listedBoardCapital ? LIMIT.listedBoardLarge : LIMIT.listedBoardSmall;
      r.boardLimitPct = boardPct;
      r.boardLimitShares = floorPct(total, boardPct);
      r.boardGrant = boardGrant;
      r.boardExceeds = boardGrant > r.boardLimitShares;
      r.checks.push({ key: 'board', label: '이사회 결의 부여 한도 (발행주식총수의 ' + boardPct + '%' + (capital === null ? ', 자본금 3천억원 미만으로 가정' : '') + ')', limit: r.boardLimitShares, value: boardGrant, ok: !r.boardExceeds });
      r.basis.push('「상법」 제542조의3제3항, 시행령 제30조제4항: 정관에 따라 이사회 결의로 부여할 수 있는 한도는 최근 사업연도 말 자본금 3천억원 이상이면 발행주식총수의 1%, 미만이면 3%이며, 부여 후 처음 소집되는 주주총회의 승인을 받아야 합니다.');
      if (capital === null) r.notes.push('자본금을 입력하지 않아 이사회 결의 한도는 3%(자본금 3천억원 미만)로 계산했습니다.');
      r.notes.push('최대주주·주요주주와 그 특수관계인에게는 부여할 수 없습니다(상법 제542조의3제1항 단서, 시행령 제30조제2항). 부여받은 자는 원칙적으로 결의일부터 2년 이상 재임·재직해야 행사할 수 있습니다(제542조의3제4항).');
    } else {
      r.basis.push('「벤처기업육성에 관한 특별법」 제16조의3제3항: 주식회사인 벤처기업은 발행주식총수의 100분의 50까지 부여할 수 있고, 외부 전문가(제1항제3호)에게는 100분의 10을 초과할 수 없습니다.');
      r.outsiderLimitShares = floorPct(total, LIMIT.ventureOutsider);
      r.outsiderAfter = outG + outN;
      r.outsiderExceeds = r.outsiderAfter > r.outsiderLimitShares;
      r.checks.push({ key: 'outsider', label: '외부 전문가 부여 한도 (발행주식총수의 ' + LIMIT.ventureOutsider + '%)', limit: r.outsiderLimitShares, value: r.outsiderAfter, ok: !r.outsiderExceeds });
      r.basis.push('같은 조 제1항: 정관 규정과 주주총회 결의(상법 제434조 준용)가 필요하며, 대상은 임직원, 30% 초과 출자 인수기업의 임직원, 대통령령으로 정하는 외부 전문가입니다.');
      r.notes.push('벤처기업 확인이 유효한 동안 적용됩니다. 확인이 끝나면 상법의 10% 한도가 적용될 수 있으니 유효기간을 확인하세요.');
      r.notes.push('행사가격은 원칙적으로 부여일 시가(신주 발행은 시가와 권면액 중 높은 금액) 이상이어야 하고, 임직원에게 신주 방식으로 부여할 때는 대통령령 요건을 갖추면 시가보다 낮게(권면액 이상) 정할 수 있습니다(제16조의3제4항·제5항).');
    }
    r.notes.push('한도 수량은 소수점을 버린 주식 수입니다. 이미 행사되었거나 취소된 수량은 한도 계산에서 빼고, 부여 후 미행사 잔량만 넣으세요.');
    r.status = r.checks.every(function (c) { return c.ok; }) ? 'OK' : 'EXCEEDS';
    return r;
  }

  var api = { evaluate: evaluate, LIMIT: LIMIT, VERSION: VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OptionLimitRules = api;
})(this);
