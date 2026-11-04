/*
 * 외부감사 일정 계산 로직 (순수 함수, 브라우저·Node 공용)
 * 근거와 계산 규칙: docs/08_외감일정_로직.md (2026-11-04 법제처 현행 조회)
 *  - 외감법 제6조·제10조·제12조·제23조, 시행령 제8조·제18조·제27조
 *  - 민법 제157조·제160조·제161조 (기간 계산), 상법 제449조제3항
 *  - 법인세법 제60조·제64조, 국세기본법 제4조·제5조 (법인세 신고·납부 기한)
 * 날짜는 'YYYY-MM-DD' 문자열로 주고받고, 내부 계산은 UTC 자정 기준 Date로 한다(시간대 오차 방지).
 */
(function (root) {
  'use strict';

  var RULES_VERSION = '2026-11-04';
  var DAY = 86400000;

  // ---------- 날짜 도구 ----------
  function ymd(y, m, d) { return new Date(Date.UTC(y, m - 1, d)); }
  function lastDay(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
  function iso(dt) { return dt.toISOString().slice(0, 10); }
  function parse(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    var p = s.split('-').map(Number);
    var dt = ymd(p[0], p[1], p[2]);
    return iso(dt) === s ? dt : null;
  }
  function addDays(dt, n) { return new Date(dt.getTime() + n * DAY); }
  function weekday(dt) { return dt.getUTCDay(); } // 0=일, 6=토

  // 개시일(0시 시작, 초일 산입)부터 N개월 이내의 말일 (민법 §157 단서, §160②③)
  function monthsFromStart(start, n) {
    var y = start.getUTCFullYear();
    var m = start.getUTCMonth() + 1 + n;
    y += Math.floor((m - 1) / 12);
    m = ((m - 1) % 12) + 1;
    var d = start.getUTCDate();
    if (d > lastDay(y, m)) return ymd(y, m, lastDay(y, m)); // 해당일 없음 → 그 월의 말일
    return addDays(ymd(y, m, d), -1); // 기산일에 해당한 날의 전일
  }

  // 사업연도: 결산월·종료연도 → 개시일·종료일 (12개월 사업연도 가정)
  function fiscalYear(endMonth, endYear) {
    var end = ymd(endYear, endMonth, lastDay(endYear, endMonth));
    var py = endMonth === 12 ? endYear : endYear - 1;
    var pm = endMonth === 12 ? 1 : endMonth + 1;
    var start = ymd(py, pm, 1);
    return { start: start, end: end };
  }

  var WEEK = ['일', '월', '화', '수', '목', '금', '토'];
  function kdate(s) { var p = s.split('-'); return p[0] + '년 ' + Number(p[1]) + '월 ' + Number(p[2]) + '일'; }

  /**
   * @param {object} input
   *  companyType: 'stock' | 'llc'
   *  fyEndMonth: 1~12, fyEndYear: 4자리 연도   계산할 사업연도의 결산월·종료연도
   *  agmDate: 'YYYY-MM-DD' (선택)              정기총회 예정일
   *  firstAudit: boolean                        직전 사업연도에 회계감사를 받지 않음
   *  auditCommittee: boolean                    감사위원회 설치 의무 회사
   *  consolidated: boolean                      연결재무제표 작성
   *  kifrs: boolean                             한국채택국제회계기준 적용
   */
  function calculate(input) {
    input = input || {};
    var errors = [];
    var r = { version: RULES_VERSION, status: null, errors: errors, fyStart: null, fyEnd: null, agmDate: null, items: [], notes: [] };

    var type = input.companyType;
    if (type !== 'stock' && type !== 'llc') errors.push('회사 형태(주식회사/유한회사)를 선택해 주세요.');
    var em = Number(input.fyEndMonth), ey = Number(input.fyEndYear);
    if (!(em >= 1 && em <= 12 && Math.floor(em) === em)) errors.push('결산월을 선택해 주세요.');
    if (!(ey >= 2000 && ey <= 2100 && Math.floor(ey) === ey)) errors.push('사업연도 종료 연도를 선택해 주세요.');
    if (errors.length) { r.status = 'INVALID'; return r; }

    var fy = fiscalYear(em, ey);
    r.fyStart = iso(fy.start);
    r.fyEnd = iso(fy.end);

    var agm = null;
    if (input.agmDate) {
      agm = parse(input.agmDate);
      if (!agm) errors.push('정기총회 예정일 형식이 올바르지 않습니다.');
      else if (agm <= fy.end) errors.push('정기총회 예정일은 사업연도 종료일(' + r.fyEnd + ') 이후여야 합니다.');
    }
    if (errors.length) { r.status = 'INVALID'; return r; }
    r.agmDate = agm ? iso(agm) : null;

    var items = r.items;
    function push(it) {
      it.date = it.dt ? iso(it.dt) : null;
      it.weekday = it.dt ? WEEK[weekday(it.dt)] : null;
      it.weekendNext = null;
      it.weekendPrev = null;
      if (it.dt) {
        var w = weekday(it.dt);
        if (w === 0 || w === 6) {
          if (it.direction === 'forward') it.weekendNext = iso(addDays(it.dt, w === 6 ? 2 : 1));
          else if (it.direction === 'backward') it.weekendPrev = iso(addDays(it.dt, w === 6 ? -1 : -2));
        }
      }
      delete it.dt;
      items.push(it);
    }
    var needAgm = '정기총회 예정일을 입력하면 날짜를 계산합니다.';

    // 1) 감사인 선임 (법 §10)
    if (input.firstAudit) {
      push({ key: 'appoint', title: '감사인 선임', who: '회사', dt: monthsFromStart(fy.start, 4), when: '까지', direction: 'forward',
        rule: '사업연도 개시일부터 4개월 이내', basis: '외감법 제10조제2항',
        note: '직전 사업연도에 회계감사를 받지 않은 회사의 기한입니다.' + (input.auditCommittee ? ' 감사위원회 설치 의무 회사이기도 하면 적용 기준이 달라질 수 있어 확인이 필요합니다.' : '') });
    } else if (input.auditCommittee) {
      push({ key: 'appoint', title: '감사인 선임', who: '회사', dt: fy.start, when: '이전', direction: null,
        rule: '사업연도 개시일 이전', basis: '외감법 제10조제1항 괄호',
        note: '「상법」 제542조의11 등에 따라 감사위원회를 설치해야 하는 회사의 기한입니다.' });
    } else {
      push({ key: 'appoint', title: '감사인 선임', who: '회사', dt: addDays(fy.start, 44), when: '까지', direction: 'forward',
        rule: '사업연도 개시일부터 45일 이내', basis: '외감법 제10조제1항', note: '' });
    }

    // 2) 감사인 선임 보고 (법 §12②, 영 §18)
    push({ key: 'appointReport', title: '감사인 선임 보고 (증권선물위원회, 전자문서)', who: '회사·감사인', dt: null, when: null, direction: null,
      rule: '감사계약 체결일부터 2주 이내', basis: '외감법 제12조제2항, 시행령 제18조제2항·제4항',
      note: '감사계약서 사본 등을 제출합니다.' + (input.firstAudit ? '' : ' 직전 사업연도 감사인을 다시 선임한 경우(주권상장법인·대형비상장주식회사·금융회사 제외)에는 회사의 보고를 생략할 수 있습니다(외감법 제12조제2항제3호).') });

    // 3) 감사 전 재무제표 제출 (영 §8①1)
    push({ key: 'fsSubmit', title: '감사 전 재무제표 제출 (감사인에게)', who: '회사', dt: agm ? addDays(agm, -42) : null, when: '까지', direction: 'backward',
      rule: '정기총회 개최 6주 전', basis: '외감법 제6조제2항, 시행령 제8조제1항제1호', note: agm ? '' : needAgm });

    // 4) 감사 전 연결재무제표 제출 (영 §8①2)
    if (input.consolidated) {
      if (input.kifrs) {
        push({ key: 'consFsSubmit', title: '감사 전 연결재무제표 제출 (감사인에게)', who: '회사', dt: agm ? addDays(agm, -28) : null, when: '까지', direction: 'backward',
          rule: '정기총회 개최 4주 전 (K-IFRS 적용 회사)', basis: '시행령 제8조제1항제2호가목', note: agm ? '' : needAgm });
      } else {
        push({ key: 'consFsSubmit', title: '감사 전 연결재무제표 제출 (감사인에게)', who: '회사', dt: addDays(fy.end, 90), when: '까지', direction: 'forward',
          rule: '사업연도 종료 후 90일 이내 (K-IFRS 미적용 회사)', basis: '시행령 제8조제1항제2호나목', note: '' });
      }
    }

    // 5) 감사보고서 회사 제출 (영 §27①)
    push({ key: 'auditReport', title: '감사보고서 수령 (감사인 → 회사)', who: '감사인', dt: agm ? addDays(agm, -7) : null, when: '까지', direction: 'backward',
      rule: '정기총회 개최 1주 전', basis: '외감법 제23조제1항, 시행령 제27조제1항', note: agm ? '' : needAgm });
    if (input.consolidated && !input.kifrs) {
      push({ key: 'consAuditReport', title: '연결 감사보고서 수령 (감사인 → 회사)', who: '감사인', dt: addDays(fy.end, 120), when: '까지', direction: 'forward',
        rule: '사업연도 종료 후 120일 이내 (K-IFRS 미적용 회사)', basis: '시행령 제27조제1항제2호나목', note: '' });
    }

    // 정기총회
    if (agm) {
      push({ key: 'agm', title: '정기총회 (재무제표 승인)', who: '회사', dt: agm, when: '예정', direction: null,
        rule: '입력하신 예정일', basis: type === 'stock' ? '상법 제449조제1항' : '', note: '' });
    }

    // 6) 감사보고서 증선위·한국공인회계사회 제출 (영 §27③)
    push({ key: 'reportToFsc', title: '감사보고서 제출 (감사인 → 증권선물위원회·한국공인회계사회)', who: '감사인', dt: agm ? addDays(agm, 14) : null, when: '까지', direction: 'forward',
      rule: '정기총회 종료 후 2주 이내', basis: '시행령 제27조제3항', note: agm ? '' : needAgm });

    // 7) 승인받은 재무제표 증선위 제출 (법 §23③, 영 §27⑤)
    push({ key: 'approvedFs', title: '승인받은 재무제표 제출 (증권선물위원회)', who: '회사', dt: agm ? addDays(agm, 14) : null, when: '까지', direction: 'forward',
      rule: '정기총회(또는 이사회) 승인일부터 2주 이내', basis: '외감법 제23조제3항, 시행령 제27조제5항',
      note: (agm ? '' : needAgm + ' ') + '승인받은 재무제표가 감사보고서에 첨부된 재무제표와 같으면 제출하지 않을 수 있습니다.' });

    // 8) 대차대조표 공고 (주식회사, 상법 §449③)
    if (type === 'stock') {
      push({ key: 'bsNotice', title: '대차대조표 공고', who: '회사', dt: null, when: null, direction: null,
        rule: '정기총회 승인 후 지체 없이', basis: '상법 제449조제3항, 외감법 제23조제6항',
        note: '공고할 때 감사인의 명칭과 감사의견을 함께 적어야 합니다.' });
    }

    // 9) 법인세 신고·납부 (법인세법 §60①⑦, §64; 기간 계산은 국세기본법 §4 → 민법, 휴일은 국세기본법 §5)
    var afterEndMonth = addDays(fy.end, 1); // 종료일이 속하는 달의 말일 다음 날 (fy.end는 항상 월말)
    var corpExt = monthsFromStart(afterEndMonth, 4);
    push({ key: 'corpTax', title: '법인세 신고·납부', who: '회사', dt: monthsFromStart(afterEndMonth, 3), when: '까지', direction: 'forward',
      weekendLaw: 'tax',
      rule: '사업연도 종료일이 속하는 달의 말일부터 3개월 이내', basis: '법인세법 제60조제1항, 제64조제1항',
      note: '외부감사가 끝나지 않아 결산이 확정되지 않았다면 신청을 통해 1개월 범위에서 ' + kdate(iso(corpExt)) + '까지 연장할 수 있습니다(이자 상당액 가산, 법인세법 제60조제7항·제8항). ' +
        '납부할 세액이 1천만원을 넘으면 일부를 1개월(중소기업 2개월) 이내에 나누어 낼 수 있습니다(같은 법 제64조제2항).' });

    // 날짜 있는 항목을 날짜순으로, 날짜 없는 항목은 원래 순서대로 뒤에
    var order = items.map(function (it, i) { return i; });
    order.sort(function (a, b) {
      var A = items[a], B = items[b];
      if (A.date && B.date) return A.date < B.date ? -1 : A.date > B.date ? 1 : a - b;
      return a - b;
    });
    r.items = order.map(function (i) { return items[i]; });

    r.notes.push('정기총회 N주 전 기한은 총회일에서 7×N일을 뺀 날로 표시했습니다. 역산 방식에 따라 하루 차이가 날 수 있으니 여유 있게 준비하세요.');
    r.notes.push('기한이 토요일·일요일이면 표시했습니다. 공휴일은 반영하지 않았습니다.');
    r.status = 'OK';
    return r;
  }

  var api = { calculate: calculate, fiscalYear: function (m, y) { var f = fiscalYear(m, y); return { start: iso(f.start), end: iso(f.end) }; }, RULES_VERSION: RULES_VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AuditSchedule = api;
})(this);
