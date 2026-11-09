/*
 * 대손충당금 연령분석·세법 한도 계산 로직 (순수 함수, 브라우저·Node 공용). 근거: docs/36_대손충당금_로직.md
 * 회계: 연령별 기대신용손실률(회사가 정함) × 채권 잔액 + 개별평가. 세법: 「법인세법」 제34조, 같은 법 시행령 제61조(한도 = 채권잔액 × max(1%, 대손실적률)).
 */
(function (root) {
  'use strict';
  var VERSION = '2026-11-09';
  function r2(n) { return Math.round(n * 100) / 100; }
  function blank(v) { return v === undefined || v === null || v === ''; }

  /**
   * @param input buckets [{label, balance, rate(%)}], specific(개별평가 추가액), existingAllowance(기존 잔액),
   *              priorReceivables(직전 사업연도 말 채권가액), currentWriteOffs(당기 세법상 대손금)
   */
  function calculate(input) {
    input = input || {};
    var errors = [];
    var r = { version: VERSION, status: null, errors: errors, notes: [], basis: [], rows: [] };
    var buckets = Array.isArray(input.buckets) ? input.buckets.filter(function (b) { return b && !(blank(b.balance) && blank(b.rate)); }) : [];
    if (!buckets.length) errors.push('채권 잔액을 한 구간 이상 입력해 주세요.');
    var total = 0, req = 0;
    buckets.forEach(function (b, idx) {
      var bal = Number(b.balance), rate = blank(b.rate) ? 0 : Number(b.rate);
      var name = b.label || ('구간 ' + (idx + 1));
      if (!isFinite(bal) || bal < 0) { errors.push(name + ': 잔액은 0 이상 숫자로 입력해 주세요.'); return; }
      if (!isFinite(rate) || rate < 0 || rate > 100) { errors.push(name + ': 설정률은 0~100% 사이로 입력해 주세요.'); return; }
      var amt = bal * rate / 100;
      total += bal; req += amt;
      r.rows.push({ label: name, balance: bal, rate: rate, allowance: r2(amt) });
    });
    function opt(k, label) { if (blank(input[k])) return null; var n = Number(input[k]); if (!isFinite(n) || n < 0) { errors.push(label + '은(는) 0 이상 숫자로 입력해 주세요.'); return null; } return n; }
    var specific = opt('specific', '개별평가 추가액') || 0;
    var existing = opt('existingAllowance', '기존 대손충당금 잔액');
    var prior = opt('priorReceivables', '직전 사업연도 말 채권가액');
    var writeOffs = opt('currentWriteOffs', '당기 대손금');
    if (errors.length) { r.status = 'INVALID'; return r; }

    req += specific;
    r.totalReceivables = r2(total);
    r.specific = r2(specific);
    r.requiredAllowance = r2(req);
    if (existing !== null) r.additional = r2(req - existing);

    // 세법 한도
    r.lossRate = prior && writeOffs !== null ? r2(writeOffs / prior * 100) : null;
    r.taxRate = r.lossRate !== null && r.lossRate > 1 ? r.lossRate : 1;
    r.taxLimit = r2(total * r.taxRate / 100);
    r.taxExcess = r2(Math.max(0, req - r.taxLimit));
    r.status = 'OK';

    r.basis.push('회계: 채권을 연체 기간(연령)별로 나누고 구간별 예상 손실률을 곱해 대손충당금을 추정합니다. 손실률은 회사의 과거 회수 경험과 미래 전망으로 정하며 법령이 정하지 않습니다(K-IFRS 제1109호 기대신용손실, 일반기업회계기준 제6장 — 원문 미대조).');
    r.basis.push('세법 한도: 사업연도 종료일 현재 채권잔액 × max(1%, 대손실적률). 대손실적률 = 해당 사업연도 대손금 ÷ 직전 사업연도 종료일 현재 채권가액(「법인세법 시행령」 제61조제2항·제3항).');
    r.basis.push('결산 때 대손충당금을 비용으로 계상해야 한도 안에서 손금이 되고(「법인세법」 제34조제1항), 한도를 넘는 금액은 손금불산입합니다. 남은 충당금은 다음 사업연도에 익금으로 환입합니다(같은 조 제3항).');
    if (r.lossRate === null) r.notes.push('직전 사업연도 말 채권가액과 당기 대손금을 넣으면 대손실적률을 계산합니다. 넣지 않아 1%를 적용했습니다.');
    if (r.taxExcess > 0) r.notes.push('회계상 설정액이 세법 한도보다 ' + r.taxExcess.toLocaleString('ko-KR') + ' 많습니다. 초과분은 손금불산입(유보)으로 세무조정합니다.');
    r.notes.push('세법상 대손금으로 처리할 수 있는 예: 소멸시효 완성 채권, 부도 후 6개월 지난 어음·수표, 중소기업의 회수기일 2년 경과 외상매출금(특수관계인 거래 제외), 회수기일 6개월 지난 30만원 이하 채권(「법인세법 시행령」 제19조의2제1항). 오래된 채권은 대손 요건부터 확인하세요.');
    r.notes.push('특수관계인 업무무관 가지급금, 채무보증 구상채권 등은 대손충당금 설정 대상에서 제외됩니다(「법인세법」 제34조제2항, 제19조의2제2항). 이 계산기는 구분하지 않습니다.');
    return r;
  }

  var api = { calculate: calculate, VERSION: VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AllowanceRules = api;
})(this);
