# Bulk chart importer

Turns a folder of MarketSurge screenshots into Charts, instead of creating each one by hand in the admin.

## TL;DR

```bash
# 1. Drop screenshots into charts-inbox/ named YYYYMMDD_TICKER_timeframe[_an].png
# 2. Preview what would happen (no DB writes):
pnpm import-charts charts-inbox --dry-run
# 3. Do it for real:
pnpm import-charts charts-inbox
```

## Filename convention (strict)

```
20260622_AAPL_daily.png       base chart
20260622_AAPL_daily_an.png    annotated version -> attached to the base chart above
```

- `YYYYMMDD` — chart date (becomes `timestamp`)
- `TICKER` — looked up in `tickers`, **auto-created** (name = symbol) if missing
- `timeframe` — one of `daily | weekly | monthly | intraday | other`
- `_an` — optional suffix marking the annotated image

Anything that doesn't match is skipped and listed in the summary at the end.

## Notes & tags

Two sources, sidecar wins per-field, AI fills the gaps:

1. **Sidecar markdown** — `20260622_AAPL_daily.md` next to the image. Headings:
   `Setup / Entry`, `Trend`, `Fundamentals`, `Other`, `Tags` (comma-separated).
   See `../../charts-inbox/_TEMPLATE.md`.
2. **AI vision** (Claude, uses `ANTHROPIC_API_KEY` from `.env.local`) — drafts only the
   note fields the sidecar left blank and suggests tags, preferring your existing tags.

Tags are upserted into the `tags` collection (new ones created with the default gray color).

## Flags

| Flag             | Effect                                                        |
| ---------------- | ------------------------------------------------------------- |
| `--dry-run`      | Parse + show resolved metadata, no DB writes, no AI cost-free | 
| `--no-ai`        | Skip AI pre-fill (sidecar / blank only)                       |
| `--move`         | Move imported files into `charts-inbox/processed/`            |
| `--no-new-tags`  | Only attach tags that already exist; don't create new ones    |

## Notes

- Ticker `chartsCount`, `keyboardNavId`, and `displayTitle` are maintained by the existing
  collection hooks — the importer doesn't touch them.
- `--dry-run` does not call the AI (it never reads image bytes for inference), so it's free.
