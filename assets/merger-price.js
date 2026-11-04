/* 상장사 합병가액(기준시가) 계산기 화면 로직 */
(function () {
  'use strict';
  var MP = window.MergerPriceRules;
  var form = document.getElementById('mp-form');
  var errorBox = document.getElementById('errors');
  var resultBox = document.getElementById('result');

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function won(n) { return Number(n).toLocaleString('ko-KR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + '원'; }
  function v(id) { return document.getElementById(id).value.trim(); }

  function sync() {
    var daily = form.mode.value === 'daily';
    document.querySelector('.only-daily').classList.toggle('hidden', !daily);
    document.querySelector('.only-direct').classList.toggle('hidden', daily);
  }
  form.addEventListener('change', sync);
  sync();

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var mode = form.mode.value, input = { mode: mode, spac: form.spac.checked, assetValue: v('assetValue') };
    var parseErr = [];
    if (mode === 'daily') {
      var p = MP.parseRows(document.getElementById('rows').value);
      if (p.bad.length) parseErr.push('읽을 수 없는 줄이 있어 제외했습니다: ' + p.bad.slice(0, 10).join(', ') + '번째 줄' + (p.bad.length > 10 ? ' 외' : ''));
      input.rows = p.rows; input.boardDate = v('boardDate'); input.contractDate = v('contractDate'); input.exDate = v('exDate');
    } else {
      input.avg1m = v('avg1m'); input.avg1w = v('avg1w'); input.last = v('last');
    }
    var r = MP.calculate(input);
    if (r.status === 'INVALID') {
      errorBox.innerHTML = '<ul class="error-list">' + r.errors.concat(parseErr).map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>';
      resultBox.classList.add('hidden');
      return;
    }
    errorBox.innerHTML = parseErr.length ? '<ul class="error-list">' + parseErr.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>' : '';
    render(r);
  });

  function row(label, value, strong) {
    return '<tr' + (strong ? ' class="row-total"' : '') + '><td>' + label + '</td><td class="num">' + esc(value) + '</td></tr>';
  }

  function render(r) {
    var html = '<div class="result-head"><p class="verdict">기준시가 ' + esc(won(r.base)) + '</p><p>' +
      esc('합병가액 범위 ' + won(r.low) + ' ~ ' + won(r.high) + ' (±' + r.rangePct + '%)') + '</p></div><div class="result-body">';
    html += '<h3>계산 내역</h3><table><tbody>';
    if (r.baseDate) html += row('기산일', r.baseDate);
    html += row('가. 최근 1개월 가중평균종가' + (r.period1m ? '<br><span class="hint" style="display:inline">' + esc(r.period1m.join(' ~ ') + ', 거래일 ' + r.days1m + '일') + '</span>' : ''), won(r.avg1m));
    html += row('나. 최근 1주일 가중평균종가' + (r.period1w ? '<br><span class="hint" style="display:inline">' + esc(r.period1w.join(' ~ ') + ', 거래일 ' + r.days1w + '일') + '</span>' : ''), won(r.avg1w));
    html += row('다. 최근일 종가' + (r.lastDate ? '<br><span class="hint" style="display:inline">' + esc(r.lastDate) + '</span>' : ''), won(r.last));
    html += row('기준시가 (가+나+다) ÷ 3', won(r.base), true);
    html += row('할인 한도 (−' + r.rangePct + '%)', won(r.low));
    html += row('할증 한도 (+' + r.rangePct + '%)', won(r.high));
    html += '</tbody></table>';
    var notes = r.notes.slice();
    if (r.mode === 'daily') notes.push('"최근 1개월", "최근 1주일"의 시작일은 시행령에 정해져 있지 않아 위 기간으로 계산했습니다. 금융위원회 고시 등 세부 기준과 다를 수 있으니 기간을 확인하세요.');
    notes.push('원 미만 처리 기준은 확인하지 않아 소수 둘째 자리까지 표시했습니다.');
    html += '<h3>참고</h3><ul class="basis">' + notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>';
    html += '<div class="notice">이 결과는 입력하신 시세에 현행 시행령 산식을 적용한 참고 자료입니다. 합병가액은 이사회 결의 전에 공시 규정과 외부평가 의무(시행령 제176조의5제8항)를 함께 검토해야 하며, 2026년 12월 9일 시행 개정 법률에 따라 기준이 달라질 수 있습니다. (계산 기준일: ' + r.version + ')</div>';
    html += '<div class="btn-row" style="margin-top:16px"><a class="btn" href="contact.html?topic=fdd">합병가액 상담 신청하기</a>' +
      '<a class="btn secondary" href="external-valuation.html">외부평가 대상인지 확인</a></div></div>';
    resultBox.className = 'result exempt';
    resultBox.innerHTML = html;
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
    var summary = '[합병가액 계산 결과] 기준시가 ' + won(r.base) + ', 범위 ' + won(r.low) + ' ~ ' + won(r.high) + (r.baseDate ? ' (기산일 ' + r.baseDate + ')' : '');
    try { sessionStorage.setItem('auditCheckSummary', summary); } catch (err) { /* 저장 불가 환경 무시 */ }
  }
})();
