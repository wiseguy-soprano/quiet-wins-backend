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
    const s = Math.max(0, (Date.now() - new Date(ts).getTime()) / 1000);
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60);
    if (m < 60) return m + 'm ago';
    const h = Math.floor(m / 60);
    if (h < 24) return h + 'h ago';
    const d = Math.floor(h / 24);
    if (d < 30) return d + 'd ago';
    return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
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
      actionsTd.appendChild(del);
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

  /* ---------- boot ---------- */
  loadAnalytics();
  loadUsers();
  loadContent();
  loadReports();
  loadAuditLog();
})();
