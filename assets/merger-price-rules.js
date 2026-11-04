/*
 * 상장사 합병가액(기준시가) 계산 로직 (순수 함수, 브라우저·Node 공용)
 * 근거: docs/19_합병가액_로직.md — 자본시장법 시행령 제176조의5제1항 (2026-11-04 조회)
 * ⚠ 2026-12-09 시행 개정 법률에 맞춰 시행령 산식이 바뀔 수 있다.
 */
(function (root) {
  'use strict';

  var VERSION = '2026-11-04';
  var DAY = 86400000;
  var RANGE = 10, RANGE_SPAC = 30; // % (시행령 제176조의5제1항제1호)
  var EX_MIN_DAYS = 7;             // 배당락·권리락 후 7일 이상 (같은 호 가목 단서)

  function parse(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    var p = s.split('-').map(Number);
    var d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    return d.toISOString().slice(0, 10) === s ? d : null;
  }
  function iso(d) { return d.toISOString().slice(0, 10); }
  function add(d, n) { return new Date(d.getTime() + n * DAY); }
  function lastDay(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); } // m: 1~12
  function blank(v) { return v === undefined || v === null || v === ''; }
  function pos(v) { var n = Number(v); return !blank(v) && isFinite(n) && n > 0 ? n : null; }

  // 기산일의 1개월 전 같은 날의 다음 날 (해당일이 없으면 그 달 말일 다음 날)
  function oneMonthStart(base) {
    var y = base.getUTCFullYear(), m = base.getUTCMonth(); // m: 0~11
    var py = m === 0 ? y - 1 : y, pm = m === 0 ? 12 : m;   // 전월(1~12)
    var d = Math.min(base.getUTCDate(), lastDay(py, pm));
    return add(new Date(Date.UTC(py, pm - 1, d)), 1);
  }

  /**
   * 일별 시세 붙여넣기 텍스트 → rows. 한 줄에 "날짜 종가 거래량".
   * 탭으로 구분된 줄(엑셀·거래소 화면 복사)은 숫자 안의 천 단위 쉼표를 허용하고, 그 외에는 쉼표·공백을 구분자로 본다.
   */
  function parseRows(text) {
    var rows = [], bad = [];
    String(text || '').split(/\r?\n/).forEach(function (line, i) {
      var t = line.trim();
      if (!t) return;
      var parts = (t.indexOf('\t') >= 0 ? t.split(/\t+/) : t.split(/[,;\s]+/)).map(function (x) { return x.trim(); }).filter(Boolean);
      var date = (parts[0] || '').replace(/[./]/g, '-');
      var close = Number(String(parts[1]).replace(/,/g, '')), vol = Number(String(parts[2]).replace(/,/g, ''));
      if (!parse(date) || !(close > 0) || !(vol >= 0)) { bad.push(i + 1); return; }
      rows.push({ date: date, close: close, volume: vol });
    });
    return { rows: rows, bad: bad };
  }

  function vwap(rows, from, to) {
    var sv = 0, s = 0, n = 0;
    rows.forEach(function (r) {
      var d = parse(r.date);
      if (d >= from && d <= to) { s += r.close * r.volume; sv += r.volume; n++; }
    });
    if (!n) return { value: null, days: 0 };
    if (sv === 0) return { value: null, days: n, zeroVolume: true };
    return { value: s / sv, days: n };
  }

  /**
   * @param {object} input
   *  mode: 'direct' | 'daily'
   *  (direct) avg1m, avg1w, last: 원
   *  (daily)  boardDate, contractDate: 'YYYY-MM-DD'(하나 이상), rows: [{date, close, volume}], exDate: 배당락·권리락일(선택)
   *  spac: boolean     기업인수목적회사 합병(±30%)
   *  assetValue: 원    (상장·비상장 합병) 상장법인 1주당 자산가치(선택)
   */
  function calculate(input) {
    input = input || {};
    var errors = [];
    var r = { version: VERSION, status: null, errors: errors, mode: input.mode, notes: [], baseDate: null, period1m: null, period1w: null, lastDate: null };

    if (input.mode === 'direct') {
      r.avg1m = pos(input.avg1m); r.avg1w = pos(input.avg1w); r.last = pos(input.last);
      if (r.avg1m === null || r.avg1w === null || r.last === null) errors.push('1개월 평균종가, 1주일 평균종가, 최근일 종가를 모두 0보다 큰 숫자로 입력해 주세요.');
    } else if (input.mode === 'daily') {
      var b = parse(input.boardDate), c = parse(input.contractDate);
      if (!b && !c) errors.push('합병 이사회 결의일 또는 합병계약 체결일을 입력해 주세요.');
      var rows = (input.rows || []).filter(function (x) { return parse(x.date) && x.close > 0 && x.volume >= 0; });
      if (!rows.length) errors.push('일별 시세(날짜, 종가, 거래량)를 입력해 주세요.');
      if (!errors.length) {
        var first = b && c ? (b < c ? b : c) : (b || c);
        var base = add(first, -1);
        r.baseDate = iso(base);
        var from1m = oneMonthStart(base), from1w = add(base, -6);
        var ex = blank(input.exDate) ? null : parse(input.exDate);
        if (!blank(input.exDate) && !ex) errors.push('배당락·권리락일 형식이 올바르지 않습니다.');
        if (ex && ex >= from1m && ex <= base) {
          var exDays = Math.round((base - ex) / DAY) + 1;
          if (exDays >= EX_MIN_DAYS) {
            from1m = ex;
            r.notes.push('1개월 기간 중 배당락·권리락(' + iso(ex) + ')이 있고 기산일까지 ' + exDays + '일이어서, 1개월 평균종가를 락일 이후 기간으로 계산했습니다(시행령 제176조의5제1항제1호가목 단서).');
          } else {
            r.notes.push('배당락·권리락일부터 기산일까지 ' + exDays + '일로 7일 미만이어서 1개월 평균종가 기간을 조정하지 않았습니다.');
          }
        }
        r.period1m = [iso(from1m), iso(base)];
        r.period1w = [iso(from1w), iso(base)];
        var m1 = vwap(rows, from1m, base), w1 = vwap(rows, from1w, base);
        if (m1.value === null) errors.push('최근 1개월 기간(' + r.period1m.join(' ~ ') + ')에 거래량이 있는 시세가 없습니다.');
        if (w1.value === null) errors.push('최근 1주일 기간(' + r.period1w.join(' ~ ') + ')에 거래량이 있는 시세가 없습니다.');
        r.avg1m = m1.value; r.avg1w = w1.value; r.days1m = m1.days; r.days1w = w1.days;
        var lastRow = rows.filter(function (x) { return parse(x.date) <= base; }).sort(function (x, y) { return x.date < y.date ? 1 : -1; })[0];
        if (!lastRow) errors.push('기산일 이전 종가가 없습니다.');
        else { r.last = lastRow.close; r.lastDate = lastRow.date; }
      }
    } else {
      errors.push('입력 방식을 선택해 주세요.');
    }
    var asset = blank(input.assetValue) ? null : pos(input.assetValue);
    if (!blank(input.assetValue) && asset === null) errors.push('자산가치는 0보다 큰 숫자로 입력해 주세요.');
    if (errors.length) { r.status = 'INVALID'; return r; }

    r.base = (r.avg1m + r.avg1w + r.last) / 3;
    r.rangePct = input.spac ? RANGE_SPAC : RANGE;
    r.low = r.base * (100 - r.rangePct) / 100;
    r.high = r.base * (100 + r.rangePct) / 100;
    r.belowAsset = asset !== null && r.base < asset;
    r.assetValue = asset;
    if (r.belowAsset) r.notes.push('주권비상장법인과 합병하는 경우, 상장법인의 기준시가가 자산가치(' + asset.toLocaleString('ko-KR') + '원)에 미달하면 자산가치로 할 수 있습니다(시행령 제176조의5제1항제2호가목 단서). 자산가치 산정 방법은 금융위원회 고시에 따릅니다.');
    r.status = 'OK';
    return r;
  }

  var api = { calculate: calculate, parseRows: parseRows, VERSION: VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MergerPriceRules = api;
})(this);
