/* 내부회계관리제도 적용 대상 확인 화면 로직 */
(function () {
  'use strict';
  var I = window.IcfrRules;
  var form = document.getElementById('icfr-form');
  var errorBox = document.getElementById('errors');
  var resultBox = document.getElementById('result');

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var r = I.evaluate({
      audited: form.audited.checked,
      companyType: form.companyType.value,
      listed: form.listed.checked,
      assets: form.assets.value,
      groupAffiliate: form.groupAffiliate.checked,
      reportingEntity: form.reportingEntity.checked,
      financial: form.financial.checked,
      specialVehicle: form.specialVehicle.checked,
    });
    if (r.status === 'INVALID') {
      errorBox.innerHTML = '<ul class="error-list">' + r.errors.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>';
      resultBox.classList.add('hidden');
      return;
    }
    errorBox.innerHTML = '';
    render(r);
  });

  var V = {
    APPLY: { cls: 'target', title: '내부회계관리제도 적용 대상으로 판단됩니다' },
    EXEMPT: { cls: 'not-target', title: '내부회계관리제도 적용 대상이 아닌 것으로 판단됩니다' },
    NOT_COMPANY: { cls: 'exempt', title: '외부감사 대상이 아니면 적용되지 않습니다' },
  };

  function render(r) {
    var v = V[r.status];
    var html = '<div class="result-head"><p class="verdict">' + v.title + '</p><p>' + esc(r.reason) + '</p></div><div class="result-body">';
    if (r.status === 'APPLY') {
      html += '<h3>감사인의 역할</h3><p style="margin:0">' + (r.auditorRole === 'audit'
        ? '감사인이 내부회계관리제도 운영실태를 <b>감사</b>하고 감사보고서에 종합의견을 표명합니다.'
        : '감사인이 내부회계관리제도 운영실태 보고 내용을 <b>검토</b>하고 감사보고서에 종합의견을 표명합니다.') + '</p>';
      html += '<h3>갖춰야 할 사항</h3><ul class="basis">' + r.duties.map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + '</ul>';
    }
    html += '<h3>판정 근거</h3><ul class="basis">' + r.basis.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul>';
    if (r.notes.length) html += '<h3>참고</h3><ul class="basis">' + r.notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>';
    html += '<div class="notice">이 결과는 입력하신 정보로 외감법과 시행령 기준을 기계적으로 적용한 참고 자료입니다. 공시대상기업집단·사업보고서 제출대상 해당 여부, 금융위원회 고시 등에 따라 달라질 수 있으므로 최종 판단은 공인회계사와 상담하시기 바랍니다. (판정 기준일: ' + r.version + ')</div>';
    html += '<div class="btn-row" style="margin-top:16px"><a class="btn" href="contact.html?topic=icfr">이 결과로 상담 신청하기</a>' +
      '<button type="button" class="btn secondary" data-print onclick="window.print()">결과 인쇄</button></div></div>';
    resultBox.className = 'result ' + v.cls;
    resultBox.innerHTML = html;
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
    var summary = '[내부회계 적용 대상 확인 결과] ' + v.title + '\n- ' + r.reason + (r.auditorRole ? '\n- 감사인 역할: ' + (r.auditorRole === 'audit' ? '감사' : '검토') : '');
    try { sessionStorage.setItem('auditCheckSummary', summary); } catch (err) { /* 저장 불가 환경 무시 */ }
  }
})();
