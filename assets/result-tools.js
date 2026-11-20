/*
 * 결과 화면 공통 도구: (1) "결과 복사" 버튼 — 결과 전체를 텍스트로 복사해 카톡·메일에 붙여 넣을 수 있게 함
 *                     (2) "함께 보면 좋은 도구" — 페이지별 다음 단계 링크 (RELATED가 단일 출처)
 * 각 도구 페이지의 #result 가 채워질 때마다 아래 블록을 덧붙인다. 서버로 보내는 것은 없다.
 */
(function () {
  'use strict';
  // 카카오톡 채널 1:1 채팅 (2026-11-11 개설, 채널명 CPA TOOL). 일반 링크만 쓰고 카카오 스크립트는 넣지 않는다.
  var KAKAO_CHAT = 'https://pf.kakao.com/_xgxfENX/chat';
  var RELATED = {
    'audit-check': [['icfr-check.html', '내부회계관리제도 적용 대상'], ['audit-schedule.html', '외부감사 일정 계산기'], ['audit-prep.html', '첫 외부감사 준비 체크리스트'], ['consolidation.html', '연결재무제표 작성 대상']],
    'audit-schedule': [['audit-prep.html', '첫 외부감사 준비 체크리스트'], ['audit-fee.html', '감사보수는 어떻게 정해지나'], ['icfr-check.html', '내부회계관리제도 적용 대상']],
    'icfr-check': [['audit-check.html', '외부감사 대상 판정기'], ['audit-schedule.html', '외부감사 일정 계산기']],
    'consolidation': [['audit-check.html', '외부감사 대상 판정기'], ['audit-schedule.html', '외부감사 일정 계산기(연결 포함)'], ['ppa.html', 'PPA 영업권 간이 계산기']],
    'audit-designation': [['ipo-prep.html', 'IPO 준비 회계 체크리스트'], ['audit-fee.html', '감사보수는 어떻게 정해지나'], ['audit-schedule.html', '외부감사 일정 계산기']],
    'lease': [['depreciation.html', '감가상각 계산기'], ['impairment.html', '손상검사 간이 진단'], ['audit-prep.html', '첫 외부감사 준비 체크리스트']],
    'depreciation': [['lease.html', '리스 회계 계산기'], ['tax-calendar.html', '법인 세무 신고 일정표'], ['corp-vs-personal.html', '법인 vs 개인사업자']],
    'allowance': [['loan-interest.html', '가지급금 인정이자'], ['retirement.html', '퇴직급여충당부채'], ['audit-prep.html', '첫 외부감사 준비 체크리스트']],
    'retirement': [['allowance.html', '대손충당금 연령분석'], ['lease.html', '리스 회계 계산기'], ['audit-check.html', '외부감사 대상 판정기']],
    'governance': [['audit-designation.html', '감사인 지정 대상 확인'], ['icfr-check.html', '내부회계관리제도 적용 대상'], ['ipo-prep.html', 'IPO 준비 회계 체크리스트']],
    'tax-calendar': [['audit-schedule.html', '외부감사 일정 계산기'], ['depreciation.html', '감가상각 계산기'], ['loan-interest.html', '가지급금 인정이자']],
    'impairment': [['ppa.html', 'PPA 영업권 간이 계산기'], ['dcf.html', 'DCF·WACC 간이 계산기'], ['consolidation.html', '연결재무제표 작성 대상']],
    'sme-check': [['tax-sme.html', '세법상 중소기업 판정기'], ['venture-check.html', '벤처기업 확인 요건 진단']],
    'tax-sme': [['sme-check.html', '중소기업기본법 판정기'], ['venture-check.html', '벤처기업 확인 요건 진단'], ['corp-vs-personal.html', '법인 vs 개인사업자 세금 비교']],
    'venture-check': [['venture-benefits.html', '벤처기업 확인 후 혜택'], ['stock-option-tax.html', '스톡옵션 행사 세금'], ['option-limit.html', '스톡옵션 부여 한도']],
    'venture-benefits': [['venture-check.html', '벤처기업 확인 요건 진단'], ['startup-relief.html', '창업중소기업 세액감면'], ['rnd-lab-check.html', '기업부설연구소 설립 요건']],
    'startup-check': [['startup-relief.html', '창업중소기업 세액감면'], ['sme-check.html', '중소기업 해당 여부'], ['venture-benefits.html', '벤처기업 확인 후 혜택']],
    'small-biz-check': [['sme-check.html', '중소기업 해당 여부'], ['startup-check.html', '창업기업 해당 여부'], ['corp-vs-personal.html', '법인 vs 개인사업자 세금 비교']],
    'midsize-check': [['tax-sme.html', '세법상 중소기업 판정기'], ['sme-check.html', '중소기업 해당 여부'], ['rnd-credit.html', '연구·인력개발비 세액공제']],
    'rnd-lab-check': [['rnd-credit.html', '연구·인력개발비 세액공제'], ['venture-check.html', '벤처기업 확인 요건 진단'], ['sme-check.html', '중소기업 해당 여부']],
    'year-end-tax': [['pension-credit.html', '연금저축·IRP 세액공제'], ['net-salary.html', '연봉 실수령액'], ['sme-employee-tax.html', '중소기업 취업자 소득세 감면']],
    'pension-credit': [['year-end-tax.html', '연말정산 미리보기'], ['net-salary.html', '연봉 실수령액'], ['freelancer-tax.html', '프리랜서 3.3% 환급']],
    'freelancer-tax': [['pension-credit.html', '연금저축·IRP 세액공제'], ['withholding.html', '원천징수 계산'], ['corp-vs-personal.html', '법인 vs 개인사업자']],
    'foreign-stock-tax': [['inherit-gift.html', '상속·증여세 계산'], ['share-transfer-tax.html', '비상장주식 양도세'], ['pension-credit.html', '연금저축·IRP 세액공제']],
    'home-sale-tax': [['acquisition-tax.html', '주택 취득세'], ['inherit-gift.html', '상속·증여세 계산'], ['foreign-stock-tax.html', '해외주식 양도세']],
    'acquisition-tax': [['home-sale-tax.html', '1세대 1주택 양도세'], ['inherit-gift.html', '상속·증여세 계산'], ['incorporation.html', '법인전환 취득세']],
    'vat-calc': [['tax-calendar.html', '법인 세무 신고 일정표'], ['corp-vs-personal.html', '법인 vs 개인사업자'], ['tax-penalty.html', '가산세 계산기']],
    'labor-cost': [['net-salary.html', '연봉 실수령액'], ['employment-credit.html', '통합고용세액공제'], ['severance-pay.html', '퇴직금·퇴직소득세']],
    'net-salary': [['labor-cost.html', '인건비 총액(회사 부담)'], ['sme-employee-tax.html', '중소기업 취업자 소득세 감면'], ['withholding.html', '원천징수 계산']],
    'severance-pay': [['retirement.html', '퇴직급여충당부채'], ['exec-retirement.html', '임원 퇴직금 한도'], ['net-salary.html', '연봉 실수령액']],
    'owner-pay': [['corp-tax.html', '법인세 간이 계산기'], ['distributable-profit.html', '배당가능이익'], ['exec-retirement.html', '임원 퇴직금 한도']],
    'incorporation': [['corp-vs-personal.html', '법인 vs 개인사업자'], ['sincere-filing.html', '성실신고확인 대상'], ['owner-pay.html', '대표 보수 설계']],
    'sme-employee-tax': [['withholding.html', '원천징수 계산'], ['employment-credit.html', '통합고용세액공제'], ['sme-check.html', '중소기업 해당 여부']],
    'inherit-gift': [['stock-valuation.html', '비상장주식 상증법 약식 평가'], ['valuation-needs.html', '어떤 평가가 필요한가요?']],
    'loan-interest': [['corp-vs-personal.html', '법인 vs 개인사업자 세금 비교'], ['fin-ratio.html', '재무비율 간이 진단']],
    'stock-option-tax': [['stock-option.html', '스톡옵션 공정가치'], ['option-limit.html', '스톡옵션 부여 한도'], ['venture-check.html', '벤처기업 확인 요건 진단']],
    'corp-vs-personal': [['tax-sme.html', '세법상 중소기업 판정기'], ['loan-interest.html', '가지급금 인정이자']],
    'valuation-needs': [['stock-valuation.html', '비상장주식 상증법 약식 평가'], ['dcf.html', 'DCF·WACC 간이 계산기'], ['external-valuation.html', '자본시장법 외부평가 대상']],
    'stock-valuation': [['inherit-gift.html', '상속·증여세 간이 계산'], ['dcf.html', 'DCF·WACC 간이 계산기'], ['valuation-needs.html', '어떤 평가가 필요한가요?']],
    'dcf': [['dilution.html', '투자 유치 지분 희석'], ['stock-valuation.html', '비상장주식 상증법 약식 평가']],
    'dilution': [['option-limit.html', '스톡옵션 부여 한도'], ['stock-option.html', '스톡옵션 공정가치'], ['rcps-cb.html', 'RCPS·CB 평가 필요 여부']],
    'ppa': [['impairment.html', '손상검사 간이 진단'], ['consolidation.html', '연결재무제표 작성 대상'], ['dcf.html', 'DCF·WACC 간이 계산기']],
    'external-valuation': [['merger-price.html', '상장사 합병가액'], ['valuation-needs.html', '어떤 평가가 필요한가요?']],
    'merger-price': [['external-valuation.html', '자본시장법 외부평가 대상']],
    'stock-option': [['option-limit.html', '스톡옵션 부여 한도'], ['stock-option-tax.html', '스톡옵션 행사 세금'], ['dilution.html', '투자 유치 지분 희석']],
    'option-limit': [['stock-option.html', '스톡옵션 공정가치'], ['stock-option-tax.html', '스톡옵션 행사 세금'], ['venture-check.html', '벤처기업 확인 요건 진단']],
    'rcps-cb': [['dilution.html', '투자 유치 지분 희석'], ['stock-option.html', '스톡옵션 공정가치']],
    'fin-ratio': [['capital-impairment.html', '자본잠식·채무초과 진단'], ['debt-capacity.html', 'EBITDA·순차입금 상환능력'], ['audit-check.html', '외부감사 대상 판정기']],
    'working-capital': [['fin-ratio.html', '재무비율 간이 진단'], ['break-even.html', '손익분기점(BEP) 계산기'], ['debt-capacity.html', 'EBITDA·순차입금 상환능력']],
    'break-even': [['working-capital.html', '운전자본·현금전환주기'], ['fin-ratio.html', '재무비율 간이 진단'], ['corp-tax.html', '법인세 간이 계산기']],
    'debt-capacity': [['fin-ratio.html', '재무비율 간이 진단'], ['capital-impairment.html', '자본잠식·채무초과 진단'], ['audit-designation.html', '감사인 지정 대상 확인']],
    'capital-impairment': [['fin-ratio.html', '재무비율 간이 진단'], ['dilution.html', '투자 유치 지분 희석'], ['loan-interest.html', '가지급금 인정이자']],
    'related-price': [['stock-valuation.html', '비상장주식 상증법 약식 평가'], ['related-party.html', '특수관계인 범위 확인'], ['inherit-gift.html', '상속·증여세 간이 계산']],
    'related-party': [['related-price.html', '특수관계인 주식 거래 시가 판정'], ['loan-interest.html', '가지급금 인정이자']],
    'employment-credit': [['rnd-credit.html', '연구·인력개발비 세액공제'], ['investment-credit.html', '통합투자세액공제'], ['tax-sme.html', '세법상 중소기업 판정기']],
    'rnd-credit': [['employment-credit.html', '통합고용세액공제'], ['corp-tax.html', '법인세 간이 계산기'], ['venture-check.html', '벤처기업 확인 요건 진단']],
    'investment-credit': [['rnd-credit.html', '연구·인력개발비 세액공제 + 최저한세'], ['depreciation.html', '감가상각 계산기'], ['tax-sme.html', '세법상 중소기업 판정기']],
    'startup-relief': [['tax-sme.html', '세법상 중소기업 판정기'], ['venture-check.html', '벤처기업 확인 요건 진단'], ['corp-tax.html', '법인세 간이 계산기']],
    'angel-deduction': [['venture-check.html', '벤처기업 확인 요건 진단'], ['dilution.html', '투자 유치 지분 희석'], ['safe-conversion.html', 'SAFE·전환사채 전환 주식수']],
    'entertainment': [['business-car.html', '업무용승용차 비용 한도'], ['corp-tax.html', '법인세 간이 계산기'], ['tax-calendar.html', '법인 세무 신고 일정표']],
    'business-car': [['entertainment.html', '기업업무추진비 한도'], ['depreciation.html', '감가상각 계산기'], ['lease.html', '리스 회계 계산기']],
    'share-transfer-tax': [['stock-valuation.html', '비상장주식 상증법 약식 평가'], ['related-price.html', '특수관계인 주식 거래 시가 판정']],
    'succession': [['inherit-gift.html', '상속·증여세 간이 계산'], ['stock-valuation.html', '비상장주식 상증법 약식 평가'], ['sme-check.html', '중소기업 해당 여부 판정기']],
    'equity-bridge': [['dcf.html', 'DCF·WACC 간이 계산기'], ['multiples.html', '유사기업 멀티플 평가'], ['ppa.html', 'PPA 영업권 간이 계산기']],
    'multiples': [['equity-bridge.html', '기업가치→지분가치 환산'], ['dcf.html', 'DCF·WACC 간이 계산기'], ['valuation-needs.html', '어떤 평가가 필요한가요?']],
    'safe-conversion': [['dilution.html', '투자 유치 지분 희석'], ['rcps-cb.html', 'RCPS·CB 평가 필요 여부'], ['option-limit.html', '스톡옵션 부여 한도']],
    'pf-feasibility': [['dcf.html', 'DCF·WACC 간이 계산기'], ['fin-ratio.html', '재무비율 간이 진단']],
    'deferred-tax': [['corp-tax.html', '법인세 간이 계산기'], ['allowance.html', '대손충당금 연령분석'], ['depreciation.html', '감가상각 계산기']],
    'revenue-check': [['audit-prep.html', '첫 외부감사 준비 체크리스트'], ['lease.html', '리스 회계 계산기'], ['ipo-prep.html', 'IPO 준비 회계 체크리스트']],
    'dev-cost': [['rnd-credit.html', '연구개발 세액공제'], ['impairment.html', '손상검사 간이 진단'], ['deferred-tax.html', '이연법인세 간이 계산']],
    'fx-translation': [['closing-checklist.html', '12월 결산 체크리스트'], ['effective-interest.html', '유효이자율 상각표'], ['fin-ratio.html', '재무비율 간이 진단']],
    'inventory-lcm': [['allowance.html', '대손충당금 연령분석'], ['working-capital.html', '운전자본·현금전환주기'], ['closing-checklist.html', '12월 결산 체크리스트']],
    'gov-grant': [['depreciation.html', '감가상각 계산기'], ['investment-credit.html', '통합투자세액공제'], ['deferred-tax.html', '이연법인세 간이 계산']],
    'unused-leave': [['retirement.html', '퇴직급여충당부채'], ['accrual-prepaid.html', '선급·미지급비용 기간 배분'], ['closing-checklist.html', '12월 결산 체크리스트']],
    'accrual-prepaid': [['unused-leave.html', '미사용 연차수당 부채'], ['effective-interest.html', '유효이자율 상각표'], ['closing-checklist.html', '12월 결산 체크리스트']],
    'effective-interest': [['rcps-cb.html', 'RCPS·CB 평가 필요 여부'], ['debt-capacity.html', 'EBITDA·순차입금'], ['lease.html', '리스 회계 계산기']],
    'runway': [['break-even.html', '손익분기점'], ['dilution.html', '투자 유치 지분 희석'], ['safe-conversion.html', 'SAFE 전환 계산']],
    'dupont': [['fin-ratio.html', '재무비율 간이 진단'], ['credit-metrics.html', '신용평가 주요 지표'], ['operating-cashflow.html', '영업활동 현금흐름']],
    'operating-cashflow': [['working-capital.html', '운전자본·현금전환주기'], ['red-flags.html', '재무제표 이상 신호 점검'], ['runway.html', '런웨이·번레이트']],
    'dscr': [['debt-capacity.html', 'EBITDA·순차입금'], ['credit-metrics.html', '신용평가 주요 지표'], ['effective-interest.html', '유효이자율 상각표']],
    'red-flags': [['operating-cashflow.html', '영업활동 현금흐름'], ['inventory-lcm.html', '재고자산 저가법'], ['allowance.html', '대손충당금 연령분석']],
    'credit-metrics': [['dscr.html', 'DSCR 원리금 상환능력'], ['capital-impairment.html', '자본잠식 진단'], ['dupont.html', '듀폰 분석']],
    'corp-tax': [['deferred-tax.html', '이연법인세 간이 계산'], ['rnd-credit.html', '연구·인력개발비 세액공제'], ['tax-calendar.html', '법인 세무 신고 일정표']],
    'exec-retirement': [['loan-interest.html', '가지급금 인정이자'], ['corp-tax.html', '법인세 간이 계산기'], ['retirement.html', '퇴직급여충당부채']],
    'capital-gift': [['stock-valuation.html', '비상장주식 상증법 약식 평가'], ['related-price.html', '특수관계인 주식 거래 시가 판정'], ['inherit-gift.html', '상속·증여세 간이 계산']],
    'sincere-filing': [['corp-vs-personal.html', '법인 vs 개인사업자 세금 비교'], ['corp-tax.html', '법인세 간이 계산기'], ['tax-calendar.html', '법인 세무 신고 일정표']],
    'qualified-reorg': [['merger-price.html', '상장사 합병가액'], ['external-valuation.html', '자본시장법 외부평가 대상'], ['equity-bridge.html', '기업가치→지분가치 환산']],
    'distributable-profit': [['capital-impairment.html', '자본잠식·채무초과 진단'], ['withholding.html', '배당 원천징수 계산'], ['fin-ratio.html', '재무비율 간이 진단']],
    'tax-penalty': [['tax-calendar.html', '법인 세무 신고 일정표'], ['corp-tax.html', '법인세 간이 계산기'], ['withholding.html', '원천징수 세액 계산기']],
    'withholding': [['tax-calendar.html', '법인 세무 신고 일정표'], ['corp-vs-personal.html', '법인 vs 개인사업자 세금 비교']],
    'annual-leave': [['unused-leave.html', '미사용 연차수당 부채'], ['min-wage.html', '주휴수당·최저임금'], ['severance-pay.html', '퇴직금·퇴직소득세']],
    'min-wage': [['labor-cost.html', '직원 인건비 총액(4대보험)'], ['net-salary.html', '연봉 실수령액'], ['annual-leave.html', '연차 일수·연차수당']],
    'unemployment-benefit': [['severance-pay.html', '퇴직금·퇴직소득세'], ['annual-leave.html', '연차 일수·연차수당'], ['parental-leave.html', '육아휴직 급여']],
    'parental-leave': [['unemployment-benefit.html', '실업급여'], ['net-salary.html', '연봉 실수령액'], ['year-end-tax.html', '연말정산 미리보기']],
    'overtime-pay': [['hourly-wage.html', '월급 → 시급 환산'], ['work-hours.html', '주 52시간 점검'], ['net-salary.html', '연봉 실수령액']],
    'hourly-wage': [['min-wage.html', '주휴수당·최저임금'], ['overtime-pay.html', '연장·야간·휴일수당'], ['annual-leave.html', '연차수당']],
    'dismissal-notice': [['severance-pay.html', '퇴직금·퇴직소득세'], ['annual-leave.html', '연차 일수·연차수당'], ['unemployment-benefit.html', '실업급여']],
    'maternity-leave': [['parental-leave.html', '육아휴직 급여'], ['labor-cost.html', '직원 인건비 총액'], ['net-salary.html', '연봉 실수령액']],
    'shutdown-allowance': [['hourly-wage.html', '월급 → 시급 환산'], ['severance-pay.html', '퇴직금·퇴직소득세'], ['labor-cost.html', '직원 인건비 총액']],
    'dc-pension': [['severance-pay.html', '퇴직금·퇴직소득세'], ['retirement.html', '퇴직급여충당부채'], ['labor-cost.html', '직원 인건비 총액']],
    'work-hours': [['overtime-pay.html', '연장·야간·휴일수당'], ['hourly-wage.html', '월급 → 시급 환산'], ['min-wage.html', '주휴수당·최저임금']],
    'deposit-interest': [['isa-tax.html', 'ISA 비과세·분리과세'], ['financial-income.html', '금융소득 종합과세'], ['pension-credit.html', '연금저축·IRP 세액공제']],
    'isa-tax': [['deposit-interest.html', '예금 이자 세후 계산'], ['financial-income.html', '금융소득 종합과세'], ['foreign-stock-tax.html', '해외주식 양도소득세']],
    'financial-income': [['isa-tax.html', 'ISA 비과세·분리과세'], ['owner-pay.html', '대표 보수 설계(급여 vs 배당)'], ['deposit-interest.html', '예금 이자 세후 계산']],
    'rental-income-tax': [['property-tax.html', '종합부동산세'], ['home-sale-tax.html', '1주택 양도세'], ['acquisition-tax.html', '주택 취득세']],
    'property-tax': [['home-sale-tax.html', '1주택 양도세'], ['rental-income-tax.html', '주택임대소득세'], ['acquisition-tax.html', '주택 취득세']],
    'work-incentive': [['year-end-tax.html', '연말정산 미리보기'], ['freelancer-tax.html', '프리랜서 3.3% 환급'], ['min-wage.html', '주휴수당·최저임금']],
    'registration-tax': [['incorporation.html', '법인전환 이월과세·취득세'], ['corp-vs-personal.html', '법인 vs 개인사업자'], ['startup-check.html', '창업기업 해당 여부']],
    'interim-tax': [['corp-tax.html', '법인세 간이 계산기'], ['tax-calendar.html', '법인 세무 신고 일정표'], ['tax-penalty.html', '가산세 계산기']],
    'semiannual-withholding': [['withholding.html', '원천징수 세액 계산기'], ['tax-calendar.html', '법인 세무 신고 일정표'], ['labor-cost.html', '직원 인건비 총액']],
    'cap-table': [['dilution.html', '투자 유치 지분 희석'], ['exit-waterfall.html', '엑싯 분배(청산우선권)'], ['option-limit.html', '스톡옵션 부여 한도']],
    'loan-repayment': [['dsr-limit.html', 'DSR 대출 한도'], ['effective-interest.html', '유효이자율 상각표'], ['deposit-interest.html', '예금 이자 세후']],
    'dsr-limit': [['loan-repayment.html', '대출 이자·상환 계산기'], ['acquisition-tax.html', '주택 취득세'], ['brokerage-fee.html', '중개보수(복비)']],
    'rent-conversion': [['brokerage-fee.html', '중개보수(복비)'], ['rental-income-tax.html', '주택임대소득세'], ['loan-repayment.html', '대출 이자·상환']],
    'brokerage-fee': [['acquisition-tax.html', '주택 취득세'], ['home-sale-tax.html', '1주택 양도세'], ['rent-conversion.html', '전월세 전환']],
    'home-property-tax': [['property-tax.html', '종합부동산세'], ['acquisition-tax.html', '주택 취득세'], ['health-insurance.html', '지역 건강보험료']],
    'car-tax': [['business-car.html', '업무용승용차 비용 한도'], ['home-property-tax.html', '주택 재산세'], ['tax-calendar.html', '세무 신고 일정표']],
    'income-tax': [['freelancer-tax.html', '프리랜서 3.3% 환급'], ['year-end-tax.html', '연말정산 미리보기'], ['corp-vs-personal.html', '법인 vs 개인사업자']],
    'daily-worker-tax': [['withholding.html', '원천징수 세액 계산기'], ['min-wage.html', '주휴수당·최저임금'], ['net-salary.html', '연봉 실수령액']],
    'pension-tax': [['pension-credit.html', '연금저축·IRP 세액공제'], ['national-pension.html', '국민연금 예상액'], ['health-insurance.html', '지역 건강보험료']],
    'national-pension': [['pension-tax.html', '연금소득세'], ['pension-credit.html', '연금저축·IRP 세액공제'], ['health-insurance.html', '지역 건강보험료']],
    'health-insurance': [['financial-income.html', '금융소득 종합과세'], ['home-property-tax.html', '주택 재산세'], ['pension-tax.html', '연금소득세']],
    'exit-waterfall': [['cap-table.html', '멀티 라운드 캡테이블'], ['rcps-cb.html', 'RCPS·CB 평가 필요 여부'], ['equity-bridge.html', '기업가치→지분가치 환산']],
  };

  // 카카오톡 채널 친구 추가 (세법 개정 소식 안내용, 2026-11-18)
  var KAKAO_ADD = 'https://pf.kakao.com/_xgxfENX/friend';
  // 도구별 관련 유튜브 영상 [영상 ID, 짧은 제목] (2026-11-18). 링크만 걸고 영상을 페이지에 넣지 않는다(외부 리소스 없음).
  // 예약 중인 영상은 공개된 뒤에 넣는다.
  var VIDEOS = {
    'audit-check': [['na1372CT4-Y', '외부감사 대상 기준 2026']],
    'audit-schedule': [['McScgpfc9N8', '외부감사 일정 2027']],
    'icfr-check': [['Uwb2920JhAg', '내부회계관리제도 적용 대상']],
    'audit-designation': [['H9MOvR5-oaA', '감사인 지정 대상']],
    'governance': [['dOBL4-aVnT8', '상근감사·감사위원회 설치 의무']],
    'consolidation': [['Iu2S_PEpizU', '연결재무제표 작성 대상']],
    'tax-penalty': [['WzrP56h5T5M', '가산세 줄이는 법']],
    'entertainment': [['e5BeFbzdBK4', '접대비 한도·법인차 비용']],
    'business-car': [['XDj-NAakgzE', '8천만원 법인차, 비용 인정은?']],
    'withholding': [['Lds-a6RJgaM', '원천징수 3.3% vs 8.8%']],
    'employment-credit': [['Du8IGmdyoYI', '통합고용세액공제 2026']],
    'investment-credit': [['_MXdvDXtwpQ', '통합투자세액공제 2026']],
    'rnd-credit': [['JKXs7dHBhaY', '연구인력개발비 세액공제']],
    'startup-relief': [['T2N-5eh3uU0', '창업중소기업 세액감면']],
    'dilution': [['dx1Z384zuec', '투자 받으면 내 지분은?'], ['eM8ofqXxyB4', '프리머니·포스트머니 (창업자 재무 과외)']],
    'stock-valuation': [['189-W1L_H20', '비상장주식 평가 2026'], ['84IeUI_yAlo', '비상장주식 자녀 증여 세금']],
    'corp-tax': [['FKyQBFnGRF8', '법인세 계산 2026']],
    'depreciation': [['H6CH7fJS7vg', '감가상각비 세법 한도']],
    'option-limit': [['-2h2PTuSfYw', '스톡옵션 부여 한도와 행사 세금'], ['uRfLS4DfbY4', '스톡옵션 풀과 법정 한도 (창업자 재무 과외)']],
    'stock-option-tax': [['-2h2PTuSfYw', '스톡옵션 부여 한도와 행사 세금']],
    'stock-option': [['WyMopcdTxLA', '스톡옵션 공정가치 계산']],
    'inherit-gift': [['N-85bgrYViY', '상속세 과세표준 20억이면 얼마?'], ['0Lc0eftwXxM', '자녀 증여세 2026']],
    'loan-interest': [['dveLPNuVYjc', '가지급금 인정이자 2026']],
    'capital-impairment': [['ivgUEVG_81o', '자본잠식 뜻과 계산법']],
    'corp-vs-personal': [['8NN1tXzkNkw', '이익 3억, 법인이 유리할까?'], ['jC5iZJCLVFM', '법인 vs 개인사업자 세금 비교']],
    'tax-calendar': [['FyX-kP1hA-o', '법인 세무 신고 일정']],
    'tax-sme': [['HfS9aiG3qFM', '세법상 중소기업 기준']],
    'sme-check': [['e7Vk-_Ksy6M', '중소기업 기준 2026']],
    'venture-check': [['Vhf5XfDCjOE', '벤처기업 확인 요건']],
    'distributable-profit': [['T6UDP5nVPFs', '배당가능이익 계산법']],
    'rcps-cb': [['fB4d5huspeU', 'RCPS 회계처리'], ['zyaT4o7zqYU', 'RCPS 투자받았는데 자본잠식? (창업자 재무 과외)']],
    'angel-deduction': [['3d-fY5VxBQE', '엔젤투자 소득공제']],
    'share-transfer-tax': [['-_LOiatBtSI', '비상장주식 양도소득세']],
    'safe-conversion': [['i9VvLNNMRuo', 'SAFE 투자 전환 주식수'], ['0L4MoPz9_iY', 'SAFE 캡·할인 (창업자 재무 과외)']],
    'dcf': [['mswv7VT3UTE', 'DCF vs 유사기업 멀티플']],
    'multiples': [['mswv7VT3UTE', 'DCF vs 유사기업 멀티플']],
    'related-price': [['_uYqKELnh8I', '특수관계인 주식 거래 시가']],
    'related-party': [['hiQTKFYLt8g', '특수관계인 범위']],
    'equity-bridge': [['HIEGwhE4KE0', '기업가치 150억이면 주식값도 150억?'], ['83hnFxzAtnY', '회사 가치 300억, 주주 몫은?']],
    'valuation-needs': [['tVtXaagsKEQ', '회사 주식 평가, 어떤 걸 받아야 할까?']],
    'fin-ratio': [['I07k-BbmdTM', '은행·투자자가 먼저 보는 재무비율']],
    'lease': [['4fPbUu3Y5jg', '리스 회계처리, 월세 200만원 사무실']],
    'allowance': [['dunN_J1njZI', '대손충당금 계산']],
    'retirement': [['ybWhwGgwACY', '퇴직급여충당부채 계산']],
    'deferred-tax': [['tEMXkCsHJtw', '이연법인세 계산']],
    'revenue-check': [['B4X-sjYsFAY', '수익인식 기준 K-IFRS 1115']],
    'succession': [['WedUyduR8h4', '가업상속공제 요건'], ['dOcBtSit6KM', '가업상속공제 1,000억, 30년 요건 (뉴스 해설)']],
    'ppa': [['HEyKA9nDUYA', 'PPA 영업권 계산']],
    'impairment': [['WQZTJLaEUrI', '영업권 손상검사']],
    'external-valuation': [['kDsrVZPZNHo', '자본시장법 외부평가 대상']],
    'merger-price': [['ktLNlK-3Poc', '상장사 합병가액 계산']],
    'pf-feasibility': [['Jvd5G8h6gw0', '부동산 PF 사업성 계산']],
    'qualified-reorg': [['oNgPfkCLArQ', '적격합병 요건']],
  };

  var box = document.getElementById('result');
  if (!box) return;
  var page = (location.pathname.split('/').pop() || '').replace(/\.html$/, '');
  var related = RELATED[page] || [];
  var videos = VIDEOS[page] || [];

  // ── 결과 링크 공유: 입력값을 주소의 # 뒤에만 담는다(# 뒤는 서버로 전송되지 않음).
  // 링크로 들어오면 값을 메모리에 옮기고 주소창에서 # 부분을 바로 지운다(방문 통계 스크립트가 읽기 전).
  var shared = null;
  (function readHash() {
    var m = /^#v=([A-Za-z0-9_-]+)$/.exec(location.hash || '');
    if (!m) return;
    try {
      var b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
      shared = JSON.parse(decodeURIComponent(escape(atob(b64))));
    } catch (e) { shared = null; }
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* 무시 */ }
  })();

  function theForm() {
    var f = document.getElementById('tool-form');
    if (f) return f;
    var forms = [].filter.call(document.querySelectorAll('main form'), function (x) { return !x.closest('#result') && x.id !== 'contact-form'; });
    return forms[0] || null;
  }
  function fieldKey(el) { return el.id || el.name || ''; }
  function collect() {
    var f = theForm(); if (!f) return null;
    var out = {};
    [].forEach.call(f.querySelectorAll('input, select, textarea'), function (el) {
      var k = fieldKey(el); if (!k || el.type === 'file' || el.type === 'submit' || el.type === 'button') return;
      if (el.type === 'checkbox') out[k] = el.checked ? 1 : 0;
      else if (el.type === 'radio') { if (el.checked) out['r:' + el.name] = el.value; }
      else if (el.value !== '') out[k] = el.value;
    });
    return out;
  }
  function shareUrl() {
    var v = collect(); if (!v) return null;
    var b64 = btoa(unescape(encodeURIComponent(JSON.stringify(v)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return location.origin + location.pathname + '#v=' + b64;
  }
  function restore() {
    if (!shared) return;
    var f = theForm(); if (!f) return;
    var data = shared; shared = null;
    [].forEach.call(f.querySelectorAll('input, select, textarea'), function (el) {
      var k = fieldKey(el);
      if (el.type === 'radio') { if (('r:' + el.name) in data) el.checked = (data['r:' + el.name] === el.value); }
      else if (k && k in data) { if (el.type === 'checkbox') el.checked = !!data[k]; else el.value = data[k]; }
      else return;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    setTimeout(function () {
      try { if (f.requestSubmit) f.requestSubmit(); else f.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })); } catch (e) { /* 무시 */ }
    }, 200);
  }
  if (shared) {
    if (document.readyState === 'complete') setTimeout(restore, 300);
    else window.addEventListener('load', function () { setTimeout(restore, 300); });
  }

  // ── 결과 인쇄·PDF 저장: 결과 영역만 한 장으로 인쇄한다(브라우저 인쇄 기능, 서버 전송 없음).
  function printResult() {
    var head = document.createElement('div');
    head.className = 'print-head';
    var d = new Date();
    var ds = d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + '.';
    head.innerHTML = '<p class="print-title">' + esc(document.title.split('|')[0].trim()) + '</p>' +
      '<p class="print-meta">계산일 ' + ds + ' · 회사명 ______________________ · cpatool.co.kr</p>';
    var foot = document.createElement('div');
    foot.className = 'print-foot';
    foot.innerHTML = '<p>이 결과는 입력한 숫자로 계산한 참고 자료이며 법률·회계·세무 자문을 대신하지 않습니다. 근거 조문과 기준일은 cpatool.co.kr/basis.html 에 있습니다. 문의: cpatool.co.kr/kakao</p>';
    box.insertBefore(head, box.firstChild); box.appendChild(foot);
    document.body.classList.add('print-result');
    function done() { document.body.classList.remove('print-result'); head.remove(); foot.remove(); window.removeEventListener('afterprint', done); }
    window.addEventListener('afterprint', done);
    window.print();
    setTimeout(function () { if (document.body.classList.contains('print-result')) done(); }, 60000);
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function resultText() {
    var clone = box.cloneNode(true);
    var t = clone.querySelector('.result-tools'); if (t) t.remove();
    clone.querySelectorAll('button, .btn, .btn-row').forEach(function (el) { el.remove(); });
    // 표는 셀 사이를 탭으로 구분
    clone.querySelectorAll('tr').forEach(function (tr) {
      var cells = [].map.call(tr.querySelectorAll('th,td'), function (c) { return c.textContent.trim(); });
      tr.textContent = cells.join('\t') + '\n';
    });
    clone.querySelectorAll('li').forEach(function (li) { li.textContent = '- ' + li.textContent.trim() + '\n'; });
    clone.querySelectorAll('h3, p, div').forEach(function (el) { el.appendChild(document.createTextNode('\n')); });
    var text = clone.textContent.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    return '[' + document.title.split('|')[0].trim() + ']\n' + text + '\n\n' + location.href + '\n※ 참고용 계산 결과이며 법률·회계 자문을 대신하지 않습니다.';
  }

  // ── 이 결과로 상담 신청(2026-11-18): 결과 요약을 이 브라우저의 sessionStorage에만 담아 상담 신청서로 넘긴다.
  // 서버로 보내지 않으며, 방문자가 상담 신청서에서 내용을 확인·수정한 뒤 직접 보낼 때만 전달된다.
  var TOPIC_OF = {
    audit: 'audit-check audit-schedule audit-prep audit-designation audit-fee governance consolidation ipo-prep',
    icfr: 'icfr-check',
    ifrs: 'lease depreciation allowance retirement deferred-tax revenue-check impairment rcps-cb stock-option fin-ratio capital-impairment working-capital break-even debt-capacity distributable-profit dev-cost fx-translation inventory-lcm gov-grant unused-leave accrual-prepaid effective-interest dupont operating-cashflow',
    fdd: 'valuation-needs stock-valuation dcf dilution external-valuation merger-price option-limit safe-conversion equity-bridge multiples pf-feasibility qualified-reorg runway dscr red-flags credit-metrics cap-table exit-waterfall',
    ppa: 'ppa',
    etc: 'loan-repayment dsr-limit'
  };
  function topicOf(p) { for (var k in TOPIC_OF) { if ((' ' + TOPIC_OF[k] + ' ').indexOf(' ' + p + ' ') >= 0) return k; } return 'tax'; }
  function toConsult() {
    var text = resultText();
    if (text.length > 1800) text = text.slice(0, 1800) + '\n…(이하 생략)';
    try { sessionStorage.setItem('cptConsult', JSON.stringify({ tool: document.title.split('|')[0].trim(), page: page, text: text })); } catch (e) { /* 저장소 사용 불가: 빈 신청서로 이동 */ }
    location.href = 'contact.html?topic=' + topicOf(page) + '&from=' + encodeURIComponent(page);
  }

  function attach() {
    if (box.classList.contains('hidden') || !box.innerHTML.trim() || box.querySelector('.result-tools')) return;
    var host = box.querySelector('.result-body') || box;
    var canShare = !!theForm();
    var html = '<div class="result-tools">' +
      '<div class="consult-cta"><p><b>이 결과, 우리 회사에 맞는지 궁금하신가요?</b> 계산 결과를 상담 신청서에 미리 넣어 드립니다. 보내기 전에 내용을 확인하고 고칠 수 있습니다.</p>' +
      '<button type="button" class="btn small" data-consult>이 결과로 상담 신청</button></div>' +
      '<div class="btn-row"><button type="button" class="btn secondary small" data-copy>결과 복사</button>' +
      (canShare ? '<button type="button" class="btn secondary small" data-share>결과 링크 복사</button>' : '') +
      '<button type="button" class="btn secondary small" data-print>인쇄·PDF 저장</button>' +
      '<a class="btn kakao small" href="' + KAKAO_CHAT + '" target="_blank" rel="noopener">카카오톡으로 문의</a><span class="hint copy-state" aria-live="polite">결과를 복사하거나 링크로 공유할 수 있습니다. 링크에는 입력한 숫자가 담기니 공유할 사람을 확인해 주세요.</span></div>';
    if (videos.length) {
      html += '<p class="related-title">영상으로 보기</p><ul class="related videos">' + videos.map(function (v) { return '<li><a href="https://youtu.be/' + v[0] + '" target="_blank" rel="noopener">▶ ' + esc(v[1]) + '</a></li>'; }).join('') + '</ul>';
    }
    if (related.length) {
      html += '<p class="related-title">함께 보면 좋은 도구</p><ul class="related">' + related.map(function (r) { return '<li><a href="' + r[0] + '">' + esc(r[1]) + '</a></li>'; }).join('') + '</ul>';
    }
    html += '<p class="kakao-add">세법이 바뀌면 카카오톡으로 알려 드립니다. <a href="' + KAKAO_ADD + '" target="_blank" rel="noopener">카카오톡 채널 추가하기</a></p>';
    html += '</div>';
    host.insertAdjacentHTML('beforeend', html);
    var btn = host.querySelector('[data-copy]'), state = host.querySelector('.copy-state');
    host.querySelector('[data-print]').addEventListener('click', printResult);
    host.querySelector('[data-consult]').addEventListener('click', toConsult);
    var sb = host.querySelector('[data-share]');
    if (sb) sb.addEventListener('click', function () {
      var url = shareUrl();
      if (!url) { state.textContent = '이 도구는 링크 공유를 지원하지 않습니다.'; return; }
      function fb() {
        var ta = document.createElement('textarea'); ta.value = url; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px'; document.body.appendChild(ta); ta.select();
        var ok = false; try { ok = document.execCommand('copy'); } catch (e) { /* 지원 안 함 */ }
        document.body.removeChild(ta);
        state.textContent = ok ? '결과 링크를 복사했습니다. 링크를 연 사람은 같은 숫자로 다시 계산된 화면을 봅니다.' : '복사가 지원되지 않는 환경입니다.';
      }
      try { navigator.clipboard.writeText(url).then(function () { state.textContent = '결과 링크를 복사했습니다. 링크를 연 사람은 같은 숫자로 다시 계산된 화면을 봅니다.'; }, fb); } catch (e) { fb(); }
    });
    btn.addEventListener('click', function () {
      var text = resultText();
      function fallback() {
        var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px'; document.body.appendChild(ta); ta.select();
        var ok = false; try { ok = document.execCommand('copy'); } catch (e) { /* 지원 안 함 */ }
        document.body.removeChild(ta);
        state.textContent = ok ? '복사했습니다.' : '복사가 지원되지 않는 환경입니다. 화면을 캡처하거나 인쇄해 주세요.';
      }
      try { navigator.clipboard.writeText(text).then(function () { state.textContent = '복사했습니다.'; }, fallback); } catch (e) { fallback(); }
    });
  }

  attach();
  new MutationObserver(attach).observe(box, { childList: true, attributes: true, attributeFilter: ['class'] });
})();
