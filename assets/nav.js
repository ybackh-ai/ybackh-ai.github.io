/*
 * 상단 메뉴 "회계 도구" 펼침 목록 — 도구 목록의 단일 출처.
 * 새 도구를 추가하면 여기(TOOLS)와 첫 화면 #tools 카드에 함께 넣는다. 스크립트가 없어도 링크는 index.html#tools로 이동.
 * PC: 마우스를 올리거나 키보드 포커스로 펼침. 터치 화면: 처음 누르면 펼치고, 다시 누르면 도구 목록 화면으로 이동.
 */
(function () {
  'use strict';
  var TOOLS = [
    { group: '외부감사·내부회계', items: [
      ['audit-check.html', '외부감사 대상 판정기'], ['audit-schedule.html', '외부감사 일정 계산기'], ['audit-prep.html', '첫 외부감사 준비 체크리스트', 1], ['icfr-check.html', '내부회계관리제도 적용 대상'], ['consolidation.html', '연결재무제표 작성 대상', 1], ['audit-designation.html', '감사인 지정 대상 확인'], ['audit-fee.html', '감사보수는 어떻게 정해지나'], ['ipo-prep.html', 'IPO 준비 회계 체크리스트', 1], ['governance.html', '감사위원회·상근감사 설치 의무'],
    ] },
    { group: '결산·회계처리', items: [
      ['lease.html', '리스 회계 (사용권자산·리스부채)', 1], ['depreciation.html', '감가상각 (세법 상각범위액)'], ['allowance.html', '대손충당금 연령분석', 1], ['retirement.html', '퇴직급여충당부채', 1], ['deferred-tax.html', '이연법인세 간이 계산', 1], ['revenue-check.html', '수익인식 쟁점 진단', 1],
    ] },
    { group: '중소기업·벤처', items: [
      ['sme-check.html', '중소기업 해당 여부 판정기'], ['tax-sme.html', '세법상 중소기업 판정기'], ['venture-check.html', '벤처기업 확인 요건 진단'],
    ] },
    { group: '세무', items: [
      ['inherit-gift.html', '상속·증여세 간이 계산'], ['loan-interest.html', '가지급금 인정이자 계산기', 1], ['stock-option-tax.html', '스톡옵션 행사 세금'], ['corp-vs-personal.html', '법인 vs 개인사업자 세금 비교'], ['tax-calendar.html', '법인 세무 신고 일정표'],
      ['corp-tax.html', '법인세 간이 계산기'], ['withholding.html', '원천징수 세액 계산기'], ['entertainment.html', '기업업무추진비(접대비) 한도'], ['business-car.html', '업무용승용차 비용 한도'], ['share-transfer-tax.html', '비상장주식 양도소득세'],
      ['related-price.html', '특수관계인 주식 거래 시가 판정'], ['related-party.html', '특수관계인 범위 확인', 1], ['succession.html', '가업상속공제 요건 확인', 1], ['tax-penalty.html', '가산세 계산기', 1],
    ] },
    { group: '세액공제·감면', items: [
      ['employment-credit.html', '통합고용세액공제', 1], ['rnd-credit.html', '연구·인력개발비 세액공제', 1], ['investment-credit.html', '통합투자세액공제'], ['startup-relief.html', '창업중소기업 세액감면', 1], ['angel-deduction.html', '엔젤투자 소득공제'],
    ] },
    { group: '가치평가·M&A', items: [
      ['valuation-needs.html', '어떤 평가가 필요한가요?'], ['stock-valuation.html', '비상장주식 상증법 약식 평가'], ['dcf.html', 'DCF·WACC 간이 계산기'], ['dilution.html', '투자 유치 지분 희석'],
      ['ppa.html', 'PPA 영업권 간이 계산기', 1], ['impairment.html', '손상검사 간이 진단', 1], ['external-valuation.html', '자본시장법 외부평가 대상', 1], ['merger-price.html', '상장사 합병가액', 1], ['stock-option.html', '스톡옵션 공정가치'], ['option-limit.html', '스톡옵션 부여 한도'], ['rcps-cb.html', 'RCPS·CB 평가 필요 여부', 1],
      ['safe-conversion.html', 'SAFE·전환사채 전환 주식수'], ['equity-bridge.html', '기업가치→지분가치 환산'], ['multiples.html', '유사기업 멀티플 평가'], ['pf-feasibility.html', '부동산 PF 사업성', 1], ['qualified-reorg.html', '적격합병·적격분할 요건', 1],
    ] },
    { group: '재무분석·자료', items: [
      ['fin-ratio.html', '재무비율 간이 진단'], ['capital-impairment.html', '자본잠식·채무초과 진단'], ['distributable-profit.html', '배당가능이익·자기주식 한도'], ['qna.html', '외부감사·회계 Q&A'], ['cases.html', '수행 사례'], ['basis.html', '기준일·변경 이력'],
    ] },
  ];

  var link = document.querySelector('.nav a[href="index.html#tools"]');
  if (!link) return;
  var here = location.pathname.split('/').pop() || 'index.html';

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
