/* RCPS·CB 평가 필요 여부 안내 화면 로직 */
(function () {
  'use strict';
  var RC = window.RcpsCbRules;
  var form = document.getElementById('rc-form');
  var errorBox = document.getElementById('errors');
  var resultBox = document.getElementById('result');

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function show(sel, on) { document.querySelectorAll(sel).forEach(function (el) { el.classList.toggle('hidden', !on); if (!on) { var i = el.querySelector('input'); if (i) i.checked = false; } }); }

  function sync() {
    var t = form.instrument.value;
    show('.only-pref', !t || t === 'rcps' || t === 'cps' || t === 'rps');
    show('.only-conv', t !== 'rps');
    show('.only-eb', t === 'eb');
  }
  form.addEventListener('change', sync);
  sync();

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var r = RC.assess({
      instrument: form.instrument.value, gaap: form.gaap.value,
      holderRedemption: form.holderRedemption.checked, mandatoryDividend: form.mandatoryDividend.checked,
      refixing: form.refixing.checked, variableShares: form.variableShares.checked,
      holderPut: form.holderPut.checked, callOption: form.callOption.checked, exchangeOwnShares: form.exchangeOwnShares.checked,
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
    var title = r.needsValuation ? '공정가치 평가가 필요할 수 있습니다' : '별도 공정가치 평가가 필요하지 않을 수 있습니다';
    var lead = r.name + ' — ' + RC.CLASS_LABEL[r.classification] + '.' + (r.remeasure ? ' 분리한 파생상품은 매 결산일 다시 평가해야 할 수 있습니다.' : '');
    var html = '<div class="result-head"><p class="verdict">' + esc(title) + '</p><p>' + esc(lead) + '</p></div><div class="result-body">';
    html += '<h3>검토 포인트</h3>';
    r.points.forEach(function (p) { html += '<div class="card" style="margin-top:10px"><h3 style="margin:0 0 6px;font-size:16px">' + esc(p.title) + '</h3><p>' + esc(p.text) + '</p></div>'; });
    html += '<h3>관련 기준</h3><ul class="basis"><li>K-IFRS 제1032호 「금융상품: 표시」 — 부채·자본 분류, 복합금융상품</li><li>K-IFRS 제1109호 「금융상품」 — 내재파생상품 분리, 당기손익-공정가치 지정</li><li>K-IFRS 제1113호 「공정가치 측정」</li></ul>';
    html += '<h3>참고</h3><ul class="basis">' + r.notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>';
    html += '<p style="margin-top:12px"><b>미리 준비하면 좋은 자료:</b> 투자계약서·주주간계약서(상환·전환·리픽싱·콜/풋 조항), 정관의 종류주식 조항, 발행일과 결산일의 주식가치 자료, 발행 이후 전환·상환 이력</p>';
    html += '<div class="notice">이 안내는 선택하신 조건에 K-IFRS 일반 원칙을 적용한 참고 자료이며, 최종 분류와 평가 방법은 계약서 문구 전체를 검토해야 정할 수 있습니다. 결산 전에 감사인과 미리 협의하시기 바랍니다. (작성 기준일: ' + r.version + ')</div>';
    html += '<div class="btn-row" style="margin-top:16px"><a class="btn" href="contact.html?topic=ifrs">RCPS·CB 평가 상담 신청</a></div></div>';
    resultBox.className = 'result ' + (r.needsValuation ? 'target' : 'not-target');
    resultBox.innerHTML = html;
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
    var summary = '[RCPS·CB 평가 필요 여부] ' + r.name + ': ' + RC.CLASS_LABEL[r.classification] + (r.needsValuation ? ' / 공정가치 평가 필요 가능' : '') + (r.remeasure ? ' / 매 결산 재평가 가능' : '');
    try { sessionStorage.setItem('auditCheckSummary', summary); } catch (err) { /* 저장 불가 환경 무시 */ }
  }
})();
