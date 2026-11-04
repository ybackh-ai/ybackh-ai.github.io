/*
 * 영업권·지분 손상검사 간이 진단 로직 (순수 함수, 브라우저·Node 공용). 근거: docs/32_손상검사_로직.md
 * K-IFRS 제1036호의 일반 원칙 요약(회수가능액 = max(순공정가치, 사용가치), 손상차손 = 장부금액 − 회수가능액,
 * 현금창출단위 손상은 영업권부터 감액). 기준서 원문 문단은 대조하지 않음 → 베타.
 */
(function (root) {
  'use strict';
  var VERSION = '2026-11-04';
  function r2(n) { return Math.round(n * 100) / 100; }
  function blank(v) { return v === undefined || v === null || v === ''; }

  /** 사용가치 간이 계산: 명시 기간 현금흐름 + (선택) 영구성장 종료가치, 기말 할인 */
  function valueInUse(cashflows, rate, growth) {
    var pv = 0, last = null;
    for (var i = 0; i < cashflows.length; i++) { pv += cashflows[i] / Math.pow(1 + rate, i + 1); last = cashflows[i]; }
    var tv = 0;
    if (growth !== null && last !== null && rate > growth) { tv = last * (1 + growth) / (rate - growth) / Math.pow(1 + rate, cashflows.length); }
    return { pvExplicit: r2(pv), pvTerminal: r2(tv), total: r2(pv + tv) };
  }

  /**
   * @param input
   *  carryingAmount: 현금창출단위(또는 지분) 장부금액 합계 — 영업권 포함
   *  goodwill: 그중 영업권 (선택, 지분 손상이면 0)
   *  fvlcd: 처분부대원가 차감 후 공정가치 (선택)
   *  viu: 사용가치 (선택) — 없으면 cashflows·discountRate 로 계산
   *  cashflows: 연도별 현금흐름 배열(최대 5), discountRate: 세전 할인율 %, terminalGrowth: 영구성장률 % (선택)
   */
  function evaluate(input) {
    input = input || {};
    var errors = [];
    var r = { version: VERSION, status: null, errors: errors, basis: [], notes: [] };
    function num(k, label, opt) { if (blank(input[k])) { if (!opt) errors.push(label + '을(를) 입력해 주세요.'); return null; } var n = Number(input[k]); if (!isFinite(n)) { errors.push(label + '은(는) 숫자로 입력해 주세요.'); return null; } return n; }
    var ca = num('carryingAmount', '장부금액'), gw = num('goodwill', '영업권', true), fv = num('fvlcd', '순공정가치', true), viu = num('viu', '사용가치', true);
    if (gw === null) gw = 0;
    if (ca !== null && ca < 0) errors.push('장부금액은 0 이상이어야 합니다.');
    if (gw < 0) errors.push('영업권은 0 이상이어야 합니다.');
    if (ca !== null && gw > ca) errors.push('영업권은 장부금액 합계를 넘을 수 없습니다.');
    var cfs = Array.isArray(input.cashflows) ? input.cashflows.filter(function (x) { return !blank(x); }).map(Number) : [];
    var rate = num('discountRate', '할인율', true), g = num('terminalGrowth', '영구성장률', true);
    var viuCalc = null;
    if (viu === null && cfs.length) {
      if (cfs.some(function (x) { return !isFinite(x); })) errors.push('현금흐름은 숫자로 입력해 주세요.');
      if (rate === null || rate <= -100) errors.push('사용가치를 계산하려면 할인율(%)을 입력해 주세요.');
      else if (g !== null && g >= rate) errors.push('영구성장률은 할인율보다 작아야 합니다.');
    }
    if (errors.length) { r.status = 'INVALID'; return r; }
    if (viu === null && cfs.length) {
      viuCalc = valueInUse(cfs, rate / 100, g === null ? null : g / 100);
      viu = viuCalc.total;
      r.viuDetail = viuCalc;
      // 할인율 ±1%p 민감도
      r.viuSensitivity = { down: valueInUse(cfs, (rate - 1) / 100, g === null ? null : g / 100).total, up: valueInUse(cfs, (rate + 1) / 100, g === null ? null : g / 100).total };
    }
    if (fv === null && viu === null) { errors.push('순공정가치 또는 사용가치(또는 현금흐름과 할인율) 중 하나는 있어야 합니다.'); r.status = 'INVALID'; return r; }

    r.carryingAmount = ca; r.goodwill = gw; r.fvlcd = fv; r.viu = viu;
    r.recoverable = fv === null ? viu : viu === null ? fv : Math.max(fv, viu);
    r.recoverableBasis = fv !== null && viu !== null ? (fv >= viu ? '순공정가치' : '사용가치') : (fv !== null ? '순공정가치' : '사용가치');
    r.loss = ca > r.recoverable ? r2(ca - r.recoverable) : 0;
    r.impaired = r.loss > 0;
    r.lossToGoodwill = r2(Math.min(r.loss, gw));
    r.lossToOthers = r2(r.loss - r.lossToGoodwill);
    r.headroom = r.impaired ? 0 : r2(r.recoverable - ca);
    r.headroomPct = ca > 0 && !r.impaired ? r2(r.headroom / ca * 100) : null;
    r.status = r.impaired ? 'IMPAIRED' : (r.headroomPct !== null && r.headroomPct < 10 ? 'THIN' : 'OK');

    r.basis.push('손상차손 = 장부금액 − 회수가능액(양수인 경우). 회수가능액은 처분부대원가를 뺀 공정가치와 사용가치 중 큰 금액입니다.');
    r.basis.push('현금창출단위에 배분된 영업권이 있으면 손상차손을 먼저 영업권에서 줄이고, 남는 금액을 단위 내 다른 자산의 장부금액 비율로 배분합니다. 개별 자산은 자기 회수가능액(또는 0) 아래로 줄이지 않습니다.');
    r.basis.push('영업권과 비한정 내용연수 무형자산은 손상 징후가 없어도 매년 손상검사를 하며, 그 밖의 자산은 손상 징후가 있을 때 검사합니다.');
    r.basis.push('근거: K-IFRS 제1036호 「자산손상」의 일반 원칙(기준서 원문 문단은 이 사이트에서 대조하지 않음 — 확실하지 않음). 일반기업회계기준 적용 회사는 제20장을 따릅니다.');
    if (viuCalc) r.notes.push('사용가치는 입력한 현금흐름을 기말 할인하고, 영구성장률이 있으면 마지막 연도 현금흐름 × (1+g) ÷ (r−g)를 종료가치로 더한 간이 계산입니다. 기준서는 세전 할인율과 승인된 예산 기준 최대 5년 추정을 원칙으로 합니다.');
    if (r.lossToOthers > 0) r.notes.push('영업권을 전부 줄여도 손상차손이 남습니다. 남은 ' + r.lossToOthers.toLocaleString('ko-KR') + '은(는) 유형자산·무형자산 등에 장부금액 비례로 배분해야 하며, 이 계산기는 개별 자산 배분까지는 하지 않습니다.');
    if (r.status === 'THIN') r.notes.push('회수가능액이 장부금액을 10% 미만으로만 웃돕니다. 할인율·성장률 가정이 조금만 바뀌어도 손상이 날 수 있으므로 민감도 분석과 공시(주요 가정)를 준비하세요.');
    if (gw === 0) r.notes.push('영업권이 없는 지분·개별 자산 손상검사로 계산했습니다. 종속·관계기업 투자주식의 손상은 별도재무제표에서 투자주식 장부금액과 회수가능액을 비교합니다.');
    r.notes.push('영업권 손상차손은 이후 환입할 수 없습니다. 영업권 외 자산의 손상은 추정 변경 시 환입할 수 있습니다.');
    return r;
  }

  var api = { evaluate: evaluate, valueInUse: valueInUse, VERSION: VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ImpairmentRules = api;
})(this);
