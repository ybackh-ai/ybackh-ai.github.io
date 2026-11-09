/*
 * 법인 세무 신고 연간 일정 로직 (순수 함수, 브라우저·Node 공용). 근거: docs/39_세무일정_로직.md
 * 「부가가치세법」 제5조·제48조·제49조, 같은 법 시행령 제90조제4항, 「소득세법」 제128조·제164조, 같은 법 시행령 제186조,
 * 「법인세법」 제60조제1항·제63조 (2026-11-09 법제처 현행 확인)
 */
(function (root) {
  'use strict';
  var VERSION = '2026-11-09';
  var WEEK = ['일', '월', '화', '수', '목', '금', '토'];
  function ymd(y, m, d) { return new Date(Date.UTC(y, m - 1, d)); }
  function lastDay(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
  function iso(dt) { return dt.toISOString().slice(0, 10); }
  // m월(1~12, 13 이상이면 다음 해)의 말일
  function monthEnd(y, m) { var yy = y + Math.floor((m - 1) / 12), mm = ((m - 1) % 12) + 1; return ymd(yy, mm, lastDay(yy, mm)); }

  /**
   * @param input year(달력 연도), fyEndMonth(결산월 1~12), semiannual(원천세 반기납부 승인),
   *              smallVat(직전 과세기간 공급가액 1.5억 미만 법인 → 부가세 예정고지)
   */
  function calculate(input) {
    input = input || {};
    var errors = [];
    var r = { version: VERSION, status: null, errors: errors, notes: [], basis: [], items: [] };
    var Y = Number(input.year), em = Number(input.fyEndMonth);
    if (!(Y >= 2000 && Y <= 2100 && Math.floor(Y) === Y)) errors.push('연도는 2000~2100 사이로 입력해 주세요.');
    if (!(em >= 1 && em <= 12 && Math.floor(em) === em)) errors.push('결산월을 1~12 사이로 선택해 주세요.');
    if (errors.length) { r.status = 'INVALID'; return r; }
    var items = [];
    function add(group, dt, title, basis, kind) {
      if (dt.getUTCFullYear() !== Y) return;
      var w = dt.getUTCDay(), next = null;
      if (w === 0 || w === 6) next = iso(new Date(dt.getTime() + (w === 6 ? 2 : 1) * 86400000));
      items.push({ group: group, date: iso(dt), weekday: WEEK[w], title: title, basis: basis, kind: kind || 'filing', nextBusinessDay: next });
    }

    // 부가가치세 (법인 일반과세자)
    add('vat', ymd(Y, 1, 25), '부가가치세 확정신고·납부 (' + (Y - 1) + '년 제2기, 7~12월)', '부가가치세법 제49조제1항, 제5조제1항');
    add('vat', ymd(Y, 4, 25), input.smallVat ? '부가가치세 예정고지 납부 (제1기 예정, 1~3월) — 고지서 금액' : '부가가치세 예정신고·납부 (제1기, 1~3월)', input.smallVat ? '부가가치세법 제48조제3항, 시행령 제90조제4항' : '부가가치세법 제48조제1항', input.smallVat ? 'notice' : 'filing');
    add('vat', ymd(Y, 7, 25), '부가가치세 확정신고·납부 (제1기, 4~6월)', '부가가치세법 제49조제1항');
    add('vat', ymd(Y, 10, 25), input.smallVat ? '부가가치세 예정고지 납부 (제2기 예정, 7~9월) — 고지서 금액' : '부가가치세 예정신고·납부 (제2기, 7~9월)', input.smallVat ? '부가가치세법 제48조제3항, 시행령 제90조제4항' : '부가가치세법 제48조제1항', input.smallVat ? 'notice' : 'filing');

    // 원천세
    if (input.semiannual) {
      add('withholding', ymd(Y, 1, 10), '원천세 반기 납부 (' + (Y - 1) + '년 7~12월 원천징수분)', '소득세법 제128조제2항, 시행령 제186조');
      add('withholding', ymd(Y, 7, 10), '원천세 반기 납부 (1~6월 원천징수분)', '소득세법 제128조제2항, 시행령 제186조');
    } else {
      for (var m = 1; m <= 12; m++) add('withholding', ymd(Y, m, 10), '원천세 신고·납부 (' + (m === 1 ? (Y - 1) + '년 12' : (m - 1)) + '월 원천징수분)', '소득세법 제128조제1항');
    }

    // 지급명세서 (연간)
    add('payStatement', ymd(Y, 2, lastDay(Y, 2)), '지급명세서 제출 — 이자·배당·기타소득 (' + (Y - 1) + '년 지급분)', '소득세법 제164조제1항');
    add('payStatement', ymd(Y, 3, 10), '지급명세서 제출 — 근로·퇴직·원천징수 사업소득 (' + (Y - 1) + '년 지급분)', '소득세법 제164조제1항');

    // 법인세: 종료월 말일부터 3개월 / 중간예납: 개시일부터 6개월 기간 경과 후 2개월
    [Y - 1, Y].forEach(function (endYear) {
      var due = monthEnd(endYear, em + 3);
      add('corpTax', due, '법인세 신고·납부 (' + endYear + '년 ' + em + '월 결산)', '법인세법 제60조제1항, 제64조제1항');
    });
    [Y - 1, Y].forEach(function (startYear) {
      var startMonth = em === 12 ? 1 : em + 1;
      var sy = em === 12 ? startYear : startYear;
      // 사업연도 개시월 기준 6개월 기간 종료월 = 개시월 + 5, 납부기한 = 그 다음 2개월 말일
      var due = monthEnd(sy, startMonth + 5 + 2);
      add('interim', due, '법인세 중간예납 (' + sy + '년 ' + startMonth + '월 개시 사업연도, 상반기분)', '법인세법 제63조제2항·제3항');
    });

    items.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    r.items = items;
    r.status = 'OK';
    r.basis.push('부가가치세: 일반과세자 과세기간은 1~6월(제1기)·7~12월(제2기), 예정신고기간은 1~3월·7~9월이며 각 기간이 끝난 후 25일 이내 신고·납부합니다(「부가가치세법」 제5조, 제48조, 제49조).');
    r.basis.push('직전 과세기간 공급가액 1억5천만원 미만 법인은 예정신고 대신 직전 과세기간 납부세액의 50%를 고지받아 납부합니다(같은 법 제48조제3항, 시행령 제90조제4항 — 고지 금액 50만원 미만이면 징수하지 않음).');
    r.basis.push('원천세: 원천징수한 달의 다음 달 10일까지 납부합니다. 직전 연도 상시고용인원 20명 이하(금융·보험업 제외)로 승인받으면 반기별로 7월 10일·1월 10일에 납부할 수 있습니다(「소득세법」 제128조, 시행령 제186조).');
    r.basis.push('법인세는 사업연도 종료일이 속하는 달의 말일부터 3개월 이내, 중간예납은 사업연도 개시일부터 6개월이 지난 날부터 2개월 이내입니다(「법인세법」 제60조제1항, 제63조).');
    r.notes.push('기한이 토요일·일요일이면 다음 영업일로 늦춰진다고 표시했습니다(「국세기본법」 제5조). 공휴일 달력은 반영하지 않았습니다.');
    r.notes.push('간이지급명세서, 일용근로소득 지급명세서(매월), 연말정산, 지방소득세, 4대보험, 법인세 신고기한 연장(외부감사 미종결), 중간예납 면제(직전 연도 중소기업으로 50만원 미만 등)는 포함하지 않았습니다.');
    return r;
  }

  var api = { calculate: calculate, VERSION: VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TaxCalendarRules = api;
})(this);
