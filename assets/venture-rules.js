/*
 * 벤처기업 확인 요건 진단 로직 (순수 함수, 브라우저·Node 공용)
 * 근거: docs/24_벤처기업확인_로직.md — 벤처기업육성에 관한 특별법 제2조의2·제3조, 시행령 제2조의3·제2조의4·별표 1 (2026-11-04 조회)
 * 금액: 만원 정수. 비율 비교는 정수 연산.
 */
(function (root) {
  'use strict';

  var VERSION = '2026-11-04';
  var T = { INVEST_MIN: 5000, INVEST_PCT: 10, INVEST_PCT_CULTURE: 7, RND_MIN: 5000, RND_PCT: 5 }; // 만원, %
  var EXCLUDED = ['일반 유흥 주점업(56211)', '무도 유흥 주점업(56212)', '기타 주점업(56219)', '기타 사행시설 관리 및 운영업(91249)', '무도장 운영업(91291)'];

  function blank(v) { return v === undefined || v === null || v === ''; }
  function man(v, name, errors) {
    if (blank(v)) return null;
    var n = Number(v);
    if (!isFinite(n) || n < 0 || Math.floor(n) !== n) { errors.push(name + ': 0 이상의 정수(만원)로 입력해 주세요.'); return null; }
    return n;
  }

  /**
   * @param {object} input
   *  sme: 'yes' | 'no' | 'unknown'   중소기업기본법상 중소기업 여부
   *  excludedIndustry: boolean       별표 1 제외 업종
   *  investAmount, capital: 만원      적격 투자자 투자금액 합계, 자본금
   *  cultureProducer: boolean        문화산업진흥 기본법상 제작자인 법인(7%)
   *  hasLab: boolean                 기업부설연구소·연구개발전담부서(창작연구소·창작전담부서) 보유
   *  rndAmount, rndSales: 만원        직전 4개 분기 연구개발비, 총매출액
   *  underThreeYears: boolean        창업 후 3년 미경과(매출 대비 비율 미적용)
   */
  function diagnose(input) {
    input = input || {};
    var errors = [];
    var r = { version: VERSION, status: null, invest: 'NA', rnd: 'NA', innovation: 'EVAL', details: [], basis: [], notes: [], errors: errors, excludedList: EXCLUDED };
    var inv = man(input.investAmount, '투자금액 합계', errors);
    var cap = man(input.capital, '자본금', errors);
    var rnd = man(input.rndAmount, '연구개발비', errors);
    var sales = man(input.rndSales, '총매출액', errors);
    if (inv !== null && (cap === null || cap === 0)) errors.push('투자유형을 보려면 자본금을 0보다 크게 입력해 주세요.');
    if (rnd !== null && !input.underThreeYears && (sales === null || sales === 0)) errors.push('연구개발유형을 보려면 직전 4개 분기 총매출액을 입력해 주세요(창업 3년 미만이면 생략 가능).');
    if (errors.length) { r.status = 'INVALID'; return r; }

    // 투자유형
    if (inv !== null) {
      var pct = input.cultureProducer ? T.INVEST_PCT_CULTURE : T.INVEST_PCT;
      var okAmt = inv >= T.INVEST_MIN, okPct = inv * 100 >= pct * cap;
      r.invest = okAmt && okPct ? 'MEETS' : 'NOT';
      r.investRatio = Math.round(inv / cap * 10000) / 100;
      r.details.push({ type: '벤처투자유형', ok: r.invest === 'MEETS', text: '투자금액 ' + inv.toLocaleString('ko-KR') + '만원(기준 5,000만원 이상) · 자본금 대비 ' + r.investRatio + '%(기준 ' + pct + '% 이상)' });
      r.basis.push('벤처기업육성에 관한 특별법 제2조의2제1항제2호가목, 시행령 제2조의3제1항');
    }
    // 연구개발유형
    if (rnd !== null || input.hasLab) {
      var amtOk = rnd !== null && rnd >= T.RND_MIN;
      var ratioOk = input.underThreeYears || (sales > 0 && rnd !== null && rnd * 100 >= T.RND_PCT * sales);
      r.rnd = input.hasLab && amtOk && ratioOk ? 'MEETS' : 'NOT';
      r.rndRatio = sales > 0 && rnd !== null ? Math.round(rnd / sales * 10000) / 100 : null;
      r.details.push({ type: '연구개발유형', ok: r.rnd === 'MEETS', text: (input.hasLab ? '연구소·전담부서 보유' : '연구소·전담부서 없음') + ' · 연구개발비 ' + (rnd === null ? '-' : rnd.toLocaleString('ko-KR') + '만원') + '(기준 5,000만원 이상)' +
        (input.underThreeYears ? ' · 창업 3년 미만이어서 매출 대비 비율 미적용' : ' · 매출 대비 ' + (r.rndRatio === null ? '-' : r.rndRatio + '%') + '(기준 5% 이상, 업종별 고시 비율 이상)') });
      r.basis.push('벤처기업육성에 관한 특별법 제2조의2제1항제2호나목, 시행령 제2조의3제5항·제6항');
      if (r.rnd === 'MEETS' && !input.underThreeYears) r.notes.push('연구개발비 비율은 5% 이상이면서 중소벤처기업부장관이 업종별로 고시한 비율 이상이어야 합니다. 업종별 고시 비율은 이 계산기에 반영하지 않았습니다.');
    }
    r.details.push({ type: '혁신성장유형', ok: null, text: '숫자 기준 없이 벤처기업확인기관이 기술의 혁신성과 사업의 성장성을 평가합니다(창업 중인 기업 포함).' });

    var numericOk = r.invest === 'MEETS' || r.rnd === 'MEETS';
    if (input.sme === 'no' || input.excludedIndustry) {
      r.status = 'NOT_ELIGIBLE';
      r.basis.unshift(input.sme === 'no' ? '벤처기업육성에 관한 특별법 제2조의2제1항제1호(중소기업일 것)' : '벤처기업육성에 관한 특별법 제3조, 시행령 제2조의4, 별표 1(제외 업종)');
    } else if (input.sme !== 'yes') {
      r.status = 'CHECK_SME';
    } else {
      r.status = numericOk ? 'LIKELY' : 'POSSIBLE';
    }
    r.notes.push('벤처기업 확인은 벤처기업확인기관의 평가를 거쳐야 하며, 이 진단은 숫자 요건만 확인한 것입니다. 연구개발비·매출액은 확인 요청일이 속하는 분기의 직전 4개 분기 기준입니다.');
    return r;
  }

  var api = { diagnose: diagnose, THRESHOLDS: T, EXCLUDED: EXCLUDED, VERSION: VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.VentureRules = api;
})(this);
