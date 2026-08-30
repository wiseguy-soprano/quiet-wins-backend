/* ============================================================
   SESSION — signed-in state for the whole site

   Backed by the real Quiet Wins API now. The JWT and a cached copy of
   the profile live in localStorage so the header can paint instantly
   without a network round trip; PUS.refresh() re-fetches the
   authoritative profile from the server and clears the session if the
   token has expired, been revoked (logout elsewhere), or the account
   was deactivated.
   ============================================================ */
(() => {
  'use strict';

  const USER_KEY = 'pus.user';   // cached profile, for instant header paint
  const TOKEN_KEY = 'pus.token'; // the JWT

  const PAGES = ['index.html', 'books.html', 'music.html', 'community.html', 'contact.html'];

  const PUS = {
    /* ---------- session ---------- */
    get() {
      try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); }
      catch (_) { return null; }
    },

    token() {
      try { return localStorage.getItem(TOKEN_KEY); }
      catch (_) { return null; }
    },

    // maps the API's user shape (avatar_hue) onto the frontend's (hue)
    save(apiUser, token) {
      const user = { ...apiUser, hue: apiUser.avatar_hue ?? apiUser.hue ?? null };
      delete user.avatar_hue;
      try {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        if (token) localStorage.setItem(TOKEN_KEY, token);
      } catch (_) {}
      document.documentElement.classList.add('is-authed');
      PUS.paint();
      return user;
    },

    signOut() {
      const token = PUS.token();
      try {
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(TOKEN_KEY);
      } catch (_) {}
      document.documentElement.classList.remove('is-authed');
      if (token) {
        fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + token } }).catch(() => {});
      }
    },

    // re-fetches the authoritative profile; signs out locally if the token
    // is no longer valid. Falls back to the cache if the request fails
    // outright (offline), rather than signing the user out unnecessarily.
    async refresh() {
      const token = PUS.token();
      if (!token) return null;
      try {
        const res = await fetch('/api/users/me', { headers: { Authorization: 'Bearer ' + token } });
        if (res.status === 401 || res.status === 403) { PUS.signOut(); return null; }
        if (!res.ok) return PUS.get();
        const data = await res.json();
        return PUS.save(data.user, token);
      } catch (_) {
        return PUS.get();
      }
    },

    /* ---------- display helpers (shared with the community feed) ---------- */
    initials(name) {
      const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
      if (!parts.length) return '?';
      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    },

    // stable warm hue per name, matching the avatars in the Reading Room
    hue(name) {
      let h = 0;
      const s = String(name || '');
      for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
      return 20 + (h % 45);
    },

    hueOf(user) {
      return user && user.hue != null ? user.hue : PUS.hue(user && user.name);
    },

    nameFromEmail(email) {
      const local = String(email || '').split('@')[0] || 'Reader';
      return local
        .split(/[._\-+]+/)
        .filter(Boolean)
        .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
        .join(' ') || 'Reader';
    },

    /* ---------- paint the signed-in chrome ---------- */
    paint() {
      const u = PUS.get();
      document.documentElement.classList.toggle('is-authed', !!u);
      document.documentElement.classList.toggle('is-admin', !!u && u.role === 'admin');
      if (!u) return;

      const hue = PUS.hueOf(u);
      document.querySelectorAll('[data-name]').forEach((el) => { el.textContent = u.name; });
      document.querySelectorAll('[data-email]').forEach((el) => { el.textContent = u.email; });
      document.querySelectorAll('[data-avatar]').forEach((el) => {
        el.textContent = PUS.initials(u.name);
        el.style.setProperty('--hue', hue);
      });
    },

    /* Where a successful sign-in should land. The gate on the community page
       sends people here with ?next=community.html; anything not on the
       allow-list falls back to home rather than being followed blindly. */
    next(fallback = 'index.html') {
      const asked = new URLSearchParams(location.search).get('next');
      return PAGES.includes(asked) ? asked : fallback;
    },

    /* ---------- route guards ---------- */
    // signin / signup: nothing to do here once you already have a session
    requireGuest(to = 'index.html') {
      if (PUS.get()) { location.replace(to); return false; }
      return true;
    },
    // account: no session, no settings page
    requireUser(to = 'signin.html') {
      if (!PUS.get()) { location.replace(to); return false; }
      return true;
    },
    // admin pages: no session or not an admin, no entry
    requireAdmin(to = 'index.html') {
      const u = PUS.get();
      if (!u || u.role !== 'admin') { location.replace(to); return false; }
      return true;
    }
  };

  window.PUS = PUS;

  /* ---------- where settings should send you back to ----------
     Every "Profile settings" link is stamped with the page it was clicked
     from, so the back link on account.html returns you to where you were
     rather than always dumping you on the home page. */
  function here() {
    return location.pathname.split('/').pop() || 'index.html';
  }

  function decorateAccountLinks() {
    const from = here();
    if (!PAGES.includes(from)) return;   // signin / signup / account are not places to return to
    document.querySelectorAll('a[href="account.html"]').forEach((a) => {
      a.href = 'account.html?from=' + encodeURIComponent(from);
    });
  }

  PUS.pages = PAGES;

  /* ---------- account menu ---------- */
  function wireMenu() {
    const btn = document.getElementById('accountBtn');
    const pop = document.getElementById('accountPop');
    if (!btn || !pop) return;

    const close = () => {
      pop.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    };

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = pop.hidden;
      pop.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
    });

    document.addEventListener('click', (e) => {
      if (!pop.hidden && !pop.contains(e.target) && e.target !== btn) close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !pop.hidden) { close(); btn.focus(); }
    });
  }

  /* ---------- mobile menu ----------
     Lives here rather than in eight copies of an inline snippet, so the button
     state, the label and aria-expanded can never drift apart from the nav. */
  function wireMobileMenu() {
    const btn = document.getElementById('menuBtn');
    const nav = document.getElementById('mobileNav');
    if (!btn || !nav) return;

    const set = (open) => {
      nav.classList.toggle('open', open);
      btn.classList.toggle('is-open', open);       // the bars fold into a cross
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    };

    btn.addEventListener('click', () => set(!nav.classList.contains('open')));

    // an open menu should also answer to Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && nav.classList.contains('open')) { set(false); btn.focus(); }
    });
  }

  function wireSignOut() {
    document.querySelectorAll('[data-signout]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        PUS.signOut();
        location.href = 'index.html';
      });
    });
  }

  // shows a dot on the inbox icon (if present on this page) when there's an
  // unread message; best-effort, never blocks or breaks the page
  function paintInboxBadge() {
    const link = document.getElementById('inboxLink');
    const token = PUS.token();
    if (!link || !token) return;

    fetch('/api/messages/conversations', { headers: { Authorization: 'Bearer ' + token } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        const me = PUS.get();
        const hasUnread = data.conversations.some((c) => !c.is_read && c.recipient_id === (me && me.id));
        link.classList.toggle('has-unread', hasUnread);
      })
      .catch(() => {});
  }

  // best-effort analytics ping; never blocks or breaks the page
  function logPageView() {
    const path = location.pathname === '/' ? '/' : (location.pathname.split('/').pop() || 'index.html');
    const token = PUS.token();
    fetch('/api/analytics/pageview', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {})
      },
      body: JSON.stringify({ path })
    }).catch(() => {});
  }

  PUS.paint();
  decorateAccountLinks();
  wireMenu();
  wireMobileMenu();
  wireSignOut();
  logPageView();
  paintInboxBadge();

  // signing out in one tab should not leave another tab looking signed in
  window.addEventListener('storage', (e) => {
    if (e.key === USER_KEY) location.reload();
  });

  // quietly re-sync with the server in the background so an expired/revoked
  // session (or a role/profile change made elsewhere) is caught quickly
  if (PUS.get()) PUS.refresh();
})();
