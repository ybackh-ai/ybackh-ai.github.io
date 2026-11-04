/*
 * 자본시장법 외부평가 대상 판정 로직 (순수 함수, 브라우저·Node 공용)
 * 근거: docs/18_외부평가대상_로직.md (2026-11-04 법제처 조회)
 *  - 자본시장법 제165조의4, 시행령 제171조제2항, 제176조의5제8항~제10항·제13항, 제176조의6제1항·제4항
 * ⚠ 2026-12-09 시행 법률 개정으로 제165조의4가 바뀌며, 시행령 기준도 바뀔 수 있다(PENDING_CHANGE).
 */
(function (root) {
  'use strict';

  var VERSION = '2026-11-04';
  var IMPORTANT_PCT = 10; // 시행령 제171조제2항: 10% 이상
  var PENDING_CHANGE = '2026년 12월 9일부터 개정 자본시장법 제165조의4가 시행됩니다. 합병 등의 가액을 주식가격·자산가치·수익가치 등을 종합 고려한 공정한 가액으로 정하고, 이사회 의견서와 외부평가 결과를 공시하며, 계열회사 간 합병 등은 감사(감사위원회)가 외부평가기관을 선정합니다. 이에 맞춰 시행령의 외부평가 대상 기준이 바뀔 수 있으므로 거래 시점의 법령을 다시 확인해야 합니다.';
  var TYPES = { merger: '합병', business_transfer: '중요한 영업·자산 양수·양도', share_exchange: '주식의 포괄적 교환', share_transfer: '주식의 포괄적 이전', split_merger: '분할합병', split: '단순분할' };

  var D = '자본시장과 금융투자업에 관한 법률 시행령';

  /**
   * @param {object} input
   *  dealType: TYPES 키
   *  weListed, weKonex, weSpac: 당사가 주권상장법인 / 코넥스 상장 / 기업인수목적회사
   *  counterpartyType: 'listed' | 'unlisted'   상대 법인
   *  affiliate: 상대 법인이 계열회사(최근 1년 이내 포함)
   *  weUsesAssetEarnings: 당사 합병가액이 시행령 제176조의5제1항제2호나목(자산가치·수익가치)
   *  counterpartyUsesAssetEarnings: (기업인수목적회사 합병) 상대 상장법인이 ①2나 가액
   *  becomesUnlisted: 합병 후 당사가 주권비상장법인이 됨
   *  backdoor: 시행령 제176조의5제4항 합병(비상장법인이 더 커 상장요건 적용)
   *  whollyOwnedNoNewShares: 발행주식 총수를 가진 자회사를 신주 발행 없이 합병
   *  ratios: { assets, sales, liabilities } (영업·자산 양수도) 최근 사업연도 말 대비 비율(%)
   *  important: boolean (영업·자산 양수도) 비율 대신 "중요한 양수·양도에 해당" 직접 선택
   *  assetViaMarket: 증권시장 매매·경매 등 금융위 고시 예외
   *  exchangeAffiliateException / transferAffiliateException: §176조의6④2·3호 예외
   */
  function evaluate(input) {
    input = input || {};
    var errors = [];
    var r = { version: VERSION, status: null, reason: '', basis: [], notes: [], errors: errors, dealLabel: TYPES[input.dealType] || null, important: null };

    if (!TYPES[input.dealType]) errors.push('거래 유형을 선택해 주세요.');
    if (input.dealType === 'business_transfer') {
      var rt = input.ratios || {};
      var vals = ['assets', 'sales', 'liabilities'].map(function (k) { return rt[k]; }).filter(function (v) { return v !== undefined && v !== null && v !== ''; });
      vals.forEach(function (v) { var n = Number(v); if (!isFinite(n) || n < 0) errors.push('비율은 0 이상의 숫자로 입력해 주세요.'); });
      if (!vals.length && !input.important) errors.push('영업·자산 양수·양도는 자산·매출·부채 비율을 입력하거나 "중요한 양수·양도에 해당"을 선택해 주세요.');
      if (!errors.length) r.important = !!input.important || vals.some(function (v) { return Number(v) >= IMPORTANT_PCT; });
    }
    if (errors.length) { r.status = 'INVALID'; return r; }

    r.notes.push(PENDING_CHANGE);

    if (!input.weListed) {
      r.status = 'NOT_APPLICABLE';
      r.reason = '당사가 주권상장법인이 아니면 자본시장법 제165조의4의 합병 등 특례(외부평가)가 적용되지 않습니다.';
      r.basis.push('자본시장법 제165조의4제1항');
      return r;
    }

    if (input.dealType === 'business_transfer' && !r.important) {
      r.status = 'NOT_APPLICABLE';
      r.reason = '자산·매출·부채 비율이 모두 10% 미만이어서 "중요한 영업 또는 자산의 양수·양도"에 해당하지 않습니다.';
      r.basis.push('자본시장법 제165조의4제1항제2호, ' + D + ' 제176조의6제1항, 제171조제2항');
      return r;
    }

    if (input.dealType === 'merger') return merger(input, r);
    if (input.dealType === 'split') {
      r.status = 'NOT_REQUIRED';
      r.reason = '단순분할은 현행 시행령에서 외부평가를 받아야 하는 거래로 정하고 있지 않습니다.';
      r.basis.push('자본시장법 제165조의4제1항제4호, ' + D + ' 제176조의6제4항(분할합병만 열거)');
      r.notes.push('단순분할은 현행 시행령 제176조의6제4항의 외부평가 대상 목록에 없습니다. 개정 법률 시행 후 달라질 수 있습니다.');
      return r;
    }
    return others(input, r);
  }

  function required(r, reason, clause) { r.status = 'REQUIRED'; r.reason = reason; r.basis.push('자본시장법 제165조의4제2항, ' + D + ' ' + clause); }
  function notRequired(r, reason, clause) { r.status = 'NOT_REQUIRED'; r.reason = reason; if (clause) r.basis.push(D + ' ' + clause); }

  function merger(input, r) {
    var cpListed = input.counterpartyType === 'listed';
    var wholly = !!input.whollyOwnedNoNewShares;
    if (input.weSpac) {
      if (cpListed && input.counterpartyUsesAssetEarnings) {
        required(r, '기업인수목적회사가 다른 주권상장법인과 합병하면서 그 상장법인이 자산가치·수익가치로 산정한 합병가액에 따릅니다.', '제176조의5제8항제4호');
      } else {
        notRequired(r, '기업인수목적회사의 이 합병은 시행령 제176조의5제8항의 외부평가 대상에 해당하지 않습니다. 기업인수목적회사의 합병가액은 같은 조 제1항·제3항에 따릅니다.', '제176조의5제8항');
      }
      return finish(input, r);
    }
    if (!input.affiliate) {
      if (input.weKonex) notRequired(r, '코넥스시장 상장법인이 계열회사 외의 법인과 합병하는 경우는 외부평가 대상에서 제외됩니다.', '제176조의5제8항제3호 괄호');
      else required(r, '주권상장법인이 계열회사 외의 법인과 합병합니다.', '제176조의5제8항제3호');
      return finish(input, r);
    }
    if (cpListed) {
      // 1호다목(합병 후 비상장)은 "기준시가(①1)에 따르는 경우"를 예외로 하므로, 남는 경우는 ①2나 가액 사용 → 1호나목과 겹친다.
      if (input.weUsesAssetEarnings) required(r, '계열회사인 주권상장법인과 합병하면서 자산가치·수익가치로 산정한 합병가액에 따릅니다.', '제176조의5제8항제1호나목' + (input.becomesUnlisted ? '·다목' : ''));
      else notRequired(r, '계열회사인 주권상장법인과 기준시가(시행령 제176조의5제1항제1호)로 합병하는 경우로, 제8항제1호의 외부평가 대상에 해당하지 않습니다.', '제176조의5제8항제1호');
      return finish(input, r);
    }
    // 계열 비상장법인과 합병 (2호)
    if (input.weUsesAssetEarnings) required(r, '계열회사인 주권비상장법인과 합병하면서 당사가 자산가치·수익가치로 산정한 합병가액에 따릅니다.', '제176조의5제8항제2호가목');
    else if (input.backdoor && !wholly) required(r, '계열 비상장법인이 더 커서 상장요건을 적용받는 합병(시행령 제176조의5제4항)입니다.', '제176조의5제8항제2호나목');
    else if (input.becomesUnlisted && !input.weKonex && !wholly) required(r, '계열 비상장법인과 합병해 주권비상장법인이 됩니다.', '제176조의5제8항제2호다목');
    else {
      notRequired(r, '시행령 제176조의5제8항제2호 가·나·다목 어디에도 해당하지 않는 것으로 보입니다.', '제176조의5제8항제2호');
      r.notes.push('제2호가목 "주권상장법인이 자산가치·수익가치로 산정된 합병가액에 따르는 경우"를 문언대로 당사의 합병가액 기준으로 판단했습니다. 상장법인은 기준시가, 비상장법인은 자산·수익가치를 쓰는 경우의 해석은 확인하지 않았으므로 반드시 전문가와 확인하시기 바랍니다.');
      if (wholly && (input.backdoor || input.becomesUnlisted)) r.notes.push('발행주식 총수를 가진 자회사를 신주 발행 없이 합병하는 경우의 예외를 적용했습니다.');
    }
    return finish(input, r);
  }

  function others(input, r) {
    var t = input.dealType;
    if (t === 'business_transfer' && input.assetViaMarket) notRequired(r, '증권시장을 통한 증권 매매, 자산 경매 등 외부평가 필요성이 적은 양수·양도로서 금융위원회 고시에 해당하면 외부평가를 받지 않을 수 있습니다.', '제176조의6제4항제1호');
    else if (t === 'share_exchange' && input.exchangeAffiliateException) notRequired(r, '완전자회사가 되는 주권상장법인이 완전모회사가 되는 주권상장법인의 계열회사입니다.', '제176조의6제4항제2호');
    else if (t === 'share_transfer' && input.transferAffiliateException) notRequired(r, '완전자회사가 되는 주권상장법인이 다른 완전자회사 상장법인의 계열회사이고 완전모회사가 주권상장법인입니다.', '제176조의6제4항제3호');
    else if (input.weKonex && input.counterpartyType === 'unlisted') notRequired(r, '코넥스시장 상장법인과 주권비상장법인 간의 거래입니다.', '제176조의6제4항제4호');
    else required(r, TYPES[t] + '의 가액 또는 비율의 적정성에 대해 외부평가기관의 평가를 받아야 합니다.', '제176조의6제4항');
    return finish(input, r);
  }

  function finish(input, r) {
    if (r.status === 'REQUIRED') {
      r.notes.push('외부평가기관은 인수업무 인가를 받은 투자매매·중개업자, 신용평가회사, 회계법인이며, 평가 대상 회사와 특수관계가 있으면 평가할 수 없습니다(시행령 제176조의5제9항·제13항).');
      if (input.affiliate) r.notes.push('계열회사와의 거래이므로 외부평가기관 선정에 감사의 동의(감사위원회가 있으면 감사위원회 의결)를 받아야 합니다(시행령 제176조의5제10항, 제176조의6제5항).');
    }
    if (input.dealType === 'merger') r.notes.push('합병에 관한 이사회 결의 전에 합병 목적, 합병가액·합병비율의 적정성 등에 관한 이사회 의견서를 작성해야 합니다(시행령 제176조의5제6항).');
    return r;
  }

  var api = { evaluate: evaluate, TYPES: TYPES, VERSION: VERSION, PENDING_CHANGE: PENDING_CHANGE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ExternalValuationRules = api;
})(this);
