/* 외부감사 대상 판정기 화면 로직 */
(function () {
  'use strict';
  var R = window.AuditRules;
  var form = document.getElementById('audit-form');
  var errorBox = document.getElementById('errors');
  var resultBox = document.getElementById('result');

  // 면제 사유 체크박스 생성
  var exWrap = document.getElementById('exemption-list');
  Object.keys(R.EXEMPTIONS).forEach(function (key) {
    var ex = R.EXEMPTIONS[key];
    var label = document.createElement('label');
    label.className = 'choice';
    label.innerHTML = '<input type="checkbox" name="exemptions" value="' + key + '"><span>' + ex.label +
      ' <span class="hint" style="display:inline">(' + ex.basis + ')</span></span>';
    exWrap.appendChild(label);
  });

  // 유한회사 전용 항목 표시
  function syncType() {
    var t = form.companyType.value;
    document.querySelectorAll('.llc-only').forEach(function (el) { el.classList.toggle('hidden', t !== 'llc'); });
    var converted = form.llcRecentlyConverted.checked;
    document.getElementById('members-field').classList.toggle('hidden', t !== 'llc' || converted);
  }
  form.addEventListener('change', syncType);
  syncType();

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var input = {
      companyType: form.companyType.value,
      listed: form.listed.checked,
      planningListing: form.planningListing.checked,
      exemptions: Array.prototype.map.call(form.querySelectorAll('input[name=exemptions]:checked'), function (x) { return x.value; }),
      assets: form.assets.value,
      liabilities: form.liabilities.value,
      sales: form.sales.value,
      fiscalMonths: form.fiscalMonths.value,
      employees: form.employees.value,
      members: form.members.value,
      llcRecentlyConverted: form.llcRecentlyConverted.checked,
    };
    var r = R.evaluate(input);

    if (r.status === 'INVALID') {
      errorBox.innerHTML = '<ul class="error-list">' + r.errors.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>';
      errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      resultBox.classList.add('hidden');
      return;
    }
    errorBox.innerHTML = '';
    render(r, input);
  });

  var VERDICT = {
    TARGET: { cls: 'target', title: '외부감사 대상으로 판단됩니다' },
    NOT_TARGET: { cls: 'not-target', title: '외부감사 대상이 아닌 것으로 판단됩니다' },
    EXEMPT: { cls: 'exempt', title: '외부감사 면제 대상일 수 있습니다' },
  };

  function render(r, input) {
    var v = VERDICT[r.status];
    var html = '';
    html += '<div class="result-head"><p class="verdict">' + v.title + '</p><p>' + esc(r.reason) + '</p></div>';
    html += '<div class="result-body">';

    if (r.criteria.length) {
      html += '<h3>기준별 해당 여부 <span class="hint" style="display:inline">(' + (r.appliedRule === 'llc' ? '유한회사 기준: 5개 중 3개 이상' : '주식회사 기준: 4개 중 2개 이상') + ', 해당 ' + r.metCount + '개)</span></h3>';
      html += '<table><thead><tr><th>기준</th><th class="num">입력값</th><th>해당</th></tr></thead><tbody>';
      r.criteria.forEach(function (c) {
        html += '<tr><td>' + esc(c.label) + '</td><td class="num">' + R.fmt(c.value) + c.unit + '</td><td>' +
          (c.met ? '<span class="mark-yes">해당</span>' : '<span class="mark-no">미해당</span>' + (c.near ? ' <span class="mark-near">근접</span>' : '')) +
          '</td></tr>';
      });
      html += '</tbody></table>';
    }

    html += '<h3>판정 근거</h3><ul class="basis">' + r.basis.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul>';

    if (r.notes.length) {
      html += '<h3>참고</h3><ul class="basis">' + r.notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>';
    }

    html += '<h3>다음 단계</h3>' + nextSteps(r.status);

    html += '<div class="notice">이 결과는 입력하신 수치만으로 외감법 제4조와 시행령 제5조를 기계적으로 적용한 참고 자료입니다. ' +
      '종업원 수 산정 범위, 사업연도 기간, 면제 사유 해당 여부 등은 개별 사실관계에 따라 달라질 수 있으므로, 최종 판단은 공인회계사와 상담하시기 바랍니다. ' +
      '(판정 기준일: ' + r.version + ')</div>';

    html += '<div class="btn-row" style="margin-top:16px"><a class="btn" id="go-contact" href="contact.html?topic=audit">이 결과로 상담 신청하기</a>' +
      '<button type="button" class="btn secondary" data-print onclick="window.print()">결과 인쇄</button></div>';
    html += '</div>';

    resultBox.className = 'result ' + v.cls;
    resultBox.innerHTML = html;
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // 상담 폼으로 결과 요약 전달 (같은 탭 세션 한정)
    var summary = '[외부감사 대상 판정기 결과] ' + v.title + '\n- ' + r.reason +
      (r.criteria.length ? '\n- 입력값: ' + r.criteria.map(function (c) { return c.label.split(' ')[0] + ' ' + R.fmt(c.value) + c.unit; }).join(', ') : '') +
      '\n- 근거: ' + r.basis.join(' / ');
    try { sessionStorage.setItem('auditCheckSummary', summary); } catch (err) { /* 저장 불가 환경 무시 */ }
  }

  function nextSteps(status) {
    if (status === 'TARGET') {
      return '<ul class="basis">' +
        '<li>외부감사 대상 회사는 원칙적으로 <b>사업연도 개시일부터 45일 이내</b>에 감사인을 선임해야 합니다(외감법 제10조제1항). 감사위원회 설치 의무가 있는 회사는 사업연도 개시일 이전입니다.</li>' +
        '<li><b>직전 사업연도에 회계감사를 받지 않은 회사</b>(처음 감사받는 회사)는 사업연도 개시일부터 4개월 이내에 선임해야 합니다(외감법 제10조제2항).</li>' +
        '<li>처음 감사를 받는 경우 기초잔액 검증, 회계정책 정비 등 준비할 사항이 많으므로 미리 상담받으시길 권합니다.</li>' +
        '<li><a href="audit-schedule.html">외부감사 일정 계산기</a>로 선임부터 감사보고서까지 기한을 날짜로 확인해 보세요.</li>' +
        '<li><a href="audit-prep.html">첫 외부감사 준비 체크리스트</a>로 미리 챙길 자료를 확인해 보세요.</li></ul>';
    }
    if (status === 'NOT_TARGET') {
      return '<ul class="basis">' +
        '<li>현재 기준으로는 법정 외부감사 의무가 없습니다. 다만 투자 유치, 금융기관 대출, 입찰 등을 위해 임의감사를 요구받는 경우가 있습니다.</li>' +
        '<li>판정은 매년 직전 사업연도 수치로 다시 합니다. 회사가 성장 중이라면 결산 직후 다시 확인해 보세요.</li></ul>';
    }
    return '<ul class="basis">' +
      '<li>면제 사유 해당 여부는 등기, 처분, 법적 지위 등 사실관계로 확인해야 합니다. 관련 서류를 갖고 상담받으시길 권합니다.</li></ul>';
  }
})();
