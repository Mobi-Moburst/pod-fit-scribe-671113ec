

# Native AEO Audit — Use Claude (Anthropic) Instead of Perplexity

Swap the engine in the previously-approved plan from Perplexity Sonar to Anthropic Claude with **web search** enabled. Claude's `web_search_20250305` tool returns grounded answers with real citation URLs, which is what the audit needs to detect client vs competitor presence in AI responses.

## Engine choice

| Option | Citations | Recommendation |
|---|---|---|
| Claude + `web_search` tool | Yes — returns `url` + `title` per citation | Primary engine for Phase 1 |
| Perplexity Sonar | Yes | Skip — no key available |
| ChatGPT / Gemini | Phase 2 add-on | Defer |

Claude alone gives us a real, single-engine AEO signal. We can layer additional engines later without changing the data shape.

## What changes vs the prior plan

Only the engine integration layer differs. Everything else (UI button, caching table, payload shape, domain matching, GEO + Content Gap rendering) stays identical.

### Edge function: `run-aeo-audit`
- Replace Perplexity call with Anthropic Messages API:
  - Endpoint: `https://api.anthropic.com/v1/messages`
  - Model: `claude-sonnet-4-5` (or `claude-haiku-4-5` for cheaper runs)
  - Header: `x-api-key: ${ANTHROPIC_API_KEY}`, `anthropic-version: 2023-06-01`
  - Body includes `tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }]`
- Parse response: walk `content[]` blocks, collect every `web_search_tool_result` → `citations[].url`, plus any `text` blocks' inline `citations[]`.
- Domain match against client + competitors using the shared normalizer (protocol/`www.`/trailing slash strip, already fixed in `csvParsers.ts`).
- Concurrency: 3 parallel requests with 300 ms jitter (Anthropic rate limits are tighter than Perplexity's).
- Engine label stored as `"claude"` so future Perplexity/Gemini runs append, not overwrite.

### Required setup
- Add **`ANTHROPIC_API_KEY`** secret. The user will be prompted after plan approval; key comes from https://console.anthropic.com/settings/keys.
- No connector needed — Anthropic is a direct-API integration.

### Unchanged from prior plan
- New table `aeo_audit_cache` (7-day TTL).
- "Run AEO Audit" button in `UpdateCSVDialog.tsx` and `Reports.tsx`.
- Output written to `report_data.content_gap_analysis` + `report_data.geo_analysis`; existing `GEODialog`, `ContentGapRecommendations`, `ClientReportCategories` render it untouched.
- Per-company toggle: Native AEO vs Spotlight CSV.
- Cap: 25 prompts/run, 1 run/week per company unless overridden.

## Cost note

Claude Sonnet 4.5 with web search ≈ $10/audit at 25 prompts × 5 searches each. Haiku 4.5 ≈ $2/audit. Default to Haiku, expose model choice on the run button.

## Open questions

1. **Model default**: Haiku 4.5 (cheap, ~$2/run) or Sonnet 4.5 (better synthesis, ~$10/run)?
2. **Tie-breaker**: When both a Spotlight CSV and a native Claude audit exist for a company, which renders in the report — most recent, or always native?
3. **Phase 2 engines**: Add Perplexity later if the user gets a key, or stay Claude-only and add Gemini via the existing Lovable AI gateway instead?

