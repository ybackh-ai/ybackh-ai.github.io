/*
 * RCPS·CB 평가 필요 여부 안내 로직 (순수 함수, 브라우저·Node 공용)
 * 근거: docs/21_RCPS_CB_로직.md — K-IFRS 제1032호·제1109호·제1113호 일반 원칙 요약(문단 미인용, 원문 미확인)
 */
(function (root) {
  'use strict';

  var VERSION = '2026-11-04';
  var NAMES = { rcps: '상환전환우선주(RCPS)', cps: '전환우선주(CPS)', rps: '상환우선주(RPS)', cb: '전환사채(CB)', bw: '신주인수권부사채(BW)', eb: '교환사채(EB)' };
  var CLASS_LABEL = {
    liability: '금융부채로 분류될 수 있습니다',
    compound: '부채요소와 자본요소로 나누는 복합금융상품일 수 있습니다',
    equity: '자본(지분상품)으로 분류될 수 있습니다',
    review: '적용 기준에 따라 별도 검토가 필요합니다',
  };

  /**
   * @param {object} input
   *  instrument: NAMES 키, gaap: 'kifrs' | 'kgaap'
   *  holderRedemption, mandatoryDividend, refixing, variableShares, holderPut, callOption, exchangeOwnShares: boolean
   */
  function assess(input) {
    input = input || {};
    var errors = [];
    var r = { version: VERSION, status: null, errors: errors, instrument: input.instrument, name: NAMES[input.instrument] || null,
      classification: null, derivative: 'none', embedded: false, needsValuation: false, remeasure: false, points: [], notes: [] };
    if (!NAMES[input.instrument]) { errors.push('상품 종류를 선택해 주세요.'); r.status = 'INVALID'; return r; }

    var t = input.instrument;
    var pref = t === 'rps' || t === 'cps' || t === 'rcps';
    var convertible = t !== 'rps';
    var variable = !!(input.refixing || input.variableShares);
    var liabilityFeature = !!(input.holderRedemption || input.mandatoryDividend);
    var P = r.points;

    // 1) 분류와 전환권
    if (pref) {
      if (liabilityFeature) P.push({ key: 'liability_feature', title: '현금 지급 의무', text: (input.holderRedemption ? '투자자가 상환을 청구할 수 있어' : '배당을 회피할 수 없어') + ' 회사가 현금 지급 의무를 피할 수 없습니다. 이 부분은 금융부채일 수 있습니다.' });
      else P.push({ key: 'no_liability_feature', title: '현금 지급 의무', text: '투자자 상환청구권이나 회피할 수 없는 배당 의무가 없으면 현금 지급 의무가 없어 자본으로 볼 여지가 있습니다.' });
      if (t === 'rps') {
        r.classification = liabilityFeature ? 'liability' : 'equity';
      } else if (variable) {
        r.classification = 'liability';
        r.derivative = 'separate';
        P.push({ key: 'fixed_for_fixed', title: '전환권 (고정 대 고정)', text: (input.refixing ? '리픽싱 조건으로' : '조건에 따라') + ' 전환할 주식 수가 바뀌어 "확정 금액 대 확정 수량" 조건을 충족하지 못할 수 있습니다. 이 경우 전환권을 파생상품부채로 분리하고 매 결산일 공정가치로 평가해야 할 수 있으며, 변동 수량의 주식을 인도할 의무 때문에 상품 전체가 부채로 분류될 수도 있습니다.' });
      } else {
        r.classification = liabilityFeature ? 'compound' : 'equity';
        if (liabilityFeature) r.derivative = 'equity_component';
        P.push({ key: 'fixed_for_fixed', title: '전환권 (고정 대 고정)', text: '전환가격과 전환주식 수가 고정되어 있으면 전환권은 자본요소가 될 수 있습니다.' });
      }
    } else {
      P.push({ key: 'debt_host', title: '사채 원리금', text: '사채는 원리금 지급 의무가 있어 주계약은 금융부채입니다.' });
      var ownEquity = t !== 'eb' || input.exchangeOwnShares;
      if (!ownEquity) {
        r.classification = 'liability';
        r.derivative = 'separate';
        P.push({ key: 'exchange_other', title: '교환권', text: '다른 회사 주식으로 교환하는 권리는 회사 자신의 지분상품이 아니어서 파생상품으로 분리해 공정가치로 평가해야 할 수 있습니다.' });
      } else if (variable) {
        r.classification = 'liability';
        r.derivative = 'separate';
        P.push({ key: 'fixed_for_fixed', title: (t === 'bw' ? '신주인수권' : t === 'eb' ? '교환권' : '전환권') + ' (고정 대 고정)', text: '리픽싱 등으로 인도할 주식 수가 바뀌면 "확정 금액 대 확정 수량" 조건을 충족하지 못해 파생상품부채로 분리하고 매 결산일 공정가치로 평가해야 할 수 있습니다.' });
      } else {
        r.classification = 'compound';
        r.derivative = 'equity_component';
        P.push({ key: 'fixed_for_fixed', title: (t === 'bw' ? '신주인수권' : t === 'eb' ? '교환권' : '전환권') + ' (고정 대 고정)', text: '행사가격과 주식 수가 고정되어 있으면 자본요소로 보고, 발행금액을 부채요소(공정가치)와 자본요소(나머지)로 나눌 수 있습니다.' });
      }
    }

    // 2) 내재파생상품
    if (input.holderPut || input.callOption) {
      r.embedded = true;
      P.push({ key: 'embedded', title: '조기상환청구권·매도청구권', text: (input.holderPut ? '투자자의 조기상환청구권(풋)' : '') + (input.holderPut && input.callOption ? '과 ' : '') + (input.callOption ? '발행회사·대주주의 매도청구권(콜)' : '') + '이 주계약과 밀접하게 관련되지 않으면 내재파생상품으로 분리해 공정가치로 평가해야 할 수 있습니다. 대주주가 권리·의무를 갖는 조건은 회사의 회계처리 대상인지부터 검토합니다.' });
    }

    // 3) 평가 필요
    r.needsValuation = r.classification === 'liability' || r.classification === 'compound' || r.derivative === 'separate' || r.embedded;
    r.remeasure = r.derivative === 'separate' || r.embedded;
    if (r.needsValuation) {
      P.push({ key: 'valuation', title: '평가가 필요한 시점', text: r.remeasure
        ? '발행일에 부채요소·파생상품을 공정가치로 나누어 측정하고, 분리한 파생상품은 매 결산일 공정가치로 다시 평가해 변동액을 당기손익으로 인식할 수 있습니다. 리픽싱·상환 조건이 있으면 블랙-숄즈보다 이항모형이나 몬테카를로 모형이 주로 쓰입니다.'
        : '발행일에 부채요소를 공정가치로 측정해 발행금액을 나눌 수 있습니다. 이후 부채요소는 유효이자율법으로 상각합니다.' });
      P.push({ key: 'fvpl_option', title: '대안: 전체 공정가치 지정', text: '파생상품을 분리하는 대신 복합계약 전체를 당기손익-공정가치 측정 항목으로 지정하는 방법을 검토할 수 있습니다(요건 충족 시).' });
    }

    if (input.gaap === 'kgaap') {
      r.classification = 'review';
      r.notes.push('위 내용은 K-IFRS 원칙 기준입니다. 일반기업회계기준은 상환우선주·전환권 등의 분류 기준이 달라 같은 조건이라도 결과가 다를 수 있으므로 별도 검토가 필요합니다.');
    }
    r.notes.push('투자계약서의 실제 문구(상환 주체, 상환 조건의 통제 가능성, 리픽싱 하한, 우선배당 조건)에 따라 판단이 달라집니다. 이 안내는 일반 원칙을 요약한 것이며 기준서 문단을 인용한 것이 아닙니다.');
    r.status = 'OK';
    return r;
  }

  var api = { assess: assess, NAMES: NAMES, CLASS_LABEL: CLASS_LABEL, VERSION: VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RcpsCbRules = api;
})(this);
