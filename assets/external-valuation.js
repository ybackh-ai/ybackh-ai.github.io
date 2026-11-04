/* 자본시장법 외부평가 대상 판정 화면 로직 */
(function () {
  'use strict';
  var X = window.ExternalValuationRules;
  var form = document.getElementById('ev-form');
  var errorBox = document.getElementById('errors');
  var resultBox = document.getElementById('result');

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function show(sel, on) { document.querySelectorAll(sel).forEach(function (el) { el.classList.toggle('hidden', !on); }); }

  function sync() {
    var t = form.dealType.value;
    show('.only-merger', t === 'merger');
    show('.only-counterparty', t === 'merger' || t === 'business_transfer' || t === 'split_merger' || t === 'share_exchange' || t === 'share_transfer');
    show('.only-bt', t === 'business_transfer');
    show('.only-exchange', t === 'share_exchange' || t === 'share_transfer');
    show('.only-se', t === 'share_exchange');
    show('.only-st', t === 'share_transfer');
  }
  form.addEventListener('change', sync);
  sync();

  function v(id) { return document.getElementById(id).value.trim(); }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var r = X.evaluate({
      dealType: form.dealType.value,
      weListed: form.weListed.checked, weKonex: form.weKonex.checked, weSpac: form.weSpac.checked,
      counterpartyType: form.counterpartyType.value, affiliate: form.affiliate.checked,
      weUsesAssetEarnings: form.weUsesAssetEarnings.checked, counterpartyUsesAssetEarnings: form.counterpartyUsesAssetEarnings.checked,
      becomesUnlisted: form.becomesUnlisted.checked, backdoor: form.backdoor.checked, whollyOwnedNoNewShares: form.whollyOwnedNoNewShares.checked,
      ratios: { assets: v('rAssets'), sales: v('rSales'), liabilities: v('rLiab') }, important: form.important.checked, assetViaMarket: form.assetViaMarket.checked,
      exchangeAffiliateException: form.exchangeAffiliateException.checked, transferAffiliateException: form.transferAffiliateException.checked,
    });
    if (r.status === 'INVALID') {
      errorBox.innerHTML = '<ul class="error-list">' + r.errors.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>';
      resultBox.classList.add('hidden');
      return;
    }
    errorBox.innerHTML = '';
    render(r);
  });

  var V = {
    REQUIRED: { cls: 'target', title: '외부평가기관의 평가를 받아야 하는 것으로 판단됩니다' },
    NOT_REQUIRED: { cls: 'not-target', title: '현행 시행령상 외부평가 의무가 없는 것으로 판단됩니다' },
    NOT_APPLICABLE: { cls: 'exempt', title: '자본시장법 합병 등 특례 적용 대상이 아닌 것으로 판단됩니다' },
  };

  function render(r) {
    var x = V[r.status];
    var html = '<div class="result-head"><p class="verdict">' + x.title + '</p><p>' + esc(r.reason) + '</p></div><div class="result-body">';
    html += '<h3>판정 근거</h3><ul class="basis">' + r.basis.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul>';
    html += '<h3>참고</h3><ul class="basis">' + r.notes.map(function (n, i) { return '<li>' + (i === 0 ? '<b>' + esc(n) + '</b>' : esc(n)) + '</li>'; }).join('') + '</ul>';
    html += '<div class="notice">이 결과는 입력하신 거래 조건에 현행 자본시장법 시행령 기준을 기계적으로 적용한 참고 자료입니다. 계열회사 해당 여부, 합병가액 산정 방식, 금융위원회 고시, 거래 시점의 개정 법령에 따라 결과가 달라질 수 있으므로 이사회 결의 전에 반드시 전문가와 확인하시기 바랍니다. (판정 기준일: ' + r.version + ')</div>';
    html += '<div class="btn-row" style="margin-top:16px"><a class="btn" href="contact.html?topic=fdd">외부평가 상담 신청하기</a>' +
      '<button type="button" class="btn secondary" data-print onclick="window.print()">결과 인쇄</button></div></div>';
    resultBox.className = 'result ' + x.cls;
    resultBox.innerHTML = html;
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
    var summary = '[외부평가 대상 판정 결과] ' + (r.dealLabel || '') + ' — ' + x.title + '\n- ' + r.reason;
    try { sessionStorage.setItem('auditCheckSummary', summary); } catch (err) { /* 저장 불가 환경 무시 */ }
  }
})();
