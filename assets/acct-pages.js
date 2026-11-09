/* 결산·회계처리 도구 화면: 리스, 감가상각, 대손충당금, 퇴직급여, 감사위원회, 세무 일정 (페이지에 있는 폼만 동작) */
(function () {
  'use strict';
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function n(x, d) { return x === null || x === undefined ? '-' : Number(x).toLocaleString('ko-KR', { maximumFractionDigits: d === undefined ? 2 : d }); }
  function v(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
  function list(title, arr) { return arr && arr.length ? '<h3>' + title + '</h3><ul class="basis">' + arr.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : ''; }
  var errorBox = document.getElementById('errors');
  var resultBox = document.getElementById('result');
  function fail(r) { errorBox.innerHTML = '<ul class="error-list">' + r.errors.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>'; resultBox.classList.add('hidden'); }
  function show(cls, title, sub, body, r, topic, label, summary, disclaimer) {
    errorBox.innerHTML = '';
    resultBox.className = 'result ' + cls;
    resultBox.innerHTML = '<div class="result-head"><p class="verdict">' + esc(title) + '</p><p>' + esc(sub) + '</p></div><div class="result-body">' + body +
      list('계산 방법·근거', r.basis) + list('참고', r.notes) +
      '<div class="notice">' + esc(disclaimer) + ' (기준 확인일: ' + r.version + ')</div>' +
      '<div class="btn-row" style="margin-top:16px"><a class="btn" href="contact.html?topic=' + topic + '">' + esc(label) + '</a></div></div>';
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
    try { sessionStorage.setItem('auditCheckSummary', summary); } catch (e) { /* 저장 불가 환경 무시 */ }
  }
  var CALC_DISCLAIMER = '이 결과는 입력하신 값에 산식을 기계적으로 적용한 참고 자료입니다. 실제 회계처리와 세무조정은 계약서·급여대장 등 사실관계를 확인해 정해야 하므로, 재무제표에 반영하기 전에 공인회계사와 상담하시기 바랍니다.';

  // ── 리스 ──
  var ls = document.getElementById('ls-form');
  if (ls) ls.addEventListener('submit', function (e) {
    e.preventDefault();
    var r = window.LeaseRules.calculate({ payment: v('payment'), periods: v('periods'), rate: v('rate'), frequency: ls.frequency.value, timing: ls.timing.value, initialCosts: v('initialCosts'), prepaid: v('prepaid') });
    if (r.status === 'INVALID') return fail(r);
    var perYear = ls.frequency.value === 'monthly' ? 12 : 1;
    // 연도별 요약
    var years = [], cur = null;
    r.schedule.forEach(function (row, i) {
      var y = Math.floor(i / perYear) + 1;
      if (!cur || cur.year !== y) { cur = { year: y, payment: 0, interest: 0, principal: 0, closing: 0 }; years.push(cur); }
      cur.payment += row.payment; cur.interest += row.interest; cur.principal += row.principal; cur.closing = row.closing;
    });
    var dep = r.rouAsset / (r.schedule.length / perYear);
    var body = '<table><tbody>' +
      '<tr class="row-total"><td>리스부채 (최초 인식)</td><td class="num">' + n(r.liability, 0) + '</td></tr>' +
      '<tr class="row-total"><td>사용권자산 (최초 인식)</td><td class="num">' + n(r.rouAsset, 0) + '</td></tr>' +
      '<tr><td>리스료 총액</td><td class="num">' + n(r.totalPayments, 0) + '</td></tr>' +
      '<tr><td>총 이자비용</td><td class="num">' + n(r.totalInterest, 0) + '</td></tr>' +
      '<tr><td>첫 1년: 이자비용 + 사용권자산 상각비</td><td class="num">' + n(r.firstYearExpense, 0) + '</td></tr>' +
      '<tr><td>첫 1년: 기존 방식 임차료</td><td class="num">' + n(r.firstYearRent, 0) + '</td></tr>' +
      '<tr><td>첫 1년 비용 차이</td><td class="num">' + (r.firstYearDiff >= 0 ? '+' : '') + n(r.firstYearDiff, 0) + '</td></tr></tbody></table>' +
      '<h3>연도별 리스부채</h3><div class="table-scroll"><table><thead><tr><th>연차</th><th class="num">리스료</th><th class="num">이자비용</th><th class="num">상각비</th><th class="num">연말 리스부채</th></tr></thead><tbody>' +
      years.map(function (y) { var months = y === years[years.length - 1] ? (r.schedule.length - (years.length - 1) * perYear) : perYear; return '<tr><td>' + y.year + '년차</td><td class="num">' + n(y.payment, 0) + '</td><td class="num">' + n(y.interest, 0) + '</td><td class="num">' + n(dep * months / perYear, 0) + '</td><td class="num">' + n(y.closing, 0) + '</td></tr>'; }).join('') +
      '</tbody></table></div>' +
      '<h3>개시일 회계처리 예시</h3><p>(차) 사용권자산 ' + n(r.rouAsset, 0) + ' / (대) 리스부채 ' + n(r.liability, 0) + (r.rouAsset - r.liability > 0.5 ? ' + 현금 등 ' + n(r.rouAsset - r.liability, 0) : '') + '</p>';
    show(r.shortTerm ? 'exempt' : 'target', '리스부채 약 ' + n(r.liability, 0) + '원을 인식합니다', '사용권자산 ' + n(r.rouAsset, 0) + '원 · 첫 1년 비용 ' + n(r.firstYearExpense, 0) + '원 (임차료 대비 ' + (r.firstYearDiff >= 0 ? '+' : '') + n(r.firstYearDiff, 0) + '원)' + (r.shortTerm ? ' · 단기리스 면제 가능' : ''),
      body, r, 'ifrs', '리스 회계처리 상담 신청', '[리스 회계 계산] 리스부채 ' + n(r.liability, 0) + '원, 사용권자산 ' + n(r.rouAsset, 0) + '원', CALC_DISCLAIMER);
  });

  // ── 감가상각 ──
  var dp = document.getElementById('dp-form');
  if (dp) {
    var R = window.DepreciationRules, catSel = document.getElementById('category'), lifeEl = document.getElementById('life'), hint = document.getElementById('life-hint');
    Object.keys(R.CATEGORIES).forEach(function (k) { var c = R.CATEGORIES[k]; catSel.insertAdjacentHTML('beforeend', '<option value="' + k + '">' + esc(c.label + (c.base ? ' — 기준 ' + c.base + '년' : '')) + '</option>'); });
    var fm = document.getElementById('firstMonths'); for (var m = 12; m >= 1; m--) fm.insertAdjacentHTML('beforeend', '<option value="' + m + '">' + m + '개월' + (m === 12 ? ' (사업연도 전체)' : '') + '</option>');
    var syncCat = function () { var c = R.CATEGORIES[catSel.value]; if (c.base) { lifeEl.value = c.base; hint.textContent = '범위 ' + c.min + '~' + c.max + '년. 신고하지 않으면 기준 ' + c.base + '년.'; } else { hint.textContent = '별표6 업종별 기준내용연수를 확인해 넣으세요(2~60년).'; } if (c.building) dp.querySelector('input[name=method][value=sl]').checked = true; };
    catSel.addEventListener('change', syncCat); syncCat();
    dp.addEventListener('submit', function (e) {
      e.preventDefault();
      var r = R.calculate({ cost: v('cost'), category: catSel.value, life: v('life'), method: dp.method.value, firstMonths: v('firstMonths'), bookDep: v('bookDep') });
      if (r.status === 'INVALID') return fail(r);
      var body = '<div class="table-scroll"><table><thead><tr><th>연차</th><th class="num">사용 월수</th><th class="num">상각범위액</th><th class="num">기말 미상각잔액</th></tr></thead><tbody>' +
        r.schedule.map(function (x) { return '<tr><td>' + x.year + '년차</td><td class="num">' + x.months + '</td><td class="num">' + n(x.dep, 0) + '</td><td class="num">' + n(x.nbv, 0) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
        (r.bookDep !== undefined ? '<h3>첫해 장부와 비교</h3><table><tbody><tr><td>장부 감가상각비</td><td class="num">' + n(r.bookDep, 0) + '</td></tr><tr><td>세법 상각범위액</td><td class="num">' + n(r.firstYearLimit, 0) + '</td></tr><tr class="row-total"><td>' + (r.excess > 0 ? '상각부인액(손금불산입)' : '시인부족액') + '</td><td class="num">' + n(r.excess > 0 ? r.excess : r.shortfall, 0) + '</td></tr></tbody></table>' : '');
      var title = '첫해 상각범위액 ' + n(r.firstYearLimit, 0) + '원';
      show(r.excess > 0 ? 'target' : 'not-target', title, (dp.method.value === 'sl' ? '정액법' : '정률법') + ' · 내용연수 ' + v('life') + '년 · 상각률 ' + r.rate.toFixed(3) + ' · ' + r.schedule.length + '년에 걸쳐 상각', body, r, 'tax', '감가상각·세무조정 상담 신청', '[감가상각 계산] ' + title, CALC_DISCLAIMER);
    });
  }

  // ── 대손충당금 ──
  var al = document.getElementById('al-form');
  if (al) {
    var labels = ['3개월 이하', '3개월 초과 ~ 6개월', '6개월 초과 ~ 1년', '1년 초과 ~ 2년', '2년 초과'], ex = [1, 5, 20, 50, 100];
    var tb = document.getElementById('al-rows');
    labels.forEach(function (l, i) { tb.insertAdjacentHTML('beforeend', '<tr><td>' + l + '</td><td><input type="number" inputmode="decimal" min="0" class="al-bal" aria-label="' + l + ' 잔액"></td><td><input type="number" inputmode="decimal" min="0" max="100" step="0.1" class="al-rate" placeholder="예: ' + ex[i] + '" aria-label="' + l + ' 설정률"></td></tr>'); });
    al.addEventListener('submit', function (e) {
      e.preventDefault();
      var bals = al.querySelectorAll('.al-bal'), rates = al.querySelectorAll('.al-rate');
      var buckets = labels.map(function (l, i) { return { label: l, balance: bals[i].value.trim(), rate: rates[i].value.trim() }; }).filter(function (b) { return b.balance !== ''; });
      var r = window.AllowanceRules.calculate({ buckets: buckets, specific: v('specific'), existingAllowance: v('existingAllowance'), priorReceivables: v('priorReceivables'), currentWriteOffs: v('currentWriteOffs') });
      if (r.status === 'INVALID') return fail(r);
      var body = '<div class="table-scroll"><table><thead><tr><th>구간</th><th class="num">잔액</th><th class="num">설정률</th><th class="num">대손충당금</th></tr></thead><tbody>' +
        r.rows.map(function (x) { return '<tr><td>' + esc(x.label) + '</td><td class="num">' + n(x.balance) + '</td><td class="num">' + n(x.rate) + '%</td><td class="num">' + n(x.allowance) + '</td></tr>'; }).join('') +
        (r.specific ? '<tr><td>개별평가 추가</td><td></td><td></td><td class="num">' + n(r.specific) + '</td></tr>' : '') +
        '<tr class="row-total"><td>합계</td><td class="num">' + n(r.totalReceivables) + '</td><td></td><td class="num">' + n(r.requiredAllowance) + '</td></tr></tbody></table></div>' +
        (r.additional !== undefined ? '<p>기존 잔액 대비 ' + (r.additional >= 0 ? '추가 설정 ' + n(r.additional) : '환입 ' + n(-r.additional)) + '</p>' : '') +
        '<h3>법인세법 한도</h3><table><tbody><tr><td>한도율 (max(1%, 대손실적률' + (r.lossRate !== null ? ' ' + r.lossRate + '%' : '') + '))</td><td class="num">' + r.taxRate + '%</td></tr><tr><td>손금 한도</td><td class="num">' + n(r.taxLimit) + '</td></tr><tr class="row-total"><td>한도초과액 (손금불산입)</td><td class="num">' + n(r.taxExcess) + '</td></tr></tbody></table>';
      show(r.taxExcess > 0 ? 'exempt' : 'not-target', '대손충당금 ' + n(r.requiredAllowance) + ' 설정이 필요할 수 있습니다', '채권 ' + n(r.totalReceivables) + ' · 세법 한도 ' + n(r.taxLimit) + (r.taxExcess > 0 ? ' · 한도초과 ' + n(r.taxExcess) : ''), body, r, 'ifrs', '채권 평가 상담 신청', '[대손충당금 계산] 설정액 ' + n(r.requiredAllowance) + ', 세법 한도 ' + n(r.taxLimit), CALC_DISCLAIMER);
    });
  }

  // ── 퇴직급여 ──
  var rt = document.getElementById('rt-form');
  if (rt) {
    var rows = document.getElementById('rt-rows'), count = 0;
    var addRow = function () { count++; rows.insertAdjacentHTML('beforeend', '<tr><td>' + count + '</td><td><input type="number" inputmode="numeric" min="0" class="rt-w" aria-label="' + count + '번 월평균임금" placeholder="예: 3500000"></td><td><input type="number" inputmode="decimal" min="0" step="0.1" class="rt-y" aria-label="' + count + '번 근속연수" placeholder="예: 3.5"></td><td><input type="checkbox" class="rt-dc" aria-label="' + count + '번 DC형"></td></tr>'); };
    for (var k = 0; k < 3; k++) addRow();
    document.getElementById('rt-add').addEventListener('click', addRow);
    rt.addEventListener('submit', function (e) {
      e.preventDefault();
      var ws = rt.querySelectorAll('.rt-w'), ys = rt.querySelectorAll('.rt-y'), ds = rt.querySelectorAll('.rt-dc'), emps = [];
      for (var i = 0; i < ws.length; i++) if (ws[i].value.trim() !== '' || ys[i].value.trim() !== '') emps.push({ monthlyWage: ws[i].value.trim(), years: ys[i].value.trim(), dc: ds[i].checked });
      var r = window.RetirementRules.calculate({ employees: emps, planAssets: v('planAssets'), openingProvision: v('openingProvision') });
      if (r.status === 'INVALID') return fail(r);
      var body = '<div class="table-scroll"><table><thead><tr><th>#</th><th class="num">월평균임금</th><th class="num">근속</th><th class="num">추계액</th><th>비고</th></tr></thead><tbody>' +
        r.rows.map(function (x) { return '<tr><td>' + x.no + '</td><td class="num">' + n(x.monthlyWage, 0) + '</td><td class="num">' + n(x.years) + '년</td><td class="num">' + n(x.amount, 0) + '</td><td>' + esc(x.excluded) + '</td></tr>'; }).join('') +
        '<tr class="row-total"><td colspan="3">퇴직금 추계액 합계 (' + r.counted + '명)</td><td class="num">' + n(r.estimate, 0) + '</td><td></td></tr></tbody></table></div>' +
        '<table><tbody>' + (r.netLiability !== r.estimate ? '<tr><td>사외적립자산 차감 후 순부채</td><td class="num">' + n(r.netLiability, 0) + '</td></tr>' : '') +
        (r.currentCharge !== undefined ? '<tr><td>당기 퇴직급여 설정액 (추계액 − 기초)</td><td class="num">' + n(r.currentCharge, 0) + '</td></tr><tr class="row-total"><td>세법상 손금불산입 (한도 0%)</td><td class="num">' + n(r.taxDisallowed, 0) + '</td></tr>' : '') + '</tbody></table>';
      show('target', '퇴직급여충당부채 약 ' + n(r.estimate, 0) + '원', '대상 ' + r.counted + '명' + (r.excludedShort ? ' · 1년 미만 ' + r.excludedShort + '명 제외' : '') + (r.excludedDc ? ' · DC형 ' + r.excludedDc + '명 제외' : ''), body, r, 'ifrs', '퇴직급여 회계처리 상담 신청', '[퇴직급여충당부채] 추계액 ' + n(r.estimate, 0) + '원 (' + r.counted + '명)', CALC_DISCLAIMER);
    });
  }

  // ── 감사위원회·상근감사 ──
  var gv = document.getElementById('gv-form');
  if (gv) {
    var syncGv = function () { var l = gv.listed.value === 'yes'; document.querySelector('.gv-listed').classList.toggle('hidden', !l); document.querySelector('.gv-unlisted').classList.toggle('hidden', l); };
    gv.addEventListener('change', syncGv); syncGv();
    var TITLES = { COMMITTEE: '감사위원회 설치 의무 대상으로 판단됩니다', COMMITTEE_VOLUNTARY: '자율 설치한 감사위원회로 상근감사 의무가 면제됩니다', FULLTIME_AUDITOR: '상근감사를 1명 이상 두어야 할 것으로 판단됩니다', AUDITOR: '감사(비상근 가능)를 선임하면 됩니다', AUDITOR_OPTIONAL: '감사 선임을 생략할 수 있는 회사입니다' };
    gv.addEventListener('submit', function (e) {
      e.preventDefault();
      var listed = gv.listed.value === 'yes';
      var r = window.GovernanceRules.evaluate({ listed: listed, assets: listed ? v('assets') : '', capital: listed ? '' : v('capital'), exemption: v('exemption'), voluntaryCommittee: document.getElementById('voluntaryCommittee').checked });
      if (r.status === 'INVALID') return fail(r);
      var body = '<table><tbody>' + (listed ? '<tr><td>감사위원회 설치 의무 (자산 2조원 이상)</td><td>' + (r.committeeRequired ? '<span class="mark-yes">해당</span>' : '<span class="mark-no">미해당</span>') + '</td></tr><tr><td>상근감사 의무 (자산 1천억원 이상, 감사위원회 없음)</td><td>' + (r.fullTimeAuditorRequired ? '<span class="mark-yes">해당</span>' : '<span class="mark-no">미해당</span>') + '</td></tr>' :
        '<tr><td>감사 선임 생략 가능 (자본금 10억원 미만)</td><td>' + (r.auditorOptional ? '<span class="mark-yes">가능</span>' : '<span class="mark-no">선임 필요</span>') + '</td></tr>') + '</tbody></table>';
      show(r.status === 'COMMITTEE' || r.status === 'FULLTIME_AUDITOR' ? 'target' : 'not-target', TITLES[r.status], listed ? '상장회사 · 자산총액 ' + n(v('assets')) + '억원' : '비상장회사 · 자본금 ' + n(v('capital')) + '억원', body, r, 'icfr', '지배구조·내부통제 상담 신청', '[감사위원회·상근감사 확인] ' + TITLES[r.status],
        '이 결과는 입력하신 규모에 상법 기준을 적용한 참고 자료입니다. 정관, 다른 법률(금융회사 지배구조법 등)의 특례, 위원 자격 요건은 개별 확인이 필요하므로 공인회계사·법률 전문가와 상담하시기 바랍니다.');
    });
  }

  // ── 세무 일정 ──
  var tc = document.getElementById('tc-form');
  if (tc) {
    var now = new Date(), yy = now.getFullYear(), ysel = document.getElementById('year'), msel = document.getElementById('fyEndMonth');
    for (var y = yy - 1; y <= yy + 2; y++) ysel.insertAdjacentHTML('beforeend', '<option value="' + y + '"' + (y === yy ? ' selected' : '') + '>' + y + '년</option>');
    for (var mm = 1; mm <= 12; mm++) msel.insertAdjacentHTML('beforeend', '<option value="' + mm + '"' + (mm === 12 ? ' selected' : '') + '>' + mm + '월</option>');
    var GROUP = { vat: '부가세', withholding: '원천세', payStatement: '지급명세서', corpTax: '법인세', interim: '중간예납' };
    tc.addEventListener('submit', function (e) {
      e.preventDefault();
      var r = window.TaxCalendarRules.calculate({ year: v('year'), fyEndMonth: v('fyEndMonth'), semiannual: document.getElementById('semiannual').checked, smallVat: document.getElementById('smallVat').checked });
      if (r.status === 'INVALID') return fail(r);
      var today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())).toISOString().slice(0, 10);
      var next = r.items.filter(function (x) { return x.date >= today; })[0];
      var body = '<div class="table-scroll"><table><thead><tr><th>기한</th><th>구분</th><th>내용</th></tr></thead><tbody>' +
        r.items.map(function (x) { var p = x.date.split('-'); var past = x.date < today; return '<tr' + (next && x === next ? ' class="row-total"' : '') + (past ? ' style="opacity:.55"' : '') + '><td>' + Number(p[1]) + '/' + Number(p[2]) + ' (' + x.weekday + ')' + (x.nextBusinessDay ? '<br><span class="hint" style="display:inline">→ ' + x.nextBusinessDay.slice(5).replace('-', '/') + '</span>' : '') + '</td><td>' + GROUP[x.group] + '</td><td>' + esc(x.title) + '<br><span class="hint" style="display:inline">' + esc(x.basis) + '</span></td></tr>'; }).join('') +
        '</tbody></table></div>';
      show('exempt', v('year') + '년 세무 일정 ' + r.items.length + '건', next ? '다음 기한: ' + next.date.slice(5).replace('-', '/') + ' ' + next.title : '이 연도의 기한은 모두 지났습니다', body, r, 'tax', '세무 신고 상담 신청', '[세무 일정] ' + v('year') + '년 ' + v('fyEndMonth') + '월 결산 법인',
        '이 일정은 일반적인 법정 기한을 정리한 참고 자료입니다. 회사의 사업자 유형, 승인·신청 여부, 기한 연장, 공휴일에 따라 실제 기한이 달라질 수 있습니다.');
    });
  }
})();
