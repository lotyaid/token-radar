// Token Radar's dashboard. Reads window.RADAR (written beside dashboard/ by main.ts) and renders
// the ranked board, a detail view per protocol with the model's arithmetic and the farm plan,
// filters and sorting, and the live-token list kept apart at the market's own values.
// No network: every byte it shows is in data.js.
(function () {
  'use strict';
  var DATA = window.RADAR;
  var app = document.getElementById('app');
  if (!DATA || !app) return;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) {
    if (n == null) return '-';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
    return '$' + n;
  }
  function pct(n) {
    if (n == null) return '-';
    var s = n > 0 ? '+' : '';
    return s + n.toFixed(1) + '%';
  }
  function age(a) {
    if (a == null) return 'unknown';
    if (a >= 730) return (a / 365).toFixed(1) + ' yrs';
    if (a >= 60) return Math.round(a / 30.4) + ' mo';
    return a + ' d';
  }
  var VCLASS = { 'FARM FIRST': 'v-farm', 'STRONG WATCH': 'v-strong', 'WATCH': 'v-watch', 'LONG SHOT': 'v-long' };
  function verdict(r) {
    return '<span class="verdict ' + VCLASS[r.verdict] + '">' + r.verdict + '</span>';
  }

  document.getElementById('subline').textContent =
    'Snapshot ' + DATA.as_of + ' - ' + DATA.source.replace(/^DefiLlama /, 'DefiLlama: ') + '.';
  document.getElementById('model-line').innerHTML =
    '<b>' + DATA.board_size + ' pre-token protocols ranked</b> - the whole ' + DATA.watchlist_size +
    '-protocol watchlist plus ' + DATA.early_size + ' early finds below its $50M floor, out of ' +
    DATA.pre_token_size + ' with no token. Market-wide live multiple: <b>' + DATA.market_multiple.toFixed(2) + 'x</b> TVL.';

  var state = { q: '', cat: '', chain: '', verdict: '', wl: false, sort: 'rank' };
  var cats = {}, chains = {};
  DATA.rows.forEach(function (r) {
    if (r.category) cats[r.category] = 1;
    r.chains.forEach(function (c) { chains[c] = 1; });
  });
  function opts(map, all) {
    var h = '<option value="">' + all + '</option>';
    Object.keys(map).sort().forEach(function (k) { h += '<option>' + esc(k) + '</option>'; });
    return h;
  }

  app.innerHTML =
    '<div id="boardView">' +
    '<div class="controls">' +
    '<input type="search" id="q" placeholder="Search protocols..." aria-label="Search protocols">' +
    '<select id="cat" aria-label="Category">' + opts(cats, 'All categories') + '</select>' +
    '<select id="chain" aria-label="Chain">' + opts(chains, 'All chains') + '</select>' +
    '<select id="verd" aria-label="Verdict"><option value="">All verdicts</option><option>FARM FIRST</option>' +
    '<option>STRONG WATCH</option><option>WATCH</option><option>LONG SHOT</option></select>' +
    '<select id="sort" aria-label="Sort"><option value="rank">Sort: implied value</option>' +
    '<option value="tvl">Sort: TVL</option><option value="growth">Sort: 7d growth</option>' +
    '<option value="age">Sort: age</option><option value="mult">Sort: category multiple</option></select>' +
    '<label class="chk"><input type="checkbox" id="wl"> Watchlist only</label>' +
    '</div>' +
    '<p class="count" id="count"></p>' +
    '<table><thead><tr>' +
    '<th class="num">#</th><th class="l">Protocol</th><th class="l">Verdict</th>' +
    '<th>Implied value</th><th class="hideS">Multiple</th><th>TVL</th><th>7d</th>' +
    '<th class="hideS">Age</th><th class="hideS">Chains</th>' +
    '</tr></thead><tbody id="rows"></tbody></table>' +
    '<h3 class="sec">Live tokens - kept apart, at the market\'s own values</h3>' +
    '<p class="live-note">These protocols already trade. The radar never ranks them; their market caps are the ' +
    'evidence the model learns its category multiples from.</p>' +
    '<table><thead><tr><th class="l">Protocol</th><th>Market cap</th><th>TVL</th><th>7d</th></tr></thead>' +
    '<tbody id="live"></tbody></table>' +
    '</div>' +
    '<div id="detailView" class="hidden"></div>';
  app.removeAttribute('aria-busy');

  var rowsEl = document.getElementById('rows');
  var countEl = document.getElementById('count');

  function filtered() {
    var out = DATA.rows.filter(function (r) {
      if (state.wl && !r.on_watchlist) return false;
      if (state.cat && r.category !== state.cat) return false;
      if (state.chain && r.chains.indexOf(state.chain) < 0) return false;
      if (state.verdict && r.verdict !== state.verdict) return false;
      if (state.q && r.name.toLowerCase().indexOf(state.q) < 0 && r.slug.indexOf(state.q) < 0) return false;
      return true;
    });
    var by = {
      rank: function (a, b) { return a.rank - b.rank; },
      tvl: function (a, b) { return b.tvl_usd - a.tvl_usd; },
      growth: function (a, b) { return (b.change_7d == null ? -999 : b.change_7d) - (a.change_7d == null ? -999 : a.change_7d); },
      age: function (a, b) { return (b.age_days == null ? -1 : b.age_days) - (a.age_days == null ? -1 : a.age_days); },
      mult: function (a, b) { return b.category_multiple - a.category_multiple; }
    };
    return out.sort(by[state.sort] || by.rank);
  }

  function renderBoard() {
    var list = filtered();
    countEl.textContent = list.length + ' of ' + DATA.rows.length + ' ranked protocols shown';
    rowsEl.innerHTML = list.map(function (r) {
      return '<tr data-slug="' + esc(r.slug) + '">' +
        '<td class="num">' + r.rank + '</td>' +
        '<td class="l"><span class="pname">' + esc(r.name) + '</span>' +
        (r.on_watchlist ? '<span class="badge wl">WATCHLIST</span>' : '<span class="badge">EARLY FIND</span>') +
        '<br><span class="pcat">' + esc(r.category || 'Uncategorised') + '</span></td>' +
        '<td class="l">' + verdict(r) + '</td>' +
        '<td class="num">' + money(r.implied_value_usd) + '</td>' +
        '<td class="num hideS">' + r.category_multiple.toFixed(2) + 'x</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num ' + (r.change_7d == null ? '' : r.change_7d >= 0 ? 'up' : 'down') + '">' + pct(r.change_7d) + '</td>' +
        '<td class="num hideS">' + age(r.age_days) + '</td>' +
        '<td class="num hideS">' + r.chains.length + '</td></tr>';
    }).join('');
  }

  document.getElementById('live').innerHTML = DATA.live.map(function (r) {
    return '<tr><td class="l"><span class="pname">' + esc(r.name) + '</span><br><span class="pcat">' +
      esc(r.category || 'Uncategorised') + '</span></td>' +
      '<td class="num">' + money(r.mcap_usd) + '</td><td class="num">' + money(r.tvl_usd) + '</td>' +
      '<td class="num ' + (r.change_7d == null ? '' : r.change_7d >= 0 ? 'up' : 'down') + '">' + pct(r.change_7d) + '</td></tr>';
  }).join('');

  var detailEl = document.getElementById('detailView');
  var boardEl = document.getElementById('boardView');
  function showDetail(r) {
    var multNote = r.multiple_source === 'category'
      ? 'median of ' + r.live_peers + ' live ' + esc(r.category || '') + ' peers'
      : 'market-wide median (too few live peers in its category)';
    detailEl.innerHTML =
      '<div class="detail"><button class="back" id="backBtn">&larr; Back to the board</button>' +
      '<h2>' + esc(r.name) + ' ' + verdict(r) + '</h2>' +
      '<p class="meta">Rank #' + r.rank + ' of ' + DATA.rows.length + ' - ' + esc(r.category || 'Uncategorised') +
      (r.on_watchlist ? ' - on the snapshot watchlist' : ' - early find below the watchlist floor') +
      ' - tracked since ' + esc(r.listed_at || 'unknown') + ' (' + age(r.age_days) + ' with no token)</p>' +
      '<div class="stats">' +
      '<div class="stat"><div class="k">Implied value</div><div class="v">' + money(r.implied_value_usd) + '</div></div>' +
      '<div class="stat"><div class="k">TVL</div><div class="v">' + money(r.tvl_usd) + '</div></div>' +
      '<div class="stat"><div class="k">Category multiple</div><div class="v">' + r.category_multiple.toFixed(2) + 'x</div></div>' +
      '<div class="stat"><div class="k">7d TVL change</div><div class="v">' + pct(r.change_7d) + '</div></div>' +
      '<div class="stat"><div class="k">Chains</div><div class="v">' + r.chains.length + '</div></div>' +
      '</div>' +
      '<h3 class="sec">Why this value</h3>' +
      '<p class="math">' + money(r.tvl_usd) + ' TVL <span class="dim">x</span> ' + r.category_multiple.toFixed(2) +
      ' <span class="dim">(' + multNote + ')</span> <span class="dim">x</span> ' + r.growth_multiplier.toFixed(2) +
      ' <span class="dim">(momentum)</span> <span class="dim">x</span> ' + r.maturity_multiplier.toFixed(2) +
      ' <span class="dim">(time with no token)</span> <span class="dim">=</span> ' + money(r.implied_value_usd) + '</p>' +
      '<p class="meta">Chains: ' + esc(r.chains.join(', ') || 'none listed') + '</p>' +
      '<h3 class="sec">How to farm it</h3>' +
      '<ol class="plan">' + r.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
      '</div>';
    boardEl.classList.add('hidden');
    detailEl.classList.remove('hidden');
    document.getElementById('backBtn').addEventListener('click', function () {
      detailEl.classList.add('hidden');
      boardEl.classList.remove('hidden');
      window.scrollTo(0, 0);
    });
    window.scrollTo(0, 0);
  }

  rowsEl.addEventListener('click', function (ev) {
    var tr = ev.target.closest ? ev.target.closest('tr[data-slug]') : null;
    if (!tr) return;
    var slug = tr.getAttribute('data-slug');
    for (var i = 0; i < DATA.rows.length; i++) {
      if (DATA.rows[i].slug === slug) { showDetail(DATA.rows[i]); return; }
    }
  });

  function bind(id, key, prop) {
    document.getElementById(id).addEventListener('input', function (ev) {
      state[key] = prop === 'checked' ? ev.target.checked : ev.target.value;
      if (key === 'q') state.q = state.q.toLowerCase();
      renderBoard();
    });
  }
  bind('q', 'q', 'value');
  bind('cat', 'cat', 'value');
  bind('chain', 'chain', 'value');
  bind('verd', 'verdict', 'value');
  bind('sort', 'sort', 'value');
  bind('wl', 'wl', 'checked');
  renderBoard();
})();
