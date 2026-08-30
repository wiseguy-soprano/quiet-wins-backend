/* ============================================================
   SEARCH — GET /api/search?q=&type=

   Results have nowhere to click through to yet (individual content
   items don't have their own detail pages on this site), so each
   result renders as an info card rather than a link. Community
   results at least point back to the Reading Room.
   ============================================================ */
(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const form = $('#searchForm');
  const input = $('#searchInput');
  const typeSelect = $('#searchType');
  const status = $('#searchStatus');
  const results = $('#searchResults');

  const TYPE_LABEL = { blog: 'Blog', music: 'Music', resource: 'Resource', community: 'Community' };

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function snippet(body) {
    if (!body) return '';
    return body.length > 180 ? body.slice(0, 177) + '…' : body;
  }

  function resultCard(item) {
    const card = el('article', 'search-card');

    const head = el('div', 'search-card-head');
    head.appendChild(el('span', 'admin-badge', TYPE_LABEL[item.type] || item.type));
    if (item.topic) head.appendChild(el('span', 'admin-badge', item.topic));
    card.appendChild(head);

    card.appendChild(el('h3', null, item.title));
    if (item.body) card.appendChild(el('p', 'search-card-body', snippet(item.body)));

    const foot = el('div', 'search-card-foot');
    if (item.media_url) {
      const link = el('a', null, item.type === 'music' ? 'Listen ↗' : 'Open ↗');
      link.href = item.media_url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      foot.appendChild(link);
    }
    if (item.type === 'community') {
      const link = el('a', null, 'View in the Reading Room ↗');
      link.href = 'community.html';
      foot.appendChild(link);
    }
    if (foot.children.length) card.appendChild(foot);

    return card;
  }

  async function runSearch(q, type) {
    results.textContent = '';
    if (!q.trim()) {
      status.textContent = '';
      return;
    }

    status.textContent = 'Searching…';
    try {
      const params = new URLSearchParams({ q });
      if (type) params.set('type', type);
      const res = await fetch('/api/search?' + params.toString());
      const data = await res.json();

      if (!res.ok) {
        status.textContent = data.error || 'Something went wrong.';
        return;
      }

      if (!data.results.length) {
        status.textContent = `No results for "${q}".`;
        return;
      }

      status.textContent = `${data.results.length} result${data.results.length === 1 ? '' : 's'} for "${q}"`;
      data.results.forEach((item) => results.appendChild(resultCard(item)));
    } catch (_) {
      status.textContent = 'Could not reach the server. Please check your connection and try again.';
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value;
    const type = typeSelect.value;
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (type) params.set('type', type);
    history.replaceState(null, '', 'search.html' + (params.toString() ? '?' + params.toString() : ''));
    runSearch(q, type);
  });

  /* ---------- boot: run immediately if arriving with a query ---------- */
  const initial = new URLSearchParams(location.search);
  if (initial.get('q')) {
    input.value = initial.get('q');
    typeSelect.value = initial.get('type') || '';
    runSearch(initial.get('q'), initial.get('type') || '');
  }
})();
