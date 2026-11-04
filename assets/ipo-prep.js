/* IPO 준비 회계 체크리스트 (베타). 법정 사항만 조문 인용, 나머지는 실무 순서 */
(function () {
  'use strict';
  var KEY = 'ipo-prep-checks-v1';
  var GROUPS = [
    { title: '1. 상장 2~3년 전 — 회계 기반 다지기', items: [
      ['base-audit', '외부감사를 받고 있는지, 최근 감사의견이 적정인지 확인', '상장 심사는 최근 사업연도 감사보고서를 봅니다. 아직 감사 대상이 아니면 임의감사를 검토하세요. <a href="audit-check.html">외부감사 대상 판정기</a>'],
      ['base-ifrs', 'K-IFRS 전환 계획 수립 (전환일·비교 재무제표 범위)', '주권상장법인과 해당·다음 사업연도 중 상장하려는 회사는 K-IFRS를 적용해야 합니다(코넥스 제외, 외감법 제5조제3항, 시행령 제6조제1항제1호·제2호). 전환 첫해는 비교 표시 때문에 2개 연도를 함께 손봐야 합니다.'],
      ['base-consol', '종속회사가 있으면 연결재무제표 작성 체계 준비', '<a href="consolidation.html">연결재무제표 작성 대상 확인</a>'],
      ['base-policy', '수익인식·개발비·리스·금융상품 회계정책 문서화', '심사와 지정감사에서 가장 많이 묻는 영역입니다.'],
      ['base-close', '월 결산 체계와 결산 일정표 정착', '분·반기 보고에 대비해 결산을 빠르게 마감하는 연습이 필요합니다.'],
    ] },
    { title: '2. 상장 1~2년 전 — 지정감사와 내부통제', items: [
      ['des-check', '상장 예정 지정감사 대상 시기 확인', '해당 사업연도 또는 다음 사업연도 중 상장하려는 회사는 증선위가 감사인을 지정할 수 있습니다(외감법 제11조제1항제12호, 시행령 제14조제6항제1호). <a href="audit-designation.html">감사인 지정 대상 확인</a>'],
      ['des-fee', '지정감사 보수·일정 예산 반영', '지정감사는 감사인을 고를 수 없고 지정 후 2주 이내 계약해야 합니다(시행령 제17조제6항). <a href="audit-fee.html">감사보수 결정 요소</a>'],
      ['icfr-design', '내부회계관리제도 설계·운영 시작 (규정, 조직, 통제 문서)', '상장 후 자산 규모에 따라 감사인 검토 또는 감사를 받습니다. <a href="icfr-check.html">적용 대상 확인</a>'],
      ['icfr-audit', '감사위원회·내부감사 기능 구성 검토', '자산 2조원 이상 등 상법상 설치 의무와 별개로, 상장 심사에서 내부통제 체계를 봅니다(상법 조문은 이 체크리스트에서 인용하지 않음).'],
      ['equity-option', '스톡옵션 부여 내역 정리 — 한도, 결의, 공정가치 비용', '<a href="option-limit.html">부여 한도</a> · <a href="stock-option.html">공정가치(보상비용)</a> · <a href="stock-option-tax.html">행사 세금</a>'],
      ['equity-rcps', 'RCPS·CB 등 투자계약 상환·전환 조건 정리와 회계 분류', '상장 전 보통주 전환 일정과 파생상품 평가 손익 영향을 미리 보세요. <a href="rcps-cb.html">평가 필요 여부</a>'],
    ] },
    { title: '3. 상장 직전 연도 — 숫자 정리', items: [
      ['num-related', '특수관계자 거래·가지급금 정리', '심사 단계에서 특수관계자 거래 내역과 가격 적정성을 묻습니다. <a href="loan-interest.html">가지급금 인정이자</a>'],
      ['num-ratio', '자본잠식·부채비율 등 재무 지표 점검', '<a href="capital-impairment.html">자본잠식 진단</a> · <a href="fin-ratio.html">재무비율 진단</a>'],
      ['num-impair', '영업권·개발비·투자지분 손상검사 수행과 문서화', '<a href="impairment.html">손상검사 간이 진단</a>'],
      ['num-tax', '세무 리스크 점검 (세법상 중소기업·벤처 혜택 졸업 시점 포함)', '<a href="tax-sme.html">세법상 중소기업</a> · <a href="venture-check.html">벤처기업 확인</a>'],
      ['num-valuation', '공모가 산정에 쓰일 평가 방법과 비교기업 자료 준비', '<a href="dcf.html">DCF·WACC</a> · <a href="valuation-needs.html">어떤 평가가 필요한가요?</a>'],
    ] },
    { title: '4. 상장 후 — 계속 의무', items: [
      ['post-report', '분·반기·사업보고서 일정에 맞춘 결산·검토 체계', '주권상장법인은 사업보고서 등을 제출하며 연결재무제표가 중심이 됩니다.'],
      ['post-periodic', '주기적 지정(자유선임 6년 → 지정 3년) 연수 관리', '외감법 제11조제2항, 시행령 제15조제1항. <a href="audit-designation.html">감사인 지정 대상 확인</a>'],
      ['post-disclosure', '합병·영업양수도 등 주요 거래의 외부평가 의무 확인', '<a href="external-valuation.html">외부평가 대상 판정</a> · <a href="merger-price.html">합병가액 계산</a>'],
      ['post-icfr', '내부회계관리제도 운영실태 보고·감사인 검토(감사) 대응', '<a href="icfr-check.html">적용 대상과 검토·감사 구분</a>'],
    ] },
  ];

  var saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { saved = {}; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (e) { /* 저장 불가 환경 무시 */ } }

  var box = document.getElementById('checklist');
  var total = 0;
  GROUPS.forEach(function (g) {
    var html = '<fieldset style="margin-top:16px"><legend>' + g.title + '</legend>';
    g.items.forEach(function (it) {
      total++;
      html += '<label class="choice"><input type="checkbox" id="chk-' + it[0] + '" data-key="' + it[0] + '"' + (saved[it[0]] ? ' checked' : '') + '><span>' + it[1] + (it[2] ? '<span class="hint">' + it[2] + '</span>' : '') + '</span></label>';
    });
    box.insertAdjacentHTML('beforeend', html + '</fieldset>');
  });

  function update() {
    var done = box.querySelectorAll('input:checked').length;
    document.getElementById('progress-text').textContent = done + ' / ' + total + ' 준비';
    document.getElementById('progress-bar').style.width = Math.round(done / total * 100) + '%';
  }
  box.addEventListener('change', function (e) {
    var k = e.target.getAttribute('data-key');
    if (!k) return;
    if (e.target.checked) saved[k] = 1; else delete saved[k];
    save(); update();
  });
  document.getElementById('reset').addEventListener('click', function () {
    saved = {}; save();
    box.querySelectorAll('input[type=checkbox]').forEach(function (c) { c.checked = false; });
    update();
  });
  update();
})();
