/*
 * 중소기업·벤처 추가 6종 (순수 함수, 브라우저·Node 공용). 근거: docs/59 (법령 원문 2026-11-19 확인)
 *  startupCheck   창업기업 해당 여부      「중소기업창업 지원법」 제2조제3호·제10호·제11호, 시행령 제2조·제3조
 *  smallBizCheck  소상공인 해당 여부      「소상공인기본법」 제2조, 시행령 제3조
 *  rndLabCheck    기업부설연구소 인력 요건 「기업부설연구소등의 연구개발 지원에 관한 법률」 제7조, 시행령 제6조
 *  midsizeCheck   중견기업·졸업 유예      「중견기업법」 제2조, 시행령 제2조 / 「중소기업기본법」 제2조제3항, 시행령 제9조 / 「조세특례제한법 시행령」 제2조제2항
 *  smeEmployeeTax 중소기업 취업자 소득세 감면 「조세특례제한법」 제30조, 시행령 제27조
 *  ventureBenefits 벤처기업 확인 후 혜택   「조세특례제한법」 제6조제2항·제16조의2, 기업부설연구소법 시행령 제6조제1항제1호다목
 */
(function (root) {
  'use strict';
  var VERSION = '2026-11-19';
  function blank(v) { return v === undefined || v === null || v === ''; }
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
  function pd(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    if (!m) return null;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return d.getUTCMonth() === +m[2] - 1 ? d : null;
  }
  function addYears(d, n) { var x = new Date(d.getTime()); x.setUTCFullYear(x.getUTCFullYear() + n); if (x.getUTCDate() !== d.getUTCDate()) x.setUTCDate(0); return x; }
  function fmt(d) { return d.toISOString().slice(0, 10); }

  // 1. 창업기업
  var EXCL = {
    none: null,
    reopen_after_1y: null,
    inherit: '상속·증여받은 개인이 같은 종류의 사업을 개인으로 개시(시행령 제2조제1항제1호)',
    personal_new_person: '개인사업자가 기존 사업을 계속하면서 개인사업자로 새로 개시(제2호가목)',
    personal_new_corp: '개인사업자가 기존 사업을 계속하면서 50% 초과(또는 최대) 지분 법인을 세워 같은 종류의 사업 개시(제2호나목)',
    reopen_within_1y: '폐업 후 1년이 지나기 전에 같은 종류의 사업을 다시 개시(제3호)',
    corp_subsidiary: '법인이 임원 지분과 합쳐 50%를 넘게 소유하는 법인을 새로 설립(제4호)',
    oligopoly: '기존 법인의 과점주주가 새 법인의 과점주주가 됨(제5호)',
    conversion: '회사 형태만 바꿔 같은 종류의 사업을 계속(제6호)'
  };
  function startupCheck(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var s = pd(input.startDate), b = pd(input.baseDate);
    if (!s) r.errors.push('사업 개시일(법인설립등기일 또는 사업자등록증 개업일)을 입력해 주세요.');
    if (!b) r.errors.push('판단 기준일을 입력해 주세요.');
    if (s && b && b < s) r.errors.push('기준일은 사업 개시일 이후여야 합니다.');
    if (!(input.exclusion in EXCL)) r.errors.push('창업 제외 사유를 골라 주세요.');
    var age = blank(input.ceoAge) ? null : num(input.ceoAge, '대표자 나이');
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    r.basis.push('「중소기업창업 지원법」 제2조제3호(창업기업: 사업 개시일부터 7년이 지나지 않은 기업), 제10호(초기창업기업 3년), 제11호·제13호(청년 39세 이하·중장년 40세 이상)');
    r.basis.push('같은 법 시행령 제2조(창업에서 제외되는 경우), 제3조(사업 개시일: 법인은 설립등기일, 개인은 사업자등록증 개업일)');
    var end = new Date(addYears(s, 7).getTime() - 86400000);
    r.endDate = fmt(end);
    r.earlyEndDate = fmt(new Date(addYears(s, 3).getTime() - 86400000));
    r.elapsedYears = Math.floor((b - s) / 86400000 / 365.25 * 10) / 10;
    r.early = b <= new Date(addYears(s, 3).getTime() - 86400000);
    r.youth = age !== null && age <= 39;
    r.midAge = age !== null && age >= 40;
    r.exclusionText = EXCL[input.exclusion];
    if (r.exclusionText) { r.status = 'EXCLUDED'; r.notes.push('다만 개시일부터 7년 안에 기존 사업 폐업, 기존 법인 해산, 지분 50% 이하로 감소 등의 사유가 생기면 그날부터 창업한 것으로 봅니다(시행령 제2조제2항).'); }
    else r.status = b <= end ? 'STARTUP' : 'NOT_STARTUP';
    if (input.exclusion === 'reopen_after_1y') r.notes.push('폐업한 날부터 1년 이상 지나 같은 종류의 사업을 시작하면 창업 제외 사유에서 빠집니다(시행령 제2조제1항제3호가목).');
    r.notes.push('개인 창업기업이 대표자가 되어 법인을 세우고 사업을 포괄적으로 넘기면 법인이 창업기업 지위를 승계합니다(시행령 제2조제3항). 같은 종류의 사업은 한국표준산업분류 세세분류로 판단합니다.');
    r.notes.push('기간 마지막 날은 개시일의 7년 뒤 같은 날의 전날로 계산했습니다. 지원사업마다 공고문에서 기준일을 따로 정하는 경우가 많으니 공고를 확인하세요.');
    return r;
  }

  // 2. 소상공인
  function smallBizCheck(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var ft = num(input.fullTime, '상시 근로자 수');
    var pt = num(input.partTime, '월 60시간 이상 단시간근로자 수', { optional: true });
    var hasGrace = !blank(input.exceededYear);
    var ey = hasGrace ? num(input.exceededYear, '기준을 넘은 연도') : null;
    var by = hasGrace ? num(input.baseYear, '판단 연도') : null;
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    r.basis.push('「소상공인기본법」 제2조제1항(소기업 중 상시 근로자 10명 미만 + 업종별 기준), 제2항(규모 확대 후 다음 연도부터 3년간 소상공인으로 봄)');
    r.basis.push('같은 법 시행령 제3조제1항(광업·제조업·건설업·운수업 10명 미만, 그 밖의 업종 5명 미만), 제4항(월 60시간 이상 단시간근로자는 0.5명)');
    r.employees = Math.round((ft + pt * 0.5) * 100) / 100;
    r.limit = input.industry === 'mfg' ? 10 : 5;
    r.graceEnd = hasGrace ? ey + 3 : null;
    var meets = !!input.isSmall && r.employees < r.limit;
    if (meets) r.status = 'SMALLBIZ';
    else if (hasGrace && by > ey && by <= ey + 3 && input.isSmall !== false) r.status = 'GRACE';
    else r.status = 'NOT';
    if (!input.isSmall) r.notes.push('소상공인은 「중소기업기본법」상 소기업이어야 합니다. 소기업 여부는 중소기업 해당 여부 판정기에서 먼저 확인하세요.');
    r.notes.push('상시 근로자에서 임원, 일용근로자, 3개월 이내 기간제, 인정받은 연구소의 연구전담요원, 월 60시간 미만 단시간근로자는 뺍니다(시행령 제3조제3항). 직전 사업연도 매월 말 인원을 합해 12로 나눕니다.');
    if (r.status === 'GRACE') r.notes.push('소기업 외의 기업과 합병하는 등의 사유로 기준을 넘은 경우에는 유예가 적용되지 않습니다(법 제2조제2항 단서).');
    return r;
  }

  // 3. 기업부설연구소 인력 요건
  function rndLabCheck(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var n = num(input.researchers, '연구전담요원 수');
    if (['small', 'medium', 'midsize', 'large'].indexOf(input.size) < 0) r.errors.push('기업 규모를 골라 주세요.');
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    r.basis.push('「기업부설연구소등의 연구개발 지원에 관한 법률」 제7조(인정), 시행령 제6조제1항제1호(연구전담요원 수)·제2호(연구시설). 2026-02-01 시행');
    var req, why;
    if (input.type === 'dept') { req = 1; why = '연구개발전담부서'; }
    else if (input.overseas) { req = 5; why = '국외에 있는 기업부설연구소'; }
    else if ((input.size === 'small' || input.size === 'medium') && (input.venture || input.researchStartup)) { req = 2; why = '벤처기업 또는 연구원·교원 창업 연구개발형 중소기업'; }
    else if (input.size === 'small') { req = input.startup3y ? 2 : 3; why = input.startup3y ? '소기업(창업일부터 3년까지)' : '소기업'; }
    else if (input.size === 'medium') { req = input.mediumWithin1y ? 3 : 5; why = input.mediumWithin1y ? '소기업에서 중기업이 된 날부터 1년까지' : '중기업'; }
    else if (input.size === 'midsize') { req = 7; why = '중견기업'; }
    else { req = 10; why = '그 밖의 기업'; }
    r.required = req; r.reason = why; r.researchers = n;
    r.shortfall = Math.max(0, req - n);
    r.status = n >= req ? 'MEETS' : 'SHORT';
    r.notes.push('연구전담요원 자격(학위·경력 등)과 연구공간·기자재 기준은 시행규칙에서 정합니다. 연구소는 다른 부서와 구분된 독립 공간이 필요한 경우가 많아 신청 전에 확인하세요.');
    r.notes.push('연구소 인정을 받으면 연구·인력개발비 세액공제의 인건비 증빙이 쉬워집니다(세액공제 요건은 별도 확인).');
    return r;
  }

  // 4. 중견기업·졸업 유예
  function midsizeCheck(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var exceeded = !!input.exceeded;
    var ey = exceeded ? num(input.exceededYear, '중소기업 기준을 처음 넘은 연도') : null;
    var by = exceeded ? num(input.baseYear, '판단 연도') : null;
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    r.basis.push('「중견기업 성장촉진 및 경쟁력 강화에 관한 특별법」 제2조제1호, 시행령 제2조(공공기관 아님, 상호출자제한기업집단 아님, 그 지정기준 자산 이상 기업이 30% 이상 최다출자자 아님, 금융·보험업 아님)');
    r.basis.push('「중소기업기본법」 제2조제3항(규모 확대 시 다음 연도부터 5년간 중소기업으로 봄), 시행령 제9조(유예 제외)');
    r.basis.push('「조세특례제한법 시행령」 제2조제2항(사유 발생 과세연도와 그 다음 5개 과세연도, 상장사 7개)');
    r.smeGraceStart = null; r.smeGraceEnd = null; r.taxGraceEnd = null;
    if (exceeded && !input.graceExcluded) {
      r.smeGraceStart = ey + 1; r.smeGraceEnd = ey + 5;
      r.taxGraceEnd = ey + (input.listed ? 7 : 5);
    }
    if (input.isSme) { r.status = 'SME'; r.notes.push('아직 중소기업이면 중견기업이 아닙니다.'); return r; }
    var fail = [];
    if (input.publicInst) fail.push('공공기관·지방공기업');
    if (input.bigGroup) fail.push('상호출자제한기업집단 소속');
    if (input.bigOwner) fail.push('상호출자제한기업집단 지정기준 자산 이상 기업이 30% 이상 소유한 최다출자자');
    if (input.finance) fail.push('금융업·보험 및 연금업·금융 및 보험 관련 서비스업(일반지주회사 제외)');
    r.fails = fail;
    if (fail.length) r.status = 'NOT_MIDSIZE';
    else if (exceeded && r.smeGraceEnd !== null && by >= r.smeGraceStart && by <= r.smeGraceEnd) r.status = 'GRACE';
    else r.status = 'MIDSIZE';
    if (r.status === 'GRACE') r.notes.push('유예 기간 중에는 「중소기업기본법」상 중소기업으로 보고, 「중견기업법」상으로는 중견기업 후보기업에 해당합니다(시행령 제2조제4항제1호).');
    if (input.graceExcluded) r.notes.push('중소기업이 아닌 기업과 합병했거나, 유예 기간을 거쳐 다시 중소기업이 되었다가 또 기준을 넘은 경우 등은 유예가 적용되지 않습니다(중기법 시행령 제9조, 조특령 제2조제2항 단서).');
    r.notes.push('세법 유예는 창업일이 속하는 과세연도 종료일부터 2년 안에 기준을 넘은 경우에는 적용되지 않습니다(조특령 제2조제2항제4호). 사모펀드가 최다출자자인 경우 등은 30% 소유 요건에서 빠집니다(중견기업법 시행령 제2조제3항).');
    return r;
  }

  // 5. 중소기업 취업자 소득세 감면
  function smeEmployeeTax(input) {
    input = input || {};
    var r = base(), num = reader(r.errors);
    var age = num(input.age, '근로계약 체결일 현재 나이');
    var mil = num(input.militaryYears, '병역 이행 기간', { optional: true });
    var tax = num(input.annualTax, '연간 근로소득 산출세액');
    var h = pd(input.hireDate);
    if (!h) r.errors.push('취업일을 입력해 주세요.');
    if (['youth', 'senior', 'disabled', 'career'].indexOf(input.type) < 0) r.errors.push('대상 유형을 골라 주세요.');
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    r.basis.push('「조세특례제한법」 제30조제1항(2026-12-31까지 취업, 청년 5년·90%, 그 밖 3년·70%, 과세기간별 200만원 한도)');
    r.basis.push('같은 법 시행령 제27조(청년 15~34세·병역 최대 6년 차감, 제외 대상, 대상 업종)');
    var reasons = [];
    if (fmt(h) > '2026-12-31') reasons.push('현행 법령은 2026년 12월 31일까지 취업한 경우만 적용합니다(연장 개정 여부는 확실하지 않음)');
    if (input.type === 'youth') {
      var adj = age - Math.min(mil, 6);
      r.adjustedAge = adj;
      if (adj > 34 || age < 15) reasons.push('병역 기간을 뺀 나이가 15~34세가 아니어서 청년에 해당하지 않습니다');
    }
    if (input.type === 'senior' && age < 60) reasons.push('근로계약 체결일 현재 60세 이상이어야 합니다');
    if (input.excluded) reasons.push('임원, 최대주주와 그 배우자·직계존비속·친족, 일용근로자 등은 제외됩니다');
    if (input.industryNotEligible) reasons.push('회사의 주된 업종이 감면 대상 업종이 아닙니다');
    r.reasons = reasons;
    var youth = input.type === 'youth';
    r.rate = youth ? 90 : 70; r.years = youth ? 5 : 3;
    var end = addYears(h, r.years);
    r.periodEnd = fmt(end).slice(0, 7);
    r.annualExempt = Math.min(Math.round(tax * 10000 * r.rate / 100), 2000000);
    r.status = reasons.length ? 'NOT' : 'ELIGIBLE';
    if (r.status === 'NOT') r.annualExempt = 0;
    r.notes.push('감면은 근로자가 취업한 달의 다음 달 말일까지 회사에 감면신청서를 내야 받을 수 있고, 회사는 그 다음 달부터 감면율을 적용해 원천징수할 수 있습니다(시행령 제27조제5항).');
    r.notes.push('감면기간은 다른 중소기업으로 옮겨도 최초 취업일부터 계산합니다. 다른 소득이 있으면 근로소득 비율로 나눠 계산합니다(시행령 제27조제8항).');
    return r;
  }

  // 6. 벤처기업 혜택
  function ventureBenefits(input) {
    input = input || {};
    var r = base();
    var f = pd(input.foundDate), c = pd(input.confirmDate);
    if (!f) r.errors.push('창업일을 입력해 주세요.');
    if (!c) r.errors.push('벤처기업 확인일(예정일)을 입력해 주세요.');
    if (r.errors.length) { r.status = 'INVALID'; return r; }
    r.basis.push('「조세특례제한법」 제6조제2항(창업 후 3년 이내 2027-12-31까지 벤처 확인 → 확인 후 최초 소득 발생 과세연도부터 5년간 50%, 제1항과 중복 불가), 제3항(업종), 제13항(연 5억원 한도)');
    r.basis.push('같은 법 제16조의2(2027-12-31 이전 부여 벤처 스톡옵션 행사이익 연 2억원·누적 5억원 비과세)');
    r.basis.push('「기업부설연구소등의 연구개발 지원에 관한 법률 시행령」 제6조제1항제1호다목(벤처기업 연구소 연구전담요원 2명)');
    r.items = [];
    var within3 = c < addYears(f, 3);
    r.startupVenture = within3 && fmt(c) <= '2027-12-31' && !!input.industryEligible && !input.alreadyStartupRelief;
    if (r.startupVenture) r.items.push({ title: '창업벤처중소기업 세액감면', text: '확인받은 날 이후 처음 소득이 생긴 과세연도부터 5년간 법인세(소득세) 50% 감면. 확인 취소나 유효기간 만료(재확인 제외) 때부터는 감면하지 않습니다.', link: 'startup-relief.html' });
    r.optionExempt = !!input.options;
    if (r.optionExempt) r.items.push({ title: '스톡옵션 행사이익 비과세', text: '「벤처기업육성에 관한 특별법」에 따라 2027년 12월 31일 이전에 부여한 주식매수선택권 행사이익 중 연 2억원까지 소득세 비과세(회사별 누적 5억원 한도).', link: 'stock-option-tax.html' });
    r.items.push({ title: '기업부설연구소 인력 요건 완화', text: '벤처기업이 세운 연구소는 연구전담요원 2명이면 됩니다(소기업 3명, 중기업 5명보다 적음).', link: 'rnd-lab-check.html' });
    r.count = r.items.length;
    r.status = 'LIST';
    if (!within3) r.notes.push('창업 후 3년이 지나 벤처 확인을 받으면 창업벤처중소기업 세액감면 대상이 아닙니다.');
    if (input.alreadyStartupRelief) r.notes.push('창업중소기업 세액감면(제6조제1항)을 받는 경우에는 창업벤처중소기업 감면을 함께 받을 수 없습니다.');
    if (!input.industryEligible) r.notes.push('창업벤처중소기업 감면은 제조업, 정보통신업(일부 제외), 전문·과학·기술 서비스업(변호사·회계사 등 제외) 등 법에 열거된 업종만 받습니다.');
    r.notes.push('투자자는 벤처기업 투자 금액에 대해 엔젤투자 소득공제(제16조)를 받을 수 있습니다. 법령은 2026년 11월 기준이며 지원사업 혜택은 포함하지 않았습니다.');
    return r;
  }

  var api = { startupCheck: startupCheck, smallBizCheck: smallBizCheck, rndLabCheck: rndLabCheck, midsizeCheck: midsizeCheck, smeEmployeeTax: smeEmployeeTax, ventureBenefits: ventureBenefits, EXCL: EXCL, VERSION: VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SmeExtraRules = api;
})(this);
