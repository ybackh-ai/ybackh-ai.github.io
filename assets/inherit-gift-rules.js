/*
 * 상속·증여세 간이 계산 로직 (순수 함수, 브라우저·Node 공용)
 * 근거: docs/11_상증세계산_로직.md (2026-11-04 법제처 현행 조회)
 *  - 상속세 및 증여세법 제25조·제26조·제27조·제47조·제53조·제53조의2·제55조·제56조·제57조·제69조
 * 입력: 만원 단위 정수. 내부 계산: 원 단위 정수(원 미만 버림).
 */
(function (root) {
  'use strict';

  var RULES_VERSION = '2026-11-04';
  var MAN = 10000;
  var EOK = 100000000;

  // 세율 구간 (제26조): [하한, 누진 기본세액, 세율(%)]
  var BRACKETS = [
    [30 * EOK, 1040000000, 50],
    [10 * EOK, 240000000, 40],
    [5 * EOK, 90000000, 30],
    [1 * EOK, 10000000, 20],
    [0, 0, 10],
  ];
  var MINIMUM = 500000; // 과세최저한 50만원 (제25조②, 제55조②) — 미만이면 부과하지 않음

  // 증여재산공제 한도 (제53조)
  var RELATIONS = {
    spouse: { label: '배우자', limit: 6 * EOK, basis: '제53조제1호' },
    asc_adult: { label: '직계존속(부모·조부모 등) — 수증자 성년', limit: 5000 * MAN, basis: '제53조제2호' },
    asc_minor: { label: '직계존속(부모·조부모 등) — 수증자 미성년', limit: 2000 * MAN, basis: '제53조제2호 단서' },
    desc: { label: '직계비속(자녀·손자녀 등)', limit: 5000 * MAN, basis: '제53조제3호' },
    relative: { label: '그 밖의 친족(4촌 이내 혈족, 3촌 이내 인척)', limit: 1000 * MAN, basis: '제53조제4호' },
    other: { label: '친족이 아닌 사람', limit: 0, basis: '' },
  };
  var MARRIAGE_BIRTH_LIMIT = 1 * EOK; // 제53조의2
  var SKIP_HEAVY_THRESHOLD = 20 * EOK; // 제57조① 괄호: 미성년 + 증여재산가액 20억 초과 → 40%

  function rateTax(base) {
    if (base < MINIMUM) return 0;
    for (var i = 0; i < BRACKETS.length; i++) {
      var b = BRACKETS[i];
      if (base > b[0] || b[0] === 0) return b[1] + Math.floor((base - b[0]) * b[2] / 100);
    }
    return 0;
  }
  function bracketOf(base) {
    for (var i = 0; i < BRACKETS.length; i++) if (base > BRACKETS[i][0] || BRACKETS[i][0] === 0) return BRACKETS[i];
    return BRACKETS[BRACKETS.length - 1];
  }

  function readMan(v, name, errors, required) {
    if (v === undefined || v === null || v === '') {
      if (required) errors.push(name + ': 값을 입력해 주세요.');
      return 0;
    }
    var n = Number(v);
    if (!isFinite(n) || n < 0 || Math.floor(n) !== n) { errors.push(name + ': 0 이상의 정수(만원 단위)로 입력해 주세요.'); return 0; }
    return n * MAN;
  }

  /**
   * @param {object} input
   *  type: 'gift' | 'inherit'
   *  (gift)    amount: 증여재산가액(만원), relation: RELATIONS 키, priorDeduction: 10년 내 같은 구분으로 이미 받은 증여재산공제(만원)
   *            marriageBirth: boolean 혼인·출산 공제 해당, priorMarriageBirth: 이미 받은 혼인·출산 공제(만원)
   *            generationSkip: boolean 수증자가 증여자의 자녀가 아닌 직계비속
   *  (inherit) taxBase: 상속세 과세표준(만원)
   *  fileOnTime: boolean (기본 true) 기한 내 신고 → 신고세액공제
   */
  function calculate(input) {
    input = input || {};
    var errors = [];
    var r = {
      version: RULES_VERSION, status: null, type: input.type, errors: errors,
      amount: null, deduction: 0, deductionItems: [], taxBase: 0, belowMinimum: false,
      computed: 0, bracket: null, surcharge: 0, surchargeRate: 0, filingCredit: 0, payable: 0, basis: [], notes: [],
    };
    var fileOnTime = input.fileOnTime !== false;

    if (input.type === 'gift') {
      var rel = RELATIONS[input.relation];
      if (!rel) errors.push('증여자와의 관계를 선택해 주세요.');
      var amount = readMan(input.amount, '증여재산가액', errors, true);
      var prior = readMan(input.priorDeduction, '이미 받은 증여재산공제', errors, false);
      var priorMB = readMan(input.priorMarriageBirth, '이미 받은 혼인·출산 공제', errors, false);
      var isAsc = input.relation === 'asc_adult' || input.relation === 'asc_minor';
      if (input.generationSkip && !isAsc) errors.push('세대생략 할증은 직계존속(조부모 등)에게서 받은 경우에만 선택할 수 있습니다.');
      if (input.marriageBirth && !isAsc) errors.push('혼인·출산 증여재산공제는 직계존속에게서 받은 경우에만 적용됩니다.');
      if (errors.length) { r.status = 'INVALID'; return r; }

      r.amount = amount;
      r.basis.push('증여세 과세가액: 상속세 및 증여세법 제47조제1항');

      // 증여재산공제 (제53조)
      var remain = Math.max(0, rel.limit - prior);
      var d1 = Math.min(amount, remain);
      if (rel.limit > 0) {
        r.deductionItems.push({ label: '증여재산공제 (' + rel.label + ', 한도 ' + won(rel.limit) + (prior ? ', 10년 내 기공제 ' + won(prior) + ' 차감' : '') + ')', value: d1 });
        r.basis.push('증여재산공제: 같은 법 ' + rel.basis);
      }
      // 혼인·출산 공제 (제53조의2)
      var d2 = 0;
      if (input.marriageBirth) {
        d2 = Math.min(amount - d1, Math.max(0, MARRIAGE_BIRTH_LIMIT - priorMB));
        r.deductionItems.push({ label: '혼인·출산 증여재산공제 (한도 1억원' + (priorMB ? ', 기공제 ' + won(priorMB) + ' 차감' : '') + ')', value: d2 });
        r.basis.push('혼인·출산 증여재산공제: 같은 법 제53조의2');
      }
      r.deduction = d1 + d2;
      r.taxBase = amount - r.deduction;
      r.basis.push('과세표준: 같은 법 제55조제1항제4호');

      r.belowMinimum = r.taxBase < MINIMUM;
      r.computed = rateTax(r.taxBase);
      if (!r.belowMinimum) r.bracket = bracketOf(r.taxBase);
      r.basis.push('세율: 같은 법 제56조(제26조 준용)');

      if (input.generationSkip && r.computed > 0) {
        r.surchargeRate = (input.relation === 'asc_minor' && amount > SKIP_HEAVY_THRESHOLD) ? 40 : 30;
        r.surcharge = Math.floor(r.computed * r.surchargeRate / 100);
        r.basis.push('세대생략 할증 ' + r.surchargeRate + '%: 같은 법 제57조제1항');
        r.notes.push('증여자의 자녀가 사망해 그 자녀(증여자의 손자녀 등)가 받은 경우에는 할증하지 않습니다(제57조제1항 단서).');
      }
      r.notes.push('증여일 전 10년 이내에 같은 사람(직계존속이면 그 배우자 포함)에게서 받은 증여재산이 1천만원 이상이면 합산해 계산합니다(제47조제2항). 이 계산기는 합산과 기납부세액 공제를 반영하지 않습니다.');
    } else if (input.type === 'inherit') {
      var base = readMan(input.taxBase, '상속세 과세표준', errors, true);
      if (errors.length) { r.status = 'INVALID'; return r; }
      r.taxBase = base;
      r.belowMinimum = base < MINIMUM;
      r.computed = rateTax(base);
      if (!r.belowMinimum) r.bracket = bracketOf(base);
      r.basis.push('세율: 상속세 및 증여세법 제26조');
      r.notes.push('과세표준은 상속재산가액에서 상속공제(기초·인적·일괄·배우자 공제 등)를 뺀 금액입니다. 이 계산기는 상속공제를 계산하지 않습니다.');
      r.notes.push('손자녀 등 자녀가 아닌 직계비속이 상속받는 경우의 할증(제27조)은 반영하지 않았습니다.');
    } else {
      errors.push('상속세 또는 증여세를 선택해 주세요.');
      r.status = 'INVALID';
      return r;
    }

    if (r.belowMinimum) {
      r.notes.unshift('과세표준이 50만원 미만이어서 세금을 부과하지 않습니다(' + (input.type === 'gift' ? '제55조제2항' : '제25조제2항') + ').');
    }

    if (fileOnTime && r.computed > 0) {
      r.filingCredit = Math.floor((r.computed + r.surcharge) * 3 / 100);
      r.basis.push('신고세액공제 3%: 같은 법 제69조' + (input.type === 'gift' ? '제2항' : '제1항'));
    }
    r.payable = r.computed + r.surcharge - r.filingCredit;
    r.status = 'OK';
    return r;
  }

  // 원 → "11억 2,985만 6,000원" 형식
  function won(n) {
    if (!n) return '0원';
    var eok = Math.floor(n / EOK), man = Math.floor((n % EOK) / MAN), rest = n % MAN;
    var parts = [];
    if (eok) parts.push(eok.toLocaleString('ko-KR') + '억');
    if (man) parts.push(man.toLocaleString('ko-KR') + '만');
    if (rest) parts.push(rest.toLocaleString('ko-KR'));
    return parts.join(' ') + '원';
  }

  var api = { calculate: calculate, RELATIONS: RELATIONS, BRACKETS: BRACKETS, won: won, RULES_VERSION: RULES_VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.InheritGiftRules = api;
})(this);
