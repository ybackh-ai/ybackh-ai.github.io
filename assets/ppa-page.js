/* PPA 영업권 간이 계산기 화면 */
(function () {
  'use strict';
  var P = window.PpaRules;
  var form = document.getElementById('ppa-form');
  var errorBox = document.getElementById('errors');
  var resultBox = document.getElementById('result');
  var adjList = document.getElementById('adj-list');
  var intList = document.getElementById('int-list');

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(n) { return Number(n).toLocaleString('ko-KR', { maximumFractionDigits: 1 }); }

  // 무형자산 분류표
  var typeTable = document.getElementById('type-table');
  var typeOptions = '';
  Object.keys(P.INTANGIBLE_TYPES).forEach(function (k) {
    var t = P.INTANGIBLE_TYPES[k];
    typeTable.insertAdjacentHTML('beforeend', '<tr><td>' + t.label + '</td><td>' + t.examples + '</td></tr>');
    typeOptions += '<option value="' + k + '">' + t.label + '</option>';
  });

  var seq = 0;
  function addAdj(label) {
    var id = 'a' + (++seq);
    var row = document.createElement('div');
    row.className = 'row';
    row.innerHTML =
      '<div><label for="' + id + 'l">항목</label><input id="' + id + 'l" type="text" class="adj-label" placeholder="예: 토지" value="' + (label || '') + '"></div>' +
      '<div><label for="' + id + 'v">조정액(백만원)</label><input id="' + id + 'v" type="number" inputmode="decimal" class="adj-amount" placeholder="예: 1500"></div>' +
      '<button type="button" class="row-del" aria-label="삭제">삭제</button>';
    adjList.appendChild(row);
  }
  function addInt(type, label) {
    var id = 'i' + (++seq);
    var row = document.createElement('div');
    row.className = 'row';
    row.innerHTML =
      '<div><label for="' + id + 't">분류</label><select id="' + id + 't" class="int-type">' + typeOptions + '</select></div>' +
      '<div><label for="' + id + 'l">이름</label><input id="' + id + 'l" type="text" class="int-label" placeholder="예: 고객관계" value="' + (label || '') + '"></div>' +
      '<div><label for="' + id + 'v">금액(백만원)</label><input id="' + id + 'v" type="number" inputmode="decimal" class="int-amount" placeholder="예: 2000"></div>' +
      '<div><label for="' + id + 'y">내용연수(년)</label><input id="' + id + 'y" type="number" inputmode="decimal" class="int-life" placeholder="예: 7"></div>' +
      '<button type="button" class="row-del" aria-label="삭제">삭제</button>';
    intList.appendChild(row);
    if (type) row.querySelector('.int-type').value = type;
  }
  document.getElementById('add-adj').addEventListener('click', function () { addAdj(); });
  document.getElementById('add-int').addEventListener('click', function () { addInt(); });
  form.addEventListener('click', function (e) {
    if (e.target.classList.contains('row-del')) e.target.closest('.row').remove();
  });
  addAdj('토지');
  addInt('customer', '고객관계');
  addInt('technology', '기술');

  function sync() {
    var own = Number(form.ownershipPct.value);
    var partial = form.ownershipPct.value !== '' && own > 0 && own < 100;
    document.querySelector('.nci-only').classList.toggle('hidden', !partial);
    document.querySelector('.nci-fv').classList.toggle('hidden', !(partial && form.nciMethod.value === 'fair_value'));
    document.querySelector('.tax-field').classList.toggle('hidden', !form.applyDeferredTax.checked);
  }
  form.addEventListener('input', sync);
  form.addEventListener('change', sync);
  sync();

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var input = {
      consideration: form.consideration.value,
      contingentConsideration: form.contingentConsideration.value,
      previousInterestFV: form.previousInterestFV.value,
      ownershipPct: form.ownershipPct.value,
      nciMethod: form.nciMethod.value,
      nciFairValue: form.nciFairValue.value,
      bookNetAssets: form.bookNetAssets.value,
      contingentLiabilities: form.contingentLiabilities.value,
      applyDeferredTax: form.applyDeferredTax.checked,
      taxRate: form.taxRate.value,
      adjustments: Array.prototype.map.call(adjList.querySelectorAll('.row'), function (r) {
        return { label: r.querySelector('.adj-label').value.trim(), amount: r.querySelector('.adj-amount').value };
      }),
      intangibles: Array.prototype.map.call(intList.querySelectorAll('.row'), function (r) {
        return {
          type: r.querySelector('.int-type').value,
          label: r.querySelector('.int-label').value.trim(),
          amount: r.querySelector('.int-amount').value,
          life: r.querySelector('.int-life').value,
        };
      }),
    };
    var r = P.evaluate(input);
    if (r.status === 'INVALID') {
      errorBox.innerHTML = '<ul class="error-list">' + r.errors.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>';
      errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      resultBox.classList.add('hidden');
      return;
    }
    errorBox.innerHTML = '';
    render(r);
  });

  function amt(n) {
    return '<td class="num' + (n < 0 ? ' neg' : '') + '">' + (n < 0 ? '(' + fmt(-n) + ')' : fmt(n)) + '</td>';
  }

  function render(r) {
    var head;
    if (r.status === 'GOODWILL') head = { cls: 'target', t: '영업권 약 ' + fmt(r.goodwill) + '백만원이 예상됩니다', s: '이전대가의 ' + r.goodwillRatio + '%가 영업권으로 배분됩니다.' };
    else if (r.status === 'BARGAIN') head = { cls: 'exempt', t: '염가매수차익 약 ' + fmt(r.bargainGain) + '백만원이 예상됩니다', s: '인수 대가가 식별가능 순자산 공정가치보다 작습니다. 측정을 재검토해야 합니다.' };
    else head = { cls: 'not-target', t: '영업권이 생기지 않습니다', s: '인수 대가와 식별가능 순자산 공정가치가 같습니다.' };

    var h = '<div class="result-head"><p class="verdict">' + head.t + '</p><p>' + head.s + '</p></div><div class="result-body">';

    h += '<h3>① 식별가능 순자산 공정가치 <span class="hint" style="display:inline">(백만원)</span></h3><table><tbody>';
    r.rows.forEach(function (x) {
      h += '<tr class="' + (x.total ? 'total' : x.indent ? 'indent' : '') + '"><td>' + esc(x.label) + '</td>' + amt(x.amount) + '</tr>';
    });
    h += '</tbody></table>';

    h += '<h3>② 영업권 산정 <span class="hint" style="display:inline">(백만원)</span></h3><table><tbody>';
    h += '<tr class="indent"><td>이전대가 (조건부대가 포함)</td>' + amt(r.totalConsideration) + '</tr>';
    if (r.nci) h += '<tr class="indent"><td>비지배지분 (' + fmt(r.nciPct) + '%)</td>' + amt(r.nci) + '</tr>';
    var prev = r.lhs - r.totalConsideration - r.nci;
    if (prev) h += '<tr class="indent"><td>이전 보유지분 공정가치</td>' + amt(prev) + '</tr>';
    h += '<tr class="total"><td>합계 (B)</td>' + amt(r.lhs) + '</tr>';
    h += '<tr><td>식별가능 순자산 공정가치 (A)</td>' + amt(-r.fvNetAssets) + '</tr>';
    h += '<tr class="total"><td>' + (r.status === 'BARGAIN' ? '염가매수차익 (A − B)' : '영업권 (B − A)') + '</td>' + amt(r.status === 'BARGAIN' ? r.bargainGain : r.goodwill) + '</tr>';
    h += '</tbody></table>';

    if (r.amortization) {
      var a = r.amortization;
      h += '<h3>③ 인수 후 연간 손익 영향 (무형자산 상각, 정액법)</h3><table><tbody>' +
        '<tr><td>연간 무형자산 상각비</td>' + amt(-a.annual) + '</tr>' +
        (a.taxEffect ? '<tr><td>이연법인세 환입 효과</td>' + amt(a.taxEffect) + '</tr>' : '') +
        '<tr class="total"><td>세후 연간 순이익 감소</td>' + amt(-a.afterTax) + '</tr></tbody></table>';
    }

    if (r.notes.length) h += '<h3>참고</h3><ul class="basis">' + r.notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>';

    h += '<div class="notice">이 결과는 입력하신 금액을 K-IFRS 1103의 영업권 산식에 대입한 간이 계산입니다. 실제 PPA에서는 무형자산 식별과 공정가치 평가(초과이익법·로열티공제법 등), 이연법인세, 측정기간 조정에 따라 금액이 크게 달라질 수 있습니다. 재무제표 반영이나 감사 대응에는 전문 평가가 필요합니다. (계산 기준일: ' + r.version + ')</div>';
    h += '<div class="btn-row" style="margin-top:16px"><a class="btn" href="contact.html?topic=ppa">PPA 평가 상담 신청하기</a>' +
      '<button type="button" class="btn secondary" data-print onclick="window.print()">결과 인쇄</button></div></div>';

    resultBox.className = 'result ' + head.cls;
    resultBox.innerHTML = h;
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });

    var summary = '[PPA 영업권 간이 계산 결과] ' + head.t +
      '\n- 이전대가 합계 ' + fmt(r.totalConsideration) + '백만원, 식별가능 순자산 공정가치 ' + fmt(r.fvNetAssets) + '백만원' +
      '\n- 식별 무형자산 ' + fmt(r.intangiblesTotal) + '백만원' + (r.nci ? ', 비지배지분 ' + fmt(r.nci) + '백만원' : '');
    try { sessionStorage.setItem('auditCheckSummary', summary); } catch (err) { /* ignore */ }
  }
})();
