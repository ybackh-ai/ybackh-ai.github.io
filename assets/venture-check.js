/* 벤처기업 확인 요건 진단 화면 로직 */
(function () {
  'use strict';
  var VR = window.VentureRules;
  var form = document.getElementById('vc-form');
  var errorBox = document.getElementById('errors');
  var resultBox = document.getElementById('result');

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function v(id) { return document.getElementById(id).value.trim(); }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var r = VR.diagnose({
      sme: v('sme'), excludedIndustry: form.excludedIndustry.checked,
      investAmount: v('investAmount'), capital: v('capital'), cultureProducer: form.cultureProducer.checked,
      hasLab: form.hasLab.checked, rndAmount: v('rndAmount'), rndSales: v('rndSales'), underThreeYears: form.underThreeYears.checked,
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
    LIKELY: { cls: 'not-target', title: '벤처기업 확인 요건을 갖춘 것으로 보입니다', lead: '숫자 요건을 충족하는 유형이 있습니다. 벤처기업확인기관의 평가를 거쳐 확인받을 수 있습니다.' },
    POSSIBLE: { cls: 'exempt', title: '혁신성장유형 평가로 확인받을 수 있습니다', lead: '투자·연구개발 유형의 숫자 요건은 충족하지 않지만, 혁신성장유형은 숫자 기준 없이 평가로 확인합니다.' },
    NOT_ELIGIBLE: { cls: 'target', title: '벤처기업 확인 대상이 아닌 것으로 판단됩니다', lead: '' },
    CHECK_SME: { cls: 'exempt', title: '중소기업 여부를 먼저 확인해 주세요', lead: '벤처기업은 중소기업기본법상 중소기업이어야 합니다.' },
  };

  function render(r) {
    var x = V[r.status];
    var lead = r.status === 'NOT_ELIGIBLE' ? '중소기업이 아니거나 벤처기업에 포함되지 않는 업종입니다.' : x.lead;
    var html = '<div class="result-head"><p class="verdict">' + x.title + '</p><p>' + esc(lead) + '</p></div><div class="result-body">';
    html += '<h3>유형별 진단</h3><table><thead><tr><th>유형</th><th>결과</th></tr></thead><tbody>';
    r.details.forEach(function (d) {
      var mark = d.ok === null ? '<span class="mark-near">평가 필요</span>' : d.ok ? '<span class="mark-yes" style="color:var(--ok)">숫자 요건 충족</span>' : '<span class="mark-no">미충족</span>';
      html += '<tr><td><b>' + esc(d.type) + '</b><br><span class="hint" style="display:inline">' + esc(d.text) + '</span></td><td>' + mark + '</td></tr>';
    });
    html += '</tbody></table>';
    if (r.basis.length) html += '<h3>근거</h3><ul class="basis">' + r.basis.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul>';
    html += '<h3>참고</h3><ul class="basis">' + r.notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '<li>벤처기업은 스톡옵션 행사이익 비과세 특례 등 세제 혜택과 연결됩니다. 스톡옵션을 부여했다면 <a href="stock-option.html">스톡옵션 공정가치 계산기</a>로 비용 영향도 확인해 보세요.</li></ul>';
    html += '<div class="notice">이 진단은 입력하신 숫자로 법령의 정량 요건만 확인한 참고 자료입니다. 실제 벤처기업 확인은 벤처기업확인기관의 평가와 서류 심사를 거치며, 업종별 연구개발비 고시 비율과 평가 기준은 반영하지 않았습니다. (작성 기준일: ' + r.version + ')</div>';
    html += '<div class="btn-row" style="margin-top:16px"><a class="btn" href="contact.html?topic=etc">벤처기업 확인 상담 신청</a>' + (r.status === 'CHECK_SME' ? '<a class="btn secondary" href="sme-check.html">중소기업 판정기로 이동</a>' : '') + '</div></div>';
    resultBox.className = 'result ' + x.cls;
    resultBox.innerHTML = html;
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
    var summary = '[벤처기업 확인 요건 진단] ' + x.title + '\n' + r.details.map(function (d) { return '- ' + d.type + ': ' + (d.ok === null ? '평가 필요' : d.ok ? '충족' : '미충족'); }).join('\n');
    try { sessionStorage.setItem('auditCheckSummary', summary); } catch (err) { /* 저장 불가 환경 무시 */ }
  }
})();
