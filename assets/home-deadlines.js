/*
 * 첫 화면 "지금 챙길 기한": 12월 결산 주식회사를 가정하고, 오늘 기준 앞으로 75일 안의 법정 기한을 보여 준다.
 * 날짜 계산은 audit-schedule.js(일정 계산기 로직)를 그대로 쓴다 — 기한 기준의 단일 출처.
 * 가정: 정기총회 3월 31일. 계속감사 회사와 첫 감사 회사의 선임 기한을 모두 표시한다.
 */
(function () {
  'use strict';
  var el = document.getElementById('home-deadlines');
  var S = window.AuditSchedule;
  if (!el || !S) return;

  var WINDOW_DAYS = 75;
  var now = new Date();
  var today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  var DAY = 86400000;
  function iso(d) { return d.toISOString().slice(0, 10); }
  function parse(s) { var p = s.split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); }
  function kdate(s) { var p = s.split('-'); return Number(p[1]) + '월 ' + Number(p[2]) + '일'; }

  // 기한이 걸릴 수 있는 사업연도: 작년 결산(올해 초 기한), 올해 결산(내년 초 기한), 내년 사업연도(내년 초 감사인 선임 기한)
  var years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];
  var found = {};
  years.forEach(function (fyEndYear) {
    [false, true].forEach(function (firstAudit) {
      var r = S.calculate({ companyType: 'stock', fyEndMonth: 12, fyEndYear: fyEndYear, agmDate: (fyEndYear + 1) + '-03-31', firstAudit: firstAudit });
      if (r.status !== 'OK') return;
      r.items.forEach(function (it) {
        if (!it.date) return;
        if (it.key === 'agm' || it.key === 'appointReport' || it.key === 'bsNotice') return;
        var key = it.key + (firstAudit && it.key === 'appoint' ? ':first' : '') + '|' + it.date;
        if (found[key]) return;
        if (!firstAudit || it.key === 'appoint') {
          found[key] = { date: it.date, title: it.key === 'appoint' ? (firstAudit ? '감사인 선임 (첫 감사, 직전연도 미감사)' : '감사인 선임 (계속감사)') : it.title.replace(/ \(.*\)$/, ''), basis: it.basis, fy: fyEndYear };
        }
      });
    });
  });

  var list = Object.keys(found).map(function (k) { return found[k]; }).filter(function (it) {
    var diff = (parse(it.date) - today) / DAY;
    return diff >= 0 && diff <= WINDOW_DAYS;
  }).sort(function (a, b) { return a.date < b.date ? -1 : 1; }).slice(0, 4);

  var heading, items;
  if (list.length) {
    heading = '지금 챙길 기한 <span class="hint" style="display:inline">(오늘 ' + kdate(iso(today)) + ' 기준, 앞으로 ' + WINDOW_DAYS + '일)</span>';
    items = list;
  } else {
    // 창 안에 없으면 다음 기한 하나
    var next = Object.keys(found).map(function (k) { return found[k]; }).filter(function (it) { return parse(it.date) >= today; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; })[0];
    if (!next) return;
    heading = '다음 법정 기한';
    items = [next];
  }

  el.innerHTML = '<h3>' + heading + '</h3><ul class="deadlines">' + items.map(function (it) {
    var d = Math.round((parse(it.date) - today) / DAY);
    return '<li><span class="dday">' + (d === 0 ? 'D-DAY' : 'D-' + d) + '</span><span><b>' + kdate(it.date) + '</b> ' + it.title + ' <span class="hint" style="display:inline">(' + it.basis + ', ' + it.fy + '년 결산분)</span></span></li>';
  }).join('') + '</ul>' +
    '<p class="hint">12월 결산 주식회사, 정기총회 3월 31일을 가정한 날짜입니다. 결산월·총회일이 다르면 <a href="audit-schedule.html">외부감사 일정 계산기</a>에서 회사 기준으로 확인하세요. 기한이 주말·공휴일이면 실제 마감일이 달라질 수 있습니다.</p>';
  el.classList.remove('hidden');
})();
