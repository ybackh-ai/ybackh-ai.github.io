/*
 * 상단 메뉴 "회계 도구" 펼침 목록 — 도구 목록의 단일 출처.
 * 새 도구를 추가하면 여기(TOOLS)와 첫 화면 #tools 카드에 함께 넣는다. 스크립트가 없어도 링크는 index.html#tools로 이동.
 * PC: 마우스를 올리거나 키보드 포커스로 펼침. 터치 화면: 처음 누르면 펼치고, 다시 누르면 도구 목록 화면으로 이동.
 */
(function () {
  'use strict';
  var TOOLS = [
    { group: '외부감사·내부회계', tone: 'blue', items: [
      ['audit-check.html', '외부감사 대상 판정기'], ['audit-schedule.html', '외부감사 일정 계산기'], ['audit-prep.html', '첫 외부감사 준비 체크리스트'], ['icfr-check.html', '내부회계관리제도 적용 대상'], ['consolidation.html', '연결재무제표 작성 대상'], ['audit-designation.html', '감사인 지정 대상 확인'], ['audit-fee.html', '감사보수는 어떻게 정해지나'], ['ipo-prep.html', 'IPO 준비 회계 체크리스트'], ['governance.html', '감사위원회·상근감사 설치 의무'],
    ] },
    { group: '결산·회계처리', tone: 'coral', items: [
      ['lease.html', '리스 회계 (사용권자산·리스부채)'], ['depreciation.html', '감가상각 (세법 상각범위액)'], ['allowance.html', '대손충당금 연령분석'], ['retirement.html', '퇴직급여충당부채'], ['deferred-tax.html', '이연법인세 간이 계산'], ['revenue-check.html', '수익인식 쟁점 진단'],
      ['dev-cost.html', '개발비 자산화 요건 진단'], ['fx-translation.html', '외화환산 손익'], ['inventory-lcm.html', '재고자산 저가법 평가손실'], ['gov-grant.html', '정부보조금 회계처리'], ['unused-leave.html', '미사용 연차수당 부채'], ['accrual-prepaid.html', '선급·미지급비용 기간 배분'], ['effective-interest.html', '유효이자율 상각표 (차입금·사채)'],
    ] },
    { group: '중소기업·벤처', tone: 'teal', items: [
      ['sme-check.html', '중소기업 해당 여부 판정기'], ['tax-sme.html', '세법상 중소기업 판정기'], ['venture-check.html', '벤처기업 확인 요건 진단'], ['venture-benefits.html', '벤처기업 확인 후 혜택'], ['startup-check.html', '창업기업 해당 여부'], ['small-biz-check.html', '소상공인 해당 여부'], ['midsize-check.html', '중견기업·졸업 유예'], ['rnd-lab-check.html', '기업부설연구소 설립 요건'], ['sme-employee-tax.html', '중소기업 취업자 소득세 감면'],
    ] },
    { group: '세무', tone: 'purple', items: [
      ['inherit-gift.html', '상속·증여세 간이 계산'], ['loan-interest.html', '가지급금 인정이자 계산기', 1], ['stock-option-tax.html', '스톡옵션 행사 세금'], ['corp-vs-personal.html', '법인 vs 개인사업자 세금 비교'], ['tax-calendar.html', '법인 세무 신고 일정표'],
      ['corp-tax.html', '법인세 간이 계산기'], ['withholding.html', '원천징수 세액 계산기'], ['entertainment.html', '기업업무추진비(접대비) 한도'], ['business-car.html', '업무용승용차 비용 한도'], ['share-transfer-tax.html', '비상장주식 양도소득세'],
      ['related-price.html', '특수관계인 주식 거래 시가 판정'], ['related-party.html', '특수관계인 범위 확인'], ['succession.html', '가업상속공제 요건 확인'], ['tax-penalty.html', '가산세 계산기'],
      ['exec-retirement.html', '임원 퇴직금 한도'], ['capital-gift.html', '불공정 증자·감자 증여이익'], ['sincere-filing.html', '성실신고확인 대상 판정'],
      ['vat-calc.html', '부가가치세 계산기'], ['labor-cost.html', '직원 인건비 총액(4대보험)'], ['net-salary.html', '연봉 실수령액'], ['severance-pay.html', '퇴직금·퇴직소득세'], ['owner-pay.html', '대표 보수 설계(급여 vs 배당)'], ['incorporation.html', '법인전환 이월과세·취득세'],
      ['registration-tax.html', '법인 설립·증자 등록면허세'], ['interim-tax.html', '법인세 중간예납'], ['semiannual-withholding.html', '원천세 반기납부 대상'],
    ] },
    { group: '인사·노무·사회보험', tone: 'amber', items: [
      ['annual-leave.html', '연차 일수·연차수당'], ['min-wage.html', '주휴수당·최저임금 월급'], ['unemployment-benefit.html', '실업급여(구직급여)', 1], ['parental-leave.html', '육아휴직 급여'],
      ['national-pension.html', '국민연금 예상 수령액', 1], ['health-insurance.html', '지역가입자 건강보험료', 1],
      ['overtime-pay.html', '연장·야간·휴일수당'], ['hourly-wage.html', '월급 → 시급·통상임금'], ['dismissal-notice.html', '해고예고수당'], ['maternity-leave.html', '출산전후휴가 급여'],
      ['shutdown-allowance.html', '휴업수당'], ['dc-pension.html', '퇴직연금 DC 부담금'], ['work-hours.html', '주 52시간 점검'],
    ] },
    { group: '부동산·대출', tone: 'green', items: [
      ['loan-repayment.html', '대출 이자·상환 계산기'], ['dsr-limit.html', 'DSR 대출 한도', 1], ['rent-conversion.html', '전월세 전환'], ['brokerage-fee.html', '중개보수(복비)'],
      ['gift-vs-sale.html', '부동산 증여 vs 매매', 1], ['ltv-limit.html', '주택담보대출 한도 (LTV+DSR)', 1], ['prepayment-fee.html', '중도상환수수료·갈아타기'], ['rental-yield.html', '임대수익률'], ['subscription-score.html', '청약 가점'],
    ] },
    { group: '개인 세금 (직장인·프리랜서·투자자)', tone: 'pink', items: [
      ['year-end-tax.html', '연말정산 미리보기'], ['pension-credit.html', '연금저축·IRP 세액공제'], ['freelancer-tax.html', '프리랜서 3.3% 환급'], ['foreign-stock-tax.html', '해외주식 양도소득세'], ['home-sale-tax.html', '1주택 양도세·다주택 중과', 1], ['acquisition-tax.html', '주택 취득세'],
      ['deposit-interest.html', '예금·적금 이자 세후'], ['isa-tax.html', 'ISA 비과세·분리과세'], ['financial-income.html', '금융소득 종합과세'], ['rental-income-tax.html', '주택임대소득세', 1], ['property-tax.html', '종합부동산세', 1], ['work-incentive.html', '근로·자녀장려금', 1],
      ['income-tax.html', '종합소득세 (근로 + 사업)'], ['daily-worker-tax.html', '일용직 세금'], ['pension-tax.html', '연금소득세'], ['home-property-tax.html', '주택 재산세'], ['car-tax.html', '자동차세'],
    ] },
    { group: '세액공제·감면', tone: 'teal', items: [
      ['employment-credit.html', '통합고용세액공제', 1], ['rnd-credit.html', '연구·인력개발비 세액공제'], ['investment-credit.html', '통합투자세액공제'], ['startup-relief.html', '창업중소기업 세액감면'], ['angel-deduction.html', '엔젤투자 소득공제'],
      ['rent-credit.html', '월세 세액공제'], ['special-credits.html', '의료비·교육비·기부금 세액공제'], ['sme-special-relief.html', '중소기업 특별세액감면'], ['refund-claim.html', '경정청구 환급 (5년)'], ['credit-carryforward.html', '세액공제 이월·최저한세'],
    ] },
    { group: '가치평가·M&A', tone: 'blue', items: [
      ['valuation-needs.html', '어떤 평가가 필요한가요?'], ['stock-valuation.html', '비상장주식 상증법 약식 평가'], ['dcf.html', 'DCF·WACC 간이 계산기'], ['dilution.html', '투자 유치 지분 희석'],
      ['ppa.html', 'PPA 영업권 간이 계산기'], ['impairment.html', '손상검사 간이 진단'], ['external-valuation.html', '자본시장법 외부평가 대상', 1], ['merger-price.html', '상장사 합병가액', 1], ['stock-option.html', '스톡옵션 공정가치'], ['option-limit.html', '스톡옵션 부여 한도'], ['rcps-cb.html', 'RCPS·CB 평가 필요 여부'],
      ['safe-conversion.html', 'SAFE·전환사채 전환 주식수'], ['equity-bridge.html', '기업가치→지분가치 환산'], ['multiples.html', '유사기업 멀티플 평가'], ['pf-feasibility.html', '부동산 PF 사업성'], ['qualified-reorg.html', '적격합병·적격분할 요건'],
      ['cap-table.html', '멀티 라운드 캡테이블'], ['exit-waterfall.html', '엑싯 분배(청산우선권)'],
    ] },
    { group: '재무분석·자료', tone: 'purple', items: [
      ['fin-ratio.html', '재무비율 간이 진단'], ['capital-impairment.html', '자본잠식·채무초과 진단'], ['distributable-profit.html', '배당가능이익·자기주식 한도'], ['working-capital.html', '운전자본·현금전환주기'], ['break-even.html', '손익분기점(BEP)'], ['debt-capacity.html', 'EBITDA·순차입금 상환능력'], ['runway.html', '런웨이·번레이트'], ['dupont.html', '듀폰 분석 (ROE 분해)'], ['operating-cashflow.html', '영업활동 현금흐름 간이 계산'], ['dscr.html', 'DSCR 원리금 상환능력'], ['red-flags.html', '재무제표 이상 신호 점검'], ['credit-metrics.html', '신용평가 주요 지표'],['closing-checklist.html', '12월 결산 체크리스트'], ['glossary.html', '회계·세무 용어 사전'], ['videos.html', '영상으로 배우기'], ['qna.html', '외부감사·회계 Q&A'], ['cases.html', '수행 사례'], ['basis.html', '기준일·변경 이력'],
    ] },
  ];

  var here = location.pathname.split('/').pop() || 'index.html';

  // 계산기 페이지 머리를 첫 화면 분야 타일과 같은 색으로 (index.html의 details id는 g1~g10, TOOLS 순서와 같음)
  TOOLS.forEach(function (g, i) {
    if (!g.items.some(function (it) { return it[0] === here; })) return;
    document.body.setAttribute('data-tone', g.tone);
    var head = document.querySelector('.page-title');
    if (head) head.insertAdjacentHTML('afterbegin', '<a class="page-group" href="index.html#g' + (i + 1) + '">' + g.group.replace(/ \(.*\)$/, '') + '</a>');
  });

  var link = document.querySelector('.nav a[href="index.html#tools"]');
  if (!link) return;

  var wrap = document.createElement('div');
  wrap.className = 'nav-tools';
  link.parentNode.insertBefore(wrap, link);
  wrap.appendChild(link);
  link.setAttribute('aria-haspopup', 'true');
  link.setAttribute('aria-expanded', 'false');
  link.insertAdjacentHTML('beforeend', '<span class="nav-caret" aria-hidden="true">▾</span>');

  var panel = document.createElement('div');
  panel.className = 'nav-panel';
  panel.id = 'nav-tools-panel';
  link.setAttribute('aria-controls', panel.id);
  panel.innerHTML = TOOLS.map(function (g) {
    return '<div class="nav-group"><p class="nav-group-title">' + g.group + '</p><ul>' + g.items.map(function (it) {
      return '<li><a href="' + it[0] + '"' + (it[0] === here ? ' aria-current="page"' : '') + '>' + it[1] + (it[2] ? ' <span class="tag tag-beta">베타</span>' : '') + '</a></li>';
    }).join('') + '</ul></div>';
  }).join('') + '<p class="nav-all"><a href="index.html#tools">전체 도구 카드로 보기 →</a></p>';
  wrap.appendChild(panel);

  function setOpen(on) {
    wrap.classList.toggle('open', on);
    link.setAttribute('aria-expanded', on ? 'true' : 'false');
  }
  var hoverable = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  // 링크와 목록 사이 빈 공간을 지나는 동안 닫히지 않도록 잠시 기다렸다 닫음
  var closeTimer = null;
  wrap.addEventListener('mouseenter', function () { if (hoverable) { clearTimeout(closeTimer); setOpen(true); } });
  wrap.addEventListener('mouseleave', function () { if (hoverable) closeTimer = setTimeout(function () { setOpen(false); }, 300); });
  wrap.addEventListener('focusin', function () { setOpen(true); });
  wrap.addEventListener('focusout', function (e) { if (!wrap.contains(e.relatedTarget)) setOpen(false); });
  // 터치 화면: 첫 번째 누름은 목록만 펼침. 누르는 순간 포커스로 먼저 열리므로 누르기 직전 상태로 판단한다.
  var wasOpen = null;
  link.addEventListener('pointerdown', function () { wasOpen = wrap.classList.contains('open'); });
  link.addEventListener('click', function (e) {
    var before = wasOpen === null ? wrap.classList.contains('open') : wasOpen;
    wasOpen = null;
    if (!hoverable && !before) { e.preventDefault(); setOpen(true); }
  });
  document.addEventListener('click', function (e) { if (!wrap.contains(e.target)) setOpen(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && wrap.classList.contains('open')) { setOpen(false); link.focus(); } });
})();

// 방문자 수 (Cloudflare Worker cpatool-counter, 2026-11-12). 같은 브라우저는 하루 한 번만 셉니다.
// 숫자(오늘·누적)만 저장하며 IP·쿠키 등 개인 정보는 저장하지 않습니다. 날짜 표시만 로컬 저장소에 둡니다.
(function () {
  var API = 'https://cpatool-counter.ybackh.workers.dev/';
  var foot = document.querySelector('.site-footer .wrap');
  if (!foot || !window.fetch) return;
  var today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10); // 한국 시간 기준 날짜
  var key = 'cpt_visit_day', counted = false;
  try { counted = localStorage.getItem(key) === today; } catch (e) {}
  var live = location.hostname === 'cpatool.co.kr' || location.hostname === 'www.cpatool.co.kr';
  fetch(API, { method: live && !counted ? 'POST' : 'GET', cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || typeof d.total !== 'number') return;
      if (live) { try { localStorage.setItem(key, today); } catch (e) {} }
      var p = document.createElement('p');
      p.className = 'visit-count';
      p.textContent = '오늘 방문 ' + d.today.toLocaleString('ko-KR') + ' · 누적 방문 ' + d.total.toLocaleString('ko-KR');
      foot.appendChild(p);
    })
    .catch(function () {});
})();
