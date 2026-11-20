/*
 * 인사·노무 4종 (순수 함수, 브라우저·Node 공용). 근거: docs/62 (법령 원문 2026-11-20 확인)
 *  annualLeave 연차 일수·연차수당 / minWage 주휴수당·최저임금 월급 환산
 *  unemploymentBenefit 실업급여(구직급여, 베타) / parentalLeave 육아휴직 급여
 * 금액 입력은 만원(시급은 원), 결과는 원.
 */
(function (root) {
  'use strict';
  var VERSION = '2026-11-20';
  var MAN = 10000;
  // 최저임금 고시: 2026년 제2025-47호 10,320원, 2027년 제2026-60호 10,700원
  var MIN_WAGE = { 2026: 10320, 2027: 10700 };
  var UB_CAP_BASE = 113500; // 고용보험법 시행령 제68조제1항 (2025-12-23 개정)
  function blank(v) { return v === undefined || v === null || v === ''; }
  function fl(x) { return Math.floor(x + 1e-6); }
  function reader(errors) {
    return function (v, label, opt) {
      opt = opt || {};
      if (blank(v)) { if (opt.optional) return opt.def !== undefined ? opt.def : 0; errors.push(label + '을(를) 입력해 주세요.'); return 0; }
      var x = Number(String(v).replace(/,/g, ''));
      if (!isFinite(x) || x < 0 || (opt.positive && x <= 0)) { errors.push(label + '은(는) ' + (opt.positive ? '0보다 큰' : '0 이상의') + ' 숫자로 입력해 주세요.'); return 0; }
      return x;
    };
  }
  function base() { return { version: VERSION, status: null, errors: [], notes: [], basis: [] }; }
  function parseDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    if (!m) return null;
    return { y: +m[1], m: +m[2], d: +m[3] };
  }
  function fmt(y, m, d) { return y + '-' + (m < 10 ? '0' : '') + m + '-' + (d < 10 ? '0' : '') + d; }

  // 1. 연차 일수·연차수당 (근로기준법 제60조, 입사일 기준)
  function annualLeave(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var h = parseDate(input.hireDate), b = parseDate(input.baseDate);
    if (!h) r.errors.push('입사일을 입력해 주세요.');
    if (!b) r.errors.push('기준일을 입력해 주세요.');
    var monthly = num(input.monthlyWage, '월 통상임금', { optional: true });
    var unused = num(input.unused, '쓰지 않은 연차 일수', { optional: true });
    var hours = num(input.dailyHours, '1일 소정근로시간', { optional: true, def: 8 }) || 8;
    if (h && b) {
      var months = (b.y - h.y) * 12 + (b.m - h.m) - (b.d < h.d ? 1 : 0);
      if (months < 0) r.errors.push('기준일이 입사일보다 빠릅니다.');
    }
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    var years = Math.floor(months / 12);
    r.monthsWorked = months;
    r.yearsWorked = years;
    r.firstYearDays = Math.min(months, 11);
    r.schedule = [{ label: '입사 첫 1년 (1개월 개근마다 1일)', date: fmt(h.y, h.m, h.d), days: r.firstYearDays }];
    var total = r.firstYearDays;
    for (var k = 1; k <= years; k++) {
      var days = Math.min(25, 15 + Math.floor((k - 1) / 2));
      total += days;
      r.schedule.push({ label: k + '년 근속', date: fmt(h.y + k, h.m, h.d), days: days });
    }
    r.currentDays = years >= 1 ? Math.min(25, 15 + Math.floor((years - 1) / 2)) : r.firstYearDays;
    r.totalToDate = total;
    r.nextGrantDate = fmt(h.y + years + 1, h.m, h.d);
    r.nextGrantDays = Math.min(25, 15 + Math.floor(years / 2));
    if (monthly > 0) {
      r.dailyWage = Math.round(monthly * MAN * hours / 209);
      r.unusedPay = Math.round(monthly * MAN * hours * unused / 209);
    }
    r.status = 'OK';
    r.basis.push('「근로기준법」 제60조제1항(1년 80% 이상 출근 15일)·제2항(1년 미만 1개월 개근 1일)·제4항(3년 이상 최초 1년 초과 매 2년 1일 가산, 25일 한도)·제7항(1년 미사용 시 소멸)');
    r.basis.push('「근로기준법」 제18조제3항: 4주 평균 1주 소정근로시간 15시간 미만이면 연차 규정 미적용');
    r.notes.push('입사일 기준으로 계산했습니다. 회계연도(1월 1일) 기준으로 운영하는 회사는 입사 연도 비례 부여 방식이 달라 일수가 다를 수 있으나, 퇴사 때는 입사일 기준보다 적게 줄 수 없습니다.');
    r.notes.push('1년간 출근율이 80% 미만이면 그 해는 15일 대신 1개월 개근마다 1일입니다. 업무상 재해·출산휴가·육아휴직 기간은 출근한 것으로 봅니다(제60조제6항).');
    if (monthly > 0) r.notes.push('연차수당 일급은 월 통상임금 ÷ 209시간 × 1일 소정근로시간으로 계산했습니다(주 40시간 기준). 취업규칙에서 평균임금으로 정했다면 금액이 달라집니다.');
    return r;
  }

  // 2. 주휴수당·최저임금 월급 환산 (근로기준법 제55조·제18조제3항, 최저임금 고시)
  function minWage(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var year = Number(input.year) || 2026;
    var w = num(input.weeklyHours, '1주 소정근로시간', { positive: true });
    var hourly = num(input.hourly, '시급', { optional: true });
    var pay = num(input.monthlyPay, '실제 월급', { optional: true });
    if (w > 52) r.errors.push('1주 소정근로시간은 52시간 이하로 입력해 주세요.');
    if (!MIN_WAGE[year]) r.errors.push('2026년 또는 2027년을 선택해 주세요.');
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    r.year = year;
    r.minHourly = MIN_WAGE[year];
    r.hourly = hourly > 0 ? hourly : r.minHourly;
    var wk = Math.min(w, 40);
    r.holidayHours = w < 15 ? 0 : wk / 40 * 8;
    r.weeklyHolidayPay = Math.round(r.hourly * r.holidayHours);
    r.weeklyPay = Math.round(r.hourly * (wk + r.holidayHours));
    r.monthHours = Math.round((wk + r.holidayHours) * 365 / 12 / 7);
    r.monthlyPay = r.hourly * r.monthHours;
    r.minMonthly = r.minHourly * r.monthHours;
    r.belowMinHourly = r.hourly < r.minHourly;
    if (pay > 0) {
      r.actualPay = Math.round(pay * MAN);
      r.actualHourly = Math.floor(r.actualPay / r.monthHours);
      r.belowMin = r.actualPay < r.minMonthly;
      r.shortfall = Math.max(0, r.minMonthly - r.actualPay);
    }
    r.status = 'OK';
    r.basis.push(year + '년 적용 최저임금 고시(고용노동부 ' + (year === 2026 ? '제2025-47호' : '제2026-60호') + '): 시간급 ' + r.minHourly.toLocaleString('ko-KR') + '원');
    r.basis.push('「근로기준법」 제55조제1항(1주 평균 1회 이상 유급휴일), 제18조제3항(4주 평균 1주 15시간 미만이면 주휴 미적용)');
    r.notes.push('주휴시간은 1주 소정근로시간 ÷ 40 × 8시간(최대 8시간)으로 계산했습니다. 고용노동부 행정해석에 따른 방식이며 법 조문에 산식이 있는 것은 아닙니다.');
    r.notes.push('월 환산 시간은 (1주 소정근로시간 + 주휴시간) × 365 ÷ 12 ÷ 7을 반올림했습니다(주 40시간이면 209시간). 주휴수당은 그 주의 소정근로일을 개근해야 생깁니다.');
    if (w > 40) r.notes.push('40시간을 넘는 시간은 연장근로(통상임금의 50% 가산)라 이 계산에 넣지 않았습니다.');
    return r;
  }

  // 3. 실업급여(구직급여) (고용보험법 제45조·제46조·제50조, 시행령 제68조)
  var UB_DAYS = [[120, 150, 180, 210, 240], [120, 180, 210, 240, 270]];
  function unemploymentBenefit(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var wage3 = num(input.wage3, '퇴직 전 3개월 임금 총액', { positive: true });
    var days3 = num(input.days3, '그 3개월의 총일수', { optional: true, def: 92 }) || 92;
    var age = num(input.age, '이직일 당시 나이', { positive: true });
    var yrs = num(input.insuredYears, '고용보험 가입기간', { optional: true });
    var hours = num(input.dailyHours, '1일 소정근로시간', { optional: true, def: 8 }) || 8;
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    var avg = fl(wage3 * MAN / days3);
    r.avgDaily = avg;
    r.minBase = Math.round(hours * MIN_WAGE[2026]);
    var b = avg;
    if (b > UB_CAP_BASE) { b = UB_CAP_BASE; r.capped = true; }
    if (b < r.minBase) { b = r.minBase; r.floored = true; }
    r.baseDaily = b;
    r.minDaily = fl(r.minBase * 0.8);
    var d = fl(b * 0.6);
    if (d < r.minDaily) { d = r.minDaily; r.atMinimum = true; }
    r.daily = d;
    var col = yrs < 1 ? 0 : yrs < 3 ? 1 : yrs < 5 ? 2 : yrs < 10 ? 3 : 4;
    r.senior = age >= 50 || !!input.disabled;
    r.days = UB_DAYS[r.senior ? 1 : 0][col];
    r.total = r.daily * r.days;
    r.status = 'OK';
    r.basis.push('「고용보험법」 제45조(기초일액 = 이직 전 평균임금, 최저기초일액 = 1일 소정근로시간 × 최저임금), 제46조(구직급여일액 = 기초일액 × 60%, 최저 = 최저기초일액 × 80%), 제50조(소정급여일수)');
    r.basis.push('「고용보험법 시행령」 제68조제1항: 기초일액 상한 113,500원 → 구직급여일액 상한 68,100원');
    r.notes.push('소정급여일수(별표 1)는 법령 원문 별표를 직접 대조하지 못해 고용노동부 안내 기준으로 넣었습니다(베타).');
    r.notes.push('이직일이 2026년이라고 보고 2026년 최저임금(10,320원)으로 하한을 계산했습니다. 자발적 퇴사 등 수급자격 제한 사유, 가입기간 180일(이직 전 18개월 중) 요건은 따로 확인해야 합니다.');
    return r;
  }

  // 4. 육아휴직 급여 (고용보험법 제70조, 시행령 제95조)
  function parentalLeave(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var w = num(input.monthlyWage, '월 통상임금', { positive: true });
    var m = num(input.months, '육아휴직 개월 수', { positive: true });
    if (m > 12) r.errors.push('개월 수는 12개월 이하로 입력해 주세요.');
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    m = Math.floor(m);
    var wage = Math.round(w * MAN);
    r.rows = [];
    var total = 0;
    function clamp(x, hi) { return Math.min(Math.max(x, 700000), hi); }
    for (var i = 1; i <= m; i++) {
      var amt = i <= 3 ? clamp(wage, 2500000) : i <= 6 ? clamp(wage, 2000000) : clamp(fl(wage * 0.8), 1600000);
      total += amt;
      r.rows.push(amt);
    }
    r.first3 = r.rows.slice(0, 3).reduce(function (a, b) { return a + b; }, 0);
    r.total = total;
    r.monthlyAvg = Math.round(total / m);
    r.status = 'OK';
    r.basis.push('「고용보험법 시행령」 제95조제1항: 1~3개월 월 통상임금(상한 250만원), 4~6개월 월 통상임금(상한 200만원), 7개월부터 월 통상임금의 80%(상한 160만원), 하한 70만원');
    r.basis.push('「소득세법」 제12조제3호마목: 육아휴직 급여는 비과세');
    r.notes.push('부모가 함께 쓰는 경우의 특례(6+6 부모육아휴직제), 육아휴직 기간 연장, 한 달을 채우지 못한 달의 일할 계산은 반영하지 않았습니다.');
    return r;
  }

  var api = { annualLeave: annualLeave, minWage: minWage, unemploymentBenefit: unemploymentBenefit, parentalLeave: parentalLeave, MIN_WAGE: MIN_WAGE, VERSION: VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LaborRules = api;
})(this);
