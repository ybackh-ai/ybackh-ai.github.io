/* 상속·증여세 간이 계산 화면 로직 */
(function () {
  'use strict';
  var G = window.InheritGiftRules;
  var form = document.getElementById('ig-form');
  var errorBox = document.getElementById('errors');
  var resultBox = document.getElementById('result');

  Object.keys(G.RELATIONS).forEach(function (k) { form.relation.add(new Option(G.RELATIONS[k].label, k, k === 'asc_adult', k === 'asc_adult')); });

  function sync() {
    var gift = form.type.value === 'gift';
    document.querySelectorAll('.gift-only').forEach(function (el) { el.classList.toggle('hidden', !gift); });
    document.querySelectorAll('.inherit-only').forEach(function (el) { el.classList.toggle('hidden', gift); });
    var asc = form.relation.value === 'asc_adult' || form.relation.value === 'asc_minor';
    document.querySelector('.asc-only').classList.toggle('hidden', !asc);
    if (!asc) { form.marriageBirth.checked = false; form.generationSkip.checked = false; }
    document.querySelector('.mb-only').classList.toggle('hidden', !form.marriageBirth.checked);
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
    var r = G.calculate({
      type: form.type.value,
      amount: form.amount.value,
      relation: form.relation.value,
      priorDeduction: form.priorDeduction.value,
      marriageBirth: form.marriageBirth.checked,
      priorMarriageBirth: form.priorMarriageBirth.value,
      generationSkip: form.generationSkip.checked,
      taxBase: form.taxBase.value,
      fileOnTime: form.fileOnTime.checked,
    });
    if (r.status === 'INVALID') {
      errorBox.innerHTML = '<ul class="error-list">' + r.errors.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>';
      resultBox.classList.add('hidden');
      return;
    }
    errorBox.innerHTML = '';
    render(r);
  });

  function row(label, value, strong) {
    return '<tr' + (strong ? ' class="row-total"' : '') + '><td>' + esc(label) + '</td><td class="num">' + esc(value) + '</td></tr>';
  }

  function render(r) {
    var gift = r.type === 'gift';
    var name = gift ? '증여세' : '상속세';
    var html = '<div class="result-head"><p class="verdict">예상 ' + name + ' ' + esc(G.won(r.payable)) + '</p><p>' +
      (r.belowMinimum ? '과세표준이 50만원 미만이어서 세금을 부과하지 않습니다.' : esc('과세표준 ' + G.won(r.taxBase) + ', 세율 ' + r.bracket[2] + '% 구간')) + '</p></div>';
    html += '<div class="result-body"><h3>계산 내역</h3><table><tbody>';
    if (gift) {
      html += row('증여재산가액(과세가액)', G.won(r.amount));
      r.deductionItems.forEach(function (d) { html += row('(−) ' + d.label, G.won(d.value)); });
    }
    html += row('과세표준', G.won(r.taxBase), true);
    html += row('산출세액' + (r.bracket && r.bracket[1] ? ' (' + G.won(r.bracket[1]) + ' + ' + G.won(r.bracket[0]) + ' 초과분 × ' + r.bracket[2] + '%)' : r.bracket ? ' (과세표준 × 10%)' : ''), G.won(r.computed));
    if (r.surcharge) html += row('(+) 세대생략 할증 ' + r.surchargeRate + '%', G.won(r.surcharge));
    if (r.filingCredit) html += row('(−) 신고세액공제 3%', G.won(r.filingCredit));
    html += row('예상 납부세액', G.won(r.payable), true);
    html += '</tbody></table>';

    html += '<h3>근거</h3><ul class="basis">' + r.basis.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul>';

    var notes = r.notes.slice();
    notes.push('입력하신 재산가액을 그대로 사용했습니다. 재산 평가(시가·보충적 평가)에 따라 세액이 크게 달라질 수 있습니다.');
    notes.push('가산세, 징수유예, 다른 법률에 따른 감면, 연부연납·분납은 반영하지 않았습니다.');
    html += '<h3>참고</h3><ul class="basis">' + notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>';

    html += '<div class="notice">이 결과는 입력하신 금액에 「상속세 및 증여세법」의 세율과 일부 공제만 기계적으로 적용한 추정치입니다. ' +
      '실제 세액은 재산 평가, 사전증여 합산, 공제 요건 충족 여부 등에 따라 달라질 수 있으므로 신고 전에 반드시 전문가와 상담하시기 바랍니다. ' +
      '(계산 기준일: ' + r.version + ')</div>';

    html += '<div class="btn-row" style="margin-top:16px"><a class="btn" href="contact.html?topic=tax">이 결과로 상담 신청하기</a>' +
      '<button type="button" class="btn secondary" data-print onclick="window.print()">결과 인쇄</button></div></div>';

    resultBox.className = 'result exempt';
    resultBox.innerHTML = html;
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });

    var summary = '[상속·증여세 간이 계산 결과] 예상 ' + name + ' ' + G.won(r.payable) + '\n' +
      (gift ? '- 증여재산가액 ' + G.won(r.amount) + ', 공제 ' + G.won(r.deduction) + '\n' : '') +
      '- 과세표준 ' + G.won(r.taxBase) + ', 산출세액 ' + G.won(r.computed) + (r.surcharge ? ', 할증 ' + G.won(r.surcharge) : '');
    try { sessionStorage.setItem('auditCheckSummary', summary); } catch (err) { /* 저장 불가 환경 무시 */ }
  }
})();
