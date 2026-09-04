/* ============================================================
   ADMIN DASHBOARD

   Users, content/comment moderation, reports and analytics, all via
   the /api/admin/* routes. Gated by PUS.requireAdmin() — anyone
   without an admin role bounces straight back to the homepage.
   ============================================================ */
(() => {
  'use strict';

  if (!window.PUS || !PUS.requireAdmin()) return;

  const $ = (s) => document.querySelector(s);

  function authHeaders() {
    return { Authorization: 'Bearer ' + PUS.token() };
  }

  async function api(path, options = {}) {
    const res = await fetch('/api/admin' + path, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(options.headers || {}) }
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Request failed');
    }
    return res.json();
  }

  function timeAgo(ts) {
    const s = Math.max(0, (Date.now() - PUS.parseDate(ts).getTime()) / 1000);
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60);
    if (m < 60) return m + 'm ago';
    const h = Math.floor(m / 60);
    if (h < 24) return h + 'h ago';
    const d = Math.floor(h / 24);
    if (d < 30) return d + 'd ago';
    return PUS.parseDate(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* ---------- analytics ---------- */
  async function loadAnalytics() {
    try {
      const [analytics, pageviews] = await Promise.all([
        api('/analytics'),
        api('/analytics/pageviews')
      ]);

      $('#statUsers').textContent = analytics.totals.users;
      $('#statContent').textContent = analytics.totals.content;
      $('#statComments').textContent = analytics.totals.comments;
      $('#statLikes').textContent = analytics.totals.likes;
      $('#statNewUsers').textContent = analytics.last_7_days.new_users;
      $('#statNewContent').textContent = analytics.last_7_days.new_content;

      const top = pageviews.top_pages.slice(0, 5).map((p) => `${p.path} (${p.views})`).join(', ');
      $('#topPagesLine').textContent = pageviews.total_views_last_7_days
        ? `Top pages this week: ${top || '—'}`
        : 'No page views logged yet this week.';
    } catch (err) {
      $('#topPagesLine').textContent = 'Could not load analytics: ' + err.message;
    }
  }

  /* ---------- users ---------- */
  async function loadUsers() {
    const body = $('#usersBody');
    body.textContent = '';
    let users;
    try {
      ({ users } = await api('/users'));
    } catch (err) {
      body.appendChild(el('tr')).appendChild(el('td', 'is-muted', 'Could not load users: ' + err.message));
      return;
    }

    users.forEach((u) => {
      const tr = el('tr');
      tr.appendChild(el('td', null, u.name));
      tr.appendChild(el('td', 'is-muted', u.email));

      const roleTd = el('td');
      const roleBadge = el('span', 'admin-badge' + (u.role === 'admin' ? ' is-admin-role' : ''), u.role);
      roleTd.appendChild(roleBadge);
      tr.appendChild(roleTd);

      const statusTd = el('td');
      statusTd.appendChild(el('span', 'admin-badge' + (u.is_active ? '' : ' is-inactive'), u.is_active ? 'active' : 'deactivated'));
      tr.appendChild(statusTd);

      const actionsTd = el('td');
      const actions = el('div', 'admin-actions');

      const roleBtn = el('button', null, u.role === 'admin' ? 'REMOVE ADMIN' : 'MAKE ADMIN');
      roleBtn.type = 'button';
      roleBtn.addEventListener('click', async () => {
        const newRole = u.role === 'admin' ? 'user' : 'admin';
        if (!confirm(`Change ${u.name}'s role to ${newRole}?`)) return;
        try {
          await api(`/users/${u.id}/role`, { method: 'PUT', body: JSON.stringify({ role: newRole }) });
          loadUsers();
        } catch (err) { alert(err.message); }
      });
      actions.appendChild(roleBtn);

      const statusBtn = el('button', u.is_active ? 'is-danger' : null, u.is_active ? 'DEACTIVATE' : 'ACTIVATE');
      statusBtn.type = 'button';
      statusBtn.addEventListener('click', async () => {
        if (u.is_active && !confirm(`Deactivate ${u.name}? They'll be signed out immediately.`)) return;
        try {
          await api(`/users/${u.id}/${u.is_active ? 'deactivate' : 'activate'}`, { method: 'PUT' });
          loadUsers();
        } catch (err) { alert(err.message); }
      });
      actions.appendChild(statusBtn);

      actionsTd.appendChild(actions);
      tr.appendChild(actionsTd);
      body.appendChild(tr);
    });
  }

  /* ---------- content moderation ---------- */
  async function loadContent() {
    const body = $('#contentBody');
    body.textContent = '';
    let content;
    try {
      ({ content } = await api('/content'));
    } catch (err) {
      body.appendChild(el('tr')).appendChild(el('td', 'is-muted', 'Could not load content: ' + err.message));
      return;
    }

    content.forEach((c) => {
      const tr = el('tr');
      tr.appendChild(el('td', null, c.title));
      tr.appendChild(el('td', 'is-muted', c.type + (c.topic ? ' · ' + c.topic : '')));
      tr.appendChild(el('td', 'is-muted', (c.author && c.author.name) || 'Unknown'));
      tr.appendChild(el('td', 'is-muted', timeAgo(c.created_at)));

      const actionsTd = el('td');
      const actions = el('div', 'admin-actions');

      if (c.user_id === PUS.get().id) {
        const edit = el('button', null, 'EDIT');
        edit.type = 'button';
        edit.addEventListener('click', () => startEditContent(c));
        actions.appendChild(edit);
      }

      const del = el('button', 'is-danger', 'DELETE');
      del.type = 'button';
      del.addEventListener('click', async () => {
        if (!confirm(`Delete "${c.title}"? This also removes its comments and likes.`)) return;
        try {
          await api(`/content/${c.id}`, { method: 'DELETE' });
          loadContent();
          loadAnalytics();
        } catch (err) { alert(err.message); }
      });
      actions.appendChild(del);
      actionsTd.appendChild(actions);
      tr.appendChild(actionsTd);
      body.appendChild(tr);
    });
  }

  /* ---------- reports ---------- */
  async function loadReports() {
    const body = $('#reportsBody');
    body.textContent = '';
    let reports;
    try {
      ({ reports } = await api('/reports'));
    } catch (err) {
      body.appendChild(el('tr')).appendChild(el('td', 'is-muted', 'Could not load reports: ' + err.message));
      return;
    }

    if (!reports.length) {
      const tr = el('tr');
      tr.appendChild(el('td', 'is-muted', 'No reports yet.'));
      body.appendChild(tr);
      return;
    }

    reports.forEach((r) => {
      const tr = el('tr');
      tr.appendChild(el('td', null, (r.reporter && r.reporter.name) || 'Unknown'));
      tr.appendChild(el('td', 'is-muted', `${r.target_type} · ${r.target_id.slice(0, 8)}…`));
      tr.appendChild(el('td', null, r.reason));

      const statusTd = el('td');
      statusTd.appendChild(el('span', 'admin-badge' + (r.status === 'pending' ? ' is-pending' : ''), r.status));
      tr.appendChild(statusTd);

      const actionsTd = el('td');
      if (r.status === 'pending') {
        const actions = el('div', 'admin-actions');
        const review = el('button', null, 'MARK REVIEWED');
        review.type = 'button';
        review.addEventListener('click', () => updateReportStatus(r.id, 'reviewed'));
        const dismiss = el('button', null, 'DISMISS');
        dismiss.type = 'button';
        dismiss.addEventListener('click', () => updateReportStatus(r.id, 'dismissed'));
        actions.appendChild(review);
        actions.appendChild(dismiss);
        actionsTd.appendChild(actions);
      } else {
        actionsTd.appendChild(el('span', 'is-muted', '—'));
      }
      tr.appendChild(actionsTd);
      body.appendChild(tr);
    });
  }

  async function updateReportStatus(id, status) {
    try {
      await api(`/reports/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });
      loadReports();
      loadAuditLog();
    } catch (err) { alert(err.message); }
  }

  /* ---------- contact messages ---------- */
  async function loadContactMessages() {
    const body = $('#contactBody');
    body.textContent = '';
    let contactMessages;
    try {
      ({ contactMessages } = await api('/contact-messages'));
    } catch (err) {
      body.appendChild(el('tr')).appendChild(el('td', 'is-muted', 'Could not load messages: ' + err.message));
      return;
    }

    if (!contactMessages.length) {
      const tr = el('tr');
      tr.appendChild(el('td', 'is-muted', 'No messages yet.'));
      body.appendChild(tr);
      return;
    }

    contactMessages.forEach((c) => {
      const tr = el('tr');
      const fromTd = el('td');
      fromTd.appendChild(el('div', null, c.name));
      fromTd.appendChild(el('div', 'is-muted', c.email));
      tr.appendChild(fromTd);
      tr.appendChild(el('td', null, c.subject || '—'));
      tr.appendChild(el('td', 'is-muted', c.message.length > 140 ? c.message.slice(0, 140) + '…' : c.message));
      tr.appendChild(el('td', 'is-muted', timeAgo(c.created_at)));

      const statusTd = el('td');
      statusTd.appendChild(el('span', 'admin-badge' + (!c.is_read ? ' is-pending' : ''), c.is_read ? 'read' : 'unread'));
      tr.appendChild(statusTd);

      const actionsTd = el('td');
      const toggle = el('button', null, c.is_read ? 'MARK UNREAD' : 'MARK READ');
      toggle.type = 'button';
      toggle.addEventListener('click', () => updateContactMessage(c.id, !c.is_read));
      actionsTd.appendChild(toggle);
      tr.appendChild(actionsTd);

      body.appendChild(tr);
    });
  }

  async function updateContactMessage(id, is_read) {
    try {
      await api(`/contact-messages/${id}`, { method: 'PUT', body: JSON.stringify({ is_read }) });
      loadContactMessages();
    } catch (err) { alert(err.message); }
  }

  /* ---------- FAQ management ---------- */
  let faqEditingId = null;
  let faqCache = [];

  const faqForm = $('#faqForm');
  const faqQuestion = $('#faqQuestion');
  const faqAnswer = $('#faqAnswer');
  const faqSubmitBtn = $('#faqSubmitBtn');
  const faqCancelBtn = $('#faqCancelBtn');
  const faqError = $('#faqError');
  const faqFormTitle = $('#faqFormTitle');
  const faqSavedNote = $('#faqSavedNote');

  function startEditFaq(f) {
    faqEditingId = f.id;
    faqQuestion.value = f.question;
    faqAnswer.value = f.answer;
    faqFormTitle.textContent = 'EDIT FAQ';
    faqSubmitBtn.textContent = 'SAVE CHANGES';
    faqCancelBtn.hidden = false;
    faqError.textContent = '';
    $('#faqLibrary').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function resetFaqForm() {
    faqEditingId = null;
    faqForm.reset();
    faqFormTitle.textContent = 'ADD FAQ';
    faqSubmitBtn.textContent = 'ADD';
    faqCancelBtn.hidden = true;
    faqError.textContent = '';
  }

  faqCancelBtn.addEventListener('click', resetFaqForm);

  faqForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const question = faqQuestion.value.trim();
    const answer = faqAnswer.value.trim();
    if (!question || !answer) { faqError.textContent = 'Question and answer are both required.'; return; }

    faqSubmitBtn.disabled = true;
    try {
      const url = faqEditingId ? `/faqs/${faqEditingId}` : '/faqs';
      await api(url, { method: faqEditingId ? 'PUT' : 'POST', body: JSON.stringify({ question, answer }) });

      resetFaqForm();
      loadFaqs();
      faqSavedNote.classList.add('is-on');
      setTimeout(() => faqSavedNote.classList.remove('is-on'), 1500);
    } catch (err) {
      faqError.textContent = err.message;
    } finally {
      faqSubmitBtn.disabled = false;
    }
  });

  async function moveFaq(index, direction) {
    const other = faqCache[index + direction];
    const current = faqCache[index];
    if (!other) return;
    try {
      await api(`/faqs/${current.id}`, { method: 'PUT', body: JSON.stringify({ sort_order: other.sort_order }) });
      await api(`/faqs/${other.id}`, { method: 'PUT', body: JSON.stringify({ sort_order: current.sort_order }) });
      loadFaqs();
    } catch (err) { alert(err.message); }
  }

  async function deleteFaq(f) {
    if (!confirm(`Delete "${f.question}"?`)) return;
    try {
      await api(`/faqs/${f.id}`, { method: 'DELETE' });
      loadFaqs();
    } catch (err) { alert(err.message); }
  }

  async function loadFaqs() {
    const body = $('#faqBody');
    body.textContent = '';
    try {
      ({ faqs: faqCache } = await api('/faqs'));
    } catch (err) {
      body.appendChild(el('tr')).appendChild(el('td', 'is-muted', 'Could not load FAQs: ' + err.message));
      return;
    }

    if (!faqCache.length) {
      const tr = el('tr');
      tr.appendChild(el('td', 'is-muted', 'No FAQs yet.'));
      body.appendChild(tr);
      return;
    }

    faqCache.forEach((f, i) => {
      const tr = el('tr');
      tr.appendChild(el('td', null, f.question));
      tr.appendChild(el('td', 'is-muted', f.answer.length > 140 ? f.answer.slice(0, 140) + '…' : f.answer));

      const actionsTd = el('td');
      const actions = el('div', 'admin-actions');

      const up = el('button', null, '↑');
      up.type = 'button';
      up.disabled = i === 0;
      up.addEventListener('click', () => moveFaq(i, -1));
      actions.appendChild(up);

      const down = el('button', null, '↓');
      down.type = 'button';
      down.disabled = i === faqCache.length - 1;
      down.addEventListener('click', () => moveFaq(i, 1));
      actions.appendChild(down);

      const edit = el('button', null, 'EDIT');
      edit.type = 'button';
      edit.addEventListener('click', () => startEditFaq(f));
      actions.appendChild(edit);

      const del = el('button', 'is-danger', 'DELETE');
      del.type = 'button';
      del.addEventListener('click', () => deleteFaq(f));
      actions.appendChild(del);

      actionsTd.appendChild(actions);
      tr.appendChild(actionsTd);
      body.appendChild(tr);
    });
  }

  /* ---------- audit log ---------- */
  async function loadAuditLog() {
    const list = $('#auditLog');
    list.textContent = '';
    let audit_log;
    try {
      ({ audit_log } = await api('/audit-log'));
    } catch (err) {
      list.appendChild(el('li', null, 'Could not load the audit log: ' + err.message));
      return;
    }

    if (!audit_log.length) {
      list.appendChild(el('li', null, 'No admin actions recorded yet.'));
      return;
    }

    audit_log.slice(0, 30).forEach((a) => {
      const li = el('li');
      const left = el('span');
      left.appendChild(el('span', 'admin-log-who', a.action.replace(/_/g, ' ')));
      left.append(a.details ? ` — ${a.details}` : ` (${a.target_type})`);
      li.appendChild(left);
      const time = document.createElement('time');
      time.textContent = timeAgo(a.created_at);
      li.appendChild(time);
      list.appendChild(li);
    });
  }

  /* ---------- content library: create/edit form ---------- */
  let editingId = null;

  const cForm = $('#contentForm');
  const cTitle = $('#cTitle');
  const cType = $('#cType');
  const cBody = $('#cBody');
  const cMediaUrl = $('#cMediaUrl');
  const cUploadField = $('#cUploadField');
  const cFile = $('#cFile');
  const cUploadBtn = $('#cUploadBtn');
  const cUploadStatus = $('#cUploadStatus');
  const cSubmitBtn = $('#cSubmitBtn');
  const cCancelBtn = $('#cCancelBtn');
  const cError = $('#cError');
  const cFormTitle = $('#contentFormTitle');

  function syncUploadFieldVisibility() {
    cUploadField.hidden = cType.value !== 'music';
  }
  cType.addEventListener('change', syncUploadFieldVisibility);
  syncUploadFieldVisibility();

  cUploadBtn.addEventListener('click', async () => {
    const file = cFile.files[0];
    if (!file) { cUploadStatus.textContent = 'Choose a file first.'; return; }

    cUploadStatus.textContent = 'Uploading…';
    cUploadBtn.disabled = true;
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload/music', { method: 'POST', headers: authHeaders(), body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      cMediaUrl.value = data.url;
      cUploadStatus.textContent = 'Uploaded — media URL filled in below.';
    } catch (err) {
      cUploadStatus.textContent = err.message;
    } finally {
      cUploadBtn.disabled = false;
    }
  });

  function startEditContent(c) {
    editingId = c.id;
    cTitle.value = c.title;
    cType.value = c.type;
    cBody.value = c.body || '';
    cMediaUrl.value = c.media_url || '';
    syncUploadFieldVisibility();
    cFormTitle.textContent = 'EDIT: ' + c.title;
    cSubmitBtn.textContent = 'SAVE CHANGES';
    cCancelBtn.hidden = false;
    cError.textContent = '';
    $('#contentLibrary').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function resetContentForm() {
    editingId = null;
    cForm.reset();
    syncUploadFieldVisibility();
    cFormTitle.textContent = 'ADD BOOK, MUSIC OR RESOURCE';
    cSubmitBtn.textContent = 'PUBLISH';
    cCancelBtn.hidden = true;
    cUploadStatus.textContent = '';
    cError.textContent = '';
  }

  cCancelBtn.addEventListener('click', resetContentForm);

  cForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = cTitle.value.trim();
    if (!title) { cError.textContent = 'Title is required.'; return; }

    const payload = {
      title,
      type: cType.value,
      body: cBody.value.trim() || null,
      media_url: cMediaUrl.value.trim() || null
    };

    cSubmitBtn.disabled = true;
    try {
      const url = editingId ? `/api/content/${editingId}` : '/api/content';
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save content');

      resetContentForm();
      loadContent();
      loadAnalytics();
    } catch (err) {
      cError.textContent = err.message;
    } finally {
      cSubmitBtn.disabled = false;
    }
  });

  /* ---------- boot ---------- */
  loadAnalytics();
  loadUsers();
  loadContent();
  loadReports();
  loadContactMessages();
  loadFaqs();
  loadAuditLog();
})();
