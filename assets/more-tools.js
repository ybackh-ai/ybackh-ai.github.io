/* 2026-11-09 추가 도구 19개의 입력 폼·결과 화면 설정 (계산은 각 *-rules.js, 그리는 일은 tool-engine.js) */
(function () {
  'use strict';
  var E = window.ToolEngine, n = E.n, won = E.won, table = E.table, grid = E.grid, esc = E.esc;
  var SIZE3 = [['sme', '중소기업'], ['mid', '중견기업'], ['large', '그 밖의 기업(대기업 등)']];
  function yes(v) { return v === 'yes'; }

  // ── 1. 특수관계인 주식 거래 시가 판정 ──
  E.register('related-price', {
    submit: '판정하기',
    fields: [
      { type: 'two', items: [
        { type: 'number', id: 'price', label: '실제 거래가액(총액)', unit: '만원', placeholder: '예: 60000' },
        { type: 'number', id: 'fair', label: '시가(총액)', unit: '만원', placeholder: '예: 100000', hint: '비상장주식은 매매사례가 없으면 상증법 보충적 평가액' }] },
      { type: 'two', items: [
        { type: 'select', id: 'sellerType', label: '양도자(파는 쪽)', options: [['person', '개인'], ['corp', '법인']] },
        { type: 'select', id: 'buyerType', label: '양수자(사는 쪽)', options: [['person', '개인'], ['corp', '법인']] }] },
      { type: 'radio', id: 'related', label: '두 당사자가 특수관계인인가요?', options: [['yes', '예 (친족, 임원, 30% 이상 출자 법인 등)'], ['no', '아니오']] },
      { type: 'check', id: 'listedMarket', label: '상장주식을 증권시장에서 장내 거래했습니다' }
    ],
    run: function (v) {
      var r = window.RelatedPartyRules.fairPrice({ price: v.price, fair: v.fair, sellerType: v.sellerType, buyerType: v.buyerType, related: yes(v.related), listedMarket: v.listedMarket });
      if (r.status === 'INVALID') return { r: r };
      var risks = [];
      if (r.corpRisk) risks.push('법인세 부당행위계산 부인');
      if (r.incomeRisk) risks.push('양도소득세 부당행위계산(시가 적용)');
      if (r.giftRisk) risks.push('증여세' + (r.giftAmount ? ' (증여재산가액 ' + won(r.giftAmount) + ')' : ''));
      var body = table([
        ['시가와 거래가 차이', won(r.diff) + ' (' + n(r.diffPct) + '%, ' + (r.low ? '저가' : '고가') + ')', true],
        ['부당행위 기준금액 min(3억, 시가 5%)', won(r.corpThreshold)],
        ['법인세 부당행위계산', r.corpRisk ? '해당 가능' : '해당 없음'],
        ['양도소득세 부당행위계산', r.incomeRisk ? '해당 가능' : '해당 없음'],
        ['증여세 기준금액', r.giftApplies ? won(r.giftThreshold) : '이익을 본 쪽이 법인 → 해당 없음'],
        ['증여재산가액(추정)', won(r.giftAmount), true]]);
      return { r: r, cls: risks.length ? 'target' : 'not-target', title: risks.length ? '세무상 문제가 될 수 있는 거래입니다' : '시가 기준을 벗어나지 않는 것으로 보입니다',
        sub: risks.length ? risks.join(' · ') : '차이 ' + won(r.diff), body: body, topic: 'tax', label: '주식 거래가격 검토 상담 신청' };
    }
  });

  // ── 2. 특수관계인 범위 확인 (베타) ──
  E.register('related-party', {
    submit: '확인하기',
    fields: function () { return [
      { type: 'fieldset', legend: '상대방과의 관계를 모두 고르세요', items: [
        { type: 'checks', id: 'relations', label: '', options: Object.keys(window.RelatedPartyRules.RELATIONS).map(function (k) { return [k, window.RelatedPartyRules.RELATIONS[k].label]; }) }] }
    ]; },
    run: function (v) {
      var r = window.RelatedPartyRules.scope({ relations: v.relations });
      if (r.status === 'INVALID') return { r: r };
      var body = grid(['선택한 관계', '판정'], r.items.map(function (x) { return [x.label, x.hit ? '특수관계' : '해당 안 함']; }));
      return { r: r, cls: r.related ? 'target' : 'not-target', title: r.related ? '특수관계인에 해당하는 것으로 판단됩니다' : '선택한 관계만으로는 특수관계인이 아닌 것으로 보입니다',
        sub: '「국세기본법」 기준 · 해당 ' + r.hits + '건', body: body, topic: 'tax', label: '특수관계 거래 상담 신청' };
    }
  });

  // ── 3. 통합고용세액공제 (베타) ──
  function empRow(id, label) { return { type: 'two', items: [0, 1, 2, 3].map(function (i) { return { type: 'number', id: id + i, label: label + ' — ' + ['당해', '직전', '전전', '전전전'][i], unit: '명', step: '0.01', placeholder: i ? '비교 제외면 비움' : '예: 10' }; }) }; }
  E.register('employment-credit', {
    fields: [
      { type: 'radio', id: 'size', label: '기업 규모', options: SIZE3 },
      { type: 'check', id: 'nonCapital', label: '수도권 밖에서 고용이 증가했습니다 (중소기업 우대 금액)', when: function (v) { return v.size === 'sme'; } },
      { type: 'fieldset', legend: '청년등 상시근로자 수 (청년 정규직·장애인·60세 이상·경력단절)', intro: '2024년 이전에 시작한 과세연도는 비교에서 빠지므로 비워 두세요. 2026년 과세연도라면 보통 직전(2025)만 입력합니다.', items: [empRow('y', '청년등')] },
      { type: 'fieldset', legend: '청년등외 상시근로자 수', items: [empRow('o', '청년등외')] },
      { type: 'two', items: [
        { type: 'number', id: 'minIncrease', label: '최소고용증가인원수', unit: '명', when: function (v) { return v.size !== 'sme'; }, hint: '시행령 기준 — 세무대리인에게 확인' },
        { type: 'number', id: 'returners', label: '육아휴직 복귀자 수(2026년 복직)', unit: '명', placeholder: '없으면 비움', when: function (v) { return v.size !== 'large'; } }] }
    ],
    run: function (v) {
      var r = window.TaxCreditRules.employment({ size: v.size, nonCapital: v.nonCapital, youth: [v.y0, v.y1, v.y2, v.y3], other: [v.o0, v.o1, v.o2, v.o3], minIncrease: v.minIncrease, returners: v.returners });
      if (r.status === 'INVALID') return { r: r };
      var body = grid(['비교 기준', '전체 증가', '청년등 반영', '청년등외 반영'], ['직전', '전전', '전전전'].map(function (l, k) { return [l + ' 대비', r.totalIncrease[k], r.youthIncrease[k], r.otherIncrease[k]]; })) +
        table([['청년등 공제액', won(r.youthAmount)], ['청년등외 공제액', won(r.otherAmount)], r.deduction ? ['최소고용증가인원 차감', '−' + won(r.deduction)] : null, ['통합고용세액공제', won(r.mainCredit), true], r.returnerCredit ? ['육아휴직 복귀자 공제', won(r.returnerCredit)] : null, ['합계', won(r.credit), true]]) +
        (r.parts.length ? '<h3>계산 내역</h3><ul class="basis">' + r.parts.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>' : '');
      return { r: r, cls: r.credit ? 'target' : 'not-target', title: r.credit ? '세액공제 약 ' + won(r.credit) : '공제 대상 증가 인원이 없습니다', sub: r.eligible ? '상시근로자 증가 요건 충족' : '상시근로자 증가 요건 미충족', body: body, topic: 'tax', label: '고용 세액공제 검토 상담 신청' };
    }
  });

  // ── 4. 연구·인력개발비 세액공제 + 최저한세 (베타) ──
  E.register('rnd-credit', {
    fields: [
      { type: 'radio', id: 'size', label: '기업 규모', options: SIZE3 },
      { type: 'select', id: 'graduated', label: '중소기업 졸업 유예', options: [['', '해당 없음'], ['g1', '최초로 중소기업을 벗어난 해부터 3년 이내'], ['g2', '그다음 2년 이내']], when: function (v) { return v.size !== 'sme'; } },
      { type: 'fieldset', legend: '일반 연구·인력개발비', items: [{ type: 'two', items: [
        { type: 'number', id: 'current', label: '당기 발생액', unit: '만원', placeholder: '예: 10000' },
        { type: 'number', id: 'prior', label: '직전 과세연도 발생액', unit: '만원' },
        { type: 'number', id: 'avg4', label: '직전 4년 연평균 발생액', unit: '만원', hint: '없으면 증가분 방식은 계산하지 않음' },
        { type: 'number', id: 'revenue', label: '당기 수입금액(매출액)', unit: '만원', hint: '대기업 당기분 공제율 계산에 필요' }] }] },
      { type: 'fieldset', legend: '신성장·원천기술 / 국가전략기술 (구분경리한 경우)', items: [{ type: 'two', items: [
        { type: 'number', id: 'newGrowth', label: '신성장·원천기술 연구개발비', unit: '만원', placeholder: '없으면 비움' },
        { type: 'number', id: 'strategic', label: '국가전략기술 연구개발비', unit: '만원', placeholder: '없으면 비움' }] }] },
      { type: 'number', id: 'taxBase', label: '법인세 과세표준(최저한세 검토용, 선택)', unit: '만원' }
    ],
    run: function (v) {
      var r = window.TaxCreditRules.rnd(v);
      if (r.status === 'INVALID') return { r: r };
      var body = table([['당기분 (' + n(r.curRate, 3) + '%)', won(r.curCredit)], ['증가분', r.incAvailable ? won(r.incCredit) : '적용 불가'], ['일반 연구·인력개발비 공제(유리한 방식)', won(r.generalCredit), true],
        r.newGrowthCredit ? ['신성장·원천기술 (가산율 제외)', won(r.newGrowthCredit)] : null, r.strategicCredit ? ['국가전략기술 (가산율 제외)', won(r.strategicCredit)] : null, ['공제액 합계', won(r.credit), true],
        r.grossTax !== undefined ? ['산출세액', won(r.grossTax)] : null, r.minTax !== undefined ? ['최저한세', won(r.minTax)] : null,
        r.allowed !== undefined ? ['당기 공제 가능액', won(r.allowed), true] : null, r.carry ? ['이월되는 금액', won(r.carry)] : null]);
      return { r: r, cls: 'target', title: '연구·인력개발비 세액공제 약 ' + won(r.allowed !== undefined ? r.allowed : r.credit), sub: (r.method === 'increase' ? '증가분 방식이 유리' : '당기분 방식') + (r.carry ? ' · 이월 ' + won(r.carry) : ''), body: body, topic: 'tax', label: '연구개발 세액공제 상담 신청' };
    }
  });

  // ── 5. 통합투자세액공제 ──
  E.register('investment-credit', {
    fields: function () { return [
      { type: 'radio', id: 'size', label: '기업 규모', options: SIZE3 },
      { type: 'check', id: 'graduated', label: '최초로 중소기업을 벗어난 해부터 3년 이내입니다', when: function (v) { return v.size !== 'sme'; } },
      { type: 'select', id: 'type', label: '투자 자산 구분', options: Object.keys(window.TaxCreditRules.INV).map(function (k) { return [k, window.TaxCreditRules.INV[k].label]; }) },
      { type: 'two', items: [
        { type: 'number', id: 'amount', label: '당기 투자금액', unit: '만원', placeholder: '예: 100000' },
        { type: 'number', id: 'avg3', label: '직전 3년 연평균 투자금액(선택)', unit: '만원' }] }
    ]; },
    run: function (v) {
      var r = window.TaxCreditRules.investment(v);
      if (r.status === 'INVALID') return { r: r };
      return { r: r, cls: 'target', title: '통합투자세액공제 약 ' + won(r.credit), sub: '기본공제율 ' + r.rate + '%',
        body: table([['기본공제', won(r.basic)], ['추가공제', won(r.additional)], ['합계', won(r.credit), true]]), topic: 'tax', label: '투자 세액공제 상담 신청' };
    }
  });

  // ── 6. 창업중소기업 세액감면 (베타) ──
  E.register('startup-relief', {
    submit: '판정하기',
    fields: [
      { type: 'radio', id: 'era', label: '창업 시기', options: [['2026', '2026년 1월 1일 이후'], ['2025', '2025년 12월 31일 이전']] },
      { type: 'select', id: 'region', label: '창업 지역', options: [['nonCapital', '수도권 밖'], ['capitalDepop', '수도권 중 인구감소지역'], ['capitalOther', '수도권(과밀억제권역·인구감소지역 제외)'], ['overcrowded', '수도권과밀억제권역(서울 등)']] },
      { type: 'check', id: 'youth', label: '청년창업중소기업입니다 (창업 당시 대표자가 청년 요건 충족)' },
      { type: 'check', id: 'industryOk', value: true, label: '제조·건설·정보통신·전문과학기술 서비스 등 감면 대상 업종입니다', hint: '(변호사·회계사·세무사업 등은 제외)' },
      { type: 'check', id: 'notStartup', label: '기존 사업 승계, 개인사업자의 법인 전환, 폐업 후 재개업, 업종 추가에 해당합니다' },
      { type: 'check', id: 'venture', label: '창업 후 3년 이내에 벤처기업 확인을 받았습니다' },
      { type: 'two', items: [
        { type: 'number', id: 'revenue', label: '연 수입금액(선택)', unit: '만원', hint: '1억4백만원 이하 소규모 감면 판단' },
        { type: 'number', id: 'tax', label: '감면 대상 소득의 법인세·소득세(선택)', unit: '만원' }] }
    ],
    run: function (v) {
      var r = window.TaxCreditRules.startup(v);
      if (r.status === 'INVALID') return { r: r };
      return { r: r, cls: r.eligible ? 'target' : 'not-target', title: r.eligible ? '세액의 ' + r.rate + '% 감면 대상으로 판단됩니다' : '창업중소기업 감면 대상이 아닌 것으로 보입니다',
        sub: r.eligible ? '최초 소득 발생 연도부터 5년간' + (r.reduction !== undefined ? ' · 올해 감면액 약 ' + won(r.reduction) : '') : '',
        body: r.reduction !== undefined ? table([['감면율', r.rate + '%'], ['감면세액' + (r.capped ? ' (5억원 한도 적용)' : ''), won(r.reduction), true]]) : '', topic: 'tax', label: '창업 감면 상담 신청' };
    }
  });

  // ── 7. 엔젤투자 소득공제 ──
  E.register('angel-deduction', {
    fields: [
      { type: 'radio', id: 'type', label: '투자 방식', options: [['direct', '벤처기업 등에 직접 투자 / 개인투자조합 통해 투자 / 크라우드펀딩'], ['fund', '벤처투자조합·벤처기업투자신탁 등 출자']] },
      { type: 'two', items: [
        { type: 'number', id: 'amount', label: '투자금액', unit: '만원', placeholder: '예: 5000' },
        { type: 'number', id: 'income', label: '종합소득금액', unit: '만원', placeholder: '예: 20000' },
        { type: 'number', id: 'taxBase', label: '공제 전 종합소득 과세표준(선택)', unit: '만원', hint: '넣으면 절세액을 추정' }] }
    ],
    run: function (v) {
      var r = window.TaxCreditRules.angel(v);
      if (r.status === 'INVALID') return { r: r };
      return { r: r, cls: 'target', title: '소득공제 ' + won(r.deduction), sub: r.taxSaving !== undefined ? '절세액 약 ' + won(r.taxSaving + r.localSaving) + ' (지방소득세 포함)' : (r.capped ? '종합소득금액 50% 한도 적용' : ''),
        body: table([['공제 계산액', won(r.rawDeduction)], ['한도 (종합소득금액 50%)', won(r.cap)], ['소득공제액', won(r.deduction), true], r.taxSaving !== undefined ? ['소득세 절감', won(r.taxSaving)] : null, r.localSaving !== undefined ? ['지방소득세 절감', won(r.localSaving)] : null]), topic: 'tax', label: '투자·절세 상담 신청' };
    }
  });

  // ── 8. 기업업무추진비 한도 ──
  E.register('entertainment', {
    fields: [
      { type: 'radio', id: 'sme', label: '기업 규모', options: [['yes', '중소기업'], ['no', '중소기업 아님']] },
      { type: 'two', items: [
        { type: 'number', id: 'months', label: '사업연도 월수', unit: '개월', value: '12' },
        { type: 'number', id: 'revenue', label: '일반 수입금액(매출액)', unit: '만원', placeholder: '예: 500000' },
        { type: 'number', id: 'relatedRevenue', label: '특수관계인 거래 수입금액', unit: '만원', placeholder: '없으면 비움' },
        { type: 'number', id: 'spent', label: '기업업무추진비 지출액', unit: '만원' },
        { type: 'number', id: 'noEvidence', label: '1회 3만원(경조금 20만원) 초과 지출 중 적격증빙 없는 금액', unit: '만원', placeholder: '없으면 비움' }] },
      { type: 'check', id: 'realEstate', label: '부동산임대업이 주업인 소규모 법인 등(한도 50%) 입니다' }
    ],
    run: function (v) {
      var r = window.CorpExpenseRules.entertainment({ sme: yes(v.sme), months: v.months, revenue: v.revenue, relatedRevenue: v.relatedRevenue, spent: v.spent, noEvidence: v.noEvidence, realEstate: v.realEstate });
      if (r.status === 'INVALID') return { r: r };
      return { r: r, cls: r.disallowed ? 'target' : 'not-target', title: r.disallowed ? '손금불산입 ' + won(r.disallowed) : '한도 안에서 지출했습니다', sub: '한도 ' + won(r.limit),
        body: table([['기본 한도', won(r.baseLimit)], ['수입금액 기준 한도', won(r.revenueLimit)], ['한도 합계', won(r.limit), true], ['증빙 불비 손금불산입', won(r.evidenceDisallowed)], ['한도초과 손금불산입', won(r.overLimit)], ['손금불산입 합계', won(r.disallowed), true], ['손금 인정액', won(r.deductible)]]), topic: 'tax', label: '세무조정 상담 신청' };
    }
  });

  // ── 9. 업무용승용차 비용 한도 ──
  E.register('business-car', {
    fields: [
      { type: 'two', items: [
        { type: 'number', id: 'price', label: '차량 취득가액(부가세 포함)', unit: '만원', placeholder: '예: 5000' },
        { type: 'number', id: 'months', label: '올해 보유 월수', unit: '개월', value: '12' },
        { type: 'number', id: 'otherCost', label: '감가상각비 외 관련비용(유류·보험·수리·자동차세 등)', unit: '만원' }] },
      { type: 'check', id: 'insured', value: true, label: '업무전용자동차보험에 가입했습니다' },
      { type: 'check', id: 'log', label: '운행기록부를 작성했습니다' },
      { type: 'number', id: 'businessRatio', label: '운행기록상 업무사용비율', unit: '%', when: function (v) { return v.log; } },
      { type: 'check', id: 'realEstateCorp', label: '부동산임대업 주업 등 소규모 법인 요건(한도 500만·400만)에 해당합니다' }
    ],
    run: function (v) {
      var r = window.CorpExpenseRules.car(v);
      if (r.status === 'INVALID') return { r: r };
      return { r: r, cls: (r.nonBusiness + r.depExcess) ? 'target' : 'not-target', title: '손금 인정 ' + won(r.deductible), sub: '업무사용비율 ' + n(r.ratioPct) + '%',
        body: table([['감가상각비(5년 정액)', won(r.depreciation)], ['관련비용 합계', won(r.totalCost)], ['업무사용금액', won(r.businessCost)], ['업무 외 사용금액(손금불산입·상여 등)', won(r.nonBusiness)], ['감가상각비 한도 (' + won(r.depLimit) + ') 초과 이월', won(r.depExcess)], ['손금 인정액', won(r.deductible), true]]), topic: 'tax', label: '차량 비용 세무 상담 신청' };
    }
  });

  // ── 10. 비상장주식 양도소득세 ──
  E.register('share-transfer-tax', {
    fields: [
      { type: 'two', items: [
        { type: 'number', id: 'sale', label: '양도가액', unit: '만원', placeholder: '예: 10000' },
        { type: 'number', id: 'cost', label: '취득가액', unit: '만원', placeholder: '예: 4000' },
        { type: 'number', id: 'expenses', label: '필요경비(증권거래세·수수료 등)', unit: '만원', placeholder: '없으면 비움' }] },
      { type: 'check', id: 'sme', value: true, label: '중소기업 주식입니다' },
      { type: 'check', id: 'major', label: '대주주에 해당합니다 (본인·특수관계인 지분 합산)' },
      { type: 'check', id: 'under1y', label: '보유기간이 1년 미만입니다', when: function (v) { return v.major; } },
      { type: 'check', id: 'deductionUsed', label: '올해 다른 주식 양도로 기본공제 250만원을 이미 받았습니다' }
    ],
    run: function (v) {
      var r = window.GainsSuccessionRules.shareGains(v);
      if (r.status === 'INVALID') return { r: r };
      return { r: r, cls: r.tax ? 'target' : 'not-target', title: r.tax ? '양도소득세 등 약 ' + won(r.totalTax) : '납부할 양도소득세가 없습니다', sub: '과세표준 ' + won(r.base),
        body: table([['양도차익', won(r.gain)], ['기본공제', won(r.deduction)], ['과세표준', won(r.base), true], ['양도소득세', won(r.tax)], ['지방소득세', won(r.localTax)], ['합계', won(r.totalTax), true]]), topic: 'tax', label: '주식 양도 세무 상담 신청' };
    }
  });

  // ── 11. 가업상속공제 요건 (베타) ──
  E.register('succession', {
    submit: '확인하기',
    fields: [
      { type: 'radio', id: 'size', label: '기업 규모(상속개시 당시)', options: [['sme', '중소기업'], ['mid', '중견기업'], ['other', '그 밖의 기업']] },
      { type: 'two', items: [
        { type: 'number', id: 'avgSales', label: '직전 3년 평균 매출액', unit: '억원', when: function (v) { return v.size === 'mid'; } },
        { type: 'number', id: 'years', label: '피상속인의 계속 경영기간', unit: '년', placeholder: '예: 25' },
        { type: 'number', id: 'assetValue', label: '가업상속재산가액(추정)', unit: '억원', placeholder: '예: 300' }] },
      { type: 'check', id: 'fraud', label: '피상속인·상속인이 가업 관련 조세포탈·회계부정으로 형이 확정됐습니다' }
    ],
    run: function (v) {
      var r = window.GainsSuccessionRules.succession(v);
      if (r.status === 'INVALID') return { r: r };
      var body = grid(['기본 요건', '충족'], r.checks.map(function (c) { return [c.label, c.ok ? '충족' : '미충족']; })) +
        table([['공제 한도', r.limit ? r.limit + '억원' : '-'], ['예상 공제액', r.deduction + '억원', true]]);
      return { r: r, cls: r.eligible ? 'target' : 'not-target', title: r.eligible ? '기본 요건을 충족하는 것으로 보입니다 (최대 ' + r.deduction + '억원 공제)' : '기본 요건을 충족하지 못하는 것으로 보입니다', sub: '시행령 세부 요건은 별도 확인 필요', body: body, topic: 'tax', label: '가업승계 상담 신청' };
    }
  });

  // ── 12. 기업가치 → 지분가치 ──
  E.register('equity-bridge', {
    fields: [
      { type: 'number', id: 'ev', label: '기업가치(EV, DCF·멀티플 결과)', unit: '백만원', placeholder: '예: 10000' },
      { type: 'fieldset', legend: '순부채·조정 항목 (거래종결일 또는 기준일)', items: [{ type: 'two', items: [
        { type: 'number', id: 'debt', label: '차입금·사채', unit: '백만원' },
        { type: 'number', id: 'debtLike', label: '부채성 항목(미지급법인세·미적립 퇴직금·리스부채 등)', unit: '백만원' },
        { type: 'number', id: 'cash', label: '현금성자산', unit: '백만원' },
        { type: 'number', id: 'nonOp', label: '비영업자산(유휴 부동산·투자주식 등)', unit: '백만원' },
        { type: 'number', id: 'minority', label: '비지배지분', unit: '백만원' }] }] },
      { type: 'fieldset', legend: '순운전자본 가격조정 (선택)', items: [{ type: 'two', items: [
        { type: 'number', id: 'nwcActual', label: '실제 순운전자본', unit: '백만원', allowNeg: true },
        { type: 'number', id: 'nwcTarget', label: '목표(정상) 순운전자본', unit: '백만원', allowNeg: true, hint: '보통 최근 12개월 평균' }] }] },
      { type: 'number', id: 'shares', label: '발행주식수(선택)', unit: '주' }
    ],
    run: function (v) {
      var r = window.DealRules.bridge(v);
      if (r.status === 'INVALID') return { r: r };
      var rows = r.lines.map(function (l) { return [l[0], n(l[1]) + ' 백만원']; });
      rows.push(['지분가치', n(r.equity) + ' 백만원', true]);
      if (r.perShare !== undefined) rows.push(['주당 가치', won(r.perShare), true]);
      return { r: r, cls: 'exempt', title: '지분가치 ' + n(r.equity) + ' 백만원', sub: '순부채 ' + n(r.netDebt) + ' 백만원' + (r.nwcAdj ? ' · 운전자본 조정 ' + n(r.nwcAdj) : ''), body: table(rows), topic: 'fdd', label: 'M&A 가격 검토 상담 신청' };
    }
  });

  // ── 13. 유사기업 멀티플 평가 ──
  E.register('multiples', {
    fields: [
      { type: 'rows', id: 'comps', label: '비교 상장회사 배수', rows: 4, addLabel: '비교회사 추가', hint: '모르는 배수는 비워 두세요. 적자 회사의 PER은 넣지 않습니다.', columns: [{ key: 'name', label: '회사명', type: 'text' }, { key: 'evEbitda', label: 'EV/EBITDA' }, { key: 'per', label: 'PER' }, { key: 'pbr', label: 'PBR' }] },
      { type: 'fieldset', legend: '대상회사 지표 (같은 단위로)', items: [{ type: 'two', items: [
        { type: 'number', id: 'ebitda', label: 'EBITDA', unit: '백만원', allowNeg: true },
        { type: 'number', id: 'netIncome', label: '당기순이익', unit: '백만원', allowNeg: true },
        { type: 'number', id: 'bookEquity', label: '순자산(자본총계)', unit: '백만원', allowNeg: true },
        { type: 'number', id: 'netDebt', label: '순부채', unit: '백만원', allowNeg: true },
        { type: 'number', id: 'discount', label: '비상장 할인율(선택)', unit: '%', placeholder: '예: 20' }] }] }
    ],
    run: function (v) {
      var r = window.DealRules.multiples(v);
      if (r.status === 'INVALID') return { r: r };
      var body = grid(['배수', '회사 수', '중앙값', '평균', '범위', '지분가치(중앙값)', '지분가치(평균)'], r.methods.map(function (m) {
        return [m.label, m.s.n, n(m.s.median), n(m.s.mean), n(m.s.min) + ' ~ ' + n(m.s.max), m.equity === null ? '지표 없음' : n(m.equity), m.equity === null ? '-' : n(m.equityMean)]; }));
      return { r: r, cls: 'exempt', title: r.low !== undefined ? '지분가치 ' + n(r.low) + ' ~ ' + n(r.high) + ' 백만원' : '대상회사 지표를 넣으면 가치가 계산됩니다', sub: '배수별 중앙값 기준', body: body, topic: 'fdd', label: '가치평가 상담 신청' };
    }
  });

  // ── 14. SAFE·전환사채 전환 주식수 ──
  E.register('safe-conversion', {
    fields: [
      { type: 'radio', id: 'mode', label: '증권 종류', options: [['safe', 'SAFE(조건부지분인수계약)'], ['cb', '전환사채(CB)·전환우선주']] },
      { type: 'number', id: 'investment', label: '투자금액(사채 원금)', unit: '만원', placeholder: '예: 50000' },
      { type: 'fieldset', id: 'fs-safe', legend: 'SAFE 조건', when: function (v) { return v.mode === 'safe'; }, items: [{ type: 'two', items: [
        { type: 'number', id: 'cap', label: '밸류에이션 캡', unit: '만원', placeholder: '예: 500000' },
        { type: 'number', id: 'preShares', label: '캡 산정 기준 주식수', unit: '주' },
        { type: 'number', id: 'discount', label: '할인율', unit: '%', placeholder: '예: 20' },
        { type: 'number', id: 'roundPrice', label: '후속 투자 주당 가격', unit: '원' }] }] },
      { type: 'fieldset', id: 'fs-cb', legend: '전환 조건', when: function (v) { return v.mode === 'cb'; }, items: [{ type: 'two', items: [
        { type: 'number', id: 'conversionPrice', label: '최초 전환가액', unit: '원' },
        { type: 'number', id: 'currentPrice', label: '현재 시가(리픽싱 검토, 선택)', unit: '원' },
        { type: 'number', id: 'refixFloor', label: '리픽싱 하한(최초 전환가 대비)', unit: '%', placeholder: '예: 70' }] }] },
      { type: 'number', id: 'existingShares', label: '전환 전 발행주식수(선택)', unit: '주' }
    ],
    run: function (v) {
      var r = window.DealRules.convert(v);
      if (r.status === 'INVALID') return { r: r };
      return { r: r, cls: 'exempt', title: n(r.shares, 0) + '주로 전환됩니다', sub: '전환가격 ' + won(r.price) + (r.ownershipPct !== undefined ? ' · 전환 후 지분율 ' + n(r.ownershipPct) + '%' : ''),
        body: table([['전환가격', won(r.price)], ['전환 주식수', n(r.shares, 0) + '주', true], r.ownershipPct !== undefined ? ['전환 후 지분율', n(r.ownershipPct) + '%'] : null]), topic: 'fdd', label: '투자 계약 검토 상담 신청' };
    }
  });

  // ── 15. 부동산 PF 사업성 (베타) ──
  E.register('pf-feasibility', {
    fields: [
      { type: 'two', items: [
        { type: 'number', id: 'totalSales', label: '총 분양 예정액(100% 분양 시)', unit: '억원', placeholder: '예: 1000' },
        { type: 'number', id: 'salesRate', label: '예상 분양률', unit: '%', value: '90' },
        { type: 'number', id: 'land', label: '토지비', unit: '억원' },
        { type: 'number', id: 'construction', label: '공사비', unit: '억원' },
        { type: 'number', id: 'other', label: '기타 사업비(설계·인허가·분양·부담금 등)', unit: '억원' }] },
      { type: 'fieldset', legend: '자금 조달', items: [{ type: 'two', items: [
        { type: 'number', id: 'loan', label: 'PF 대출', unit: '억원' },
        { type: 'number', id: 'rate', label: '대출 금리(연)', unit: '%' },
        { type: 'number', id: 'months', label: '대출 기간', unit: '개월' },
        { type: 'number', id: 'feeRate', label: '금융 수수료(대출 대비)', unit: '%' },
        { type: 'number', id: 'equity', label: '시행사 자기자본(선택)', unit: '억원' }] }] }
    ],
    run: function (v) {
      var r = window.DealRules.pf(v);
      if (r.status === 'INVALID') return { r: r };
      var body = table([['분양수입', n(r.revenue) + '억원'], ['이자비용', n(r.interest) + '억원'], ['금융 수수료', n(r.fee) + '억원'], ['총사업비', n(r.totalCost) + '억원', true], ['사업이익', n(r.profit) + '억원', true], ['이익률(분양수입 대비)', n(r.marginPct) + '%'], ['손익분기 분양률', n(r.breakEvenPct) + '%'],
        r.loanToCostPct !== undefined ? ['PF 대출 / 총사업비', n(r.loanToCostPct) + '%'] : null, r.equityPct !== undefined ? ['자기자본 / 총사업비', n(r.equityPct) + '%'] : null, r.roePct !== undefined ? ['자기자본 이익률', n(r.roePct) + '%'] : null]) +
        '<h3>분양률별 사업이익</h3>' + grid(['분양률', '사업이익(억원)'], r.sensitivity.map(function (s) { return [s.rate + '%', n(s.profit)]; }));
      return { r: r, cls: r.profit >= 0 ? 'not-target' : 'target', title: '사업이익 ' + n(r.profit) + '억원 (이익률 ' + n(r.marginPct) + '%)', sub: '손익분기 분양률 ' + n(r.breakEvenPct) + '%', body: body, topic: 'fdd', label: 'PF 사업성 검토 상담 신청' };
    }
  });

  // ── 16. 이연법인세 (베타) ──
  E.register('deferred-tax', {
    fields: [
      { type: 'rows', id: 'rows', label: '기말 일시적차이 (세무조정 유보 잔액)', rows: 4, addLabel: '항목 추가', hint: '차감할 차이 예: 대손충당금 한도초과, 미지급비용, 감가상각 부인액. 가산할 차이 예: 미수이자, 일시상각충당금.',
        columns: [{ key: 'name', label: '항목', type: 'text' }, { key: 'amount', label: '금액' }, { key: 'type', label: '구분', type: 'select', options: [['deductible', '차감할 차이(자산)'], ['taxable', '가산할 차이(부채)']] }] },
      { type: 'two', items: [
        { type: 'number', id: 'rate', label: '적용 세율(지방소득세 포함)', unit: '%', placeholder: '예: 20.9' },
        { type: 'number', id: 'priorDta', label: '기초 이연법인세자산', placeholder: '없으면 비움' },
        { type: 'number', id: 'priorDtl', label: '기초 이연법인세부채', placeholder: '없으면 비움' }] },
      { type: 'check', id: 'recoverable', value: true, label: '앞으로 과세소득이 충분해 차감할 차이를 실현할 수 있습니다' }
    ],
    run: function (v) {
      var r = window.DealRules.deferredTax(v);
      if (r.status === 'INVALID') return { r: r };
      return { r: r, cls: 'exempt', title: '이연법인세 순' + (r.net >= 0 ? '자산 ' : '부채 ') + n(Math.abs(r.net)), sub: '이연법인세' + (r.expense >= 0 ? '비용 ' : '수익 ') + n(Math.abs(r.expense)),
        body: table([['가산할 일시적차이 합계', n(r.taxableTotal)], ['차감할 일시적차이 합계', n(r.deductibleTotal)], ['이연법인세부채', n(r.dtl)], ['이연법인세자산(인식액)', n(r.dta) + (r.dta !== r.dtaGross ? ' (미인식 ' + n(r.dtaGross) + ')' : '')], ['기말 순액', n(r.net), true], ['기초 순액', n(r.priorNet)], ['이연법인세비용(+) / 수익(−)', n(r.expense), true]]), topic: 'ifrs', label: '법인세 회계 상담 신청' };
    }
  });

  // ── 17. 수익인식 진단 (베타) ──
  E.register('revenue-check', {
    submit: '진단하기',
    fields: function () { return [
      { type: 'fieldset', legend: '회사 거래에 해당하는 것을 모두 고르세요', items: Object.keys(window.DealRules.REV_ITEMS).map(function (k) { return { type: 'check', id: k, label: window.DealRules.REV_ITEMS[k].label }; }) }
    ]; },
    run: function (v) {
      var r = window.DealRules.revenue(v);
      var body = r.flags.length ? grid(['거래 유형', '검토할 쟁점'], r.flags.map(function (f) { return [f.label, f.check]; })) : '<p>고른 항목이 없습니다. 일반적인 제품 판매(인도 시점 수익 인식)는 쟁점이 적은 편입니다.</p>';
      return { r: r, cls: r.flagCount >= 3 ? 'target' : r.flagCount ? 'exempt' : 'not-target', title: r.flagCount ? '수익인식 검토 쟁점 ' + r.flagCount + '개' : '두드러진 쟁점이 없습니다', sub: r.flagCount >= 3 ? '외부감사 전 회계정책 정리를 권합니다' : '', body: body, topic: 'ifrs', label: '수익인식 회계 상담 신청' };
    }
  });

  // ── 18. 법인세 간이 계산 ──
  E.register('corp-tax', {
    fields: [
      { type: 'two', items: [
        { type: 'number', id: 'income', label: '각 사업연도 소득(세무조정 후)', unit: '만원', allowNeg: true, placeholder: '예: 50000' },
        { type: 'number', id: 'loss', label: '공제 가능한 이월결손금(15년 이내)', unit: '만원' },
        { type: 'number', id: 'nontax', label: '비과세소득·소득공제', unit: '만원' },
        { type: 'number', id: 'months', label: '사업연도 월수', unit: '개월', value: '12' },
        { type: 'number', id: 'credits', label: '세액공제·감면 합계', unit: '만원' },
        { type: 'number', id: 'prepaid', label: '중간예납·원천징수 등 기납부세액', unit: '만원' }] },
      { type: 'check', id: 'sme', value: true, label: '중소기업(또는 회생계획 이행 중 등)입니다 — 이월결손금 소득의 100%까지 공제' },
      { type: 'check', id: 'special', label: '부동산임대업 주업 등 성실신고확인 대상 소규모 법인입니다 (최저 세율 20%)' }
    ],
    run: function (v) {
      var r = window.TaxCalcRules.corpTax(v);
      if (r.status === 'INVALID') return { r: r };
      return { r: r, cls: r.payable > 0 ? 'target' : 'not-target', title: r.payable >= 0 ? '납부할 법인세 약 ' + won(r.payable) : '환급 예상 약 ' + won(-r.payable), sub: '산출세액 ' + won(r.grossTax) + ' · 지방소득세 약 ' + won(r.localTax),
        body: table([['이월결손금 공제', won(r.lossUsed)], r.lossRemain ? ['남은 이월결손금', won(r.lossRemain)] : null, r.newLoss ? ['당기 발생 결손금', won(r.newLoss)] : null, ['과세표준', won(r.base), true], r.annualBase !== undefined ? ['연환산 과세표준', won(r.annualBase)] : null,
          ['산출세액', won(r.grossTax)], ['공제·감면', '−' + won(r.creditsUsed)], ['총부담세액', won(r.determinedTax), true], ['기납부세액', '−' + won(r.determinedTax - r.payable)], ['납부(환급)할 세액', won(r.payable), true], ['지방소득세(약)', won(r.localTax)]]), topic: 'tax', label: '법인세 신고 상담 신청' };
    }
  });

  // ── 20. 적격합병·적격분할 요건 (베타) ──
  E.register('qualified-reorg', {
    submit: '진단하기',
    fields: [
      { type: 'radio', id: 'mode', label: '거래 유형', options: [['merger', '합병'], ['split', '인적분할·분할합병']] },
      { type: 'check', id: 'whollyOwned', label: '발행주식 100%를 가진 회사 간 합병입니다 (모자회사 또는 같은 모회사의 100% 자회사끼리)', when: function (v) { return v.mode === 'merger'; } },
      { type: 'fieldset', id: 'fs-m', legend: '합병 요건', when: function (v) { return v.mode === 'merger' && !v.whollyOwned; }, items: [
        { type: 'check', id: 'over1y', label: '두 회사 모두 합병등기일 현재 1년 이상 사업을 해 온 내국법인입니다' }] },
      { type: 'fieldset', id: 'fs-s', legend: '분할 요건', when: function (v) { return v.mode === 'split'; }, items: [
        { type: 'check', id: 'splitMerger', label: '분할합병입니다 (분할한 사업부문을 다른 회사와 합침)' },
        { type: 'check', id: 'counterpartOver1y', label: '분할합병 상대방 법인이 1년 이상 사업을 해 왔습니다', when: function (v) { return v.splitMerger; } },
        { type: 'check', id: 'over5y', label: '분할하는 회사가 분할등기일 현재 5년 이상 사업을 해 왔습니다' },
        { type: 'check', id: 'independent', label: '따로 떼어 사업할 수 있는 독립된 사업부문을 분할합니다' },
        { type: 'check', id: 'comprehensive', label: '그 사업부문의 자산·부채를 포괄적으로 넘깁니다' },
        { type: 'check', id: 'ownContribution', label: '분할하는 회사만의 출자로 분할합니다' },
        { type: 'check', id: 'realEstate', label: '부동산임대업이 주업인 사업부문 등을 분할합니다' }] },
      { type: 'fieldset', id: 'fs-common', legend: '대가·사업·고용 요건', when: function (v) { return !(v.mode === 'merger' && v.whollyOwned); }, items: [
        { type: 'two', items: [
          { type: 'number', id: 'stockPct', label: '주주가 받는 대가 중 주식 비율', unit: '%', placeholder: '예: 100' },
          { type: 'number', id: 'employeePct', label: '1개월 전 근로자 중 승계 비율', unit: '%', placeholder: '예: 90' }] },
        { type: 'check', id: 'holdShares', label: '지배주주 등이 받은 주식을 그 사업연도 말까지 보유합니다' },
        { type: 'check', id: 'continueBiz', label: '넘겨받은 사업을 그 사업연도 말까지 계속합니다' },
        { type: 'check', id: 'keepEmployees', label: '승계한 근로자 비율을 그 사업연도 말까지 유지합니다' }] }
    ],
    run: function (v) {
      var r = window.CorpLawRules.reorg(v);
      if (r.status === 'INVALID') return { r: r };
      var body = r.checks.length ? grid(['요건', '충족'], r.checks.map(function (c) { return [c.label, c.ok ? '충족' : '미충족']; })) : '';
      return { r: r, cls: r.qualified ? 'not-target' : 'target', title: r.qualified ? '적격' + (v.mode === 'split' ? '분할' : '합병') + ' 요건을 갖춘 것으로 보입니다' : '적격 요건 ' + r.failed + '개를 충족하지 못했습니다',
        sub: r.qualified ? '양도손익 과세이연 가능(사후관리 필요)' : '비적격이면 양도손익 과세, 의제배당 등 검토 필요', body: body, topic: 'fdd', label: '합병·분할 세무 검토 상담 신청' };
    }
  });

  // ── 21. 배당가능이익·자기주식 취득 한도 ──
  E.register('distributable-profit', {
    fields: [
      { type: 'fieldset', legend: '직전 결산기 재무상태표 (같은 단위로)', items: [{ type: 'two', items: [
        { type: 'number', id: 'netAssets', label: '순자산액(자본총계)', unit: '백만원', placeholder: '예: 10000' },
        { type: 'number', id: 'capital', label: '자본금', unit: '백만원' },
        { type: 'number', id: 'capitalReserve', label: '자본준비금(주식발행초과금 등)', unit: '백만원' },
        { type: 'number', id: 'earnedReserve', label: '이익준비금', unit: '백만원' },
        { type: 'number', id: 'unrealized', label: '미실현이익(평가이익)', unit: '백만원', hint: '공정가치 평가 등으로 늘어난 순자산' }] }] },
      { type: 'fieldset', legend: '계획 (선택)', items: [{ type: 'two', items: [
        { type: 'number', id: 'dividend', label: '현금배당 예정액', unit: '백만원' },
        { type: 'number', id: 'treasury', label: '자기주식 취득 예정액', unit: '백만원' }] }] }
    ],
    run: function (v) {
      var r = window.CorpLawRules.distributable(v);
      if (r.status === 'INVALID') return { r: r };
      var M = function (x) { return n(x) + ' 백만원'; };
      var body = table([['배당가능이익(이번 적립분 제외)', M(r.baseAmount), true], ['이익준비금 추가 적립 여지', M(r.reserveRoom)], ['최대 현금배당(적립분 반영)', M(r.maxCashDividend), true], ['자기주식 취득 한도', M(r.treasuryLimit), true],
        r.reserveToSet !== undefined ? ['예정 배당 시 적립할 이익준비금', M(r.reserveToSet)] : null, r.dividendLimit !== undefined ? ['예정 배당 가능 여부', r.dividendOk ? '한도 안 (' + M(r.dividendLimit) + ')' : '한도 초과 (' + M(r.dividendLimit) + ')'] : null,
        r.treasuryOk !== undefined ? ['예정 자기주식 취득 가능 여부', r.treasuryOk ? '한도 안' : '한도 초과'] : null]);
      var bad = r.dividendOk === false || r.treasuryOk === false;
      return { r: r, cls: r.baseAmount <= 0 || bad ? 'target' : 'not-target', title: r.baseAmount > 0 ? '배당가능이익 ' + M(r.baseAmount) : '배당가능이익이 없습니다', sub: '최대 현금배당 ' + M(r.maxCashDividend) + ' · 자기주식 한도 ' + M(r.treasuryLimit), body: body, topic: 'ifrs', label: '배당·자기주식 검토 상담 신청' };
    }
  });

  // ── 22. 가산세 계산 (베타) ──
  E.register('tax-penalty', {
    fields: [
      { type: 'radio', id: 'kind', label: '어떤 경우인가요?', options: [['none', '기한까지 신고하지 않았습니다 (무신고)'], ['under', '신고했지만 세액을 적게 신고했습니다 (과소신고)']] },
      { type: 'two', items: [
        { type: 'number', id: 'tax', label: '무신고·과소신고한 납부세액', unit: '원', placeholder: '예: 10000000' },
        { type: 'number', id: 'fraudTax', label: '그중 부정행위(장부 조작 등)로 인한 세액', unit: '원', when: function (v) { return v.kind === 'under'; } }] },
      { type: 'check', id: 'fraud', label: '부정행위로 신고하지 않았습니다', when: function (v) { return v.kind === 'none'; } },
      { type: 'check', id: 'offshore', label: '역외거래에서 발생한 부정행위입니다 (60%)' },
      { type: 'check', id: 'bookkeeper', label: '법인 또는 복식부기의무자이며 법인세·소득세 신고입니다 (수입금액 기준 비교)' },
      { type: 'two', items: [
        { type: 'number', id: 'revenue', label: '수입금액(매출액)', unit: '원', when: function (v) { return v.bookkeeper && v.kind === 'none'; } },
        { type: 'number', id: 'fraudRevenue', label: '부정 과소신고 수입금액', unit: '원', when: function (v) { return v.bookkeeper && v.kind === 'under'; } },
        { type: 'number', id: 'zeroRateBase', label: '부가세 영세율 과세표준(무신고·과소신고분)', unit: '원', placeholder: '없으면 비움' }] },
      { type: 'fieldset', legend: '날짜 (감면·납부지연 계산)', items: [{ type: 'two', items: [
        { type: 'date', id: 'deadline', label: '법정신고·납부기한' },
        { type: 'date', id: 'filedOn', label: '기한 후 신고·수정신고한(할) 날', hint: '신고 시기에 따라 가산세 감면' },
        { type: 'number', id: 'unpaid', label: '기한까지 내지 않은 세액', unit: '원' },
        { type: 'date', id: 'paidOn', label: '실제 납부한(할) 날' }] }] },
      { type: 'check', id: 'noticed', label: '세무서가 경정(결정)할 것을 알고 신고합니다 (감면 없음)' }
    ],
    run: function (v) {
      var r = window.CorpLawRules.penalty(v);
      if (r.status === 'INVALID') return { r: r };
      return { r: r, cls: r.total ? 'target' : 'not-target', title: '가산세 합계 ' + won(r.total), sub: (v.kind === 'under' ? '과소신고' : '무신고') + '가산세 ' + won(r.filingPenalty) + (r.reductionPct ? ' (' + r.reductionPct + '% 감면 후)' : '') + ' · 납부지연 ' + won(r.latePenalty),
        body: table([[(v.kind === 'under' ? '과소신고' : '무신고') + '가산세(감면 전)', won(r.basePenalty)], ['감면율', r.reductionPct + '%'], ['신고 관련 가산세', won(r.filingPenalty), true], ['납부지연 일수', r.lateDays + '일'], ['납부지연가산세', won(r.latePenalty), true], ['합계', won(r.total), true]]), topic: 'tax', label: '수정신고·가산세 상담 신청' };
    }
  });

  // ── 19. 원천징수 계산 ──
  E.register('withholding', {
    fields: function () { return [
      { type: 'select', id: 'type', label: '소득 구분', options: Object.keys(window.TaxCalcRules.WH).map(function (k) { return [k, window.TaxCalcRules.WH[k].label]; }) },
      { type: 'radio', id: 'mode', label: '입력하는 금액', options: [['gross', '세전 지급액'], ['net', '세후 실수령액 (지급액 역산)']] },
      { type: 'number', id: 'amount', label: '금액', unit: '원', placeholder: '예: 1000000' }
    ]; },
    run: function (v) {
      var r = window.TaxCalcRules.withholding({ type: v.type, amount: v.amount, grossUp: v.mode === 'net' });
      if (r.status === 'INVALID') return { r: r };
      return { r: r, cls: 'exempt', title: '원천징수 ' + won(r.tax + r.localTax) + ' · 실지급 ' + won(r.net), sub: r.label + ' · 실효세율 ' + n(r.effectivePct) + '%',
        body: table([['세전 지급액', won(r.gross), true], ['소득금액', won(r.incomeAmount)], ['소득세', won(r.tax)], ['지방소득세', won(r.localTax)], ['실지급액', won(r.net), true]]), topic: 'tax', label: '원천세 상담 신청' };
    }
  });

  // ── 22. 임원 퇴직금 한도 (2026-11-13, docs/49) ──
  E.register('exec-retirement', {
    fields: [
      { type: 'number', id: 'pay', label: '임원 퇴직금 지급액', unit: '만원', placeholder: '예: 50000' },
      { type: 'radio', id: 'hasRule', label: '정관(또는 정관에서 위임한 퇴직급여지급규정)에 임원 퇴직금 금액이나 계산 기준이 있나요?', options: [['yes', '예'], ['no', '아니오']] },
      { type: 'number', id: 'ruleAmount', label: '정관·규정에 따라 계산한 금액', unit: '만원', when: function (v) { return v.hasRule === 'yes'; }, hint: '예: 퇴직 전 월급 × 근속연수 × 지급배수' },
      { type: 'number', id: 'salary1y', label: '퇴직 전 1년 동안 받은 총급여(봉급·상여, 비과세 제외)', unit: '만원', when: function (v) { return v.hasRule !== 'yes'; } },
      { type: 'two', items: [
        { type: 'date', id: 'start', label: '임원 취임일' },
        { type: 'date', id: 'end', label: '퇴직일' }] },
      { type: 'date', id: 'empStart', label: '직원 입사일 (선택)', when: function (v) { return v.hasRule !== 'yes'; }, hint: '직원에서 임원이 될 때 퇴직금을 받지 않았다면 직원 기간도 근속연수에 넣을 수 있습니다' },
      { type: 'fieldset', legend: '소득세법 한도용 연평균 총급여', intro: '3년 미만 근무했다면 그 기간의 총급여를 연 단위로 환산한 금액을 넣습니다.', items: [{ type: 'two', items: [
        { type: 'number', id: 'avg2019', label: '2019년 말부터 거꾸로 3년 연평균 총급여', unit: '만원', hint: '2019년 이전 근무가 없으면 비움' },
        { type: 'number', id: 'avgRetire', label: '퇴직일부터 거꾸로 3년 연평균 총급여', unit: '만원' }] }] }
    ],
    run: function (v) {
      var r = window.OwnerTaxRules.execRetire(v);
      if (r.status === 'INVALID') return { r: r };
      var mo = function (m) { return Math.floor(m / 12) + '년 ' + (m % 12) + '개월'; };
      var body = '<h3>법인세 — 손금 한도</h3>' + table([
        ['근속기간(1개월 미만 버림)', mo(r.corpMonths)],
        ['손금 한도', won(r.corpLimit), true],
        ['한도 초과 → 손금불산입(상여)', won(r.corpExcess), true]]) +
        '<h3>소득세 — 임원 퇴직소득 한도</h3>' + table([
        ['퇴직소득 대상 금액', won(r.retireBase)],
        r.pre2012 ? ['2011년 이전 근무분(한도 적용 제외)', won(r.pre2012) + ' (' + r.monthsC + '/' + r.totalMonths + '개월)'] : null,
        r.monthsA ? ['2012~2019 근무분 한도 (×3)', won(r.limitA) + ' (' + r.monthsA + '개월)'] : null,
        r.monthsB ? ['2020년 이후 근무분 한도 (×2)', won(r.limitB) + ' (' + r.monthsB + '개월)'] : null,
        ['한도 합계', won(r.taxLimit), true],
        ['한도 초과 → 근로소득', won(r.taxExcess), true],
        ['퇴직소득으로 남는 금액', won(r.finalRetire), true]]);
      return { r: r, cls: r.wageTotal ? 'target' : 'not-target', title: r.wageTotal ? '퇴직금 중 ' + won(r.wageTotal) + '이 한도를 넘는 것으로 계산됩니다' : '퇴직금이 두 한도 안에 있는 것으로 계산됩니다',
        sub: '법인세 손금불산입 ' + won(r.corpExcess) + ' · 소득세 한도 초과 ' + won(r.taxExcess), body: body, topic: 'tax', label: '임원 퇴직금·정관 정비 상담 신청' };
    }
  });

  // ── 23. 불공정 증자·감자 증여이익 (2026-11-13, docs/49) ──
  var CG_MODES = [['issue-low', '저가 증자 — 실권주 재배정·제3자 배정·초과 배정'], ['issue-forfeit', '저가 증자 — 실권 처리 후 특수관계인이 인수'], ['cut-low', '저가 감자 — 시가보다 낮은 대가로 일부 주주 주식 소각'], ['cut-high', '고가 감자 — 시가보다 높은 대가로 일부 주주 주식 소각']];
  function isMode() { var ms = arguments; return function (v) { return Array.prototype.indexOf.call(ms, v.mode) >= 0; }; }
  E.register('capital-gift', {
    fields: [
      { type: 'select', id: 'mode', label: '거래 유형', options: CG_MODES },
      { type: 'fieldset', id: 'fs-issue', legend: '증자 정보 (1주당 금액은 원)', when: isMode('issue-low', 'issue-forfeit'), items: [{ type: 'two', items: [
        { type: 'number', id: 'preValue', label: '증자 전 1주당 평가액(시가)', unit: '원', placeholder: '예: 10000', hint: '비상장주식은 상증법 보충적 평가액' },
        { type: 'number', id: 'issuePrice', label: '신주 1주당 인수가액', unit: '원', placeholder: '예: 5000' },
        { type: 'number', id: 'preShares', label: '증자 전 발행주식총수', unit: '주' },
        { type: 'number', id: 'newShares', label: '증자로 늘어난 주식수', unit: '주', when: isMode('issue-low') },
        { type: 'number', id: 'gotShares', label: '이익을 본 사람이 배정받은 실권주·신주 수', unit: '주', when: isMode('issue-low'), hint: '기존 주주가 지분율보다 더 받았다면 초과분만' },
        { type: 'number', id: 'equalNew', label: '지분율대로 균등 증자했을 때 늘어날 주식수', unit: '주', when: isMode('issue-forfeit'), hint: '보통 당초 발행 예정 신주 수' },
        { type: 'number', id: 'forfeitTotal', label: '실권주 총수', unit: '주', when: isMode('issue-forfeit') },
        { type: 'number', id: 'relatedForfeit', label: '그중 신주인수자의 특수관계인이 포기한 주식수', unit: '주', when: isMode('issue-forfeit') },
        { type: 'number', id: 'acqPostShares', label: '신주인수자의 증자 후 주식수', unit: '주', when: isMode('issue-forfeit') },
        { type: 'number', id: 'postTotalShares', label: '증자 후 발행주식총수', unit: '주', when: isMode('issue-forfeit') }] }] },
      { type: 'fieldset', id: 'fs-cut', legend: '감자 정보 (1주당 금액은 원)', when: isMode('cut-low', 'cut-high'), items: [{ type: 'two', items: [
        { type: 'number', id: 'value', label: '감자한 주식 1주당 평가액(시가)', unit: '원', placeholder: '예: 20000' },
        { type: 'number', id: 'paid', label: '소각 때 지급한 1주당 금액', unit: '원', placeholder: '예: 5000' },
        { type: 'number', id: 'cutTotal', label: '총감자 주식수', unit: '주', when: isMode('cut-low') },
        { type: 'number', id: 'relatedCut', label: '그중 대주주의 특수관계인이 감자한 주식수', unit: '주', when: isMode('cut-low') },
        { type: 'number', id: 'majorPostShares', label: '대주주의 감자 후 주식수', unit: '주', when: isMode('cut-low') },
        { type: 'number', id: 'cutPostTotal', label: '감자 후 발행주식총수', unit: '주', when: isMode('cut-low') },
        { type: 'number', id: 'face', label: '1주당 액면가액', unit: '원', when: isMode('cut-high') },
        { type: 'number', id: 'holderCut', label: '이익을 본 주주(대주주의 특수관계인)의 감자 주식수', unit: '주', when: isMode('cut-high') }] }] }
    ],
    run: function (v) {
      var input = {}; Object.keys(v).forEach(function (k) { input[k] = v[k]; });
      if (v.mode === 'cut-low') input.postTotalShares = v.cutPostTotal;
      var r = window.OwnerTaxRules.capitalGift(input);
      if (r.status === 'INVALID') return { r: r };
      var issue = v.mode === 'issue-low' || v.mode === 'issue-forfeit';
      var rows = issue ? [['증자 후 1주당 가액(산식)', won(r.postValue)], ['1주당 차이(증자 후 가액 − 인수가액)', won(r.diff)]] : [['1주당 차이', won(Math.abs(r.diff))]];
      if (r.diffPct !== null && r.diffPct !== undefined && v.mode !== 'issue-low') rows.push(['차이 비율', n(r.diffPct) + '% (30% 이상이면 금액 기준 없음)']);
      if (v.mode === 'cut-high') rows.push(['적용 조건(평가액 < 액면가액·대가 중 작은 금액)', r.applies ? '충족' : '충족 안 함']);
      rows.push(['계산한 증여이익', won(r.gain), true]);
      if (v.mode !== 'issue-low') rows.push(['과세 기준(3억원 또는 30%)', r.taxable ? '충족' : '미달 → 과세 제외']);
      var title = !r.applies ? '이 규정의 계산 대상이 아닌 것으로 보입니다' : r.taxable ? '증여이익 약 ' + won(r.gain) + '이 과세될 수 있습니다' : '증여이익이 과세 기준에 못 미치는 것으로 보입니다';
      return { r: r, cls: r.taxable ? 'target' : 'not-target', title: title, sub: CG_MODES.filter(function (m) { return m[0] === v.mode; })[0][1], body: table(rows), topic: 'tax', label: '증자·감자 세무 검토 상담 신청' };
    }
  });

  // ── 24. 성실신고확인 대상 판정 (2026-11-13, docs/49) ──
  E.register('sincere-filing', {
    submit: '판정하기',
    fields: function () { var SF = window.OwnerTaxRules.SF; return [
      { type: 'fieldset', legend: '업종별 해당 연도 수입금액(매출)', intro: '해당하는 칸만 입력합니다. 사업장이 여러 곳이면 업종별로 합칩니다. 사업용 유형자산 양도 수입은 뺍니다.', items: [
        { type: 'number', id: 'g1', label: '1군: ' + SF[1].label + ' (기준 15억원)', unit: '만원', placeholder: '예: 100000' },
        { type: 'number', id: 'g2', label: '2군: ' + SF[2].label + ' (기준 7억5천만원)', unit: '만원' },
        { type: 'number', id: 'g3', label: '3군: ' + SF[3].label + ' (기준 5억원)', unit: '만원', hint: '1·2군 업종이라도 소득세법 시행령 별표 3의3 사업서비스업이면 여기에 넣습니다' }] }
    ]; },
    run: function (v) {
      var r = window.OwnerTaxRules.sincereFiling(v);
      if (r.status === 'INVALID') return { r: r };
      var body = grid(['업종군', '수입금액', '기준금액'], r.groups.filter(function (g) { return g.revenue; }).map(function (g) { return [g.key + '군' + (g.key === r.main ? ' (주업종)' : ''), won(g.revenue), won(g.limit)]; })) +
        table([['주업종 기준으로 환산한 수입금액', won(r.converted), true], ['성실신고확인 기준', won(r.limit)], ['복식부기의무 기준(참고)', won(r.bookLimit) + ' → ' + (r.bookkeeping ? '이상' : '미만')]]);
      return { r: r, cls: r.target ? 'target' : 'not-target', title: r.target ? '성실신고확인 대상으로 판단됩니다' : '성실신고확인 대상이 아닌 것으로 보입니다',
        sub: r.target ? '종합소득세 확정신고 기한이 다음 해 6월 30일로 늘어나고, 세무사 등의 확인서가 필요합니다' : '환산 수입금액이 기준보다 ' + won(r.limit - r.converted) + ' 적습니다', body: body, topic: 'tax', label: '법인 전환·성실신고 상담 신청' };
    }
  });
})();
