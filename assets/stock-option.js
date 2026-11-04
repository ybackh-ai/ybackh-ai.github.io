/* 스톡옵션 공정가치 계산기 화면 로직 */
(function () {
  'use strict';
  var SO = window.StockOptionRules;
  var form = document.getElementById('so-form');
  var errorBox = document.getElementById('errors');
  var resultBox = document.getElementById('result');

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function won(n, d) { return Number(n).toLocaleString('ko-KR', { maximumFractionDigits: d === undefined ? 0 : d }) + '원'; }
  function v(id) { return document.getElementById(id).value.trim(); }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var r = SO.calculate({ spot: v('spot'), strike: v('strike'), term: v('term'), vol: v('vol'), rate: v('rate'), dividend: v('dividend'), quantity: v('quantity'), vestYears: v('vestYears'), forfeiture: v('forfeiture') });
    if (r.status === 'INVALID') {
      errorBox.innerHTML = '<ul class="error-list">' + r.errors.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>';
      resultBox.classList.add('hidden');
      return;
    }
    errorBox.innerHTML = '';
    render(r);
  });

  function render(r) {
    var html = '<div class="result-head"><p class="verdict">옵션 1개당 약 ' + esc(won(r.value, 0)) + '</p><p>' +
      esc('내재가치 ' + won(r.intrinsic) + ' + 시간가치 ' + won(r.timeValue)) + (r.total !== undefined ? esc(' · 총 보상원가 약 ' + won(r.total)) : '') + '</p></div><div class="result-body">';
    html += '<h3>계산 내역</h3><table><tbody>' +
      '<tr><td>d1 / d2</td><td class="num">' + r.d1.toFixed(4) + ' / ' + r.d2.toFixed(4) + '</td></tr>' +
      '<tr><td>N(d1) / N(d2)</td><td class="num">' + r.nd1.toFixed(4) + ' / ' + r.nd2.toFixed(4) + '</td></tr>' +
      '<tr class="row-total"><td>옵션 1개당 공정가치</td><td class="num">' + esc(won(r.value, 2)) + '</td></tr>';
    if (r.total !== undefined) {
      html += '<tr><td>가득 예상 수량 (퇴사율 반영)</td><td class="num">' + Math.round(r.expectedVesting).toLocaleString('ko-KR') + '개</td></tr>' +
        '<tr class="row-total"><td>총 보상원가</td><td class="num">' + esc(won(r.total)) + '</td></tr>';
    }
    html += '</tbody></table>';

    if (r.schedule.length) {
      html += '<h3>연도별 보상비용 (정액)</h3><table><thead><tr><th>가득 연차</th><th class="num">비용</th><th class="num">누적</th></tr></thead><tbody>' +
        r.schedule.map(function (s) { return '<tr><td>' + s.year + '년차</td><td class="num">' + esc(won(s.expense)) + '</td><td class="num">' + esc(won(s.cumulative)) + '</td></tr>'; }).join('') + '</tbody></table>';
    }

    var vols = [], terms = [];
    r.sensitivity.forEach(function (c) { if (vols.indexOf(c.vol) < 0) vols.push(c.vol); if (terms.indexOf(c.term) < 0) terms.push(c.term); });
    html += '<h3>민감도 (옵션 1개당)</h3><div class="table-scroll"><table><thead><tr><th>변동성 / 기간</th>' + terms.map(function (t) { return '<th class="num">' + t + '년</th>'; }).join('') + '</tr></thead><tbody>';
    vols.forEach(function (vo) {
      html += '<tr><td>' + vo + '%</td>' + terms.map(function (t) {
        var c = r.sensitivity.filter(function (x) { return x.vol === vo && x.term === t; })[0];
        var base = vo === r.input.vol && t === r.input.T;
        return '<td class="num"' + (base ? ' style="font-weight:700"' : '') + '>' + (c ? esc(won(c.value)) : '-') + '</td>';
      }).join('') + '</tr>';
    });
    html += '</tbody></table></div>';

    html += '<h3>참고</h3><ul class="basis">' + r.notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>';
    html += '<div class="notice">이 결과는 입력하신 가정으로 블랙-숄즈 공식을 계산한 참고 자료입니다. 주가·변동성·기대존속기간 가정에 따라 금액이 크게 달라지며, 재무제표에 반영할 공정가치는 계약 조건 검토와 가정의 근거 자료가 필요합니다. 외부감사 대상 회사는 감사인과 미리 협의하시기 바랍니다. (작성 기준일: ' + r.version + ')</div>';
    html += '<div class="btn-row" style="margin-top:16px"><a class="btn" href="contact.html?topic=ifrs">스톡옵션 평가 상담 신청</a>' +
      '<button type="button" class="btn secondary" data-print onclick="window.print()">결과 인쇄</button></div></div>';
    resultBox.className = 'result exempt';
    resultBox.innerHTML = html;
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
    var summary = '[스톡옵션 공정가치 계산 결과] 옵션 1개당 약 ' + won(r.value) + (r.total !== undefined ? ', 총 보상원가 약 ' + won(r.total) : '') +
      '\n- 주가 ' + won(r.input.S) + ', 행사가 ' + won(r.input.K) + ', 기간 ' + r.input.T + '년, 변동성 ' + r.input.vol + '%, 이자율 ' + r.input.rate + '%';
    try { sessionStorage.setItem('auditCheckSummary', summary); } catch (err) { /* 저장 불가 환경 무시 */ }
  }
})();
