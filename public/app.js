const API = '';

// ── micro-router ──────────────────────────────────────────────────────────────

let _route = { tab: 'books', detail: null, id: null };

function navigate(tab, detail = null, id = null) {
  _route = { tab, detail, id };
  renderShell();
}

function back() { navigate(_route.tab); }

// ── DOM helpers ───────────────────────────────────────────────────────────────

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null) continue;
    e.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return e;
}

function badge(text, cls) { return el('span', { class: `badge ${cls ?? text}` }, String(text ?? '')); }

function flash(text, ok) {
  const d = el('div', { class: `msg ${ok ? 'ok' : 'err'}` }, text);
  setTimeout(() => d.remove(), 4000);
  return d;
}

function field(labelText, input) {
  return el('div', { class: 'field' }, el('label', {}, labelText), input);
}

function inp(attrs = {}) { return el('input', attrs); }

function emptyState(text) { return el('p', { class: 'empty' }, text); }

function tbl(headers, rows, onRowClick) {
  if (!rows.length) return emptyState('No records found.');
  const thead = el('thead', {}, el('tr', {}, ...headers.map(h => el('th', {}, h))));
  const tbody = el('tbody', {},
    ...rows.map((r, i) => {
      const tr = el('tr', {}, ...r.map(c => el('td', {}, c)));
      if (onRowClick) {
        tr.style.cursor = 'pointer';
        tr.addEventListener('click', e => {
          if (e.target.closest('button,a,input,select')) return;
          onRowClick(i);
        });
        tr.title = 'Click to view details';
      }
      return tr;
    })
  );
  return el('table', {}, thead, tbody);
}

// ── DataTable ─────────────────────────────────────────────────────────────────
// cols: [{ key, label, type='string'|'number', filter='text'|'select'|'none',
//          sortable=true, render(row), sortValue(row) }]
// data: array of plain objects   onRowClick(row): callback

function DataTable(data, cols, onRowClick) {
  let sortKey = null, sortDir = 'asc';
  const filters = {};
  const wrap = el('div', { class: 'dt-wrap' });

  function sv(row, col) {
    if (col.sortValue) return col.sortValue(row);
    const v = row[col.key];
    return col.type === 'number' ? Number(v ?? 0) : String(v ?? '').toLowerCase();
  }

  function visible() {
    let rows = data.filter(row =>
      cols.every(col => {
        const fv = filters[col.key]; if (!fv) return true;
        return String(row[col.key] ?? '').toLowerCase().includes(fv.toLowerCase());
      })
    );
    if (sortKey) {
      const col = cols.find(c => c.key === sortKey);
      rows = [...rows].sort((a, b) => {
        const va = sv(a, col), vb = sv(b, col);
        const cmp = typeof va === 'number' ? va - vb : va.localeCompare(vb);
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return rows;
  }

  function render() {
    wrap.innerHTML = '';
    if (!data.length) { wrap.append(emptyState('No records found.')); return; }
    const rows = visible();

    // count
    wrap.append(el('p', { class: 'dt-count' }, `Showing ${rows.length} of ${data.length}`));

    const table = document.createElement('table');

    // — header row —
    const hTr = document.createElement('tr');
    for (const col of cols) {
      const th = document.createElement('th');
      const isSorted = sortKey === col.key;
      const indicator = isSorted ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';
      if (col.sortable !== false) {
        th.className = 'dt-sortable' + (isSorted ? ' dt-sorted' : '');
        th.title = `Sort by ${col.label}`;
        th.addEventListener('click', () => {
          sortDir = sortKey === col.key && sortDir === 'asc' ? 'desc' : 'asc';
          sortKey = col.key;
          render();
        });
      }
      th.textContent = col.label + indicator;
      hTr.append(th);
    }
    const thead = document.createElement('thead');
    thead.append(hTr);

    // — filter row —
    if (cols.some(c => c.filter && c.filter !== 'none')) {
      const fTr = document.createElement('tr');
      fTr.className = 'dt-filter-row';
      for (const col of cols) {
        const td = document.createElement('td');
        if (col.filter === 'text') {
          const inp = document.createElement('input');
          inp.className = 'dt-filter-inp';
          inp.placeholder = 'Filter…';
          inp.value = filters[col.key] || '';
          inp.addEventListener('input', e => { filters[col.key] = e.target.value; render(); });
          td.append(inp);
        } else if (col.filter === 'select') {
          const vals = [...new Set(data.map(r => String(r[col.key] ?? '')))].sort();
          const sel = document.createElement('select');
          sel.className = 'dt-filter-sel';
          const allOpt = document.createElement('option');
          allOpt.value = ''; allOpt.textContent = 'All';
          sel.append(allOpt);
          vals.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v; opt.textContent = v || '—';
            if ((filters[col.key] || '') === v) opt.selected = true;
            sel.append(opt);
          });
          sel.addEventListener('change', e => { filters[col.key] = e.target.value; render(); });
          td.append(sel);
        }
        fTr.append(td);
      }
      thead.append(fTr);
    }
    table.append(thead);

    // — body —
    const tbody = document.createElement('tbody');
    if (!rows.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = cols.length; td.className = 'dt-empty-cell';
      td.textContent = 'No matching records.';
      tr.append(td); tbody.append(tr);
    } else {
      for (const row of rows) {
        const tr = document.createElement('tr');
        for (const col of cols) {
          const td = document.createElement('td');
          const content = col.render ? col.render(row) : (row[col.key] != null ? String(row[col.key]) : '—');
          typeof content === 'string' ? (td.textContent = content) : td.append(content);
          tr.append(td);
        }
        if (onRowClick) {
          tr.style.cursor = 'pointer';
          tr.title = 'Click to view details';
          tr.addEventListener('click', e => {
            if (e.target.closest('button,a,input,select')) return;
            onRowClick(row);
          });
        }
        tbody.append(tr);
      }
    }
    table.append(tbody);
    wrap.append(table);
  }

  render();
  return wrap;
}

function card(...children) { return el('div', { class: 'card' }, ...children); }
function h2(t) { return el('h2', {}, t); }
function h3(t) { return el('h3', {}, t); }

function breadcrumb(tabLabel, pageLabel) {
  return el('div', { class: 'breadcrumb' },
    el('span', { class: 'bc-link', onclick: back }, tabLabel),
    el('span', {}, ' › '),
    el('span', {}, pageLabel)
  );
}

function dlRow(label, value) {
  return el('div', { class: 'dl-row' },
    el('span', { class: 'dl-label' }, label),
    el('span', { class: 'dl-value' }, value)
  );
}

function dl(...rows) { return el('div', { class: 'dl' }, ...rows); }

function actionBtn(label, cls, onClick) {
  return el('button', { class: `btn ${cls}`, onclick: onClick }, label);
}

// ── shell ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'books',        label: 'Books' },
  { id: 'members',      label: 'Members' },
  { id: 'loans',        label: 'Loans' },
  { id: 'reservations', label: 'Reservations' },
  { id: 'search',       label: 'Search' },
  { id: 'reports',      label: 'Reports' },
  { id: 'info',         label: 'ℹ Info' },
];

const navEl  = document.getElementById('nav');
const mainEl = document.getElementById('main');

for (const t of TABS) {
  const btn = el('button', { onclick: () => navigate(t.id) }, t.label);
  btn.dataset.tab = t.id;
  navEl.append(btn);
}

function setActiveTab(id) {
  for (const b of navEl.querySelectorAll('button'))
    b.classList.toggle('active', b.dataset.tab === id);
}

async function renderShell() {
  setActiveTab(_route.tab);
  mainEl.innerHTML = '';
  const { tab, detail, id } = _route;

  if (!detail) {
    await LIST_RENDERERS[tab]?.();
  } else {
    await DETAIL_RENDERERS[detail]?.(id);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// LIST VIEWS
// ════════════════════════════════════════════════════════════════════════════

// ── Books list ────────────────────────────────────────────────────────────────

async function listBooks() {
  const fb = el('div');

  const isbn   = inp({ placeholder: 'ISBN (10 or 13 digits)' });
  const title  = inp({ placeholder: 'Title' });
  const author = inp({ placeholder: 'Author' });
  const genre  = inp({ placeholder: 'Genre' });
  const year   = inp({ placeholder: 'Year', type: 'number' });
  const copies = inp({ placeholder: 'Copies', type: 'number', value: '1' });

  mainEl.append(card(
    h2('Add Book'),
    el('div', { class: 'form-row' }, field('ISBN *', isbn), field('Title *', title), field('Author *', author)),
    el('div', { class: 'form-row' }, field('Genre', genre), field('Year *', year), field('Total Copies', copies)),
    fb,
    actionBtn('Add Book', '', async () => {
      const r = await api('POST', '/api/books', {
        isbn: isbn.value, title: title.value, author: author.value,
        genre: genre.value, year: parseInt(year.value), totalCopies: parseInt(copies.value)
      });
      fb.append(flash(r.ok ? `"${r.data.title}" added (ID ${r.data.id})` : (r.data.errors?.join(', ') || r.data.error), r.ok));
      if (r.ok) { [isbn, title, author, genre, year].forEach(i => i.value = ''); copies.value = '1'; listBooks(); }
    })
  ));

  const { data: books } = await api('GET', '/api/books');
  // add computed field for availability filter
  books.forEach(b => { b._avail = b.availableCopies > 0 ? 'Available' : 'Out of stock'; });
  const BOOK_COLS = [
    { key: 'id',     label: 'ID',               type: 'number', filter: 'none'   },
    { key: 'isbn',   label: 'ISBN',             type: 'string', filter: 'text'   },
    { key: 'title',  label: 'Title',            type: 'string', filter: 'text'   },
    { key: 'author', label: 'Author',           type: 'string', filter: 'text'   },
    { key: 'genre',  label: 'Genre',            type: 'string', filter: 'select',
      render: b => b.genre || '—' },
    { key: 'year',   label: 'Year',             type: 'number', filter: 'text'   },
    { key: '_avail', label: 'Available / Total', type: 'string', filter: 'select',
      render: b => `${b.availableCopies} / ${b.totalCopies}`,
      sortValue: b => b.availableCopies },
  ];
  mainEl.append(card(
    h2(`All Books (${books.length})`),
    DataTable(books, BOOK_COLS, b => navigate('books', 'book', b.id))
  ));
}

// ── Members list ──────────────────────────────────────────────────────────────

async function listMembers() {
  const fb   = el('div');
  const name  = inp({ placeholder: 'Full Name' });
  const email = inp({ placeholder: 'Email', type: 'email' });

  mainEl.append(card(
    h2('Register Member'),
    el('div', { class: 'form-row' }, field('Name *', name), field('Email *', email)),
    fb,
    actionBtn('Register', '', async () => {
      const r = await api('POST', '/api/members', { name: name.value, email: email.value });
      fb.append(flash(r.ok ? `Registered "${r.data.name}" (${r.data.memberNumber})` : (r.data.errors?.join(', ') || r.data.error), r.ok));
      if (r.ok) { name.value = ''; email.value = ''; listMembers(); }
    })
  ));

  const { data: members } = await api('GET', '/api/members');
  const MEMBER_COLS = [
    { key: 'id',           label: 'ID',       type: 'number', filter: 'none'   },
    { key: 'memberNumber', label: 'Member #', type: 'string', filter: 'text'   },
    { key: 'name',         label: 'Name',     type: 'string', filter: 'text'   },
    { key: 'email',        label: 'Email',    type: 'string', filter: 'text'   },
    { key: 'status',       label: 'Status',   type: 'string', filter: 'select',
      render: m => badge(m.status) },
  ];
  mainEl.append(card(
    h2(`All Members (${members.length})`),
    DataTable(members, MEMBER_COLS, m => navigate('members', 'member', m.id))
  ));
}

// ── Loans list ────────────────────────────────────────────────────────────────

async function listLoans() {
  const bookId   = inp({ placeholder: 'Book ID', type: 'number' });
  const memberId = inp({ placeholder: 'Member ID', type: 'number' });
  const fb = el('div');

  mainEl.append(card(
    h2('Borrow a Book'),
    el('div', { class: 'form-row' }, field('Book ID', bookId), field('Member ID', memberId)),
    fb,
    actionBtn('Borrow', '', async () => {
      const r = await api('POST', '/api/loans', { bookId: parseInt(bookId.value), memberId: parseInt(memberId.value) });
      fb.append(flash(r.ok ? `Loan created (ID ${r.data.id}), due ${r.data.dueDate}` : r.data.error, r.ok));
      if (r.ok) { bookId.value = ''; memberId.value = ''; listLoans(); }
    })
  ));

  const today = new Date().toISOString().slice(0, 10);
  const [{ data: loans }, { data: allBooks }, { data: allMembers }] = await Promise.all([
    api('GET', '/api/loans'),
    api('GET', '/api/books'),
    api('GET', '/api/members'),
  ]);
  const bookMap   = Object.fromEntries(allBooks.map(b => [b.id, b]));
  const memberMap = Object.fromEntries(allMembers.map(m => [m.id, m]));
  // enrich each loan with computed display fields
  loans.forEach(l => {
    l._bookTitle   = bookMap[l.bookId]?.title   ?? `#${l.bookId}`;
    l._memberName  = memberMap[l.memberId]?.name ?? `#${l.memberId}`;
    l._statusDisplay = (l.status === 'active' && l.dueDate < today) ? 'overdue' : l.status;
  });
  const LOAN_COLS = [
    { key: 'id',            label: 'ID',       type: 'number', filter: 'none'   },
    { key: '_bookTitle',    label: 'Book',     type: 'string', filter: 'text',
      render: l => el('a', { class: 'tbl-link', onclick: e => { e.stopPropagation(); navigate('books', 'book', l.bookId); } }, l._bookTitle) },
    { key: '_memberName',   label: 'Member',   type: 'string', filter: 'text',
      render: l => el('a', { class: 'tbl-link', onclick: e => { e.stopPropagation(); navigate('members', 'member', l.memberId); } }, l._memberName) },
    { key: 'borrowDate',    label: 'Borrowed', type: 'string', filter: 'none'   },
    { key: 'dueDate',       label: 'Due',      type: 'string', filter: 'none'   },
    { key: 'returnDate',    label: 'Returned', type: 'string', filter: 'none',
      render: l => l.returnDate ?? '—' },
    { key: '_statusDisplay',label: 'Status',   type: 'string', filter: 'select',
      render: l => badge(l._statusDisplay) },
    { key: 'fee',           label: 'Fee',      type: 'number', filter: 'none',
      render: l => `€${l.fee.toFixed(2)}` },
  ];
  mainEl.append(card(
    h2(`Loans (${loans.length})`),
    DataTable(loans, LOAN_COLS, l => navigate('loans', 'loan', l.id))
  ));
}

// ── Reservations list ─────────────────────────────────────────────────────────

async function listReservations() {
  const bookId   = inp({ placeholder: 'Book ID', type: 'number' });
  const memberId = inp({ placeholder: 'Member ID', type: 'number' });
  const fb = el('div');

  mainEl.append(card(
    h2('Reserve a Book'),
    el('div', { class: 'form-row' }, field('Book ID', bookId), field('Member ID', memberId)),
    fb,
    actionBtn('Reserve', '', async () => {
      const r = await api('POST', '/api/reservations', { bookId: parseInt(bookId.value), memberId: parseInt(memberId.value) });
      fb.append(flash(r.ok ? `Reservation created (ID ${r.data.id})` : r.data.error, r.ok));
      if (r.ok) { bookId.value = ''; memberId.value = ''; listReservations(); }
    })
  ));

  const { data: reservations } = await api('GET', '/api/reservations');
  reservations.forEach(r => { r._created = r.createdAt.slice(0, 16); });
  const RESV_COLS = [
    { key: 'id',       label: 'ID',        type: 'number', filter: 'none'   },
    { key: 'bookId',   label: 'Book ID',   type: 'number', filter: 'text'   },
    { key: 'memberId', label: 'Member ID', type: 'number', filter: 'text'   },
    { key: '_created', label: 'Created',   type: 'string', filter: 'none',
      sortValue: r => r.createdAt },
    { key: 'status',   label: 'Status',    type: 'string', filter: 'select',
      render: r => badge(r.status) },
  ];
  mainEl.append(card(
    h2(`All Reservations (${reservations.length})`),
    DataTable(reservations, RESV_COLS, r => navigate('reservations', 'reservation', r.id))
  ));
}

// ── Search ────────────────────────────────────────────────────────────────────

async function listSearch() {
  const bq     = inp({ placeholder: 'Title, author, or ISBN…' });
  const bGenre = inp({ placeholder: 'Genre' });
  const bAvail = inp({ type: 'checkbox', id: 'avail-cb', style: 'flex:none;width:auto;margin-right:4px' });
  const bRes   = el('div');

  async function searchBooks() {
    let url = `/api/search/books?q=${encodeURIComponent(bq.value)}`;
    if (bGenre.value) url += `&genre=${encodeURIComponent(bGenre.value)}`;
    if (bAvail.checked) url += '&available=true';
    const { data } = await api('GET', url);
    bRes.innerHTML = '';
    bRes.append(
      el('p', { style: 'font-size:0.8rem;color:#666;margin-bottom:0.5rem' }, `${data.total} result(s)`),
      tbl(
        ['ID', 'Title', 'Author', 'Genre', 'Year', 'Available / Total'],
        (data.results ?? []).map(b => [
          String(b.id), b.title, b.author, b.genre || '—', String(b.year),
          `${b.availableCopies} / ${b.totalCopies}`
        ]),
        i => navigate('books', 'book', (data.results ?? [])[i].id)
      )
    );
  }

  mainEl.append(card(
    h2('Search Books'),
    el('div', { class: 'form-row' },
      field('Search term', bq), field('Genre', bGenre),
      el('div', { class: 'field', style: 'flex-direction:row;align-items:center' },
        bAvail, el('label', { for: 'avail-cb', style: 'margin:0' }, 'Available only')
      )
    ),
    actionBtn('Search', '', searchBooks),
    el('div', { style: 'margin-top:1rem' }, bRes)
  ));

  const mq   = inp({ placeholder: 'Name or email…' });
  const mRes = el('div');

  async function searchMembers() {
    const { data } = await api('GET', `/api/search/members?q=${encodeURIComponent(mq.value)}`);
    mRes.innerHTML = '';
    mRes.append(tbl(
      ['ID', 'Member #', 'Name', 'Email', 'Status'],
      data.map(m => [String(m.id), m.memberNumber, m.name, m.email, badge(m.status)]),
      i => navigate('members', 'member', data[i].id)
    ));
  }

  mainEl.append(card(
    h2('Search Members'),
    el('div', { class: 'form-row' }, field('Search term', mq)),
    actionBtn('Search', '', searchMembers),
    el('div', { style: 'margin-top:1rem' }, mRes)
  ));
}

// ── Reports ───────────────────────────────────────────────────────────────────

async function listReports() {
  // Member history
  const memberId  = inp({ placeholder: 'Member ID', type: 'number' });
  const histBody  = el('div');
  const statsBody = el('div');

  mainEl.append(card(
    h2('Member History & Stats'),
    el('div', { class: 'form-row' }, field('Member ID', memberId)),
    actionBtn('Load', '', async () => {
      const id = memberId.value;
      const [histRes, statsRes] = await Promise.all([
        api('GET', `/api/reports/members/${id}/history`),
        api('GET', `/api/reports/members/${id}/stats`)
      ]);
      histBody.innerHTML = ''; statsBody.innerHTML = '';
      if (!histRes.ok) { histBody.append(flash(histRes.data.error, false)); return; }
      const { member, loans } = histRes.data;
      histBody.append(
        el('p', { style: 'margin-bottom:0.5rem' }, `${member.name} (${member.memberNumber}) — `, badge(member.status)),
        tbl(
          ['Loan ID', 'Book ID', 'Borrowed', 'Due', 'Returned', 'Status', 'Fee'],
          loans.map(l => [String(l.id), String(l.bookId), l.borrowDate, l.dueDate, l.returnDate ?? '—', badge(l.status), `€${l.fee.toFixed(2)}`]),
          i => navigate('loans', 'loan', loans[i].id)
        )
      );
      if (statsRes.ok) {
        const s = statsRes.data;
        statsBody.append(el('p', { style: 'margin-top:0.75rem;font-size:0.875rem' },
          `Total loans: ${s.totalLoans} | Active: ${s.activeLoans} | Returned: ${s.returnedLoans} | Fees paid: €${s.totalFeesPaid.toFixed(2)}`
        ));
      }
    }),
    histBody, statsBody
  ));

  // Top books
  const topLimit = inp({ type: 'number', value: '10', min: '1', style: 'max-width:80px' });
  const topBody  = el('div');
  mainEl.append(card(
    h2('Most Borrowed Books'),
    el('div', { class: 'form-row' }, field('Top N', topLimit)),
    actionBtn('Load', '', async () => {
      const { data } = await api('GET', `/api/reports/books/top?limit=${topLimit.value}`);
      topBody.innerHTML = '';
      topBody.append(tbl(
        ['Rank', 'ID', 'Title', 'Author', 'Genre', 'Loans'],
        data.map((b, i) => [String(i + 1), String(b.id), b.title, b.author, b.genre || '—', String(b.loanCount)]),
        i => navigate('books', 'book', data[i].id)
      ));
    }),
    el('div', { style: 'margin-top:1rem' }, topBody)
  ));

  // Overdue
  const overdueBody = el('div');
  mainEl.append(card(
    h2('Overdue Loans'),
    actionBtn('Load Overdue', 'warn', async () => {
      const { data } = await api('GET', '/api/reports/loans/overdue');
      const today = new Date().toISOString().slice(0, 10);
      overdueBody.innerHTML = '';
      overdueBody.append(tbl(
        ['Loan ID', 'Book ID', 'Member ID', 'Due Date', 'Days Overdue', 'Accrued Fee'],
        data.map(l => {
          const days = Math.floor((new Date(today) - new Date(l.dueDate)) / 86400000);
          return [String(l.id), String(l.bookId), String(l.memberId), l.dueDate, String(days), `€${l.accruedFee.toFixed(2)}`];
        }),
        i => navigate('loans', 'loan', data[i].id)
      ));
    }),
    el('div', { style: 'margin-top:1rem' }, overdueBody)
  ));
}

// ════════════════════════════════════════════════════════════════════════════
// DETAIL VIEWS
// ════════════════════════════════════════════════════════════════════════════

// ── Book detail ───────────────────────────────────────────────────────────────

async function detailBook(id) {
  const { data: book, ok } = await api('GET', `/api/books/${id}`);
  if (!ok) { mainEl.append(breadcrumb('Books', 'Not Found'), card(el('p', {}, book.error))); return; }

  mainEl.append(breadcrumb('Books', book.title));

  // Info + edit
  const fb = el('div');
  const titleInp  = inp({ value: book.title });
  const authorInp = inp({ value: book.author });
  const genreInp  = inp({ value: book.genre });
  const yearInp   = inp({ value: book.year, type: 'number' });
  const copiesInp = inp({ value: book.totalCopies, type: 'number' });

  mainEl.append(card(
    h2('Book Details'),
    el('div', { class: 'form-row' }, field('ISBN', el('input', { value: book.isbn, disabled: '' })), field('Title', titleInp), field('Author', authorInp)),
    el('div', { class: 'form-row' }, field('Genre', genreInp), field('Year', yearInp), field('Total Copies', copiesInp)),
    el('div', { class: 'dl', style: 'margin:0.75rem 0' },
      dlRow('Available copies', `${book.availableCopies} / ${book.totalCopies}`),
      dlRow('Added', book.createdAt.slice(0, 10))
    ),
    fb,
    el('div', { class: 'action-row' },
      actionBtn('Save Changes', '', async () => {
        const r = await api('PUT', `/api/books/${id}`, {
          title: titleInp.value, author: authorInp.value, genre: genreInp.value,
          year: parseInt(yearInp.value), totalCopies: parseInt(copiesInp.value)
        });
        fb.append(flash(r.ok ? 'Saved.' : (r.data.errors?.join(', ') || r.data.error), r.ok));
        if (r.ok) detailBook(id);
      }),
      actionBtn('Delete Book', 'danger', async () => {
        if (!confirm(`Delete "${book.title}"? This cannot be undone.`)) return;
        const r = await api('DELETE', `/api/books/${id}`);
        if (r.ok) navigate('books');
        else fb.append(flash(r.data.error, false));
      })
    )
  ));

  // Active loans for this book
  const { data: allLoans } = await api('GET', `/api/loans?status=active`);
  const bookLoans = allLoans.filter(l => l.bookId == id);
  const loansCard = card(h2(`Active Loans for This Book (${bookLoans.length})`));
  loansCard.append(tbl(
    ['Loan ID', 'Member ID', 'Borrowed', 'Due', 'Status'],
    bookLoans.map(l => [String(l.id), String(l.memberId), l.borrowDate, l.dueDate, badge(l.status)]),
    i => navigate('loans', 'loan', bookLoans[i].id)
  ));
  mainEl.append(loansCard);

  // Reservations for this book
  const { data: resvs } = await api('GET', `/api/reservations?bookId=${id}`);
  const resvCard = card(h2(`Reservations for This Book (${resvs.length})`));
  const resvFb = el('div');
  resvCard.append(resvFb);
  resvCard.append(tbl(
    ['Reservation ID', 'Member ID', 'Created', 'Status', 'Actions'],
    resvs.map(r => [
      String(r.id), String(r.memberId), r.createdAt.slice(0, 16), badge(r.status),
      r.status !== 'cancelled'
        ? actionBtn('Cancel', 'warn', async () => {
            const res = await api('POST', `/api/reservations/${r.id}/cancel`);
            resvFb.append(flash(res.ok ? 'Cancelled.' : res.data.error, res.ok));
            if (res.ok) detailBook(id);
          })
        : '—'
    ])
  ));
  mainEl.append(resvCard);
}

// ── Member detail ─────────────────────────────────────────────────────────────

async function detailMember(id) {
  const [{ data: member, ok }, { data: stats }, { data: hist }] = await Promise.all([
    api('GET', `/api/members/${id}`),
    api('GET', `/api/reports/members/${id}/stats`),
    api('GET', `/api/reports/members/${id}/history`)
  ]);
  if (!ok) { mainEl.append(breadcrumb('Members', 'Not Found'), card(el('p', {}, member.error))); return; }

  mainEl.append(breadcrumb('Members', `${member.name} (${member.memberNumber})`));

  // Info + edit
  const fb        = el('div');
  const nameInp   = inp({ value: member.name });
  const emailInp  = inp({ value: member.email, type: 'email' });

  mainEl.append(card(
    h2('Member Details'),
    el('div', { class: 'form-row' },
      field('Member #', el('input', { value: member.memberNumber, disabled: '' })),
      field('Name', nameInp),
      field('Email', emailInp)
    ),
    dl(
      dlRow('Status', badge(member.status)),
      dlRow('Registered', member.createdAt.slice(0, 10))
    ),
    fb,
    el('div', { class: 'action-row' },
      actionBtn('Save Changes', '', async () => {
        const r = await api('PUT', `/api/members/${id}`, { name: nameInp.value, email: emailInp.value });
        fb.append(flash(r.ok ? 'Saved.' : (r.data.errors?.join(', ') || r.data.error), r.ok));
        if (r.ok) detailMember(id);
      }),
      member.status === 'active'
        ? actionBtn('Deactivate', 'warn', async () => {
            const r = await api('POST', `/api/members/${id}/deactivate`);
            fb.append(flash(r.ok ? 'Member deactivated.' : r.data.error, r.ok));
            if (r.ok) detailMember(id);
          })
        : actionBtn('Reactivate', 'success', async () => {
            const r = await api('POST', `/api/members/${id}/activate`);
            fb.append(flash(r.ok ? 'Member reactivated.' : r.data.error, r.ok));
            if (r.ok) detailMember(id);
          }),
      actionBtn('Delete', 'danger', async () => {
        if (!confirm(`Delete member "${member.name}"?`)) return;
        const r = await api('DELETE', `/api/members/${id}`);
        if (r.ok) navigate('members');
        else fb.append(flash(r.data.error, false));
      })
    )
  ));

  // Stats strip
  if (stats) {
    mainEl.append(card(
      h2('Statistics'),
      dl(
        dlRow('Total loans', String(stats.totalLoans)),
        dlRow('Active loans', String(stats.activeLoans)),
        dlRow('Returned loans', String(stats.returnedLoans)),
        dlRow('Total fees paid', `€${stats.totalFeesPaid.toFixed(2)}`)
      )
    ));
  }

  // Loan history
  const loans = hist?.loans ?? [];
  const loansCard = card(h2(`Loan History (${loans.length})`));
  loansCard.append(tbl(
    ['Loan ID', 'Book ID', 'Borrowed', 'Due', 'Returned', 'Status', 'Fee'],
    loans.map(l => [String(l.id), String(l.bookId), l.borrowDate, l.dueDate, l.returnDate ?? '—', badge(l.status), `€${l.fee.toFixed(2)}`]),
    i => navigate('loans', 'loan', loans[i].id)
  ));
  mainEl.append(loansCard);

  // Reservations
  const { data: resvs } = await api('GET', `/api/reservations?memberId=${id}`);
  const resvFb = el('div');
  const resvCard = card(h2(`Reservations (${resvs.length})`), resvFb);
  resvCard.append(tbl(
    ['Reservation ID', 'Book ID', 'Created', 'Status', 'Actions'],
    resvs.map(r => [
      String(r.id), String(r.bookId), r.createdAt.slice(0, 16), badge(r.status),
      r.status !== 'cancelled'
        ? actionBtn('Cancel', 'warn', async () => {
            const res = await api('POST', `/api/reservations/${r.id}/cancel`);
            resvFb.append(flash(res.ok ? 'Cancelled.' : res.data.error, res.ok));
            if (res.ok) detailMember(id);
          })
        : '—'
    ])
  ));
  mainEl.append(resvCard);
}

// ── Loan detail ───────────────────────────────────────────────────────────────

async function detailLoan(id) {
  const { data: loan, ok } = await api('GET', `/api/loans/${id}`);
  if (!ok) { mainEl.append(breadcrumb('Loans', 'Not Found'), card(el('p', {}, loan.error))); return; }

  const [{ data: book }, { data: member }, { data: feeData }] = await Promise.all([
    api('GET', `/api/books/${loan.bookId}`),
    api('GET', `/api/members/${loan.memberId}`),
    api('GET', `/api/loans/${id}/fee`)
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = loan.status === 'active' && loan.dueDate < today;

  mainEl.append(breadcrumb('Loans', `Loan #${loan.id}`));

  const fb = el('div');

  mainEl.append(card(
    h2(`Loan #${loan.id}`),
    dl(
      dlRow('Status', badge(loan.status)),
      dlRow('Borrowed', loan.borrowDate),
      dlRow('Due date', loan.dueDate + (isOverdue ? '  ⚠ OVERDUE' : '')),
      dlRow('Returned', loan.returnDate ?? '—'),
      dlRow('Fee', `€${loan.fee.toFixed(2)}`)
    ),
    feeData && loan.status === 'active'
      ? el('div', { class: 'dl', style: 'margin-top:0.5rem;padding-top:0.5rem;border-top:1px solid #eee' },
          dlRow('Accrued fee (today)', `€${feeData.fee.toFixed(2)}`)
        )
      : null,
    fb,
    loan.status === 'active'
      ? actionBtn('Return Book', 'success', async () => {
          const r = await api('POST', `/api/loans/${id}/return`);
          fb.append(flash(r.ok ? `Returned. Fee charged: €${r.data.fee.toFixed(2)}` : r.data.error, r.ok));
          if (r.ok) detailLoan(id);
        })
      : null
  ));

  // Linked book
  if (book?.id) {
    mainEl.append(card(
      h2('Book'),
      dl(
        dlRow('ID', String(book.id)),
        dlRow('Title', book.title),
        dlRow('Author', book.author),
        dlRow('Genre', book.genre || '—'),
        dlRow('ISBN', book.isbn),
        dlRow('Available copies', `${book.availableCopies} / ${book.totalCopies}`)
      ),
      el('div', { class: 'action-row', style: 'margin-top:0.75rem' },
        actionBtn('View Book →', '', () => navigate('books', 'book', book.id))
      )
    ));
  }

  // Linked member
  if (member?.id) {
    mainEl.append(card(
      h2('Member'),
      dl(
        dlRow('ID', String(member.id)),
        dlRow('Name', member.name),
        dlRow('Email', member.email),
        dlRow('Member #', member.memberNumber),
        dlRow('Status', badge(member.status))
      ),
      el('div', { class: 'action-row', style: 'margin-top:0.75rem' },
        actionBtn('View Member →', '', () => navigate('members', 'member', member.id))
      )
    ));
  }
}

// ── Reservation detail ────────────────────────────────────────────────────────

async function detailReservation(id) {
  const { data: resv, ok } = await api('GET', `/api/reservations/${id}`);
  if (!ok) { mainEl.append(breadcrumb('Reservations', 'Not Found'), card(el('p', {}, resv.error))); return; }

  const [{ data: book }, { data: member }] = await Promise.all([
    api('GET', `/api/books/${resv.bookId}`),
    api('GET', `/api/members/${resv.memberId}`)
  ]);

  mainEl.append(breadcrumb('Reservations', `Reservation #${resv.id}`));

  const fb = el('div');

  mainEl.append(card(
    h2(`Reservation #${resv.id}`),
    dl(
      dlRow('Status', badge(resv.status)),
      dlRow('Created', resv.createdAt.slice(0, 16)),
      dlRow('Book ID', String(resv.bookId)),
      dlRow('Member ID', String(resv.memberId))
    ),
    fb,
    resv.status !== 'cancelled'
      ? actionBtn('Cancel Reservation', 'warn', async () => {
          const r = await api('POST', `/api/reservations/${id}/cancel`);
          fb.append(flash(r.ok ? 'Reservation cancelled.' : r.data.error, r.ok));
          if (r.ok) detailReservation(id);
        })
      : null
  ));

  // Linked book
  if (book?.id) {
    mainEl.append(card(
      h2('Book'),
      dl(
        dlRow('Title', book.title),
        dlRow('Author', book.author),
        dlRow('Genre', book.genre || '—'),
        dlRow('ISBN', book.isbn),
        dlRow('Available copies', `${book.availableCopies} / ${book.totalCopies}`)
      ),
      el('div', { class: 'action-row', style: 'margin-top:0.75rem' },
        actionBtn('View Book →', '', () => navigate('books', 'book', book.id))
      )
    ));
  }

  // Linked member
  if (member?.id) {
    mainEl.append(card(
      h2('Member'),
      dl(
        dlRow('Name', member.name),
        dlRow('Email', member.email),
        dlRow('Member #', member.memberNumber),
        dlRow('Status', badge(member.status))
      ),
      el('div', { class: 'action-row', style: 'margin-top:0.75rem' },
        actionBtn('View Member →', '', () => navigate('members', 'member', member.id))
      )
    ));
  }

  // Waitlist position
  const { data: queue } = await api('GET', `/api/reservations?bookId=${resv.bookId}&status=pending`);
  const pos = queue.findIndex(r => r.id == id);
  if (pos >= 0) {
    mainEl.append(card(
      h2('Waitlist Position'),
      dl(dlRow('Position in queue', `#${pos + 1} of ${queue.length}`))
    ));
  }
}

// ── Info page ─────────────────────────────────────────────────────────────────

function infoSection(title, ...children) {
  return el('div', { class: 'info-section' }, el('h2', { class: 'info-h2' }, title), ...children);
}

function infoP(...text) { return el('p', { class: 'info-p' }, ...text); }

function infoRule(label, desc) {
  return el('div', { class: 'info-rule' },
    el('span', { class: 'info-rule-label' }, label),
    el('span', { class: 'info-rule-desc' }, desc)
  );
}

function infoTable(headers, rows) {
  return el('table', { class: 'info-tbl' },
    el('thead', {}, el('tr', {}, ...headers.map(h => el('th', {}, h)))),
    el('tbody', {}, ...rows.map(r => el('tr', {}, ...r.map(c => el('td', {}, c)))))
  );
}

function flowStep(num, label, detail) {
  return el('div', { class: 'flow-step' },
    el('div', { class: 'flow-num' }, String(num)),
    el('div', { class: 'flow-body' },
      el('strong', {}, label),
      detail ? el('span', { class: 'flow-detail' }, ' — ' + detail) : null
    )
  );
}

async function listInfo() {
  mainEl.append(
    el('div', { class: 'info-hero' },
      el('h1', { class: 'info-title' }, 'Library Management System'),
      el('p',  { class: 'info-subtitle' }, 'Business Reference — How the application works')
    ),

    // ── Overview ──
    infoSection('Overview',
      infoP(
        'This application models the core operations of a public lending library. ',
        'Members borrow books, return them, incur late fees when overdue, and can ',
        'reserve books that are currently unavailable. The system enforces a set of ',
        'business rules at every step to keep the library\'s inventory consistent.'
      )
    ),

    // ── Entities ──
    infoSection('Entities',
      infoTable(
        ['Entity', 'What it represents', 'Key fields'],
        [
          ['Book',        'A title in the catalog — not a physical copy, but a title with a copy count.',         'ISBN, title, author, genre, year, totalCopies, availableCopies'],
          ['Member',      'A registered library patron who can borrow and reserve books.',                        'name, email, memberNumber, status (active / inactive)'],
          ['Loan',        'A single borrow–return transaction linking one member to one book.',                   'borrowDate, dueDate, returnDate, status (active / returned), fee'],
          ['Reservation', 'A queued claim on a book that is currently fully borrowed out.',                      'createdAt, status (pending / ready / cancelled)'],
        ]
      )
    ),

    // ── Books ──
    infoSection('Books — Catalog Rules',
      infoRule('Copies, not items',      'Each book record tracks how many copies exist (totalCopies) and how many are currently available to borrow (availableCopies). Borrowing decrements availableCopies by 1; returning increments it by 1.'),
      infoRule('ISBN uniqueness',        'No two books may share the same ISBN. Attempting to add a duplicate returns HTTP 409.'),
      infoRule('Valid year',             'The publication year must be a realistic year and cannot be in the future.'),
      infoRule('Minimum copies',         'A book must have at least 1 total copy.'),
      infoRule('Deletion guard',         'A book with active loans cannot be deleted. All active loans must be returned first.'),
    ),

    // ── Members ──
    infoSection('Members — Registration Rules',
      infoRule('Email uniqueness',       'Each member must have a unique email address. Attempting to register a duplicate returns HTTP 409.'),
      infoRule('Auto member number',     'A sequential member number (M0001, M0002, …) is assigned automatically on registration.'),
      infoRule('Active / inactive',      'Members can be deactivated. An inactive member cannot borrow books or create new reservations. Their existing loan records are unaffected.'),
      infoRule('Deletion guard',         'A member with active loans cannot be deleted.'),
    ),

    // ── Loans / Borrowing ──
    infoSection('Loans — Borrowing Rules',
      infoRule('Availability check',     'A book can only be borrowed if availableCopies ≥ 1. Attempting to borrow when all copies are out returns HTTP 409.'),
      infoRule('No duplicate loans',     'A member may not borrow the same book twice simultaneously. If they already have an active loan for that title, the request is rejected.'),
      infoRule('Loan limit',             'A member may hold at most 5 active loans at any one time.'),
      infoRule('Active member required', 'Inactive members cannot borrow books.'),
      infoRule('Due date',               'Every loan is due 14 days after the borrow date.'),
    ),

    // ── Returning ──
    infoSection('Loans — Returning Rules',
      infoRule('Single return',          'A loan can only be returned once. Attempting to return an already-returned loan returns HTTP 409.'),
      infoRule('Copy restored',          'Returning a book immediately increments availableCopies by 1 on the linked book.'),
      infoRule('Waitlist promotion',     'If the returned book has pending reservations, the first one in the queue is automatically promoted to "ready" status.'),
      infoRule('Fee calculated on return', 'The final fee is calculated and permanently stored on the loan record at the moment of return.'),
    ),

    // ── Late fees ──
    infoSection('Late Fee Calculation',
      infoP('Fees are calculated per loan based on how many days past the due date the book is returned.'),
      infoTable(
        ['Scenario', 'Fee'],
        [
          ['Returned on or before the due date',     '€0.00'],
          ['Returned 1 day late',                    '€0.50'],
          ['Returned N days late (N ≤ 40)',          `€${(1 * 0.5).toFixed(2)} × N`],
          ['Returned more than 40 days late',        '€20.00 (maximum cap)'],
        ]
      ),
      infoP(
        'The fee can be checked at any time on an active loan to see the accrued amount so far. ',
        'For returned loans, the stored fee is frozen at the moment of return and never recalculated.'
      ),
    ),

    // ── Reservations ──
    infoSection('Reservations — Waitlist Rules',
      infoRule('Only when unavailable',  'A member may only reserve a book that has 0 available copies. If copies are available, the member should borrow directly.'),
      infoRule('No duplicate reservations', 'A member may not have more than one active (pending or ready) reservation for the same book.'),
      infoRule('No reservation on active loan', 'A member cannot reserve a book they already have on loan.'),
      infoRule('Reservation limit',      'A member may hold at most 3 active reservations at any one time.'),
      infoRule('FIFO queue',             'When a copy becomes available (on return), the reservation that was created earliest is promoted first.'),
      infoRule('Promotion status',       'A promoted reservation changes from "pending" to "ready". The member is now expected to borrow the book. The available copy count is NOT incremented — the copy is considered held for that member.'),
      infoRule('Cancellation',           'Any pending or ready reservation can be cancelled at any time. Cancelled reservations are skipped during future promotions.'),
    ),

    // ── Happy path flow ──
    infoSection('Typical Borrowing Flow',
      el('div', { class: 'flow' },
        flowStep(1, 'Register member',        null),
        flowStep(2, 'Add book to catalog',    null),
        flowStep(3, 'Borrow book',            'availableCopies decreases by 1'),
        flowStep(4, 'Return book',            'fee calculated, availableCopies restored'),
        flowStep(5, 'Check member stats',     null),
      )
    ),

    infoSection('Reservation Flow (book fully borrowed)',
      el('div', { class: 'flow' },
        flowStep(1, 'All copies borrowed',       'availableCopies = 0'),
        flowStep(2, 'Member reserves book',      'status: pending'),
        flowStep(3, 'Another member returns',    null),
        flowStep(4, 'Reservation auto-promoted', 'first pending reservation → status: ready'),
        flowStep(5, 'Member borrows or cancels', null),
      )
    ),

    // ── Status reference ──
    infoSection('Status Reference',
      el('div', { class: 'form-row', style: 'gap:1.5rem' },
        el('div', { style: 'flex:1;min-width:200px' },
          el('h3', { class: 'info-h3' }, 'Member status'),
          infoTable(['Value', 'Meaning'], [
            [badge('active'),   'Can borrow and reserve'],
            [badge('inactive'), 'Blocked from new borrowing/reserving'],
          ])
        ),
        el('div', { style: 'flex:1;min-width:200px' },
          el('h3', { class: 'info-h3' }, 'Loan status'),
          infoTable(['Value', 'Meaning'], [
            [badge('active'),   'Book is currently out on loan'],
            [badge('returned'), 'Book has been returned; fee is final'],
          ])
        ),
        el('div', { style: 'flex:1;min-width:200px' },
          el('h3', { class: 'info-h3' }, 'Reservation status'),
          infoTable(['Value', 'Meaning'], [
            [badge('pending'),   'Waiting in queue'],
            [badge('ready'),     'Promoted — member may now borrow'],
            [badge('cancelled'), 'Withdrawn; skipped in promotions'],
          ])
        ),
      )
    ),

    // ── API / Docs ──
    infoSection('API Documentation',
      infoP(
        'All operations are available as a documented REST API. ',
        el('a', { href: '/api-docs', target: '_blank', class: 'tbl-link' }, 'Open Swagger UI ↗'),
        ' to browse and try every endpoint interactively. The raw OpenAPI spec is available at ',
        el('a', { href: '/api-docs.json', target: '_blank', class: 'tbl-link' }, '/api-docs.json'),
        ' and can be imported into Postman or any other API client.'
      ),
      infoTable(
        ['Base path', 'Domain'],
        [
          ['/api/books',        'Book catalog — CRUD'],
          ['/api/members',      'Member management — CRUD + activate/deactivate'],
          ['/api/loans',        'Borrow, return, fee lookup'],
          ['/api/reservations', 'Reserve, cancel'],
          ['/api/search',       'Full-text search across books and members'],
          ['/api/reports',      'Loan history, member stats, top books, overdue list'],
        ]
      )
    )
  );
}

// ── routing tables ────────────────────────────────────────────────────────────

const LIST_RENDERERS = {
  books:        listBooks,
  members:      listMembers,
  loans:        listLoans,
  reservations: listReservations,
  search:       listSearch,
  reports:      listReports,
  info:         listInfo,
};

const DETAIL_RENDERERS = {
  book:        detailBook,
  member:      detailMember,
  loan:        detailLoan,
  reservation: detailReservation,
};

// ── boot ──────────────────────────────────────────────────────────────────────

navigate('books');
