/*
 * 인사·노무 추가 7종 (순수 함수, 브라우저·Node 공용). 근거: docs/64 (법령 원문 2026-11-20 확인)
 *  overtimePay 연장·야간·휴일수당 / hourlyWage 월급→시급·통상임금 / dismissalNotice 해고예고수당
 *  maternityLeave 출산전후휴가 급여 / shutdownAllowance 휴업수당 / dcPension 퇴직연금 DC 부담금 / workHours 주 52시간 점검
 * 금액 입력은 만원(시급은 원), 결과는 원. 최저임금은 labor-rules.js(MIN_WAGE)가 단일 출처 — 페이지에서 먼저 불러야 함.
 */
(function (root) {
  'use strict';
  var VERSION = '2026-11-20';
  var MAN = 10000;
  var LR = (typeof module !== 'undefined' && module.exports) ? require('./labor-rules.js') : root.LaborRules;
  // 출산전후휴가 급여등 상한액 고시(고용노동부 제2026-67호, 2026-09-18 시행, 2026-12-31까지 유효)
  var MAT = { single: { days: 90, paid: 60, cap: 6600000 }, premature: { days: 100, paid: 60, cap: 7333330 }, multiple: { days: 120, paid: 75, cap: 8800000 } };
  function blank(v) { return v === undefined || v === null || v === ''; }
  function fl(x) { return Math.floor(x + 1e-6); }
  function yes(v) { return v === true || v === 'true' || v === 'on' || v === 'yes' || v === 1 || v === '1'; }
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
    return { y: +m[1], m: +m[2], d: +m[3], t: Date.UTC(+m[1], +m[2] - 1, +m[3]) };
  }
  // 월 통상임금 산정 기준시간 (근로기준법 시행령 제6조제2항제4호): (1주 소정 + 주휴) × 365 ÷ 7 ÷ 12, 반올림(주 40시간 → 209)
  function monthHours(w) {
    var wk = Math.min(w, 40);
    var hol = w < 15 ? 0 : wk / 40 * 8;
    return Math.round((wk + hol) * 365 / 7 / 12);
  }

  // 1. 연장·야간·휴일수당 (근로기준법 제56조)
  function overtimePay(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var hourly = num(input.hourly, '통상 시급', { optional: true });
    var monthly = num(input.monthlyWage, '월 통상임금', { optional: true });
    var w = num(input.weeklyHours, '1주 소정근로시간', { optional: true, def: 40 }) || 40;
    var ot = num(input.overtimeHours, '연장근로 시간', { optional: true });
    var night = num(input.nightHours, '야간근로 시간', { optional: true });
    var hol8 = num(input.holidayHours, '휴일근로 시간(8시간 이내)', { optional: true });
    var holOver = num(input.holidayOverHours, '휴일근로 시간(8시간 초과분)', { optional: true });
    if (!(hourly > 0) && !(monthly > 0)) r.errors.push('통상 시급 또는 월 통상임금을 입력해 주세요.');
    if (ot + night + hol8 + holOver <= 0) r.errors.push('연장·야간·휴일근로 시간 중 하나 이상을 입력해 주세요.');
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    r.small = yes(input.under5);
    r.monthHours = monthHours(w);
    r.hourly = hourly > 0 ? Math.round(hourly) : fl(monthly * MAN / r.monthHours);
    var p = r.small ? 0 : 0.5;
    r.overtimePay = Math.round(r.hourly * ot * (1 + p));
    r.nightPremium = Math.round(r.hourly * night * p);
    r.holidayPay = Math.round(r.hourly * hol8 * (1 + p)) + Math.round(r.hourly * holOver * (r.small ? 1 : 2));
    r.premiumOnly = Math.round(r.hourly * (ot * p + night * p + hol8 * p + holOver * (r.small ? 0 : 1)));
    r.total = r.overtimePay + r.nightPremium + r.holidayPay;
    r.status = 'OK';
    r.basis.push('「근로기준법」 제56조제1항(연장근로 통상임금 50% 이상 가산), 제2항(휴일근로 8시간 이내 50%·8시간 초과 100%), 제3항(오후 10시~오전 6시 야간근로 50%)');
    r.basis.push('「근로기준법 시행령」 제6조제2항제4호(월급 → 시간급: 월 통상임금 산정 기준시간으로 나눔), 제7조 별표 1(상시 4명 이하 사업장은 제56조 미적용)');
    r.notes.push('야간 시간은 연장·휴일 시간과 겹쳐도 따로 50%를 더합니다. 그래서 야간 칸에는 가산분(50%)만 계산했습니다. 낮 근무 중 야간에 걸친 소정근로라면 기본급은 이미 월급에 들어 있습니다.');
    if (r.small) r.notes.push('상시 4명 이하 사업장은 가산 규정이 적용되지 않아, 일한 시간만큼의 통상임금(1배)만 계산했습니다. 야간 가산은 0원입니다.');
    if (!(hourly > 0)) r.notes.push('월 통상임금을 월 ' + r.monthHours + '시간으로 나눠 시급을 구했습니다. 통상임금에 넣을 수당(정기·일률 지급)이 빠졌다면 더해서 넣어야 합니다.');
    return r;
  }

  // 2. 월급 → 시급·통상임금 환산 (근로기준법 시행령 제6조)
  function hourlyWage(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var monthly = num(input.monthlyWage, '월 기본급', { positive: true });
    var allow = num(input.allowance, '통상임금에 들어가는 고정 수당', { optional: true });
    var w = num(input.weeklyHours, '1주 소정근로시간', { optional: true, def: 40 }) || 40;
    var dh = num(input.dailyHours, '1일 소정근로시간', { optional: true, def: 8 }) || 8;
    var year = Number(input.year) || 2026;
    if (w > 52) r.errors.push('1주 소정근로시간은 52시간 이하로 입력해 주세요.');
    if (!LR || !LR.MIN_WAGE[year]) r.errors.push('2026년 또는 2027년을 선택해 주세요.');
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    r.monthHours = monthHours(w);
    r.monthlyTotal = Math.round((monthly + allow) * MAN);
    r.hourly = fl(r.monthlyTotal / r.monthHours);
    r.daily = r.hourly * dh;
    r.basicHourly = fl(monthly * MAN / r.monthHours);
    r.year = year;
    r.minHourly = LR.MIN_WAGE[year];
    r.belowMin = r.basicHourly < r.minHourly;
    r.minMonthly = r.minHourly * r.monthHours;
    r.status = 'OK';
    r.basis.push('「근로기준법 시행령」 제6조제1항(통상임금 = 정기적·일률적으로 소정근로에 지급하기로 정한 금액), 제2항제4호(월급 ÷ 월 통상임금 산정 기준시간), 제3항(일급 = 시간급 × 1일 소정근로시간)');
    r.basis.push(year + '년 최저임금 시간급 ' + r.minHourly.toLocaleString('ko-KR') + '원 (labor-rules.js와 같은 고시)');
    r.notes.push('월 기준시간은 (1주 소정근로시간 + 주휴시간) × 365 ÷ 7 ÷ 12를 반올림했습니다(주 40시간이면 209시간). 주휴시간은 1주 소정근로시간 ÷ 40 × 8시간입니다.');
    r.notes.push('최저임금 비교는 기본급만으로 했습니다. 실제 최저임금 산입 범위(정기상여금·복리후생비 일부 포함)는 최저임금법 제6조에 따라 달라질 수 있습니다.');
    return r;
  }

  // 3. 해고예고수당 (근로기준법 제26조)
  function dismissalNotice(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var h = parseDate(input.hireDate), d = parseDate(input.dismissDate), n = parseDate(input.noticeDate);
    if (!h) r.errors.push('입사일을 입력해 주세요.');
    if (!d) r.errors.push('해고일을 입력해 주세요.');
    var monthly = num(input.monthlyWage, '월 통상임금', { positive: true });
    var w = num(input.weeklyHours, '1주 소정근로시간', { optional: true, def: 40 }) || 40;
    var dh = num(input.dailyHours, '1일 소정근로시간', { optional: true, def: 8 }) || 8;
    if (h && d && d.t < h.t) r.errors.push('해고일이 입사일보다 빠릅니다.');
    if (n && d && n.t > d.t) r.errors.push('예고한 날이 해고일보다 늦습니다.');
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    var months = (d.y - h.y) * 12 + (d.m - h.m) - (d.d < h.d ? 1 : 0);
    r.monthsWorked = months;
    r.noticeDays = n ? Math.round((d.t - n.t) / 86400000) : 0;
    r.monthHours = monthHours(w);
    r.hourly = fl(monthly * MAN / r.monthHours);
    r.daily = r.hourly * dh;
    r.exempt = months < 3 || yes(input.exception);
    r.needPay = !r.exempt && r.noticeDays < 30;
    r.pay = r.needPay ? r.daily * 30 : 0;
    r.status = r.needPay ? 'PAY' : 'NONE';
    r.basis.push('「근로기준법」 제26조: 해고하려면 30일 전에 예고하고, 하지 않으면 30일분 이상의 통상임금 지급. 계속근로 3개월 미만, 천재·사변 등으로 사업 계속 불가, 고의로 막대한 손해(고용노동부령 사유)는 예외');
    r.basis.push('「근로기준법 시행령」 제6조(통상임금 일급 = 시간급 × 1일 소정근로시간), 제7조 별표 1(상시 4명 이하 사업장에도 제26조 적용)');
    if (r.needPay && r.noticeDays > 0) r.notes.push('예고 기간이 30일에 못 미치면(이 경우 ' + r.noticeDays + '일) 모자란 날만큼이 아니라 30일분 전액을 기준으로 계산했습니다.');
    if (months < 3) r.notes.push('계속근로 기간이 3개월 미만이라 해고예고 규정의 예외입니다.');
    r.notes.push('해고예고수당은 해고 절차에 관한 것이고, 해고가 정당한지(제23조 정당한 이유, 제27조 서면 통지)는 따로 따져야 합니다.');
    return r;
  }

  // 4. 출산전후휴가 급여 (근로기준법 제74조, 고용보험법 제76조, 상한액 고시 제2026-67호)
  function maternityLeave(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var monthly = num(input.monthlyWage, '월 통상임금', { positive: true });
    var type = MAT[input.type] ? input.type : 'single';
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    var t = MAT[type];
    r.type = type;
    r.leaveDays = t.days;
    r.paidDays = t.paid;
    r.priority = input.priority === undefined ? true : yes(input.priority);
    var wage = Math.round(monthly * MAN);
    var floorMonthly = LR.MIN_WAGE[2026] * 209;
    r.floored = wage < floorMonthly;
    var dailyWage = Math.max(wage, floorMonthly) / 30;
    var capDaily = t.cap / t.days;
    var insDays = r.priority ? t.days : t.days - t.paid;
    r.insuranceDays = insDays;
    r.insurance = fl(Math.min(dailyWage, capDaily) * insDays);
    r.dailyWage = fl(wage / 30);
    var full = wage / 30 * t.paid;
    var insInPaid = r.priority ? Math.min(dailyWage, capDaily) * t.paid : 0;
    r.employer = fl(Math.max(0, full - insInPaid));
    r.total = r.insurance + r.employer;
    r.status = 'OK';
    r.basis.push('「근로기준법」 제74조제1항(90일·미숙아 100일·다태아 120일), 제4항(최초 60일·다태아 75일 유급, 출산전후휴가급여가 나오면 그 금액만큼 사업주 지급 책임 면제)');
    r.basis.push('「고용보험법」 제76조제1항제1호(우선지원 대상기업은 휴가 전 기간, 그 밖은 60일·75일 초과분), 「출산전후휴가 급여등 상한액 고시」(고용노동부 제2026-67호: 90일 660만원·100일 7,333,330원·120일 880만원, 2026-12-31까지)');
    r.notes.push('월 통상임금을 30일분으로 보고 일할 계산했습니다. 실제 고용센터 계산(휴가 시작일 기준 통상임금)과 몇 원 차이가 날 수 있습니다.');
    r.notes.push(r.priority ? '우선지원 대상기업이라 고용보험이 휴가 전 기간을 상한까지 지급하고, 회사는 유급 기간(' + t.paid + '일) 중 통상임금과 급여의 차액을 지급합니다.' : '우선지원 대상기업이 아니라 처음 ' + t.paid + '일은 회사가 통상임금 전액을 지급하고, 고용보험은 나머지 ' + insDays + '일분만 지급합니다.');
    if (r.floored) r.notes.push('통상임금이 최저임금 월 환산액(2026년 2,156,880원)보다 적어 하한(고용보험법 시행령 제101조제2호)을 적용했습니다.');
    r.notes.push('2027년 상한액은 새 고시가 나오면 바뀔 수 있습니다. 고용보험 가입기간 180일 이상 등 수급 요건은 따로 확인해야 합니다.');
    return r;
  }

  // 5. 휴업수당 (근로기준법 제46조)
  function shutdownAllowance(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var wage3 = num(input.wage3, '휴업 전 3개월 임금 총액', { positive: true });
    var days3 = num(input.days3, '그 3개월의 총일수', { optional: true, def: 92 }) || 92;
    var monthly = num(input.monthlyWage, '월 통상임금', { optional: true });
    var days = num(input.shutdownDays, '휴업 일수', { positive: true });
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    r.avgDaily = fl(wage3 * MAN / days3);
    r.ordinaryDaily = monthly > 0 ? fl(monthly * MAN * 12 / 365) : 0;
    r.avgRaised = r.ordinaryDaily > r.avgDaily;
    if (r.avgRaised) r.avgDaily = r.ordinaryDaily; // 근로기준법 제2조제2항
    r.seventy = fl(r.avgDaily * 0.7);
    r.useOrdinary = monthly > 0 && r.seventy > r.ordinaryDaily;
    r.daily = r.useOrdinary ? r.ordinaryDaily : r.seventy;
    r.total = r.daily * days;
    r.small = yes(input.under5);
    r.status = r.small ? 'NONE' : 'PAY';
    if (r.small) r.total = 0;
    r.basis.push('「근로기준법」 제46조제1항: 사용자 귀책사유로 휴업하면 평균임금의 70% 이상, 70%가 통상임금보다 많으면 통상임금 지급 가능. 제2항: 노동위원회 승인 시 그보다 적게 지급 가능');
    r.basis.push('「근로기준법」 제2조제1항제6호(평균임금 = 3개월 임금 총액 ÷ 총일수), 시행령 제7조 별표 1(상시 4명 이하 사업장은 제46조 미적용)');
    r.notes.push('통상임금 일액은 월 통상임금 × 12 ÷ 365로 달력 하루치로 바꿔 비교했습니다. 휴업 일수에 주휴일 등을 넣을지는 회사 근무 형태에 따라 따져야 합니다.');
    if (r.small) r.notes.push('상시 4명 이하 사업장은 휴업수당 규정이 적용되지 않아 법정 지급액을 0원으로 표시했습니다. 참고용 70% 금액은 위 일액으로 볼 수 있습니다.');
    r.notes.push('휴업 기간에 일부 일하고 임금을 받았다면 그 금액을 뺀 나머지에 대해 따로 계산해야 합니다(시행령 제26조).');
    return r;
  }

  // 6. 퇴직연금 DC 부담금 (근로자퇴직급여 보장법 제20조)
  function dcPension(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var annual = num(input.annualWage, '연간 임금총액', { positive: true });
    var paid = num(input.paidSoFar, '올해 이미 낸 부담금', { optional: true });
    var times = Number(input.times) || 12;
    if ([1, 2, 4, 12].indexOf(times) < 0) r.errors.push('납입 횟수는 1·2·4·12회 중에서 골라 주세요.');
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    r.annualTotal = Math.round(annual * MAN);
    r.minAnnual = Math.ceil(r.annualTotal / 12);
    r.times = times;
    r.perPayment = Math.ceil(r.minAnnual / times);
    r.paid = Math.round(paid * MAN);
    r.remaining = Math.max(0, r.minAnnual - r.paid);
    r.status = 'OK';
    r.basis.push('「근로자퇴직급여 보장법」 제20조제1항(연간 임금총액의 12분의 1 이상을 현금으로 DC 계정에 납입), 제3항(매년 1회 이상 정기 납입, 늦으면 지연이자), 제5항(퇴직 시 미납분은 14일 이내 납입)');
    r.notes.push('여기서 임금총액은 근로기준법상 임금(기본급·고정수당·상여 등 근로의 대가)입니다. 실비변상적 금품 등 임금이 아닌 것은 빼야 합니다.');
    r.notes.push('규약에서 정한 납입 기일을 넘기면 대통령령으로 정한 이율의 지연이자가 붙습니다. 회계상으로는 납입할 부담금을 그해 퇴직급여(비용)로 처리합니다.');
    return r;
  }

  // 7. 주 52시간 점검 (근로기준법 제50조·제53조)
  function workHours(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var regular = num(input.regularHours, '1주 소정근로시간', { optional: true, def: 40 });
    var ot = num(input.overtimeHours, '1주 연장근로(평일) 시간', { optional: true });
    var hol = num(input.holidayHours, '1주 휴일근로 시간', { optional: true });
    if (regular > 40) r.errors.push('소정근로시간은 40시간 이하로 입력해 주세요. 40시간을 넘는 시간은 연장근로 칸에 넣습니다.');
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    r.small = yes(input.under5);
    r.total = regular + ot + hol;
    r.extension = Math.max(0, r.total - 40);
    r.over = r.small ? 0 : Math.max(0, r.extension - 12);
    r.ok = r.small || r.extension <= 12;
    r.status = r.ok ? 'OK' : 'OVER';
    r.basis.push('「근로기준법」 제50조(1주 40시간, 1일 8시간), 제53조제1항(합의 시 1주 12시간 한도 연장), 제2조제1항제7호(1주 = 휴일을 포함한 7일)');
    r.basis.push('「근로기준법 시행령」 제7조 별표 1(상시 4명 이하 사업장은 제50조·제53조 미적용)');
    r.notes.push('1주는 휴일을 포함한 7일이라 휴일근로도 52시간 계산에 들어갑니다.');
    r.notes.push('탄력적·선택적 근로시간제(제51조·제52조), 특별연장근로 인가(제53조제4항), 근로시간 특례 업종(제59조)은 반영하지 않았습니다. 1일 8시간 초과분도 연장근로입니다.');
    return r;
  }

  var api = { overtimePay: overtimePay, hourlyWage: hourlyWage, dismissalNotice: dismissalNotice, maternityLeave: maternityLeave,
    shutdownAllowance: shutdownAllowance, dcPension: dcPension, workHours: workHours, MAT: MAT, VERSION: VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Labor2Rules = api;
})(this);
