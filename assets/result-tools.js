/*
 * 결과 화면 공통 도구: (1) "결과 복사" 버튼 — 결과 전체를 텍스트로 복사해 카톡·메일에 붙여 넣을 수 있게 함
 *                     (2) "함께 보면 좋은 도구" — 페이지별 다음 단계 링크 (RELATED가 단일 출처)
 * 각 도구 페이지의 #result 가 채워질 때마다 아래 블록을 덧붙인다. 서버로 보내는 것은 없다.
 */
(function () {
  'use strict';
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
    'venture-check': [['stock-option-tax.html', '스톡옵션 행사 세금'], ['option-limit.html', '스톡옵션 부여 한도'], ['dilution.html', '투자 유치 지분 희석']],
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
    'fin-ratio': [['capital-impairment.html', '자본잠식·채무초과 진단'], ['audit-check.html', '외부감사 대상 판정기']],
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
    'corp-tax': [['deferred-tax.html', '이연법인세 간이 계산'], ['rnd-credit.html', '연구·인력개발비 세액공제'], ['tax-calendar.html', '법인 세무 신고 일정표']],
    'qualified-reorg': [['merger-price.html', '상장사 합병가액'], ['external-valuation.html', '자본시장법 외부평가 대상'], ['equity-bridge.html', '기업가치→지분가치 환산']],
    'distributable-profit': [['capital-impairment.html', '자본잠식·채무초과 진단'], ['withholding.html', '배당 원천징수 계산'], ['fin-ratio.html', '재무비율 간이 진단']],
    'tax-penalty': [['tax-calendar.html', '법인 세무 신고 일정표'], ['corp-tax.html', '법인세 간이 계산기'], ['withholding.html', '원천징수 세액 계산기']],
    'withholding': [['tax-calendar.html', '법인 세무 신고 일정표'], ['corp-vs-personal.html', '법인 vs 개인사업자 세금 비교']],
  };

  var box = document.getElementById('result');
  if (!box) return;
  var page = (location.pathname.split('/').pop() || '').replace(/\.html$/, '');
  var related = RELATED[page] || [];

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

  function attach() {
    if (box.classList.contains('hidden') || !box.innerHTML.trim() || box.querySelector('.result-tools')) return;
    var host = box.querySelector('.result-body') || box;
    var html = '<div class="result-tools">' +
      '<div class="btn-row"><button type="button" class="btn secondary small" data-copy>결과 복사</button><span class="hint copy-state" aria-live="polite">복사한 내용을 카카오톡·메일에 붙여 넣어 공유할 수 있습니다.</span></div>';
    if (related.length) {
      html += '<p class="related-title">함께 보면 좋은 도구</p><ul class="related">' + related.map(function (r) { return '<li><a href="' + r[0] + '">' + esc(r[1]) + '</a></li>'; }).join('') + '</ul>';
    }
    html += '</div>';
    host.insertAdjacentHTML('beforeend', html);
    var btn = host.querySelector('[data-copy]'), state = host.querySelector('.copy-state');
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
