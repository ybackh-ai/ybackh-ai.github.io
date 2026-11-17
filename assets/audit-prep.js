/* 첫 외부감사 준비 체크리스트. 운영자가 실제 감사·기초잔액 검토에서 보내는 요청자료 목록을 일반화한 것(2026-11-17, docs/52).
   법정 기한 항목은 docs/08 근거 조문만 인용. 괄호 안 [엑셀]/[PDF]는 보통 받는 파일 형태 */
(function () {
  'use strict';
  var KEY = 'audit-prep-checks-v2';
  var GROUPS = [
    { title: '1. 일정과 감사 계약', items: [
      ['schedule-appoint', '감사인 선임 기한 확인', '처음 감사받는 회사는 사업연도 개시일부터 4개월 이내(외감법 제10조제2항). <a href="audit-schedule.html">일정 계산기</a>'],
      ['schedule-report', '감사계약 체결 후 2주 이내 증권선물위원회 선임 보고', '외감법 제12조제2항, 시행령 제18조제2항'],
      ['schedule-fs', '감사 전 재무제표 제출 일정(정기총회 6주 전) 확보', '외감법 제6조제2항, 시행령 제8조제1항'],
      ['schedule-plan', '감사인과 기초잔액 검토·중간감사·기말감사·재고실사 일정 협의', '첫 감사는 기초잔액 검토가 먼저라 일정을 여유 있게 잡는 것이 좋습니다.'],
    ] },
    { title: '2. 회사 일반 자료', items: [
      ['gen-intro', '회사 소개 자료(IR 자료 등)', '감사인이 사업 구조와 매출 흐름을 이해하는 출발점입니다. [PDF]'],
      ['gen-legal', '정관, 법인등기부등본, 사업자등록증 최신본', '[PDF]'],
      ['gen-holders', '결산일(또는 최근일) 기준 주주명부', '[PDF]'],
      ['gen-rules', '회사 내부 규정집(있는 경우)', '퇴직금·임원 보수·회계 규정 등'],
      ['gen-minutes', '해당 연도 이사회·주주총회 의사록', '[PDF]'],
      ['gen-subs', '종속·관계회사, 해외법인이 있으면 결산일 재무제표', '지분율이 바뀌었으면 주주명부도 함께. [PDF 또는 엑셀]'],
    ] },
    { title: '3. 기초잔액 검토 (처음 감사받는 회사만 해당)', items: [
      ['open-fs', '전기 말 재무제표와 계정별 명세서', '기초잔액이 맞는지 감사인이 따로 확인합니다.'],
      ['open-tax', '최근 3개 사업연도 세무조정계산서(법인세 신고서)', ''],
      ['open-balance', '전기 말 예금·차입금 잔액증명서', ''],
      ['open-inventory', '전기 말 재고 수불부와 실사 기록', '전기 말 실사 기록이 없으면 대체 절차가 필요해 시간이 더 걸립니다.'],
      ['open-ppe', '전기 유형·무형자산 감가상각대장, 과거 미상각 자산의 상각비 계산 내역', ''],
      ['open-invest', '과거 투자계약서 일체(상환전환우선주·전환사채 등)', 'RCPS·CB가 있으면 <a href="rcps-cb.html">평가 필요 여부</a>를 먼저 확인하세요.'],
      ['open-grant', '정부보조금(국고보조금) 수령 내역과 협약서', ''],
      ['open-policy', '수익인식·재고 단가 등 회계정책 정리', '감사 과정에서 정책을 바꾸면 비교 표시가 필요할 수 있습니다.'],
    ] },
    { title: '4. 장부와 결산 자료', items: [
      ['book-tb', '합계잔액시산표와 재무제표(재무상태표·손익계산서)', '[엑셀]'],
      ['book-gl', '계정별 원장과 분개장(1년 전체, 회계 프로그램에서 내려받은 원본)', '[엑셀]'],
      ['book-vendor', '거래처별 원장(거래처마다 당기 증가·감소 표시)', '거래처 조회와 채권·채무 검토에 씁니다. [엑셀]'],
      ['book-fa', '고정자산관리대장과 감가상각 명세(1년 전체)', '[엑셀]'],
      ['book-calc', '기간 배분 계산 파일: 선급비용, 미수이자, 미지급이자', '[엑셀]'],
      ['book-fx', '외화 자산·부채가 있으면 외화환산 계산 파일', '[엑셀]'],
    ] },
    { title: '5. 매출', items: [
      ['rev-contracts', '주요 매출 계약서와 매출액 명세서', '신규 계약은 빠짐없이. [PDF]'],
      ['rev-progress', '진행기준(공사·용역 등) 매출이 있으면 진행률 계산 자료', '[엑셀] <a href="revenue-check.html">수익인식 체크</a>'],
    ] },
    { title: '6. 금융자산·차입금·투자', items: [
      ['fin-bank', '거래하는 모든 금융기관 목록(해지 계좌 포함)', '감사인이 금융기관에 직접 조회서를 보냅니다.'],
      ['fin-loans', '차입금 정리 내역(금융기관·이자율·만기)과 신규 차입 계약서', '[엑셀·PDF]'],
      ['fin-lend', '대여금 계약서(대표이사·관계회사 대여 포함)', '대표이사 가지급금이 있으면 <a href="loan-interest.html">인정이자 계산기</a>로 미리 확인하세요.'],
      ['fin-invest', '투자조합·비상장주식 등 투자자산의 결산일 재무제표', '공정가치 평가에 필요합니다. <a href="valuation-needs.html">어떤 평가가 필요한가요?</a>'],
      ['fin-valuation', '영업권·종속기업 투자주식 손상 등 평가 보고서와 향후 5개년 사업계획', '평가에 쓴 사업계획과 같은 것이어야 합니다. [엑셀]'],
    ] },
    { title: '7. 인건비와 주식보상', items: [
      ['hr-payroll', '인별 소득대장(급여대장)과 원천세 신고 내역', '[엑셀]'],
      ['hr-leave', '연차 관리대장', '미사용 연차수당 부채 계산에 씁니다. [엑셀]'],
      ['hr-retire', '퇴직자 명단과 퇴직금 지급 내역, 퇴직급여 추계액 또는 퇴직연금 자료', '[엑셀]'],
      ['hr-option', '스톡옵션 부여 계약·주주총회 결의와 행사 정리 내역', '<a href="stock-option.html">스톡옵션 공정가치 계산기</a>로 비용 영향을 미리 볼 수 있습니다.'],
    ] },
    { title: '8. 리스·특수관계자·우발상황', items: [
      ['etc-lease', '임차 계약서(부동산·차량, 차량은 상환 스케줄 포함)', '[PDF] <a href="lease.html">리스 회계 계산기</a>'],
      ['etc-related', '특수관계자 목록과 거래·채권채무 내역', '[엑셀]'],
      ['etc-legal', '진행 중인 소송 내역', '[PDF 또는 엑셀]'],
      ['etc-guarantee', '지급보증·담보 제공 등 약정 사항', '[PDF 또는 엑셀]'],
      ['etc-subsequent', '결산일 이후 발생한 주요 사건(합병·처분·대규모 차입·소송 등)', '주석 공시나 수정이 필요할 수 있습니다.'],
    ] },
    { title: '9. 기말 실사', items: [
      ['count-inventory', '기말 재고 실사 계획과 재고 목록', '감사인이 실사에 입회합니다.'],
      ['count-cash', '현금·유가증권 보관 현황', ''],
      ['count-ppe', '주요 유형자산 위치와 사용 현황', ''],
    ] },
    { title: '10. 세무 신고', items: [
      ['tax-vat', '부가가치세 신고서 일체', '[엑셀 또는 PDF]'],
      ['tax-corp', '당기 세무조정 내역(결산 확정 후)', '수정분개가 반영된 결산을 기준으로 진행합니다. [엑셀]'],
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
