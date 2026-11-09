/*
 * 적격합병·적격분할 요건 진단, 배당가능이익·자기주식 취득 한도, 가산세 계산 (순수 함수, 브라우저·Node 공용). 근거: docs/46_조직재편_배당_가산세_로직.md
 * 「법인세법」 제44조제2항·제3항, 제46조제2항·제3항 / 「상법」 제341조, 제458조, 제462조, 같은 법 시행령 제19조 /
 * 「국세기본법」 제47조의2, 제47조의3, 제47조의4, 제48조제2항, 같은 법 시행령 제27조의4 (2026-11-09 조회)
 */
(function (root) {
  'use strict';
  var VERSION = '2026-11-09';
  function blank(v) { return v === undefined || v === null || v === ''; }
  function r2(x) { return Math.round(x * 100 + (x >= 0 ? 1e-9 : -1e-9)) / 100; }
  function reader(errors) {
    return function (v, label, opt) {
      opt = opt || {};
      if (blank(v)) { if (opt.optional) return 0; errors.push(label + '을(를) 입력해 주세요.'); return 0; }
      var x = Number(v);
      if (!isFinite(x) || x < 0) { errors.push(label + '은(는) 0 이상의 숫자로 입력해 주세요.'); return 0; }
      if (opt.max !== undefined && x > opt.max) { errors.push(label + '은(는) ' + opt.max + ' 이하로 입력해 주세요.'); return 0; }
      return x;
    };
  }

  // ── 적격합병·적격분할 ──
  /**
   * @param input mode 'merger'|'split'
   *   합병: over1y, stockPct, holdShares, continueBiz, employeePct, keepEmployees, whollyOwned(§44③)
   *   분할: over5y, independent, comprehensive, ownContribution, splitMerger, counterpartOver1y, stockPct, holdShares, continueBiz, employeePct, keepEmployees, realEstate(§46③)
   */
  function reorg(input) {
    input = input || {};
    var errors = [], num = reader(errors);
    var r = { version: VERSION, status: null, errors: errors, notes: [], basis: [], checks: [] };
    var split = input.mode === 'split';
    var stockPct = num(input.stockPct, '대가 중 주식 비율', { optional: true, max: 100 });
    var empPct = num(input.employeePct, '승계 근로자 비율', { optional: true, max: 100 });
    if (errors.length) { r.status = 'INVALID'; return r; }
    function check(label, ok, basis) { r.checks.push({ label: label, ok: !!ok, basis: basis }); }
    if (!split) {
      if (input.whollyOwned) {
        r.qualified = true; r.failed = 0; r.special = true;
        r.basis.push('「법인세법」 제44조제3항 — 발행주식 전부를 소유한 법인 간(모자회사, 같은 모회사의 100% 자회사끼리) 합병은 제2항 요건과 관계없이 적격합병으로 봅니다.');
      } else {
        check('① 사업목적: 합병등기일 현재 1년 이상 사업을 계속한 내국법인 간 합병', input.over1y, '§44②1');
        check('② 지분 연속성: 합병대가 중 합병법인(또는 100% 모회사) 주식 80% 이상 (현재 ' + stockPct + '%)', stockPct >= 80, '§44②2');
        check('② 지분 연속성: 지배주주 등이 합병등기일이 속하는 사업연도 말까지 주식 보유', input.holdShares, '§44②2');
        check('③ 사업 계속성: 승계 사업을 그 사업연도 말까지 계속', input.continueBiz, '§44②3');
        check('④ 고용 승계: 합병등기일 1개월 전 근로자 중 80% 이상 승계 (현재 ' + empPct + '%)', empPct >= 80, '§44②4');
        check('④ 고용 승계: 그 비율을 사업연도 말까지 유지', input.keepEmployees, '§44②4');
        r.basis.push('「법인세법」 제44조제2항 — 네 요건을 모두 갖추면 피합병법인의 양도손익이 없는 것으로 할 수 있습니다(양도가액 = 순자산 장부가액).');
      }
    } else {
      check('① 분할법인이 분할등기일 현재 5년 이상 사업을 계속', input.over5y, '§46②1');
      if (input.splitMerger) check('① 분할합병 상대방 법인이 1년 이상 사업을 계속', input.counterpartOver1y, '§46②1');
      check('① 분리해 사업이 가능한 독립된 사업부문을 분할', input.independent, '§46②1가');
      check('① 분할 사업부문의 자산·부채를 포괄적으로 승계', input.comprehensive, '§46②1나');
      check('① 분할법인만의 출자로 분할', input.ownContribution, '§46②1다');
      check(input.splitMerger ? '② 분할대가 중 상대방 법인(또는 100% 모회사) 주식 80% 이상 (현재 ' + stockPct + '%)' : '② 분할대가 전액이 주식 (현재 ' + stockPct + '%)', input.splitMerger ? stockPct >= 80 : stockPct >= 100, '§46②2');
      check('② 주주가 지분비율대로 주식을 받고 사업연도 말까지 보유', input.holdShares, '§46②2');
      check('③ 승계 사업을 사업연도 말까지 계속', input.continueBiz, '§46②3');
      check('④ 분할 사업부문 근로자 80% 이상 승계 (현재 ' + empPct + '%)', empPct >= 80, '§46②4');
      check('④ 그 비율을 사업연도 말까지 유지', input.keepEmployees, '§46②4');
      check('부동산임대업 주업 등 제외 사업부문이 아님', !input.realEstate, '§46③');
      r.basis.push('「법인세법」 제46조제2항 — 인적분할(물적분할 제외)은 요건을 모두 갖추면 분할법인의 양도손익이 없는 것으로 할 수 있습니다. 제3항의 사업부문은 적격분할로 보지 않습니다.');
    }
    if (!r.special) { r.failed = r.checks.filter(function (c) { return !c.ok; }).length; r.qualified = r.failed === 0; }
    r.notes.push('대통령령으로 정하는 부득이한 사유가 있으면 지분·사업·고용 요건을 못 갖춰도 적격으로 볼 수 있습니다(제2항 단서). 지배주주 범위, 근로자 범위, 주식 배정 방법, 부득이한 사유는 시행령 원문 대조 전입니다(확실하지 않음).');
    r.notes.push('적격으로 과세이연을 받은 뒤 2년(고용은 3년) 안에 사업 폐지·주식 처분·근로자 감소가 생기면 이연된 세금을 다시 내는 사후관리 규정(제44조의3, 제46조의3)이 있습니다(원문 대조 전).');
    if (split) r.notes.push('물적분할은 제47조(분할법인이 받은 주식의 압축기장충당금)로 따로 판단합니다.');
    r.status = r.qualified ? 'QUALIFIED' : 'NOT_QUALIFIED';
    return r;
  }

  // ── 배당가능이익·자기주식 (백만원) ──
  /**
   * @param input netAssets(대차대조표 순자산), capital, capitalReserve, earnedReserve(적립된 이익준비금), unrealized(미실현이익),
   *              dividend(계획 현금배당, 선택), treasury(계획 자기주식 취득가액, 선택)
   */
  function distributable(input) {
    input = input || {};
    var errors = [], num = reader(errors);
    var r = { version: VERSION, status: null, errors: errors, notes: [], basis: [] };
    var na = num(input.netAssets, '순자산액'), cap = num(input.capital, '자본금');
    var cr = num(input.capitalReserve, '자본준비금', { optional: true }), er = num(input.earnedReserve, '이익준비금', { optional: true });
    var un = num(input.unrealized, '미실현이익', { optional: true });
    var div = blank(input.dividend) ? null : num(input.dividend, '계획 현금배당');
    var tr = blank(input.treasury) ? null : num(input.treasury, '계획 자기주식 취득가액');
    if (errors.length) { r.status = 'INVALID'; return r; }
    var base = na - cap - cr - er - un;
    r.rawBase = r2(base);
    r.baseAmount = r2(Math.max(0, base));
    var room = Math.max(0, cap / 2 - er); // 이익준비금 추가 적립 여지 (§458)
    r.reserveRoom = r2(room);
    // 현금배당 D: D ≤ base − min(D/10, room)
    var maxD = base <= 0 ? 0 : (base / 1.1 / 10 <= room ? base / 1.1 : base - room);
    r.maxCashDividend = r2(Math.max(0, Math.floor(maxD * 100 + 1e-6) / 100));
    r.treasuryLimit = r.baseAmount;
    if (div !== null) {
      r.reserveToSet = r2(Math.min(div / 10, room));
      r.dividendLimit = r2(Math.max(0, base - r.reserveToSet));
      r.dividendOk = div <= r.dividendLimit + 1e-9;
    }
    if (tr !== null) r.treasuryOk = tr <= r.treasuryLimit + 1e-9;
    r.basis.push('「상법」 제462조제1항 — 배당가능이익 = 순자산액 − 자본금 − 적립된 자본준비금·이익준비금 − 이번 결산기에 적립할 이익준비금 − 미실현이익');
    r.basis.push('「상법」 제458조 — 자본금의 1/2이 될 때까지 현금배당액의 1/10 이상을 이익준비금으로 적립 (추가 적립 여지 ' + r.reserveRoom.toLocaleString('ko-KR') + ')');
    r.basis.push('「상법」 제341조제1항 — 자기주식 취득가액 총액은 직전 결산기 대차대조표 순자산액에서 제462조제1항 각 호의 금액을 뺀 금액 이내');
    r.basis.push('「상법 시행령」 제19조 — 미실현이익은 회계기준에 따른 자산·부채 평가로 증가한 순자산액(미실현손실과 상계하지 않은 금액)');
    if (base < 0) r.notes.push('순자산액이 자본금과 법정준비금 합계보다 적습니다(자본잠식 포함). 이익배당과 배당가능이익 범위의 자기주식 취득을 할 수 없습니다.');
    r.notes.push('자기주식은 거래소 취득 또는 주주 평등 방법으로만, 미리 주주총회(정관에 정하면 이사회) 결의를 거쳐 취득합니다(제341조제1항·제2항). 결산기에 배당가능이익이 부족할 우려가 있으면 취득할 수 없고, 부족하면 이사가 배상 책임을 집니다(제3항·제4항).');
    r.notes.push('중간배당(제462조의3)·주식배당·현물배당과 상환주식 상환은 따로 검토가 필요합니다. 순자산과 준비금은 같은 결산기 재무상태표 금액으로 넣어 주세요.');
    r.status = r.baseAmount > 0 ? 'AVAILABLE' : 'NONE';
    return r;
  }

  // ── 가산세 (원) ──
  function parseDate(s) {
    if (blank(s)) return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));
    if (!m) return NaN;
    return Date.UTC(+m[1], +m[2] - 1, +m[3]);
  }
  function addMonths(t, k) {
    var d = new Date(t), y = d.getUTCFullYear(), mo = d.getUTCMonth() + k, day = d.getUTCDate();
    var last = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
    return Date.UTC(y, mo, Math.min(day, last));
  }
  var DAY = 86400000;
  var LATE_FILE = [[1, 50], [3, 30], [6, 20]];                         // §48②2 기한 후 신고 (무신고가산세)
  var AMEND = [[1, 90], [3, 75], [6, 50], [12, 30], [18, 20], [24, 10]]; // §48②1 수정신고 (과소신고가산세)

  /**
   * @param input kind 'none'(무신고)|'under'(과소신고), tax(무신고·과소신고 납부세액), fraud(무신고가 부정행위), fraudTax(과소신고 중 부정행위분),
   *              offshore(역외거래 부정), bookkeeper(법인·복식부기의무자), revenue(수입금액), fraudRevenue(부정 과소신고 수입금액), zeroRateBase(부가세 영세율 과세표준),
   *              deadline(법정신고·납부기한 YYYY-MM-DD), filedOn(기한 후·수정 신고일), noticed(경정할 것을 미리 알고 신고), unpaid(미납세액), paidOn(납부일)
   */
  function penalty(input) {
    input = input || {};
    var errors = [], num = reader(errors);
    var r = { version: VERSION, status: null, errors: errors, notes: [], basis: [] };
    var under = input.kind === 'under';
    var tax = num(input.tax, under ? '과소신고 납부세액' : '무신고 납부세액', { optional: true });
    var fraudTax = under ? num(input.fraudTax, '부정행위 과소신고분', { optional: true }) : 0;
    var revenue = num(input.revenue, '수입금액', { optional: true }), fraudRev = num(input.fraudRevenue, '부정 과소신고 수입금액', { optional: true });
    var zr = num(input.zeroRateBase, '영세율 과세표준', { optional: true });
    var unpaid = num(input.unpaid, '미납세액', { optional: true });
    var dl = parseDate(input.deadline), filed = parseDate(input.filedOn), paid = parseDate(input.paidOn);
    if ([dl, filed, paid].some(function (x) { return x !== null && isNaN(x); })) errors.push('날짜는 YYYY-MM-DD 형식으로 입력해 주세요.');
    if (fraudTax > tax) errors.push('부정행위분이 과소신고 납부세액보다 클 수 없습니다.');
    if ((filed !== null || paid !== null || unpaid) && dl === null) errors.push('법정신고·납부기한을 입력해 주세요.');
    if (unpaid && paid === null) errors.push('미납세액이 있으면 실제 납부(예정)일을 입력해 주세요.');
    if (dl !== null && filed !== null && filed <= dl) errors.push('신고일은 법정신고기한 이후여야 합니다.');
    if (dl !== null && paid !== null && paid <= dl) errors.push('납부일은 법정납부기한 이후여야 합니다.');
    if (errors.length) { r.status = 'INVALID'; return r; }
    var hi = input.offshore ? 0.6 : 0.4;
    var base;
    if (!under) {
      base = Math.floor(tax * (input.fraud ? hi : 0.2));
      r.basis.push('「국세기본법」 제47조의2제1항 — 무신고 납부세액의 ' + (input.fraud ? (hi * 100) + '%(부정행위)' : '20%'));
      if (input.bookkeeper && revenue) {
        var byRev = Math.floor(revenue * (input.fraud ? 14 : 7) / 10000);
        if (byRev > base) base = byRev;
        r.basis.push('같은 조 제2항제1호 — 법인·복식부기의무자는 수입금액의 ' + (input.fraud ? '14' : '7') + '/10,000과 비교해 큰 금액');
      }
    } else {
      var gen = Math.floor((tax - fraudTax) * 0.1), fr = Math.floor(fraudTax * hi);
      if (fraudTax && input.bookkeeper && fraudRev) fr = Math.max(fr, Math.floor(fraudRev * 14 / 10000));
      base = fr + gen;
      r.basis.push('「국세기본법」 제47조의3제1항 — 과소신고 납부세액의 10%' + (fraudTax ? ', 부정행위분은 ' + (hi * 100) + '%' + (input.bookkeeper ? '(법인·복식부기의무자는 부정 과소신고 수입금액 14/10,000과 비교, 제2항제1호)' : '') : ''));
    }
    if (zr) { base += Math.floor(zr * 5 / 1000); r.basis.push('부가가치세 영세율 과세표준 무신고·과소신고 — 영세율 과세표준의 0.5% 가산 (제47조의2제2항제2호, 제47조의3제2항제2호)'); }
    r.basePenalty = base;
    // 감면 §48②
    r.reductionPct = 0;
    if (filed !== null && !input.noticed) {
      var tiers = under ? AMEND : LATE_FILE;
      for (var i = 0; i < tiers.length; i++) { if (filed <= addMonths(dl, tiers[i][0])) { r.reductionPct = tiers[i][1]; break; } }
      if (r.reductionPct) r.basis.push('「국세기본법」 제48조제2항제' + (under ? '1호 — 수정신고' : '2호 — 기한 후 신고') + ' 시기에 따라 ' + r.reductionPct + '% 감면');
    }
    if (filed !== null && input.noticed) r.notes.push('과세표준과 세액을 경정(결정)할 것을 미리 알고 신고하면 감면되지 않습니다.');
    r.filingPenalty = base - Math.floor(base * r.reductionPct / 100);
    // 납부지연 §47의4①1, 시행령 §27의4① 1일 22/100,000
    r.lateDays = 0; r.latePenalty = 0;
    if (unpaid && paid !== null) {
      r.lateDays = Math.max(0, Math.round((paid - dl) / DAY) - 1);
      r.latePenalty = Math.floor(unpaid * r.lateDays * 22 / 100000);
      r.basis.push('「국세기본법」 제47조의4제1항제1호, 같은 법 시행령 제27조의4제1항 — 미납세액 × 법정납부기한 다음 날부터 납부일 전날까지 ' + r.lateDays + '일 × 1일 0.022%');
    }
    r.total = r.filingPenalty + r.latePenalty;
    r.notes.push('기간은 법 문언("납부일의 전날까지")대로 셌습니다. 납부고지 후 지정납부기한까지 내지 않으면 3% 가산세와 월 0.67% 가산세가 따로 붙습니다(같은 항 제1호의2·제3호, 고지서별 150만원 미만은 월 가산세 제외).');
    r.notes.push('부정행위 해당 여부(같은 법 제26조의2 등), 원천징수납부지연가산세(제47조의5), 세법별 개별 가산세(지급명세서·세금계산서 등)는 반영하지 않았습니다. 정당한 사유가 있으면 가산세가 면제될 수 있습니다(제48조제1항).');
    r.status = r.total > 0 ? 'PENALTY' : 'NONE';
    return r;
  }

  var api = { reorg: reorg, distributable: distributable, penalty: penalty, VERSION: VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CorpLawRules = api;
})(this);
