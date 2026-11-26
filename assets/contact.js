/* 상담 신청 폼 */
(function () {
  'use strict';
  var cfg = window.SITE_CONFIG || {};
  var form = document.getElementById('contact-form');
  var errBox = document.getElementById('contact-errors');
  var done = document.getElementById('contact-done');
  var useMailto = !cfg.FORM_ENDPOINT;

  if (useMailto) {
    document.getElementById('mailto-hint').classList.remove('hidden');
    var ka = document.getElementById('kakao-alt');
    if (ka) {
      ka.classList.remove('hidden');
      // 메일 앱 없이: 신청서 내용을 복사하고 카카오톡 채팅을 연다(개인정보 동의 체크는 그대로 요구)
      document.getElementById('copy-kakao').addEventListener('click', function () {
        var st = document.getElementById('kakao-state');
        var errs = validate();
        if (errs.length) { st.textContent = errs[0]; return; }
        var d = data();
        var text = '[상담 신청] 회사명: ' + d.company + ' / 담당자: ' + d.name + ' / 연락처: ' + d.phone + (d.email ? ' / 이메일: ' + d.email : '') + '\n상담 분야: ' + d.topic + '\n\n' + d.message;
        // 새 창을 열기 전에 먼저 복사한다(창이 열리면 이 페이지가 포커스를 잃어 복사가 막힐 수 있음)
        var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px'; document.body.appendChild(ta); ta.select();
        var copied = false; try { copied = document.execCommand('copy'); } catch (e) { /* 무시 */ }
        document.body.removeChild(ta);
        if (!copied && navigator.clipboard) { try { navigator.clipboard.writeText(text); copied = true; } catch (e) { /* 무시 */ } }
        var win = window.open('https://pf.kakao.com/_xgxfENX/chat', '_blank');
        st.textContent = copied ? '복사했습니다. 열린 카카오톡 채팅창에 붙여 넣고 보내 주세요.' : '복사가 지원되지 않는 환경입니다. 문의 내용을 직접 복사해 주세요.';
        if (!win) st.textContent += ' 창이 열리지 않았다면 위쪽 "카카오톡으로 문의" 버튼을 눌러 주세요.';
      });
    }
  }

  // 판정기에서 넘어온 경우: 상담 분야와 결과 요약 미리 채우기
  var params = new URLSearchParams(location.search);
  var topic = params.get('topic');
  // 주소 값을 선택자에 넣지 않는다(따옴표가 들어오면 오류로 아래 제출 처리가 빠져 입력값이 주소창으로 샐 수 있음)
  if (topic && [].some.call(form.topic.options, function (o) { return o.value === topic; })) form.topic.value = topic;
  try {
    var summary = sessionStorage.getItem('auditCheckSummary');
    if (summary && topic && !form.message.value) form.message.value = summary + '\n\n[추가 문의 내용]\n';
  } catch (e) { /* 저장소 사용 불가 시 무시 */ }
  // 계산 결과 화면의 "이 결과로 상담 신청"에서 넘어온 경우(result-tools.js, 2026-11-18)
  try {
    var c = JSON.parse(sessionStorage.getItem('cptConsult') || 'null');
    if (c && c.text && params.get('from') === c.page) {
      form.message.value = '[계산 결과]\n' + c.text + '\n\n[추가 문의 내용]\n';
      var note = document.createElement('p');
      note.className = 'notice consult-note';
      note.innerHTML = '<b>' + esc(c.tool) + '</b> 계산 결과를 문의 내용에 넣었습니다. 회사 숫자를 드러내고 싶지 않으면 지우거나 고친 뒤 보내 주세요. 이 내용은 직접 보내기 전까지 이 브라우저 밖으로 나가지 않습니다.';
      form.message.closest('.field').insertAdjacentElement('beforebegin', note);
    }
  } catch (e) { /* 무시 */ }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function validate() {
    var errs = [];
    if (!form.name.value.trim()) errs.push('담당자 성명을 입력해 주세요.');
    if (!/^[0-9+\-\s()]{8,}$/.test(form.phone.value.trim())) errs.push('연락처를 정확히 입력해 주세요.');
    if (form.email.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.value.trim())) errs.push('이메일 형식을 확인해 주세요.');
    if (!form.message.value.trim()) errs.push('문의 내용을 입력해 주세요.');
    if (!form.agree.checked) errs.push('개인정보 수집·이용에 동의해 주셔야 접수됩니다.');
    return errs;
  }

  function data() {
    return {
      company: form.company.value.trim(),
      name: form.name.value.trim(),
      phone: form.phone.value.trim(),
      email: form.email.value.trim(),
      topic: form.topic.options[form.topic.selectedIndex].text,
      message: form.message.value.trim(),
      agree: '동의',
    };
  }

  document.getElementById('copy-mail').addEventListener('click', function () {
    var ta = document.getElementById('mail-body'), state = document.getElementById('copy-state');
    function fallback() { ta.focus(); ta.select(); state.textContent = '내용을 선택했습니다. Ctrl+C(⌘+C)로 복사해 주세요.'; }
    try {
      navigator.clipboard.writeText(ta.value).then(function () { state.textContent = '복사했습니다.'; }, fallback);
    } catch (err) { fallback(); }
  });

  function finish(text) {
    form.classList.add('hidden');
    if (text) document.getElementById('done-text').textContent = text;
    done.classList.remove('hidden');
    try { sessionStorage.removeItem('auditCheckSummary'); sessionStorage.removeItem('cptConsult'); } catch (e) { /* ignore */ }
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var errs = validate();
    if (errs.length) {
      errBox.innerHTML = '<ul class="error-list">' + errs.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>';
      return;
    }
    errBox.innerHTML = '';
    var d = data();

    if (useMailto) {
      var subject = '[상담 신청] ' + (d.company || d.name) + ' - ' + d.topic;
      var body = '회사명: ' + d.company + '\n담당자: ' + d.name + '\n연락처: ' + d.phone + '\n이메일: ' + d.email +
        '\n상담 분야: ' + d.topic + '\n개인정보 수집·이용: 동의\n\n' + d.message;
      // 메일 앱이 열려도 실제 전송은 방문자가 해야 하므로 "접수 완료"로 표시하지 않는다
      document.getElementById('done-title').textContent = '아직 접수 전입니다. 메일을 보내 주세요';
      document.getElementById('mail-to').textContent = cfg.CONTACT_EMAIL;
      document.getElementById('mail-body').value = '제목: ' + subject + '\n\n' + body;
      document.getElementById('mail-fallback').classList.remove('hidden');
      finish('메일 앱이 열리면 내용을 확인하고 보내기를 눌러 주세요. 메일이 도착해야 접수됩니다.');
      try { location.href = 'mailto:' + cfg.CONTACT_EMAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body); } catch (err) { /* 메일 앱 없음 */ }
      return;
    }

    var btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.textContent = '전송 중...';
    fetch(cfg.FORM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(d),
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      finish();
    }).catch(function () {
      btn.disabled = false;
      btn.textContent = '상담 신청하기';
      errBox.innerHTML = '<ul class="error-list"><li>전송에 실패했습니다. 잠시 후 다시 시도하시거나 ' + esc(cfg.CONTACT_EMAIL) + ' 로 메일을 보내 주세요.</li></ul>';
    });
  });
})();
