/* 손상검사 간이 진단 화면 */
(function () {
  'use strict';
  var R = window.ImpairmentRules;
  var form = document.getElementById('im-form');
  var errorBox = document.getElementById('errors');
  var resultBox = document.getElementById('result');
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function v(id) { return document.getElementById(id).value.trim(); }
  function n(x) { return x === null || x === undefined ? '-' : Number(x).toLocaleString('ko-KR', { maximumFractionDigits: 2 }); }
  function list(title, arr) { return arr.length ? '<h3>' + title + '</h3><ul class="basis">' + arr.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : ''; }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var r = R.evaluate({ carryingAmount: v('carryingAmount'), goodwill: v('goodwill'), fvlcd: v('fvlcd'), viu: v('viu'),
      cashflows: [v('cf1'), v('cf2'), v('cf3'), v('cf4'), v('cf5')], discountRate: v('discountRate'), terminalGrowth: v('terminalGrowth') });
    if (r.status === 'INVALID') {
      errorBox.innerHTML = '<ul class="error-list">' + r.errors.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>';
      resultBox.classList.add('hidden');
      return;
    }
    errorBox.innerHTML = '';
    var title = r.status === 'IMPAIRED' ? '손상차손 ' + n(r.loss) + ' 인식이 필요할 수 있습니다' : r.status === 'THIN' ? '손상은 없지만 여유가 적습니다 (' + r.headroomPct + '%)' : '손상차손이 없는 것으로 계산됩니다';
    var sub = '회수가능액 ' + n(r.recoverable) + ' (' + r.recoverableBasis + ') vs 장부금액 ' + n(r.carryingAmount) + (r.impaired ? '' : ' · 여유 ' + n(r.headroom) + (r.headroomPct !== null ? ' (' + r.headroomPct + '%)' : ''));
    var html = '<div class="result-head"><p class="verdict">' + esc(title) + '</p><p>' + esc(sub) + '</p></div><div class="result-body">' +
      '<table><tbody>' +
      '<tr><td>장부금액 합계</td><td class="num">' + n(r.carryingAmount) + '</td></tr>' +
      '<tr><td>　그중 영업권</td><td class="num">' + n(r.goodwill) + '</td></tr>' +
      '<tr><td>처분부대원가 차감 후 공정가치</td><td class="num">' + n(r.fvlcd) + '</td></tr>' +
      '<tr><td>사용가치' + (r.viuDetail ? ' (간이 계산)' : '') + '</td><td class="num">' + n(r.viu) + '</td></tr>' +
      '<tr class="row-total"><td>회수가능액 (둘 중 큰 금액)</td><td class="num">' + n(r.recoverable) + '</td></tr>' +
      '<tr class="row-total"><td>손상차손</td><td class="num">' + n(r.loss) + '</td></tr>' +
      (r.impaired ? '<tr><td>　영업권 감액</td><td class="num">' + n(r.lossToGoodwill) + '</td></tr><tr><td>　그 밖의 자산 배분 필요액</td><td class="num">' + n(r.lossToOthers) + '</td></tr>' : '') +
      '</tbody></table>';
    if (r.viuDetail) {
      html += '<h3>사용가치 계산 내역</h3><table><tbody><tr><td>명시 기간 현금흐름 현재가치</td><td class="num">' + n(r.viuDetail.pvExplicit) + '</td></tr><tr><td>종료가치 현재가치</td><td class="num">' + n(r.viuDetail.pvTerminal) + '</td></tr><tr class="row-total"><td>사용가치</td><td class="num">' + n(r.viuDetail.total) + '</td></tr></tbody></table>' +
        '<h3>할인율 민감도</h3><table><thead><tr><th>할인율</th><th class="num">사용가치</th><th class="num">장부금액 대비</th></tr></thead><tbody>' +
        [['−1%p', r.viuSensitivity.down], ['입력값', r.viu], ['+1%p', r.viuSensitivity.up]].map(function (x) { var d = x[1] - r.carryingAmount; return '<tr><td>' + x[0] + '</td><td class="num">' + n(x[1]) + '</td><td class="num">' + (d >= 0 ? '+' : '') + n(d) + '</td></tr>'; }).join('') + '</tbody></table>';
    }
    html += list('계산 방법·근거', r.basis) + list('참고', r.notes) +
      '<div class="notice">이 결과는 입력하신 금액과 가정에 일반 원칙을 기계적으로 적용한 참고 자료입니다. 현금창출단위 식별, 공정가치 측정, 할인율 산정, 개별 자산 배분은 회사 상황에 따라 달라지므로 재무제표에 반영하기 전에 평가 전문가와 상담하시기 바랍니다. (작성 기준일: ' + r.version + ')</div>' +
      '<div class="btn-row" style="margin-top:16px"><a class="btn" href="contact.html?topic=fdd">손상평가 상담 신청</a><a class="btn secondary" href="dcf.html">할인율(WACC) 추정</a></div></div>';
    resultBox.className = 'result ' + (r.status === 'IMPAIRED' ? 'target' : r.status === 'THIN' ? 'exempt' : 'not-target');
    resultBox.innerHTML = html;
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
    try { sessionStorage.setItem('auditCheckSummary', '[손상검사 간이 진단] ' + title + '\n- ' + sub); } catch (err) { /* 저장 불가 환경 무시 */ }
  });
})();
