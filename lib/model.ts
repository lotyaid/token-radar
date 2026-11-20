// Token Radar's model: one sealed DefiLlama snapshot in, one ranked board out.
//
// The idea in one line: do not guess what a launch is worth with one flat multiple for every
// protocol. The snapshot itself holds 100+ protocols whose tokens already trade; what the market
// pays for a dollar of their TVL, per category, is the best evidence for what a pre-token
// protocol in that category would be worth. So:
//
//   multiple   = median market-cap / TVL of the category's live-token peers in this snapshot
//                (at least 3 peers, ratios winsorised to [0.01, 3]); with fewer peers, the
//                market-wide median of every live-token protocol is used instead
//   growth     = clamp(change_7d, -60, +120) per cent; growthMult = 1 + growth/100 x 0.5
//   maturity   = 0.6 + min(age_days, 1095)/1095 x 0.4   (age unknown: 365 days)
//   implied    = max(1, round(tvl_usd x multiple x growthMult x maturityMult))
//
// Every figure comes from the snapshot; no protocol name is ever special-cased, and the same
// function scores every row. On top of the value, each row carries a verdict - FARM FIRST,
// STRONG WATCH, WATCH or LONG SHOT - a pure function of implied value and 7-day momentum, so a
// reader sees the decision first and the arithmetic behind it one click away.
//
// The board covers the whole watchlist (the floor) and adds the strongest pre-token protocols
// below the floor, chosen by implied value under the same launch test the watchlist uses:
// no token, not a versioned pool, not a wrapped/staked/bridged product of one that trades.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, stated in the dashboard so a reader can re-run the arithmetic. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  min_peers: number;
  ratio_floor: number;
  ratio_cap: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
  min_peers: 3,
  ratio_floor: 0.01,
  ratio_cap: 3,
};

export const MODEL_VERSION = 'radar-2 (market-multiple)';

/** How many pre-token protocols below the watchlist floor the early radar carries, by implied value. */
export const EARLY_ROWS = 160;

/** How many live-token protocols the Live view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** The verdict a row earns from its implied value and momentum. */
export type Verdict = 'FARM FIRST' | 'STRONG WATCH' | 'WATCH' | 'LONG SHOT';

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  on_watchlist: boolean;
  age_days: number | null;
  implied_value_usd: number;
  verdict: Verdict;
  model: {
    category_multiple: number;
    multiple_source: 'category' | 'market';
    live_peers: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's view of one row: the board row's figures plus its farm plan and verdict. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  on_watchlist: boolean;
  implied_value_usd: number;
  verdict: Verdict;
  category_multiple: number;
  multiple_source: 'category' | 'market';
  live_peers: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  market_multiple: number;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  pre_token_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** The median of a non-empty list. */
function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Categories that are a product of another protocol, not a launch of their own. */
const PRODUCT_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** Names that mark a wrapped or staked product, or an exchange's own shelf. */
const PRODUCT_NAME = /\b(wrapped|staked|staking)\b/i;
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

/**
 * The launch test, the same one the watchlist's definition states: pre-token, not a versioned
 * pool, and not a wrapped, staked or bridged product of a protocol whose token already trades.
 */
export function isLaunchCandidate(p: SnapshotProtocol): boolean {
  return (
    isPreToken(p) &&
    !VERSIONED.test(p.name) &&
    !(p.category !== null && PRODUCT_CATEGORIES.has(p.category)) &&
    !PRODUCT_NAME.test(p.name) &&
    !EXCHANGE_PREFIX.test(p.name)
  );
}

/** The market evidence: per-category live multiples and the market-wide one, from this snapshot. */
export interface MarketMultiples {
  market: number;
  byCategory: Map<string, { multiple: number; peers: number }>;
}

/** What the market pays per TVL dollar, learned from the snapshot's live-token protocols. */
export function marketMultiples(snapshot: Snapshot, model: ModelConstants = MODEL): MarketMultiples {
  const ratios = (list: SnapshotProtocol[]): number[] =>
    list
      .filter((p) => !isPreToken(p) && p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0 && p.category !== 'CEX')
      .map((p) => Math.min(model.ratio_cap, Math.max(model.ratio_floor, p.mcap_usd! / p.tvl_usd)));
  const market = median(ratios(snapshot.protocols));
  const byCategory = new Map<string, { multiple: number; peers: number }>();
  const cats = new Map<string, SnapshotProtocol[]>();
  for (const p of snapshot.protocols) {
    if (p.category === null) continue;
    const list = cats.get(p.category) ?? [];
    list.push(p);
    cats.set(p.category, list);
  }
  for (const [cat, list] of cats) {
    const r = ratios(list);
    if (r.length >= model.min_peers) byCategory.set(cat, { multiple: median(r), peers: r.length });
  }
  return { market, byCategory };
}

/** The multiple one protocol is valued with, and where it came from. */
function multipleFor(p: SnapshotProtocol, multiples: MarketMultiples): { multiple: number; source: 'category' | 'market'; peers: number } {
  if (p.category !== null) {
    const hit = multiples.byCategory.get(p.category);
    if (hit !== undefined) return { multiple: hit.multiple, source: 'category', peers: hit.peers };
  }
  return { multiple: multiples.market, source: 'market', peers: 0 };
}

/** The verdict: a pure function of implied value and 7-day momentum. */
export function verdictFor(implied: number, growthPct: number): Verdict {
  if (implied >= 100_000_000) return growthPct <= -20 ? 'STRONG WATCH' : 'FARM FIRST';
  if (implied >= 25_000_000) return 'STRONG WATCH';
  if (implied >= 5_000_000) return 'WATCH';
  return 'LONG SHOT';
}

/** The multipliers and the implied value one protocol gets under `model` and the market's multiples. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  multiples: MarketMultiples,
  model: ModelConstants = MODEL,
): { implied: number; multiple: number; source: 'category' | 'market'; peers: number; growthPct: number; growthMult: number; maturityMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const m = multipleFor(protocol, multiples);
  const implied = Math.max(1, Math.round(protocol.tvl_usd * m.multiple * growthMult * maturityMult));
  return { implied, multiple: m.multiple, source: m.source, peers: m.peers, growthPct, growthMult, maturityMult, age };
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const multiples = marketMultiples(snapshot, model);
  const index = new Map(snapshot.protocols.map((p) => [p.slug, p]));
  const watchlist = new Set(snapshot.watchlist);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug is on the board, whatever the model thinks of it.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: launch candidates below the floor, scored by the same model and taken by
  // implied value - not by raw TVL, so a smaller protocol the market would price richly outranks
  // a bigger one it would price cheaply.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isLaunchCandidate(p) && p.tvl_usd < snapshot.floor_usd)
    .map((p) => ({ p, v: impliedValue(p, snapshot.as_of, multiples, model) }))
    .sort((a, b) => b.v.implied - a.v.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const e of early) chosen.set(e.p.slug, e.p);

  const scored = [...chosen.values()].map((p) => ({ p, v: impliedValue(p, snapshot.as_of, multiples, model) }));
  scored.sort((a, b) => b.v.implied - a.v.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    on_watchlist: watchlist.has(s.p.slug),
    age_days: s.v.age,
    implied_value_usd: s.v.implied,
    verdict: verdictFor(s.v.implied, s.v.growthPct),
    model: {
      category_multiple: round4(s.v.multiple),
      multiple_source: s.v.source,
      live_peers: s.v.peers,
      growth_pct: s.v.growthPct,
      growth_multiplier: round4(s.v.growthMult),
      maturity_multiplier: round4(s.v.maturityMult),
      age_days: s.v.age,
    },
    farm_steps: farmSteps(s.p, s.v.age).map(stepText),
  }));
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's core action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('risk curator') || c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} of USDC into a ${name} curated vault on ${chain}; curators route it to lending markets, and the vault shares are your position.`;
  if (c.includes('basis')) return `Open the $${capital} basis position ${name} offers on ${chain} (long spot against a short hedge inside the product) and leave both legs untouched.`;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} as collateral or a lending deposit and keep the position open.`;
  if (c.includes('dex') || c.includes('yield')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain}, in range if it is a concentrated pool, and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and put the bridged funds to work in one app on the far side.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt token in the same wallet.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedged trade so the account shows real usage.`;
  if (c.includes('prediction')) return `Fund $${capital} and take one position in a liquid market on ${name}, then let it settle.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and hold it in the farming wallet.`;
  if (c.includes('rwa')) return `Mint $${capital} of ${name}'s yield asset on ${chain} and hold it; real-world-asset products usually count holders, not traders.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active past its first renewal date.`;
  if (c.includes('payment')) return `Route one real payment of about $${capital} through ${name} on ${chain} to a second wallet you control.`;
  if (c.includes('chain')) return `Bridge $${capital} of USDC to ${name}'s chain, then make one swap and one contract interaction in its own apps so the address is a genuine early user.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** The category's second qualifying action: the usage a points program actually counts. */
function secondActionFor(p: SnapshotProtocol, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral') || c.includes('curator') || c.includes('allocator')) return `Borrow a small amount against the position on ${name} and repay it a week later, so the wallet shows both sides of the market.`;
  if (c.includes('dex') || c.includes('yield')) return `Make one swap a week through ${name} on ${chain} in the same wallet, so it reads as a user and not a parked deposit.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Place one small trade a week on ${name}, win or lose, and keep the margin account funded between trades.`;
  if (c.includes('staking') || c.includes('restak') || c.includes('basis') || c.includes('stable')) return `Claim and re-deposit the yield on ${name} once a month, so the position compounds and the wallet stays active.`;
  return `Repeat one qualifying action on ${name} each week - a deposit, a swap, a vote or a claim - from the same wallet.`;
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time, derived from the
 * protocol's own record (category, chains, TVL, age) - never from a hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = capital >= 150 ? 8 : 4;
  const steps: FarmStep[] = [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm with, keep its seed phrase offline, and reach ${p.name} only from the link on its official account - never from a search ad or a DM.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: actionFor(p, capital, chain),
      cost: `$${capital} of capital and about $${gas} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: secondActionFor(p, chain),
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity counts in more than one snapshot window; most points programs weigh consistency over size.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
  ];
  if (p.chains.length > 1) {
    steps.push({
      text: `${p.name} runs on ${p.chains.length} chains (${p.chains.slice(0, 3).join(', ')}${p.chains.length > 3 ? ' and more' : ''}); repeat the core action on a second chain only if gas there is cheap, since multi-chain activity is a common eligibility signal.`,
      cost: 'about $5 of bridge and gas fees',
      time: '20 minutes',
    });
  } else {
    steps.push({
      text: `Check ${p.name}'s own points or rewards page once a week and screenshot the balance; if a season or epoch is named, note its end date in the farm log.`,
      cost: 'nothing to check',
      time: '5 minutes a week',
    });
  }
  steps.push(
    {
      text: `Before you withdraw, re-check the rewards page and claim only from the link the protocol itself publishes; a claim that asks for a fee or a seed phrase is a scam, every time.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates, the amounts and every transaction hash in a farm log, so you can prove the history, repeat the position or unwind it cleanly.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  );
  return steps;
}

/** The live-token protocols, by market cap, for the dashboard's Live view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's form for data.js: everything the page renders, farm plan included. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    listed_at: row.listed_at,
    age_days: row.age_days,
    on_watchlist: row.on_watchlist,
    implied_value_usd: row.implied_value_usd,
    verdict: row.verdict,
    category_multiple: row.model.category_multiple,
    multiple_source: row.model.multiple_source,
    live_peers: row.model.live_peers,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const multiples = marketMultiples(snapshot, model);
  const early = board.filter((r) => !r.on_watchlist).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    market_multiple: round4(multiples.market),
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    pre_token_size: snapshot.protocols.filter(isPreToken).length,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, values, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  if (board.length < 100) return `the board holds ${board.length} rows, under the 100 a radar must carry`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
