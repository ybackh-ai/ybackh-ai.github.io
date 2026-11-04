/* "어떤 평가가 필요한가요?" 진단 화면 로직 */
(function () {
  'use strict';
  var N = window.ValuationNeeds;
  var form = document.getElementById('vn-form');
  var errorBox = document.getElementById('errors');
  var resultBox = document.getElementById('result');

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function purpose() { var x = form.querySelector('input[name=purpose]:checked'); return x ? x.value : ''; }

  function sync() {
    var p = purpose();
    document.querySelector('.only-listed').classList.toggle('hidden', p !== 'listed_deal');
    document.querySelector('.only-reporting').classList.toggle('hidden', p !== 'reporting');
  }
  form.addEventListener('change', sync);
  sync();

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var r = N.diagnose({
      purpose: purpose(),
      listed: form.listed.value === 'yes',
      reporting: Array.prototype.map.call(form.querySelectorAll('input[name=reporting]:checked'), function (x) { return x.value; }),
      gaap: form.gaap.value,
    });
    if (r.status === 'INVALID') {
      errorBox.innerHTML = '<ul class="error-list">' + r.errors.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>';
      resultBox.classList.add('hidden');
      return;
    }
    errorBox.innerHTML = '';
    render(r);
  });

  function render(r) {
    var title = r.results.length > 1 ? r.results.length + '가지 평가가 필요할 수 있습니다' : '필요할 수 있는 평가: ' + r.results[0].title;
    var html = '<div class="result-head"><p class="verdict">' + esc(title) + '</p><p>목적별 평가 종류와 준비 자료입니다.</p></div><div class="result-body">';
    r.results.forEach(function (x, i) {
      html += '<div class="card" style="margin-top:' + (i ? 16 : 4) + 'px"><h3 style="margin-top:0">' + esc(x.title) + '</h3><p>' + esc(x.why) + '</p>';
      html += '<p class="hint" style="margin-top:10px"><b>근거</b></p><ul class="basis">' + x.basis.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul>';
      html += '<p class="hint" style="margin-top:10px"><b>미리 준비하면 좋은 자료</b></p><ul class="basis">' + x.docs.map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + '</ul>';
      if (x.caution) html += '<p class="hint" style="margin-top:10px">주의: ' + esc(x.caution) + '</p>';
      if (x.tool) html += '<p style="margin-top:10px"><a href="' + esc(x.tool.href) + '">' + esc(x.tool.label) + '로 먼저 계산해 보기 →</a></p>';
      html += '</div>';
    });
    if (r.notes.length) html += '<h3>참고</h3><ul class="basis">' + r.notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>';
    html += '<div class="notice">이 안내는 선택하신 목적에 따라 일반적으로 필요한 평가를 정리한 참고 자료입니다. 실제로 필요한 평가와 방법은 거래 구조와 사실관계에 따라 달라질 수 있으므로 공인회계사와 상담하시기 바랍니다. (작성 기준일: ' + r.version + ')</div>';
    html += '<div class="btn-row" style="margin-top:16px"><a class="btn" href="contact.html?topic=fdd">평가 상담 신청하기</a></div></div>';
    resultBox.className = 'result exempt';
    resultBox.innerHTML = html;
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
    var summary = '[평가 필요 진단 결과] ' + r.results.map(function (x) { return x.title; }).join(', ');
    try { sessionStorage.setItem('auditCheckSummary', summary); } catch (err) { /* 저장 불가 환경 무시 */ }
  }
})();
