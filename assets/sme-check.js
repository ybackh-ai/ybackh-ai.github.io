/* 중소기업 해당 여부 판정기 화면 로직 */
(function () {
  'use strict';
  var R = window.SmeRules;
  var form = document.getElementById('sme-form');
  var errorBox = document.getElementById('errors');
  var resultBox = document.getElementById('result');

  // 업종 선택지: 별표 1 순서 + 목록에 없는 업종
  R.INDUSTRIES.forEach(function (x) {
    form.industry.add(new Option(x.name + ' (' + (x.code === 'E' ? 'E, E36 제외' : x.code === 'N' ? 'N, N76 제외' : x.code === 'S' ? 'S, S94 제외' : x.code) + ')', x.code));
  });
  form.industry.add(new Option('위 목록에 없는 업종 (협회·단체, 공공행정 등)', 'OTHER'));

  var salesFields = document.querySelectorAll('.sales-field');
  function syncYears() {
    var n = Number(form.years.value);
    salesFields.forEach(function (el) { el.classList.toggle('hidden', Number(el.getAttribute('data-i')) >= n); });
  }
  form.years.addEventListener('change', syncYears);
  syncYears();

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var n = Number(form.years.value);
    var sales = [];
    for (var i = 0; i < n; i++) sales.push(document.getElementById('s' + i).value);
    var input = {
      industry: form.industry.value,
      sales: sales,
      startup: n === 0,
      assets: form.assets.value,
      groupAffiliate: form.groupAffiliate.checked,
      bigOwner: form.bigOwner.checked,
      affiliated: form.affiliated.checked,
      formerSme: form.formerSme.checked,
    };
    // 보이는 매출액 칸 중 빈칸이 있으면 먼저 알림
    if (n > 0 && sales.some(function (v) { return v === ''; })) {
      errorBox.innerHTML = '<ul class="error-list"><li>매출액 칸을 모두 입력해 주세요.</li></ul>';
      resultBox.classList.add('hidden');
      return;
    }
    var r = R.evaluate(input);
    if (r.status === 'INVALID') {
      errorBox.innerHTML = '<ul class="error-list">' + r.errors.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>';
      resultBox.classList.add('hidden');
      return;
    }
    errorBox.innerHTML = '';
    render(r);
  });

  var VERDICT = {
    SME: { cls: 'not-target' },
    NOT_SME: { cls: 'target', title: '중소기업에 해당하지 않는 것으로 판단됩니다' },
    REVIEW: { cls: 'exempt', title: '추가 확인이 필요합니다' },
  };

  function render(r) {
    var v = VERDICT[r.status];
    var title = r.status === 'SME'
      ? '중소기업(' + (r.size === 'small' ? '소기업' : '중기업') + ')에 해당하는 것으로 판단됩니다'
      : v.title;
    var lead = r.status === 'SME'
      ? (r.size === 'small' ? '평균매출액등이 소기업 기준 이하입니다.' : '중소기업 기준은 충족하지만 소기업 기준을 넘어 중기업으로 구분됩니다.')
      : r.reasons[0];

    var html = '<div class="result-head"><p class="verdict">' + esc(title) + '</p><p>' + esc(lead) + '</p></div><div class="result-body">';

    if (r.industry) {
      html += '<h3>기준별 비교 <span class="hint" style="display:inline">(' + esc(r.industry.name) + ')</span></h3>';
      html += '<table><thead><tr><th>기준</th><th class="num">우리 회사</th><th class="num">기준</th></tr></thead><tbody>';
      if (r.avgSales !== null) {
        html += '<tr><td>평균매출액등 (' + r.salesYears + '개 사업연도 평균) — 중소기업</td><td class="num">' + R.fmt(r.avgSales) + '억원</td><td class="num">' + R.fmt(r.industry.smeLimit) + '억원 이하</td></tr>';
        html += '<tr><td>평균매출액등 — 소기업</td><td class="num">' + R.fmt(r.avgSales) + '억원</td><td class="num">' + R.fmt(r.industry.smallLimit) + '억원 이하</td></tr>';
      }
      html += '<tr><td>자산총액 (직전 사업연도 말)</td><td class="num">' + R.fmt(r.assets) + '억원</td><td class="num">' + R.fmt(R.ASSET_LIMIT_EOK) + '억원 미만</td></tr>';
      html += '</tbody></table>';
    }

    if (r.reasons.length > (r.status === 'SME' ? 0 : 1)) {
      html += '<h3>' + (r.status === 'REVIEW' ? '확인이 필요한 이유' : '해당하지 않는 사유') + '</h3><ul class="basis">' +
        r.reasons.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>';
    }

    html += '<h3>판정 근거</h3><ul class="basis">' + r.basis.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul>';

    var notes = r.notes.slice();
    notes.push('세액감면 등 세법상 중소기업(조세특례제한법 시행령 제2조)은 기준이 달라 결과가 다를 수 있습니다.');
    notes.push('자동차용 신품 의자, 철도·항공기용 의자 제조업 등 시행령 별표의 세부 업종 예외는 반영하지 않았습니다.');
    html += '<h3>참고</h3><ul class="basis">' + notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>';

    html += '<div class="notice">이 결과는 입력하신 수치만으로 중소기업기본법 시행령 기준을 기계적으로 적용한 참고 자료입니다. ' +
      '주된 업종 분류, 관계기업 합산, 독립성 판단은 개별 사실관계에 따라 달라질 수 있습니다. 정책자금·인증 신청에는 중소벤처기업부의 중소기업 확인서가 필요할 수 있으므로 최종 판단은 공인회계사와 상담하시기 바랍니다. ' +
      '(판정 기준일: ' + r.version + ')</div>';

    html += '<div class="btn-row" style="margin-top:16px"><a class="btn" href="contact.html?topic=tax">이 결과로 상담 신청하기</a><a class="btn secondary" href="tax-sme.html">세법 기준도 확인하기</a>' +
      '<button type="button" class="btn secondary" data-print onclick="window.print()">결과 인쇄</button></div></div>';

    resultBox.className = 'result ' + v.cls;
    resultBox.innerHTML = html;
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });

    var summary = '[중소기업 판정기 결과] ' + title + '\n- 업종: ' + (r.industry ? r.industry.name : '목록 외') +
      (r.avgSales !== null ? '\n- 평균매출액등 ' + R.fmt(r.avgSales) + '억원' : '') + '\n- 자산총액 ' + R.fmt(r.assets) + '억원' +
      (r.reasons.length ? '\n- ' + r.reasons.join('\n- ') : '');
    try { sessionStorage.setItem('auditCheckSummary', summary); } catch (err) { /* 저장 불가 환경 무시 */ }
  }
})();
