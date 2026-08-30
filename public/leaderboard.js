/* ============================================================
   LEADERBOARD — GET /api/leaderboard (public)

   The leaderboard view doesn't carry avatar_hue (it predates that
   column), so every row falls back to the same deterministic
   name-hash colour used elsewhere on the site when a real hue isn't
   available — this is expected, not a bug.
   ============================================================ */
(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const list = $('#leaderboardList');
  const status = $('#leaderboardStatus');

  function hueOf(name) {
    let h = 0;
    const s = String(name || '');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
    return 20 + (h % 45);
  }

  function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function row(entry, myId) {
    const li = el('li', 'leaderboard-row' + (entry.user_id === myId ? ' is-me' : ''));

    li.appendChild(el('span', 'leaderboard-rank', '#' + entry.rank));

    const avatar = el('span', 'account-avatar', initials(entry.name));
    avatar.style.setProperty('--hue', hueOf(entry.name));
    avatar.setAttribute('aria-hidden', 'true');
    li.appendChild(avatar);

    const meta = el('div', 'leaderboard-meta');
    meta.appendChild(el('span', 'leaderboard-name', entry.name));
    const stats = el('span', 'leaderboard-stats');
    stats.textContent = `${entry.content_count} posts · ${entry.comment_count} replies · ${entry.likes_received} likes received`;
    meta.appendChild(stats);
    li.appendChild(meta);

    li.appendChild(el('span', 'leaderboard-points', String(entry.points)));

    return li;
  }

  async function load() {
    status.textContent = 'Loading…';
    try {
      const res = await fetch('/api/leaderboard?limit=50');
      const data = await res.json();
      if (!res.ok) { status.textContent = data.error || 'Something went wrong.'; return; }

      const myId = window.PUS && PUS.get() && PUS.get().id;
      list.textContent = '';
      data.leaderboard.forEach((entry) => list.appendChild(row(entry, myId)));
      status.textContent = data.leaderboard.length ? '' : 'No activity yet — be the first to post in the Reading Room.';
    } catch (_) {
      status.textContent = 'Could not reach the server. Please check your connection and try again.';
    }
  }

  load();
})();
