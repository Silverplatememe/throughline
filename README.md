# Throughline — Portfolio Demo v2

Evidence-led app-review intelligence for product and customer-experience teams.

Throughline is an independently designed working prototype that explores how public App Store and Google Play reviews can be converted into clear, evidence-backed direction. It organizes feedback into themes, connects findings to customer evidence, communicates analytical confidence, and compares companies through dedicated UX/Product and CX lenses.

## Public portfolio demonstration

This repository is the frontend-only portfolio edition. It uses cached demonstration datasets so the experience is dependable, fast, and safe to explore without API credentials or model charges. The included snapshots cover ElevenReader, Klarna, Lovable, Storytel, and OK/Q8.

Company selection deliberately replays the product's analysis stages before the cached dashboard resolves. This preserves the intended service experience while remaining transparent that no live collection or model call occurs in the public build.

The private working prototype also supports live review collection, background phrase scoring, theme discovery, and on-demand executive synthesis. Those services and credentials are intentionally excluded here.

## Product flow

1. Select an available company and follow the staged analysis handoff.
2. Explore rating, sentiment, volume, confidence, and weekly movement.
3. Inspect prioritized themes and supporting customer evidence.
4. Reveal a cached executive synthesis and ranked actions.
5. Compare companies through UX/Product or CX dimensions.

## Selected product decisions

- Evidence remains visible behind every finding.
- Core analysis and optional narrative generation are separated to control model cost.
- Confidence, evidence volume, and methodology are communicated independently from sentiment.
- Comparison scores use standardized dimensions and leave unsupported dimensions unavailable.
- Loading and motion communicate system state rather than decorate the interface.

## Run locally

```bash
npm install
npm run dev
```

Open the local address printed by Vite, normally `http://localhost:5173`.

## Production build

```bash
npm run build
npm run preview
```

## Deploy with Vercel

Import this repository into Vercel. Vercel should detect Vite automatically.

- Build command: `npm run build`
- Output directory: `dist`
- Root directory: repository root

## Prototype status

This is a portfolio prototype, not a production SaaS service. A production implementation would add authenticated tenancy, durable job processing, model and source rate limits, observability, billing controls, analytical evaluation, and formal data-retention policies.
