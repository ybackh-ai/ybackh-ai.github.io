/* 첫 외부감사 준비 체크리스트 (일반 자료 초안, 베타). 법정 기한 항목은 docs/08 근거 조문만 인용 */
(function () {
  'use strict';
  var KEY = 'audit-prep-checks-v1';
  var GROUPS = [
    { title: '1. 일정과 감사 계약', items: [
      ['schedule-appoint', '감사인 선임 기한 확인', '처음 감사받는 회사는 사업연도 개시일부터 4개월 이내(외감법 제10조제2항). <a href="audit-schedule.html">일정 계산기</a>'],
      ['schedule-report', '감사계약 체결 후 2주 이내 증권선물위원회 선임 보고', '외감법 제12조제2항, 시행령 제18조제2항'],
      ['schedule-fs', '감사 전 재무제표 제출 일정(정기총회 6주 전) 확보', '외감법 제6조제2항, 시행령 제8조제1항'],
      ['schedule-plan', '감사인과 중간감사·기말감사·재고실사 일정 협의', ''],
    ] },
    { title: '2. 기초잔액 (처음 감사받는 회사만 해당)', items: [
      ['open-fs', '전기 말 재무제표와 계정별 명세서', '기초잔액이 맞는지 감사인이 따로 확인합니다.'],
      ['open-tax', '전기 법인세 신고서와 세무조정계산서', ''],
      ['open-balance', '전기 말 예금·차입금 잔액증명서', ''],
      ['open-inventory', '전기 말 재고 수불부와 실사 기록', '전기 말 실사 기록이 없으면 대체 절차가 필요해 시간이 더 걸립니다.'],
      ['open-ppe', '유형·무형자산 대장과 취득 증빙', ''],
      ['open-policy', '수익인식·재고 단가 등 회계정책 정리', '감사 과정에서 정책을 바꾸면 비교 표시가 필요할 수 있습니다.'],
    ] },
    { title: '3. 장부와 결산 자료', items: [
      ['book-gl', '총계정원장·계정별 원장(회계 프로그램 원본 파일)', ''],
      ['book-tb', '결산 시산표와 결산 조정 분개 내역', ''],
      ['book-schedule', '주요 계정 명세서(매출채권·재고·차입금·미지급금 등)', ''],
      ['book-related', '특수관계자 목록과 거래·채권채무 내역', '대표이사 가지급금이 있으면 <a href="loan-interest.html">인정이자 계산기</a>로 미리 확인하세요.'],
    ] },
    { title: '4. 외부 조회 준비', items: [
      ['confirm-bank', '거래하는 모든 금융기관 목록(해지 계좌 포함)', '감사인이 금융기관에 직접 조회서를 보냅니다.'],
      ['confirm-ar', '매출채권·매입채무 거래처 목록과 잔액, 담당자 연락처', '거래처 조회서 발송에 필요합니다.'],
      ['confirm-legal', '진행 중인 소송과 법률 자문 현황', ''],
    ] },
    { title: '5. 계약서와 의사록', items: [
      ['doc-articles', '정관, 법인등기부, 주주명부', ''],
      ['doc-minutes', '이사회·주주총회 의사록', ''],
      ['doc-contracts', '주요 매출·매입 계약서, 임대차·리스 계약서', ''],
      ['doc-loans', '차입·담보·보증 약정서', ''],
      ['doc-invest', '투자계약서·주주간계약서(상환·전환 조건)', 'RCPS·CB가 있으면 <a href="rcps-cb.html">평가 필요 여부</a>를 먼저 확인하세요.'],
    ] },
    { title: '6. 기말 실사', items: [
      ['count-inventory', '기말 재고 실사 계획과 재고 목록', '감사인이 실사에 입회합니다.'],
      ['count-cash', '현금·유가증권 보관 현황', ''],
      ['count-ppe', '주요 유형자산 위치와 사용 현황', ''],
    ] },
    { title: '7. 인건비와 주식보상', items: [
      ['hr-payroll', '급여대장과 원천세 신고 내역', ''],
      ['hr-retire', '퇴직급여 추계액 또는 퇴직연금 자료', ''],
      ['hr-option', '스톡옵션 부여 계약과 주주총회 결의', '<a href="stock-option.html">스톡옵션 공정가치 계산기</a>로 비용 영향을 미리 볼 수 있습니다.'],
    ] },
    { title: '8. 세무 신고', items: [
      ['tax-corp', '법인세 신고서', ''],
      ['tax-vat', '부가가치세 신고서와 매출·매입 세금계산서 합계표', ''],
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
