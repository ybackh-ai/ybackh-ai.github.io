/*
 * 특수관계인 주식 거래 시가 판정 + 특수관계인 범위 확인 (순수 함수, 브라우저·Node 공용). 근거: docs/40_특수관계거래_로직.md
 * 「법인세법 시행령」 제88조제3항·제4항, 「소득세법 시행령」 제167조제3항, 「상속세 및 증여세법」 제35조, 같은 법 시행령 제26조,
 * 「국세기본법 시행령」 제1조의2 (2026-11-09 조회). 금액 입력 만원 → 원 정수.
 */
(function (root) {
  'use strict';
  var VERSION = '2026-11-09';
  var MAN = 10000, EOK = 100000000;
  var T = { corpFixed: 3 * EOK, corpPct: 5, giftFixed: 3 * EOK, giftPct: 30 };
  function blank(v) { return v === undefined || v === null || v === ''; }
  function reader(errors) {
    return function (v, label, opt) {
      opt = opt || {};
      if (blank(v)) { if (opt.optional) return 0; errors.push(label + '을(를) 입력해 주세요.'); return 0; }
      var x = Number(v);
      if (!isFinite(x) || x < 0 || (opt.positive && x <= 0)) { errors.push(label + '은(는) ' + (opt.positive ? '0보다 큰' : '0 이상의') + ' 숫자로 입력해 주세요.'); return 0; }
      return x;
    };
  }

  /**
   * @param input price(거래가, 만원), fair(시가, 만원), related, sellerType/buyerType 'corp'|'person', listedMarket(증권시장 장내 거래)
   */
  function fairPrice(input) {
    input = input || {};
    var errors = [], num = reader(errors);
    var r = { version: VERSION, status: null, errors: errors, notes: [], basis: [] };
    var price = Math.round(num(input.price, '거래가액', { positive: true }) * MAN);
    var fair = Math.round(num(input.fair, '시가', { positive: true }) * MAN);
    if (errors.length) { r.status = 'INVALID'; return r; }
    var related = !!input.related, seller = input.sellerType === 'corp' ? 'corp' : 'person', buyer = input.buyerType === 'corp' ? 'corp' : 'person';
    var low = price < fair, diff = Math.abs(price - fair);
    r.diff = diff; r.low = low; r.diffPct = Math.round(diff / fair * 10000) / 100;
    r.corpThreshold = Math.min(T.corpFixed, Math.floor(fair * T.corpPct / 100));
    // 증여세: 특수관계 → min(시가 30%, 3억), 비특수관계 → 시가 30% (공제 3억)
    r.giftThreshold = related ? Math.min(Math.floor(fair * T.giftPct / 100), T.giftFixed) : Math.floor(fair * T.giftPct / 100);
    var listed = !!input.listedMarket;

    // 법인세 부당행위계산: 법인이 저가 양도하거나 고가 매입한 경우
    var corpLoses = (seller === 'corp' && low) || (buyer === 'corp' && !low && diff > 0);
    r.corpRisk = related && !listed && corpLoses && diff >= r.corpThreshold;
    // 소득세(양도소득) 부당행위계산: 개인이 저가 양도하거나 고가 취득한 경우
    var personLoses = (seller === 'person' && low) || (buyer === 'person' && !low && diff > 0);
    r.incomeRisk = related && !listed && personLoses && diff >= r.corpThreshold;
    // 증여세: 이익을 본 쪽이 개인일 때 (저가 → 양수자, 고가 → 양도자)
    var beneficiary = low ? buyer : seller;
    r.giftApplies = !listed && diff > 0 && beneficiary === 'person';
    r.giftAmount = 0;
    if (r.giftApplies && diff >= r.giftThreshold) r.giftAmount = Math.max(0, diff - (related ? r.giftThreshold : T.giftFixed));
    r.giftRisk = r.giftApplies && diff >= r.giftThreshold;

    r.basis.push('법인세: 「법인세법 시행령」 제88조제3항 — 시가와 거래가의 차액이 3억원 이상이거나 시가의 5% 이상이면 부당행위계산 부인 대상 (기준 ' + r.corpThreshold.toLocaleString('ko-KR') + '원)');
    r.basis.push('양도소득세: 「소득세법 시행령」 제167조제3항 — 특수관계인에게 저가 양도·고가 취득, 같은 3억원·5% 기준');
    r.basis.push('증여세: 「상속세 및 증여세법」 제35조제1항·제2항, 같은 법 시행령 제26조 — 특수관계는 차액이 min(시가 30%, 3억원) 이상이면 (차액 − 기준금액), 비특수관계는 차액이 시가 30% 이상이면 (차액 − 3억원)');
    if (listed) r.notes.push('증권시장에서 장내 거래한 상장주식은 부당행위계산(「법인세법 시행령」 제88조제4항)과 증여세(같은 법 시행령 제26조제1항제2호) 기준을 적용하지 않습니다.');
    if (!related) r.notes.push('특수관계가 없는 거래는 법인세·소득세 부당행위계산 대상이 아니며, 증여세는 "거래 관행상 정당한 사유가 없는 경우"에만 과세됩니다(「상속세 및 증여세법」 제35조제2항).');
    if (beneficiary === 'corp' && diff > 0) r.notes.push('이익을 본 쪽이 법인이면 증여세 대신 법인세(자산수증이익 등) 문제가 될 수 있습니다.');
    r.notes.push('비상장주식 시가는 매매사례가액 등이 없으면 「상속세 및 증여세법」 제63조 보충적 평가방법으로 계산합니다. 이 사이트의 비상장주식 약식 평가 도구를 함께 이용하세요.');
    r.status = (r.corpRisk || r.incomeRisk || r.giftRisk) ? 'RISK' : 'OK';
    return r;
  }

  var RELATIONS = {
    blood4: { label: '4촌 이내 혈족', hit: true, basis: '친족관계 — 「국세기본법 시행령」 제1조의2제1항제1호' },
    inlaw3: { label: '3촌 이내 인척', hit: true, basis: '친족관계 — 같은 항 제2호' },
    spouse: { label: '배우자(사실혼 포함)', hit: true, basis: '친족관계 — 같은 항 제3호' },
    adopted: { label: '친양자로 입양된 친생자와 그 배우자·직계비속', hit: true, basis: '친족관계 — 같은 항 제4호' },
    employee: { label: '임원·사용인', hit: true, basis: '경제적 연관관계 — 같은 조 제2항제1호' },
    dependent: { label: '본인의 재산으로 생계를 유지하는 사람(과 생계를 함께하는 친족)', hit: true, basis: '경제적 연관관계 — 같은 조 제2항제2호·제3호' },
    control30: { label: '본인(친족 등 포함)이 발행주식의 30% 이상 출자한 법인', hit: true, basis: '경영지배관계 — 같은 조 제3항·제4항제1호가목' },
    deFacto: { label: '임원 임면·사업방침 결정 등 경영에 사실상 영향력을 행사하는 법인', hit: true, basis: '경영지배관계 — 같은 조 제4항제1호나목' },
    group: { label: '공정거래법상 같은 기업집단의 계열회사와 그 임원', hit: true, basis: '경영지배관계 — 같은 조 제3항제2호라목' },
    blood5: { label: '5촌 이상 혈족', hit: false },
    inlaw4: { label: '4촌 이상 인척', hit: false },
    under30: { label: '30% 미만 출자, 사실상 영향력 없음', hit: false },
    none: { label: '해당 없음', hit: false }
  };

  /** @param input relations: RELATIONS 키 배열 */
  function scope(input) {
    input = input || {};
    var errors = [];
    var r = { version: VERSION, status: null, errors: errors, notes: [], basis: [], items: [] };
    var list = Array.isArray(input.relations) ? input.relations.filter(function (k) { return RELATIONS[k]; }) : [];
    if (!list.length) { errors.push('관계를 하나 이상 선택해 주세요(없으면 "해당 없음").'); r.status = 'INVALID'; return r; }
    list.forEach(function (k) { var x = RELATIONS[k]; r.items.push({ key: k, label: x.label, hit: x.hit }); if (x.hit) r.basis.push(x.label + ': ' + x.basis); });
    r.hits = r.items.filter(function (x) { return x.hit; }).length;
    r.related = r.hits > 0;
    if (!r.related) r.basis.push('선택한 관계는 「국세기본법」 제2조제20호, 같은 법 시행령 제1조의2의 친족·경제적 연관·경영지배관계에 해당하지 않습니다.');
    r.notes.push('이 결과는 「국세기본법」 기준입니다. 법인세법(시행령 제2조제8항)·상속세 및 증여세법(시행령 제2조의2)·공정거래법은 범위가 조금씩 다르며(예: 소액주주가 아닌 주주, 출자 지분 기준), 그 조문은 아직 원문 대조 전입니다(확실하지 않음).');
    r.notes.push('여러 단계를 거친 간접 지배(친족이 지배하는 법인이 다시 지배하는 법인 등)도 특수관계가 될 수 있습니다.');
    r.status = r.related ? 'RELATED' : 'NOT_RELATED';
    return r;
  }

  var api = { fairPrice: fairPrice, scope: scope, RELATIONS: RELATIONS, T: T, VERSION: VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RelatedPartyRules = api;
})(this);
