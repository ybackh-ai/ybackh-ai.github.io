/* 가지급금 인정이자 계산기 화면 로직 */
(function () {
  'use strict';
  var L = window.LoanInterestRules;
  var form = document.getElementById('li-form');
  var errorBox = document.getElementById('errors');
  var resultBox = document.getElementById('result');
  var box = document.getElementById('loans');
  var MAX = 5;

  var y = new Date().getFullYear();
  form.fyStart.value = y + '-01-01';
  form.fyEnd.value = y + '-12-31';

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function won(n) { return Number(n).toLocaleString('ko-KR') + '원'; }

  for (var i = 0; i < MAX; i++) {
    box.insertAdjacentHTML('beforeend',
      '<div class="rowitem' + (i >= 2 ? ' extra hidden' : '') + '">' +
      '<div class="field"><label for="la' + i + '">대여금 ' + (i + 1) + ' 금액</label><div class="input-unit"><input type="number" id="la' + i + '" inputmode="numeric" step="1" min="1"' + (i === 0 ? ' value="10000"' : '') + '><span>만원</span></div></div>' +
      '<div class="field"><label for="ld' + i + '">대여일</label><input type="date" id="ld' + i + '"' + (i === 0 ? ' value="' + y + '-01-01"' : '') + '></div>' +
      '<div class="field"><label for="lr' + i + '">상환일 <span class="hint" style="display:inline">(선택)</span></label><input type="date" id="lr' + i + '"></div>' +
      '</div>');
  }
  box.insertAdjacentHTML('beforeend', '<button type="button" class="btn secondary small" id="more-l">대여금 더 입력</button>');
  document.getElementById('more-l').addEventListener('click', function () {
    var next = box.querySelector('.extra.hidden');
    if (next) next.classList.remove('hidden');
    if (!box.querySelector('.extra.hidden')) this.classList.add('hidden');
  });

  function sync() { document.querySelector('.weighted-only').classList.toggle('hidden', form.rateType.value !== 'weighted'); }
  form.addEventListener('change', sync);
  sync();

  function val(id) { return document.getElementById(id).value.trim(); }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var loans = [];
    for (var i = 0; i < MAX; i++) {
      if (val('la' + i) || val('ld' + i)) loans.push({ amount: val('la' + i), lendDate: val('ld' + i), repayDate: val('lr' + i) });
    }
    var r = L.calculate({ fyStart: form.fyStart.value, fyEnd: form.fyEnd.value, rateType: form.rateType.value, weightedRate: form.weightedRate.value, received: form.received.value, loans: loans,
      borrowerType: val('borrowerType'), interestPaid: val('interestPaid'), avgBorrowings: val('avgBorrowings'), avgDeposit: val('avgDeposit'), nonBusinessAssets: val('nonBusinessAssets') });
    if (r.status === 'INVALID') {
      errorBox.innerHTML = '<ul class="error-list">' + r.errors.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>';
      resultBox.classList.add('hidden');
      return;
    }
    errorBox.innerHTML = '';
    render(r);
  });

  function render(r) {
    var title = r.applies ? '익금산입 대상으로 판단됩니다: ' + won(r.inclusion) : (r.interest === 0 ? '사업연도 중 가지급금 잔액이 없습니다' : '부당행위계산 부인 대상이 아닌 것으로 판단됩니다');
    var lead = r.applies
      ? '인정이자 ' + won(r.interest) + '에서 받은 이자 ' + won(r.received) + '를 뺀 차액이 기준(3억원 이상 또는 인정이자의 5% 이상)에 해당합니다.'
      : (r.interest === 0 ? '입력한 대여금이 사업연도 안에 남아 있던 날이 없습니다.' : '차액 ' + won(r.diff) + '이 3억원 미만이고 인정이자의 5%(' + won(r.thresholdPct) + ') 미만입니다.');
    var html = '<div class="result-head"><p class="verdict">' + esc(title) + '</p><p>' + esc(lead) + '</p></div><div class="result-body">';

    html += '<h3>대여금별 인정이자 <span class="hint" style="display:inline">(사업연도 ' + r.yearDays + '일 기준)</span></h3><div class="table-scroll"><table><thead><tr><th>대여금</th><th class="num">일수</th><th class="num">이자율</th><th class="num">인정이자</th></tr></thead><tbody>';
    r.loans.forEach(function (l) {
      html += '<tr><td>' + won(l.amount) + '<br><span class="hint" style="display:inline">' + esc(l.lendDate + ' ~ ' + (l.repayDate || '미상환')) + (l.over5y ? ' · 5년 초과' : '') + '</span></td><td class="num">' + l.days + '일</td><td class="num">' + l.rate + '%</td><td class="num">' + won(l.interest) + '</td></tr>';
    });
    html += '<tr class="row-total"><td>인정이자 합계</td><td></td><td></td><td class="num">' + won(r.interest) + '</td></tr>';
    html += '<tr><td>(−) 받은 이자</td><td></td><td></td><td class="num">' + won(r.received) + '</td></tr>';
    html += '<tr class="row-total"><td>차액</td><td></td><td></td><td class="num">' + won(r.diff) + '</td></tr>';
    html += '<tr class="row-total"><td>익금산입액' + (r.dispositionInterest && r.inclusion ? ' <span class="hint" style="display:inline">(소득처분: ' + r.dispositionInterest + ')</span>' : '') + '</td><td></td><td></td><td class="num">' + won(r.inclusion) + '</td></tr>';
    html += '</tbody></table></div>';

    if (r.disallowed !== null) {
      html += '<h3>업무무관 가지급금 지급이자 손금불산입</h3><table><tbody>' +
        '<tr><td>사업연도 지급이자</td><td class="num">' + won(r.interestPaid) + '</td></tr>' +
        '<tr><td>(가지급금 − 가수금 + 업무무관자산) 적수 ÷ 총차입금 적수 <span class="hint" style="display:inline">(총차입금 한도)</span></td><td class="num">' + r.disallowRatio + '%</td></tr>' +
        '<tr class="row-total"><td>손금불산입액 <span class="hint" style="display:inline">(소득처분: ' + r.dispositionDisallowed + ')</span></td><td class="num">' + won(r.disallowed) + '</td></tr>' +
        '</tbody></table>';
    }

    html += '<h3>판정 근거</h3><ul class="basis"><li>「법인세법」 제52조, 같은 법 시행령 제88조제1항제6호 — 금전을 시가보다 낮은 이율로 대부</li>' +
      '<li>시행령 제88조제3항 — 차액이 3억원 이상이거나 시가의 5% 이상인 경우에만 적용</li>' +
      '<li>시행령 제89조제3항, 시행규칙 제43조 — 가중평균차입이자율 / 당좌대출이자율 연 4.6%</li>' +
      '<li>시행령 제89조제5항 — 시가와의 차액을 익금산입</li></ul>';

    var notes = r.notes.slice();
    notes.push('일수는 대여일을 넣고 상환일을 빼는 방식으로 셌습니다. 이 방식과 연 이자율을 일할하는 방식은 법령 조문으로 확인하지 않은 실무 관행입니다.');
    notes.push('인정이자 계산에서는 가지급금과 가수금을 상계하지 않았습니다(상계 가능 여부는 별도 검토). 지급이자 손금불산입 계산에서는 시행령 제53조제3항에 따라 상계했습니다.');
    if (r.dispositionInterest) notes.push('인정이자 익금산입액은 귀속자에 따라 상여(임원·직원), 배당(주주), 기타사외유출(법인·사업자), 기타소득으로 처분합니다(시행령 제106조제1항제1호). 상여·배당으로 처분되면 귀속자에게 소득세가 생길 수 있습니다.');
    html += '<h3>참고</h3><ul class="basis">' + notes.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>';

    html += '<div class="notice">이 결과는 입력하신 대여 내역과 이자율로 법인세법 기준을 기계적으로 적용한 참고 자료입니다. ' +
      '특수관계 여부, 업무 관련성, 적용 이자율 선택, 소득처분은 사실관계에 따라 달라지므로 세무조정 전에 전문가와 상담하시기 바랍니다. (계산 기준일: ' + r.version + ')</div>';
    html += '<div class="btn-row" style="margin-top:16px"><a class="btn" href="contact.html?topic=tax">이 결과로 상담 신청하기</a>' +
      '<button type="button" class="btn secondary" data-print onclick="window.print()">결과 인쇄</button></div></div>';

    resultBox.className = 'result ' + (r.applies ? 'target' : 'not-target');
    resultBox.innerHTML = html;
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });

    var summary = '[가지급금 인정이자 계산 결과] ' + title + '\n- 인정이자 ' + won(r.interest) + ', 받은 이자 ' + won(r.received) + ', 차액 ' + won(r.diff);
    try { sessionStorage.setItem('auditCheckSummary', summary); } catch (err) { /* 저장 불가 환경 무시 */ }
  }
})();
