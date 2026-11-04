/* DCF·WACC 간이 계산기 화면 로직 */
(function () {
  'use strict';
  var DC = window.DcfRules;
  var wForm = document.getElementById('w-form');
  var dForm = document.getElementById('d-form');
  var resultBox = document.getElementById('result');

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function v(id) { return document.getElementById(id).value.trim(); }
  function n(x, d) { return Number(x).toLocaleString('ko-KR', { maximumFractionDigits: d === undefined ? 0 : d }); }
  function errs(box, list) { document.getElementById(box).innerHTML = list.length ? '<ul class="error-list">' + list.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>' : ''; }

  wForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var lev = document.getElementById('betaType').value === 'levered';
    var r = DC.wacc({ rf: v('rf'), mrp: v('mrp'), sizePremium: v('sizePremium'), kd: v('kd'), taxRate: v('wTax'), debtWeight: v('debtWeight'), beta: lev ? v('beta') : '', betaUnlevered: lev ? '' : v('beta') });
    var box = document.getElementById('w-result');
    if (r.status === 'INVALID') { errs('w-errors', r.errors); box.classList.add('hidden'); return; }
    errs('w-errors', []);
    box.innerHTML = '<b>WACC ' + r.wacc.toFixed(2) + '%</b> = 자기자본 ' + r.equityWeight.toFixed(1) + '% × 자기자본비용 ' + r.ke.toFixed(2) + '% + 부채 ' + r.debtWeight.toFixed(1) + '% × 세후 차입이자율 ' + r.kdAfterTax.toFixed(2) + '%' +
      '<br>적용 베타 ' + r.beta.toFixed(3) + (r.relevered ? ' (언레버드 베타를 D/E ' + r.de.toFixed(1) + '%로 리레버)' : '') + '. 아래 2단계 할인율 칸에 넣었습니다.';
    box.classList.remove('hidden');
    document.getElementById('dWacc').value = r.wacc.toFixed(2);
    if (!v('dTax')) document.getElementById('dTax').value = v('wTax');
  });

  dForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var r = DC.dcf({ revenue0: v('revenue0'), years: Number(v('years')), growth: v('growth'), margin: v('margin'), taxRate: v('dTax'), daPct: v('daPct'), capexPct: v('capexPct'), nwcPct: v('nwcPct'),
      wacc: v('dWacc'), terminalGrowth: v('terminalGrowth'), netDebt: v('netDebt'), nonOperating: v('nonOperating'), shares: v('shares') });
    if (r.status === 'INVALID') { errs('d-errors', r.errors); resultBox.classList.add('hidden'); return; }
    errs('d-errors', []);
    render(r);
  });

  function render(r) {
    var per = r.shares ? ' (1주당 ' + n(r.rangeLow * 1e6 / r.shares) + '원 ~ ' + n(r.rangeHigh * 1e6 / r.shares) + '원)' : '';
    var html = '<div class="result-head"><p class="verdict">주주가치 약 ' + n(r.rangeLow) + ' ~ ' + n(r.rangeHigh) + '백만원</p><p>' +
      esc('할인율 ' + (r.wacc - 1).toFixed(1) + '~' + (r.wacc + 1).toFixed(1) + '%, 영구성장률 ' + (r.terminalGrowth - 0.5).toFixed(1) + '~' + (r.terminalGrowth + 0.5).toFixed(1) + '% 범위' + per) + '</p></div><div class="result-body">';

    html += '<h3>추정 현금흐름 (백만원)</h3><div class="table-scroll"><table><thead><tr><th>항목</th>' + r.rows.map(function (x) { return '<th class="num">' + x.year + '년</th>'; }).join('') + '</tr></thead><tbody>';
    [['매출액', 'revenue'], ['영업이익', 'ebit'], ['세후 영업이익', 'nopat'], ['(+) 감가상각비', 'da'], ['(−) 설비투자', 'capex'], ['(−) 운전자본 증가', 'dnwc'], ['FCFF', 'fcff'], ['할인계수', 'discount'], ['현재가치', 'pv']].forEach(function (row) {
      html += '<tr' + (row[1] === 'fcff' || row[1] === 'pv' ? ' class="row-total"' : '') + '><td>' + row[0] + '</td>' + r.rows.map(function (x) { return '<td class="num">' + (row[1] === 'discount' ? x[row[1]].toFixed(4) : n(x[row[1]])) + '</td>'; }).join('') + '</tr>';
    });
    html += '</tbody></table></div>';

    html += '<h3>기준 가정의 가치 (할인율 ' + r.wacc + '%, 영구성장률 ' + r.terminalGrowth + '%)</h3><table><tbody>' +
      '<tr><td>추정기간 현금흐름 현재가치 합계</td><td class="num">' + n(r.sumPV) + '</td></tr>' +
      '<tr><td>영구가치의 현재가치' + (r.tvShare !== null ? ' <span class="hint" style="display:inline">(기업가치의 ' + r.tvShare.toFixed(0) + '%)</span>' : '') + '</td><td class="num">' + n(r.pvTV) + '</td></tr>' +
      '<tr class="row-total"><td>기업가치(EV)</td><td class="num">' + n(r.ev) + '</td></tr>' +
      '<tr><td>(−) 순차입금</td><td class="num">' + n(r.netDebt) + '</td></tr>' +
      (r.nonOperating ? '<tr><td>(+) 비영업자산</td><td class="num">' + n(r.nonOperating) + '</td></tr>' : '') +
      '<tr class="row-total"><td>주주가치</td><td class="num">' + n(r.equity) + '</td></tr>' +
      (r.perShare !== undefined ? '<tr><td>1주당 가치</td><td class="num">' + n(r.perShare * 1e6) + '원</td></tr>' : '') +
      '</tbody></table>';

    var ws = [], gs = [];
    r.grid.forEach(function (c) { if (ws.indexOf(c.wacc) < 0) ws.push(c.wacc); if (gs.indexOf(c.g) < 0) gs.push(c.g); });
    html += '<h3>민감도: 주주가치 (백만원)</h3><div class="table-scroll"><table><thead><tr><th>할인율 / 영구성장률</th>' + gs.map(function (g) { return '<th class="num">' + g + '%</th>'; }).join('') + '</tr></thead><tbody>';
    ws.forEach(function (w) {
      html += '<tr><td>' + w + '%</td>' + gs.map(function (g) {
        var c = r.grid.filter(function (x) { return x.wacc === w && x.g === g; })[0];
        var base = w === r.wacc && g === r.terminalGrowth;
        return '<td class="num"' + (base ? ' style="font-weight:700"' : '') + '>' + (c ? n(c.equity) : '-') + '</td>';
      }).join('') + '</tr>';
    });
    html += '</tbody></table></div>';

    html += '<h3>참고</h3><ul class="basis">' + r.notes.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    html += '<div class="notice"><b>이 결과는 회사의 가치평가가 아닙니다.</b> 입력하신 가정을 교과서 산식에 넣어 계산한 숫자이며, 성장률·이익률·할인율을 조금만 바꿔도 결과가 크게 달라집니다. ' +
      '투자 유치, 지분 거래, 세무 신고, 재무보고에 사용할 가치는 사업계획 검토, 유사기업 분석, 목적에 맞는 평가 방법을 거쳐 전문가가 산정해야 합니다. 세무 목적(상증법)이나 자본시장법 합병에는 법정 평가 방법이 따로 있습니다. (작성 기준일: ' + r.version + ')</div>';
    html += '<div class="btn-row" style="margin-top:16px"><a class="btn" href="contact.html?topic=fdd">가치평가 상담 신청</a><a class="btn secondary" href="valuation-needs.html">어떤 평가가 필요한지 확인</a></div></div>';
    resultBox.className = 'result exempt';
    resultBox.innerHTML = html;
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
    var summary = '[DCF 간이 계산 결과] 주주가치 약 ' + n(r.rangeLow) + ' ~ ' + n(r.rangeHigh) + '백만원 (할인율 ' + r.wacc + '%, 영구성장률 ' + r.terminalGrowth + '% 기준 ±)';
    try { sessionStorage.setItem('auditCheckSummary', summary); } catch (err) { /* 저장 불가 환경 무시 */ }
  }
})();
