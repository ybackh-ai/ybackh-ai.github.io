/* 세법상 중소기업 판정기 화면 로직 */
(function () {
  'use strict';
  var R = window.SmeRules;
  var form = document.getElementById('tsme-form');
  var errorBox = document.getElementById('errors');
  var resultBox = document.getElementById('result');

  R.INDUSTRIES.forEach(function (x) {
    form.industry.add(new Option(x.name + ' (' + (x.code === 'E' ? 'E, E36 제외' : x.code === 'N' ? 'N, N76 제외' : x.code === 'S' ? 'S, S94 제외' : x.code) + ')', x.code));
  });
  form.industry.add(new Option('위 목록에 없는 업종 (협회·단체, 공공행정 등)', 'OTHER'));

  function sync() {
    var on = form.inGrace.checked;
    document.querySelector('.grace-only').classList.toggle('hidden', !on);
    if (!on) ['mergedNonSme', 'mergedGrace', 'startupExceed'].forEach(function (k) { form[k].checked = false; });
  }
  form.addEventListener('change', sync);
  sync();

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var input = { industry: form.industry.value, sales: form.sales.value, assets: form.assets.value };
    ['realEstateRental', 'consumptionService', 'passiveCompany', 'groupAffiliate', 'bigOwner', 'affiliated', 'inGrace', 'mergedNonSme', 'mergedGrace', 'startupExceed'].forEach(function (k) { input[k] = form[k].checked; });
    var r = R.evaluateTax(input);
    if (r.status === 'INVALID') {
      errorBox.innerHTML = '<ul class="error-list">' + r.errors.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>';
      resultBox.classList.add('hidden');
      return;
    }
    errorBox.innerHTML = '';
    render(r);
  });

  var V = {
    SME: { cls: 'not-target', title: '세법상 중소기업에 해당하는 것으로 판단됩니다' },
    SME_GRACE: { cls: 'not-target', title: '유예기간 중이어서 세법상 중소기업으로 보는 것으로 판단됩니다' },
    NOT_SME: { cls: 'target', title: '세법상 중소기업에 해당하지 않는 것으로 판단됩니다' },
    REVIEW: { cls: 'exempt', title: '추가 확인이 필요합니다' },
  };

  function render(r) {
    var v = V[r.status];
    var html = '<div class="result-head"><p class="verdict">' + v.title + '</p><p>' + esc(r.reasons[0] || (r.industry ? r.industry.name + ' 매출 기준 ' + R.fmt(r.industry.smeLimit) + '억원 이내, 자산 5천억원 미만입니다.' : '')) + '</p></div><div class="result-body">';
    if (r.industry) {
      html += '<h3>기준 비교 <span class="hint" style="display:inline">(' + esc(r.industry.name) + ')</span></h3><table><thead><tr><th>항목</th><th class="num">우리 회사</th><th class="num">기준</th></tr></thead><tbody>' +
        '<tr><td>해당 과세연도 매출액</td><td class="num">' + R.fmt(r.sales) + '억원</td><td class="num">' + R.fmt(r.industry.smeLimit) + '억원 이내</td></tr>' +
        '<tr><td>과세연도 말 자산총액</td><td class="num">' + R.fmt(r.assets) + '억원</td><td class="num">5,000억원 미만</td></tr></tbody></table>';
    }
    if (r.reasons.length > 1 || (r.status === 'SME_GRACE' && r.reasons.length)) html += '<h3>기준을 벗어난 사유</h3><ul class="basis">' + r.reasons.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>';
    if (r.basis.length) html += '<h3>판정 근거</h3><ul class="basis">' + r.basis.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul>';
    var notes = r.notes.slice();
    notes.push('개별 감면·공제 규정은 중소기업 요건 외에 업종, 소재지, 상시근로자 수 등 별도 요건을 둘 수 있습니다.');
    notes.push('관계기업 매출 합산, 소비성서비스업의 세부 업종(재정경제부령), 별표 개정에 따른 유예는 반영하지 않았습니다.');
    html += '<h3>참고</h3><ul class="basis">' + notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>';
    html += '<div class="notice">이 결과는 입력하신 정보로 조세특례제한법 시행령 제2조를 기계적으로 적용한 참고 자료입니다. 세액감면·공제 신청 전에는 주된 업종 분류와 관계기업 해당 여부를 포함해 전문가와 확인하시기 바랍니다. (판정 기준일: ' + r.version + ')</div>';
    html += '<div class="btn-row" style="margin-top:16px"><a class="btn" href="contact.html?topic=tax">이 결과로 상담 신청하기</a><a class="btn secondary" href="sme-check.html">중소기업기본법 기준으로도 확인</a></div></div>';
    resultBox.className = 'result ' + v.cls;
    resultBox.innerHTML = html;
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
    var summary = '[세법상 중소기업 판정 결과] ' + v.title + '\n- 업종: ' + (r.industry ? r.industry.name : '목록 외') + ', 매출 ' + R.fmt(r.sales) + '억원, 자산 ' + R.fmt(r.assets) + '억원' + (r.reasons.length ? '\n- ' + r.reasons.join('\n- ') : '');
    try { sessionStorage.setItem('auditCheckSummary', summary); } catch (err) { /* 저장 불가 환경 무시 */ }
  }
})();
