## Goal
Create a standalone marketing/showcase page that tells the story of the Kitcaster Campaign Command Center dashboard — completely isolated from existing app routes, components, and data flows.

## Isolation Strategy
- New route: `/showcase` (public, no auth)
- New page file: `src/pages/Showcase.tsx`
- New components folder: `src/components/showcase/` (self-contained, no shared imports beyond shadcn/ui primitives and `KitcasterLogo`)
- No edits to existing pages, report components, edge functions, or data hooks
- Only touch `src/App.tsx` to register the new route

## Page Structure

1. **Hero**
   - Headline: "Every booking, every download, every dollar of earned media — tracked in one place."
   - Sub: positioning line about verifiable data, no vanity metrics
   - Two CTAs: "See a live demo report" → `/demo/report`, "Book a call" → mailto/external link

2. **The three layers we measure** (3-column section)
   - Activity — bookings, recordings, intro calls
   - Reach — listenership, social, episodes published
   - Impact — EMV, Share of Voice, GEO/AEO scores

3. **Interactive demo embed**
   - Large framed preview card linking to `/demo/report`
   - "Open the full interactive report →"
   - Optional: screenshot/thumbnail image (placeholder for now, can swap later)

4. **What makes it different** (feature grid, 6 tiles)
   - True EMV (duration × listenership, not estimates)
   - Share of Voice vs named competitors
   - GEO/AEO scoring across ChatGPT, Claude, Gemini
   - Live Airtable sync
   - AI "Looking Ahead" strategy
   - Verifiable sourcing on every metric

5. **Trust strip**
   - "Every metric is sourced, verifiable, and tied to a date range."

6. **CTA footer**
   - Repeat primary CTA, Kitcaster logo

## Visual Direction
- Reuses existing design tokens (dark-first, Geist, `text-sm` body) so it feels on-brand
- Generous whitespace, large display headings, muted section labels — consistent with the premium internal-tool aesthetic already in memory
- Framer-motion fade/slide on section entry (already in deps)
- SEO: proper `<title>`, meta description, single H1, canonical

## Technical Notes
- Page is fully static — no Supabase calls, no edge functions, no report data dependencies
- Safe to delete entirely without affecting anything else
- Files created:
  - `src/pages/Showcase.tsx`
  - `src/components/showcase/ShowcaseHero.tsx`
  - `src/components/showcase/ShowcaseLayers.tsx`
  - `src/components/showcase/ShowcaseDemoEmbed.tsx`
  - `src/components/showcase/ShowcaseDifferentiators.tsx`
  - `src/components/showcase/ShowcaseCTA.tsx`
- File edited: `src/App.tsx` (one new `<Route>` line + import)

## Open Questions (can answer after approval)
- Preferred URL slug: `/showcase` vs `/product` vs `/dashboard-story`?
- Primary CTA destination — `/demo/report`, an email, or a Calendly link?
- Should I include a real screenshot of the demo report, or use a styled placeholder for now?