/* ============================================================
   COMMUNITY — "The Reading Room"

   Posts, likes and replies are real content now: community posts are
   content rows (type "community"), replies are comments, likes use
   the likes API. Author names/colours come from a relational embed
   on the content and comments endpoints. Everything a visitor types
   is put on the page with textContent, never innerHTML, so a post
   containing markup is shown as characters rather than executed.
   ============================================================ */
(() => {
  'use strict';

  const MAX_POST = 600;
  const MAX_COMMENT = 300;
  const TOPICS = ['GENERAL', 'BOOKS', 'MUSIC', 'FILM'];
  const GUEST_PREVIEW = 2;   // how many posts a visitor may read before signing in

  /* ---------- state ---------- */
  let posts = [];
  let me = '';
  let filter = 'ALL';
  let draftTopic = 'GENERAL';
  const openThreads = new Set();

  const $ = (sel) => document.querySelector(sel);
  const feedEl = $('#feed');
  const emptyEl = $('#feedEmpty');
  const formEl = $('#postForm');
  const bodyEl = $('#postBody');
  const countEl = $('#postCount');
  const errorEl = $('#postError');
  const nameEl = $('#nameInput');
  const composerAvatar = $('#composerAvatar');

  function authHeaders() {
    const token = window.PUS && PUS.token();
    return token ? { Authorization: 'Bearer ' + token } : {};
  }

  /* ---------- load from the API ---------- */
  async function load() {
    const res = await fetch('/api/content?type=community');
    if (!res.ok) return [];
    const { content } = await res.json();

    const [commentLists, likeInfo] = await Promise.all([
      Promise.all(content.map((c) => fetch('/api/comments/' + c.id).then((r) => (r.ok ? r.json() : { comments: [] })))),
      Promise.all(content.map((c) => fetch('/api/likes/' + c.id, { headers: authHeaders() }).then((r) => (r.ok ? r.json() : { count: 0, liked: false }))))
    ]);

    const myId = account() && account().id;

    return content.map((c, i) => ({
      id: c.id,
      userId: c.user_id,
      name: (c.author && c.author.name) || 'Reader',
      hue: c.author && c.author.avatar_hue != null ? c.author.avatar_hue : hueOf((c.author && c.author.name) || 'Reader'),
      topic: c.topic || 'GENERAL',
      body: c.body || '',
      createdAt: new Date(c.created_at).getTime(),
      likes: likeInfo[i].count,
      likedByMe: likeInfo[i].liked,
      mine: myId === c.user_id,
      comments: (commentLists[i].comments || []).map((cm) => ({
        id: cm.id,
        userId: cm.user_id,
        name: (cm.author && cm.author.name) || 'Reader',
        hue: cm.author && cm.author.avatar_hue != null ? cm.author.avatar_hue : hueOf((cm.author && cm.author.name) || 'Reader'),
        text: cm.body,
        createdAt: new Date(cm.created_at).getTime(),
        mine: myId === cm.user_id
      }))
    }));
  }

  /* ---------- helpers ---------- */
  // stable hue per name, so the same voice keeps the same mark down the feed
  // (used as a fallback when a post's author has no avatar_hue set)
  function hueOf(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
    // keep it inside the site's warm range rather than letting it go green
    return 20 + (h % 45);
  }

  function initials(name) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function timeAgo(ts) {
    const s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60);
    if (m < 60) return m + 'm ago';
    const h = Math.floor(m / 60);
    if (h < 24) return h + 'h ago';
    const d = Math.floor(h / 24);
    if (d < 7) return d + 'd ago';
    return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;   // user content never touches innerHTML
    return n;
  }

  function avatarFor(hue, name, small) {
    const a = el('span', 'c-avatar' + (small ? ' c-avatar--sm' : ''), initials(name));
    a.style.setProperty('--hue', hue);
    a.setAttribute('aria-hidden', 'true');
    return a;
  }

  function icon(paths, opts = {}) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', opts.size || 14);
    svg.setAttribute('height', opts.size || 14);
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', opts.fill || 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', opts.width || 1.6);
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    paths.forEach((d) => {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', d);
      svg.appendChild(p);
    });
    return svg;
  }

  // a sun, not a heart — the like is "this lit something up"
  const SUN = ['M12 7.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9z', 'M12 1.8v2.4M12 19.8v2.4M4.6 4.6l1.7 1.7M17.7 17.7l1.7 1.7M1.8 12h2.4M19.8 12h2.4M4.6 19.4l1.7-1.7M17.7 6.3l1.7-1.7'];
  const SPEECH = ['M20 14.5a2.5 2.5 0 01-2.5 2.5H8l-4 3.5V5.5A2.5 2.5 0 016.5 3h11A2.5 2.5 0 0120 5.5z'];
  const TRASH = ['M4 6h16M9 6V4.5A1.5 1.5 0 0110.5 3h3A1.5 1.5 0 0115 4.5V6M6.5 6l.8 13a1.5 1.5 0 001.5 1.4h6.4a1.5 1.5 0 001.5-1.4l.8-13'];

  // signed in, the account owns the name; signed out, the field does
  function account() {
    return window.PUS ? window.PUS.get() : null;
  }

  function currentName() {
    const u = account();
    if (u) return u.name;
    const v = (nameEl.value || '').trim();
    return v || 'Guest reader';
  }

  /* ---------- render ---------- */
  function render() {
    feedEl.textContent = '';
    const signedIn = !!account();

    const newest = posts.slice().sort((a, b) => b.createdAt - a.createdAt);
    const matching = (list) => list.filter((p) => filter === 'ALL' || p.topic === filter);

    /* The allowance is counted over the whole room, not the current filter —
       otherwise a visitor reads everything by stepping through the topic tabs
       one post at a time. */
    const readable = signedIn ? newest : newest.slice(0, GUEST_PREVIEW);
    const shown = matching(readable);
    const held = matching(newest).length - shown.length;

    // an empty state only when the room really has nothing here; if posts are
    // merely being withheld, the gate is the honest thing to show
    emptyEl.classList.toggle('is-on', matching(newest).length === 0);
    shown.forEach((p, i) => {
      const node = postNode(p, signedIn);
      // the last preview card trails off, so the cut reads as deliberate
      if (held > 0 && i === shown.length - 1) node.classList.add('is-cut');
      feedEl.appendChild(node);
    });

    renderGate(held);
    renderStats();
    renderTopics();
  }

  function renderGate(held) {
    const gate = $('#feedGate');
    if (!gate) return;
    gate.hidden = held <= 0;
    if (held > 0) {
      $('#gateCount').textContent = held;
      $('#gateNoun').textContent = held === 1 ? 'more post' : 'more posts';
    }
  }

  function postNode(p, signedIn) {
    const card = el('article', 'c-post');
    card.dataset.id = p.id;

    /* head */
    const head = el('div', 'c-post-head');
    head.appendChild(avatarFor(p.hue, p.name));
    const who = el('div', 'c-post-who');
    who.appendChild(el('span', 'c-post-name', p.name));
    const meta = el('span', 'c-post-meta');
    meta.appendChild(el('span', 'c-tag', p.topic));
    meta.appendChild(document.createTextNode('  ·  ' + timeAgo(p.createdAt)));
    who.appendChild(meta);
    head.appendChild(who);
    card.appendChild(head);

    /* body */
    card.appendChild(el('p', 'c-post-body', p.body));

    /* action bar — a visitor sees the tally but cannot act on it */
    const bar = el('div', 'c-post-bar');

    if (!signedIn) {
      const counts = el('div', 'c-counts');
      counts.appendChild(icon(SUN, { size: 14 }));
      counts.append(' ' + p.likes + (p.likes === 1 ? ' light' : ' lights'));
      counts.appendChild(icon(SPEECH, { size: 14 }));
      counts.append(' ' + p.comments.length + (p.comments.length === 1 ? ' reply' : ' replies'));
      bar.appendChild(counts);
      card.appendChild(bar);
      return card;
    }

    const like = el('button', 'c-act c-act--like' + (p.likedByMe ? ' is-on' : ''));
    like.type = 'button';
    like.dataset.act = 'like';
    like.setAttribute('aria-pressed', String(!!p.likedByMe));
    like.appendChild(icon(SUN, { size: 15 }));
    like.appendChild(el('span', 'c-n', String(p.likes)));
    like.append(p.likes === 1 ? ' LIGHT' : ' LIGHTS');
    bar.appendChild(like);

    const reply = el('button', 'c-act');
    reply.type = 'button';
    reply.dataset.act = 'toggle';
    reply.setAttribute('aria-expanded', String(openThreads.has(p.id)));
    reply.appendChild(icon(SPEECH, { size: 15 }));
    reply.appendChild(el('span', 'c-n', String(p.comments.length)));
    reply.append(p.comments.length === 1 ? ' REPLY' : ' REPLIES');
    bar.appendChild(reply);

    if (p.mine) {
      const del = el('button', 'c-act c-act--del');
      del.type = 'button';
      del.dataset.act = 'delete';
      del.appendChild(icon(TRASH, { size: 14 }));
      del.append(' DELETE');
      bar.appendChild(del);
    }
    card.appendChild(bar);

    /* thread */
    const thread = el('div', 'c-thread' + (openThreads.has(p.id) ? ' is-open' : ''));
    p.comments.forEach((c) => thread.appendChild(commentNode(c)));

    const cf = el('form', 'c-comment-form');
    cf.dataset.act = 'comment';
    const input = el('input');
    input.type = 'text';
    input.maxLength = MAX_COMMENT;
    input.placeholder = 'Write a reply…';
    input.setAttribute('aria-label', 'Write a reply');
    const send = el('button', null, 'REPLY');
    send.type = 'submit';
    cf.appendChild(input);
    cf.appendChild(send);
    thread.appendChild(cf);

    card.appendChild(thread);
    return card;
  }

  function commentNode(c) {
    const row = el('div', 'c-comment');
    row.appendChild(avatarFor(c.hue, c.name, true));
    const body = el('div', 'c-comment-body');
    const nm = el('div', 'c-comment-name', c.name);
    nm.appendChild(el('span', null, timeAgo(c.createdAt)));
    body.appendChild(nm);
    body.appendChild(el('p', 'c-comment-text', c.text));
    row.appendChild(body);
    return row;
  }

  function renderStats() {
    const replies = posts.reduce((n, p) => n + p.comments.length, 0);
    const voices = new Set();
    posts.forEach((p) => {
      voices.add(p.name);
      p.comments.forEach((c) => voices.add(c.name));
    });
    $('#statPosts').textContent = posts.length;
    $('#statVoices').textContent = voices.size;
    $('#statReplies').textContent = replies;
  }

  function renderTopics() {
    const list = $('#topicList');
    list.textContent = '';
    TOPICS
      .map((t) => ({ t, n: posts.filter((p) => p.topic === t).length }))
      .sort((a, b) => b.n - a.n)
      .forEach(({ t, n }) => {
        const li = el('li', null, t);
        li.appendChild(el('b', null, String(n)));
        list.appendChild(li);
      });
  }

  /* ---------- composer ---------- */
  function syncCount() {
    const left = MAX_POST - bodyEl.value.length;
    countEl.textContent = left;
    countEl.classList.toggle('is-low', left <= 80 && left >= 0);
    countEl.classList.toggle('is-over', left < 0);
  }

  function syncMe() {
    me = currentName();
    const u = account();
    composerAvatar.textContent = initials(me);
    // an account can pick its own accent; a guest gets the hash of their name
    composerAvatar.style.setProperty('--hue', u && u.hue != null ? u.hue : hueOf(me));
  }

  bodyEl.addEventListener('input', () => {
    syncCount();
    errorEl.textContent = '';
  });

  const NAME_KEY = 'pus.community.name';
  nameEl.addEventListener('input', syncMe);
  nameEl.addEventListener('change', () => {
    try { localStorage.setItem(NAME_KEY, currentName()); } catch (_) {}
  });

  document.querySelectorAll('.c-topic').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.c-topic').forEach((b) => b.classList.remove('is-on'));
      btn.classList.add('is-on');
      draftTopic = btn.dataset.topic;
    });
  });

  document.querySelectorAll('.c-filter').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.c-filter').forEach((b) => {
        b.classList.remove('is-on');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('is-on');
      btn.setAttribute('aria-selected', 'true');
      filter = btn.dataset.filter;
      render();
    });
  });

  formEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = account();
    if (!u) return;   // the composer is hidden for guests; this is the backstop
    const text = bodyEl.value.trim();
    if (!text) {
      errorEl.textContent = 'Say something first — even one line.';
      bodyEl.focus();
      return;
    }
    if (text.length > MAX_POST) {
      errorEl.textContent = `That is ${text.length - MAX_POST} characters over.`;
      return;
    }

    syncMe();

    const submitBtn = formEl.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      const res = await fetch('/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          title: text.length > 60 ? text.slice(0, 57) + '…' : text,
          type: 'community',
          topic: draftTopic,
          body: text
        })
      });
      const data = await res.json();

      if (!res.ok) {
        errorEl.textContent = data.error || 'Something went wrong. Please try again.';
        return;
      }

      posts.unshift({
        id: data.content.id, userId: u.id, name: u.name, hue: PUS.hueOf(u),
        topic: draftTopic, body: text, createdAt: Date.now(),
        likes: 0, likedByMe: false, mine: true, comments: []
      });

      bodyEl.value = '';
      errorEl.textContent = '';
      syncCount();

      // a new post in a filtered view would vanish on submit, so follow it
      if (filter !== 'ALL' && filter !== draftTopic) {
        const tab = document.querySelector('.c-filter[data-filter="ALL"]');
        if (tab) tab.click(); else render();
      } else {
        render();
      }
      feedEl.firstElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (_) {
      errorEl.textContent = 'Could not reach the server. Please check your connection and try again.';
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  /* ---------- feed interactions (delegated) ---------- */
  feedEl.addEventListener('click', async (e) => {
    if (!account()) return;
    const btn = e.target.closest('[data-act]');
    if (!btn || btn.tagName === 'FORM') return;
    const card = btn.closest('.c-post');
    const post = posts.find((p) => p.id === card.dataset.id);
    if (!post) return;

    if (btn.dataset.act === 'like') {
      // optimistic: the toggle endpoint doesn't return a count, so the tally
      // is adjusted locally, matching what the server just did
      const wasLiked = post.likedByMe;
      post.likedByMe = !wasLiked;
      post.likes += post.likedByMe ? 1 : -1;
      if (post.likes < 0) post.likes = 0;
      render();

      const res = await fetch('/api/likes/' + post.id, { method: 'POST', headers: authHeaders() });
      if (!res.ok) {
        // revert on failure
        post.likedByMe = wasLiked;
        post.likes += wasLiked ? 1 : -1;
        render();
      }
    }

    if (btn.dataset.act === 'toggle') {
      if (openThreads.has(post.id)) openThreads.delete(post.id);
      else openThreads.add(post.id);
      render();
      if (openThreads.has(post.id)) {
        feedEl.querySelector(`.c-post[data-id="${CSS.escape(post.id)}"] .c-comment-form input`)?.focus();
      }
    }

    if (btn.dataset.act === 'delete') {
      const res = await fetch('/api/content/' + post.id, { method: 'DELETE', headers: authHeaders() });
      if (res.ok) {
        posts = posts.filter((p) => p.id !== post.id);
        openThreads.delete(post.id);
        render();
      }
    }
  });

  feedEl.addEventListener('submit', async (e) => {
    const form = e.target.closest('[data-act="comment"]');
    if (!form) return;
    e.preventDefault();
    const u = account();
    if (!u) return;

    const card = form.closest('.c-post');
    const post = posts.find((p) => p.id === card.dataset.id);
    const input = form.querySelector('input');
    const text = input.value.trim();
    if (!post || !text) return;

    syncMe();
    input.disabled = true;

    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ content_id: post.id, body: text.slice(0, MAX_COMMENT) })
      });
      const data = await res.json();
      if (!res.ok) return;

      post.comments.push({
        id: data.comment.id, userId: u.id, name: u.name, hue: PUS.hueOf(u),
        text: text.slice(0, MAX_COMMENT), createdAt: Date.now(), mine: true
      });
      openThreads.add(post.id);
      input.value = '';
      render();
      feedEl.querySelector(`.c-post[data-id="${CSS.escape(post.id)}"] .c-comment-form input`)?.focus();
    } finally {
      input.disabled = false;
    }
  });

  /* ---------- boot ---------- */
  async function boot() {
    const acct = account();
    if (acct) {
      nameEl.value = acct.name;
      nameEl.readOnly = true;
      nameEl.tabIndex = -1;
      // `size` counts average glyph widths, so it clips wide names without slack
      nameEl.size = Math.max(4, acct.name.length + 2);
    } else {
      try { nameEl.value = localStorage.getItem(NAME_KEY) || ''; } catch (_) {}
    }
    syncMe();
    syncCount();

    posts = await load();
    render();
  }
  boot();

  // relative stamps go stale on a page left open
  setInterval(render, 60000);
})();
