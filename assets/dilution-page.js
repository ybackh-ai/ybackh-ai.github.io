/* 투자 유치 지분 희석 계산기 화면 로직 */
(function () {
  'use strict';
  var D = window.DilutionRules;
  var form = document.getElementById('dl-form');
  var errorBox = document.getElementById('errors');
  var resultBox = document.getElementById('result');
  var holdersBox = document.getElementById('holders');
  var roundsBox = document.getElementById('rounds');

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function n(v) { return Number(v).toLocaleString('ko-KR', { maximumFractionDigits: 2 }); }

  var defaultsH = [['창업자 A', '7000000'], ['창업자 B', '3000000']];
  for (var i = 0; i < D.MAX_HOLDERS; i++) {
    var d = defaultsH[i] || ['', ''];
    holdersBox.insertAdjacentHTML('beforeend',
      '<div class="rowitem' + (i >= 3 ? ' extra hidden' : '') + '">' +
      '<div class="field"><label for="hn' + i + '">주주 ' + (i + 1) + ' 이름</label><input type="text" id="hn' + i + '" value="' + esc(d[0]) + '" placeholder="예: 창업자"></div>' +
      '<div class="field"><label for="hs' + i + '">보유 주식 수</label><div class="input-unit"><input type="number" id="hs' + i + '" inputmode="numeric" step="1" min="1" value="' + d[1] + '"><span>주</span></div></div>' +
      '</div>');
  }
  holdersBox.insertAdjacentHTML('beforeend', '<button type="button" class="btn secondary small" id="more-h">주주 더 입력</button>');

  var defaultsR = [['시드', '30', '10', ''], ['시리즈 A', '120', '30', '']];
  for (var j = 0; j < D.MAX_ROUNDS; j++) {
    var e = defaultsR[j] || ['', '', '', ''];
    roundsBox.insertAdjacentHTML('beforeend',
      '<div class="rowitem rowitem-4' + (j >= 2 ? ' extra hidden' : '') + '">' +
      '<div class="field"><label for="rn' + j + '">라운드 ' + (j + 1) + ' 이름</label><input type="text" id="rn' + j + '" value="' + esc(e[0]) + '" placeholder="예: 시리즈 B"></div>' +
      '<div class="field"><label for="rp' + j + '">투자 전 기업가치</label><div class="input-unit"><input type="number" id="rp' + j + '" inputmode="decimal" step="0.01" min="0" value="' + e[1] + '"><span>억원</span></div></div>' +
      '<div class="field"><label for="ri' + j + '">투자 금액</label><div class="input-unit"><input type="number" id="ri' + j + '" inputmode="decimal" step="0.01" min="0" value="' + e[2] + '"><span>억원</span></div></div>' +
      '<div class="field"><label for="ro' + j + '">스톡옵션 풀 <span class="hint" style="display:inline">(선택)</span></label><div class="input-unit"><input type="number" id="ro' + j + '" inputmode="decimal" step="0.1" min="0" value="' + e[3] + '"><span>%</span></div></div>' +
      '</div>');
  }
  roundsBox.insertAdjacentHTML('beforeend', '<button type="button" class="btn secondary small" id="more-r">라운드 더 입력</button>');

  function more(box, btnId) {
    document.getElementById(btnId).addEventListener('click', function () {
      var next = box.querySelector('.extra.hidden');
      if (next) next.classList.remove('hidden');
      if (!box.querySelector('.extra.hidden')) this.classList.add('hidden');
    });
  }
  more(holdersBox, 'more-h');
  more(roundsBox, 'more-r');

  function val(id) { return document.getElementById(id).value.trim(); }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var holders = [], rounds = [];
    for (var i = 0; i < D.MAX_HOLDERS; i++) {
      if (val('hn' + i) || val('hs' + i)) holders.push({ name: val('hn' + i) || ('주주 ' + (i + 1)), shares: val('hs' + i) });
    }
    for (var j = 0; j < D.MAX_ROUNDS; j++) {
      if (val('rp' + j) || val('ri' + j)) rounds.push({ name: val('rn' + j) || ('라운드 ' + (j + 1)), pre: val('rp' + j), invest: val('ri' + j), poolPct: val('ro' + j) });
    }
    var r = D.calculate({ holders: holders, rounds: rounds });
    if (r.status === 'INVALID') {
      errorBox.innerHTML = '<ul class="error-list">' + r.errors.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>';
      resultBox.classList.add('hidden');
      return;
    }
    errorBox.innerHTML = '';
    render(r);
  });

  function render(r) {
    var last = r.rounds[r.rounds.length - 1];
    var html = '<div class="result-head"><p class="verdict">기존 주주 지분 ' + n(r.existingFinalPct) + '%</p><p>' +
      esc(r.rounds.length + '개 라운드 후 · 투자 후 기업가치 ' + n(last.postMoney) + '억원 · 발행주식 ' + n(r.totalShares) + '주') + '</p></div>';
    html += '<div class="result-body">';

    html += '<h3>라운드별 요약</h3><div class="table-scroll"><table><thead><tr><th>라운드</th><th class="num">주당 가격</th><th class="num">신주</th><th class="num">풀 확보</th><th class="num">투자 후 가치</th></tr></thead><tbody>';
    r.rounds.forEach(function (x) {
      html += '<tr><td>' + esc(x.name) + '</td><td class="num">' + n(x.price) + '원</td><td class="num">' + n(x.newShares) + '주</td><td class="num">' + (x.poolShares ? n(x.poolShares) + '주' : '-') + '</td><td class="num">' + n(x.postMoney) + '억원</td></tr>';
    });
    html += '</tbody></table></div>';

    html += '<h3>주주별 지분율 변화</h3><div class="table-scroll"><table><thead><tr><th>주주</th><th class="num">현재</th>' +
      r.rounds.map(function (x) { return '<th class="num">' + esc(x.name) + ' 후</th>'; }).join('') + '</tr></thead><tbody>';
    r.holders.forEach(function (h) {
      html += '<tr><td>' + esc(h.name) + '<br><span class="hint" style="display:inline">' + n(h.shares) + '주</span></td><td class="num">' + (h.pctInitial === null ? '-' : n(h.pctInitial) + '%') + '</td>' +
        h.history.map(function (p) { return '<td class="num">' + (p === null ? '-' : n(p) + '%') + '</td>'; }).join('') + '</tr>';
    });
    html += '</tbody></table></div>';

    html += '<h3>참고</h3><ul class="basis">' + r.notes.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>';
    html += '<div class="notice">이 결과는 입력하신 기업가치와 투자 금액으로 지분율을 단순 계산한 참고 자료이며, 회사의 가치를 평가한 것이 아닙니다. ' +
      '실제 지분 구조는 투자계약서의 우선주 조건, 전환 조건, 스톡옵션 부여 방식에 따라 달라질 수 있으므로 계약 전에 전문가와 상담하시기 바랍니다. (작성 기준일: ' + r.version + ')</div>';
    html += '<div class="btn-row" style="margin-top:16px"><a class="btn" href="contact.html?topic=fdd">이 결과로 상담 신청하기</a>' +
      '<button type="button" class="btn secondary" data-print onclick="window.print()">결과 인쇄</button></div></div>';

    resultBox.className = 'result exempt';
    resultBox.innerHTML = html;
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });

    var summary = '[지분 희석 계산 결과] 기존 주주 지분 ' + n(r.existingFinalPct) + '% (' + r.rounds.length + '개 라운드 후)\n' +
      r.rounds.map(function (x) { return '- ' + x.name + ': pre ' + n(x.pre) + '억, 투자 ' + n(x.invest) + '억, 주당 ' + n(x.price) + '원'; }).join('\n');
    try { sessionStorage.setItem('auditCheckSummary', summary); } catch (err) { /* 저장 불가 환경 무시 */ }
  }
})();
