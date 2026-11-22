// Token Launch Radar v2 dashboard. Reads window.RADAR (written beside
// dashboard/ by main.ts) and renders the integrity strip, the held-out
// validation table, the ranked board with filters and a detail view per
// protocol, and the live annex. No network: every byte shown is in data.js.
(function () {
  'use strict';
  var D = window.RADAR;
  if (!D) return;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };
  var money = function (n) {
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  };
  var pct = function (x) { return (x > 0 ? '+' : '') + x.toFixed(1) + '%'; };

  // --- Integrity strip -----------------------------------------------------
  var c = D.coverage, f = D.fit_summary;
  var strip = $('integrity');
  strip.innerHTML =
    '<div class="card"><div><strong>Integrity strip</strong> — what this board stands on</div>' +
    '<div class="kpis">' +
    '<span>Coverage <b>' + c.board_rows + ' ranked + ' + c.live_annex + ' live + ' + c.launch_test_excluded + ' set aside = ' + (c.board_rows + c.live_annex + c.launch_test_excluded) + '/' + c.snapshot_total + '</b></span>' +
    '<span>Watchlist <b>' + c.watchlist_on_board + '/' + c.watchlist_total + '</b></span>' +
    '<span>Fit peers <b>' + f.fitted_on + '</b></span>' +
    '<span>Market multiple <b>' + f.global_multiple.toFixed(3) + 'x</b></span>' +
    '<span>Momentum coef <b>' + f.momentum_coef.toFixed(3) + '</b></span>' +
    '<span>Maturity coef <b>' + f.maturity_coef.toFixed(3) + '</b></span>' +
    '<span>Size coef <b>' + f.size_coef.toFixed(3) + '</b></span>' +
    '<span>Peer launch base rate <b>' + D.odds_global_pct.toFixed(1) + '%</b></span>' +
    '<span>Snapshot <b>' + esc(D.meta.as_of) + '</b></span>' +
    '</div>' +
    '<div>' + esc(D.integrity.coverage) + '</div>' +
    '<details><summary>What was NOT verified, and the assumptions</summary><ul>' +
    D.integrity.not_verified.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') +
    D.integrity.assumptions.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') +
    '<li>Fit excluded ' + c.fit_peers_excluded + ' tokenised peers: ' + esc(c.fit_exclusion_reason) + '.</li>' +
    '<li>Source: ' + esc(D.meta.source) + '</li>' +
    '</ul></details></div>';

  // --- Validation panel ----------------------------------------------------
  var vhtml = '<h2>Held-out validation — the model tested on peers it never fitted on</h2>' +
    '<p>Each scheme refits every term (category multiples, momentum, maturity and size coefficients) on a training slice only, ' +
    'then prices the held-out peers and compares with their real market caps. A median error of 0.30 means the typical held-out price lands within about 2x of the truth.</p>' +
    '<table class="val"><thead><tr><th>Scheme</th><th class="num">Tested</th><th class="num">Median error (log10)</th>' +
    '<th class="num">Typical miss</th><th class="num">Within 2x</th><th class="num">Within 3x</th><th class="num">Bias (log10)</th></tr></thead><tbody>';
  D.validation.forEach(function (v) {
    vhtml += '<tr><td>' + esc(v.scheme) + '</td><td class="num">' + v.tested + '</td>' +
      '<td class="num">' + v.median_abs_log10_error.toFixed(3) + '</td>' +
      '<td class="num">' + Math.pow(10, v.median_abs_log10_error).toFixed(2) + 'x</td>' +
      '<td class="num">' + v.within_2x_pct.toFixed(1) + '%</td>' +
      '<td class="num">' + v.within_3x_pct.toFixed(1) + '%</td>' +
      '<td class="num">' + v.median_bias_log10.toFixed(3) + '</td></tr>';
  });
  $('validation').innerHTML = vhtml + '</tbody></table>';

  // --- Board ---------------------------------------------------------------
  var verdicts = ['FARM FIRST', 'STRONG WATCH', 'WATCH', 'LONG SHOT'];
  var vclass = { 'FARM FIRST': 'v-farm', 'STRONG WATCH': 'v-strong', 'WATCH': 'v-watch', 'LONG SHOT': 'v-long' };
  var fv = $('f-verdict'), fc = $('f-category');
  fv.innerHTML = '<option value="">All verdicts</option>' + verdicts.map(function (v) {
    var n = D.rows.filter(function (r) { return r.verdict === v; }).length;
    return '<option value="' + v + '">' + v + ' (' + n + ')</option>';
  }).join('');
  var cats = [];
  D.rows.forEach(function (r) { if (r.category && cats.indexOf(r.category) < 0) cats.push(r.category); });
  cats.sort();
  fc.innerHTML = '<option value="">All categories</option>' + cats.map(function (x) {
    return '<option>' + esc(x) + '</option>';
  }).join('');

  var shown = 100;
  function filtered() {
    var q = $('q').value.trim().toLowerCase();
    var out = D.rows.filter(function (r) {
      if (fv.value && r.verdict !== fv.value) return false;
      if (fc.value && r.category !== fc.value) return false;
      if ($('f-watch').checked && !r.on_watchlist) return false;
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.indexOf(q) < 0) return false;
      return true;
    });
    var s = $('sort').value;
    var key = { rank: 'rank', implied: 'implied_value_usd', tvl: 'tvl_usd', odds: 'odds_pct', change: 'change_7d' }[s];
    out.sort(function (a, b) { return (b[key] || 0) - (a[key] || 0) || a.rank - b.rank; });
    if (s === 'rank') out.sort(function (a, b) { return a.rank - b.rank; });
    return out;
  }
  function render() {
    var rows = filtered();
    $('count').textContent = rows.length + ' of ' + D.rows.length + ' protocols';
    var html = '';
    rows.slice(0, shown).forEach(function (r) {
      var chg = r.change_7d == null ? '<span class="down">n/a</span>'
        : '<span class="' + (r.change_7d >= 0 ? 'up' : 'down') + '">' + pct(r.change_7d) + '</span>';
      html += '<tr data-slug="' + esc(r.slug) + '"><td class="num">' + r.rank + '</td>' +
        '<td><span class="name">' + esc(r.name) + '</span>' + (r.on_watchlist ? '<span class="wl">WL</span>' : '') +
        '<br><span class="slug">' + esc(r.slug) + '</span></td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td><td class="num">' + chg + '</td>' +
        '<td class="num">' + money(r.implied_value_usd) + '</td>' +
        '<td class="num">' + r.multiple_used.toFixed(2) + 'x</td>' +
        '<td class="num">' + r.odds_pct.toFixed(0) + '%</td>' +
        '<td><span class="verdict ' + vclass[r.verdict] + '">' + r.verdict + '</span></td>' +
        '<td class="num">$' + r.plan_cost_lo + '–' + r.plan_cost_hi + '</td></tr>';
    });
    $('rows').innerHTML = html;
    $('more').style.display = rows.length > shown ? '' : 'none';
    Array.prototype.forEach.call($('rows').children, function (tr) {
      tr.setAttribute('tabindex', '0');
      tr.addEventListener('click', function () { showDetail(tr.getAttribute('data-slug')); });
      tr.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); showDetail(tr.getAttribute('data-slug')); }
      });
    });
  }
  function showDetail(slug) {
    var r = null;
    D.rows.forEach(function (x) { if (x.slug === slug) r = x; });
    if (!r) return;
    var adj = r.tvl_usd > 0 && r.multiple_used > 0 ? (r.implied_value_usd / (r.tvl_usd * r.multiple_used)) : 0;
    var d = $('detail');
    d.hidden = false;
    d.innerHTML = '<button class="close" type="button" id="d-close">Close</button>' +
      '<h2>' + esc(r.name) + ' <span class="verdict ' + vclass[r.verdict] + '">' + r.verdict + '</span></h2>' +
      '<div class="sub">' + esc(r.slug) + ' · rank #' + r.rank + ' of ' + D.rows.length + (r.on_watchlist ? ' · on the house watchlist' : '') + '</div>' +
      '<div class="grid">' +
      '<div><b>Implied value</b>' + money(r.implied_value_usd) + '</div>' +
      '<div><b>TVL</b>' + money(r.tvl_usd) + '</div>' +
      '<div><b>Category multiple (fitted)</b>' + r.multiple_used.toFixed(3) + 'x</div>' +
      '<div><b>Fitted adjustment (momentum, maturity, size)</b>x' + adj.toFixed(2) + '</div>' +
      '<div><b>Launch odds (peer record)</b>' + r.odds_pct.toFixed(1) + '%</div>' +
      '<div><b>7-day TVL change</b>' + (r.change_7d == null ? 'unreported' : pct(r.change_7d)) + '</div>' +
      '<div><b>Plan cost (assumptions stated)</b>$' + r.plan_cost_lo + '–$' + r.plan_cost_hi + '</div>' +
      '<div><b>Plan time</b>about ' + r.plan_hours + ' hours over 4 weeks</div>' +
      '</div>' +
      '<p>The arithmetic: TVL x the fitted ' + esc(r.category || 'market') + ' multiple x the fitted momentum, maturity and size adjustment = the implied value. ' +
      'The coefficients behind the adjustment were fitted on ' + f.fitted_on + ' tokenised peers and validated held-out above — they are the same for every row.</p>' +
      '<h3>Farm plan — costed</h3><ol>' +
      r.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>';
    $('d-close').addEventListener('click', function () { d.hidden = true; });
    d.scrollIntoView({ block: 'nearest' });
  }
  ['q', 'f-verdict', 'f-category', 'f-watch', 'sort'].forEach(function (id) {
    $(id).addEventListener('input', function () { shown = 100; render(); });
    $(id).addEventListener('change', function () { shown = 100; render(); });
  });
  $('more').addEventListener('click', function () { shown += 200; render(); });

  // Shareable views: #verdict=FARM%20FIRST opens the board filtered, and
  // #row=<slug> opens that protocol's detail — the same links a reader would
  // send a friend, and the views the entry's screenshots are taken from.
  var hash = {};
  String(location.hash || '').replace(/^#/, '').split('&').forEach(function (kv) {
    var at = kv.indexOf('=');
    if (at > 0) hash[kv.slice(0, at)] = decodeURIComponent(kv.slice(at + 1));
  });
  if (hash.verdict && verdicts.indexOf(hash.verdict) >= 0) fv.value = hash.verdict;
  render();
  if (hash.row) showDetail(hash.row);

  // --- Live annex ----------------------------------------------------------
  var lhtml = '<h2>Already trading — set aside, at the market\'s own values</h2>' +
    '<p class="live-note">These ' + D.live.length + ' protocols already record a token, so the radar does not rank them; ' +
    'they are the peers the model was fitted and validated on. Showing them keeps the coverage account honest: nothing in the snapshot is missing.</p>' +
    '<table><thead><tr><th>Protocol</th><th>Symbol</th><th>Category</th><th class="num">TVL</th><th class="num">Market cap</th><th class="num">Actual multiple</th></tr></thead><tbody>';
  D.live.slice(0, 40).forEach(function (p) {
    lhtml += '<tr><td>' + esc(p.name) + '</td><td>' + esc(p.symbol || '—') + '</td><td>' + esc(p.category || '—') + '</td>' +
      '<td class="num">' + money(p.tvl_usd) + '</td><td class="num">' + money(p.mcap_usd) + '</td>' +
      '<td class="num">' + (p.actual_multiple ? p.actual_multiple.toFixed(2) + 'x' : 'n/a') + '</td></tr>';
  });
  $('live').innerHTML = lhtml + '</tbody></table>' +
    (D.live.length > 40 ? '<p class="live-note">Top 40 of ' + D.live.length + ' by market cap shown; all ' + D.live.length + ' are in the data file.</p>' : '');

  // --- Set aside by the launch test -----------------------------------------
  var tally = {};
  D.excluded.forEach(function (x) {
    var key = x.reason.split(':')[0];
    tally[key] = (tally[key] || 0) + 1;
  });
  var xhtml = '<h2>Set aside by the launch test — named, with reasons</h2>' +
    '<p class="live-note">These ' + D.excluded.length + ' protocols record no token but fail the watchlist\'s own launch test: ' +
    'they are wrapped, staked or bridged products of a token that already trades, a later version of a protocol, or an exchange\'s own product — ' +
    'not launches waiting to happen. They are accounted for here instead of ranked, so the board never sells a wrapped asset as a future launch.</p><p class="live-note">' +
    Object.keys(tally).sort().map(function (k) { return esc(k) + ': ' + tally[k]; }).join(' · ') + '</p><p class="live-note">' +
    D.excluded.slice(0, 30).map(function (x) { return esc(x.name); }).join(', ') +
    (D.excluded.length > 30 ? ', … (' + D.excluded.length + ' in all, each with its reason in the data file)' : '') + '</p>';
  $('excluded').innerHTML = xhtml;

  // --- Method footer ---------------------------------------------------------
  $('method').innerHTML =
    '<b>Method, in one breath:</b> implied value = TVL x category multiple (median market-cap/TVL of the category\'s tokenised peers, shrunk to the market median) ' +
    'x exp(fitted momentum, maturity and size terms). Every coefficient is fitted on this snapshot\'s ' + f.fitted_on + ' usable tokenised peers; ' +
    'the validation panel above is the same model refitted on training slices and scored on peers it never saw. ' +
    'Launch odds are the share of comparable peers already trading — a base rate from the peers\' record, not a prediction. ' +
    'A protocol "records no token" in DefiLlama\'s record; that is not proof it has none.';
})();
