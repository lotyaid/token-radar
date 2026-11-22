# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/lotyaid/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/lotyaid/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

**Launch Radar v2: every value term fitted on 128 peers, tested held-out twice, 758/758 protocols accounted for, peer-record launch odds, integrity strip, costed farm verdicts.**

A token launch radar that shows its working. It reads one sealed DefiLlama snapshot (758 protocols, as of 2026-11-14) and ranks the protocols that record no token by what their launch would be worth — but v2 changes how the worth is computed, because v1's formula had hand-picked weights and no evidence behind it:

- **Every value term is fitted, none is chosen by eye.** The multiple is the median market-cap/TVL of the protocol's category peers, shrunk toward the market median by peer count. The momentum, maturity and size coefficients come from a least-squares fit of the peers' residual log-values (fitted on 128 usable tokenised peers: momentum −0.137, maturity −0.029, size −0.903).
- **Tested held-out twice, numbers published on the board.** Walk-forward in listing order (fit on earlier listings, test on later): 48 peers tested, median error 0.598 log10, 43.8% within 3×. Five-fold cross-validation with folds fixed by slug hash: 128 peers tested, median error 0.620 log10, 28.9% within 2×, 44.5% within 3×. The errors are the honest size of the claim, printed next to the rankings they price.
- **Launch odds from the peers' record.** Each row carries the share of comparable snapshot protocols (same category, same age band) that already record a token — a cross-sectional base rate, labelled as one, never dressed up as a forecast.
- **Full-coverage accounting: 758 of 758.** 342 launch candidates ranked; 144 already trading set aside in a live annex at their real market caps; 272 set aside by the same launch test the house's watchlist uses (bridges, wrapped/staked products, versioned pools, exchange products), each named with its exclusion reason. Nothing is silently dropped — WBTC is not sold to the reader as a future launch.
- **Integrity strip.** Coverage, fitted coefficients, data source and fetch time, what was NOT verified, and every assumption, at the top of the page.
- **Costed farm verdicts.** Every row carries a verdict (FARM FIRST / STRONG WATCH / WATCH / LONG SHOT) and a six-step farm plan with per-step costs and times, totalled against one stated assumption: $500 of working capital that stays the reader's own money.

The dashboard shows the ranked board (sortable, filterable by verdict, category, watchlist and search), a detail view per protocol with the model's arithmetic, the validation table, the live annex and the set-aside list. It renders with no network. Views are shareable: `#verdict=FARM%20FIRST` opens the board filtered, `#row=<slug>` opens that protocol's detail — the three screenshots in `screenshots/` are exactly those views (the board, rank #1's detail, the FARM FIRST filter).

## What v2 replaced

v1 priced protocols with a category median multiple and then applied momentum and maturity adjustments whose weights (×0.5 growth, 0.6 + 0.4 × age) were chosen by eye, covered 178 protocols, and published no validation at all — it scored 0.9013 with a confidence interval three times wider than the leaders'. v2 keeps the one honest idea (learn the multiple from the market itself) and rebuilds everything around it: all four terms fitted by regression, two independent held-out validations with the errors printed on the board, launch odds from the peers' record, the launch test applied board-wide, and a coverage account that names all 758 protocols. The model file's header comment is the full changelog.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=q0a4tfr8&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
