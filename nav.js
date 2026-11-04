/*
 * 상단 메뉴 "회계 도구" 펼침 목록 — 도구 목록의 단일 출처.
 * 새 도구를 추가하면 여기(TOOLS)와 첫 화면 #tools 카드에 함께 넣는다. 스크립트가 없어도 링크는 index.html#tools로 이동.
 * PC: 마우스를 올리거나 키보드 포커스로 펼침. 터치 화면: 처음 누르면 펼치고, 다시 누르면 도구 목록 화면으로 이동.
 */
(function () {
  'use strict';
  var TOOLS = [
    { group: '외부감사·내부회계', items: [
      ['audit-check.html', '외부감사 대상 판정기'], ['audit-schedule.html', '외부감사 일정 계산기', 1], ['audit-prep.html', '첫 외부감사 준비 체크리스트', 1], ['icfr-check.html', '내부회계관리제도 적용 대상'], ['consolidation.html', '연결재무제표 작성 대상', 1], ['audit-designation.html', '감사인 지정 대상 확인'], ['audit-fee.html', '감사보수는 어떻게 정해지나'], ['ipo-prep.html', 'IPO 준비 회계 체크리스트', 1],
    ] },
    { group: '중소기업·벤처', items: [
      ['sme-check.html', '중소기업 해당 여부 판정기'], ['tax-sme.html', '세법상 중소기업 판정기'], ['venture-check.html', '벤처기업 확인 요건 진단'],
    ] },
    { group: '세무', items: [
      ['inherit-gift.html', '상속·증여세 간이 계산'], ['loan-interest.html', '가지급금 인정이자 계산기', 1], ['stock-option-tax.html', '스톡옵션 행사 세금'], ['corp-vs-personal.html', '법인 vs 개인사업자 세금 비교'],
    ] },
    { group: '가치평가·M&A', items: [
      ['valuation-needs.html', '어떤 평가가 필요한가요?'], ['stock-valuation.html', '비상장주식 상증법 약식 평가', 1], ['dcf.html', 'DCF·WACC 간이 계산기'], ['dilution.html', '투자 유치 지분 희석'],
      ['ppa.html', 'PPA 영업권 간이 계산기', 1], ['impairment.html', '손상검사 간이 진단', 1], ['external-valuation.html', '자본시장법 외부평가 대상', 1], ['merger-price.html', '상장사 합병가액', 1], ['stock-option.html', '스톡옵션 공정가치'], ['option-limit.html', '스톡옵션 부여 한도'], ['rcps-cb.html', 'RCPS·CB 평가 필요 여부', 1],
    ] },
    { group: '재무분석·자료', items: [
      ['fin-ratio.html', '재무비율 간이 진단'], ['capital-impairment.html', '자본잠식·채무초과 진단'], ['qna.html', '외부감사·회계 Q&A'], ['cases.html', '수행 사례'], ['basis.html', '기준일·변경 이력'],
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
