# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/lotyaid/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/lotyaid/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar with a decision layer: it reads one sealed DefiLlama snapshot, finds the protocols whose token does not exist yet, and ranks them by an implied launch value learned from the market itself - the median market-cap per TVL dollar that live protocols in the same category actually trade at - instead of one flat multiple for everyone. Every row carries a verdict (FARM FIRST, STRONG WATCH, WATCH, LONG SHOT) and a concrete farm plan with costs and times. The board covers the whole watchlist plus the strongest early finds below its floor, and the dashboard shows the board, a detail view per protocol with the model's arithmetic, and filters for category, chain and verdict.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=765w942g&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
