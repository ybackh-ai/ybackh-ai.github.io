/* 스톡옵션 행사 세금 · 법인 vs 개인 · 재무비율 화면 로직 (페이지에 있는 폼만 동작) */
(function () {
  'use strict';
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function won(n) { return Math.round(n).toLocaleString('ko-KR') + '원'; }
  function v(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
  var errorBox = document.getElementById('errors');
  var resultBox = document.getElementById('result');
  function fail(r) { errorBox.innerHTML = '<ul class="error-list">' + r.errors.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>'; resultBox.classList.add('hidden'); }
  function show(cls, html, summary) {
    errorBox.innerHTML = '';
    resultBox.className = 'result ' + cls;
    resultBox.innerHTML = html;
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
    try { sessionStorage.setItem('auditCheckSummary', summary); } catch (err) { /* 저장 불가 환경 무시 */ }
  }
  function list(title, arr) { return arr.length ? '<h3>' + title + '</h3><ul class="basis">' + arr.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : ''; }
  function tail(topic, label, version) {
    return '<div class="notice">이 결과는 입력하신 금액에 세율·산식을 기계적으로 적용한 추정치입니다. 실제 세액과 판단은 공제·감면, 지방소득세, 개별 사실관계에 따라 달라지므로 결정 전에 전문가와 상담하시기 바랍니다. (작성 기준일: ' + version + ')</div>' +
      '<div class="btn-row" style="margin-top:16px"><a class="btn" href="contact.html?topic=' + topic + '">' + label + '</a></div>';
  }

  // 스톡옵션 행사 세금
  var sot = document.getElementById('sot-form');
  if (sot) {
    var sync = function () { document.querySelector('.venture-only').classList.toggle('hidden', !sot.venture.checked); };
    sot.addEventListener('change', sync); sync();
    sot.addEventListener('submit', function (e) {
      e.preventDefault();
      var r = window.TaxTools.stockOptionTax({ fairValue: v('fairValue'), strike: v('strike'), shares: v('shares'), existingBase: v('existingBase'), inService: sot.inService.value === 'yes', venture: sot.venture.checked, yearExempt: v('yearExempt'), priorExempt: v('priorExempt') });
      if (r.status === 'INVALID') return fail(r);
      var html = '<div class="result-head"><p class="verdict">늘어나는 소득세 약 ' + won(r.extraTax) + '</p><p>' + esc(r.incomeType + '로 과세 · 과세 대상 행사이익 ' + won(r.taxable) + (r.taxable ? ' · 추가 세액 비율 약 ' + r.marginalRate + '%' : '')) + '</p></div><div class="result-body">' +
        '<h3>계산 내역</h3><table><tbody>' +
        '<tr><td>행사이익 (시가 − 행사가격) × 주식 수</td><td class="num">' + won(r.gain) + '</td></tr>' +
        (r.exempt ? '<tr><td>(−) 벤처기업 비과세</td><td class="num">' + won(r.exempt) + '</td></tr>' : '') +
        '<tr class="row-total"><td>과세 대상 행사이익 (' + esc(r.incomeType) + ')</td><td class="num">' + won(r.taxable) + '</td></tr>' +
        '<tr><td>행사 전 소득세 (기존 과세표준 기준)</td><td class="num">' + won(r.taxBefore) + '</td></tr>' +
        '<tr><td>행사 후 소득세</td><td class="num">' + won(r.taxAfter) + '</td></tr>' +
        '<tr class="row-total"><td>늘어나는 소득세</td><td class="num">' + won(r.extraTax) + '</td></tr></tbody></table>' +
        list('근거', r.basis) + list('참고', r.notes.concat(['지방소득세는 별도로 붙습니다(이 계산에는 미반영).'])) + tail('tax', '스톡옵션 세금 상담 신청', r.version) + '</div>';
      show('exempt', html, '[스톡옵션 행사 세금] 행사이익 ' + won(r.gain) + ', 비과세 ' + won(r.exempt) + ', 추가 소득세 약 ' + won(r.extraTax));
    });
  }

  // 법인 vs 개인
  var cvp = document.getElementById('cvp-form');
  if (cvp) {
    cvp.addEventListener('submit', function (e) {
      e.preventDefault();
      var r = window.TaxTools.corpVsPersonal({ profit: v('profit'), personalDeduction: v('personalDeduction'), ceoSalary: v('ceoSalary'), smallRental: cvp.smallRental.checked });
      if (r.status === 'INVALID') return fail(r);
      var lower = r.diff > 0 ? '법인' : r.diff < 0 ? '개인' : '같음';
      var html = '<div class="result-head"><p class="verdict">' + (lower === '같음' ? '세율 구조상 세 부담이 같습니다' : '세율 구조상 ' + lower + '이 약 ' + won(Math.abs(r.diff)) + ' 적습니다') + '</p><p>배당소득세, 지방소득세, 4대보험은 빠진 비교입니다.</p></div><div class="result-body">' +
        '<table><thead><tr><th>항목</th><th class="num">개인사업자</th><th class="num">법인</th></tr></thead><tbody>' +
        '<tr><td>과세표준</td><td class="num">' + won(r.personalBase) + '</td><td class="num">' + won(r.corpBase) + '</td></tr>' +
        '<tr><td>종합소득세 / 법인세</td><td class="num">' + won(r.personalTax) + '</td><td class="num">' + won(r.corpTaxAmt) + '</td></tr>' +
        '<tr><td>대표자 급여 소득세</td><td class="num">-</td><td class="num">' + won(r.ceoTax) + '</td></tr>' +
        '<tr class="row-total"><td>합계</td><td class="num">' + won(r.personalTax) + '</td><td class="num">' + won(r.corpTotal) + '</td></tr></tbody></table>' +
        list('근거', r.basis) + list('참고', r.notes.concat(['개인사업자가 법인으로 전환할 때는 사업용 자산 이전에 따른 세금(양도소득세 이월과세 요건 등)을 별도로 검토해야 합니다.'])) + tail('tax', '법인 전환 상담 신청', r.version) + '</div>';
      show('exempt', html, '[법인 vs 개인 비교] 개인 ' + won(r.personalTax) + ' / 법인(대표 급여 포함) ' + won(r.corpTotal));
    });
  }

  // 자본잠식·채무초과
  var ci = document.getElementById('ci-form');
  if (ci) {
    ci.addEventListener('submit', function (e) {
      e.preventDefault();
      var r = window.RatioRules.capitalImpairment({ capital: v('capital'), equity: v('equity'), totalAssets: v('totalAssets'), totalLiabilities: v('totalLiabilities') });
      if (r.status === 'INVALID') return fail(r);
      function amt(x) { return x.toLocaleString('ko-KR', { maximumFractionDigits: 2 }); }
      var title = r.status === 'FULL' ? (r.insolvent ? '자본 전액잠식, 채무초과 상태입니다' : '자본 전액잠식 상태입니다') : r.status === 'PARTIAL' ? '자본 부분잠식 상태입니다 (잠식률 ' + r.impairmentRate + '%)' : '자본잠식이 아닙니다';
      var sub = r.status === 'NONE' ? '자본총계 ' + amt(r.equity) + '이(가) 자본금 ' + amt(r.capital) + '보다 큽니다.' : '자본금 ' + amt(r.capital) + ' 중 ' + amt(r.impairment) + '이(가) 잠식되었습니다.';
      var html = '<div class="result-head"><p class="verdict">' + esc(title) + '</p><p>' + esc(sub) + '</p></div><div class="result-body">' +
        '<table><tbody>' +
        '<tr><td>자본금</td><td class="num">' + amt(r.capital) + '</td></tr>' +
        '<tr><td>자본총계</td><td class="num">' + amt(r.equity) + '</td></tr>' +
        '<tr><td>잠식액 (자본금 − 자본총계)</td><td class="num">' + amt(r.impairment) + '</td></tr>' +
        '<tr class="row-total"><td>자본잠식률</td><td class="num">' + r.impairmentRate + '%</td></tr>' +
        '<tr><td>50% 이상 잠식</td><td class="num">' + (r.over50 ? '해당' : '미해당') + '</td></tr>' +
        '<tr><td>채무초과 (부채 &gt; 자산)</td><td class="num">' + (r.insolvent ? '해당 (' + amt(r.insolvencyAmount) + ')' : '미해당') + '</td></tr></tbody></table>' +
        list('계산 방법', r.basis) + list('참고', r.notes.concat([
          '자본잠식을 해소하는 방법은 증자(유상·출자전환), 무상감자(결손 보전), 이익 누적 등이 있으며 각각 세무·상법 절차가 다릅니다.',
          '투자계약(RCPS 등)에는 자본잠식·채무초과를 상환 청구나 위반 사유로 정한 경우가 많으니 계약서를 함께 확인하세요.',
        ])) +
        '<div class="notice">이 결과는 입력한 금액으로 산식을 기계적으로 적용한 참고 자료입니다. 상장규정의 관리종목·상장폐지 요건은 거래소 규정 원문으로 확인해야 하며, 이 사이트는 그 원문을 확인하지 못했습니다. (작성 기준일: ' + r.version + ')</div>' +
        '<div class="btn-row" style="margin-top:16px"><a class="btn" href="contact.html?topic=ifrs">자본구조 상담 신청</a><a class="btn secondary" href="fin-ratio.html">재무비율도 확인</a></div></div>';
      show(r.status === 'NONE' ? 'not-target' : 'target', html, '[자본잠식 진단] ' + title + ' / 자본금 ' + amt(r.capital) + ', 자본총계 ' + amt(r.equity));
    });
  }

  // 재무비율
  var fr = document.getElementById('fr-form');
  if (fr) {
    fr.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = {};
      window.RatioRules.FIELDS.forEach(function (k) { input[k] = v(k); });
      var r = window.RatioRules.analyze(input);
      if (r.status === 'INVALID') return fail(r);
      function cell(x, unit) { return x === null ? '-' : x.toLocaleString('ko-KR', { maximumFractionDigits: 2 }) + unit; }
      var rows = [['유동비율', r.currentRatio, '%', '유동자산 ÷ 유동부채'], ['부채비율', r.debtRatio, '%', '부채 ÷ 자본'], ['자기자본비율', r.equityRatio, '%', '자본 ÷ 자산'],
        ['이자보상배율', r.interestCoverage, '배', '영업이익 ÷ 이자비용'], ['영업이익률', r.operatingMargin, '%', '영업이익 ÷ 매출'], ['순이익률', r.netMargin, '%', '순이익 ÷ 매출'], ['ROE', r.roe, '%', '순이익 ÷ 자본'], ['ROA', r.roa, '%', '순이익 ÷ 자산']];
      var html = '<div class="result-head"><p class="verdict">재무비율 계산 결과</p><p>' + (r.capitalImpaired ? '자본잠식 상태입니다.' : r.coverageBelowOne ? '이자보상배율이 1 미만입니다.' : '입력한 기말 금액 기준입니다.') + '</p></div><div class="result-body">' +
        '<table><thead><tr><th>비율</th><th class="num">값</th></tr></thead><tbody>' + rows.map(function (x) { return '<tr><td>' + x[0] + '<br><span class="hint" style="display:inline">' + x[3] + '</span></td><td class="num">' + cell(x[1], x[2]) + '</td></tr>'; }).join('') + '</tbody></table>' +
        list('참고', r.notes) + tail('ifrs', '재무 진단 상담 신청', r.version) + '</div>';
      show(r.capitalImpaired || r.coverageBelowOne ? 'target' : 'exempt', html, '[재무비율] 유동비율 ' + cell(r.currentRatio, '%') + ', 부채비율 ' + cell(r.debtRatio, '%') + ', 이자보상배율 ' + cell(r.interestCoverage, '배'));
    });
  }
})();
