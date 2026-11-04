/*
 * 중소기업 해당 여부 판정 로직 (순수 함수, 브라우저·Node 공용)
 * 근거: docs/10_중소기업판정_로직.md (2026-11-04 법제처 현행 조회)
 *  - 중소기업기본법 제2조, 시행령 제3조·제4조·제7조·제7조의2·제8조, 별표 1·별표 3(2025-10-01 개정)
 * 금액 입력 단위: 억원. 내부 비교는 백만원 정수. 매출 기준은 "이하", 자산은 "5천억원 미만".
 */
(function (root) {
  'use strict';

  var RULES_VERSION = '2026-11-04';
  var ASSET_LIMIT = 500000; // 5천억원 (백만원), 영 §3①1나 "미만"

  // [분류기호, 업종명, 중소기업 기준(억원, 별표 1), 소기업 기준(억원, 별표 3)]
  var TABLE = [
    ['C17', '펄프, 종이 및 종이제품 제조업', 1800, 80],
    ['C24', '1차 금속 제조업', 1800, 140],
    ['C28', '전기장비 제조업', 1800, 120],
    ['C14', '의복, 의복 액세서리 및 모피제품 제조업', 1500, 120],
    ['C15', '가죽, 가방 및 신발 제조업', 1500, 120],
    ['C32', '가구 제조업', 1500, 120],
    ['C10', '식료품 제조업', 1200, 120],
    ['C20', '화학물질 및 화학제품 제조업(의약품 제조업 제외)', 1200, 120],
    ['C22', '고무 및 플라스틱제품 제조업', 1200, 80],
    ['C25', '금속가공제품 제조업(기계 및 가구 제조업 제외)', 1200, 120],
    ['C29', '기타 기계 및 장비 제조업', 1200, 120],
    ['C30', '자동차 및 트레일러 제조업', 1200, 120],
    ['C31', '기타 운송장비 제조업', 1200, 80],
    ['F', '건설업', 1200, 80],
    ['G', '도매 및 소매업', 1200, 60],
    ['A', '농업, 임업 및 어업', 1000, 80],
    ['B', '광업', 1000, 80],
    ['C12', '담배 제조업', 1000, 80],
    ['C13', '섬유제품 제조업(의복 제조업 제외)', 1000, 80],
    ['C16', '목재 및 나무제품 제조업(가구 제조업 제외)', 1000, 80],
    ['C19', '코크스, 연탄 및 석유정제품 제조업', 1000, 140],
    ['C26', '전자부품, 컴퓨터, 영상, 음향 및 통신장비 제조업', 1000, 120],
    ['C33', '기타 제품 제조업', 1000, 80],
    ['D', '전기, 가스, 증기 및 공기조절 공급업', 1000, 120],
    ['E36', '수도업', 1000, 120],
    ['H', '운수 및 창고업', 1000, 100],
    ['J', '정보통신업', 1000, 50],
    ['C11', '음료 제조업', 800, 120],
    ['C18', '인쇄 및 기록매체 복제업', 800, 80],
    ['C21', '의료용 물질 및 의약품 제조업', 800, 120],
    ['C23', '비금속 광물제품 제조업', 800, 120],
    ['C27', '의료, 정밀, 광학기기 및 시계 제조업', 800, 80],
    ['E', '수도, 하수 및 폐기물 처리, 원료 재생업(수도업 제외)', 800, 40],
    ['N', '사업시설 관리, 사업 지원 및 임대 서비스업(임대업 제외)', 800, 30],
    ['C34', '산업용 기계 및 장비 수리업', 600, 15],
    ['M', '전문, 과학 및 기술 서비스업', 600, 30],
    ['Q', '보건업 및 사회복지 서비스업', 600, 15],
    ['R', '예술, 스포츠 및 여가관련 서비스업', 600, 30],
    ['S', '수리 및 기타 개인 서비스업(협회 및 단체 제외)', 600, 15],
    ['I', '숙박 및 음식점업', 400, 15],
    ['K', '금융 및 보험업', 400, 100],
    ['L', '부동산업', 400, 40],
    ['N76', '임대업(부동산 임대업 제외)', 400, 30],
    ['P', '교육 서비스업', 400, 15],
  ];
  var INDUSTRIES = TABLE.map(function (r) { return { code: r[0], name: r[1], smeLimit: r[2], smallLimit: r[3] }; });
  var BY_CODE = {};
  INDUSTRIES.forEach(function (x) { BY_CODE[x.code] = x; });

  function toMillion(eok) { return Math.round(Number(eok) * 100); }
  function isBlank(v) { return v === undefined || v === null || v === ''; }
  function fmt(n) { return Number(n).toLocaleString('ko-KR', { maximumFractionDigits: 2 }); }

  /**
   * @param {object} input
   *  industry: 분류기호 (INDUSTRIES의 code) 또는 'OTHER'(표에 없는 업종)
   *  sales: number[]  12개월 사업연도 매출액(억원), 최근 연도부터 1~3개
   *  startup: boolean 12개월 사업연도가 없음(창업·합병·분할 초기)
   *  assets: number   직전 사업연도 말 자산총액(억원)
   *  groupAffiliate: boolean  공시대상기업집단 소속
   *  bigOwner: boolean        자산 5천억원 이상 법인이 30% 이상 소유한 최다출자자
   *  affiliated: boolean      관계기업에 속함
   *  formerSme: boolean       이전에 중소기업이었다가 규모 확대로 벗어남
   */
  function evaluate(input) {
    input = input || {};
    var errors = [];
    var r = { version: RULES_VERSION, status: null, size: null, industry: null, avgSales: null, salesYears: 0, assets: null, reasons: [], basis: [], notes: [], errors: errors };

    if (isBlank(input.industry)) errors.push('주된 업종을 선택해 주세요.');
    var ind = BY_CODE[input.industry] || null;
    r.industry = ind;

    var salesM = [];
    if (!input.startup) {
      var list = Array.isArray(input.sales) ? input.sales.filter(function (v) { return !isBlank(v); }) : [];
      if (list.length < 1 || list.length > 3) errors.push('12개월 사업연도 매출액을 1~3개 입력해 주세요.');
      list.forEach(function (v) {
        var n = Number(v);
        if (!isFinite(n) || n < 0) errors.push('매출액은 0 이상의 숫자로 입력해 주세요.');
        else salesM.push(toMillion(n));
      });
    }
    var assetsM = null;
    if (isBlank(input.assets)) errors.push('자산총액을 입력해 주세요.');
    else {
      var a = Number(input.assets);
      if (!isFinite(a) || a < 0) errors.push('자산총액은 0 이상의 숫자로 입력해 주세요.');
      else assetsM = toMillion(a);
    }
    if (errors.length) { r.status = 'INVALID'; r.errors = unique(errors); return r; }

    r.assets = assetsM / 100;

    if (!ind) {
      r.status = 'REVIEW';
      r.reasons.push('선택하신 업종은 중소기업기본법 시행령 별표 1의 업종 목록에 없어 이 계산기로 판정할 수 없습니다.');
      r.basis.push('중소기업기본법 시행령 제3조제1항제1호가목, 별표 1');
      return r;
    }

    // 평균매출액등 (영 §7②1·2): 12개월 사업연도 매출 합 ÷ 사업연도 수
    var sum = 0;
    salesM.forEach(function (v) { sum += v; });
    var n = salesM.length;
    if (n) {
      r.salesYears = n;
      r.avgSales = Math.round(sum / n) / 100;
    }

    // 제외 사유
    if (input.groupAffiliate) {
      r.reasons.push('공시대상기업집단에 속하는 회사는 중소기업에서 제외됩니다.');
      r.basis.push('중소기업기본법 제2조제1항 단서');
    }
    if (assetsM >= ASSET_LIMIT) {
      r.reasons.push('직전 사업연도 말 자산총액이 5천억원 이상입니다(5천억원 미만이어야 함).');
      r.basis.push('중소기업기본법 시행령 제3조제1항제1호나목');
    }
    if (n && sum > ind.smeLimit * 100 * n) {
      r.reasons.push('평균매출액등 ' + fmt(r.avgSales) + '억원이 ' + ind.name + ' 기준 ' + fmt(ind.smeLimit) + '억원을 넘습니다.');
      r.basis.push('중소기업기본법 시행령 제3조제1항제1호가목, 별표 1');
    }
    if (input.bigOwner) {
      r.reasons.push('자산총액 5천억원 이상인 법인이 주식등의 30% 이상을 소유한 최다출자자입니다(독립성 기준 불충족).');
      r.basis.push('중소기업기본법 시행령 제3조제1항제2호나목');
    }

    if (r.reasons.length) {
      r.status = 'NOT_SME';
      if (input.formerSme) {
        r.notes.push('규모 확대 등으로 중소기업에 해당하지 않게 된 경우, 그 사유가 발생한 연도의 다음 연도부터 5년간은 중소기업으로 봅니다(중소기업기본법 제2조제3항). ' +
          '다만 중소기업이 아닌 기업과 합병한 경우, 공시대상기업집단에 속하게 된 경우, 유예 기간 중 다시 중소기업이 되었다가 벗어난 경우 등은 제외됩니다(같은 항 단서, 시행령 제9조).');
      }
      return r;
    }

    if (input.affiliated || input.startup) {
      r.status = 'REVIEW';
      if (input.affiliated) {
        r.reasons.push('관계기업에 속하는 경우 지배·종속기업의 평균매출액등을 합산해 다시 판단해야 합니다.');
        r.basis.push('중소기업기본법 시행령 제3조제1항제2호다목, 제3조의2, 제7조의4');
      }
      if (input.startup) {
        r.reasons.push('12개월인 사업연도가 없으면 월 매출액을 연간으로 환산해 산정합니다. 이 계산기는 이 경우를 다루지 않습니다.');
        r.basis.push('중소기업기본법 시행령 제7조제2항제3호');
      }
      return r;
    }

    r.status = 'SME';
    r.basis.push('중소기업기본법 제2조제1항제1호, 시행령 제3조제1항, 별표 1');
    var small = sum <= ind.smallLimit * 100 * n;
    r.size = small ? 'small' : 'medium';
    r.basis.push(small ? '시행령 제8조제1항, 별표 3 — 평균매출액등 ' + fmt(ind.smallLimit) + '억원 이하' : '시행령 제8조제2항 — 소기업 기준(' + fmt(ind.smallLimit) + '억원) 초과');
    return r;
  }

  function unique(arr) { return arr.filter(function (v, i) { return arr.indexOf(v) === i; }); }

  /**
   * 세법상 중소기업 (조세특례제한법 시행령 제2조) — docs/23_세법상중소기업_로직.md
   * @param {object} input
   *  industry, sales(해당 과세연도 매출액, 억원), assets(과세연도 말 자산총액, 억원)
   *  groupAffiliate, bigOwner, affiliated: 기본법과 같은 독립성 질문
   *  realEstateRental: 부동산 임대업이 주된 사업 / consumptionService: 소비성서비스업이 주된 사업
   *  passiveCompany: 법인세법 시행령 제42조제2항 세 요건을 모두 갖춤
   *  inGrace: 이전에 중소기업이었고 유예기간(사유 발생 과세연도 + 다음 5개, 상장 시 7개) 안
   *  mergedNonSme, mergedGrace, startupExceed: 유예 배제 사유 (영 §2② 단서 1·2·4호)
   */
  function evaluateTax(input) {
    input = input || {};
    var errors = [];
    var r = { version: RULES_VERSION, status: null, industry: null, sales: null, assets: null, reasons: [], basis: [], notes: [], errors: errors };
    if (isBlank(input.industry)) errors.push('주된 업종을 선택해 주세요.');
    var salesM = null, assetsM = null;
    [['sales', '해당 과세연도 매출액'], ['assets', '과세연도 말 자산총액']].forEach(function (p) {
      var v = input[p[0]];
      if (isBlank(v)) { errors.push(p[1] + '을 입력해 주세요.'); return; }
      var n = Number(v);
      if (!isFinite(n) || n < 0) { errors.push(p[1] + '은 0 이상의 숫자로 입력해 주세요.'); return; }
      if (p[0] === 'sales') salesM = toMillion(n); else assetsM = toMillion(n);
    });
    if (errors.length) { r.status = 'INVALID'; return r; }
    var ind = BY_CODE[input.industry] || null;
    r.industry = ind; r.sales = salesM / 100; r.assets = assetsM / 100;
    var T = '조세특례제한법 시행령 제2조';
    if (!ind) {
      r.status = 'REVIEW';
      r.reasons.push('선택하신 업종은 중소기업기본법 시행령 별표 1의 업종 목록에 없어 판정할 수 없습니다.');
      r.basis.push(T + '제1항제1호');
      return r;
    }

    var sizeFail = [], hardFail = [];
    if (assetsM >= ASSET_LIMIT) { sizeFail.push('과세연도 말 자산총액이 5천억원 이상입니다.'); r.basis.push(T + '제1항 각 호 외의 부분 단서'); }
    if (salesM > ind.smeLimit * 100) { sizeFail.push('해당 과세연도 매출액 ' + fmt(r.sales) + '억원이 ' + ind.name + ' 기준 ' + fmt(ind.smeLimit) + '억원을 넘습니다.'); r.basis.push(T + '제1항제1호, 중소기업기본법 시행령 별표 1'); }
    if (input.groupAffiliate) { hardFail.push('공시대상기업집단에 속하는 회사입니다.'); r.basis.push(T + '제1항제3호'); }
    if (input.bigOwner) { hardFail.push('자산총액 5천억원 이상 법인이 30% 이상 소유한 최다출자자입니다(독립성 기준 불충족).'); r.basis.push(T + '제1항제3호, 중소기업기본법 시행령 제3조제1항제2호나목'); }
    if (input.realEstateRental) { hardFail.push('부동산 임대업을 주된 사업으로 합니다.'); r.basis.push(T + '제1항제4호'); }
    if (input.consumptionService) { hardFail.push('소비성서비스업(호텔·여관업, 유흥·단란주점 등)을 주된 사업으로 합니다.'); r.basis.push(T + '제1항제4호, 같은 영 제29조제3항'); }
    if (input.passiveCompany) { hardFail.push('지배주주 지분 50% 초과, 부동산 임대·이자·배당 위주, 상시근로자 5명 미만인 법인입니다.'); r.basis.push(T + '제1항제5호, 법인세법 시행령 제42조제2항'); }
    r.reasons = hardFail.concat(sizeFail);

    if (!r.reasons.length) {
      if (input.affiliated) {
        r.status = 'REVIEW';
        r.reasons.push('관계기업에 속하면 지배·종속기업의 매출액을 합산해 다시 판단해야 합니다(관계기업 판단은 과세연도 종료일 기준).');
        r.basis.push(T + '제1항제3호, 같은 영 시행규칙 제2조제8항');
        return r;
      }
      r.status = 'SME';
      r.basis.push(T + '제1항');
      return r;
    }

    // 유예기간 (영 §2②): 규모 사유만 있고 배제 사유가 없으면 유예 중소기업
    if (input.inGrace && !hardFail.length) {
      var excluded = [];
      if (input.mergedNonSme) excluded.push('중소기업 외의 기업과 합병');
      if (input.mergedGrace) excluded.push('유예기간 중인 기업과 합병');
      if (input.startupExceed) excluded.push('창업 후 2년 이내 과세연도 말에 매출 기준 초과');
      if (!excluded.length) {
        r.status = 'SME_GRACE';
        r.notes.push('규모가 커져 중소기업 기준을 벗어났지만, 최초 사유 발생 과세연도와 그 다음 5개 과세연도(그 기간 끝에 유가증권·코스닥 상장이면 7개)까지는 중소기업으로 봅니다(' + T + '제2항).');
        r.basis.push(T + '제2항');
        return r;
      }
      r.notes.push('유예기간을 적용하지 않는 사유가 있습니다: ' + excluded.join(', ') + ' (' + T + '제2항 단서).');
    } else if (input.inGrace && hardFail.length) {
      r.notes.push('공시대상기업집단 편입, 독립성 불충족, 업종·법인 요건 미충족은 유예기간 적용 대상이 아닙니다(' + T + '제2항).');
    }
    r.status = 'NOT_SME';
    return r;
  }

  var api = { evaluate: evaluate, evaluateTax: evaluateTax, INDUSTRIES: INDUSTRIES, ASSET_LIMIT_EOK: ASSET_LIMIT / 100, RULES_VERSION: RULES_VERSION, fmt: fmt };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SmeRules = api;
})(this);
