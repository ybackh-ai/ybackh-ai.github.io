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
        { type: 'number', id: 'minIncrease', label: '최소고용증가인원수', unit: '명', when: function (v) { return v.size !== 'sme'; }, hint: '비워 두면 시행령 기준(중견기업 5명, 그 밖의 기업 10명)으로 계산' },
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
        r.newGrowthCredit ? ['신성장·원천기술 (' + r.ngRate + '%)', won(r.newGrowthCredit)] : null, r.strategicCredit ? ['국가전략기술 (' + r.stRate + '%)', won(r.strategicCredit)] : null, ['공제액 합계', won(r.credit), true],
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
      { type: 'check', id: 'fraud', label: '피상속인·상속인이 가업 관련 조세포탈·회계부정으로 형이 확정됐습니다' },
      { type: 'fieldset', legend: '세부 요건 (시행령 제15조제3항) — 모르면 비워 두세요', items: [
        { type: 'radio', id: 'ownerShare', label: '피상속인이 최대주주이고, 특수관계인과 합쳐 지분 40%(상장법인 20%) 이상을 10년 이상 계속 보유했나요?', options: [['unknown', '모르겠음'], ['yes', '예'], ['no', '아니오']] },
        { type: 'radio', id: 'ceoTenure', label: '피상속인이 대표이사로 ① 가업 기간의 50% 이상, ② 10년 이상(상속인이 그 자리를 이어받아 계속 재직), ③ 상속 전 10년 중 5년 이상 중 하나를 채웠나요?', options: [['unknown', '모르겠음'], ['yes', '예'], ['no', '아니오']] },
        { type: 'radio', id: 'heirReq', label: '상속인(또는 배우자)이 18세 이상이고, 상속 전 2년 이상 가업에 종사했고, 신고기한까지 임원·그 후 2년 안에 대표이사로 취임하나요?', options: [['unknown', '모르겠음'], ['yes', '예'], ['no', '아니오']] }] },
      { type: 'two', items: [
        { type: 'number', id: 'otherAssets', label: '상속인이 받는 가업 외 상속재산(채무 차감)', unit: '억원', when: function (v) { return v.size === 'mid'; } },
        { type: 'number', id: 'heirTax', label: '그 상속인이 낼 상속세(가업상속공제 전)', unit: '억원', when: function (v) { return v.size === 'mid'; } }] }
    ],
    run: function (v) {
      var r = window.GainsSuccessionRules.succession(v);
      if (r.status === 'INVALID') return { r: r };
      var body = grid(['요건', '결과'], r.checks.map(function (c) { return [c.label, c.ok === null ? '확인 필요' : c.ok ? '충족' : '미충족']; })) +
        table([['공제 한도', r.limit ? r.limit + '억원' : '-'], ['예상 공제액', r.deduction + '억원', true]]);
      return { r: r, cls: r.eligible ? 'target' : 'not-target', title: r.eligible ? (r.pending ? '입력한 요건은 충족합니다 (최대 ' + r.deduction + '억원 공제, ' + r.pending + '개 요건 확인 필요)' : '가업상속공제 요건을 충족하는 것으로 보입니다 (최대 ' + r.deduction + '억원 공제)') : '가업상속공제 요건을 충족하지 못하는 것으로 보입니다', sub: r.pending ? '"확인 필요" 요건을 하나라도 못 채우면 공제를 받을 수 없습니다' : '사후관리 5년 요건을 지켜야 추징되지 않습니다', body: body, topic: 'tax', label: '가업승계 상담 신청' };
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
        { type: 'check', id: 'realEstate', label: '부동산임대업이 주업인 사업부문이거나, 넘기는 사업용 자산 중 토지·건물 등 부동산이 80% 이상입니다' }] },
      { type: 'fieldset', id: 'fs-common', legend: '대가·사업·고용 요건', when: function (v) { return !(v.mode === 'merger' && v.whollyOwned); }, items: [
        { type: 'two', items: [
          { type: 'number', id: 'stockPct', label: '주주가 받는 대가 중 주식 비율', unit: '%', placeholder: '예: 100' },
          { type: 'number', id: 'employeePct', label: '1개월 전 근로자 중 승계 비율', unit: '%', placeholder: '예: 90' }] },
        { type: 'check', id: 'holdShares', label: '지배주주 등에게 지분비율 이상으로 주식을 배정하고, 그 주식을 사업연도 말까지 보유합니다 (4촌 혈족, 지분 1% 미만이면서 10억원 미만인 주주는 제외)' },
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

  // ── 25~27. 재무분석 추가 (2026-11-17, docs/51) ──
  function days(x) { return n(x) + '일'; }
  function times(x) { return x === null ? '계산 불가' : n(x) + '배'; }
  E.register('working-capital', {
    fields: [
      { type: 'two', items: [
        { type: 'number', id: 'revenue', label: '연 매출액', unit: '만원', placeholder: '예: 365000' },
        { type: 'number', id: 'cogs', label: '연 매출원가', unit: '만원', placeholder: '예: 292000', hint: '서비스업처럼 재고가 없으면 0' }] },
      { type: 'fieldset', legend: '재무상태표 잔액 (기말 또는 기초·기말 평균)', items: [
        { type: 'two', items: [
          { type: 'number', id: 'ar', label: '매출채권(외상매출금·받을어음)', unit: '만원', placeholder: '예: 60000' },
          { type: 'number', id: 'inv', label: '재고자산', unit: '만원', placeholder: '예: 40000' }] },
        { type: 'number', id: 'ap', label: '매입채무(외상매입금·지급어음)', unit: '만원', placeholder: '예: 32000' }] }
    ],
    run: function (v) {
      var r = window.FinAnalysisRules.workingCapital(v);
      if (r.status === 'INVALID') return { r: r };
      var body = table([
        ['매출채권 회수 기간', days(r.arDays)],
        ['재고자산 보유 기간', days(r.invDays)],
        ['매입채무 지급 기간', days(r.apDays)],
        ['현금전환주기(CCC)', days(r.ccc), true],
        ['순운전자본(매출채권 + 재고 − 매입채무)', won(r.nwc)],
        ['하루 매출액', won(r.perDay)],
        ['현금전환주기만큼 묶인 돈(추정)', won(r.cashTied), true],
        ['회수 기간을 10일 줄이면 늘어나는 현금(추정)', won(r.perDay * 10)]]);
      var neg = r.ccc < 0;
      return { r: r, cls: neg ? 'not-target' : 'target', title: neg ? '매입 대금을 치르기 전에 판매 대금이 먼저 들어오는 구조입니다' : '물건을 사서 현금으로 돌아오기까지 약 ' + days(r.ccc) + '이 걸립니다',
        sub: '현금전환주기 ' + days(r.ccc) + ' · 묶인 돈(추정) ' + won(r.cashTied), body: body, topic: 'ifrs', label: '운전자본·자금 계획 상담 신청' };
    }
  });

  E.register('break-even', {
    fields: [
      { type: 'number', id: 'revenue', label: '연 매출액', unit: '만원', placeholder: '예: 100000' },
      { type: 'two', items: [
        { type: 'number', id: 'variable', label: '변동비 합계', unit: '만원', placeholder: '예: 60000', hint: '재료비·외주비·판매수수료처럼 매출에 비례하는 비용' },
        { type: 'number', id: 'fixed', label: '고정비 합계', unit: '만원', placeholder: '예: 30000', hint: '임차료·정규직 급여·감가상각비처럼 매출과 관계없는 비용' }] },
      { type: 'number', id: 'target', label: '목표 영업이익 (선택)', unit: '만원', hint: '넣으면 그 이익을 내는 데 필요한 매출액도 계산합니다' }
    ],
    run: function (v) {
      var r = window.FinAnalysisRules.breakEven(v);
      if (r.status === 'INVALID') return { r: r };
      var body = table([
        ['공헌이익률', n(r.cmRatio) + '%'],
        ['손익분기점 매출액', won(r.bep), true],
        ['안전한계율 (매출이 몇 % 줄면 적자인지)', n(r.safety) + '%', true],
        ['현재 영업이익', won(r.opIncome)],
        ['영업레버리지도(DOL)', r.dol === null ? '적자라 계산하지 않음' : n(r.dol) + '배 (매출 1% 변동 → 영업이익 ' + n(r.dol) + '% 변동)'],
        r.targetSales === null ? null : ['목표 영업이익을 위한 매출액', won(r.targetSales), true]]);
      var loss = r.safety < 0;
      return { r: r, cls: loss ? 'target' : 'not-target', title: loss ? '현재 매출은 손익분기점보다 ' + n(-r.safety) + '% 모자랍니다' : '매출이 ' + n(r.safety) + '% 넘게 줄면 적자로 돌아섭니다',
        sub: '손익분기점 매출액 ' + won(r.bep) + ' · 공헌이익률 ' + n(r.cmRatio) + '%', body: body, topic: 'etc', label: '사업계획·원가 구조 상담 신청' };
    }
  });

  E.register('debt-capacity', {
    fields: [
      { type: 'two', items: [
        { type: 'number', id: 'op', label: '영업이익 (적자면 음수)', unit: '만원', placeholder: '예: 50000', allowNeg: true },
        { type: 'number', id: 'dep', label: '감가상각비 + 무형자산상각비', unit: '만원', placeholder: '예: 20000' }] },
      { type: 'number', id: 'interest', label: '연 이자비용', unit: '만원', placeholder: '예: 10000' },
      { type: 'two', items: [
        { type: 'number', id: 'debt', label: '총차입금 (단기·장기차입금·사채)', unit: '만원', placeholder: '예: 300000', hint: '리스부채를 넣을지는 대출 약정 기준을 따릅니다' },
        { type: 'number', id: 'cash', label: '현금성자산', unit: '만원', placeholder: '예: 50000' }] }
    ],
    run: function (v) {
      var r = window.FinAnalysisRules.debtCapacity(v);
      if (r.status === 'INVALID') return { r: r };
      var body = table([
        ['EBITDA', won(r.ebitda), true],
        [r.netCash ? '순현금 (현금 − 차입금)' : '순차입금 (차입금 − 현금)', won(Math.abs(r.netDebt))],
        ['순차입금 / EBITDA', r.netCash ? '순현금 상태' : times(r.ndEbitda), true],
        ['이자보상배율 (영업이익 ÷ 이자)', r.icr === null ? '이자비용 없음' : times(r.icr), true],
        ['EBITDA 이자보상배율', r.ebitdaIcr === null ? '이자비용 없음' : times(r.ebitdaIcr)]]);
      var weak = r.icr !== null && r.icr < 1;
      var title = weak ? '영업이익으로 이자를 다 갚지 못하는 상태입니다'
        : r.netCash ? '현금이 차입금보다 많은 순현금 상태입니다'
        : r.ndEbitda === null ? 'EBITDA가 0 이하라 상환 기간을 계산할 수 없습니다'
        : '지금 EBITDA로 순차입금을 갚는 데 약 ' + n(r.ndEbitda) + '년이 걸리는 수준입니다';
      return { r: r, cls: weak || r.ndEbitda === null && !r.netCash ? 'target' : 'not-target', title: title,
        sub: 'EBITDA ' + won(r.ebitda) + (r.icr === null ? '' : ' · 이자보상배율 ' + times(r.icr)), body: body, topic: 'fdd', label: '차입·재무구조 상담 신청' };
    }
  });

  // ── 28~34. 결산·회계처리 7종 (2026-11-19, docs/57) ──
  var STD2 = [['kifrs', 'K-IFRS'], ['kgaap', '일반기업회계기준']];
  function signed(x) { return (x > 0 ? '+' : x < 0 ? '−' : '') + won(Math.abs(x)); }

  E.register('dev-cost', {
    submit: '진단하기',
    fields: function () { return [
      { type: 'radio', id: 'stage', label: '이 프로젝트는 지금 어느 단계인가요?', options: [['development', '개발단계 (시제품·최종안 설계·시험 등)'], ['research', '연구단계 (새 지식 탐색·대안 검토)'], ['unclear', '둘을 구분하기 어렵습니다']] },
      { type: 'fieldset', id: 'devCritBox', legend: '자산 인식 요건 (모두 제시할 수 있어야 함)', intro: '내부 문서(사업계획·기술검토서·예산·원가 집계표)로 보여 줄 수 있는 항목만 체크합니다.', when: function (v) { return v.stage === 'development'; }, items: [
        { type: 'checks', id: 'criteria', label: '', options: window.ClosingRules.DEV_CRITERIA }] },
      { type: 'two', items: [
        { type: 'number', id: 'spendBefore', label: '요건을 모두 충족하기 전 지출', unit: '만원', placeholder: '예: 3000' },
        { type: 'number', id: 'spendAfter', label: '요건을 모두 충족한 뒤 지출', unit: '만원', placeholder: '예: 7000', hint: '인건비·재료비·외주비 등 개발에 직접 관련된 원가' }] }
    ]; },
    run: function (v) {
      var r = window.ClosingRules.devCost(v);
      if (r.status === 'INVALID') return { r: r };
      var rows = [['충족한 요건', r.metCount + ' / 6'], ['개발비(무형자산)로 인식', won(r.capitalized), true], ['당기 비용(경상연구개발비)', won(r.expensed), true]];
      var body = table(rows) + (v.stage === 'development' && r.missing.length ? '<p class="hint">제시하지 못한 요건: ' + r.missing.map(esc).join(' · ') + '</p>' : '');
      var cap = r.status === 'CAPITALIZE';
      return { r: r, cls: cap ? 'target' : 'not-target', title: cap ? '개발비로 자산 인식할 수 있는 것으로 보입니다' : '비용으로 처리해야 할 것으로 보입니다',
        sub: cap ? '자산 ' + won(r.capitalized) + ' · 비용 ' + won(r.expensed) : (v.stage === 'development' ? '요건 ' + (6 - r.metCount) + '개를 제시하지 못했습니다' : '연구단계 지출은 자산이 될 수 없습니다'), body: body, topic: 'ifrs', label: '개발비 회계처리 상담 신청' };
    }
  });

  E.register('fx-translation', {
    fields: [
      { type: 'radio', id: 'kind', label: '어떤 항목인가요?', options: [['monetaryAsset', '화폐성 자산 (외화 예금·매출채권·대여금)'], ['monetaryLiability', '화폐성 부채 (외화 매입채무·차입금·사채)'], ['nonmonetary', '비화폐성 항목 (선급금·선수금·재고·유형자산)']] },
      { type: 'number', id: 'fcy', label: '외화 금액', unit: '외화', placeholder: '예: 100000', hint: '달러·엔·유로 등 원래 통화 금액' },
      { type: 'two', items: [
        { type: 'number', id: 'bookRate', label: '장부상 환율 (거래일 또는 전기 말)', unit: '원', placeholder: '예: 1350' },
        { type: 'number', id: 'closingRate', label: '보고기간 말 마감환율', unit: '원', placeholder: '예: 1450', hint: '서울외국환중개 매매기준율 등 회사가 쓰는 기준' }] }
    ],
    run: function (v) {
      var r = window.ClosingRules.fxTranslation(v);
      if (r.status === 'INVALID') return { r: r };
      var body = table([['장부상 원화 금액', won(r.bookKrw)], ['결산 후 원화 금액', won(r.translated), true], [r.gain >= 0 ? '외화환산이익' : '외화환산손실', signed(r.gain), true]]);
      var title = v.kind === 'nonmonetary' ? '비화폐성 항목은 다시 환산하지 않습니다' : r.gain > 0 ? '외화환산이익 ' + won(r.gain) + '이 생깁니다' : r.gain < 0 ? '외화환산손실 ' + won(-r.gain) + '이 생깁니다' : '환산 차이가 없습니다';
      return { r: r, cls: r.gain < 0 ? 'target' : 'not-target', title: title, sub: '당기손익에 반영 · 결산 후 장부금액 ' + won(r.translated), body: body, topic: 'ifrs', label: '외화 결산 상담 신청' };
    }
  });

  E.register('inventory-lcm', {
    fields: [
      { type: 'radio', id: 'kind', label: '재고 종류', options: [['goods', '상품·제품·재공품'], ['raw', '원재료']] },
      { type: 'check', id: 'finishedAboveCost', label: '이 원재료로 만들 제품은 원가 이상으로 팔릴 것으로 예상됩니다', when: function (v) { return v.kind === 'raw'; } },
      { type: 'number', id: 'cost', label: '장부상 취득원가', unit: '만원', placeholder: '예: 5000', hint: '항목(또는 비슷한 제품군)별로 계산합니다' },
      { type: 'fieldset', legend: '순실현가능가치 = 예상 판매가격 − 추가 완성원가 − 판매비용', items: [
        { type: 'number', id: 'sales', label: '예상 판매가격 합계', unit: '만원', placeholder: '예: 4800', hint: '원재료는 현행대체원가(지금 다시 사는 값)를 넣어도 됩니다' },
        { type: 'two', items: [
          { type: 'number', id: 'completion', label: '추가 완성원가', unit: '만원', placeholder: '없으면 비움' },
          { type: 'number', id: 'selling', label: '예상 판매비용', unit: '만원', placeholder: '예: 200' }] }] },
      { type: 'number', id: 'prior', label: '기존 재고자산평가충당금 잔액', unit: '만원', placeholder: '없으면 비움' }
    ],
    run: function (v) {
      var r = window.ClosingRules.inventoryLcm(v);
      if (r.status === 'INVALID') return { r: r };
      var body = table([['순실현가능가치', won(r.nrv)], ['필요한 평가충당금', won(r.allowance), true], ['결산 후 장부금액', won(r.carrying)], [r.charge >= 0 ? '당기 평가손실(매출원가 가산)' : '당기 평가손실 환입(매출원가 차감)', won(Math.abs(r.charge)), true]]);
      var title = r.status === 'LOSS' ? '재고자산평가손실 ' + won(r.charge) + '을 인식합니다' : r.status === 'REVERSAL' ? '평가손실 ' + won(-r.charge) + '을 환입합니다' : '평가손실을 인식하지 않습니다';
      return { r: r, cls: r.status === 'LOSS' ? 'target' : 'not-target', title: title, sub: '순실현가능가치 ' + won(r.nrv) + ' · 충당금 ' + won(r.allowance), body: body, topic: 'ifrs', label: '재고 평가 상담 신청' };
    }
  });

  E.register('gov-grant', {
    fields: [
      { type: 'radio', id: 'type', label: '보조금 종류', options: [['asset', '자산관련보조금 (설비·건물 취득 지원)'], ['income', '수익관련보조금 (인건비·운영비 지원)']] },
      { type: 'number', id: 'grant', label: '받은 보조금', unit: '만원', placeholder: '예: 4000', hint: '상환 의무가 없는 금액' },
      { type: 'check', id: 'conditionMet', label: '보조금 사용 조건을 이미 충족했습니다', value: true, when: function (v) { return v.type === 'income'; } },
      { type: 'fieldset', id: 'grantAssetBox', legend: '보조금으로 산 자산', when: function (v) { return v.type === 'asset'; }, items: [
        { type: 'two', items: [
          { type: 'number', id: 'assetCost', label: '자산 취득원가', unit: '만원', placeholder: '예: 10000' },
          { type: 'number', id: 'life', label: '내용연수', unit: '년', placeholder: '예: 5' }] },
        { type: 'two', items: [
          { type: 'number', id: 'residual', label: '잔존가치', unit: '만원', placeholder: '없으면 비움' },
          { type: 'number', id: 'months', label: '첫해 사용 개월 수', unit: '개월', placeholder: '12', hint: '정액법·월할 기준' }] },
        { type: 'select', id: 'standard', label: '적용 회계기준', options: STD2 },
        { type: 'radio', id: 'method', label: '표시 방법', options: [['deduct', '자산에서 차감'], ['deferred', '이연수익(부채)으로 표시 — K-IFRS만']] }] }
    ],
    run: function (v) {
      var r = window.ClosingRules.govGrant(v);
      if (r.status === 'INVALID') return { r: r };
      if (v.type === 'income') {
        return { r: r, cls: r.status === 'INCOME' ? 'not-target' : 'target', title: r.status === 'INCOME' ? '보조금 ' + won(r.grantIncome) + '을 당기 손익에 반영합니다' : '보조금 ' + won(r.deferred) + '을 선수수익으로 둡니다',
          sub: '수익관련보조금', body: table([['당기 손익 반영', won(r.grantIncome), true], ['선수수익(부채)', won(r.deferred)]]), topic: 'ifrs', label: '정부보조금 회계처리 상담 신청' };
      }
      var body = table([['첫해 감가상각비', won(r.depreciation)], [r.methodUsed === 'deduct' ? '보조금 상계액(감가상각비 차감)' : '이연수익 환입(수익)', won(r.grantAmort), true], ['보조금 반영 후 순비용', won(r.netDep), true], ['첫해 말 순장부금액(취득원가 − 보조금 − 순상각)', won(r.netCarrying)]]);
      return { r: r, cls: 'not-target', title: '첫해 순비용은 ' + won(r.netDep) + '입니다', sub: (r.methodUsed === 'deduct' ? '자산 차감 방식' : '이연수익 방식') + ' · 감가상각비 ' + won(r.depreciation) + ' 중 ' + won(r.grantAmort) + ' 상계', body: body, topic: 'ifrs', label: '정부보조금 회계처리 상담 신청' };
    }
  });

  E.register('unused-leave', {
    fields: [
      { type: 'two', items: [
        { type: 'number', id: 'days', label: '결산일 현재 미사용 연차 일수 합계', unit: '일', placeholder: '예: 120', hint: '수당으로 받거나 다음 해로 넘길 수 있는 일수(전 직원 합계)' },
        { type: 'number', id: 'dailyWage', label: '1일 통상임금 (평균)', unit: '원', placeholder: '예: 150000' }] },
      { type: 'two', items: [
        { type: 'number', id: 'payoutPct', label: '수당으로 지급할 것으로 예상하는 비율', unit: '%', placeholder: '100', hint: '사용 촉진으로 소멸이 예상되면 낮춥니다' },
        { type: 'number', id: 'burdenPct', label: '사업주 부담 사회보험료율 (선택)', unit: '%', placeholder: '예: 10' }] },
      { type: 'number', id: 'prior', label: '전기 말 미지급 연차수당 (선택)', unit: '만원', placeholder: '없으면 비움' }
    ],
    run: function (v) {
      var r = window.ClosingRules.unusedLeave(v);
      if (r.status === 'INVALID') return { r: r };
      var body = table([['연차수당 예상액', won(r.base)], ['사업주 부담 보험료', won(r.burden)], ['미지급비용(부채)', won(r.liability), true], [r.change >= 0 ? '당기 추가 인식(비용)' : '당기 감소(환입)', won(Math.abs(r.change)), true]]);
      return { r: r, cls: r.liability > 0 ? 'target' : 'not-target', title: r.liability > 0 ? '미사용 연차수당 부채 ' + won(r.liability) + '을 인식합니다' : '인식할 부채가 없습니다', sub: '전기 대비 ' + signed(r.change), body: body, topic: 'ifrs', label: '결산 회계처리 상담 신청' };
    }
  });

  E.register('accrual-prepaid', {
    fields: [
      { type: 'radio', id: 'type', label: '어떤 경우인가요?', options: [['prepaid', '먼저 냈다 → 선급비용 (보험료·임차료·구독료)'], ['accrued', '나중에 낸다 → 미지급비용 (이자·임차료 후불)']] },
      { type: 'number', id: 'amount', label: '계약 기간 전체 금액', unit: '만원', placeholder: '예: 1200' },
      { type: 'two', items: [
        { type: 'date', id: 'start', label: '계약 시작일', value: '2026-04-01' },
        { type: 'date', id: 'end', label: '계약 종료일', value: '2027-03-31' }] },
      { type: 'two', items: [
        { type: 'date', id: 'closing', label: '결산일', value: '2026-12-31' },
        { type: 'select', id: 'method', label: '배분 방법', options: [['month', '월할 (시작 월과 결산 월 포함)'], ['day', '일할 (일수 기준)']] }] }
    ],
    run: function (v) {
      var r = window.ClosingRules.accrualPrepaid(v);
      if (r.status === 'INVALID') return { r: r };
      var unit = r.method === 'month' ? '개월' : '일';
      var body = table([['전체 기간', n(r.totalUnits) + unit], ['결산일까지 경과', n(r.elapsedUnits) + unit], ['당기 비용', won(r.currentExpense), true], [r.type === 'prepaid' ? '선급비용(자산)' : '미지급비용(부채)', won(r.balance), true]]);
      return { r: r, cls: 'not-target', title: (r.type === 'prepaid' ? '선급비용 ' : '미지급비용 ') + won(r.balance) + '을 잡습니다', sub: '당기 비용 ' + won(r.currentExpense) + ' · ' + n(r.elapsedUnits) + '/' + n(r.totalUnits) + unit, body: body, topic: 'ifrs', label: '결산 회계처리 상담 신청' };
    }
  });

  E.register('effective-interest', {
    fields: [
      { type: 'two', items: [
        { type: 'number', id: 'face', label: '액면금액(만기 상환액)', unit: '만원', placeholder: '예: 10000' },
        { type: 'number', id: 'couponRate', label: '표면이자율 (연)', unit: '%', placeholder: '예: 5', hint: '무이자면 0' }] },
      { type: 'two', items: [
        { type: 'number', id: 'years', label: '만기', unit: '년', placeholder: '예: 3' },
        { type: 'select', id: 'freq', label: '이자 지급', options: [['1', '연 1회'], ['2', '반기(연 2회)'], ['4', '분기(연 4회)']] }] },
      { type: 'fieldset', legend: '발행 조건 (둘 중 하나)', items: [
        { type: 'two', items: [
          { type: 'number', id: 'marketRate', label: '발행 시 시장이자율 (연)', unit: '%', placeholder: '예: 8' },
          { type: 'number', id: 'issuePrice', label: '또는 실제 발행가액(받은 금액)', unit: '만원', placeholder: '예: 9500', hint: '넣으면 이 금액으로 계산합니다' }] },
        { type: 'number', id: 'transactionCost', label: '거래원가(발행비용·수수료, 선택)', unit: '만원', placeholder: '없으면 비움' }] }
    ],
    run: function (v) {
      var r = window.ClosingRules.effectiveInterest(v);
      if (r.status === 'INVALID') return { r: r };
      var per = v.freq === '2' ? '반기' : v.freq === '4' ? '분기' : '연도';
      var sched = grid([per, '기초 장부금액', '이자비용(유효이자)', '표면이자 지급', '상각액', '기말 장부금액'], r.rows.map(function (x) { return [x.period + '회', won(x.begin), won(x.interest), won(x.cash), won(x.amort), won(x.end)]; }));
      var body = table([['발행가액', won(r.issuePrice)], ['최초 장부금액(발행가액 − 거래원가)', won(r.initialCarrying)], ['유효이자율 (연)', n(r.eirPct) + '%', true], ['첫 회 이자비용', won(r.firstInterest)], ['만기까지 총이자비용', won(r.totalInterest), true], ['그중 표면이자', won(r.couponTotal)]]) + sched;
      var label = r.status === 'DISCOUNT' ? '할인발행' : r.status === 'PREMIUM' ? '할증발행' : '액면발행';
      return { r: r, cls: 'not-target', title: label + ' · 유효이자율 연 ' + n(r.eirPct) + '%', sub: '첫 회 이자비용 ' + won(r.firstInterest) + ' · 총이자비용 ' + won(r.totalInterest), body: body, topic: 'ifrs', label: '차입금·사채 회계처리 상담 신청' };
    }
  });

  // ── 35~40. 재무분석 추가 6종 (2026-11-19, docs/58) ──
  function F2() { return window.FinAnalysis2Rules; }
  function pctS(x) { return x === null || x === undefined ? '계산 불가' : n(x) + '%'; }
  function mo(x) { return n(x) + '개월'; }

  E.register('runway', {
    fields: [
      { type: 'number', id: 'cash', label: '현재 현금 잔고', unit: '만원', placeholder: '예: 30000' },
      { type: 'two', items: [
        { type: 'number', id: 'monthlyRevenue', label: '월 매출(현금 유입)', unit: '만원', placeholder: '예: 1000' },
        { type: 'number', id: 'monthlyCost', label: '월 지출(인건비·임차료 등 전부)', unit: '만원', placeholder: '예: 3500' }] },
      { type: 'two', items: [
        { type: 'number', id: 'revenueGrowthPct', label: '월 매출 성장률 (선택)', unit: '%', placeholder: '예: 5', allowNeg: true },
        { type: 'number', id: 'costGrowthPct', label: '월 지출 증가율 (선택)', unit: '%', placeholder: '없으면 비움', allowNeg: true }] }
    ],
    run: function (v) {
      var r = F2().runway(v);
      if (r.status === 'INVALID') return { r: r };
      var rows = [['현재 번레이트(월)', r.burn > 0 ? won(r.burn) : '현금이 줄지 않음', true],
        ['런웨이', r.runwayMonths !== null ? mo(r.runwayMonths) : (r.status === 'LONG' ? '120개월 이상' : '현금이 바닥나지 않음'), true],
        ['손익분기 도달', r.breakevenMonth === 0 ? '이미 흑자' : r.breakevenMonth !== null ? r.breakevenMonth + '개월째' : '120개월 안에 도달하지 않음'],
        r.fundingGap !== null ? ['손익분기까지 더 필요한 자금(추정)', won(r.fundingGap), true] : null,
        r.status === 'REACH' ? ['손익분기 직전 최저 현금', won(r.minCash)] : null];
      var title = r.status === 'PROFITABLE' ? '이미 매출이 지출보다 많습니다' : r.status === 'REACH' ? r.breakevenMonth + '개월째 손익분기에 도달하고 현금이 버팁니다'
        : r.status === 'LONG' ? '120개월 이상 버틸 수 있습니다' : '지금 속도면 약 ' + mo(r.runwayMonths) + ' 버틸 수 있습니다';
      return { r: r, cls: r.status === 'RUNOUT' ? 'target' : 'not-target', title: title, sub: r.burn > 0 ? '월 번레이트 ' + won(r.burn) : '', body: table(rows), topic: 'fdd', label: '자금 계획·투자 유치 상담 신청' };
    }
  });

  E.register('dupont', {
    fields: [
      { type: 'fieldset', legend: '당기', items: [
        { type: 'two', items: [
          { type: 'number', id: 'netIncome', label: '당기순이익 (적자면 음수)', unit: '만원', placeholder: '예: 1000', allowNeg: true },
          { type: 'number', id: 'revenue', label: '매출액', unit: '만원', placeholder: '예: 20000' }] },
        { type: 'two', items: [
          { type: 'number', id: 'assets', label: '자산총계', unit: '만원', placeholder: '예: 25000' },
          { type: 'number', id: 'equity', label: '자본총계', unit: '만원', placeholder: '예: 10000' }] }] },
      { type: 'fieldset', legend: '전기 (선택: 넣으면 ROE 변동 원인을 봅니다)', items: [
        { type: 'two', items: [
          { type: 'number', id: 'prevNetIncome', label: '전기 당기순이익', unit: '만원', allowNeg: true },
          { type: 'number', id: 'prevRevenue', label: '전기 매출액', unit: '만원' }] },
        { type: 'two', items: [
          { type: 'number', id: 'prevAssets', label: '전기 자산총계', unit: '만원' },
          { type: 'number', id: 'prevEquity', label: '전기 자본총계', unit: '만원' }] }] }
    ],
    run: function (v) {
      var r = F2().dupont(v);
      if (r.status === 'INVALID') return { r: r };
      var NAME = { margin: '순이익률', turnover: '총자산회전율', leverage: '재무레버리지' };
      var body;
      if (r.prevRoe !== undefined) {
        body = grid(['항목', '전기', '당기', '변동'], [['ROE', pctS(r.prevRoe), pctS(r.roe), n(r1d(r.roe - r.prevRoe)) + '%p'], ['순이익률', pctS(r.prevMargin), pctS(r.margin), pctS(r.changes.margin)], ['총자산회전율', n(r.prevTurnover) + '회', n(r.turnover) + '회', pctS(r.changes.turnover)], ['재무레버리지', n(r.prevLeverage) + '배', n(r.leverage) + '배', pctS(r.changes.leverage)]]);
      } else {
        body = table([['순이익률', pctS(r.margin)], ['총자산회전율', n(r.turnover) + '회'], ['재무레버리지(자산 ÷ 자본)', n(r.leverage) + '배'], ['ROE', pctS(r.roe), true]]);
      }
      return { r: r, cls: r.roe < 0 ? 'target' : 'not-target', title: 'ROE ' + pctS(r.roe) + ' = ' + pctS(r.margin) + ' × ' + n(r.turnover) + '회 × ' + n(r.leverage) + '배',
        sub: r.driver ? 'ROE 변동에 가장 크게 작용한 요소: ' + NAME[r.driver] : '순이익률 × 총자산회전율 × 재무레버리지', body: body, topic: 'ifrs', label: '재무 분석 상담 신청' };
    }
  });
  function r1d(x) { return Math.round(x * 10) / 10; }

  E.register('operating-cashflow', {
    fields: [
      { type: 'two', items: [
        { type: 'number', id: 'netIncome', label: '당기순이익 (적자면 음수)', unit: '만원', placeholder: '예: 5000', allowNeg: true },
        { type: 'number', id: 'dep', label: '감가상각비 + 무형자산상각비', unit: '만원', placeholder: '예: 1000' }] },
      { type: 'number', id: 'otherNonCash', label: '기타 비현금 손익 (선택)', unit: '만원', placeholder: '충당금 전입액 등, 이익이면 음수', allowNeg: true },
      { type: 'fieldset', legend: '운전자본 (기초 → 기말 잔액)', items: [
        { type: 'two', items: [
          { type: 'number', id: 'arBegin', label: '매출채권 기초', unit: '만원', placeholder: '예: 3000' },
          { type: 'number', id: 'arEnd', label: '매출채권 기말', unit: '만원', placeholder: '예: 6000' }] },
        { type: 'two', items: [
          { type: 'number', id: 'invBegin', label: '재고자산 기초', unit: '만원', placeholder: '예: 2000' },
          { type: 'number', id: 'invEnd', label: '재고자산 기말', unit: '만원', placeholder: '예: 4000' }] },
        { type: 'two', items: [
          { type: 'number', id: 'apBegin', label: '매입채무 기초', unit: '만원', placeholder: '예: 1500' },
          { type: 'number', id: 'apEnd', label: '매입채무 기말', unit: '만원', placeholder: '예: 2000' }] }] }
    ],
    run: function (v) {
      var r = F2().indirectCashflow(v);
      if (r.status === 'INVALID') return { r: r };
      var ni = Math.round(Number(v.netIncome) * 10000);
      var body = table([['당기순이익', won(ni)], ['(+) 감가상각비 등', won(Math.round((Number(v.dep) || 0) * 10000))], ['(±) 기타 비현금 손익', signed(Math.round((Number(v.otherNonCash) || 0) * 10000))],
        ['매출채권 증감 효과', signed(r.arEffect)], ['재고자산 증감 효과', signed(r.invEffect)], ['매입채무 증감 효과', signed(r.apEffect)], ['운전자본 변동 합계', signed(r.wcEffect), true], ['영업활동 현금흐름(간이)', signed(r.ocf), true],
        r.conversion !== null ? ['이익의 현금 전환율(영업현금흐름 ÷ 순이익)', n(r.conversion) + '%'] : null]);
      var title = r.status === 'NEGATIVE' ? '영업으로 현금이 빠져나가고 있습니다' : r.status === 'LOW' ? '이익보다 현금이 ' + won(ni - r.ocf) + ' 적게 들어왔습니다' : '영업활동 현금흐름이 이익 이상입니다';
      return { r: r, cls: r.status === 'OK' ? 'not-target' : 'target', title: title, sub: '영업활동 현금흐름 ' + signed(r.ocf) + ' · 운전자본 ' + signed(r.wcEffect), body: body, topic: 'ifrs', label: '현금흐름·자금 상담 신청' };
    }
  });

  E.register('dscr', {
    fields: [
      { type: 'number', id: 'ebitda', label: '연 EBITDA (영업이익 + 감가상각비)', unit: '만원', placeholder: '예: 12000', allowNeg: true },
      { type: 'two', items: [
        { type: 'number', id: 'tax', label: '법인세 납부액 (선택)', unit: '만원', placeholder: '예: 1000' },
        { type: 'number', id: 'capex', label: '유지보수 설비투자 (선택)', unit: '만원', placeholder: '예: 1000' }] },
      { type: 'two', items: [
        { type: 'number', id: 'principal', label: '연간 원금 상환액', unit: '만원', placeholder: '예: 5000' },
        { type: 'number', id: 'interest', label: '연간 이자', unit: '만원', placeholder: '예: 2000' }] },
      { type: 'number', id: 'covenant', label: '대출 약정상 최소 DSCR (선택)', unit: '배', placeholder: '예: 1.2' }
    ],
    run: function (v) {
      var r = F2().dscr(v);
      if (r.status === 'INVALID') return { r: r };
      var body = table([['상환 재원(EBITDA − 세금 − 유지투자)', won(r.cfads)], ['연간 원리금', won(r.debtService)], ['DSCR', n(r.dscr) + '배', true],
        r.covenantMet !== null ? ['약정 기준', r.covenantMet ? '충족' : '미달', true] : null,
        r.maxDebtService !== null ? ['약정 기준으로 감당 가능한 연 원리금', won(r.maxDebtService)] : null]);
      var title = r.status === 'SHORT' ? '영업 현금으로 원리금을 다 갚지 못하는 수준입니다' : r.status === 'BREACH' ? 'DSCR ' + n(r.dscr) + '배로 약정 기준에 못 미칩니다' : 'DSCR ' + n(r.dscr) + '배, 원리금을 갚을 여력이 있습니다';
      return { r: r, cls: r.status === 'OK' ? 'not-target' : 'target', title: title, sub: '상환 재원 ' + won(r.cfads) + ' ÷ 원리금 ' + won(r.debtService), body: body, topic: 'fdd', label: '차입·재무구조 상담 신청' };
    }
  });

  E.register('red-flags', {
    fields: [
      { type: 'fieldset', legend: '전기 → 당기', items: [
        { type: 'two', items: [
          { type: 'number', id: 'revPrev', label: '전기 매출액', unit: '만원', placeholder: '예: 10000' },
          { type: 'number', id: 'revCur', label: '당기 매출액', unit: '만원', placeholder: '예: 12000' }] },
        { type: 'two', items: [
          { type: 'number', id: 'arPrev', label: '전기 말 매출채권', unit: '만원', placeholder: '예: 2000' },
          { type: 'number', id: 'arCur', label: '당기 말 매출채권', unit: '만원', placeholder: '예: 3200' }] },
        { type: 'two', items: [
          { type: 'number', id: 'invPrev', label: '전기 말 재고자산 (선택)', unit: '만원', placeholder: '예: 1500' },
          { type: 'number', id: 'invCur', label: '당기 말 재고자산 (선택)', unit: '만원', placeholder: '예: 1600' }] }] },
      { type: 'two', items: [
        { type: 'number', id: 'netIncome', label: '당기순이익 (선택)', unit: '만원', placeholder: '예: 800', allowNeg: true },
        { type: 'number', id: 'ocf', label: '영업활동 현금흐름 (선택)', unit: '만원', placeholder: '예: -200', allowNeg: true, hint: '현금흐름표 숫자, 없으면 간접법 영업현금흐름 계산기로' }] }
    ],
    run: function (v) {
      var r = F2().redFlags(v);
      if (r.status === 'INVALID') return { r: r };
      var body = table([['매출 증가율', pctS(r.revGrowth)], ['매출채권 증가율', pctS(r.arGrowth)], ['재고자산 증가율', r.invGrowth === null ? '입력 안 함' : pctS(r.invGrowth)], ['매출채권 회전일수', n(r.arDaysPrev) + '일 → ' + n(r.arDaysCur) + '일']]) +
        (r.flagCount ? '<h3>점검 신호</h3><ul class="basis">' + r.flags.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>' : '');
      return { r: r, cls: r.flagCount ? 'target' : 'not-target', title: r.flagCount ? '확인해 볼 신호가 ' + r.flagCount + '개 있습니다' : '이 도구의 점검 기준에서는 신호가 없습니다', sub: '매출 ' + pctS(r.revGrowth) + ' · 매출채권 ' + pctS(r.arGrowth), body: body, topic: 'fdd', label: '재무제표 검토 상담 신청' };
    }
  });

  E.register('credit-metrics', {
    fields: [
      { type: 'two', items: [
        { type: 'number', id: 'assets', label: '자산총계', unit: '만원', placeholder: '예: 50000' },
        { type: 'number', id: 'liabilities', label: '부채총계', unit: '만원', placeholder: '예: 30000' }] },
      { type: 'two', items: [
        { type: 'number', id: 'debt', label: '총차입금 (차입금·사채)', unit: '만원', placeholder: '예: 20000' },
        { type: 'number', id: 'cash', label: '현금성자산', unit: '만원', placeholder: '예: 5000' }] },
      { type: 'two', items: [
        { type: 'number', id: 'revenue', label: '매출액', unit: '만원', placeholder: '예: 40000' },
        { type: 'number', id: 'op', label: '영업이익 (적자면 음수)', unit: '만원', placeholder: '예: 4000', allowNeg: true }] },
      { type: 'two', items: [
        { type: 'number', id: 'dep', label: '감가상각비 + 무형자산상각비', unit: '만원', placeholder: '예: 1000' },
        { type: 'number', id: 'interest', label: '이자비용', unit: '만원', placeholder: '예: 1000' }] }
    ],
    run: function (v) {
      var r = F2().creditMetrics(v);
      if (r.status === 'INVALID') return { r: r };
      var body = table([['부채비율', r.debtRatio === null ? '자본잠식으로 계산 불가' : pctS(r.debtRatio), true], ['자기자본비율', pctS(r.equityRatio)], ['차입금의존도', pctS(r.debtDependence)], ['영업이익률', pctS(r.opMargin)],
        ['EBITDA', won(r.ebitda)], ['EBITDA 이자보상배율', r.ebitdaIcr === null ? '이자비용 없음' : n(r.ebitdaIcr) + '배', true], ['순차입금 / EBITDA', r.netCash ? '순현금 상태' : r.ndEbitda === null ? 'EBITDA가 0 이하' : n(r.ndEbitda) + '배', true]]);
      return { r: r, cls: r.impaired ? 'target' : 'not-target', title: r.impaired ? '부채가 자산보다 많은 완전자본잠식 상태입니다' : '부채비율 ' + pctS(r.debtRatio) + ' · 차입금의존도 ' + pctS(r.debtDependence),
        sub: '신용평가에 자주 쓰이는 지표입니다. 등급은 추정하지 않습니다', body: body, topic: 'fdd', label: '신용·재무구조 상담 신청' };
    }
  });

  // ── 41~46. 중소기업·벤처 추가 6종 (2026-11-19, docs/59) ──
  function SX() { return window.SmeExtraRules; }
  function yn(b) { return b ? '해당' : '해당 안 함'; }

  E.register('startup-check', {
    submit: '판정하기',
    fields: [
      { type: 'two', items: [
        { type: 'date', id: 'startDate', label: '사업 개시일', hint: '법인은 설립등기일, 개인은 사업자등록증 개업일' },
        { type: 'date', id: 'baseDate', label: '판단 기준일', hint: '지원사업 공고의 기준일 또는 신청일' }] },
      { type: 'number', id: 'ceoAge', label: '대표자 나이 (선택)', unit: '세', placeholder: '청년창업기업 여부 확인용' },
      { type: 'select', id: 'exclusion', label: '창업 경위', options: [['none', '새로 사업을 시작했습니다'], ['reopen_after_1y', '폐업하고 1년 넘게 지나 같은 업종을 다시 시작했습니다'], ['reopen_within_1y', '폐업 후 1년이 안 돼 같은 업종을 다시 시작했습니다'], ['inherit', '상속·증여받은 사업을 개인으로 이어서 합니다'], ['personal_new_person', '기존 개인사업을 하면서 개인사업자를 하나 더 냈습니다'], ['personal_new_corp', '기존 개인사업을 하면서 50% 넘게(또는 최대) 지분을 가진 법인으로 같은 업종을 시작했습니다'], ['corp_subsidiary', '기존 법인(임원 지분 포함)이 50% 넘게 출자한 법인입니다'], ['oligopoly', '기존 법인의 과점주주가 새 법인의 과점주주입니다'], ['conversion', '회사 형태만 바꿨습니다(예: 유한회사 → 주식회사)']] }
    ],
    run: function (v) {
      var r = SX().startupCheck(v);
      if (r.status === 'INVALID') return { r: r };
      var body = table([['창업기업 기간 끝(7년)', r.endDate, true], ['초기창업기업 기간 끝(3년)', r.earlyEndDate], ['기준일 현재 초기창업기업', yn(r.early && r.status === 'STARTUP')], ['청년창업기업(대표 39세 이하)', v.ceoAge === '' ? '나이 미입력' : yn(r.youth)], r.exclusionText ? ['창업 제외 사유', r.exclusionText] : null]);
      var title = r.status === 'STARTUP' ? '창업기업에 해당하는 것으로 판단됩니다' : r.status === 'EXCLUDED' ? '법령상 창업으로 보지 않는 경우에 해당할 수 있습니다' : '사업 개시일부터 7년이 지나 창업기업이 아닙니다';
      return { r: r, cls: r.status === 'STARTUP' ? 'target' : 'not-target', title: title, sub: '창업기업 기간 ' + v.startDate + ' ~ ' + r.endDate, body: body, topic: 'tax', label: '창업 지원·세무 상담 신청' };
    }
  });

  E.register('small-biz-check', {
    submit: '판정하기',
    fields: [
      { type: 'check', id: 'isSmall', label: '「중소기업기본법」상 소기업입니다 (중소기업 판정기에서 확인)', value: true },
      { type: 'radio', id: 'industry', label: '주된 업종', options: [['other', '그 밖의 업종 (도소매, 음식점, 서비스 등) — 5명 미만'], ['mfg', '광업·제조업·건설업·운수업 — 10명 미만']] },
      { type: 'two', items: [
        { type: 'number', id: 'fullTime', label: '상시 근로자 수 (직전 연도 월평균)', unit: '명', placeholder: '예: 4', hint: '임원·일용직·3개월 이내 기간제·연구전담요원 제외' },
        { type: 'number', id: 'partTime', label: '월 60시간 이상 단시간근로자 수', unit: '명', placeholder: '없으면 비움', hint: '1명을 0.5명으로 셉니다' }] },
      { type: 'fieldset', legend: '규모가 커져 기준을 넘은 적이 있다면 (선택)', items: [
        { type: 'two', items: [
          { type: 'number', id: 'exceededYear', label: '기준을 넘은 연도', unit: '년', placeholder: '예: 2025' },
          { type: 'number', id: 'baseYear', label: '판단 연도', unit: '년', placeholder: '예: 2027' }] }] }
    ],
    run: function (v) {
      var r = SX().smallBizCheck(v);
      if (r.status === 'INVALID') return { r: r };
      var body = table([['상시 근로자 수(단시간 0.5명 환산)', n(r.employees) + '명', true], ['업종 기준', r.limit + '명 미만'], r.graceEnd ? ['소상공인으로 보는 유예 기간', (Number(v.exceededYear) + 1) + '년 ~ ' + r.graceEnd + '년'] : null]);
      var title = r.status === 'SMALLBIZ' ? '소상공인에 해당하는 것으로 판단됩니다' : r.status === 'GRACE' ? '유예 기간이라 소상공인으로 봅니다' : '소상공인에 해당하지 않는 것으로 보입니다';
      return { r: r, cls: r.status === 'NOT' ? 'not-target' : 'target', title: title, sub: '상시 근로자 ' + n(r.employees) + '명 / 기준 ' + r.limit + '명 미만', body: body, topic: 'tax', label: '소상공인 지원·세무 상담 신청' };
    }
  });

  E.register('rnd-lab-check', {
    submit: '진단하기',
    fields: [
      { type: 'radio', id: 'type', label: '무엇을 만들려고 하나요?', options: [['lab', '기업부설연구소'], ['dept', '연구개발전담부서']] },
      { type: 'select', id: 'size', label: '기업 규모', options: [['small', '소기업'], ['medium', '중기업'], ['midsize', '중견기업'], ['large', '그 밖의 기업(대기업 등)']] },
      { type: 'check', id: 'venture', label: '벤처기업 확인을 받았습니다 (또는 연구기관 연구원·대학 교원이 창업한 연구개발형 중소기업)' },
      { type: 'check', id: 'startup3y', label: '창업일부터 3년이 지나지 않았습니다 (소기업)' },
      { type: 'check', id: 'mediumWithin1y', label: '소기업에서 중기업이 된 지 1년이 안 됐습니다' },
      { type: 'check', id: 'overseas', label: '국외에 세우는 연구소입니다' },
      { type: 'number', id: 'researchers', label: '확보한(확보 예정) 연구전담요원 수', unit: '명', placeholder: '예: 2' }
    ],
    run: function (v) {
      var r = SX().rndLabCheck(v);
      if (r.status === 'INVALID') return { r: r };
      var body = table([['적용 기준', r.reason], ['필요한 연구전담요원', r.required + '명 이상', true], ['확보 인원', n(r.researchers) + '명'], ['부족 인원', r.shortfall + '명', true]]);
      return { r: r, cls: r.status === 'MEETS' ? 'target' : 'not-target', title: r.status === 'MEETS' ? '인력 요건을 충족하는 것으로 보입니다' : '연구전담요원이 ' + r.shortfall + '명 부족합니다', sub: r.reason + ' 기준 ' + r.required + '명 이상', body: body, topic: 'tax', label: '연구소 설립·R&D 세액공제 상담 신청' };
    }
  });

  E.register('midsize-check', {
    submit: '판정하기',
    fields: [
      { type: 'check', id: 'isSme', label: '현재 「중소기업기본법」상 중소기업 기준 안에 있습니다' },
      { type: 'fieldset', legend: '해당하는 항목이 있으면 체크 (중견기업 제외 요건)', items: [
        { type: 'check', id: 'publicInst', label: '공공기관 또는 지방공기업입니다' },
        { type: 'check', id: 'bigGroup', label: '상호출자제한기업집단에 속합니다' },
        { type: 'check', id: 'bigOwner', label: '상호출자제한기업집단 지정기준 이상 자산을 가진 회사가 30% 이상 소유한 최다출자자입니다' },
        { type: 'check', id: 'finance', label: '금융업·보험업·금융 관련 서비스업을 합니다(일반지주회사 제외)' }] },
      { type: 'check', id: 'exceeded', label: '규모가 커져 중소기업 기준을 넘었습니다 (유예 기간 계산)' },
      { type: 'fieldset', id: 'msGraceBox', legend: '졸업 유예', when: function (v) { return v.exceeded; }, items: [
        { type: 'two', items: [
          { type: 'number', id: 'exceededYear', label: '처음 기준을 넘은 연도', unit: '년', placeholder: '예: 2025' },
          { type: 'number', id: 'baseYear', label: '판단 연도', unit: '년', placeholder: '예: 2027' }] },
        { type: 'check', id: 'listed', label: '유가증권시장·코스닥 상장사입니다' },
        { type: 'check', id: 'graceExcluded', label: '중소기업이 아닌 기업과 합병했거나, 유예 후 다시 기준을 넘은 경우입니다' }] }
    ],
    run: function (v) {
      var r = SX().midsizeCheck(v);
      if (r.status === 'INVALID') return { r: r };
      var rows = [];
      if (r.fails && r.fails.length) rows.push(['중견기업 제외 사유', r.fails.join(', ')]);
      if (v.exceeded) {
        rows.push(['중소기업기본법상 유예', r.smeGraceEnd === null ? '적용 안 됨' : r.smeGraceStart + '년 ~ ' + r.smeGraceEnd + '년', true]);
        rows.push(['세법(조특법)상 유예', r.taxGraceEnd === null ? '적용 안 됨' : v.exceededYear + '년 ~ ' + r.taxGraceEnd + '년 과세연도', true]);
      }
      var title = { SME: '중소기업이라 중견기업이 아닙니다', GRACE: '유예 기간이라 중소기업으로 봅니다', MIDSIZE: '중견기업에 해당하는 것으로 판단됩니다', NOT_MIDSIZE: '중견기업 요건에 맞지 않습니다' }[r.status];
      return { r: r, cls: r.status === 'MIDSIZE' || r.status === 'GRACE' ? 'target' : 'not-target', title: title, sub: v.exceeded && r.smeGraceEnd ? '중기법 유예 ' + r.smeGraceEnd + '년까지 · 세법 유예 ' + r.taxGraceEnd + '년까지' : '', body: rows.length ? table(rows) : '', topic: 'tax', label: '중견기업 진입·세무 상담 신청' };
    }
  });

  E.register('sme-employee-tax', {
    fields: [
      { type: 'radio', id: 'type', label: '직원 유형', options: [['youth', '청년 (15~34세, 병역 기간 최대 6년 차감)'], ['senior', '60세 이상'], ['disabled', '장애인'], ['career', '경력단절 근로자']] },
      { type: 'two', items: [
        { type: 'number', id: 'age', label: '근로계약 체결일 현재 나이', unit: '세', placeholder: '예: 32' },
        { type: 'number', id: 'militaryYears', label: '병역 이행 기간 (청년)', unit: '년', placeholder: '예: 2', step: '0.1' }] },
      { type: 'two', items: [
        { type: 'date', id: 'hireDate', label: '취업일' },
        { type: 'number', id: 'annualTax', label: '연간 근로소득 산출세액(예상)', unit: '만원', placeholder: '예: 150', hint: '연말정산 결정세액 계산 전 산출세액' }] },
      { type: 'check', id: 'excluded', label: '임원이거나 최대주주와 그 배우자·친족, 일용근로자입니다' },
      { type: 'check', id: 'industryNotEligible', label: '회사의 주된 업종이 감면 업종이 아닙니다 (예: 부동산 임대업, 주점, 금융업, 전문직 사무소)' }
    ],
    run: function (v) {
      var r = SX().smeEmployeeTax(v);
      if (r.status === 'INVALID') return { r: r };
      var ok = r.status === 'ELIGIBLE';
      var body = ok ? table([['감면율', r.rate + '%'], ['감면 기간', r.years + '년 (' + r.periodEnd + '까지)'], ['연간 감면세액(한도 200만원)', won(r.annualExempt), true], r.adjustedAge !== undefined ? ['병역 차감 후 나이', r.adjustedAge + '세'] : null])
        : '<ul class="basis">' + r.reasons.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
      return { r: r, cls: ok ? 'target' : 'not-target', title: ok ? '소득세 ' + r.rate + '% 감면 대상으로 판단됩니다' : '감면 대상이 아닌 것으로 보입니다', sub: ok ? '연 ' + won(r.annualExempt) + ' · ' + r.periodEnd + '까지' : '', body: body, topic: 'tax', label: '급여·원천징수 상담 신청' };
    }
  });

  E.register('venture-benefits', {
    fields: [
      { type: 'two', items: [
        { type: 'date', id: 'foundDate', label: '창업일' },
        { type: 'date', id: 'confirmDate', label: '벤처기업 확인일 (예정일)' }] },
      { type: 'check', id: 'industryEligible', label: '제조업·정보통신업·연구개발업 등 창업감면 업종입니다', value: true },
      { type: 'check', id: 'alreadyStartupRelief', label: '이미 창업중소기업 세액감면(조특법 제6조제1항)을 받고 있습니다' },
      { type: 'check', id: 'options', label: '임직원에게 스톡옵션을 부여했거나 부여할 계획입니다' }
    ],
    run: function (v) {
      var r = SX().ventureBenefits(v);
      if (r.status === 'INVALID') return { r: r };
      var body = '<ul class="basis">' + r.items.map(function (x) { return '<li><b>' + esc(x.title) + '</b>: ' + esc(x.text) + ' <a href="' + x.link + '">관련 도구</a></li>'; }).join('') + '</ul>';
      return { r: r, cls: 'target', title: '받을 수 있는 혜택이 ' + r.count + '가지로 보입니다', sub: r.startupVenture ? '창업벤처중소기업 세액감면 대상일 수 있습니다' : '창업벤처 세액감면은 요건에 맞지 않습니다', body: body, topic: 'tax', label: '벤처 확인·세액감면 상담 신청' };
    }
  });

  // ── 47~52. 부가세·인건비·퇴직금·대표 보수·법인전환·실수령액 (2026-11-19, docs/60) ──
  function BT() { return window.BizTaxRules; }

  E.register('vat-calc', {
    fields: function () { return [
      { type: 'radio', id: 'type', label: '과세 유형', options: [['general', '일반과세자 (법인 포함)'], ['simple', '간이과세자']] },
      { type: 'select', id: 'industry', label: '업종 (간이과세 부가가치율)', options: Object.keys(BT().VAT_RATE_LABEL).map(function (k) { return [k, BT().VAT_RATE_LABEL[k]]; }), when: function (v) { return v.type === 'simple'; } },
      { type: 'two', items: [
        { type: 'number', id: 'sales', label: '매출 (일반: 공급가액 / 간이: 부가세 포함 공급대가)', unit: '만원', placeholder: '예: 10000' },
        { type: 'number', id: 'purchases', label: '매입 (일반: 공제 가능한 공급가액 / 간이: 세금계산서 등 받은 공급대가)', unit: '만원', placeholder: '예: 6000' }] },
      { type: 'number', id: 'cardSales', label: '신용카드·현금영수증 발행금액 (선택)', unit: '만원', hint: '개인 소매·음식점 등만 공제. 법인은 비움' },
      { type: 'number', id: 'prevYearSupply', label: '직전 연도 공급대가 합계 (선택: 간이과세 가능 여부 확인)', unit: '만원', placeholder: '예: 9000' }
    ]; },
    run: function (v) {
      var r = BT().vatCalc(v);
      if (r.status === 'INVALID') return { r: r };
      var rows = r.type === 'general' ? [['매출세액(10%)', won(r.outputTax)], ['매입세액(10%)', won(r.inputTax)], ['신용카드 발행세액공제', won(r.cardCredit)]]
        : [['부가가치율', r.rateLabel], ['납부세액(공급대가 × 부가가치율 × 10%)', won(r.grossTax)], ['세금계산서 등 수취 공제(0.5%)', won(r.invoiceCredit)], ['신용카드 발행세액공제', won(r.cardCredit)]];
      rows.push([r.payable < 0 ? '환급세액' : '납부할 세액', won(Math.abs(r.payable)), true]);
      if (r.simpleEligible !== undefined) rows.push(['간이과세 금액 기준(1억4백만원 미만)', r.simpleEligible ? '충족' : '넘음']);
      var title = r.status === 'EXEMPT' ? '납부의무가 면제됩니다' : r.status === 'REFUND' ? '부가세 ' + won(-r.payable) + '을 환급받습니다' : '부가세 ' + won(r.payable) + '을 냅니다';
      return { r: r, cls: r.status === 'PAY' ? 'target' : 'not-target', title: title, sub: r.type === 'general' ? '일반과세자' : '간이과세자', body: table(rows), topic: 'tax', label: '부가세 신고 상담 신청' };
    }
  });

  E.register('labor-cost', {
    fields: [
      { type: 'two', items: [
        { type: 'number', id: 'monthly', label: '월 급여 (세전)', unit: '만원', placeholder: '예: 300' },
        { type: 'number', id: 'nonTaxable', label: '그중 비과세 수당 (식대 등)', unit: '만원', placeholder: '예: 20' }] },
      { type: 'select', id: 'band', label: '회사 상시근로자 수 (고용안정 보험료율)', options: [['u150', '150명 미만 (0.25%)'], ['prio', '150명 이상 우선지원대상기업 (0.45%)'], ['u1000', '150명 이상 1천명 미만 (0.65%)'], ['over1000', '1천명 이상 (0.85%)']] },
      { type: 'number', id: 'accidentPct', label: '산재보험료율 (업종별 고시)', unit: '%', placeholder: '예: 0.7', step: '0.01', hint: '근로복지공단 고지서의 요율, 모르면 비움' },
      { type: 'check', id: 'noSeverance', label: '퇴직금 적립액은 빼고 봅니다' }
    ],
    run: function (v) {
      var r = BT().laborCost(v);
      if (r.status === 'INVALID') return { r: r };
      var body = table([['국민연금 (4.75%)', won(r.pension)], ['건강보험 (3.595%)', won(r.health)], ['장기요양 (0.4724%)', won(r.ltc)], ['고용보험', won(r.employment)], ['산재보험', won(r.accident)], ['회사 부담 4대보험 (월)', won(r.monthlyEmployer), true]]) +
        table([['연 급여', won(r.annualSalary)], ['연 4대보험 회사 부담', won(r.annualEmployer)], ['퇴직금 적립 (연, 추정)', won(r.severanceReserve)], ['연간 총 인건비', won(r.annualTotal), true]]);
      return { r: r, cls: 'not-target', title: '이 직원 1명에게 1년에 약 ' + won(r.annualTotal) + '이 듭니다', sub: '연봉의 ' + n(r.ratio) + '% · 4대보험 회사 부담 월 ' + won(r.monthlyEmployer), body: body, topic: 'tax', label: '급여·인건비 상담 신청' };
    }
  });

  E.register('severance-pay', {
    fields: [
      { type: 'two', items: [
        { type: 'date', id: 'startDate', label: '입사일' },
        { type: 'date', id: 'lastDate', label: '마지막 근무일' }] },
      { type: 'two', items: [
        { type: 'number', id: 'wage3m', label: '퇴직 전 3개월 임금 총액 (세전)', unit: '만원', placeholder: '예: 900' },
        { type: 'number', id: 'days3m', label: '그 3개월의 총일수', unit: '일', placeholder: '예: 92', hint: '퇴직일 전날부터 거꾸로 3개월의 달력 일수(89~92일)' }] },
      { type: 'two', items: [
        { type: 'number', id: 'annualBonus', label: '직전 1년 상여금 (선택)', unit: '만원' },
        { type: 'number', id: 'leavePay', label: '직전 1년 연차수당 (선택)', unit: '만원' }] }
    ],
    run: function (v) {
      var r = BT().severancePay(v);
      if (r.status === 'INVALID') return { r: r };
      if (r.status === 'NOT_ELIGIBLE') return { r: r, cls: 'not-target', title: '1년 미만 근무라 법정 퇴직금 대상이 아닙니다', sub: '재직 ' + n(r.servedDays) + '일', body: '', topic: 'tax', label: '퇴직금 상담 신청' };
      var body = table([['1일 평균임금', won(r.avgDaily)], ['재직 일수', n(r.servedDays) + '일 (근속연수 ' + r.years + '년)'], ['퇴직금', won(r.severance), true], ['환산급여', won(r.convPay)], ['퇴직소득 과세표준', won(r.taxBase)], ['퇴직소득세', won(r.tax)], ['지방소득세', won(r.localTax)], ['세후 수령액', won(r.net), true]]);
      return { r: r, cls: 'target', title: '퇴직금 약 ' + won(r.severance) + ', 세후 ' + won(r.net), sub: '퇴직소득세 ' + won(r.tax) + ' + 지방소득세 ' + won(r.localTax), body: body, topic: 'tax', label: '퇴직금·퇴직소득세 상담 신청' };
    }
  });

  E.register('owner-pay', {
    fields: [
      { type: 'number', id: 'profit', label: '대표 보수 지급 전 법인 세전이익 (연)', unit: '만원', placeholder: '예: 20000' },
      { type: 'two', items: [
        { type: 'number', id: 'salary', label: '대표 급여 (연)', unit: '만원', placeholder: '예: 10000' },
        { type: 'number', id: 'payoutPct', label: '남은 세후이익 중 배당 비율', unit: '%', placeholder: '예: 50' }] }
    ],
    run: function (v) {
      var r = BT().ownerPay(v);
      if (r.status === 'INVALID') return { r: r };
      var body = grid(['안', '대표 급여', '배당', '법인세', '대표 소득세', '세금 합계', '대표 손에 남는 돈', '법인에 남는 돈'], r.scenarios.map(function (s) { var x = s.v; return [s.name, won(x.salary), won(x.dividend), won(x.corpTax), won(x.personalTax), won(x.totalTax), won(x.netToOwner), won(x.retained)]; }));
      var best = r.scenarios.slice().sort(function (a, b) { return a.v.totalTax - b.v.totalTax; })[0];
      return { r: r, cls: 'target', title: '입력한 안의 세금 합계는 ' + won(r.totalTax) + '입니다', sub: '세 가지 안 중 세금 합계가 가장 적은 것: ' + best.name + ' (' + won(best.v.totalTax) + ')', body: body, topic: 'tax', label: '대표 보수·배당 설계 상담 신청' };
    }
  });

  E.register('incorporation', {
    submit: '점검하기',
    fields: [
      { type: 'radio', id: 'method', label: '전환 방법', options: [['inkind', '현물출자 (사업용 자산을 출자해 법인 설립)'], ['transfer', '사업양수도 (먼저 법인을 세우고 사업을 넘김)']] },
      { type: 'check', id: 'within3m', label: '법인설립일부터 3개월 이내에 사업을 포괄적으로 넘깁니다', when: function (v) { return v.method === 'transfer'; } },
      { type: 'two', items: [
        { type: 'number', id: 'netAssets', label: '개인사업 순자산가액 (시가 자산 − 부채)', unit: '만원', placeholder: '예: 50000' },
        { type: 'number', id: 'capital', label: '새 법인 자본금', unit: '만원', placeholder: '예: 50000' }] },
      { type: 'number', id: 'acqTax', label: '감면 전 예상 취득세 (부동산 등, 선택)', unit: '만원', placeholder: '예: 2000' },
      { type: 'check', id: 'realEstateLease', label: '부동산 임대 및 공급업입니다' },
      { type: 'check', id: 'consumption', label: '호텔·여관업, 유흥주점업 등 소비성서비스업입니다' },
      { type: 'check', id: 'housing', label: '넘기는 자산에 주택이 있습니다' }
    ],
    run: function (v) {
      var r = BT().incorporation(v);
      if (r.status === 'INVALID') return { r: r };
      var ok = r.status === 'ELIGIBLE';
      var body = ok ? table([['양도소득세 이월과세', '대상으로 판단'], ['취득세 50% 감면액', v.realEstateLease ? '부동산 임대·공급업 제외' : won(r.acqReduction), true], ['사후관리', '설립등기일부터 5년']])
        : '<ul class="basis">' + r.fails.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
      return { r: r, cls: ok ? 'target' : 'not-target', title: ok ? '이월과세 요건을 갖춘 것으로 보입니다' : '이월과세 요건에 맞지 않는 부분이 있습니다', sub: ok && r.acqReduction ? '취득세 약 ' + won(r.acqReduction) + ' 감면' : '', body: body, topic: 'tax', label: '법인전환 상담 신청' };
    }
  });

  E.register('net-salary', {
    fields: [
      { type: 'two', items: [
        { type: 'number', id: 'monthly', label: '월 급여 (세전)', unit: '만원', placeholder: '예: 300', hint: '연봉이면 12로 나눠 넣습니다' },
        { type: 'number', id: 'nonTaxable', label: '그중 비과세 수당 (식대 등)', unit: '만원', placeholder: '예: 20' }] },
      { type: 'number', id: 'dependents', label: '기본공제 인원 (본인 포함)', unit: '명', placeholder: '1' }
    ],
    run: function (v) {
      var r = BT().netSalary(v);
      if (r.status === 'INVALID') return { r: r };
      var body = table([['국민연금', won(r.pension)], ['건강보험', won(r.health)], ['장기요양', won(r.ltc)], ['고용보험', won(r.employment)], ['소득세 + 지방소득세 (월 평균)', won(r.monthlyTax)], ['월 실수령액', won(r.monthlyNet), true], ['연 실수령액', won(r.annualNet)]]);
      return { r: r, cls: 'not-target', title: '월 실수령액은 약 ' + won(r.monthlyNet) + '입니다', sub: '4대보험 ' + won(r.monthlyInsurance) + ' · 세금 ' + won(r.monthlyTax) + ' (월)', body: body, topic: 'tax', label: '급여 상담 신청' };
    }
  });

  // ── 53~58. 개인 세금 6종 (2026-11-19, docs/61) ──
  function PT() { return window.PersonalTaxRules; }

  E.register('pension-credit', {
    fields: [
      { type: 'radio', id: 'incomeType', label: '소득 종류', options: [['wage', '근로소득만 있음 (총급여 기준)'], ['other', '사업·기타 종합소득 있음 (종합소득금액 기준)']] },
      { type: 'number', id: 'income', label: '총급여 또는 종합소득금액 (연)', unit: '만원', placeholder: '예: 5000' },
      { type: 'two', items: [
        { type: 'number', id: 'savings', label: '올해 연금저축 납입액', unit: '만원', placeholder: '예: 300' },
        { type: 'number', id: 'irp', label: '올해 IRP 등 퇴직연금 납입액', unit: '만원', placeholder: '예: 0' }] }
    ],
    run: function (v) {
      var r = PT().pensionCredit(v);
      if (r.status === 'INVALID') return { r: r };
      var body = table([['공제율', r.rate + '% (지방소득세 포함 ' + (r.rate * 1.1).toFixed(1) + '%)'], ['공제 대상 납입액', won(r.eligible)], ['세액공제 (소득세)', won(r.credit), true], ['지방소득세 공제', won(r.localCredit)], ['연말까지 더 넣을 수 있는 금액', won(r.room)], ['더 넣으면 늘어나는 공제', won(r.extraCredit + Math.floor(r.extraCredit * 0.1)), true]]);
      return { r: r, cls: 'target', title: '연금계좌로 세금 ' + won(r.credit + r.localCredit) + '을 돌려받습니다', sub: r.room > 0 ? won(r.room) + ' 더 넣으면 ' + won(r.extraCredit + Math.floor(r.extraCredit * 0.1)) + ' 더 줄어듭니다' : '공제 한도 900만원을 다 채웠습니다', body: body, topic: 'tax', label: '절세 상담 신청' };
    }
  });

  E.register('year-end-tax', {
    fields: [
      { type: 'two', items: [
        { type: 'number', id: 'salary', label: '올해 총급여 (비과세 제외)', unit: '만원', placeholder: '예: 5000' },
        { type: 'number', id: 'prepaid', label: '매달 떼인 소득세 합계 (기납부세액)', unit: '만원', placeholder: '예: 200', hint: '급여명세서의 소득세 합계(지방소득세 제외)' }] },
      { type: 'two', items: [
        { type: 'number', id: 'dependents', label: '기본공제 인원 (본인 포함)', unit: '명', placeholder: '1' },
        { type: 'number', id: 'children', label: '그중 8세 이상 자녀 수', unit: '명', placeholder: '0' }] },
      { type: 'fieldset', legend: '카드 사용액 (연)', items: [
        { type: 'two', items: [
          { type: 'number', id: 'credit', label: '신용카드', unit: '만원' },
          { type: 'number', id: 'debit', label: '체크카드·현금영수증', unit: '만원' }] },
        { type: 'two', items: [
          { type: 'number', id: 'market', label: '전통시장·대중교통', unit: '만원' },
          { type: 'number', id: 'culture', label: '도서·공연·영화·박물관·체육시설', unit: '만원', hint: '총급여 7천만원 이하만 별도 공제' }] }] },
      { type: 'fieldset', legend: '세액공제 지출 (연, 해당하는 것만)', items: [
        { type: 'two', items: [
          { type: 'number', id: 'medical', label: '의료비 (부양가족 일반)', unit: '만원' },
          { type: 'number', id: 'medicalSelf', label: '의료비 (본인·65세 이상·장애인)', unit: '만원' }] },
        { type: 'two', items: [
          { type: 'number', id: 'education', label: '교육비 (공제 대상 금액)', unit: '만원' },
          { type: 'number', id: 'insurancePremium', label: '보장성 보험료', unit: '만원' }] },
        { type: 'two', items: [
          { type: 'number', id: 'rent', label: '월세 (연, 무주택 세대주)', unit: '만원' },
          { type: 'number', id: 'donation', label: '기부금', unit: '만원' }] },
        { type: 'number', id: 'pension', label: '연금저축·IRP 납입액 합계 (연금저축은 600만원까지)', unit: '만원' }] },
      { type: 'number', id: 'insurance', label: '본인 부담 4대보험료 (연, 선택)', unit: '만원', hint: '비우면 2026년 요율로 추정' }
    ],
    run: function (v) {
      var r = PT().yearEndTax(v);
      if (r.status === 'INVALID') return { r: r };
      var body = table([['카드 소득공제', won(r.cardDeduction)], ['과세표준', won(r.taxBase)], ['산출세액', won(r.calcTax)], ['근로소득세액공제', won(r.earnedCredit)], ['자녀세액공제', won(r.childCredit)], ['연금계좌세액공제', won(r.pensionCredit)], [r.useStandard ? '표준세액공제' : '특별세액공제 (의료·교육·보험·기부·월세)', won(r.specialCredit)], ['결정세액 (소득세)', won(r.determinedTax), true], [r.refund >= 0 ? '돌려받을 소득세' : '더 낼 소득세', won(Math.abs(r.refund)), true], ['지방소득세 ' + (r.localRefund >= 0 ? '환급' : '추가'), won(Math.abs(r.localRefund))]]);
      var total = r.refund + r.localRefund;
      return { r: r, cls: total >= 0 ? 'target' : 'not-target', title: total >= 0 ? '약 ' + won(total) + '을 돌려받을 것으로 보입니다' : '약 ' + won(-total) + '을 더 낼 것으로 보입니다', sub: '지방소득세 포함 · 결정세액 ' + won(r.determinedTax), body: body, topic: 'tax', label: '연말정산 상담 신청' };
    }
  });

  E.register('freelancer-tax', {
    fields: [
      { type: 'number', id: 'revenue', label: '연 수입금액 (3.3% 떼기 전)', unit: '만원', placeholder: '예: 3000' },
      { type: 'radio', id: 'method', label: '경비 계산 방법', options: [['simple', '단순경비율 (소규모·신규)'], ['standard', '기준경비율 (증빙 있는 주요경비 + 기준경비율)'], ['books', '장부 (실제 경비)']] },
      { type: 'number', id: 'simpleRate', label: '단순경비율 (업종코드별 국세청 고시)', unit: '%', placeholder: '예: 64.1', step: '0.1', when: function (v) { return v.method === 'simple'; } },
      { type: 'two', id: 'stdBox', when: function (v) { return v.method === 'standard'; }, items: [
        { type: 'number', id: 'majorExpenses', label: '증빙 있는 주요경비 (매입·임차료·인건비)', unit: '만원' },
        { type: 'number', id: 'standardRate', label: '기준경비율', unit: '%', step: '0.1' }] },
      { type: 'number', id: 'expenses', label: '장부상 필요경비', unit: '만원', when: function (v) { return v.method === 'books'; } },
      { type: 'two', items: [
        { type: 'number', id: 'dependents', label: '기본공제 인원 (본인 포함)', unit: '명', placeholder: '1' },
        { type: 'number', id: 'pensionPaid', label: '올해 낸 국민연금 (지역가입)', unit: '만원' }] },
      { type: 'fieldset', legend: '단순경비율 대상 확인 (선택)', items: [
        { type: 'two', items: [
          { type: 'select', id: 'group', label: '업종 구분', options: [['c', '전문·과학·기술, 교육, 예술·스포츠, 인적용역 아닌 개인서비스 등 (2,400만원)'], ['b', '제조, 음식·숙박, 정보통신, 운수, 인적용역(강사·작가 등) 등 (3,600만원)'], ['a', '도소매, 농림어업 등 (6,000만원)']] },
          { type: 'number', id: 'prevRevenue', label: '직전 연도 수입금액', unit: '만원', hint: '올해 처음 시작했으면 비움' }] }] }
    ],
    run: function (v) {
      var r = PT().freelancerTax(v);
      if (r.status === 'INVALID') return { r: r };
      var body = table([['사업소득금액', won(r.income)], ['과세표준', won(r.taxBase)], ['종합소득세 (표준세액공제 7만원 반영)', won(r.tax)], ['지방소득세', won(r.localTax)], ['이미 떼인 3.3%', won(r.prepaidTotal)], [r.refund >= 0 ? '돌려받을 금액' : '더 낼 금액', won(Math.abs(r.refund)), true], r.simpleEligible !== undefined ? ['단순경비율 대상', r.simpleEligible ? '해당 (직전 수입 기준 미만)' : '아님 → 기준경비율 또는 장부'] : null]);
      return { r: r, cls: r.refund >= 0 ? 'target' : 'not-target', title: r.refund >= 0 ? '5월 신고로 약 ' + won(r.refund) + '을 돌려받을 수 있습니다' : '5월 신고 때 약 ' + won(-r.refund) + '을 더 내야 합니다', sub: '다른 소득이 없을 때 기준', body: body, topic: 'tax', label: '종합소득세 신고 상담 신청' };
    }
  });

  E.register('foreign-stock-tax', {
    fields: [
      { type: 'two', items: [
        { type: 'number', id: 'gain', label: '올해 이익 본 종목의 양도차익 합계', unit: '만원', placeholder: '예: 1500', hint: '원화 기준(매도가 − 매수가 − 수수료)' },
        { type: 'number', id: 'loss', label: '올해 손실 본 종목의 손실 합계', unit: '만원', placeholder: '예: 300' }] },
      { type: 'fieldset', legend: '배우자 증여 후 양도 비교 (선택)', items: [
        { type: 'two', items: [
          { type: 'number', id: 'giftValue', label: '증여할 주식의 현재 시가', unit: '만원', placeholder: '예: 30000' },
          { type: 'number', id: 'donorCost', label: '그 주식의 원래 취득가액', unit: '만원', placeholder: '예: 10000' }] },
        { type: 'number', id: 'monthsAfterGift', label: '증여 후 양도까지 기간', unit: '개월', placeholder: '13' }] }
    ],
    run: function (v) {
      var r = PT().foreignStockTax(v);
      if (r.status === 'INVALID') return { r: r };
      var rows = [['손익 통산 후 양도차익', won(r.netGain)], ['기본공제 후 과세표준', won(r.taxBase)], ['양도소득세 (20%)', won(r.tax)], ['지방소득세 (2%)', won(r.localTax)], ['합계', won(r.total), true]];
      if (r.directTotal !== undefined) rows.push(['[비교] 그 주식을 직접 팔 때 세금', won(r.directTotal)], ['[비교] 배우자 증여 후 팔 때 세금', won(r.giftTotal)], ['절세 효과', won(r.giftSaving), true]);
      return { r: r, cls: r.total > 0 ? 'target' : 'not-target', title: r.total > 0 ? '해외주식 양도세 약 ' + won(r.total) + '(지방세 포함)' : '기본공제 250만원 안이라 낼 세금이 없습니다', sub: '다음 해 5월 확정신고', body: table(rows), topic: 'tax', label: '해외주식 세금 상담 신청' };
    }
  });

  E.register('home-sale-tax', {
    fields: [
      { type: 'two', items: [
        { type: 'number', id: 'salePrice', label: '양도가액', unit: '만원', placeholder: '예: 150000' },
        { type: 'number', id: 'acqPrice', label: '취득가액', unit: '만원', placeholder: '예: 50000' }] },
      { type: 'number', id: 'expenses', label: '필요경비 (취득세·중개수수료·확장공사 등)', unit: '만원' },
      { type: 'two', items: [
        { type: 'number', id: 'holdYears', label: '보유기간', unit: '년', placeholder: '예: 10', step: '0.1' },
        { type: 'number', id: 'liveYears', label: '거주기간', unit: '년', placeholder: '예: 10', step: '0.1' }] },
      { type: 'check', id: 'oneHouse', label: '양도일 현재 세대 전체가 이 주택 1채만 갖고 있습니다', value: true },
      { type: 'check', id: 'adjustedAtAcq', label: '취득할 때 조정대상지역이었습니다 (거주 2년 필요)' }
    ],
    run: function (v) {
      var r = PT().homeSaleTax(v);
      if (r.status === 'INVALID') return { r: r };
      if (r.status === 'EXEMPT') return { r: r, cls: 'not-target', title: '1세대 1주택 비과세로 양도세가 없습니다', sub: '양도가액 12억원 이하 · 보유(거주) 요건 충족', body: '', topic: 'tax', label: '양도세 상담 신청' };
      if (r.status === 'NONE') return { r: r, cls: 'not-target', title: '양도차익이 없습니다', sub: '', body: '', topic: 'tax', label: '양도세 상담 신청' };
      var body = table([['비과세 요건', r.exemptRequirement ? '충족 (12억원 초과분만 과세)' : '충족 안 함'], ['과세 대상 양도차익', won(r.taxableGain)], ['장기보유특별공제율', r.ltcgRate + '%'], ['과세표준', won(r.taxBase)], ['양도소득세', won(r.tax)], ['지방소득세', won(r.localTax)], ['합계', won(r.total), true]]);
      return { r: r, cls: 'target', title: '양도세 약 ' + won(r.total) + '(지방세 포함)', sub: r.exemptRequirement ? '고가주택 12억원 초과분 과세' : '1세대 1주택 비과세 대상 아님', body: body, topic: 'tax', label: '양도세 상담 신청' };
    }
  });

  E.register('acquisition-tax', {
    fields: [
      { type: 'number', id: 'price', label: '취득가액 (매매가)', unit: '만원', placeholder: '예: 50000' },
      { type: 'number', id: 'houses', label: '이번 주택을 포함한 세대의 주택 수', unit: '채', placeholder: '1' },
      { type: 'check', id: 'adjusted', label: '취득하는 주택이 조정대상지역에 있습니다' },
      { type: 'check', id: 'isCorp', label: '법인이 취득합니다' }
    ],
    run: function (v) {
      var r = PT().acquisitionTax(v);
      if (r.status === 'INVALID') return { r: r };
      var body = table([['적용 세율', n(r.ratePct) + '%'], ['적용 근거', r.reason], ['취득세 (본세)', won(r.tax), true]]);
      return { r: r, cls: r.status === 'HEAVY' ? 'target' : 'not-target', title: '취득세 약 ' + won(r.tax) + ' (' + n(r.ratePct) + '%)', sub: r.status === 'HEAVY' ? '중과세율 적용' : '지방교육세·농어촌특별세 별도', body: body, topic: 'tax', label: '부동산 세금 상담 신청' };
    }
  });
})();
