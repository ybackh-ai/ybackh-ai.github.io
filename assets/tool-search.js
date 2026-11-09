/*
 * 첫 화면 도구 검색: #tools 안의 카드(제목·설명·묶음 이름)를 입력어로 걸러 보여 준다. 서버 전송 없음.
 * 띄어쓰기로 나눈 단어는 모두 들어 있어야 하고(AND), 아래 SYN의 다른 말도 같은 것으로 본다. 주소 ?q=검색어 로도 열 수 있다.
 */
(function () {
  'use strict';
  var input = document.getElementById('tool-q');
  var tools = document.getElementById('tools');
  if (!input || !tools) return;
  var countEl = document.getElementById('tool-q-count'), emptyEl = document.getElementById('tool-q-empty');

  // 같은 뜻으로 찾을 말 (왼쪽을 입력하면 오른쪽 말이 들어간 카드도 보여 줌)
  var SYN = {
    '접대비': ['기업업무추진비'], '외감': ['외부감사'], '감사인': ['외부감사', '감사인'], '내부통제': ['내부회계'], 'icfr': ['내부회계'],
    '원천세': ['원천징수'], '프리랜서': ['원천징수', '사업소득'], '3.3': ['원천징수'], '강사': ['원천징수'],
    'cb': ['전환사채'], 'rcps': ['rcps', '상환'], 'safe': ['safe'], '스톡옵션': ['스톡옵션', '주식매수선택권'],
    '분할': ['분할'], '인수': ['m&a', 'ppa', '합병', '지분가치', '실사'], 'm&a': ['합병', 'ppa', '지분가치', '멀티플'],
    '평가': ['평가', 'dcf', '멀티플', '가치'], '밸류': ['가치', '평가', '멀티플', 'dcf'], '기업가치': ['가치', 'dcf', '멀티플'],
    '세액공제': ['세액공제', '공제'], '감면': ['감면'], '연구소': ['연구·인력개발비'], 'r&d': ['연구·인력개발비'], '연구개발': ['연구·인력개발비'],
    '고용': ['고용'], '채용': ['고용'], '창업': ['창업'], '스타트업': ['창업', '벤처', '스톡옵션', 'safe', '희석'],
    '자사주': ['자기주식'], '배당': ['배당'], '증여': ['증여'], '상속': ['상속', '가업'], '가업승계': ['가업'],
    '차량': ['승용차'], '자동차': ['승용차'], '법인차': ['승용차'], '리스': ['리스'], '퇴직금': ['퇴직급여'],
    '대손': ['대손충당금'], '이연': ['이연법인세'], '수익': ['수익인식'], '매출': ['수익인식', '매출'],
    '양도세': ['양도소득세'], '주식양도': ['양도소득세'], '특수관계': ['특수관계'], '가지급금': ['가지급금'],
    '가산세': ['가산세'], '연체': ['가산세', '납부지연'], '수정신고': ['가산세'], '기한후신고': ['가산세'],
    'ipo': ['ipo', '상장'], '상장': ['상장', 'ipo'], '자본잠식': ['자본잠식'], '부동산': ['부동산', 'pf'], 'pf': ['pf']
  };
  function norm(s) { return String(s || '').toLowerCase().replace(/\s+/g, ''); }

  var cards = Array.prototype.slice.call(tools.querySelectorAll('.card'));
  var items = cards.map(function (c) {
    var grid = c.parentNode, group = grid.previousElementSibling;
    return { el: c, grid: grid, group: group && group.classList.contains('tools-group') ? group : null,
      text: norm(c.textContent + ' ' + (group ? group.textContent : '') + ' ' + (c.querySelector('a') ? c.querySelector('a').getAttribute('href') : '')) };
  });
  var groups = [];
  items.forEach(function (it) { if (groups.indexOf(it.grid) < 0) groups.push(it.grid); });

  function termMatches(text, term) {
    if (text.indexOf(term) >= 0) return true;
    var alts = SYN[term];
    if (!alts) { for (var k in SYN) { if (SYN.hasOwnProperty(k) && k.indexOf(term) === 0 && term.length >= 2) { alts = (alts || []).concat(SYN[k]); } } }
    return !!alts && alts.some(function (a) { return text.indexOf(norm(a)) >= 0; });
  }

  function apply() {
    var raw = input.value.trim();
    var terms = raw.toLowerCase().split(/\s+/).map(norm).filter(Boolean);
    var shown = 0;
    items.forEach(function (it) {
      var ok = !terms.length || terms.every(function (t) { return termMatches(it.text, t); });
      it.el.classList.toggle('hidden', !ok);
      if (ok) shown++;
    });
    groups.forEach(function (g) {
      var any = Array.prototype.some.call(g.children, function (c) { return !c.classList.contains('hidden'); });
      g.classList.toggle('hidden', !any);
      var h = g.previousElementSibling;
      if (h && h.classList.contains('tools-group')) h.classList.toggle('hidden', !any);
    });
    countEl.textContent = terms.length ? '"' + raw + '" 검색 결과 ' + shown + '개 / 전체 ' + items.length + '개' : '전체 도구 ' + items.length + '개 — 이름이나 하고 싶은 일로 검색해 보세요.';
    emptyEl.classList.toggle('hidden', !(terms.length && !shown));
  }

  var timer = null;
  input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(apply, 80); });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { input.value = ''; apply(); }
    if (e.key === 'Enter') { e.preventDefault(); var first = items.filter(function (it) { return !it.el.classList.contains('hidden'); })[0]; if (first && input.value.trim()) { var a = first.el.querySelector('a'); if (a) a.focus(); } }
  });
  var chips = tools.querySelectorAll('.tool-search .chips button');
  Array.prototype.forEach.call(chips, function (b) { b.addEventListener('click', function () { input.value = b.textContent; apply(); input.focus(); }); });

  try { var q = new URLSearchParams(location.search).get('q'); if (q) input.value = q; } catch (e) { /* 오래된 브라우저 무시 */ }
  apply();
})();
