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
    'ipo': ['ipo', '상장'], '상장': ['상장', 'ipo'], '자본잠식': ['자본잠식'], '부동산': ['부동산', 'pf'], 'pf': ['pf'],
    '퇴직소득': ['퇴직'], '임원': ['임원'], '대표': ['임원', '가지급금'], '유상증자': ['증자'], '증자': ['증자'], '감자': ['감자'], '실권주': ['증자'],
    '성실신고': ['성실신고'], '개인사업자': ['개인사업자', '성실신고'], '복식부기': ['복식부기', '성실신고'], '법인전환': ['개인사업자', '성실신고'],
    '야근': ['연장', '52시간'], '야근수당': ['연장'], '초과근무': ['연장', '52시간'], '주말근무': ['휴일'], '특근': ['휴일', '연장'], '수당': ['수당'],
    '시급': ['시급'], '통상임금': ['통상임금'], '209': ['시급'], '해고': ['해고'], '권고사직': ['해고', '퇴직금'], '출산': ['출산'], '출산휴가': ['출산'],
    '육아': ['육아휴직'], '휴업': ['휴업'], '퇴직연금': ['퇴직연금'], 'dc': ['퇴직연금'], 'irp': ['퇴직연금', '연금저축'], '근무시간': ['52시간'], '근로시간': ['52시간', '연장'],
    '월급': ['실수령', '시급', '최저임금'], '연봉': ['실수령', '인건비'], '노무': ['노무']
  };
  function norm(s) { return String(s || '').toLowerCase().replace(/\s+/g, ''); }

  var cards = Array.prototype.slice.call(tools.querySelectorAll('.card'));
  var items = cards.map(function (c) {
    var grid = c.parentNode, group = grid.previousElementSibling;
    // 그룹 이름(summary.tools-group)의 "N개" 숫자는 검색 대상에서 빼도 무방(숫자 검색은 거의 없음)
    return { el: c, grid: grid, group: group && group.classList.contains('tools-group') ? group : null,
      text: norm(c.textContent + ' ' + (group ? group.textContent : '') + ' ' + (c.querySelector('a') ? c.querySelector('a').getAttribute('href') : '')) };
  });
  var groups = [], hrefs = {};
  items.forEach(function (it) { if (groups.indexOf(it.grid) < 0) groups.push(it.grid); var a = it.el.querySelector('a'); if (a) hrefs[a.getAttribute('href')] = 1; });
  var TOTAL = Object.keys(hrefs).length;

  function termMatches(text, term) {
    if (text.indexOf(term) >= 0) return true;
    var alts = SYN[term];
    if (!alts) { for (var k in SYN) { if (SYN.hasOwnProperty(k) && k.indexOf(term) === 0 && term.length >= 2) { alts = (alts || []).concat(SYN[k]); } } }
    return !!alts && alts.some(function (a) { return text.indexOf(norm(a)) >= 0; });
  }

  // (2026-11-16) 첫 화면 개편: 검색창은 맨 위, 결과는 바로 아래 #tool-q-results에 목록으로. 도구 묶음은 <details>로 접혀 있고 검색하면 맞는 묶음만 펼친다.
  var resultsEl = document.getElementById('tool-q-results');
  var searched = false;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function apply() {
    var raw = input.value.trim();
    var terms = raw.toLowerCase().split(/\s+/).map(norm).filter(Boolean);
    var shown = 0, hits = [], seen = {};
    items.forEach(function (it) {
      var ok = !terms.length || terms.every(function (t) { return termMatches(it.text, t); });
      it.el.classList.toggle('hidden', !ok);
      // (2026-11-20) 같은 도구 카드가 두 묶음에 걸려 있으면(인사·노무 묶음의 실수령액·퇴직금 등) 결과 목록·개수에는 한 번만
      var href = it.el.querySelector('a') ? it.el.querySelector('a').getAttribute('href') : '';
      if (ok && !seen[href]) { seen[href] = 1; shown++; hits.push(it); }
    });
    groups.forEach(function (g) {
      var any = Array.prototype.some.call(g.children, function (c) { return !c.classList.contains('hidden'); });
      var box = g.parentNode && g.parentNode.tagName === 'DETAILS' ? g.parentNode : null;
      if (box) {
        box.classList.toggle('hidden', !any);
        if (terms.length) box.open = any; else if (searched) box.open = false;
      } else {
        g.classList.toggle('hidden', !any);
        var h = g.previousElementSibling;
        if (h && h.classList.contains('tools-group')) h.classList.toggle('hidden', !any);
      }
    });
    if (resultsEl) {
      if (terms.length) {
        resultsEl.innerHTML = hits.slice(0, 8).map(function (it) {
          var a = it.el.querySelector('h3 a') || it.el.querySelector('a');
          return a ? '<li><a href="' + esc(a.getAttribute('href')) + '">' + esc(a.textContent) + '</a>' + (it.group ? '<span>' + esc(it.group.firstChild.textContent.trim()) + '</span>' : '') + '</li>' : '';
        }).join('') + (shown > 8 ? '<li class="more"><a href="#tools">검색 결과 ' + shown + '개 모두 보기</a></li>' : '');
        resultsEl.classList.toggle('hidden', !shown);
      } else { resultsEl.innerHTML = ''; resultsEl.classList.add('hidden'); }
    }
    searched = terms.length > 0;
    countEl.textContent = terms.length ? (shown ? '"' + raw + '" 검색 결과 ' + shown + '개' : '"' + raw + '"에 맞는 도구가 없습니다. 다른 말로 검색하시거나 상담 신청으로 문의해 주세요.') : '전체 도구 ' + TOTAL + '개 중에서 이름이나 하고 싶은 일로 찾아보세요.';
    emptyEl.classList.toggle('hidden', !(terms.length && !shown));
  }

  var timer = null;
  input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(apply, 80); });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { input.value = ''; apply(); }
    if (e.key === 'Enter') { e.preventDefault(); var a = resultsEl && resultsEl.querySelector('a'); if (!a) { var first = items.filter(function (it) { return !it.el.classList.contains('hidden'); })[0]; a = first && first.el.querySelector('a'); } if (a && input.value.trim()) a.focus(); }
  });
  var chips = document.querySelectorAll('.tool-search .chips button');
  Array.prototype.forEach.call(chips, function (b) { b.addEventListener('click', function () { input.value = b.textContent; apply(); input.focus(); }); });

  try { var q = new URLSearchParams(location.search).get('q'); if (q) input.value = q; } catch (e) { /* 오래된 브라우저 무시 */ }
  apply();
})();
