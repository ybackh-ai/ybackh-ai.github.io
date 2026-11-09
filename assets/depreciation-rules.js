/*
 * 감가상각 세법 상각범위액 계산 로직 (순수 함수, 브라우저·Node 공용). 근거: docs/35_감가상각_로직.md
 * 「법인세법 시행령」 제26조(상각방법·잔존가액·비망가액·월할), 제28조(내용연수), 「법인세법 시행규칙」 별표4(상각률), 별표5(건축물 등 기준내용연수)
 * 2026-11-09 법제처 현행 확인.
 */
(function (root) {
  'use strict';
  var VERSION = '2026-11-09';
  // 별표4 상각률 (내용연수 → [정액, 정률]) 2~60년
  var RATES = {
    2: [0.500, 0.777], 3: [0.333, 0.632], 4: [0.250, 0.528], 5: [0.200, 0.451], 6: [0.166, 0.394], 7: [0.142, 0.349], 8: [0.125, 0.313], 9: [0.111, 0.284], 10: [0.100, 0.259],
    11: [0.090, 0.239], 12: [0.083, 0.221], 13: [0.076, 0.206], 14: [0.071, 0.193], 15: [0.066, 0.182], 16: [0.062, 0.171], 17: [0.058, 0.162], 18: [0.055, 0.154], 19: [0.052, 0.146], 20: [0.050, 0.140],
    21: [0.048, 0.133], 22: [0.046, 0.128], 23: [0.044, 0.123], 24: [0.042, 0.118], 25: [0.040, 0.113], 26: [0.039, 0.109], 27: [0.037, 0.106], 28: [0.036, 0.102], 29: [0.035, 0.099], 30: [0.034, 0.096],
    31: [0.033, 0.093], 32: [0.032, 0.090], 33: [0.031, 0.087], 34: [0.030, 0.085], 35: [0.029, 0.083], 36: [0.028, 0.080], 37: [0.027, 0.078], 38: [0.027, 0.076], 39: [0.026, 0.074], 40: [0.025, 0.073],
    41: [0.025, 0.071], 42: [0.024, 0.069], 43: [0.024, 0.068], 44: [0.023, 0.066], 45: [0.023, 0.065], 46: [0.022, 0.064], 47: [0.022, 0.062], 48: [0.021, 0.061], 49: [0.021, 0.060], 50: [0.020, 0.059],
    51: [0.020, 0.058], 52: [0.020, 0.056], 53: [0.019, 0.055], 54: [0.019, 0.054], 55: [0.019, 0.054], 56: [0.018, 0.053], 57: [0.018, 0.052], 58: [0.018, 0.051], 59: [0.017, 0.050], 60: [0.017, 0.049]
  };
  // 별표5 기준내용연수·범위. building=true 이면 정액법만(영 §26①1)
  var CATEGORIES = {
    vehicle: { label: '차량운반구·공구·기구·금형·비품', base: 5, min: 4, max: 6, building: false },
    ship: { label: '선박·항공기', base: 12, min: 9, max: 15, building: false },
    lightBuilding: { label: '연와조·블록조·콘크리트조·목조 등 건물·구축물', base: 20, min: 15, max: 25, building: true },
    rcBuilding: { label: '철골·철근콘크리트조·석조 등 건물·구축물', base: 40, min: 30, max: 50, building: true },
    lightFactory: { label: '공장·창고 등(연와조 등) — 별표5 비고3', base: 10, min: 8, max: 12, building: true },
    rcFactory: { label: '공장·창고 등(철근콘크리트조 등) — 별표5 비고3', base: 20, min: 15, max: 25, building: true },
    other: { label: '업종별 자산(별표6, 기계장치 등) — 범위 직접 확인', base: null, min: 2, max: 60, building: false }
  };
  function blank(v) { return v === undefined || v === null || v === ''; }

  /**
   * @param input cost(취득가액, 원), method 'sl'|'db', life(내용연수, 년), category(CATEGORIES 키),
   *              firstMonths(첫 사업연도 사용 개월 수 1~12, 기본 12), bookDep(첫해 회사 장부 감가상각비, 선택)
   */
  function calculate(input) {
    input = input || {};
    var errors = [];
    var r = { version: VERSION, status: null, errors: errors, notes: [], basis: [], schedule: [] };
    var cost = Number(input.cost), life = Number(input.life);
    var method = input.method === 'db' ? 'db' : input.method === 'sl' ? 'sl' : null;
    var cat = CATEGORIES[input.category] || null;
    var months = blank(input.firstMonths) ? 12 : Number(input.firstMonths);
    if (!isFinite(cost) || cost <= 0 || Math.floor(cost) !== cost) errors.push('취득가액을 1원 이상의 정수로 입력해 주세요.');
    if (!method) errors.push('상각방법(정액법·정률법)을 선택해 주세요.');
    if (!cat) errors.push('자산 구분을 선택해 주세요.');
    if (!isFinite(life) || Math.floor(life) !== life || !RATES[life]) errors.push('내용연수는 상각률표(별표4)의 2~60년 사이 정수로 입력해 주세요.');
    if (!isFinite(months) || months < 1 || months > 12 || Math.floor(months) !== months) errors.push('첫 사업연도 사용 개월 수는 1~12 사이 정수로 입력해 주세요.');
    if (cat && cat.building && method === 'db') errors.push('건축물은 정액법만 쓸 수 있습니다(법인세법 시행령 제26조제1항제1호).');
    if (cat && cat.base !== null && RATES[life] && (life < cat.min || life > cat.max)) errors.push(cat.label + '의 내용연수 범위는 ' + cat.min + '~' + cat.max + '년(기준 ' + cat.base + '년)입니다.');
    var bookDep = blank(input.bookDep) ? null : Number(input.bookDep);
    if (bookDep !== null && (!isFinite(bookDep) || bookDep < 0)) errors.push('장부 감가상각비는 0 이상 숫자로 입력해 주세요.');
    if (errors.length) { r.status = 'INVALID'; return r; }

    var rate = RATES[life][method === 'sl' ? 0 : 1];
    var memo = Math.min(Math.floor(cost * 0.05), 1000);   // 영 §26⑦ 비망가액
    var residual5 = cost * 0.05;                           // 영 §26⑥ 정률법 잔존가액
    var nbv = cost, year = 0, sched = [];
    while (nbv > memo && year < 200) {
      year++;
      var factor = year === 1 ? months / 12 : 1;
      // 부동소수 오차(예: 0.313 × 1천만 = 3,129,999.9999…) 때문에 아주 작은 값을 더한 뒤 버림
      var dep = method === 'sl' ? Math.floor(cost * rate * factor + 1e-6) : Math.floor(nbv * rate * factor + 1e-6);
      if (method === 'db' && nbv - dep <= residual5) dep = nbv - memo;   // 잔액이 처음 5% 이하가 되는 해에 잔존가액 가산
      if (nbv - dep < memo) dep = nbv - memo;
      if (dep <= 0) break;
      nbv -= dep;
      sched.push({ year: year, months: year === 1 ? months : 12, dep: dep, nbv: nbv });
    }

    r.rate = rate;
    r.memoValue = memo;
    r.schedule = sched;
    r.rangeChecked = cat.base !== null;
    r.categoryLabel = cat.label;
    r.firstYearLimit = sched.length ? sched[0].dep : 0;
    if (bookDep !== null) {
      r.bookDep = bookDep;
      r.excess = Math.max(0, bookDep - r.firstYearLimit);
      r.shortfall = Math.max(0, r.firstYearLimit - bookDep);
    }
    r.status = 'OK';

    r.basis.push('상각방법: 건축물·무형자산은 정액법, 그 밖의 유형자산은 정률법 또는 정액법 중 신고한 방법(신고하지 않으면 정률법)으로 계산합니다(「법인세법 시행령」 제26조제1항·제4항).');
    r.basis.push('상각률: 「법인세법 시행규칙」 별표4 — 내용연수 ' + life + '년의 ' + (method === 'sl' ? '정액법' : '정률법') + ' 상각률 ' + rate.toFixed(3) + '.');
    r.basis.push('잔존가액은 0(정률법은 취득가액의 5%를 잔액이 처음 5% 이하가 되는 해에 가산), 상각이 끝나면 취득가액의 5%와 1천원 중 적은 금액을 비망가액으로 남깁니다(같은 영 제26조제6항·제7항).');
    r.basis.push('사업연도 중 취득한 자산은 사용한 날부터 사업연도 종료일까지 월수로 계산하고, 1월 미만은 1월로 봅니다(같은 영 제26조제9항).');
    if (cat.base !== null) r.basis.push('내용연수: 「법인세법 시행규칙」 별표5 — ' + cat.label + ' 기준내용연수 ' + cat.base + '년, 범위 ' + cat.min + '~' + cat.max + '년(같은 영 제28조제1항제2호, 신고하지 않으면 기준내용연수).');
    else r.notes.push('업종별 자산(기계장치 등)의 기준내용연수는 「법인세법 시행규칙」 별표6에서 업종별로 정합니다. 이 계산기는 입력한 내용연수를 그대로 쓰며 범위를 검사하지 않습니다.');
    if (bookDep !== null && r.excess > 0) r.notes.push('회사 장부의 감가상각비가 세법 상각범위액보다 ' + r.excess.toLocaleString('ko-KR') + '원 많습니다. 초과분은 손금불산입(유보)하고 이후 시인부족액이 생기면 그 범위에서 손금으로 추인합니다.');
    if (bookDep !== null && r.shortfall > 0) r.notes.push('장부 감가상각비가 상각범위액보다 적어 ' + r.shortfall.toLocaleString('ko-KR') + '원의 시인부족이 생깁니다. 법인세법상 감가상각은 결산 때 비용으로 계상한 범위에서만 손금이 되므로(결산조정), 부족분을 신고서에서 추가로 손금에 넣을 수는 없습니다(전기 이전 상각부인액이 있으면 그 범위에서 추인).');
    r.notes.push('원 미만은 버렸습니다(근거 조문 확인하지 않음 — 확실하지 않음). 업무용 승용차, 즉시상각 의제, 자본적 지출, 내용연수 특례·변경 승인은 반영하지 않았습니다.');
    r.notes.push('회계상 감가상각(K-IFRS·일반기업회계기준)은 경제적 내용연수와 잔존가치를 회사가 추정해 정하므로 세법 금액과 다를 수 있습니다.');
    return r;
  }

  var api = { calculate: calculate, RATES: RATES, CATEGORIES: CATEGORIES, VERSION: VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DepreciationRules = api;
})(this);
