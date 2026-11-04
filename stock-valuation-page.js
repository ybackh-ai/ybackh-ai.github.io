/* 비상장주식 상증법 약식 평가 화면 로직 */
(function () {
  'use strict';
  var V = window.StockValuationRules;
  var form = document.getElementById('sv-form');
  var errorBox = document.getElementById('errors');
  var resultBox = document.getElementById('result');

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function won(n) { return Number(n).toLocaleString('ko-KR') + '원'; }
  function v(id) { return document.getElementById(id).value.trim(); }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var r = V.evaluate({
      shares: v('shares'), targetShares: v('targetShares'), netAssets: v('netAssets'), goodwill: v('goodwill'),
      netIncome: [v('ni0'), v('ni1'), v('ni2')], realEstatePct: v('realEstatePct'), stockPct: v('stockPct'),
      underThreeYears: form.underThreeYears.checked, liquidation: form.liquidation.checked, lossThreeYears: form.lossThreeYears.checked,
      largestShareholder: form.largestShareholder.checked, smeOrMidsize: form.smeOrMidsize.checked,
    });
    if (r.status === 'INVALID') {
      errorBox.innerHTML = '<ul class="error-list">' + r.errors.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>';
      resultBox.classList.add('hidden');
      return;
    }
    errorBox.innerHTML = '';
    render(r);
  });

  var METHOD = {
    weighted: '순손익가치와 순자산가치의 가중평균으로 평가했습니다.',
    floor80: '가중평균이 순자산가치의 80%보다 낮아 80% 금액으로 평가했습니다.',
    nav_only: '순자산가치로 평가했습니다.',
  };

  function row(label, value, strong) {
    return '<tr' + (strong ? ' class="row-total"' : '') + '><td>' + esc(label) + '</td><td class="num">' + esc(value) + '</td></tr>';
  }

  function render(r) {
    var html = '<div class="result-head"><p class="verdict">1주당 약 ' + esc(won(r.final)) + '</p><p>' + esc(METHOD[r.method]) +
      (r.total !== null ? ' 평가할 주식의 총액은 약 ' + esc(won(r.total)) + '입니다.' : '') + '</p></div><div class="result-body">';
    html += '<h3>계산 내역 (1주당)</h3><table><tbody>';
    html += row('순자산가치' + (r.goodwillAdded ? ' (영업권 포함)' : ''), won(r.nav));
    html += row('최근 3년 순손익액 가중평균', won(r.niPerShare));
    html += row('순손익가치 (÷ 10%)', won(r.eps));
    if (r.weighted !== null) html += row('가중평균 (' + r.ratio + ')', won(r.weighted));
    if (r.method === 'floor80') html += row('하한: 순자산가치 × 80%', won(r.value));
    html += row('평가액', won(r.value), true);
    if (r.premium) html += row('(+) 최대주주 할증 20%', won(r.premium));
    html += row('최종 1주당 평가액', won(r.final), true);
    if (r.total !== null) html += row('평가할 주식 총액', won(r.total), true);
    html += '</tbody></table>';
    html += '<h3>근거</h3><ul class="basis">' + r.basis.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul>';
    html += '<h3>참고</h3><ul class="basis">' + r.notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>';
    html += '<div class="notice"><b>이 금액은 회사의 가치나 거래가격이 아닙니다.</b> 입력하신 순자산가액과 순손익액에 상증법 보충적 평가 산식만 기계적으로 적용한 약식 추정치입니다. ' +
      '실제 평가액은 자산의 시가 평가, 순손익액 세무조정, 증자·감자, 시가(매매사례가액) 존재 여부, 최대주주 해당 여부 등에 따라 크게 달라질 수 있습니다. ' +
      '증여·상속 신고, 주식 양도, 가업승계에 사용하기 전에 반드시 전문가의 평가를 받으시기 바랍니다. (계산 기준일: ' + r.version + ')</div>';
    html += '<div class="btn-row" style="margin-top:16px"><a class="btn" href="contact.html?topic=fdd">비상장주식 평가 상담 신청</a>' +
      '<button type="button" class="btn secondary" data-print onclick="window.print()">결과 인쇄</button></div></div>';
    resultBox.className = 'result exempt';
    resultBox.innerHTML = html;
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
    var summary = '[비상장주식 상증법 약식 평가 결과] 1주당 약 ' + won(r.final) + ' (' + METHOD[r.method] + ')\n- 순자산가치 ' + won(r.nav) + ', 순손익가치 ' + won(r.eps) + (r.premium ? ', 최대주주 할증 포함' : '');
    try { sessionStorage.setItem('auditCheckSummary', summary); } catch (err) { /* 저장 불가 환경 무시 */ }
  }
})();
