/* 외부감사 일정 계산기 화면 로직 */
(function () {
  'use strict';
  var S = window.AuditSchedule;
  var form = document.getElementById('schedule-form');
  var errorBox = document.getElementById('errors');
  var resultBox = document.getElementById('result');
  var preview = document.getElementById('fy-preview');

  // 결산월·연도 선택지
  for (var m = 1; m <= 12; m++) form.fyEndMonth.add(new Option(m + '월', m, m === 12, m === 12));
  var thisYear = new Date().getFullYear();
  for (var y = thisYear - 1; y <= thisYear + 2; y++) form.fyEndYear.add(new Option(y + '년', y, y === thisYear, y === thisYear));

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function kdate(s) { var p = s.split('-'); return p[0] + '년 ' + Number(p[1]) + '월 ' + Number(p[2]) + '일'; }

  function syncPreview() {
    var f = S.fiscalYear(Number(form.fyEndMonth.value), Number(form.fyEndYear.value));
    preview.textContent = '사업연도: ' + kdate(f.start) + ' ~ ' + kdate(f.end) + ' (12개월 기준)';
  }
  form.addEventListener('change', syncPreview);
  syncPreview();

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var r = S.calculate({
      companyType: form.companyType.value,
      fyEndMonth: Number(form.fyEndMonth.value),
      fyEndYear: Number(form.fyEndYear.value),
      agmDate: form.agmDate.value,
      firstAudit: form.firstAudit.checked,
      auditCommittee: form.auditCommittee.checked,
      consolidated: form.consolidated.checked,
      kifrs: form.kifrs.checked,
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
    var html = '<div class="result-head"><p class="verdict">외부감사 주요 일정</p><p>' +
      esc('사업연도 ' + kdate(r.fyStart) + ' ~ ' + kdate(r.fyEnd) + (r.agmDate ? ' · 정기총회 ' + kdate(r.agmDate) : '')) + '</p></div>';
    html += '<div class="result-body"><ol class="timeline">';
    r.items.forEach(function (it) {
      var when = it.date ? '<span class="tl-date">' + esc(kdate(it.date)) + ' (' + it.weekday + ')' + (it.when ? ' ' + esc(it.when) : '') + '</span>'
        : '<span class="tl-date tl-nodate">' + esc(it.rule) + '</span>';
      html += '<li class="' + (it.key === 'agm' ? 'tl-agm' : '') + '">' + when +
        '<p class="tl-title">' + esc(it.title) + ' <span class="tag">' + esc(it.who) + '</span></p>' +
        (it.date ? '<p class="tl-rule">' + esc(it.rule) + '</p>' : '') +
        (it.weekendNext ? '<p class="tl-warn">' + (it.weekendLaw === 'tax'
          ? '기한이 주말이므로 국세기본법 제5조제1항에 따라 ' + esc(kdate(it.weekendNext)) + '(월)이 기한입니다. 그날이 공휴일·노동절이면 다시 다음 날로 넘어갑니다(공휴일 미반영).'
          : '기한이 주말입니다. 민법 제161조에 따라 ' + esc(kdate(it.weekendNext)) + '(월)까지로 늦춰질 수 있습니다. 공휴일은 반영하지 않았습니다.') + '</p>' : '') +
        (it.weekendPrev ? '<p class="tl-warn">기한이 주말입니다. ' + esc(kdate(it.weekendPrev)) + '(금)까지 마치는 것이 안전합니다.</p>' : '') +
        (it.note ? '<p class="tl-note">' + esc(it.note) + '</p>' : '') +
        (it.basis ? '<p class="tl-basis">근거: ' + esc(it.basis) + '</p>' : '') +
        '</li>';
    });
    html += '</ol>';

    html += '<h3>참고</h3><ul class="basis">' + r.notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>';

    html += '<div class="notice">이 일정은 입력하신 정보로 외감법과 시행령의 기한을 기계적으로 계산한 참고 자료입니다. ' +
      '회사의 상장 여부, 감사인 지정, 정관과 이사회 승인 방식 등에 따라 실제 기한이 달라질 수 있으므로 최종 일정은 공인회계사와 상담하시기 바랍니다. ' +
      '(계산 기준일: ' + r.version + ')</div>';

    html += '<div class="btn-row" style="margin-top:16px"><a class="btn" href="contact.html?topic=audit">이 일정으로 상담 신청하기</a>' +
      '<button type="button" class="btn secondary" data-print onclick="window.print()">일정 인쇄</button></div></div>';

    resultBox.className = 'result exempt';
    resultBox.innerHTML = html;
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });

    var summary = '[외부감사 일정 계산기 결과] 사업연도 ' + r.fyStart + ' ~ ' + r.fyEnd + (r.agmDate ? ', 정기총회 ' + r.agmDate : '') + '\n' +
      r.items.filter(function (it) { return it.date; }).map(function (it) { return '- ' + it.date + ' ' + it.title; }).join('\n');
    try { sessionStorage.setItem('auditCheckSummary', summary); } catch (err) { /* 저장 불가 환경 무시 */ }
  }
})();
