/* 스톡옵션 부여 한도 계산기 화면 */
(function () {
  'use strict';
  var R = window.OptionLimitRules;
  var form = document.getElementById('ol-form');
  var errorBox = document.getElementById('errors');
  var resultBox = document.getElementById('result');
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function n(x) { return Number(x).toLocaleString('ko-KR'); }
  function v(id) { return document.getElementById(id).value.trim(); }
  function list(title, arr) { return arr.length ? '<h3>' + title + '</h3><ul class="basis">' + arr.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : ''; }

  function sync() {
    var t = form.companyType.value;
    document.querySelector('.venture-only').classList.toggle('hidden', t !== 'venture');
    document.querySelector('.listed-only').classList.toggle('hidden', t !== 'listed');
  }
  form.addEventListener('change', sync); sync();

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var r = R.evaluate({ companyType: form.companyType.value, totalShares: v('totalShares'), granted: v('granted'), newGrant: v('newGrant'),
      outsiderGranted: v('outsiderGranted'), outsiderNew: v('outsiderNew'), capital: v('capital'), boardGrant: v('boardGrant') });
    if (r.status === 'INVALID') {
      errorBox.innerHTML = '<ul class="error-list">' + r.errors.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>';
      resultBox.classList.add('hidden');
      return;
    }
    errorBox.innerHTML = '';
    var ok = r.status === 'OK';
    var title = ok ? '이번 부여는 한도 안으로 판단됩니다' : '한도를 넘는 항목이 있습니다';
    var sub = '전체 한도 ' + n(r.limitShares) + '주(' + r.limitPct + '%) 중 부여 후 ' + n(r.afterGrant) + '주(' + r.usedPct + '%) · 이번 부여 전 남은 수량 ' + n(r.remaining) + '주';
    var html = '<div class="result-head"><p class="verdict">' + title + '</p><p>' + esc(sub) + '</p></div><div class="result-body">' +
      '<h3>한도별 확인</h3><div class="table-scroll"><table><thead><tr><th>항목</th><th class="num">한도(주)</th><th class="num">부여 후 수량(주)</th><th>판정</th></tr></thead><tbody>' +
      r.checks.map(function (c) { return '<tr><td>' + esc(c.label) + '</td><td class="num">' + n(c.limit) + '</td><td class="num">' + n(c.value) + '</td><td>' + (c.ok ? '<span class="mark-no">한도 내</span>' : '<span class="mark-yes">초과</span>') + '</td></tr>'; }).join('') +
      '</tbody></table></div>' + list('근거', r.basis) + list('참고', r.notes) +
      '<div class="notice">이 결과는 입력한 주식 수에 법령의 한도 비율을 기계적으로 적용한 참고 자료입니다. 정관의 한도, 기존 부여 계약, 의결권 없는 주식의 처리, 부여 대상 제한 등은 개별 확인이 필요합니다. (기준 확인일: ' + r.version + ')</div>' +
      '<div class="btn-row" style="margin-top:16px"><a class="btn" href="contact.html?topic=ifrs">스톡옵션 설계 상담 신청</a><a class="btn secondary" href="stock-option.html">공정가치(보상비용) 계산</a></div></div>';
    resultBox.className = 'result ' + (ok ? 'not-target' : 'target');
    resultBox.innerHTML = html;
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
    try { sessionStorage.setItem('auditCheckSummary', '[스톡옵션 부여 한도] ' + title + '\n- ' + sub); } catch (err) { /* 저장 불가 환경 무시 */ }
  });
})();
