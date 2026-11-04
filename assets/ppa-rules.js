/*
 * PPA(사업결합 취득원가 배분) 영업권 간이 계산 로직 (순수 함수, 브라우저·Node 공용)
 *
 * 근거 (2026-11-04 확인)
 *  - K-IFRS 1103(IFRS 3) 문단 32: 영업권 = (이전대가 + 비지배지분 + 단계적 취득 시 이전 보유지분 공정가치)
 *                                       − 식별가능한 취득 자산·인수 부채의 순액
 *  - 문단 34·36: 위 금액이 음수(염가매수)이면 측정을 재검토한 뒤 남는 차익을 취득일에 당기손익으로 인식
 *  - 문단 19: 비지배지분은 공정가치 또는 식별가능 순자산 비례지분으로 측정 (사업결합마다 선택)
 *  - 문단 45: 측정기간(취득일부터 1년 이내) 동안 잠정금액 조정 가능
 *  - 이연법인세: K-IFRS 1012(IAS 12). 영업권 최초 인식에서 생기는 일시적차이에는 이연법인세부채를 인식하지 않음
 *
 * 단위: 백만원(정수로 반올림). 비율: %.
 */
(function (root) {
  'use strict';

  var VERSION = '2026-11-04';

  // IFRS 3 적용사례(IE)의 무형자산 분류
  var INTANGIBLE_TYPES = {
    marketing: { label: '마케팅 관련', examples: '상표·상호, 도메인, 경업금지약정' },
    customer: { label: '고객 관련', examples: '고객관계, 수주잔고, 고객 목록' },
    artistic: { label: '예술 관련', examples: '저작권, 영상·음원 등 콘텐츠' },
    contract: { label: '계약 기반', examples: '라이선스·로열티, 프랜차이즈, 유리한 계약, 사용권' },
    technology: { label: '기술 기반', examples: '특허기술, 미특허기술, 소프트웨어, 데이터베이스' },
  };

  function blank(v) { return v === undefined || v === null || v === ''; }

  function num(v, name, errors, opt) {
    opt = opt || {};
    if (blank(v)) {
      if (opt.optional) return opt.default !== undefined ? opt.default : 0;
      errors.push(name + ': 값을 입력해 주세요.');
      return null;
    }
    var n = Number(v);
    if (!isFinite(n)) { errors.push(name + ': 숫자를 입력해 주세요.'); return null; }
    if (opt.min !== undefined && n < opt.min) { errors.push(name + ': ' + opt.min + ' 이상이어야 합니다.'); return null; }
    if (opt.max !== undefined && n > opt.max) { errors.push(name + ': ' + opt.max + ' 이하여야 합니다.'); return null; }
    if (opt.gt !== undefined && n <= opt.gt) { errors.push(name + ': ' + opt.gt + '보다 커야 합니다.'); return null; }
    return opt.percent ? n : Math.round(n);
  }

  /**
   * @param {object} input
   *  consideration          이전대가(현금·발행주식 공정가치 등, 조건부대가 제외)  [백만원, 필수, >0]
   *  contingentConsideration 조건부대가 취득일 공정가치                              [백만원, 선택]
   *  previousInterestFV     단계적 취득 시 이전 보유지분의 취득일 공정가치          [백만원, 선택]
   *  ownershipPct           취득 후 취득자 보유 지분율                               [%, 0 초과 100 이하]
   *  nciMethod              'proportionate' | 'fair_value'
   *  nciFairValue           비지배지분 공정가치 (fair_value 선택 시)                  [백만원]
   *  bookNetAssets          피취득자 순자산 장부금액 (자본잠식이면 음수)              [백만원, 필수]
   *  adjustments            [{label, amount}] 유형자산·재고 등 공정가치 − 장부금액 (±) [백만원]
   *  intangibles            [{type, label, amount, life}] 새로 식별한 무형자산, life=내용연수(년, 비우면 비한정)
   *  contingentLiabilities  인식할 우발부채 공정가치                                 [백만원, 선택]
   *  applyDeferredTax       공정가치 조정·무형자산에 이연법인세 반영 여부
   *  taxRate                적용 세율                                                [%, 이연법인세 반영 시 필수]
   */
  function evaluate(input) {
    input = input || {};
    var errors = [];
    var r = { version: VERSION, status: null, errors: errors, notes: [], rows: [], amortization: null };

    var consideration = num(input.consideration, '이전대가', errors, { gt: 0 });
    var contingent = num(input.contingentConsideration, '조건부대가', errors, { optional: true, min: 0 });
    var prevFV = num(input.previousInterestFV, '이전 보유지분 공정가치', errors, { optional: true, min: 0 });
    var own = num(input.ownershipPct, '취득 후 보유 지분율', errors, { gt: 0, max: 100, percent: true });
    var book = num(input.bookNetAssets, '피취득자 순자산 장부금액', errors);
    var contLiab = num(input.contingentLiabilities, '우발부채', errors, { optional: true, min: 0 });

    var adjustments = (input.adjustments || []).filter(function (a) { return !blank(a.amount); });
    var adjTotal = 0;
    adjustments.forEach(function (a, i) {
      var v = num(a.amount, '공정가치 조정 ' + (a.label || i + 1), errors);
      if (v !== null) { a.amount = v; adjTotal += v; }
    });

    var intangibles = (input.intangibles || []).filter(function (x) { return !blank(x.amount); });
    var intTotal = 0;
    intangibles.forEach(function (x, i) {
      var name = '무형자산 ' + (x.label || i + 1);
      var v = num(x.amount, name + ' 금액', errors, { min: 0 });
      var life = blank(x.life) ? null : num(x.life, name + ' 내용연수', errors, { gt: 0, max: 50, percent: true });
      if (v !== null) { x.amount = v; intTotal += v; }
      x.life = life;
    });

    var applyDT = !!input.applyDeferredTax;
    var rate = applyDT ? num(input.taxRate, '적용 세율', errors, { min: 0, max: 50, percent: true }) : 0;

    var nciMethod = input.nciMethod === 'fair_value' ? 'fair_value' : 'proportionate';
    var nciFV = null;
    if (own !== null && own < 100 && nciMethod === 'fair_value') {
      nciFV = num(input.nciFairValue, '비지배지분 공정가치', errors, { min: 0 });
    }

    if (errors.length) { r.status = 'INVALID'; return r; }

    // 1) 식별가능 순자산 공정가치
    var stepUp = adjTotal + intTotal - contLiab; // 장부금액 대비 순증가
    var dtl = applyDT ? Math.round(stepUp * rate / 100) : 0; // 음수면 이연법인세자산
    var fvNet = book + stepUp - dtl;

    // 2) 비지배지분
    var nciPct = 100 - own;
    var nci = 0;
    if (nciPct > 0) nci = nciMethod === 'fair_value' ? nciFV : Math.round(fvNet * nciPct / 100);

    // 3) 영업권(또는 염가매수차익)
    var totalConsideration = consideration + contingent;
    var lhs = totalConsideration + nci + prevFV;
    var gw = lhs - fvNet;

    r.status = gw > 0 ? 'GOODWILL' : gw < 0 ? 'BARGAIN' : 'ZERO';
    r.goodwill = gw > 0 ? gw : 0;
    r.bargainGain = gw < 0 ? -gw : 0;
    r.fvNetAssets = fvNet;
    r.deferredTax = dtl;
    r.nci = nci;
    r.nciPct = nciPct;
    r.totalConsideration = totalConsideration;
    r.lhs = lhs;
    r.intangiblesTotal = intTotal;
    r.adjustmentsTotal = adjTotal;

    // 배분표 (취득일 기준)
    r.rows = [
      { label: '피취득자 순자산 장부금액', amount: book },
    ];
    adjustments.forEach(function (a) { r.rows.push({ label: '공정가치 조정: ' + (a.label || '기타'), amount: a.amount, indent: true }); });
    intangibles.forEach(function (x) {
      var t = INTANGIBLE_TYPES[x.type];
      r.rows.push({ label: '무형자산: ' + (x.label || (t ? t.label : '기타')) + (t ? ' (' + t.label + ')' : ''), amount: x.amount, indent: true });
    });
    if (contLiab) r.rows.push({ label: '우발부채', amount: -contLiab, indent: true });
    if (applyDT) r.rows.push({ label: dtl >= 0 ? '이연법인세부채' : '이연법인세자산', amount: -dtl, indent: true });
    r.rows.push({ label: '식별가능 순자산 공정가치 (A)', amount: fvNet, total: true });

    // 상각 영향 (정액법, 연간)
    var amort = 0;
    var indefinite = 0;
    intangibles.forEach(function (x) {
      if (x.life) amort += x.amount / x.life; else indefinite += x.amount;
    });
    if (intTotal > 0) {
      var amortRounded = Math.round(amort);
      var taxEffect = applyDT ? Math.round(amort * rate / 100) : 0;
      r.amortization = { annual: amortRounded, taxEffect: taxEffect, afterTax: amortRounded - taxEffect, indefinite: indefinite };
    }

    // 안내
    if (r.status === 'GOODWILL') {
      r.notes.push('영업권은 상각하지 않고 매년(그리고 손상 징후가 있을 때) 손상검사를 합니다(K-IFRS 1036).');
      r.goodwillRatio = Math.round((r.goodwill / totalConsideration) * 1000) / 10;
    }
    if (r.status === 'BARGAIN') {
      r.notes.push('염가매수차익은 식별가능 자산·부채, 비지배지분, 이전대가의 측정이 적정한지 다시 검토한 뒤에도 남는 경우에만 취득일에 당기손익으로 인식합니다(K-IFRS 1103 문단 34~36).');
    }
    if (intTotal === 0) {
      r.notes.push('새로 식별한 무형자산을 입력하지 않았습니다. 고객관계·기술·상표 등이 식별되면 영업권이 그만큼 줄어듭니다.');
    }
    if (applyDT) {
      r.notes.push('이연법인세는 (공정가치 조정 + 무형자산 − 우발부채) × 적용 세율로 단순 계산했습니다. 세무상 장부가액도 함께 바뀌는 거래(예: 자산 양수로 세무상 취득가액이 공정가치가 되는 경우)라면 이연법인세를 반영하지 않습니다.');
    }
    if (contingent > 0) {
      r.notes.push('조건부대가는 취득일 공정가치로 이전대가에 포함했습니다. 취득일 이후 공정가치 변동은 원칙적으로 영업권을 조정하지 않습니다(측정기간 조정 제외).');
    }
    if (prevFV > 0) {
      r.notes.push('단계적 취득: 이전 보유지분을 취득일 공정가치로 재측정하며, 그 차이는 당기손익(또는 기타포괄손익)으로 인식합니다.');
    }
    if (r.amortization && r.amortization.indefinite > 0) {
      r.notes.push('내용연수를 비운 무형자산(' + r.amortization.indefinite.toLocaleString('ko-KR') + '백만원)은 비한정 내용연수로 보아 상각하지 않고 손상검사 대상으로 계산했습니다.');
    }
    r.notes.push('취득일부터 1년 이내 측정기간에 새로운 정보가 확인되면 잠정금액을 소급 조정할 수 있습니다(K-IFRS 1103 문단 45).');
    return r;
  }

  var api = { evaluate: evaluate, INTANGIBLE_TYPES: INTANGIBLE_TYPES, VERSION: VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PpaRules = api;
})(this);
