/* 감사인 지정 대상 확인 화면 */
(function () {
  'use strict';
  var R = window.AuditDesignationRules;
  var form = document.getElementById('ad-form');
  var errorBox = document.getElementById('errors');
  var resultBox = document.getElementById('result');
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function list(title, arr) { return arr.length ? '<h3>' + title + '</h3><ul class="basis">' + arr.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : ''; }
  function v(id) { return document.getElementById(id).value.trim(); }

  function sync() {
    var listed = form.isListed.value === 'yes';
    document.querySelectorAll('.listed-only').forEach(function (el) { el.classList.toggle('hidden', !listed); });
    document.querySelectorAll('.unlisted-only').forEach(function (el) { el.classList.toggle('hidden', listed); });
    document.querySelector('.ipo-only').classList.toggle('hidden', !form.ipoPlanned.checked);
    document.querySelector('.managed-only').classList.toggle('hidden', !(listed && form.managed.checked));
  }
  form.addEventListener('change', sync); sync();

  var VERDICT = {
    LIKELY: { cls: 'target', title: '감사인 지정 사유에 해당할 수 있습니다' },
    WATCH: { cls: 'exempt', title: '지금은 지정 사유가 없지만 주기적 지정 관리가 필요합니다' },
    NONE: { cls: 'not-target', title: '감사인 지정 사유가 확인되지 않습니다' },
  };

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var listed = form.isListed.value === 'yes';
    var r = R.evaluate({
      isListed: listed, market: listed ? form.market.value : '', freeYears: v('freeYears'),
      totalAssets: listed ? '' : v('totalAssets'), majorPct: listed ? '' : v('majorPct'), ownerIsCeo: form.ownerIsCeo.checked, inGroupOrReport: form.inGroupOrReport.checked,
      ipoPlanned: form.ipoPlanned.checked, ipoExcluded: form.ipoExcluded.checked, notAppointed: form.notAppointed.checked, violation: form.violation.checked,
      loss3: listed && form.loss3.checked, ocf3: listed && form.ocf3.checked, icr3: listed && form.icr3.checked, managed: listed && form.managed.checked, managedMarketOnly: form.managedMarketOnly.checked,
      ownerChange2: listed && form.ownerChange2.checked, ceoChange3: listed && form.ceoChange3.checked, embezzlement: listed && form.embezzlement.checked,
    });
    if (r.status === 'INVALID') {
      errorBox.innerHTML = '<ul class="error-list">' + r.errors.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>';
      resultBox.classList.add('hidden');
      return;
    }
    errorBox.innerHTML = '';
    var vd = VERDICT[r.status];
    var html = '<div class="result-head"><p class="verdict">' + vd.title + '</p><p>' + esc(r.reason) + '</p></div><div class="result-body">';
    if (r.reasons.length) {
      html += '<h3>해당 사유</h3><div class="table-scroll"><table><thead><tr><th>사유</th><th>근거</th></tr></thead><tbody>' +
        r.reasons.map(function (x) { return '<tr><td>' + esc(x.text) + '</td><td>' + esc(x.basis) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    }
    if (r.periodic && r.periodic.eligible) {
      html += '<h3>주기적 지정 진행 상황</h3><p>' + esc(r.periodic.why) + ' · 연속 자유선임 <b>' + r.periodic.freeYears + '년</b>' + (r.periodic.due ? ' → 6년을 채워 다음 3개 사업연도 지정 대상이 될 수 있습니다.' : ' → ' + r.periodic.yearsLeft + '년 뒤 6년이 됩니다.') + '</p>' +
        '<div class="progress" aria-hidden="true"><span style="width:' + Math.min(100, Math.round(r.periodic.freeYears / 6 * 100)) + '%"></span></div>';
    }
    html += list('판정 근거', r.basis) + list('참고', r.notes) +
      '<h3>지정감사를 받게 되면</h3><ul class="basis"><li>지정 통지 후 2주 이내에 감사계약을 맺어야 하고, 증선위가 적정 감사시간·보수를 권고할 수 있습니다(시행령 제17조제5항·제6항).</li><li>지정받은 감사인은 지정 사업연도 다음 첫 사업연도의 감사인으로 다시 선임할 수 없습니다(법 제11조제6항).</li><li>지정감사인은 전임 감사인과 다른 시각으로 보므로 회계정책·추정의 근거 문서를 미리 정리해 두면 감사 대응 부담이 줄어듭니다.</li></ul>' +
      '<div class="notice">이 결과는 체크하신 항목에 외감법 제11조와 시행령 제14조·제15조를 적용한 참고 자료입니다. 감사인 지정은 증권선물위원회가 결정하며, 지정 사유·제외·유예의 세부는 금융위원회 고시(외부감사 및 회계 등에 관한 규정)에 따르므로 최종 확인은 공인회계사와 상담하시기 바랍니다. (기준 확인일: ' + r.version + ')</div>' +
      '<div class="btn-row" style="margin-top:16px"><a class="btn" href="contact.html?topic=audit">지정감사 대응 상담 신청</a><a class="btn secondary" href="audit-schedule.html">감사 일정 계산</a></div></div>';
    resultBox.className = 'result ' + vd.cls;
    resultBox.innerHTML = html;
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
    try { sessionStorage.setItem('auditCheckSummary', '[감사인 지정 대상 확인] ' + vd.title + '\n- ' + r.reason + (r.reasons.length ? '\n- ' + r.reasons.map(function (x) { return x.text; }).join(' / ') : '')); } catch (err) { /* 저장 불가 환경 무시 */ }
  });
})();
