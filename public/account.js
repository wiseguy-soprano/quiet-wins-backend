/* ============================================================
   PROFILE SETTINGS

   Reads and writes the real profile via the API. Notification
   preferences are not backed by any real notification pipeline yet,
   so they're kept local-only, in their own storage key (never on the
   PUS user cache, which gets fully replaced by the server on every
   refresh — anything not part of the API response would be wiped).
   ============================================================ */
(() => {
  'use strict';

  if (!window.PUS || !PUS.requireUser()) return;   // no session, no settings page

  const PREFS_KEY = 'pus.prefs';
  const MAX_BIO = 140;
  // a warm spread across the site's gold range, plus a couple of cooler embers
  const HUES = [20, 28, 36, 44, 52, 12, 4, 340];

  const $ = (s) => document.querySelector(s);

  function authHeaders() {
    return { Authorization: 'Bearer ' + PUS.token() };
  }

  /* ---------- back link ----------
     auth.js stamps every settings link with the page it came from. Anything
     not on the allow-list (a stale bookmark, a redirect from signin) falls
     back to home rather than being trusted as a destination. */
  const BACK = {
    'index.html': 'Back to home',
    'books.html': 'Back to books',
    'music.html': 'Back to music',
    'community.html': 'Back to the Reading Room',
    'contact.html': 'Back to contact'
  };

  function resolveBack() {
    const asked = new URLSearchParams(location.search).get('from');
    if (asked && BACK[asked]) return asked;
    try {
      const ref = document.referrer && new URL(document.referrer);
      if (ref && ref.origin === location.origin) {
        const file = ref.pathname.split('/').pop() || 'index.html';
        if (BACK[file]) return file;
      }
    } catch (_) {}
    return 'index.html';
  }

  const backTo = resolveBack();
  $('#accountBack').href = backTo;
  $('#accountBackLabel').textContent = BACK[backTo];

  let user = PUS.get();
  let hue = PUS.hueOf(user);

  const nameEl = $('#displayName');
  const emailEl = $('#email');
  const bioEl = $('#bio');
  const avatarEl = $('#avatarPreview');
  const previewName = $('#previewName');
  const previewEmail = $('#previewEmail');
  const errorEl = $('#profileError');

  /* ---------- local-only notification prefs ---------- */
  function readPrefs() {
    try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); }
    catch (_) { return {}; }
  }
  function writePrefs(prefs) {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (_) {}
  }

  /* ---------- live preview ---------- */
  function paintPreview() {
    const shown = nameEl.value.trim() || user.name;
    avatarEl.textContent = PUS.initials(shown);
    avatarEl.style.setProperty('--hue', hue);
    previewName.textContent = shown;
    previewEmail.textContent = user.email;
  }

  function paintSwatches() {
    const wrap = $('#swatches');
    wrap.textContent = '';
    HUES.forEach((h) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'account-swatch' + (h === hue ? ' is-on' : '');
      b.style.setProperty('--hue', h);
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(h === hue));
      b.setAttribute('aria-label', 'Accent colour ' + h);
      b.addEventListener('click', () => {
        hue = h;
        paintSwatches();
        paintPreview();
      });
      wrap.appendChild(b);
    });
  }

  function syncBioCount() {
    $('#bioCount').textContent = Math.max(0, MAX_BIO - bioEl.value.length);
  }

  function flash(el) {
    el.classList.add('is-on');
    setTimeout(() => el.classList.remove('is-on'), 2400);
  }

  /* ---------- your room ----------
     "Posts" = community content you authored; "replies" = comments you
     authored, anywhere in the Reading Room (not just on your own posts). */
  async function fetchMyRoomActivity() {
    const res = await fetch('/api/content?type=community');
    if (!res.ok) return { posts: [], commentsByPost: {} };
    const { content } = await res.json();

    const commentLists = await Promise.all(
      content.map((p) => fetch('/api/comments/' + p.id).then((r) => (r.ok ? r.json() : { comments: [] })))
    );

    const commentsByPost = {};
    content.forEach((p, i) => { commentsByPost[p.id] = commentLists[i].comments || []; });

    return { posts: content, commentsByPost };
  }

  async function paintRoomStats() {
    const { posts, commentsByPost } = await fetchMyRoomActivity();
    const myPosts = posts.filter((p) => p.user_id === user.id);
    const myComments = Object.values(commentsByPost).flat().filter((c) => c.user_id === user.id);

    $('#myPosts').textContent = myPosts.length;
    $('#myReplies').textContent = myComments.length;
    $('#clearRoom').disabled = myPosts.length === 0 && myComments.length === 0;
    $('#clearRoom').style.opacity = $('#clearRoom').disabled ? '.45' : '';

    return { myPosts, myComments };
  }

  /* ---------- boot ---------- */
  async function boot() {
    const fresh = await PUS.refresh();
    if (!fresh) { location.replace('signin.html'); return; }
    user = fresh;
    hue = PUS.hueOf(user);

    nameEl.value = user.name;
    emailEl.value = user.email;
    bioEl.value = user.bio || '';

    const prefs = readPrefs();
    $('#prefReleases').checked = prefs.releases !== false;   // default on
    $('#prefReplies').checked = prefs.replies !== false;

    paintSwatches();
    paintPreview();
    syncBioCount();
    paintRoomStats();
  }
  boot();

  nameEl.addEventListener('input', () => { paintPreview(); errorEl.textContent = ''; });
  bioEl.addEventListener('input', syncBioCount);

  /* ---------- save ---------- */
  $('#profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = nameEl.value.trim();

    if (!name) { errorEl.textContent = 'Please enter a display name.'; nameEl.focus(); return; }

    try {
      const res = await fetch('/api/users/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ name, bio: bioEl.value.trim(), avatar_hue: hue })
      });
      const data = await res.json();

      if (!res.ok) {
        errorEl.textContent = data.error || 'Something went wrong. Please try again.';
        return;
      }

      user = PUS.save(data.user, PUS.token());
      errorEl.textContent = '';
      flash($('#savedNote'));
      paintPreview();
    } catch (_) {
      errorEl.textContent = 'Could not reach the server. Please check your connection and try again.';
    }
  });

  /* preferences save on the spot — a checkbox with a Save button underneath
     it is a small lie about when the change takes effect. Local-only:
     there's no real notification pipeline behind these yet. */
  ['#prefReleases', '#prefReplies'].forEach((sel) => {
    $(sel).addEventListener('change', () => {
      writePrefs({
        releases: $('#prefReleases').checked,
        replies: $('#prefReplies').checked
      });
      flash($('#savedNote'));
    });
  });

  /* ---------- clear my contributions ---------- */
  $('#clearRoom').addEventListener('click', async () => {
    if (!confirm('Delete every post and reply you have written in the Reading Room? This cannot be undone.')) return;

    const { myPosts, myComments } = await paintRoomStats();
    // deleting a post cascades to its own comments server-side, so only
    // delete comments that are on someone else's post here
    const myPostIds = new Set(myPosts.map((p) => p.id));
    const strayComments = myComments.filter((c) => !myPostIds.has(c.content_id));

    await Promise.all([
      ...myPosts.map((p) => fetch('/api/content/' + p.id, { method: 'DELETE', headers: authHeaders() })),
      ...strayComments.map((c) => fetch('/api/comments/' + c.id, { method: 'DELETE', headers: authHeaders() }))
    ]);

    paintRoomStats();
    flash($('#clearedNote'));
  });
})();
