/*
 * 설정형 도구 화면 엔진 (2026-11-09 추가 도구 공통). 페이지 <body data-tool="키">의 설정을 more-tools.js에서 찾아
 * #tool-form 안에 입력 폼을 만들고, 제출하면 규칙 모듈 결과를 #result에 그린다. 입력값은 브라우저 안에서만 계산(서버 전송 없음).
 */
(function (root) {
  'use strict';
  var REG = {};
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function n(x, d) { return x === null || x === undefined || x === '' ? '-' : Number(x).toLocaleString('ko-KR', { maximumFractionDigits: d === undefined ? 2 : d }); }
  function won(x) { return n(x, 0) + '원'; }
  function man(x) { return n(Math.round(x / 10000), 0) + '만원'; }
  /** rows: [[label, value, isTotal]] → 2열 표 */
  function table(rows) {
    return '<table><tbody>' + rows.filter(Boolean).map(function (r) { return '<tr' + (r[2] ? ' class="row-total"' : '') + '><td>' + esc(r[0]) + '</td><td class="num">' + esc(r[1]) + '</td></tr>'; }).join('') + '</tbody></table>';
  }
  /** head: [..], rows: [[..]] → 스크롤 표 (첫 열 제외 숫자 정렬) */
  function grid(head, rows) {
    return '<div class="table-scroll"><table><thead><tr>' + head.map(function (h, i) { return '<th' + (i ? ' class="num"' : '') + '>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr>' + r.map(function (c, i) { return '<td' + (i ? ' class="num"' : '') + '>' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
  }
  function list(title, arr) { return arr && arr.length ? '<h3>' + esc(title) + '</h3><ul class="basis">' + arr.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : ''; }

  var DISCLAIMER = '이 결과는 입력하신 값에 법령·산식을 기계적으로 적용한 참고 자료이며 세무·회계 자문을 대신하지 않습니다. 실제 신고·회계처리·거래 결정 전에는 사실관계를 확인해 공인회계사와 상담하시기 바랍니다.';

  function fieldHtml(f) {
    var hint = f.hint ? '<span class="hint">' + esc(f.hint) + '</span>' : '';
    var when = f.when ? ' data-when="1"' : '';
    switch (f.type) {
      case 'fieldset':
        return '<fieldset data-fid="' + esc(f.id || '') + '"' + when + '><legend>' + esc(f.legend) + '</legend>' + (f.intro ? '<p class="hint" style="margin:0 0 10px">' + esc(f.intro) + '</p>' : '') + f.items.map(fieldHtml).join('') + '</fieldset>';
      case 'two':
        return '<div class="two"' + when + ' data-fid="' + esc(f.id || '') + '">' + f.items.map(fieldHtml).join('') + '</div>';
      case 'html':
        return '<div' + when + ' data-fid="' + esc(f.id || '') + '">' + f.html + '</div>';
      case 'number': case 'text':
        return '<div class="field"' + when + ' data-fid="' + f.id + '"><label for="' + f.id + '">' + esc(f.label) + (f.unit ? ' (' + esc(f.unit) + ')' : '') + '</label><input id="' + f.id + '" type="' + (f.type === 'number' ? 'number' : 'text') + '"' +
          (f.type === 'number' ? ' inputmode="decimal" step="' + (f.step || 'any') + '"' + (f.allowNeg ? '' : ' min="0"') : '') + (f.placeholder !== undefined ? ' placeholder="' + esc(f.placeholder) + '"' : '') + (f.value !== undefined ? ' value="' + esc(f.value) + '"' : '') + '>' + hint + '</div>';
      case 'select':
        return '<div class="field"' + when + ' data-fid="' + f.id + '"><label for="' + f.id + '">' + esc(f.label) + '</label><select id="' + f.id + '">' + f.options.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === f.value ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>' + hint + '</div>';
      case 'radio':
        return '<div class="field"' + when + ' data-fid="' + f.id + '" role="radiogroup" aria-label="' + esc(f.label) + '"><p class="field-label" style="font-weight:600;margin:0 0 6px">' + esc(f.label) + '</p>' + f.options.map(function (o, i) {
          return '<label class="choice"><input type="radio" name="' + f.id + '" value="' + esc(o[0]) + '"' + ((f.value === undefined ? i === 0 : o[0] === f.value) ? ' checked' : '') + '><span>' + esc(o[1]) + '</span></label>';
        }).join('') + hint + '</div>';
      case 'check':
        return '<label class="choice"' + when + ' data-fid="' + f.id + '"><input type="checkbox" id="' + f.id + '"' + (f.value ? ' checked' : '') + '><span>' + esc(f.label) + (f.hint ? ' <span class="hint" style="display:inline">' + esc(f.hint) + '</span>' : '') + '</span></label>';
      case 'checks':
        return '<div class="field"' + when + ' data-fid="' + f.id + '">' + (f.label ? '<p style="font-weight:600;margin:0 0 6px">' + esc(f.label) + '</p>' : '') + f.options.map(function (o) {
          return '<label class="choice"><input type="checkbox" name="' + f.id + '" value="' + esc(o[0]) + '"><span>' + esc(o[1]) + '</span></label>';
        }).join('') + hint + '</div>';
      case 'rows':
        var body = '';
        for (var i = 0; i < (f.rows || 3); i++) body += rowHtml(f, i);
        return '<div class="field"' + when + ' data-fid="' + f.id + '"><p style="font-weight:600;margin:0 0 6px">' + esc(f.label) + '</p>' + hint +
          '<div class="table-scroll"><table class="input-table" data-rows="' + f.id + '"><thead><tr>' + f.columns.map(function (c) { return '<th>' + esc(c.label) + '</th>'; }).join('') + '</tr></thead><tbody>' + body + '</tbody></table></div>' +
          '<button type="button" class="btn btn-ghost" data-add="' + f.id + '" style="margin-top:8px">+ ' + esc(f.addLabel || '행 추가') + '</button></div>';
    }
    return '';
  }
  function rowHtml(f, i) {
    return '<tr>' + f.columns.map(function (c) {
      var aria = ' aria-label="' + esc(c.label + ' ' + (i + 1)) + '"';
      if (c.type === 'select') return '<td><select data-col="' + c.key + '"' + aria + '>' + c.options.map(function (o) { return '<option value="' + esc(o[0]) + '">' + esc(o[1]) + '</option>'; }).join('') + '</select></td>';
      return '<td><input data-col="' + c.key + '"' + aria + ' type="' + (c.type === 'text' ? 'text' : 'number') + '"' + (c.type === 'text' ? '' : ' inputmode="decimal" step="any"') + (c.placeholder ? ' placeholder="' + esc(c.placeholder) + '"' : '') + '></td>';
    }).join('') + '</tr>';
  }

  function walk(items, fn) { items.forEach(function (f) { fn(f); if (f.items) walk(f.items, fn); }); }

  function collect(form, cfg) {
    var v = {};
    walk(cfg.fields, function (f) {
      if (!f.id) return;
      if (f.type === 'number' || f.type === 'text' || f.type === 'select') { var el = form.querySelector('#' + f.id); v[f.id] = el ? el.value.trim() : ''; }
      else if (f.type === 'radio') { var c = form.querySelector('input[name="' + f.id + '"]:checked'); v[f.id] = c ? c.value : ''; }
      else if (f.type === 'check') { var cb = form.querySelector('#' + f.id); v[f.id] = !!(cb && cb.checked); }
      else if (f.type === 'checks') v[f.id] = Array.prototype.map.call(form.querySelectorAll('input[name="' + f.id + '"]:checked'), function (x) { return x.value; });
      else if (f.type === 'rows') {
        v[f.id] = Array.prototype.map.call(form.querySelectorAll('table[data-rows="' + f.id + '"] tbody tr'), function (tr) {
          var o = {}, filled = false;
          Array.prototype.forEach.call(tr.querySelectorAll('[data-col]'), function (el) { o[el.getAttribute('data-col')] = el.value.trim(); if (el.tagName !== 'SELECT' && el.value.trim() !== '') filled = true; });
          return filled ? o : null;
        }).filter(Boolean);
      }
    });
    return v;
  }

  function sync(form, cfg) {
    var v = collect(form, cfg);
    walk(cfg.fields, function (f) {
      if (!f.when) return;
      var el = form.querySelector('[data-fid="' + (f.id || '') + '"]');
      if (el) el.classList.toggle('hidden', !f.when(v));
    });
  }

  function mount() {
    var key = document.body.getAttribute('data-tool');
    var cfg = REG[key];
    var form = document.getElementById('tool-form');
    if (!cfg || !form) return;
    if (typeof cfg.fields === 'function') cfg.fields = cfg.fields(); // 규칙 모듈의 선택지를 쓰는 설정은 페이지에서 늦게 만든다
    form.innerHTML = cfg.fields.map(fieldHtml).join('') + '<div id="errors" aria-live="polite"></div><button type="submit" class="btn">' + esc(cfg.submit || '계산하기') + '</button>';
    var errorBox = document.getElementById('errors'), resultBox = document.getElementById('result');
    form.addEventListener('input', function () { sync(form, cfg); });
    form.addEventListener('change', function () { sync(form, cfg); });
    form.addEventListener('click', function (e) {
      var add = e.target.getAttribute && e.target.getAttribute('data-add');
      if (!add) return;
      var f = null; walk(cfg.fields, function (x) { if (x.id === add) f = x; });
      var tb = form.querySelector('table[data-rows="' + add + '"] tbody');
      if (f && tb) tb.insertAdjacentHTML('beforeend', rowHtml(f, tb.children.length));
    });
    sync(form, cfg);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = collect(form, cfg);
      var out;
      try { out = cfg.run(v); } catch (err) { out = { r: { status: 'INVALID', errors: ['계산 중 오류가 발생했습니다. 입력값을 확인해 주세요.'] } }; }
      var r = out.r;
      if (r.status === 'INVALID') {
        errorBox.innerHTML = '<ul class="error-list">' + r.errors.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>';
        resultBox.classList.add('hidden');
        return;
      }
      errorBox.innerHTML = '';
      resultBox.className = 'result ' + (out.cls || 'exempt');
      resultBox.innerHTML = '<div class="result-head"><p class="verdict">' + esc(out.title) + '</p>' + (out.sub ? '<p>' + esc(out.sub) + '</p>' : '') + '</div><div class="result-body">' + (out.body || '') +
        list('계산 방법·근거', r.basis) + list('참고', r.notes) +
        '<div class="notice">' + esc(out.disclaimer || DISCLAIMER) + ' (기준 확인일: ' + esc(r.version) + ')</div>' +
        '<div class="btn-row" style="margin-top:16px"><a class="btn" href="contact.html?topic=' + esc(out.topic || 'tax') + '">' + esc(out.label || '상담 신청') + '</a></div></div>';
      resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
      try { sessionStorage.setItem('auditCheckSummary', out.summary || ('[' + document.title.split(' |')[0] + '] ' + out.title)); } catch (err2) { /* 저장 불가 환경 무시 */ }
    });
  }

  root.ToolEngine = { register: function (k, c) { REG[k] = c; }, esc: esc, n: n, won: won, man: man, table: table, grid: grid };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else setTimeout(mount, 0);
})(this);
