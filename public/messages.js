/* ============================================================
   MESSAGES — direct conversations via /api/messages

   Arriving as messages.html?with=<userId>&name=<encoded name> opens
   (or starts) a conversation with that person directly — this is how
   a "Message" link elsewhere on the site (e.g. on a Reading Room
   post) hands off into the inbox.
   ============================================================ */
(() => {
  'use strict';

  if (!window.PUS || !PUS.requireUser()) return;

  const $ = (s) => document.querySelector(s);
  const list = $('#conversationList');
  const status = $('#conversationsStatus');
  const threadEmpty = $('#threadEmpty');
  const threadView = $('#threadView');
  const threadAvatar = $('#threadAvatar');
  const threadName = $('#threadName');
  const threadMessages = $('#threadMessages');
  const threadForm = $('#threadForm');
  const threadInput = $('#threadInput');
  const threadError = $('#threadError');

  const me = PUS.get();
  let activeId = null;
  let activeName = '';

  function authHeaders() {
    return { Authorization: 'Bearer ' + PUS.token() };
  }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function hueOf(name) {
    let h = 0;
    const s = String(name || '');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
    return 20 + (h % 45);
  }

  function timeAgo(ts) {
    const s = Math.max(0, (Date.now() - new Date(ts).getTime()) / 1000);
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60);
    if (m < 60) return m + 'm ago';
    const h = Math.floor(m / 60);
    if (h < 24) return h + 'h ago';
    const d = Math.floor(h / 24);
    if (d < 7) return d + 'd ago';
    return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  }

  function otherPartyOf(msg) {
    const isMine = msg.sender_id === me.id;
    return {
      id: isMine ? msg.recipient_id : msg.sender_id,
      name: (isMine ? msg.recipient : msg.sender)?.name || 'Reader',
      hue: (isMine ? msg.recipient : msg.sender)?.avatar_hue
    };
  }

  /* ---------- conversation list ---------- */
  async function loadConversations() {
    status.textContent = 'Loading…';
    try {
      const res = await fetch('/api/messages/conversations', { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) { status.textContent = data.error || 'Something went wrong.'; return; }

      list.textContent = '';
      data.conversations.forEach((msg) => {
        const other = otherPartyOf(msg);
        const li = el('li', 'messages-list-item' + (other.id === activeId ? ' is-active' : ''));
        li.dataset.userId = other.id;
        li.dataset.name = other.name;

        const avatar = el('span', 'account-avatar', initials(other.name));
        avatar.style.setProperty('--hue', other.hue != null ? other.hue : hueOf(other.name));
        li.appendChild(avatar);

        const meta = el('div', 'messages-list-meta');
        const nameRow = el('div', 'messages-list-name-row');
        nameRow.appendChild(el('span', 'messages-list-name', other.name));
        if (!msg.is_read && msg.recipient_id === me.id) {
          nameRow.appendChild(el('span', 'messages-unread-dot'));
        }
        meta.appendChild(nameRow);
        meta.appendChild(el('p', 'messages-list-snippet', msg.body));
        li.appendChild(meta);

        li.appendChild(el('span', 'messages-list-time', timeAgo(msg.created_at)));

        li.addEventListener('click', () => openThread(other.id, other.name));
        list.appendChild(li);
      });

      status.textContent = data.conversations.length ? '' : 'No conversations yet.';
    } catch (_) {
      status.textContent = 'Could not reach the server. Please check your connection and try again.';
    }
  }

  /* ---------- thread ---------- */
  function messageBubble(msg) {
    const isMine = msg.sender_id === me.id;
    const row = el('div', 'messages-bubble-row' + (isMine ? ' is-mine' : ''));
    row.appendChild(el('p', 'messages-bubble', msg.body));
    return row;
  }

  async function openThread(userId, name) {
    activeId = userId;
    activeName = name;

    document.querySelectorAll('.messages-list-item').forEach((li) => {
      li.classList.toggle('is-active', li.dataset.userId === userId);
    });

    threadEmpty.hidden = true;
    threadView.hidden = false;
    threadName.textContent = name;
    threadAvatar.textContent = initials(name);
    threadAvatar.style.setProperty('--hue', hueOf(name));
    threadMessages.textContent = 'Loading…';

    try {
      const res = await fetch('/api/messages/' + userId, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) { threadMessages.textContent = data.error || 'Something went wrong.'; return; }

      threadMessages.textContent = '';
      if (!data.messages.length) {
        threadMessages.appendChild(el('p', 'account-hint', `Start the conversation with ${name}.`));
      } else {
        data.messages.forEach((msg) => threadMessages.appendChild(messageBubble(msg)));
        threadMessages.scrollTop = threadMessages.scrollHeight;
      }

      loadConversations(); // refresh unread state / ordering now that this thread's been read
    } catch (_) {
      threadMessages.textContent = 'Could not reach the server. Please check your connection and try again.';
    }
  }

  threadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = threadInput.value.trim();
    if (!body || !activeId) return;

    const submitBtn = threadForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ recipient_id: activeId, body })
      });
      const data = await res.json();
      if (!res.ok) { threadError.textContent = data.error || 'Could not send that message.'; return; }

      threadError.textContent = '';
      threadInput.value = '';
      threadMessages.appendChild(messageBubble(data.data));
      threadMessages.scrollTop = threadMessages.scrollHeight;
      loadConversations();
    } catch (_) {
      threadError.textContent = 'Could not reach the server. Please check your connection and try again.';
    } finally {
      submitBtn.disabled = false;
    }
  });

  /* ---------- boot ---------- */
  async function boot() {
    await loadConversations();

    const params = new URLSearchParams(location.search);
    const withId = params.get('with');
    if (withId && withId !== me.id) {
      const known = list.querySelector(`[data-user-id="${CSS.escape(withId)}"]`);
      const name = known ? known.dataset.name : (params.get('name') || 'Reader');
      openThread(withId, name);
    }
  }
  boot();
})();
