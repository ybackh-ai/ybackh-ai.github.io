/* 연결재무제표 작성 대상 확인 화면 */
(function () {
  'use strict';
  var R = window.ConsolidationRules;
  var form = document.getElementById('cs-form');
  var errorBox = document.getElementById('errors');
  var resultBox = document.getElementById('result');
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function list(title, arr) { return arr.length ? '<h3>' + title + '</h3><ul class="basis">' + arr.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : ''; }

  function sync() { var on = form.hasInvestee.checked; document.querySelectorAll('.investee-only').forEach(function (el) { el.classList.toggle('hidden', !on); }); }
  form.hasInvestee.addEventListener('change', sync); sync();

  var VERDICT = {
    CONSOLIDATE: { cls: 'target', title: '연결재무제표 작성 대상으로 판단됩니다' },
    LIKELY: { cls: 'exempt', title: '지배력이 있는지 판단이 필요합니다' },
    EQUITY: { cls: 'exempt', title: '연결보다는 지분법 적용 대상일 수 있습니다' },
    NONE: { cls: 'not-target', title: '연결재무제표 작성 대상이 아닌 것으로 판단됩니다' },
  };

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var r = R.evaluate({
      hasInvestee: form.hasInvestee.checked,
      votingPct: form.votingPct.value.trim(),
      boardMajority: form.boardMajority.checked,
      contractControl: form.contractControl.checked,
      standard: form.standard.value,
      isListed: form.isListed.checked,
      ultimateParentConsolidates: form.ultimateParentConsolidates.checked,
    });
    if (r.status === 'INVALID') {
      errorBox.innerHTML = '<ul class="error-list">' + r.errors.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>';
      resultBox.classList.add('hidden');
      return;
    }
    errorBox.innerHTML = '';
    var v = VERDICT[r.status];
    var html = '<div class="result-head"><p class="verdict">' + v.title + '</p><p>' + esc(r.reason) + '</p></div><div class="result-body">' +
      list('판정 근거', r.basis) + list('참고', r.notes) + list('다음 단계', r.nextSteps) +
      '<div class="notice">이 결과는 입력하신 지분율과 체크 항목만으로 일반적인 판단 요소를 적용한 참고 자료입니다. 잠재적 의결권, 약정 내용, 사실상 지배력 등에 따라 결론이 달라질 수 있으므로 최종 판단은 공인회계사와 상담하시기 바랍니다. (기준 확인일: ' + r.version + ')</div>' +
      '<div class="btn-row" style="margin-top:16px"><a class="btn" href="contact.html?topic=ifrs">연결재무제표 상담 신청</a>' +
      (r.status === 'CONSOLIDATE' || r.status === 'LIKELY' ? '<a class="btn secondary" href="audit-schedule.html">연결 포함 일정 계산</a>' : '') + '</div></div>';
    resultBox.className = 'result ' + v.cls;
    resultBox.innerHTML = html;
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
    try { sessionStorage.setItem('auditCheckSummary', '[연결재무제표 작성 대상 확인] ' + v.title + '\n- ' + r.reason); } catch (err) { /* 저장 불가 환경 무시 */ }
  });
})();
