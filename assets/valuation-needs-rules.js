/*
 * "어떤 평가가 필요한가요?" 진단 로직 (순수 함수, 브라우저·Node 공용)
 * 근거: docs/17_평가필요진단_로직.md (2026-11-04 법제처 현행 조회)
 * 계산 없음. 목적별로 평가 종류·근거·준비 자료·관련 도구를 돌려준다.
 */
(function (root) {
  'use strict';

  var VERSION = '2026-11-04';

  var COMMON_FS = '최근 3개 사업연도 재무제표(감사보고서가 있으면 감사보고서)';

  var R = {
    gift: {
      title: '상속세 및 증여세법상 주식 평가',
      why: '증여·상속·가업승계로 주식이 이전되면 평가기준일 현재 시가로 세금을 계산합니다. 비상장주식은 시가가 없는 경우가 많아 보충적 평가방법으로 평가합니다.',
      basis: ['「상속세 및 증여세법」 제60조제1항·제3항 — 시가 원칙, 시가 산정이 어려우면 제61조~제65조 방법', '같은 법 제63조제1항제1호나목, 시행령 제54조 — 비상장주식 보충적 평가'],
      docs: [COMMON_FS, '최근 3개 사업연도 법인세 신고서(세무조정계산서)', '평가기준일 현재 재무상태표와 계정별 명세', '주주명부와 최근 주식 거래 내역(매매사례 확인용)', '부동산·비상장주식 등 보유 자산 명세'],
      tool: { href: 'stock-valuation.html', label: '비상장주식 상증법 약식 평가' },
      caution: '평가기준일 전후 일정 기간 안에 매매사례가액이나 감정가액이 있으면 그 가액이 시가로 우선 적용될 수 있습니다.',
    },
    related_transfer: {
      title: '세법상 시가 평가 (특수관계인 간 주식 거래)',
      why: '대표·가족·계열회사 등 특수관계인과 시가와 다른 가격으로 주식을 사고팔면 법인세 부당행위계산 부인이나 증여세 문제가 생길 수 있어 시가를 먼저 확인해야 합니다.',
      basis: ['「법인세법」 제52조 — 특수관계인 거래의 부당행위계산 부인, 시가 기준', '같은 법 시행령 제89조제1항·제2항 — 시가가 불분명하면 감정가액(주식은 제외), 상증법 제61조~제66조 준용 가액 순', '「상속세 및 증여세법」 제60조·제63조 — 시가와 비상장주식 평가'],
      docs: [COMMON_FS, '최근 3개 사업연도 법인세 신고서', '거래 예정 가격과 거래 조건', '주주명부, 최근 주식 거래 내역', '거래 당사자 간 관계'],
      tool: { href: 'stock-valuation.html', label: '비상장주식 상증법 약식 평가' },
      caution: '개인 간 거래인지, 법인이 당사자인지에 따라 적용되는 세법 규정이 달라집니다.',
    },
    listed_deal: {
      title: '자본시장법상 외부평가',
      why: '주권상장법인이 합병, 중요한 영업·자산 양수도, 주식의 포괄적 교환·이전, 분할합병을 하면 가액이나 비율의 적정성에 대해 외부평가기관의 평가를 받아야 하는 경우가 있습니다.',
      basis: ['「자본시장과 금융투자업에 관한 법률」 제165조의4제1항·제2항', '같은 법 시행령 제176조의5제8항 — 합병의 외부평가 대상(계열회사 여부, 합병가액 산정 방식에 따라 다름)', '같은 법 시행령 제176조의5제9항 — 외부평가기관: 인수업무 인가 투자매매·중개업자, 신용평가회사, 회계법인', '같은 법 시행령 제176조의6제4항 — 영업·자산 양수도, 주식교환·이전, 분할합병의 외부평가(예외 있음)'],
      docs: ['거래 구조와 일정(이사회 결의 예정일, 계약 예정일)', '당사회사들의 최근 재무제표와 사업계획', '상장회사 주가·거래량 자료(기준시가 산정용)', '계열회사 관계 여부 자료'],
      tool: { href: 'external-valuation.html', label: '자본시장법 외부평가 대상 판정' },
      caution: '외부평가 대상인지는 계열회사 관계, 합병가액 산정 방식, 상장 시장(코넥스 등)에 따라 달라집니다. 외부평가기관은 평가 대상 회사와 특수관계가 없어야 합니다(시행령 제176조의5제13항).',
    },
    unlisted_merger: {
      title: '합병·분할 비율 산정을 위한 가치평가',
      why: '비상장회사 간 합병·분할은 자본시장법 외부평가 의무는 없지만, 합병비율이 주주 간 이익 분배를 결정합니다. 특수관계 법인 간 불공정한 비율은 세법상 부당행위가 될 수 있습니다.',
      basis: ['「법인세법 시행령」 제88조제1항제3호의2·제8호가목 — 특수관계 법인 간 불공정 비율 합병·분할'],
      docs: ['당사회사들의 최근 3개 사업연도 재무제표', '당사회사들의 법인세 신고서', '주주명부(양측 주주 구성)', '합병 목적과 예정 일정'],
      tool: { href: 'stock-valuation.html', label: '비상장주식 상증법 약식 평가' },
      caution: '세법상 평가액과 회계·거래 목적의 공정가치가 다를 수 있어, 어떤 목적으로 비율을 정하는지 먼저 정리하는 것이 좋습니다.',
    },
    investment: {
      title: 'DCF·상대가치 기업가치 평가 (투자 유치·M&A)',
      why: '투자 유치나 인수·매각 가격 협상에는 법정 평가 방법이 정해져 있지 않습니다. 보통 현금흐름할인법(DCF), 유사기업 배수(상대가치), 자산가치를 함께 보고 범위로 협상합니다.',
      basis: ['법정 평가 의무 없음 — 거래 당사자 간 협상 목적'],
      docs: ['사업계획과 3~5년 추정 손익', COMMON_FS, '주요 계약·고객 현황', '비교 가능한 상장회사 또는 최근 거래 사례', '현재 주주 구성(캡테이블)'],
      tool: { href: 'dcf.html', label: 'DCF·WACC 간이 계산기' },
      caution: '투자 계약의 우선주 조건(전환, 상환, 리픽싱)은 회사 가치와 별도로 지분 가치를 바꿉니다(지분 희석 계산기로 지분율 변화를 확인할 수 있습니다). 특수관계인이 투자자로 참여하면 세법상 시가 검토도 필요합니다.',
    },
    stock_option: {
      title: '주식기준보상(스톡옵션) 공정가치 평가',
      why: '스톡옵션을 부여하면 부여일 공정가치를 기준으로 보상비용을 가득기간에 걸쳐 인식합니다. 외부감사를 처음 받는 회사에서 자주 문제가 됩니다.',
      basis: ['K-IFRS 제1102호 「주식기준보상」'],
      docs: ['스톡옵션 부여 계약서·주주총회 의사록', '부여일·행사가격·가득조건·행사기간', '부여일 현재 주식가치 자료', '부여 대상자 명단과 퇴사 현황'],
      tool: { href: 'stock-option.html', label: '스톡옵션 공정가치 계산기' },
      caution: '옵션 가격결정모형(블랙-숄즈, 이항모형)의 변동성·기대존속기간 등 가정에 따라 금액이 크게 달라집니다.',
    },
    rcps_cb: {
      title: '복합금융상품(RCPS·CB·BW) 평가',
      why: '상환전환우선주, 전환사채, 신주인수권부사채는 조건에 따라 부채로 분류되거나 전환권·상환권 등 파생상품을 분리해 공정가치로 평가해야 할 수 있습니다.',
      basis: ['K-IFRS 제1032호 「금융상품: 표시」', 'K-IFRS 제1109호 「금융상품」', 'K-IFRS 제1113호 「공정가치 측정」'],
      docs: ['투자계약서·인수계약서(상환·전환 조건, 리픽싱, 콜·풋옵션)', '발행일·결산일 현재 주식가치 자료', '발행 내역과 기존 전환·상환 이력'],
      tool: { href: 'rcps-cb.html', label: 'RCPS·CB 평가 필요 여부' },
      caution: '리픽싱 조항, 상환 주체(회사·대주주), 전환가격 조정 조건에 따라 회계처리가 달라집니다.',
    },
    ppa: {
      title: 'PPA(취득원가 배분) 평가',
      why: '다른 회사나 사업을 인수해 지배력을 얻으면 취득일에 식별 가능한 자산·부채를 공정가치로 측정하고, 나머지를 영업권으로 인식합니다.',
      basis: ['K-IFRS 제1103호 「사업결합」'],
      docs: ['인수계약서(대가, 조건부대가)', '피취득회사 취득일 재무제표', '고객·기술·상표 등 무형자산 관련 자료', '피취득회사 사업계획'],
      tool: { href: 'ppa.html', label: 'PPA 영업권 간이 계산기' },
      caution: '취득일부터 1년 안의 측정기간 동안 잠정금액을 조정할 수 있습니다.',
    },
    impairment: {
      title: '손상검사를 위한 회수가능액 평가',
      why: '영업권은 매년, 그 밖의 자산·투자주식은 손상징후가 있으면 회수가능액(사용가치와 순공정가치 중 큰 금액)을 추정해 장부금액과 비교합니다.',
      basis: ['K-IFRS 제1036호 「자산손상」'],
      docs: ['현금창출단위별 사업계획과 추정 현금흐름', '최근 실적과 과거 계획 대비 달성률', '할인율 산정 자료', '대상 자산·영업권 장부금액 명세'],
      tool: null,
      caution: '사업계획의 성장률과 할인율 가정은 감사인이 중점적으로 검토하는 항목입니다.',
    },
    unlisted_fv: {
      title: '비상장 지분증권 공정가치 평가',
      why: '다른 비상장회사 지분을 보유하고 있으면 결산일마다 공정가치로 측정해야 할 수 있습니다.',
      basis: ['K-IFRS 제1109호 「금융상품」', 'K-IFRS 제1113호 「공정가치 측정」'],
      docs: ['피투자회사 최근 재무제표', '피투자회사 최근 투자 유치·거래 가격', '보유 지분 내역과 계약 조건'],
      tool: null,
      caution: '최근 투자 라운드 가격이 있더라도 우선주 조건 차이를 조정해야 할 수 있습니다.',
    },
    other: {
      title: '목적에 맞는 평가 방법 상담',
      why: '평가 목적에 따라 적용 법령과 방법이 달라집니다. 상황을 알려주시면 필요한 평가 종류를 안내해 드립니다.',
      basis: ['목적별 상담 필요'],
      docs: ['평가 목적과 예정 일정', COMMON_FS],
      tool: null,
      caution: '',
    },
  };

  var PURPOSES = ['gift', 'related_transfer', 'listed_deal', 'unlisted_merger', 'investment', 'reporting', 'other'];
  var REPORTING = ['stock_option', 'rcps_cb', 'ppa', 'impairment', 'unlisted_fv'];

  function pack(key) {
    var x = R[key];
    return { key: key, title: x.title, why: x.why, basis: x.basis.slice(), docs: x.docs.slice(), tool: x.tool, caution: x.caution };
  }

  /**
   * @param {object} input
   *  purpose: PURPOSES 중 하나
   *  listed: boolean               (listed_deal일 때) 주권상장법인 여부
   *  reporting: string[]           (reporting일 때) REPORTING 중 선택
   *  gaap: 'kifrs' | 'kgaap'       (reporting일 때)
   */
  function diagnose(input) {
    input = input || {};
    var errors = [];
    var r = { version: VERSION, status: null, errors: errors, results: [], notes: [] };
    if (PURPOSES.indexOf(input.purpose) < 0) { errors.push('평가가 필요한 목적을 선택해 주세요.'); r.status = 'INVALID'; return r; }

    if (input.purpose === 'reporting') {
      var sel = (input.reporting || []).filter(function (k) { return REPORTING.indexOf(k) >= 0; });
      if (!sel.length) { errors.push('재무제표 작성 목적의 세부 항목을 하나 이상 선택해 주세요.'); r.status = 'INVALID'; return r; }
      REPORTING.forEach(function (k) { if (sel.indexOf(k) >= 0) r.results.push(pack(k)); });
      if (input.gaap === 'kgaap') {
        r.notes.push('안내한 기준서 번호는 K-IFRS 기준입니다. 일반기업회계기준을 적용하는 회사는 일반기업회계기준의 해당 규정을 적용하며, 평가 방법과 공시 범위가 다를 수 있습니다.');
      }
    } else if (input.purpose === 'listed_deal' && input.listed === false) {
      r.results.push(pack('unlisted_merger'));
      r.notes.push('주권상장법인이 아니면 자본시장법 제165조의4에 따른 외부평가 대상이 아닙니다. 비상장회사 간 거래 기준으로 안내합니다.');
    } else {
      r.results.push(pack(input.purpose));
    }
    r.notes.push('같은 거래라도 세무·회계·거래 목적의 평가액이 서로 다를 수 있습니다. 목적이 여러 개라면 함께 상담받으시는 것이 효율적입니다.');
    r.status = 'OK';
    return r;
  }

  var api = { diagnose: diagnose, PURPOSES: PURPOSES, REPORTING: REPORTING, VERSION: VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ValuationNeeds = api;
})(this);
