import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutGrid, SearchCheck, LineChart, ArrowLeftRight, BarChart3,
  Search, CalendarDays, SlidersHorizontal, Download, Share2, Bell, Settings,
  Star, Smile, Meh, Frown, Info, ChevronRight, ChevronLeft, ChevronDown,
  Eye, CornerUpLeft, Sparkles, AlertTriangle, TrendingUp,
  TrendingDown, MessageSquare, X, Check, ArrowRight, RefreshCw,
} from "lucide-react";
import { GOOGLE_PLAY_LOGO, APP_STORE_LOGO } from "./logos";
import { SearchPage, AnalysisLoading, DashboardTransitionOverlay } from "./EntryFlow";
import CompanyBattleCard from "./CompanyBattleCard";

const PUBLIC_DEMO = true;

function isoDay(date) {
  return date.toISOString().slice(0, 10);
}

function shortDay(date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/* Older cached snapshots pre-date the Weekly Pulse export. Build the same
   four rolling periods from their review evidence at load time so the public
   demo has one consistent dashboard contract across every company. */
function weeklyFromReviews(reviews = []) {
  const dated = reviews.filter((review) => review?.date && !Number.isNaN(new Date(`${review.date}T00:00:00Z`).getTime()));
  if (!dated.length) return [];
  const maxDate = new Date(Math.max(...dated.map((review) => new Date(`${review.date}T00:00:00Z`).getTime())));
  return Array.from({ length: 4 }, (_, index) => {
    const end = new Date(maxDate);
    end.setUTCDate(maxDate.getUTCDate() - ((3 - index) * 7));
    const start = new Date(end);
    start.setUTCDate(end.getUTCDate() - 6);
    const selected = dated.filter((review) => {
      const date = new Date(`${review.date}T00:00:00Z`);
      return date >= start && date <= end;
    });
    const ratings = selected.map((review) => Number(review.rating)).filter(Number.isFinite);
    const phrases = selected.flatMap((review) => review.phrases || []);
    const scores = phrases.map((phrase) => Number(phrase.score)).filter(Number.isFinite);
    const positive = scores.filter((score) => score > .2).length;
    const negative = scores.filter((score) => score < -.2).length;
    return {
      start: isoDay(start),
      end: isoDay(end),
      label: `${shortDay(start)}–${shortDay(end)}`,
      nReviews: selected.length,
      avgRating: ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null,
      nss: scores.length ? ((positive - negative) / scores.length) * 100 : null,
    };
  });
}

function normalizeDemoCompany(rawData, slug) {
  let data = rawData;
  if (slug === "elevenlabs") {
    data = JSON.parse(JSON.stringify(rawData).replaceAll("ElevenLabs", "ElevenReader"));
  }
  const scopes = Object.fromEntries(Object.entries(data.scopes || {}).map(([scopeId, scope]) => {
    const scopedReviews = scopeId === "all" ? data.reviews : (data.reviews || []).filter((review) => review.source === scopeId);
    return [scopeId, { ...scope, weekly: scope.weekly?.length ? scope.weekly : weeklyFromReviews(scopedReviews) }];
  }));
  return { ...data, scopes };
}

/* Every company analyzed by export_app_data.py lands in its own
   src/data/<slug>.json. Vite bundles all of them at build time (or picks up
   a new one on the next dev-server reload); no server, no runtime fetch. The
   dashboard then switches between them client-side via CompanySwitcher —
   see AppDataContext below. Adding a company is still a local step (run
   analyze.py + export_app_data.py yourself), but viewing it needs no rebuild
   step beyond that file landing here. */
const COMPANY_MODULES = import.meta.glob("./data/*.json", { eager: true });
const COMPANIES = Object.fromEntries(
  Object.entries(COMPANY_MODULES).map(([path, mod]) => {
    const slug = path.match(/([^/]+)\.json$/)[1];
    return [slug, normalizeDemoCompany(mod.default || mod, slug)];
  })
);

const AppDataContext = createContext(null);
/* The active company's data + narrative, plus the switcher's own state.
   Every component below that used to read the bare `DATA`/`NARR` globals
   now calls this hook instead — same shape, just no longer frozen at
   build time to whichever file happened to be named data.json. */
function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData() called outside <AppDataContext.Provider>");
  return ctx;
}

// Official Throughline brand assets (from /graphics), served from public/ — the
// wordmark for the sidebar and the motif for subtle card accents. Kept as files
// rather than base64 because the source art is large.
const THROUGHLINE_WORDMARK = "/throughline-wordmark.png";
const THROUGHLINE_MOTIF = "/throughline-motif.png";
const THROUGHLINE_MOTIFS = {
  findings: "/throughline-motif-findings.png",
  actions: "/throughline-motif-actions.png",
  voice: "/throughline-motif-voice.png",
  trust: "/throughline-motif-trust.png",
};

/* ------------------------------------------------------------------
   Every number rendered here comes from data.json, produced by
   export_app_data.py from the pipeline's results.json. Where the data
   cannot support a figure the UI says so — it never fills the gap.
   ------------------------------------------------------------------ */

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutGrid },
  { id: "explorer", label: "Review Explorer", icon: SearchCheck },
  { id: "themes", label: "Theme Analysis", icon: LineChart },
  { id: "competitive", label: "Competitive", icon: ArrowLeftRight },
  { id: "reports", label: "Reports", icon: BarChart3 },
];

const SENTIMENTS = [
  { id: "pos", label: "Positive", dot: "bg-emerald-500",
    tint: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
    active: "border-emerald-600 bg-emerald-600 text-white shadow-emerald-900/20",
    ring: "focus-visible:ring-emerald-500" },
  { id: "neu", label: "Neutral", dot: "bg-amber-500",
    tint: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100",
    active: "border-amber-500 bg-amber-500 text-white shadow-amber-900/20",
    ring: "focus-visible:ring-amber-500" },
  { id: "neg", label: "Negative", dot: "bg-red-500",
    tint: "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
    active: "border-red-600 bg-red-600 text-white shadow-red-900/20",
    ring: "focus-visible:ring-red-500" },
];

const VALENCE_LABEL = { pos: "Positive", neu: "Neutral", neg: "Negative" };
// Reserved for section labels and column headers across the app — sans,
// not mono. Monospace is kept ONLY for actual statistical notation
// (H=, p<, rho=, n=, confidence intervals) and the CLI snippet.
const EYEBROW = "font-sans text-xs font-semibold uppercase tracking-wider text-[#8A7F79]";
const VALENCE_BAR = { pos: "bg-emerald-500", neu: "bg-amber-500", neg: "bg-red-500" };
const VALENCE_TEXT = { pos: "text-emerald-600", neu: "text-amber-600", neg: "text-red-600" };
const VALENCE_RING = { pos: "bg-emerald-50", neu: "bg-amber-50", neg: "bg-red-50" };
const EMOTION_ICON = { pos: Smile, neu: Meh, neg: Frown };

const fmt = (n, d = 2) =>
  n === null || n === undefined ? "—" : `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(d)}`;
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
const valenceOf = (s) =>
  s === null || s === undefined ? "neu" : s > 0.2 ? "pos" : s < -0.2 ? "neg" : "neu";

/* Interpretive copy Anthropic wrote for THIS dataset (see the narrative step in
   the pipeline). Every field is optional: when absent, the components compute a
   data-derived fallback, so wording is never hardcoded to a company/platform/
   emotion and the layout stays stable across datasets. Derived per-company
   inside AppDataContext (a company with no narrative just gets {}). */

/* Data-derived fallback for the platform-comparison headline — states the
   actual gap rather than assuming a winner. */
function platformInsight(platform) {
  if (!platform || platform.length < 2) return null;
  const byS = [...platform].sort((a, b) => (a.meanSentiment ?? 0) - (b.meanSentiment ?? 0));
  const worse = byS[0], better = byS[byS.length - 1];
  const sGap = Math.abs((better.meanSentiment ?? 0) - (worse.meanSentiment ?? 0));
  const rGap = Math.abs((better.avgRating ?? 0) - (worse.avgRating ?? 0));
  if (sGap < 0.08 && rGap < 0.25) return "The platform gap is small.";
  return `${worse.label} runs materially weaker than ${better.label}.`;
}

// Three-level text hierarchy — used to avoid washed-out grey on meaningful
// content (findings, rationales, evidence, chart labels).
const INK = "#172033";   // primary — anything the user must read to get a conclusion
const INK2 = "#4B403C";  // secondary — supporting/explanatory content, chart values
const INK3 = "#8A7F79";  // muted — timestamps, inactive controls, tertiary meta only

/* Single source of truth for the rating↔sentiment classification, shared by
   the trust card and the detailed scatter so their counts are identical by
   construction. A review CONTRADICTS its rating when a high rating (4–5★)
   reads negative or a low rating (1–2★) reads positive; the rest are
   directionally consistent (not necessarily "agreeing", just not contradictory). */
function classifyValidation(reviews) {
  const contradicts = (r, s) => (r >= 4 && s < 0) || (r <= 2 && s > 0);
  const pts = (reviews || [])
    .filter((rv) => rv.rating != null && rv.score != null)
    .map((rv) => ({ r: rv.rating, s: rv.score, source: rv.source, sourceLabel: rv.sourceLabel,
      text: rv.text, emotion: rv.primaryEmotion, mismatch: contradicts(rv.rating, rv.score) }));
  const mismatches = pts.filter((p) => p.mismatch);
  return { pts, mismatches, nConsistent: pts.length - mismatches.length };
}

/* Data-derived fallback for the emotion takeaway — adapts to whether the top
   emotions are matched or one clearly dominates. */
function emotionInsight(emotions) {
  const pos = emotions.filter((e) => e.valence === "pos").sort((a, b) => b.count - a.count)[0];
  const neg = emotions.filter((e) => e.valence === "neg").sort((a, b) => b.count - a.count)[0];
  if (!pos && !neg) return null;
  if (!pos) return `${cap(neg.label)} is the dominant signal.`;
  if (!neg) return `${cap(pos.label)} is the dominant signal.`;
  const ratio = Math.min(pos.count, neg.count) / Math.max(pos.count, neg.count);
  if (ratio >= 0.7) return `${cap(pos.label)} is closely matched by ${neg.label} — sentiment is split.`;
  const dom = neg.count >= pos.count ? neg : pos;
  return `${cap(dom.label)} is the dominant signal.`;
}

/* Interpretive labels for KPIs that would otherwise be a bare number with no
   context. Each is a plain reading of the metric's OWN defined scale (a
   correlation coefficient's conventional strength bands, NSS's -100..+100
   range, star rating against a widely-used app-store rule of thumb) — not an
   external benchmark we don't have data for. */
const correlationStrength = (r) => {
  const a = Math.abs(r);
  return a >= 0.7 ? "Strong" : a >= 0.4 ? "Moderate" : "Weak";
};
// NSS is a percentage-point gap (share positive − share negative), so a ±10
// neutral band is a defensible "roughly balanced" zone; beyond it the lean is
// real. −14 therefore reads as a genuine negative, not near-neutral.
const nssLabel = (nss) =>
  nss > 10 ? "Net positive lean" : nss < -10 ? "Net negative lean" : "Mixed, near neutral";
const nssShort = (nss) => (nss > 10 ? "Positive" : nss < -10 ? "Negative" : "Mixed");
const ratingLabel = (avg) =>
  avg >= 4.0 ? "Strong" : avg >= 3.3 ? "Mixed" : "Weak";

/* Restrained semantic tint for a KPI's headline number: green = strong/
   positive, amber = mixed/moderate, red = weak/negative, slate = a neutral
   count with no good/bad direction. Only the figure is tinted, never the
   whole card, so the palette reads as interpretation not decoration. */
const KPI_TONE = {
  good: "text-emerald-700",
  mixed: "text-amber-600",
  bad: "text-red-600",
  neutral: "text-[#172033]",
};
const ratingTone = (avg) => (avg == null ? "neutral" : avg >= 4.0 ? "good" : avg >= 3.3 ? "mixed" : "bad");
const nssTone = (nss) => (nss == null ? "neutral" : nss > 10 ? "good" : nss < -10 ? "bad" : "mixed");
const correlationTone = (r) => {
  if (r == null) return "neutral";
  const a = Math.abs(r);
  return a >= 0.7 ? "good" : a >= 0.4 ? "mixed" : "bad";
};

/* Five-tier action language, keyed to the SAME field the matrix ranks by
   (theme.priority, computed server-side in export_app_data.py from volume,
   significance and impact) — never re-derived here, so the badge can't say
   something the ranking disagrees with. */
const PRIORITY_STYLE = {
  "Fix first": "border-red-700 bg-red-600 text-white",
  "Investigate": "border-red-200 bg-red-50 text-red-700",
  "Monitor": "border-slate-200 bg-slate-100 text-[#4B403C]",
  "Protect": "border-emerald-200 bg-emerald-50 text-emerald-700",
  "Low evidence": "border-slate-200 bg-slate-50 text-[#8A7F79]",
};

const STOP = new Set(["and", "with", "the", "of", "a", "in", "for", "to", "on"]);
const hashtag = (name) =>
  "#" + name.replace(/[^a-zA-Z0-9 ]/g, " ").split(/\s+/)
    .filter((w) => w && !STOP.has(w.toLowerCase())).slice(0, 2)
    .map((w) => w[0].toUpperCase() + w.slice(1)).join("");

/* Reviews carry an absolute date; the cards read better relative to it. */
function relativeDate(iso) {
  if (!iso) return "undated";
  const then = new Date(iso + "T00:00:00");
  if (Number.isNaN(then.getTime())) return iso;
  const days = Math.round((Date.now() - then.getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const m = Math.round(days / 30);
  return `${m} month${m > 1 ? "s" : ""} ago`;
}

/* ------------------------------------------------------------------
   Primitives
   ------------------------------------------------------------------ */

/* Throughline brand coral, sampled from the logo motif — used sparingly for
   the active nav mark and primary CTAs, never as chart data color. */
const CORAL = "#F0714E";

/* Subtle cropped brand motif for the storytelling cards (What we found, What to
   do next, Customer Voice, trust). Kept faint (~5%) and pushed to a corner so
   it reinforces brand without touching text or charts. Parent must be
   `relative overflow-hidden`. */
const CardMotif = ({ variant, className = "" }) => (
  <img src={THROUGHLINE_MOTIFS[variant] || THROUGHLINE_MOTIF} alt="" aria-hidden="true"
    className={`pointer-events-none absolute select-none opacity-[0.045] ${className}`} />
);

/* `surface` lets a card carry a subtle semantic tint (What we found, evidence,
   trust, Customer Voice); default is white. Border is a restrained warm gray so
   the layout reads as structured panels rather than floating on shadow. */
const Card = ({ accent, surface, className = "", children }) => (
  <div className={`rounded-xl border border-[#C2B6AF] ${surface || "bg-[#FFFDFC]"} ${
    accent === "neg" ? "border-t-4 border-t-red-500"
      : accent === "pos" ? "border-t-4 border-t-emerald-500" : ""} ${className}`}>
    {children}
  </div>
);

/* Official store logos from graphics/, embedded via ./logos. "all" has no
   single logo (it means both), so it renders nothing — the label carries it. */
const SOURCE_LOGO = { google_play: GOOGLE_PLAY_LOGO, app_store: APP_STORE_LOGO };
function SourceMark({ source, className = "h-4 w-4" }) {
  const src = SOURCE_LOGO[source];
  if (!src) return null;
  return <img src={src} alt="" aria-hidden="true" className={`${className} shrink-0 object-contain`} />;
}

/* Date-range control in the company header. Displays the real collected
   range as a picker-styled control; the range itself is fixed by the data
   (a snapshot), so this reflects scope rather than filtering it. */
function DatePicker({ range, current = 30, onSelect, readOnly = false }) {
  const [open, setOpen] = useState(false);
  if (readOnly) return <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-[#4B403C]"><CalendarDays size={15} strokeWidth={2} className="text-[#8A7F79]" />{range}</div>;
  return (
    <div className="relative"><button onClick={() => setOpen(!open)} aria-expanded={open} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-[#4B403C] transition hover:border-[#C9BCB5] hover:bg-slate-50">
      <CalendarDays size={15} strokeWidth={2} className="text-[#8A7F79]" />{range}<ChevronDown size={14} strokeWidth={2} className={`text-[#8A7F79] transition ${open ? "rotate-180" : ""}`} />
    </button>{open && <div className="absolute left-0 top-11 z-50 w-48 rounded-lg border border-[#D8CEC8] bg-white p-1.5 shadow-xl">{[30,60,90].map((days)=><button key={days} onClick={() => { setOpen(false); if(days!==current) onSelect?.(days); }} className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${days===current ? "bg-[#FFF1EC] font-semibold text-[#A6533E]" : "text-[#4B403C] hover:bg-[#F7F4F2]"}`}><span>Last {days} days</span>{days===current && <Check size={14}/>}</button>)}</div>}</div>
  );
}

/* Segmented source selector reused in the company header (Dashboard) and the
   Explorer filter bar. All Sources | Google Play | App Store, with logos. */
function SourceSelector({ store, setStore }) {
  const { DATA } = useAppData();
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
      {DATA.sources.map((s) => (
        <button key={s.id} onClick={() => setStore(s.id)}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition ${
            store === s.id ? "bg-slate-100 font-semibold text-[#172033]"
              : "font-medium text-[#8A7F79] hover:text-[#172033]"}`}>
          {s.id !== "all" && <SourceMark source={s.id} className="h-4 w-4" />}
          {s.label}
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${store===s.id ? "bg-white text-[#4B403C]" : "bg-[#F3EFEC] text-[#8A7F79]"}`}>{DATA.scopes?.[s.id]?.kpis?.nReviews ?? 0}</span>
        </button>
      ))}
    </div>
  );
}

/* Turns the company name in the header into the company switcher: click it,
   search/pick from whichever companies have been analyzed locally (each a
   file in src/data/), and the whole dashboard re-renders for that company —
   no page reload, no rebuild. Closes on an outside click via a transparent
   full-page overlay, the same technique the action drawer's scrim uses, just
   undimmed since this is a lightweight menu, not a modal. */
function CompanySwitcher({ compact = false }) {
  const { DATA, activeSlug, setActiveSlug, companies } = useAppData();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const entries = Object.entries(companies);
  const q = query.trim().toLowerCase();
  const filtered = q
    ? entries.filter(([slug, d]) => (d.company || slug).toLowerCase().includes(q))
    : entries;

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="group -mx-1 flex items-center gap-1.5 rounded-lg px-1 transition hover:bg-black/[0.03]">
        <h1 className={`${compact ? "text-[15px] font-semibold" : "text-[30px] font-bold"} leading-none tracking-tight text-[#172033]`}>
          {DATA.company}
        </h1>
        <ChevronDown size={18} strokeWidth={2}
          className={`mt-1 shrink-0 text-[#8A7F79] transition group-hover:text-[#4B403C] ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => { setOpen(false); setQuery(""); }} />
          <div className="absolute left-0 top-full z-30 mt-2 w-72 rounded-lg border border-[#D8D3CF] bg-white shadow-lg">
            <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5">
              <Search size={15} strokeWidth={2} className="shrink-0 text-[#8A7F79]" />
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Search companies…"
                className="w-full text-sm text-[#172033] placeholder:text-[#8A7F79] focus:outline-none" />
            </div>
            <ul className="max-h-64 overflow-y-auto py-1">
              {filtered.map(([slug, d]) => (
                <li key={slug}>
                  <button onClick={() => { setActiveSlug(slug); setOpen(false); setQuery(""); }}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${
                      slug === activeSlug ? "font-semibold text-[#172033]" : "text-[#4B403C]"}`}>
                    {d.company || slug}
                    {slug === activeSlug && <Check size={14} strokeWidth={2} className="shrink-0 text-[#8A7F79]" />}
                  </button>
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="px-3 py-2.5 text-sm text-[#8A7F79]">No companies match “{query}”.</li>
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

/* `alert` is for the red-tinted Top Pain Point card: text-slate-300 empty
   stars all but disappear against that background, so empty stars there use
   a visible red instead — everywhere else keeps the neutral grey. */
function Stars({ rating, size = 15, hollow = false, alert = false }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = i <= (rating || 0);
        const cls = hollow
          ? "text-red-400"
          : filled
          ? (alert ? "fill-amber-500 text-amber-500" : "fill-amber-400 text-amber-400")
          : (alert ? "text-red-400 stroke-[1.5]" : "text-slate-300");
        return <Star key={i} size={size} strokeWidth={2} className={cls} />;
      })}
    </div>
  );
}

function OutlineButton({ icon: Icon, children, onClick, active }) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition ${
        active ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-200 bg-white text-[#4B403C] hover:bg-slate-50"}`}>
      {Icon && <Icon size={15} strokeWidth={2} />}
      {children}
    </button>
  );
}

function GhostIcon({ icon: Icon, dot, label, onClick }) {
  return (
    <button aria-label={label} onClick={onClick}
      className="relative grid h-9 w-9 place-items-center rounded-lg text-[#8A7F79] transition hover:bg-slate-100 hover:text-[#172033]">
      <Icon size={18} strokeWidth={2} />
      {dot && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />}
    </button>
  );
}

/* Follows the mouse rather than anchoring to the trigger, so it never gets
   clipped by the matrix's own scroll container (fixed positioning escapes
   an ancestor's overflow, an anchored absolute tooltip would not). */
function HoverTip({ children, tip }) {
  const [pos, setPos] = useState(null);
  return (
    <div className="cursor-help" onMouseMove={(e) => setPos({ x: e.clientX, y: e.clientY })}
      onMouseLeave={() => setPos(null)}>
      {children}
      {pos && tip && (
        <div className="pointer-events-none fixed z-50 max-w-[230px] rounded-lg bg-slate-900 px-3 py-2 text-[11px] leading-relaxed text-white shadow-lg"
          style={{ left: pos.x + 14, top: pos.y + 14 }}>
          {tip}
        </div>
      )}
    </div>
  );
}

function InfoPopover({ label, children, attention = false }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  useEffect(() => {
    const close = (event) => { if (!root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  return (
    <span ref={root} className="relative inline-flex shrink-0">
      <button type="button" aria-label={label} aria-expanded={open} onClick={() => setOpen((v) => !v)} className={`tl-info-trigger grid h-6 w-6 place-items-center rounded-full text-[#7F746E] transition hover:bg-black/[0.05] hover:text-[#172033] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8EA1B2] ${attention ? "tl-info-attention" : ""}`}><Info size={14} /></button>
      {open && <span role="tooltip" className="absolute right-0 top-8 z-[100] w-[280px] rounded-lg border border-[#324057] bg-[#172033] px-3.5 py-3 text-left text-[11px] font-normal leading-relaxed text-white shadow-xl">{children}</span>}
    </span>
  );
}

/* Rating impact: the number alone. Direction is carried by color, exact
   mechanics (leave-one-out, rated-review count) live in the hover tip so the
   column doesn't need a bar to read at a glance. */
function ImpactBar({ value, ratedN }) {
  if (value === null || value === undefined) {
    return <span className="font-sans text-sm font-medium tabular-nums text-[#8A7F79]">n/a</span>;
  }
  const neg = value < 0;
  return (
    <HoverTip tip={<>
      <div className="font-semibold">Rating impact</div>
      <div className="mt-1">Estimated effect on the overall rating: {Math.abs(value).toFixed(2)} stars {value < 0 ? "lower" : "higher"}.</div>
      {ratedN != null && <div className="mt-1 text-slate-300">Based on {ratedN} rated reviews.</div>}
    </>}>
      <span className={`font-sans text-sm font-semibold tabular-nums ${neg ? "text-red-600" : "text-emerald-600"}`}>
        {fmt(value, 2)}
      </span>
    </HoverTip>
  );
}

/* Composition of a topic: how its mentions split across positive, neutral and
   negative. A topic is a subject, not a feeling, so it can hold both — used
   both standalone in the expanded panel and as the texture inside
   SentimentGauge below. */
function DistributionBar({ dist }) {
  if (!dist) return null;
  const total = dist.positive + dist.neutral + dist.negative;
  if (!total) return null;
  const segs = [
    ["positive", dist.positive, "bg-emerald-500"],
    ["neutral", dist.neutral, "bg-amber-500"],
    ["negative", dist.negative, "bg-red-500"],
  ];
  return (
    <div className="flex h-2.5 gap-px overflow-hidden rounded-full">
      {segs.map(([k, n, cls]) =>
        n > 0 ? <div key={k} className={cls} style={{ width: `${(n / total) * 100}%` }} /> : null)}
    </div>
  );
}

/* The matrix's Breakdown cell: the traffic-light composition of the topic's
   phrases — positive (green) / neutral (amber) / negative (red) as one
   stacked bar. The mean and 95% CI move into the tooltip; the bar itself is
   the at-a-glance signal of how the topic splits. */
function SentimentGauge({ mean, ci, dist, nSentences }) {
  const total = dist ? dist.positive + dist.neutral + dist.negative : 0;
  if (!total) {
    return <span className="font-sans text-xs font-medium tabular-nums text-[#8A7F79]">n/a</span>;
  }
  const pctNeg = Math.round((dist.negative / total) * 100);
  const pctPos = Math.round((dist.positive / total) * 100);
  return (
    <HoverTip tip={<>
      <div className="font-semibold">Sentiment breakdown</div>
      <div className="mt-1">{dist.positive} positive · {dist.neutral} neutral · {dist.negative} negative</div>
      {mean != null && <div className="mt-1">Mean {fmt(mean)}{ci ? ` · 95% CI ${fmt(ci[0])} to ${fmt(ci[1])}` : ""}</div>}
      {nSentences != null && <div className="mt-1 text-slate-300">{nSentences} scored phrases in this topic.</div>}
    </>}>
      <div className="w-full" aria-label={`${pctPos}% positive, ${Math.round((dist.neutral / total) * 100)}% neutral, ${pctNeg}% negative`}>
        <DistributionBar dist={dist} />
      </div>
    </HoverTip>
  );
}

/* `value` is optional: some chips are a state on their own ("Statistically
   significant"), others are a label:value pair ("Impact: Large"). */
const StatBadge = ({ label, value, tone = "slate" }) => (
  <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px] ${
    tone === "good" ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "warn" ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-slate-200 bg-slate-50 text-[#4B403C]"}`}>
    <span className={value != null ? "text-[#8A7F79]" : "font-semibold"}>{label}</span>
    {value != null && <span className="font-semibold">{value}</span>}
  </span>
);

/* ------------------------------------------------------------------
   Sidebar
   ------------------------------------------------------------------ */

function WaveMark() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
      <path d="M18 2c8.8 0 16 7.2 16 16s-7.2 16-16 16S2 26.8 2 18 9.2 2 18 2z" fill="#181E29" />
      <path d="M9 21c2.2-6 4.2-6 6.4 0s4.2 6 6.4 0 4.2-6 5.2-3"
        stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function Sidebar({ view, setView }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-[272px] flex-col bg-[#343640] lg:flex">
      {/* Real Throughline wordmark (white + coral motif) on the charcoal panel;
          not a recreation. */}
      <div className="px-6 pb-7 pt-7">
        <img src={THROUGHLINE_WORDMARK} alt="Throughline" className="h-9 w-auto select-none" />
      </div>

      <nav className="flex-1 space-y-1 px-4">
        {NAV.map(({ id, label, icon: Icon }) => {
          const active = view === id;
          return (
            <button key={id} onClick={() => setView(id)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition ${
                active ? "bg-white/[0.07] font-medium text-white"
                  : "font-normal text-[#8A7F79] hover:bg-white/[0.04] hover:text-slate-200"}`}>
              <Icon size={18} strokeWidth={1.75} className={active ? "text-[#F0714E]" : ""} />
              {label}
            </button>
          );
        })}
      </nav>

      <div className="px-4 pb-5">
        <button className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-white/[0.04]">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-[13px] font-semibold text-slate-200">
            EU
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm font-semibold text-white">Executive User</div>
            <div className="truncate text-[11px] text-[#8A7F79]">Klarna workspace</div>
          </div>
          <ChevronDown size={16} strokeWidth={1.75} className="shrink-0 text-[#8A7F79]" />
        </button>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------
   Header + filter bar
   ------------------------------------------------------------------ */

function TopHeader({ query, setQuery }) {
  return (
    <header className="sticky top-0 z-[70] isolate border-b border-[#DED9D5]/85 bg-[#FFFDFC]/84 shadow-[0_1px_0_rgba(23,32,51,0.025)] backdrop-blur-xl backdrop-saturate-150 supports-[backdrop-filter]:bg-[#FFFDFC]/78">
      <div className="flex items-center gap-5 px-8 py-3.5">
        {/* Sidebar-free product identity. Kept intentionally compact: this is
            application chrome, not a second marketing header. */}
        <div className="flex shrink-0 items-center gap-2.5 pr-1">
          <span className="relative block h-5 w-7" aria-hidden="true">
            <span className="absolute left-0 top-[9px] h-[2px] w-7 rounded-full bg-[#172033]" />
            <span className="absolute left-[9px] top-[4px] h-2.5 w-2.5 rounded-full border-2 border-[#F0714E] bg-white" />
          </span>
          <span className="text-[15px] font-semibold tracking-[-0.01em] text-[#172033]">Throughline</span>
        </div>
        <div className="h-6 w-px shrink-0 bg-slate-200" />
        <CompanySwitcher compact />
        <div className="h-6 w-px shrink-0 bg-slate-200" />

        <div className="relative w-full max-w-md">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A7F79]" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search reviews..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-[#172033] placeholder:text-[#8A7F79] focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/5" />
        </div>
        <button className="hidden items-center gap-2 text-sm font-medium text-[#4B403C] transition hover:text-[#172033] md:inline-flex">
          <SlidersHorizontal size={16} strokeWidth={2} />Filters
        </button>
        <div className="ml-auto flex items-center gap-2.5">
          <div className="h-6 w-px bg-slate-200" />
          <GhostIcon icon={Bell} dot label="Notifications" />
        </div>
      </div>
    </header>
  );
}

function FilterBar({ store, setStore, sentiment, setSentiment, showSentiment = true, right }) {
  return (
    <div className="flex flex-wrap items-center gap-4 border-b border-slate-200 bg-white px-8 py-3.5">
      <SourceSelector store={store} setStore={setStore} />

      {showSentiment && <div className="flex items-center gap-2">
        {SENTIMENTS.map((s) => {
          const on = sentiment === s.id;
          return (
            <button key={s.id} onClick={() => setSentiment(on ? "all" : s.id)}
              className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium shadow outline-none transition hover:-translate-y-px hover:shadow-md focus-visible:ring-2 focus-visible:ring-offset-1 ${
                on ? `${s.active} shadow-md ${s.ring}` : `${s.tint} shadow-slate-900/5 ${s.ring}`}`}>
              <span className={`h-2 w-2 rounded-full ${on ? "bg-white" : s.dot}`} />
              {s.label}
            </button>
          );
        })}
      </div>}

      {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------
   Dashboard pieces
   ------------------------------------------------------------------ */

/* Compact validation chips that sit inline on the filter row. The plain-
   English conclusion leads on hover; the statistics stay in the tooltip.
   Deliberately neutral (slate) — an earlier green treatment read as a
   sentiment signal ("good news") rather than "this finding is validated". */
/* Quiet validation reassurance for the header: a single muted line, not a
   badge or chip cluster. The plain reading stays visible; the underlying
   statistics live in the hover tooltip (and in Methodology) so they don't
   compete with the company name, source selector, or counts. */
function ValidatedChips({ slice }) {
  const o = slice.omnibus, v = slice.validation;
  const strength = v.testable ? correlationStrength(v.spearman_rho) : null;
  const parts = [];
  if (o && o.testable) parts.push("Significant theme differences");
  if (v.testable) parts.push(`${strength} rating alignment`);
  if (!parts.length) return null;
  const tip = (
    <>
      {o && o.testable && (
        <>Theme sentiment differs across the experience — <span className="font-mono text-slate-300">{o.test}={o.h_statistic.toFixed(1)}, p&lt;0.001</span><br /></>
      )}
      {v.testable && (
        <>Model sentiment aligns with star ratings — <span className="font-mono text-slate-300">&rho;={v.spearman_rho.toFixed(2)}, n={v.n}</span></>
      )}
    </>
  );
  return (
    <HoverTip tip={tip}>
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] leading-none text-[#8A7F79]">
        <span className="font-medium text-[#8A7F79]">Validation:</span>
        <span>{parts.join(" · ")}</span>
        <Info size={12} strokeWidth={2} className="shrink-0 text-slate-300" />
      </span>
    </HoverTip>
  );
}

function LimitationsDrawer() {
  const { DATA } = useAppData();
  const analysis = DATA?.scopes?.all || {};
  const validation = analysis.validation || {};
  const omnibus = analysis.omnibus || {};
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} aria-expanded={open}
        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
          open ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-[#4B403C] hover:text-[#172033]"}`}>
        <Info size={14} strokeWidth={2} />
        Methodology &amp; validation
        <ChevronDown size={13} strokeWidth={2.5} className={`transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <Card className="absolute right-0 top-9 z-50 w-[360px] p-5 shadow-[0_18px_48px_rgba(23,32,51,.16)]">
          <div className="text-sm font-bold text-[#172033]">Methodology &amp; validation</div>
          <div className="mt-3 space-y-2 border-y border-[#EEE8E4] py-3 text-[12px] text-[#4B403C]">
            <div className="flex items-center justify-between"><span>Theme differences</span><strong className={omnibus.testable ? "text-emerald-700" : "text-[#8A7F79]"}>{omnibus.testable ? "Significant" : "Not testable"}</strong></div>
            <div className="flex items-center justify-between"><span>Rating alignment</span><strong className={validation.testable ? "text-emerald-700" : "text-[#8A7F79]"}>{validation.testable ? correlationStrength(validation.spearman_rho) : "Not testable"}</strong></div>
            {validation.testable && <div className="font-mono text-[11px] text-[#8A7F79]">ρ {Number(validation.spearman_rho).toFixed(2)} · n={validation.n}</div>}
          </div>
          <div className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-[#8A7F79]">Limitations</div>
          <ul className="space-y-2.5">
            {DATA.caveats.map((c) => (
              <li key={c} className="flex gap-2.5 text-[13px] leading-relaxed text-[#4B403C]">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-300" />{c}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/* Every card gets one line of context beneath the number — the brief line
   between "here is a figure" and "here is what the figure means" — without
   turning a KPI card into a chart of its own. */
function AnimatedKpiValue({ value }) {
  const [display, setDisplay] = useState(value);
  const reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (reduce || value === null || value === undefined) { setDisplay(value); return undefined; }
    const raw = String(value);
    const match = raw.match(/[−-]?\d+(?:\.\d+)?/);
    if (!match) { setDisplay(value); return undefined; }
    const token = match[0];
    const target = Number(token.replace("−", "-"));
    if (!Number.isFinite(target)) { setDisplay(value); return undefined; }
    const decimals = (token.split(".")[1] || "").length;
    const prefix = raw.slice(0, match.index);
    const suffix = raw.slice((match.index || 0) + token.length);
    const started = performance.now();
    const duration = 720;
    let raf = 0;
    const render = (now) => {
      const p = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const current = target * eased;
      const abs = Math.abs(current).toFixed(decimals);
      const signed = current < 0 ? `−${abs}` : abs;
      setDisplay(`${prefix}${signed}${suffix}`);
      if (p < 1) raf = requestAnimationFrame(render);
      else setDisplay(value);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [value, reduce]);

  return <span className="tl-kpi-value-resolve">{display}</span>;
}

function KpiRow({ slice, store }) {
  const { DATA } = useAppData();
  const k = slice.kpis;
  // Cross-store split is only meaningful on the combined tab; on a
  // single-store tab it would just restate the number sitting right above it.
  const platforms = store === "all" ? DATA.platform : null;
  // The store with the lowest NSS, so "weaker on X" names a real platform
  // rather than a guess. Only used when we're on the combined scope.
  const weakest = platforms && platforms.length > 1
    ? platforms.reduce((lo, p) => ((p.nss ?? 0) < (lo.nss ?? 0) ? p : lo))
    : null;
  const weeks = slice.weekly || [];
  const latest = weeks[weeks.length - 1] || {};
  const previous = weeks[weeks.length - 2] || {};
  const delta = (a, b, digits = 1) => a == null || b == null ? null : Number((Number(a) - Number(b)).toFixed(digits));
  const ratingDelta = delta(latest.avgRating, previous.avgRating, 2);
  const sentimentDelta = delta(latest.nss, previous.nss, 1);
  const direction = (value, unit) => Number(latest.nReviews || 0) < 5 || Number(previous.nReviews || 0) < 5 ? "Directional only · sparse week" : value == null ? "No prior-week comparison" : `${value > 0 ? "↑" : value < 0 ? "↓" : "→"} ${Math.abs(value).toFixed(unit === "★" ? 2 : 1)}${unit} vs previous week`;
  const cards = [
    {
      label: "Avg star rating", icon: Star,
      value: k.avgRating === null ? "—" : k.avgRating.toFixed(2),
      tone: ratingTone(k.avgRating),
      note: direction(ratingDelta, "★"), tip: "Average published star rating for reviews in the selected evidence window.",
    },
    {
      label: "Net sentiment", icon: Smile,
      value: k.nss === null ? "—" : fmt(k.nss, 1),
      tone: nssTone(k.nss),
      note: direction(sentimentDelta, " pts"), tip: "Net Sentiment Score: positive phrases minus negative phrases as a percentage of scored phrases.",
    },
    {
      label: "Total reviews", icon: MessageSquare,
      value: k.nReviews,
      tone: "neutral",
      note: latest.nReviews == null ? `${k.nPhrases} scored phrases` : `${latest.nReviews} in the latest week`, tip: "Unique reviews in the selected source and evidence window.",
    },
    {
      // rho is a correlation coefficient, not an "agreement rate" — the two
      // are easy to conflate but answer different questions.
      // ArrowLeftRight mirrors the "↔" in the label and, unlike TrendingUp,
      // doesn't imply a time trend the data doesn't have.
      label: "Analysis confidence", icon: ArrowLeftRight,
      value: k.agreement === null ? "Not testable" : correlationStrength(k.agreement),
      tone: correlationTone(k.agreement),
      note: k.agreement === null ? "Not testable at this sample size" : `ρ ${k.agreement} · n=${k.agreementN || k.nReviews}`,
      tip: "Spearman correlation between model sentiment and published star ratings.", confidence: true,
    },
  ];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ label, value, note, tone, icon: Icon, tip, confidence }) => (
        <Card key={label} className={`tl-kpi-card tl-kpi-${tone} px-4 py-3`} title={tip}>
          <div className="flex items-start justify-between">
            <span className={EYEBROW} style={{ color: INK2 }}>{label}</span>
            <Icon size={21} strokeWidth={1.8} style={{ color: INK3 }} />
          </div>
          <div className={`mt-1.5 font-sans text-[26px] font-bold tracking-tight tabular-nums ${KPI_TONE[tone] || KPI_TONE.neutral}`}><AnimatedKpiValue value={value} /></div>
          <div className="mt-1 flex min-h-7 items-end justify-between gap-2"><div className="tl-kpi-note rounded-full px-2 py-1 text-[11px] font-medium" style={{ color: INK2 }}>{note}</div>{confidence && <LimitationsDrawer />}</div>
        </Card>
      ))}
    </div>
  );
}

function WeeklyPulse({ weeks = [], activeWeek, onSelectWeek }) {
  const [focus, setFocus] = useState("sentiment");
  const [hoveredWeek, setHoveredWeek] = useState(null);
  if (!weeks.length) return null;
  const width = 1040, top = 34, bottom = 235, left = 68, right = 1000;
  const maxReviews = Math.max(1, ...weeks.map((w) => Number(w.nReviews) || 0));
  const baseConfig = {
    sentiment: { label: "Net sentiment", color: "#E85D4A", value: (w) => w.nss, floor: -100, ceiling: 100, format: (v) => fmt(v, 1) },
    rating: { label: "Average rating", color: "#172033", value: (w) => w.avgRating, floor: 1, ceiling: 5, format: (v) => `${Number(v).toFixed(2)}★` },
    reviews: { label: "Review volume", color: "#5B7C91", value: (w) => w.nReviews, floor: 0, ceiling: maxReviews, format: (v) => `${v} reviews` },
  }[focus];
  const validWeeks = weeks.map((week, originalIndex) => ({ week, originalIndex, value: baseConfig.value(week) })).filter((row) => row.value != null);
  const values = validWeeks.map((row) => Number(row.value));
  const observedMin = Math.min(...values), observedMax = Math.max(...values);
  const spread = Math.max(focus === "rating" ? .35 : focus === "reviews" ? 2 : 18, observedMax - observedMin);
  let domainMin = observedMin - spread * .28, domainMax = observedMax + spread * .28;
  if (focus === "sentiment") { domainMin = Math.min(domainMin, 0); domainMax = Math.max(domainMax, 0); }
  if (focus === "reviews") domainMin = 0;
  domainMin = Math.max(baseConfig.floor, domainMin); domainMax = Math.min(baseConfig.ceiling, domainMax);
  if (domainMax <= domainMin) domainMax = domainMin + 1;
  const config = { ...baseConfig, min: domainMin, max: domainMax };
  const xs = validWeeks.map((_, i) => left + ((right - left) * i) / Math.max(1, validWeeks.length - 1));
  const y = (value) => bottom - ((Number(value) - config.min) / Math.max(1, config.max - config.min)) * (bottom - top);
  const points = validWeeks.map((row, i) => ({ x: xs[i], y: y(row.value), value: row.value, week: row.week, originalIndex: row.originalIndex }));
  const linePath = points.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");
  const areaPath = linePath ? `${linePath} L${points[points.length - 1].x},${bottom} L${points[0].x},${bottom} Z` : "";
  const shifts = weeks.slice(1).map((w, i) => ({ index: i + 1, delta: w.nss == null || weeks[i].nss == null ? 0 : Number(w.nss) - Number(weeks[i].nss) }));
  const reversal = shifts.sort((a,b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
  const active = activeWeek == null ? validWeeks[validWeeks.length - 1]?.originalIndex : activeWeek;
  const sparse = validWeeks.length < 4;
  const latestPoint = points[points.length - 1];
  const previousPoint = points[points.length - 2];
  const latestDelta = latestPoint && previousPoint ? Number(latestPoint.value) - Number(previousPoint.value) : null;
  const hoveredPoint = points.find((p) => p.originalIndex === hoveredWeek);
  const hoverX = hoveredPoint ? Math.max(10, Math.min(width - 252, hoveredPoint.x - 121)) : 0;
  const hoverAbove = hoveredPoint ? hoveredPoint.y >= 88 : true;
  const hoverY = hoveredPoint ? (hoverAbove ? hoveredPoint.y - 68 : hoveredPoint.y + 13) : 0;
  const hoverCaretX = hoveredPoint ? Math.max(12, Math.min(230, hoveredPoint.x - hoverX)) : 0;
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-[#EEE9E5] px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-[14px] font-bold" style={{ color: INK }}>Weekly pulse</h2><span className="text-xs" style={{ color: INK3 }}>{sparse ? `${validWeeks.length === 1 ? "Only one week contains" : `Only ${validWeeks.length} weeks contain`} enough evidence. Treat this as an early directional signal.` : "Select a week to inspect what changed in themes and customer evidence."}</span></div>{sparse && <HoverTip tip="More weekly periods are needed before this movement can be treated as an established trend."><span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700">Limited evidence · {validWeeks.length} week{validWeeks.length === 1 ? "" : "s"}</span></HoverTip>}</div>
      </div>
      <div className="relative px-5 pb-3 pt-3">
        <div className="tl-chart-overlay">
          <div className="tl-chart-controls" role="group" aria-label="Chart measure"><span>Measure</span><div>{[["sentiment","Sentiment"],["rating","Rating"],["reviews","Review volume"]].map(([id,label]) => <button key={id} onClick={() => setFocus(id)} aria-pressed={focus===id} className={focus===id ? "is-active" : ""}>{label}</button>)}</div></div>
          {sparse && latestPoint && <div className="tl-latest-movement"><span>{previousPoint ? "Latest movement" : "Latest week"}</span><strong>{previousPoint ? `${config.format(previousPoint.value)} → ` : ""}{config.format(latestPoint.value)}</strong><small>{latestDelta == null ? `${latestPoint.week.nReviews} reviews · no prior week to compare` : `${latestDelta > 0 ? "Improved" : latestDelta < 0 ? "Declined" : "Unchanged"} ${Math.abs(latestDelta).toFixed(focus === "rating" ? 2 : 1)}${focus === "sentiment" ? " points" : ""} · ${latestPoint.week.nReviews} reviews`}</small></div>}
        </div>
        <svg viewBox={`0 0 ${width} 285`} className={`${sparse ? "mt-12 h-[230px]" : "mt-12 h-[260px]"} w-full overflow-visible`} role="img" aria-label={`${config.label} across weekly periods`}>
          <defs><linearGradient id={`weekly-area-${focus}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={config.color} stopOpacity=".16"/><stop offset="1" stopColor={config.color} stopOpacity="0"/></linearGradient></defs>
          {[top, (top+bottom)/2, bottom].map((gy) => <line key={gy} x1={left} x2={right} y1={gy} y2={gy} stroke="#E8E1DD" />)}
          <text x="16" y="19" fill="#8A7F79" fontSize="10" fontWeight="600">{config.label}</text>
          {focus === "sentiment" && domainMin <= 0 && domainMax >= 0 && <><line x1={left} x2={right} y1={y(0)} y2={y(0)} stroke="#CFC5BF" strokeDasharray="4 5"/><text x="45" y={y(0)+4} fill="#9A8F89" fontSize="9">0</text></>}
          {points.map((p) => <rect key={`volume-${p.week.start}`} x={p.x-38} y={bottom-(Number(p.week.nReviews||0)/maxReviews)*92} width="76" height={(Number(p.week.nReviews||0)/maxReviews)*92} rx="7" fill="#D9E0E7" opacity=".28" className="tl-week-volume" />)}
          {(hoveredPoint || (activeWeek != null && points.find((p)=>p.originalIndex===activeWeek))) && (() => { const hp = hoveredPoint || points.find((p)=>p.originalIndex===activeWeek); return <rect x={Math.max(left-42,hp.x-70)} y="18" width="140" height="245" rx="10" fill="#F6F1EE" opacity={hoveredPoint ? ".82" : ".58"} />; })()}
          {!sparse && areaPath && <path key={`area-${focus}`} d={areaPath} fill={`url(#weekly-area-${focus})`} className="tl-week-area" />}
          {validWeeks.length > 1 && linePath && <path key={focus} d={linePath} fill="none" stroke={config.color} strokeWidth={sparse ? "3.5" : "3"} strokeLinecap="round" strokeLinejoin="round" className="tl-week-rating-line" />}
          {points.map((p) => <g key={`${focus}-${p.week.start}`} className="cursor-pointer" onMouseEnter={() => setHoveredWeek(p.originalIndex)} onMouseLeave={() => setHoveredWeek(null)} onFocus={() => setHoveredWeek(p.originalIndex)} onBlur={() => setHoveredWeek(null)} onClick={() => onSelectWeek?.(activeWeek === p.originalIndex ? null : p.originalIndex)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelectWeek?.(activeWeek === p.originalIndex ? null : p.originalIndex); } }} role="button" tabIndex="0" aria-label={`${p.week.label}: ${p.week.nReviews} reviews, ${p.week.avgRating ?? "no rating"} stars, net sentiment ${p.week.nss ?? "unavailable"}`}>
            <rect x={p.x-90} y="14" width="180" height="265" fill="transparent" />
            <circle cx={p.x} cy={p.y} r={active === p.originalIndex ? 7 : 5.5} fill="#FFFDFC" stroke={config.color} strokeWidth={active === p.originalIndex ? 3 : 2} className="tl-week-point" />
            <text x={p.x} y={Math.max(18,p.y-12)} textAnchor="middle" fill="#172033" fontSize="10" fontWeight="700">{config.format(p.value)}</text>
            <text x={p.x} y="275" textAnchor="middle" fill={active === p.originalIndex ? "#172033" : "#7F746E"} fontSize="12" fontWeight={active === p.originalIndex ? "700" : "600"}>{p.week.label}</text>
          </g>)}
          {hoveredPoint && <g className="tl-chart-tooltip" pointerEvents="none" transform={`translate(${hoverX} ${hoverY})`}>
            <polygon points={hoverAbove ? `${hoverCaretX-6},57 ${hoverCaretX+6},57 ${hoverCaretX},66` : `${hoverCaretX-6},1 ${hoverCaretX+6},1 ${hoverCaretX},-8`} fill="#172033" />
            <rect width="242" height="58" rx="7" fill="#172033" />
            <text x="13" y="20" fill="#FFFDFC" fontSize="11" fontWeight="700">{hoveredPoint.week.label}</text>
            <text x="13" y="41" fill="#DCE2EA" fontSize="10.5">{hoveredPoint.week.nReviews} reviews</text>
            <text x="91" y="41" fill="#DCE2EA" fontSize="10.5">{hoveredPoint.week.avgRating == null ? "Rating —" : `${Number(hoveredPoint.week.avgRating).toFixed(2)}★`}</text>
            <text x="170" y="41" fill="#DCE2EA" fontSize="10.5">{hoveredPoint.week.nss == null ? "NSS —" : `NSS ${fmt(hoveredPoint.week.nss, 1)}`}</text>
          </g>}
          {!sparse && focus === "sentiment" && reversal && Math.abs(reversal.delta) >= 35 && points.find((p)=>p.originalIndex===reversal.index) && (() => { const rx = points.find((p)=>p.originalIndex===reversal.index).x; return <g className="tl-shift-callout"><rect x={Math.min(870,Math.max(75,rx-64))} y="3" width="128" height="20" rx="10" fill="#FFF1EC"/><text x={Math.min(934,Math.max(139,rx))} y="17" textAnchor="middle" fill="#B74C35" fontSize="9.5" fontWeight="700">Sharp sentiment shift</text></g>; })()}
        </svg>
        {activeWeek != null && <div className="flex items-center justify-between border-t border-[#EEE9E5] px-2 py-2 text-xs"><span className="font-semibold text-[#172033]">Filtering the dashboard to {weeks[activeWeek].label}</span><button onClick={() => onSelectWeek?.(null)} className="font-semibold text-[#C85D42] hover:underline">Clear week filter</button></div>}
      </div>
    </Card>
  );
}

/* ---- Throughline emotion system — single source of truth ----------------
   The 9-emotion taxonomy. Each entry has a fixed label, a fixed emoji (NOT a
   Lucide glyph — the emotion layer is deliberately separate from functional
   chrome) and a fixed, restrained hex colour reused everywhere. Never hardcode
   emotion emoji or colours in a component; always read them through
   emotionOf(). The P/N/N sentiment summary keeps its own simpler palette
   (VALENCE_*) and is intentionally NOT part of this map. */
const emotionMap = {
  delight:        { label: "Delight",        emoji: "😊", color: "#2FAE72" },
  frustration:    { label: "Frustration",    emoji: "😤", color: "#F39A2E" },
  anger:          { label: "Anger",          emoji: "😡", color: "#D94A4A" },
  disappointment: { label: "Disappointment", emoji: "😞", color: "#E2765B" },
  indifference:   { label: "Indifference",   emoji: "😐", color: "#9AA2AC" },
  trust:          { label: "Trust",          emoji: "🙂", color: "#5BAF95" },
  confusion:      { label: "Confusion",      emoji: "😕", color: "#8A73C9" },
  relief:         { label: "Relief",         emoji: "😌", color: "#74B8D8" },
  anxiety:        { label: "Anxiety",        emoji: "😟", color: "#EF7C86" },
};
const EMOTION_FALLBACK = { label: "Mixed", emoji: "💬", color: "#9AA2AC" };
/* Case-insensitive, always returns a valid entry — no component ever renders
   an undefined emoji or colour for an unknown/unclassified value. */
const emotionOf = (e) => (e && emotionMap[String(e).toLowerCase()]) || EMOTION_FALLBACK;
/* Faint tint of an emotion colour, for backgrounds like the quote box. */
const emotionTint = (hex, a = 0.1) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

/* Contextual evidence layer for the matrix. The active topic (default: the
   top pain point's theme, else whatever row the user selects) decides which
   reviews it cycles through — never across topics. Quotes rotate calmly,
   pause on hover, and delay after manual navigation. The customer's words
   and the system's interpretation are visually separated. */
function CustomerVoice({ slice, reviewsById, topicName, isDefault }) {
  const theme = slice.themes.find((t) => t.theme === topicName) || null;
  const items = useMemo(() => {
    if (!theme) return [];
    const rows = (theme.verbatimIds || []).map((id) => reviewsById[id]).filter(Boolean);
    const substantive = rows.filter((r) => (r.text || "").length >= 40);
    // Lead with the strongest example of the topic's OWN prevailing sentiment:
    // a negative topic opens on its most negative review (its top pain point),
    // a positive topic on its most positive — representative, not always worst.
    const dir = (theme.sentiment ?? 0) < 0 ? 1 : -1;
    return (substantive.length ? substantive : rows)
      .slice().sort((a, b) => dir * ((a.score ?? 0) - (b.score ?? 0))).slice(0, 6);
  }, [theme, reviewsById]);

  const [idx, setIdx] = useState(0);
  const [fading, setFading] = useState(false);
  const [hover, setHover] = useState(false);
  const [manualPaused, setManualPaused] = useState(false);
  const [quoteExpanded, setQuoteExpanded] = useState(false);
  const [analysisExpanded, setAnalysisExpanded] = useState(false);
  const reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  // The 400ms fade-out swap is tracked so it can never be orphaned. Any
  // interruption (hover, topic change, unmount) clears it and snaps back to
  // fully visible — so the panel can never come to rest at opacity-0.
  const swapTimer = useRef(null);
  const clearSwap = () => { if (swapTimer.current) { clearTimeout(swapTimer.current); swapTimer.current = null; } };

  useEffect(() => { setIdx(0); setFading(false); setManualPaused(false); setQuoteExpanded(false); setAnalysisExpanded(false); clearSwap(); }, [topicName]);
  useEffect(() => {
    if (reduce || hover || manualPaused || items.length < 2) return;
    const id = setInterval(() => {
      setFading(true);
      clearSwap();
      swapTimer.current = setTimeout(() => { setQuoteExpanded(false); setAnalysisExpanded(false); setIdx((v) => (v + 1) % items.length); setFading(false); }, 400);
    }, 7000);
    // Cleanup runs on any deps change (hover, manual nav, topic): stop the
    // clock, drop the pending swap, and reset opacity so nothing sits faded.
    return () => { clearInterval(id); clearSwap(); setFading(false); };
    // manualTick in deps: each manual nav restarts the 7s clock (delays auto-rotate).
  }, [reduce, hover, manualPaused, items.length, topicName]);

  if (!theme || !items.length) {
    return (
      <Card className="grid h-full place-items-center p-8 text-center">
        <div>
          <MessageSquare size={24} className="mx-auto text-slate-300" strokeWidth={1.75} />
          <div className="mt-3 text-sm font-semibold text-[#172033]">No customer quotes</div>
          <p className="mt-1 text-xs" style={{ color: INK2 }}>This topic has no readable reviews to show.</p>
        </div>
      </Card>
    );
  }

  const i = Math.min(idx, items.length - 1);
  const r = items[i];
  const v = valenceOf(r.score);
  const em = emotionOf(r.primaryEmotion);
  const nav = (dir) => {
    setManualPaused(true);
    setQuoteExpanded(false);
    setAnalysisExpanded(false);
    if (reduce) { setIdx((val) => (val + dir + items.length) % items.length); return; }
    setFading(true);
    clearSwap();
    swapTimer.current = setTimeout(() => { setIdx((val) => (val + dir + items.length) % items.length); setFading(false); }, 220);
  };

  return (
    <Card surface="bg-[#FCF5EE]" className="tl-voice-card relative flex h-[540px] min-h-[540px] flex-col overflow-hidden"
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <CardMotif variant="voice" className="-bottom-14 -right-12 w-52" />
      {/* Thin top accent recolours per quote with the dominant emotion — the
          "accent changes with the quote" signal, without tinting the whole card. */}
      <div className="h-1 w-full transition-colors duration-500" style={{ backgroundColor: em.color }} />

      <div className="relative flex flex-1 flex-col p-5">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-2">
          <div><span className="text-xs font-semibold uppercase tracking-wider" style={{ color: INK2 }}>Customer Voice</span><div className="mt-1 text-[11px]" style={{ color: INK3 }}>Evidence for {theme.theme}</div></div>
          {isDefault && (
            <span className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2 py-0.5 text-[10px] font-semibold text-white">
              <AlertTriangle size={10} strokeWidth={2.5} />Top pain point
            </span>
          )}
        </div>

        {/* Everything that changes per quote lives in this fade group; the
            oversized emoji sits behind it (absolute to the Card) and
            cross-fades with it. Header above and footer below stay stable. */}
        <div className={`tl-voice-swap relative grid min-h-0 flex-1 grid-rows-[auto_auto_190px_116px] transition-opacity duration-500 ${fading ? "is-fading opacity-0" : "is-visible opacity-100"}`}>
          {/* Oversized editorial emoji: large, cropped, faint, pushed to the
              bottom-right so it never sits under the quote text. */}
          <div className="pointer-events-none absolute -bottom-5 -right-3 select-none text-[110px] leading-none opacity-[0.07] transition-all duration-500"
            aria-hidden="true">{em.emoji}</div>

          <div className="relative mt-3 flex flex-wrap items-center gap-2">
            <span title={theme.theme} className={`rounded-md border px-2.5 py-1 text-[11px] font-medium ${
              v === "neg" ? "border-red-200 bg-red-50 text-red-700"
                : v === "pos" ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"}`}>{hashtag(theme.theme)}</span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-[#4B403C]">
              <SourceMark source={r.source} className="h-3.5 w-3.5" />{r.sourceLabel}
            </span>
          </div>

          <div className="relative mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <Stars rating={r.rating} size={16} alert={v === "neg"} />
            {r.score != null && <span className="font-sans text-[11px] tabular-nums" style={{ color: INK2 }}>score {fmt(r.score)}</span>}
            {r.primaryEmotion && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: em.color }}>
                <span aria-hidden="true">{em.emoji}</span>{em.label}
              </span>
            )}
          </div>

          {/* The quote is the hero: larger, roomier, in a speech box tinted
              with the review's own emotion colour and a matching left edge. */}
          <div className="relative mt-4 min-h-0 rounded-xl border border-[#E5DAD4] border-l-[3px] bg-white px-4 py-3 shadow-[0_5px_18px_rgba(23,32,51,.04)]" style={{ borderLeftColor: em.color }}>
            <blockquote className={`h-[132px] pr-1 text-[15px] font-medium not-italic leading-[1.55] ${quoteExpanded ? "overflow-y-auto" : "overflow-hidden"}`} style={{ color: INK }}>
              <span className="mr-0.5 text-2xl leading-none" style={{ color: em.color }}>“</span>
              <span style={quoteExpanded ? undefined : { display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{r.text}</span>”
            </blockquote>
            {r.text.length > 220 && (
              <button type="button" onClick={() => setQuoteExpanded((v) => !v)} className="mt-1 text-[11px] font-semibold underline decoration-[#C7B8B0] underline-offset-2" style={{ color: INK2 }}>
                {quoteExpanded ? "Show less" : "Read full review"}
              </button>
            )}
          </div>

          {theme.summary && (
            <div className="relative mt-3 min-h-0 rounded-lg border-l-2 border-[#CFC3BC] bg-white/85 py-2.5 pl-3 pr-3">
              <div className="text-[10px] font-semibold tracking-wide" style={{ color: INK2 }}>Why this matters · Throughline analysis</div>
              <div className={`mt-1 h-[64px] pr-1 text-[12.5px] leading-[1.45] ${analysisExpanded ? "overflow-y-auto" : "overflow-hidden"}`} style={{ color: INK2 }}>
                <p style={analysisExpanded ? undefined : { display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {theme.summary}
                  {theme.impact != null && theme.impactReliable && theme.impact < 0 && (
                    <> Reviews mentioning this theme are estimated to score <span className="font-semibold" style={{ color: INK }}>{Math.abs(theme.impact).toFixed(2)} stars lower</span> than otherwise comparable reviews.</>
                  )}
                </p>
              </div>
              {(theme.summary.length > 150) && (
                <button type="button" onClick={() => setAnalysisExpanded((v) => !v)} className="mt-0.5 text-[10.5px] font-semibold underline decoration-[#C7B8B0] underline-offset-2" style={{ color: INK2 }}>
                  {analysisExpanded ? "Show less" : "More analysis"}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="relative z-10 mt-4 flex shrink-0 items-center justify-center border-t border-[#E7DDD7] pt-4">
          <div className="flex items-center gap-3">
            <button onClick={() => nav(-1)} aria-label="Previous review"
              disabled={items.length < 2} className="grid h-9 w-9 place-items-center rounded-full border border-[#D8CEC8] bg-white text-[#4B403C] transition hover:border-[#F0714E] hover:text-[#172033] disabled:opacity-40">
              <ChevronLeft size={17} strokeWidth={2} />
            </button>
            <span className="min-w-[52px] text-center text-xs font-semibold tabular-nums" style={{ color: INK2 }}>{i + 1} of {items.length}</span>
            <button onClick={() => nav(1)} aria-label="Next review"
              disabled={items.length < 2} className="grid h-9 w-9 place-items-center rounded-full border border-[#D8CEC8] bg-white text-[#4B403C] transition hover:border-[#F0714E] hover:text-[#172033] disabled:opacity-40">
              <ChevronRight size={17} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function ThemeRow({ t, reviewsById, active = false, onSelect }) {
  const [open, setOpen] = useState(false);
  const muted = t.priority === "Low evidence";
  const toggle = () => {
    // Selecting a row makes it the active context for the Customer Voice
    // panel, whether or not it's expanded — one click both drills in here and
    // updates the evidence panel. Deliberately NO scrollIntoView: the row
    // expands in place and the viewport stays exactly where the user left it.
    onSelect?.(t.theme);
    setOpen((v) => !v);
  };
  const evidence = useMemo(() => {
    const rows = (t.verbatimIds || []).map((id) => reviewsById[id]).filter(Boolean);
    // Alternate stores so a theme spanning both shows both.
    const by = {};
    rows.forEach((r) => { (by[r.source] = by[r.source] || []).push(r); });
    const lists = Object.values(by), out = [];
    for (let i = 0; out.length < rows.length; i++) {
      let any = false;
      for (const l of lists) if (l[i]) { out.push(l[i]); any = true; }
      if (!any) break;
    }
    return out.slice(0, 5);
  }, [t, reviewsById]);

  return (
    <>
      <tr onClick={toggle}
        className={`cursor-pointer border-b transition ${
          open ? "border-slate-200 bg-slate-100"
            : active ? "border-slate-100 bg-slate-50"
            : muted ? "border-slate-100 bg-slate-50/40 hover:bg-slate-50/70"
            : "border-slate-100 hover:bg-slate-50/70"}`}>
        <td className="relative py-4 pl-5 pr-2 align-middle">
          {/* Neutral slate accent (not purple). A heavier bar + darker chevron
              when open makes the expanding state unmistakable. */}
          {(active || open) && <span className={`absolute inset-y-0 left-0 ${open ? "w-1" : "w-[3px]"} bg-slate-900`} />}
          <ChevronRight size={16} strokeWidth={2.5}
            className={`transition-transform ${active || open ? "text-[#4B403C]" : "text-[#8A7F79]"} ${open ? "rotate-90" : ""}`} />
        </td>
        <td className="py-4 pr-4 align-middle">
          <div className="text-sm leading-snug" style={{ color: muted ? INK3 : INK, fontWeight: (active || open) ? 700 : 600 }}>{t.theme}</div>
          {muted && <div className="mt-0.5 font-sans text-[10px]" style={{ color: INK3 }}><span className="font-mono">n={t.volume}</span> · not enough data to act on</div>}
        </td>
        <td className="py-4 pr-4 text-right align-middle font-sans text-xs tabular-nums" style={{ color: muted ? INK3 : INK2 }}>{t.volume}</td>
        <td className="py-4 pr-4 align-middle"><ImpactBar value={t.impact} ratedN={t.impactRatedN} /></td>
        <td className="py-4 pr-8 align-middle">
          <SentimentGauge mean={t.sentiment} ci={t.ci95} dist={t.distribution} nSentences={t.nSentences} />
        </td>
        <td className="py-4 pl-5 pr-4 align-middle">
          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${PRIORITY_STYLE[t.priority] || PRIORITY_STYLE.Monitor}`}>
            {t.priority}
          </span>
        </td>
      </tr>

      {open && (
        <tr className="border-b border-slate-200 bg-slate-100/70">
          {/* Continuous left accent ties the expanded panel to its row above,
              so the block clearly reads as one expanded unit. */}
          <td className="relative"><span className="absolute inset-y-0 left-0 w-1 bg-slate-900" /></td>
          <td colSpan={5} className="px-2 py-5 pr-6">
            <div className={EYEBROW}>{valenceOf(t.sentiment) === "pos" ? "What's working" : valenceOf(t.sentiment) === "neg" ? "What's going wrong" : "What we're hearing"}</div>
            <p className="mt-1.5 max-w-3xl text-sm leading-relaxed" style={{ color: INK2 }}>{t.summary}</p>

            <div className="mt-5">
              <div className={EYEBROW}>Why we believe this</div>
              <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 border-y border-slate-200/80 py-3 text-[12px] sm:grid-cols-3 lg:grid-cols-5">
                <div><dt style={{ color: INK3 }}>Significance</dt><dd className="mt-0.5 font-semibold" style={{ color: t.significant ? "#167A55" : INK2 }}>{t.significant ? "Significant" : "Not significant"}</dd></div>
                {t.effect && <div><dt style={{ color: INK3 }}>Effect</dt><dd className="mt-0.5 font-semibold" style={{ color: INK }}>{cap(t.effect)}</dd></div>}
                {t.ci95 && <div><dt style={{ color: INK3 }}>95% CI</dt><dd className="mt-0.5 font-mono font-semibold" style={{ color: INK2 }}>{fmt(t.ci95[0])} to {fmt(t.ci95[1])}</dd></div>}
                {t.nSentences ? <div><dt style={{ color: INK3 }}>Evidence</dt><dd className="mt-0.5 font-semibold" style={{ color: INK }}>{t.nSentences} phrases</dd></div> : null}
                {t.confidence && <div><dt style={{ color: INK3 }}>Confidence</dt><dd className="mt-0.5 font-semibold" style={{ color: INK }}>{cap(t.confidence)}</dd></div>}
                {(t.impact === null || !t.impactReliable) && <div className="col-span-2 sm:col-span-3 lg:col-span-5"><dt style={{ color: INK3 }}>Rating impact</dt><dd className="mt-0.5 font-semibold text-amber-700">Not reliable · {t.impactRatedN || 0} rated reviews</dd></div>}
              </dl>
              {t.distribution && (t.distribution.positive + t.distribution.neutral + t.distribution.negative) > 0 && (
                <div className="mt-3 max-w-md">
                  <div className="mb-1.5 flex items-baseline justify-between font-sans text-[11px] tabular-nums" style={{ color: INK2 }}>
                    <span>Sentiment composition</span>
                    <span>{t.distribution.positive} positive · {t.distribution.neutral} neutral · {t.distribution.negative} negative</span>
                  </div>
                  <DistributionBar dist={t.distribution} />
                </div>
              )}
            </div>

            <div className="mt-5">
              <div className={EYEBROW} style={{ color: INK2 }}>Who's affected</div>
              {t.sourceConcentration ? (
                <p className="mt-1.5 max-w-3xl text-sm leading-relaxed" style={{ color: INK2 }}>
                  <span className="font-semibold" style={{ color: INK }}>
                    {t.sourceConcentration.count} of {t.sourceConcentration.total} affected reviews
                  </span>{" "}
                  come from {t.sourceConcentration.label} — well above its overall share of the dataset.
                </p>
              ) : (
                <p className="mt-1.5 max-w-3xl text-sm leading-relaxed" style={{ color: INK2 }}>
                  No platform concentrates unusually here — mentions roughly track each store's overall share.
                </p>
              )}
              <div className="mt-3 grid gap-2.5">
                {evidence.map((r) => {
                  const v = valenceOf(r.score);
                  return (
                    <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-3.5">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <Stars rating={r.rating} size={13} />
                        <span className="inline-flex items-center gap-1.5 font-sans text-[11px]" style={{ color: INK2 }}>
                          <SourceMark source={r.source} className="h-3.5 w-3.5" />{r.sourceLabel}
                        </span>
                        <span className="font-sans text-[11px] text-[#8A7F79]">{r.date}</span>
                        {r.version && <span className="font-sans text-[11px] tabular-nums text-[#8A7F79]">v{r.version}</span>}
                        <span className={`ml-auto rounded-full px-2 py-0.5 font-sans text-[11px] font-semibold tabular-nums ${
                          v === "pos" ? "bg-emerald-50 text-emerald-700"
                            : v === "neg" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                          {fmt(r.score)}
                        </span>
                      </div>
                      <p className="mt-2 text-[13px] leading-relaxed" style={{ color: INK2 }}>{r.text}</p>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 font-sans text-[11px] tabular-nums" style={{ color: INK3 }}>
                Showing {evidence.length} of {(t.verbatimIds || []).length} reviews
              </div>
            </div>

            {t.action && (
              <div className="mt-5">
                <div className={EYEBROW}>What to do next</div>
                <div className="mt-2 max-w-3xl rounded-r-lg border-l-[3px] border-slate-900 bg-white py-3 pl-4 pr-4">
                  <div className="text-sm leading-relaxed text-[#2F2926]">{t.action}</div>
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function ThemeMatrix({ slice, reviewsById, activeTopic, onSelectTopic }) {
  const [sentiment, setSentiment] = useState("all");
  const [showLowVolume, setShowLowVolume] = useState(false);
  const [showUnclassified, setShowUnclassified] = useState(false);
  const filtered = slice.themes.filter((t) =>
    sentiment === "all" || valenceOf(t.sentiment) === sentiment);
  // Grouping follows the same priority field the Action column renders —
  // one source of truth (export_app_data.py's priority_state) rather than
  // a volume threshold re-derived here that could silently drift from it.
  const primary = filtered.filter((t) => t.priority !== "Low evidence");
  const lowVolume = filtered.filter((t) => t.priority === "Low evidence");

  return (
    <Card className="flex h-[540px] min-h-[540px] flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-4">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-[15px] font-bold" style={{ color: INK }}>Theme Priorities</h2>
          <HoverTip tip="Themes are ranked by estimated rating impact, evidence volume and sentiment. Select a row to inspect its reviews."><button type="button" aria-label="How themes are ranked" className="grid h-6 w-6 place-items-center rounded-full text-[#8A7F79] hover:bg-[#F5F0ED] hover:text-[#172033]"><Info size={14} /></button></HoverTip>
          <span className="text-[11px] font-medium" style={{ color: INK3 }}>{slice.themes.length} ranked themes</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={() => setSentiment("all")}
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium shadow outline-none transition hover:-translate-y-px hover:shadow-md focus-visible:ring-2 focus-visible:ring-offset-1 ${
              sentiment === "all"
                ? "border-slate-900 bg-slate-900 text-white shadow-md focus-visible:ring-slate-900"
                : "border-slate-200 bg-white text-[#4B403C] shadow-slate-900/5 hover:bg-slate-50 focus-visible:ring-slate-400"}`}>
            All
          </button>
          {SENTIMENTS.map((x) => {
            const on = sentiment === x.id;
            return (
              <button key={x.id} onClick={() => setSentiment(x.id)}
                className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium shadow outline-none transition hover:-translate-y-px hover:shadow-md focus-visible:ring-2 focus-visible:ring-offset-1 ${
                  on ? `${x.active} shadow-md ${x.ring}` : `${x.tint} shadow-slate-900/5 ${x.ring}`}`}>
                {x.label}
              </button>
            );
          })}
          <span className="ml-1 whitespace-nowrap font-sans text-[11px] tabular-nums" style={{ color: INK3 }}>
            {filtered.length} of {slice.themes.length} topics
          </span>
        </div>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden">
      <div className="h-full overflow-auto">
        <table className="w-full table-fixed">
          <colgroup>
            <col style={{ width: "42px" }} />
            <col />
            <col style={{ width: "78px" }} />
            <col style={{ width: "112px" }} />
            <col style={{ width: "34%" }} />
            <col style={{ width: "136px" }} />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="border-y border-slate-100 bg-slate-50/60">
              <th />
              {["Theme", "Volume", "Rating Impact", "Sentiment mix", "Action"].map((h, i) => (
                <th key={h} style={{ color: INK2 }}
                  className={`py-2.5 font-sans text-xs font-semibold uppercase tracking-wider ${
                  i === 1 ? "pr-4 text-right" : i === 2 ? "pr-5 text-left" : i === 4 ? "pl-5 text-left" : "pr-4 text-left"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-10 text-center">
                <p className="text-sm text-[#8A7F79]">No topics are net {VALENCE_LABEL[sentiment]?.toLowerCase()}.</p>
                <button onClick={() => setSentiment("all")}
                  className="mt-2 text-sm font-medium text-[#172033] underline underline-offset-2">
                  Show all topics
                </button>
              </td></tr>
            )}
            {primary.map((t) => (
              <ThemeRow key={t.theme} t={t} reviewsById={reviewsById}
                active={t.theme === activeTopic} onSelect={onSelectTopic} />
            ))}
            {lowVolume.length > 0 && (
              <>
                <tr onClick={() => setShowLowVolume(!showLowVolume)}
                  className="cursor-pointer border-b border-slate-100 bg-slate-50/70 transition hover:bg-slate-100/70">
                  <td className="py-2.5 pl-5">
                    <ChevronRight size={14} strokeWidth={2.5}
                      className={`text-[#8A7F79] transition-transform ${showLowVolume ? "rotate-90" : ""}`} />
                  </td>
                  <td colSpan={5} className="py-2.5 pr-5 font-sans text-[11px]" style={{ color: INK2 }}>
                    {lowVolume.length} low-evidence topic{lowVolume.length > 1 ? "s" : ""} — too few mentions to act on with confidence
                  </td>
                </tr>
                {showLowVolume && lowVolume.map((t) => (
                  <ThemeRow key={t.theme} t={t} reviewsById={reviewsById}
                    active={t.theme === activeTopic} onSelect={onSelectTopic} />
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>
      </div>
      {slice.untagged && slice.untagged.count > 0 && (
        <div className="border-t border-slate-100 bg-[#FAF8F6] px-5 py-3">
          <div className="flex items-center gap-3">
            <Info size={14} className="shrink-0 text-[#8A7F79]" strokeWidth={2} />
            <p className="min-w-0 text-[12px] leading-relaxed" style={{ color: INK2 }}>
              <span className="font-semibold" style={{ color: INK }}>{slice.untagged.count} reviews could not be assigned to a specific theme.</span>
              <span className="ml-1">They remain in totals and evidence coverage.</span>
            </p>
            {slice.untagged.examples?.length > 0 && <button type="button" onClick={() => setShowUnclassified((v) => !v)} className="ml-auto shrink-0 text-[11px] font-semibold text-[#A14A42] underline-offset-2 hover:underline" aria-expanded={showUnclassified}>{showUnclassified ? "Hide examples" : "Review unclassified feedback"}</button>}
          </div>
          {showUnclassified && slice.untagged.examples?.length > 0 && <div className="mt-2 grid gap-1.5 border-l-2 border-[#D9CBC4] pl-4">
            {slice.untagged.examples.slice(0, 3).map((e, i) => <p key={i} className="truncate text-[11px] italic text-[#6F625C]">“{e}”</p>)}
          </div>}
        </div>
      )}
    </Card>
  );
}

/* Display-only tightening of a finding's supporting clause: drop the trailing
   editorial aside (after an em-dash or "meaning/so/worth …") so the list reads
   lighter. The underlying finding text is untouched. */
function humanizeFindingImpact(text) {
  if (!text) return text;
  let s = String(text)
    .replace(/\*\*/g, "")
    .replace(/__+/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const number = (raw) => Number(String(raw).replace("−", "-"));
  const starsPhrase = (raw) => {
    const value = number(raw);
    if (!Number.isFinite(value)) return null;
    const magnitude = Math.abs(value).toFixed(2);
    if (value < 0) return `associated with ratings ${magnitude} stars lower than otherwise comparable reviews`;
    if (value > 0) return `associated with ratings ${magnitude} stars higher than otherwise comparable reviews`;
    return "associated with no measurable rating difference versus otherwise comparable reviews";
  };

  // Translate every rating-impact form generated by the analysis pipeline into
  // one consistent, human-readable sentence fragment.
  s = s.replace(/([+−-]?\d+\.\d+)\s*★?\s*rating\s+impact/gi, (m, n) => starsPhrase(n) || m);
  s = s.replace(/rating\s+impact(?:\s+of\s+any\s+theme)?\s*\(?\s*([+−-]?\d+\.\d+)\s*★?\s*\)?/gi, (m, n) => starsPhrase(n) || m);
  s = s.replace(/([+−-]?\d+\.\d+)\s*★?\s*impact\b/gi, (m, n) => starsPhrase(n) || m);
  s = s.replace(/\bimpact\s*([+−-]?\d+\.\d+)\s*★?/gi, (m, n) => starsPhrase(n) || m);
  // Some generated summaries emit a bare signed star value after another
  // theme's impact; in a findings paragraph that value is still rating impact.
  s = s.replace(/([+−-]\d+\.\d+)\s*★/g, (m, n) => starsPhrase(n) || m);

  // Keep supporting analytical numbers readable and consistent across brands.
  s = s.replace(/\bsentiment\s+([+−-]?\d+\.\d+)/gi, (m, n) => {
    const v = number(n); return Number.isFinite(v) ? `sentiment ${v.toFixed(2)}` : m;
  });
  // Narrative cards never need 3+ decimal precision. Round any remaining
  // decimal values after the semantic replacements above so company-specific
  // source copy cannot leak debug-like precision back into the UI.
  s = s.replace(/([+−-]?\d+\.\d{3,})/g, (m, n) => {
    const v = number(n); return Number.isFinite(v) ? v.toFixed(2) : m;
  });
  return s;
}
function trimFinding(rest) {
  let s = rest;
  const cuts = [" — ", " – ", ", meaning ", ", so ", ", worth "];
  let idx = -1;
  for (const c of cuts) { const i = s.indexOf(c); if (i >= 0 && (idx < 0 || i < idx)) idx = i; }
  if (idx >= 0) s = s.slice(0, idx);
  s = s.trim().replace(/[,;:]$/, "");
  if (s && !/[.!?]$/.test(s)) s += ".";
  return s;
}

/* Key Findings — the primary narrative anchor. The single strongest
   conclusion is promoted to an executive takeaway; the supporting findings
   sit below as ranked editorial rows (lead clause emphasised, hairline
   separators, a quiet rank figure) rather than bullets, badges or cards. */
function scopeHeadline(slice, fallback) {
  const reliable = (slice?.themes || []).filter((t) => t.impactReliable && t.impact != null);
  const worst = reliable.filter((t) => t.impact < 0).sort((a, b) => a.impact - b.impact)[0];
  if (!worst) return fallback || "No single negative theme dominates this view.";
  return `${worst.theme} is the single largest fixable drag on the rating.`;
}

function insightChapter(slice, DATA, NARR) {
  // Preferred path: Anthropic writes one coordinated insight-to-action chapter
  // from the structured evidence payload. This is intentionally a single object
  // so "What we found" and "What to do next" cannot drift apart.
  if (NARR?.insightChapter?.headline) return NARR.insightChapter;

  // Deterministic fallback: preserves the same information architecture when
  // Anthropic is unavailable. It interprets only fields already computed by the
  // pipeline and never invents causes or interventions.
  const themes = (slice?.themes || []).filter((t) => t.priority !== "Low evidence");
  const reliable = themes.filter((t) => t.impactReliable && t.impact != null);
  const negatives = reliable.filter((t) => t.impact < 0).sort((a, b) => a.impact - b.impact);
  const positives = reliable.filter((t) => t.impact > 0).sort((a, b) => b.impact - a.impact);
  const primary = negatives[0];
  const secondary = negatives[1];
  const strength = positives[0];
  const impact = (t) => t ? `${t.impact < 0 ? "−" : "+"}${Math.abs(t.impact).toFixed(2)}★` : null;
  const evidence = (t) => t ? `${t.volume} mentions · ${impact(t)} estimated ${t.impact < 0 ? "drag" : "lift"}` : null;

  let headline = scopeHeadline(slice, DATA.headline);
  if (primary && secondary) {
    headline = `${primary.theme} is the clearest risk — and ${secondary.theme.toLowerCase()} compounds it.`;
  }
  const findings = [];
  if (primary) findings.push({
    label: "Biggest risk",
    title: `${primary.theme} is the strongest negative driver`,
    evidence: evidence(primary),
    interpretation: `It combines meaningful volume with the largest estimated rating drag in this view.`
  });
  if (secondary) findings.push({
    label: "What compounds it",
    title: `${secondary.theme} adds a second source of friction`,
    evidence: evidence(secondary),
    interpretation: secondary.sourceConcentration
      ? `The signal is also disproportionately concentrated on ${secondary.sourceConcentration.label}.`
      : `It is material enough to address alongside the primary issue rather than treating it as background noise.`
  });
  if (strength) findings.push({
    label: "What to protect",
    title: `${strength.theme} remains an experience asset`,
    evidence: evidence(strength),
    interpretation: `The strongest positive driver shows there is existing customer value worth protecting while friction is removed.`
  });

  let implication = "Focus the next intervention on the strongest negative driver, while protecting the experience elements already associated with higher ratings.";
  if (primary && strength) {
    implication = `The opportunity is to remove friction around ${primary.theme.toLowerCase()} without weakening ${strength.theme.toLowerCase()}, which is already associated with stronger ratings.`;
  }
  return { headline, findings: findings.slice(0, 3), implication };
}

function signedFindingEvidence(value) {
  if (!value) return value;
  // Anthropic may phrase evidence without an explicit sign. The card already
  // explains drag vs lift, so make direction glanceable without adding jargon.
  return String(value)
    .replace(/(^|[·\s])(\d+(?:\.\d+)?)★(?=\s+estimated\s+drag\b)/i, "$1−$2★")
    .replace(/(^|[·\s])(\d+(?:\.\d+)?)★(?=\s+estimated\s+lift\b)/i, "$1+$2★");
}

function KeyFindings({ slice }) {
  const { DATA, NARR } = useAppData();
  const chapter = insightChapter(slice, DATA, NARR);
  return (
    <Card surface="bg-[#F3E9E5]" className="tl-story-card tl-story-findings relative flex h-full flex-col overflow-hidden border-[#C9BBB4] p-6 sm:p-8">
      <CardMotif variant="findings" className="-right-12 -top-14 w-60 rotate-180" />
      <div className="relative z-10 flex h-full flex-col">
        <div>
          <div className="flex items-start justify-between gap-4"><h2 className="text-[17px] font-bold tracking-tight" style={{ color: INK }}>What we found</h2><InsightPeriodStamp /></div>
          <p className="mt-4 max-w-4xl text-balance text-[22px] font-bold leading-[1.28] tracking-tight sm:text-[26px]" style={{ color: INK }}>
            {chapter.headline}
          </p>
        </div>

        <div className="mt-6 border-t border-[#D8CBC5]">
          {(chapter.findings || []).map((row, i) => (
            <div key={i} className="grid grid-cols-[5.25rem_1fr] gap-3 border-b border-[#D8CBC5] py-3.5">
              <div className="pt-0.5 text-[10.5px] font-bold uppercase tracking-[0.08em]" style={{ color: i === 0 ? "#C94747" : INK3 }}>
                {row.label || `Insight ${String(i + 1).padStart(2, "0")}`}
              </div>
              <div>
                <div className="text-[13.5px] font-semibold leading-snug" style={{ color: INK }}>{row.title}</div>
                {row.evidence && <div className="mt-1 text-[11.5px] font-medium tabular-nums" style={{ color: INK3 }}>{signedFindingEvidence(row.evidence)}</div>}
                {row.interpretation && <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: INK2 }}>{row.interpretation}</p>}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-auto pt-5">
          <div className="rounded-lg border border-[#D2C2BB] bg-white/55 px-4 py-3.5">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.09em]" style={{ color: "#A14A42" }}>The implication</div>
            <p className="mt-1.5 text-[13px] font-medium leading-relaxed" style={{ color: INK }}>{chapter.implication}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* Platform & Emotion — the evidence layer. Two questions, answered fast:
   where is the problem concentrated (platform split) and what emotional
   response is driving it (emotion mix). Each half leads with a one-line,
   data-derived takeaway. */
function PlatformEmotion({ slice }) {
  const { DATA, NARR } = useAppData();
  const total = slice.emotions.reduce((a, e) => a + e.count, 0) || 1;
  const top = Math.max(...slice.emotions.map((e) => e.count), 1);
  const maxVol = Math.max(...DATA.platform.map((p) => p.nReviews), 1);
  const metrics = [
    { key: "meanSentiment", label: "Net sentiment", min: -1, max: 1, zero: true, fmt: (v) => fmt(v) },
    { key: "avgRating", label: "Avg rating", min: 1, max: 5, fmt: (v) => (v == null ? "—" : v.toFixed(2)) },
    { key: "pctNegative", label: "Negative ratio", min: 0, max: 100, fmt: (v) => `${Math.round(v)}%` },
    { key: "nReviews", label: "Review volume", min: 0, max: maxVol, fmt: (v) => v },
  ];
  const PLAT_COLOR = { google_play: "#172033", app_store: "#A99C94" };
  const platColor = (id) => PLAT_COLOR[id] || "#756A64";
  const posOf = (v, m) => Math.max(0, Math.min(100, ((v - m.min) / (m.max - m.min)) * 100));
  const platforms = DATA.platform.slice(0, 2);
  const vs = slice.valenceSplit;
  const comp = [
    { key: "pos", label: "Positive", color: "#2FAE72" },
    { key: "neu", label: "Neutral", color: "#E9A23B" },
    { key: "neg", label: "Negative", color: "#E55353" },
  ];

  return (
    <Card surface="bg-[#EEF4F1]" className="flex h-full flex-col overflow-hidden">
      <div className="px-6 py-5">
        <h2 className="text-[17px] font-bold tracking-tight" style={{ color: INK }}>Why we reached these conclusions</h2>
      </div>

      <div className="border-t border-[#D6E0DC] px-6 py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="text-[13px] font-semibold" style={{ color: INK }}>Overall sentiment composition</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {comp.map((c) => (
              <span key={c.key} className="inline-flex items-center gap-1.5 text-[11.5px]" style={{ color: INK2 }}>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                {c.label} <span className="tabular-nums">{(vs[c.key] || 0).toFixed(1)}%</span>
              </span>
            ))}
          </div>
        </div>
        <div className="mt-2.5 flex h-2.5 w-full overflow-hidden rounded-full bg-white/40">
          {comp.map((c, idx) => <div key={c.key} className="tl-native-bar tl-stacked-segment" style={{ width: `${vs[c.key] || 0}%`, backgroundColor: c.color, "--tl-delay": `${idx * 90}ms` }} />)}
        </div>
      </div>

      <div className="grid grid-cols-1 border-t border-[#D6E0DC] xl:grid-cols-2">
        <div className="min-w-0 px-5 py-5 xl:border-r xl:border-[#D6E0DC]">
          <div className="text-[14px] font-semibold leading-snug" style={{ color: INK }}>{NARR.platformHeadline || platformInsight(DATA.platform) || "Platform comparison"}</div>
          {platforms.length >= 2 ? (
            <div className="mt-4 min-w-0">
              <div className="min-w-0">
                <div className="grid grid-cols-[72px_minmax(68px,1fr)_64px_64px] items-end gap-x-2 border-b border-[#D6E0DC] pb-2">
                  <span className="text-[10.5px] font-semibold" style={{ color: INK3 }}>Metric</span>
                  <span />
                  {platforms.map((p) => (
                    <span key={p.id} className="inline-flex min-w-0 items-center justify-end gap-1 text-right text-[9.5px] font-semibold leading-tight" style={{ color: INK2 }}>
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: platColor(p.id) }} />
                      <span className="truncate">{p.label}</span>
                    </span>
                  ))}
                </div>
                <div className="divide-y divide-[#E3E9E6]">
                  {metrics.map((m) => {
                    const positions = platforms.map((p) => posOf(p[m.key], m));
                    const lo = Math.min(...positions), hi = Math.max(...positions);
                    return (
                      <div key={m.key} className="grid grid-cols-[72px_minmax(68px,1fr)_64px_64px] items-center gap-x-2 py-2.5">
                        <span className="text-[12px] font-medium" style={{ color: INK2 }}>{m.label}</span>
                        <div className="relative h-6 min-w-0">
                          <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-black/10" />
                          {m.zero && <div className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-[#BEB3AD]" style={{ left: `${posOf(0, m)}%` }} />}
                          <div className="tl-platform-bridge absolute top-1/2 h-[2px] -translate-y-1/2 rounded bg-[#BEB3AD]" style={{ left: `${lo}%`, width: `${Math.max(2, hi - lo)}%` }} />
                          {platforms.map((p) => (
                            <div key={p.id} title={`${p.label}: ${m.fmt(p[m.key])}`} className="tl-platform-dot absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-[#EEF4F1]" style={{ left: `${posOf(p[m.key], m)}%`, backgroundColor: platColor(p.id) }} />
                          ))}
                        </div>
                        <span className="text-right font-sans text-[12px] font-semibold tabular-nums" style={{ color: INK }}>{m.fmt(platforms[0]?.[m.key])}</span>
                        <span className="text-right font-sans text-[12px] tabular-nums" style={{ color: INK2 }}>{m.fmt(platforms[1]?.[m.key])}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-[12.5px]" style={{ color: INK2 }}>Only one platform is available in this view, so there is nothing to compare.</p>
          )}
        </div>

        <div className="min-w-0 px-5 py-5">
          <div className="text-[13px] font-semibold" style={{ color: INK }}>Emotion breakdown <span className="font-normal" style={{ color: INK3 }}>(overall)</span></div>
          <div className="mt-3 space-y-1.5">
            {[...slice.emotions].sort((a, b) => b.count - a.count).map((e, idx) => {
              const em = emotionOf(e.label);
              const dominant = idx < 3;
              const pct = total ? Math.round((e.count / total) * 100) : 0;
              return (
                <div key={e.label} className="grid grid-cols-[104px_minmax(80px,1fr)_34px_34px] items-center gap-x-2.5">
                  <span className={`flex min-w-0 items-center gap-1.5 ${dominant ? "text-[13px] font-semibold" : "text-xs"}`} style={{ color: dominant ? INK : INK2 }}>
                    <span aria-hidden="true" className="text-[13px] leading-none">{em.emoji}</span><span className="truncate">{em.label}</span>
                  </span>
                  <div className={`overflow-hidden rounded-full bg-black/[0.05] ${dominant ? "h-2.5" : "h-1.5"}`}>
                    <div className="tl-native-bar h-full rounded-full" style={{ width: `${(e.count / top) * 100}%`, backgroundColor: em.color, opacity: dominant ? 1 : 0.55, "--tl-delay": `${idx * 65}ms` }} />
                  </div>
                  <span className="text-right font-sans text-xs tabular-nums" style={{ color: dominant ? INK : INK2, fontWeight: dominant ? 600 : 400 }}>{e.count}</span>
                  <span className="text-right font-sans text-[11px] tabular-nums" style={{ color: INK2 }}>{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {(NARR.emotionTakeaway || emotionInsight(slice.emotions)) && (
        <div className="mt-auto border-t border-[#D6E0DC] px-6 py-4 text-[12.5px] leading-relaxed" style={{ color: INK2 }}>
          <span className="font-semibold" style={{ color: INK }}>What this means:</span> {NARR.emotionTakeaway || emotionInsight(slice.emotions)}
        </div>
      )}
    </Card>
  );
}

/* Validation — reframed around one question: does the model agree with
   customers? The conclusion leads; the scatter is the proof; the two
   mismatches are made prominent and inspectable because they carry the real
   product message (Throughline can surface nuance a star rating hides). The
   Spearman statistic and sample size are kept, demoted to a footer.
   Points are joined to their reviews so a mismatch can show its own text. */
function ValidationPlot({ slice, reviews, onViewDetail }) {
  const { NARR } = useAppData();
  const { pts, mismatches, nConsistent } = classifyValidation(reviews);
  const total = pts.length || 1;
  const v = slice.validation;
  const strength = v.testable ? correlationStrength(v.spearman_rho) : null;
  const verdict = !v.testable
    ? { head: "Not testable here", tone: "text-[#8A7F79]" }
    : strength === "Strong" ? { head: "Yes — strongly.", tone: "text-emerald-700" }
    : strength === "Moderate" ? { head: "Broadly, yes.", tone: "text-amber-600" }
    : { head: "Not reliably.", tone: "text-red-600" };

  return (
    <Card surface="bg-[#F3F6F1]" className="relative flex h-full flex-col overflow-hidden">
      <CardMotif variant="trust" className="-bottom-12 -right-12 w-52" />
      {/* Hierarchy: statement → ratio → consistent vs contradict → correlation. */}
      <div className="relative flex flex-1 flex-col px-6 py-5">
        <h2 className="text-[17px] font-bold tracking-tight" style={{ color: INK }}>Can we trust the analysis?</h2>
        <div className={`mt-2 text-[22px] font-bold tracking-tight ${verdict.tone}`}>{NARR.trustStatement || verdict.head}</div>
        <p className="mt-1 max-w-md text-[13px] leading-relaxed" style={{ color: INK2 }}>
          {NARR.trustExplanation || `Written sentiment matches the star rating's direction in ${nConsistent} of ${pts.length} reviews.`}
        </p>

        <div className="mt-5 flex items-baseline gap-1">
          <span className="text-[40px] font-bold leading-none tracking-tight" style={{ color: INK }}>{nConsistent}</span>
          <span className="text-[20px] font-semibold leading-none" style={{ color: INK3 }}>/ {pts.length}</span>
        </div>
        <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-black/[0.06]">
          <div style={{ width: `${(nConsistent / total) * 100}%`, backgroundColor: "#2FAE72" }} />
          <div style={{ width: `${(mismatches.length / total) * 100}%`, backgroundColor: "#E55353" }} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1.5 text-[13px]">
          <span className="inline-flex items-center gap-2" style={{ color: INK2 }}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#2FAE72" }} />
            <span className="font-semibold" style={{ color: INK }}>{nConsistent}</span> directionally consistent
          </span>
          <span className="inline-flex items-center gap-2" style={{ color: INK2 }}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#E55353" }} />
            <span className="font-semibold" style={{ color: INK }}>{mismatches.length}</span> contradict
          </span>
        </div>

        {v.testable && (
          <div className="mt-3 text-[12px]" style={{ color: INK2 }}>
            <span className="font-mono">ρ {v.spearman_rho.toFixed(2)}</span> · {strength} correlation · <span style={{ color: INK3 }}>n {v.n}</span>
          </div>
        )}

        <button onClick={onViewDetail}
          className="mt-auto inline-flex w-fit items-center gap-1.5 pt-4 text-[13px] font-semibold" style={{ color: CORAL }}>
          View detailed validation <ArrowRight size={15} strokeWidth={2} />
        </button>
      </div>
    </Card>
  );
}

/* In-place analytical drill-down from the trust card. Renders across the full
   content width (Evidence card collapses behind it): the trust summary stays
   at the top, then a divider, then the detailed scatter. Same
   classifyValidation() as the trust card, so counts reconcile by construction. */
function ValidationExpanded({ slice, reviews, onBack }) {
  const { NARR } = useAppData();
  const { pts, mismatches, nConsistent } = classifyValidation(reviews);
  const total = pts.length || 1;
  const v = slice.validation;
  const strength = v.testable ? correlationStrength(v.spearman_rho) : null;
  const verdict = !v.testable
    ? { head: "Not testable here", tone: "text-[#8A7F79]" }
    : strength === "Strong" ? { head: "Yes — strongly.", tone: "text-emerald-700" }
    : strength === "Moderate" ? { head: "Broadly, yes.", tone: "text-amber-600" }
    : { head: "Not reliably.", tone: "text-red-600" };
  // Wider viewBox for the full-width row; scales to container via w-full.
  const W = 900, H = 300, ml = 52, mr = 24, mt = 18, mb = 56;
  const iw = W - ml - mr, ih = H - mt - mb;
  const x = (s) => ml + ((s + 1) / 2) * iw;
  const y = (r) => mt + ih - ((r - 1) / 4) * ih;
  const xMid = x(0), xR = W - mr;
  const rnd = (n) => { const t = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return t - Math.floor(t); };
  const jx = (i) => (rnd(i * 2 + 1) - 0.5) * (iw * 0.02);
  const jy = (i) => (rnd(i * 2 + 2) - 0.5) * (ih * 0.11);
  const misOffset = (i) => ({ dx: i % 2 === 0 ? -9 : 9, dy: i % 2 === 0 ? -11 : 11 });
  const whyDiffers = (p) => p.r >= 4
    ? `Rated ${p.r}★ — a high rating — but the written sentiment is negative (${fmt(p.s)}), so rating and text contradict.`
    : `Rated ${p.r}★ — a low rating — but the written sentiment is positive (${fmt(p.s)}), so rating and text contradict.`;
  const [selected, setSelected] = useState(null);
  const [hovered, setHovered] = useState(null);
  const active = hovered || selected;
  useEffect(() => {
    const clearHover = () => setHovered(null);
    window.addEventListener("scroll", clearHover, { passive: true });
    return () => window.removeEventListener("scroll", clearHover);
  }, []);

  return (
    <Card surface="bg-[#F3F6F1]" className="p-6">
      {/* Trust summary stays at the top */}
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
        <div className="max-w-md">
          <h2 className="text-[17px] font-bold tracking-tight" style={{ color: INK }}>Can we trust the analysis?</h2>
          <div className={`mt-1.5 text-[20px] font-bold tracking-tight ${verdict.tone}`}>{NARR.trustStatement || verdict.head}</div>
          <p className="mt-1 text-[13px] leading-relaxed" style={{ color: INK2 }}>
            {NARR.trustExplanation || `Written sentiment matches the star rating's direction in ${nConsistent} of ${pts.length} reviews.`}
          </p>
        </div>
        <div className="w-full max-w-xs">
          <div className="flex items-baseline gap-1">
            <span className="text-[28px] font-bold leading-none tracking-tight" style={{ color: INK }}>{nConsistent}</span>
            <span className="text-[16px] font-semibold leading-none" style={{ color: INK3 }}>/ {pts.length}</span>
          </div>
          <div className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full bg-black/[0.06]">
            <div style={{ width: `${(nConsistent / total) * 100}%`, backgroundColor: "#2FAE72" }} />
            <div style={{ width: `${(mismatches.length / total) * 100}%`, backgroundColor: "#E55353" }} />
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px]">
            <span className="inline-flex items-center gap-1.5" style={{ color: INK2 }}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#2FAE72" }} /><span className="font-semibold" style={{ color: INK }}>{nConsistent}</span> consistent
            </span>
            <span className="inline-flex items-center gap-1.5" style={{ color: INK2 }}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#E55353" }} /><span className="font-semibold" style={{ color: INK }}>{mismatches.length}</span> contradict
            </span>
          </div>
          {v.testable && (
            <div className="mt-2 text-[12px]" style={{ color: INK2 }}>
              <span className="font-mono">ρ {v.spearman_rho.toFixed(2)}</span> · {strength} correlation · <span style={{ color: INK3 }}>n {v.n}</span>
            </div>
          )}
        </div>
      </div>

      {/* divider between summary and its evidence */}
      <div className="my-5 border-t border-[#DCE6E2]" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[15px] font-bold tracking-tight" style={{ color: INK }}>Detailed validation — rating vs written sentiment</h3>
        <button onClick={onBack} className="inline-flex items-center gap-1 text-[12px] font-medium hover:opacity-80" style={{ color: INK2 }}>
          <ChevronLeft size={14} strokeWidth={2} />Back to summary
        </button>
      </div>
      <p className="mt-1.5 max-w-3xl text-[12.5px] leading-relaxed" style={{ color: INK2 }}>
        Each dot is one review — modeled written sentiment (x) against its published star rating (y). {mismatches.length} of {pts.length} contradict their rating: a high rating (4–5★) that reads negative, or a low rating (1–2★) that reads positive. The rest are directionally consistent.
      </p>

      <div className="mt-4 rounded-lg border border-[#DFE7DD] bg-white p-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img"
          aria-label={`Scatter of ${pts.length} reviews: modeled written sentiment against star rating; ${mismatches.length} contradict`}>
          {[1, 2, 3, 4, 5].map((r) => (
            <g key={r}>
              <line x1={ml} x2={xR} y1={y(r)} y2={y(r)} stroke="#eef2f6" strokeWidth="1" />
              <text x={ml - 9} y={y(r) + 3} textAnchor="end" fill={INK3} style={{ fontSize: 9 }}>{r}★</text>
            </g>
          ))}
          {/* de-emphasised zero-sentiment reference */}
          <line x1={xMid} x2={xMid} y1={mt} y2={mt + ih} stroke="#d5dbe3" strokeWidth="1" strokeDasharray="2 3" />
          {/* subtle numeric X anchors */}
          {[-1, 0, 1].map((s) => (
            <text key={s} x={x(s)} y={mt + ih + 15} textAnchor="middle" fill={INK3} style={{ fontSize: 9 }}>{s > 0 ? "+1" : s < 0 ? "−1" : "0"}</text>
          ))}

          {pts.filter((p) => !p.mismatch).map((p, i) => (
            <circle key={`a${i}`} cx={(x(p.s) + jx(i)).toFixed(1)} cy={(y(p.r) + jy(i)).toFixed(1)} r="3.6"
              fill="#94A3B8" fillOpacity="0.85" stroke="white" strokeWidth="0.75">
              <title>{p.r}★ · sentiment {fmt(p.s)} — directionally consistent</title>
            </circle>
          ))}
          {/* Contradiction points: no permanent labels — values appear on
              hover/click in the detail below to keep the chart calm. */}
          {mismatches.map((p, i) => {
            const off = misOffset(i);
            const cx = x(p.s) + off.dx, cy = y(p.r) + off.dy;
            const on = active === p;
            return (
              <g key={`m${i}`} className="cursor-pointer"
                onClick={() => setSelected(selected === p ? null : p)}
                onMouseEnter={() => setHovered(p)} onMouseLeave={() => setHovered(null)}>
                {on && <circle cx={cx.toFixed(1)} cy={cy.toFixed(1)} r="12" fill="none" stroke="#ef4444" strokeOpacity="0.4" strokeWidth="1.5" />}
                <circle cx={cx.toFixed(1)} cy={cy.toFixed(1)} r="6.5" fill="#ef4444" stroke="white" strokeWidth="1.75">
                  <title>{p.r}★ · sentiment {fmt(p.s)} ({p.sourceLabel}) — contradicts; click for detail</title>
                </circle>
              </g>
            );
          })}

          <text x={ml + iw / 2} y={H - 8} textAnchor="middle" fill={INK2} style={{ fontSize: 9.5 }}>Modeled written sentiment (negative → positive)</text>
          <text x={-(mt + ih / 2)} y={13} transform="rotate(-90)" textAnchor="middle" fill={INK2} style={{ fontSize: 9.5 }}>Star rating</text>
        </svg>
      </div>

      <div className="mt-4">
        {selected ? (
          <div className="rounded-lg border border-red-200 bg-red-50/40 p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Stars rating={selected.r} size={13} />
              <span className="font-mono text-[12px]" style={{ color: INK2 }}>sentiment {fmt(selected.s)}</span>
              <span className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: INK2 }}>
                <SourceMark source={selected.source} className="h-3.5 w-3.5" />{selected.sourceLabel}
              </span>
              {selected && (
                <button onClick={() => { setSelected(null); setHovered(null); }}
                  className="ml-auto text-[12px] font-medium" style={{ color: INK3 }}>Clear</button>
              )}
            </div>
            <p className="mt-2 text-[13px] italic leading-relaxed" style={{ color: INK }}>
              “{selected.text.length > 180 ? selected.text.slice(0, 180).trimEnd() + "…" : selected.text}”
            </p>
            <p className="mt-2.5 text-[12px] font-semibold" style={{ color: INK2 }}>Why this review contradicts its rating</p>
            <p className="mt-0.5 text-[12px] leading-relaxed" style={{ color: INK2 }}>{whyDiffers(selected)}</p>
          </div>
        ) : (
          <p className="text-[12px] leading-relaxed" style={{ color: INK3 }}>
            Hover to highlight a contradiction; click it to open the review details.
          </p>
        )}
      </div>
    </Card>
  );
}

/* Real collected date range for the current scope, not a decorative
   "Date Range" control — the header button isn't wired to a real filter, so
   this is the honest version of "what period is this". Formatted compactly:
   "Aug 27–30, 2026" when the span sits inside one month, else fuller. */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function dateRangeOf(reviews) {
  const dates = reviews.map((r) => r.date).filter(Boolean).sort();
  if (!dates.length) return null;
  const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return { y, m: m - 1, d }; };
  const a = parse(dates[0]), b = parse(dates[dates.length - 1]);
  const one = (p) => `${MONTHS[p.m]} ${p.d}, ${p.y}`;
  if (dates[0] === dates[dates.length - 1]) return one(a);
  if (a.y === b.y && a.m === b.m) return `${MONTHS[a.m]} ${a.d}–${b.d}, ${a.y}`;
  if (a.y === b.y) return `${MONTHS[a.m]} ${a.d} – ${MONTHS[b.m]} ${b.d}, ${a.y}`;
  return `${one(a)} – ${one(b)}`;
}

/* Editorial provenance for generated material. It is intentionally a quiet
   margin note rather than a pill or decorative watermark: the period is part
   of the meaning of an insight, not a status badge. */
function InsightPeriodStamp() {
  const { DATA } = useAppData();
  const reviews = DATA?.reviews || [];
  const range = dateRangeOf(reviews);
  const count = DATA?.scopes?.all?.kpis?.nReviews ?? reviews.length;
  if (!range) return null;
  return (
    <div className="tl-evidence-stamp" title="Evidence used when these insights were generated">
      <span>Evidence period</span>
      <strong>{range}</strong>
      <small>All sources · {count} reviews</small>
    </div>
  );
}

/* Synthesizes the whole run into 3-4 prioritized actions. Every entry comes
   from DATA.nextSteps, computed in export_app_data.py from real fields
   (priority tier, impact, platform averages, source concentration, or a
   theme's own recommended action) — nothing is written here for the
   occasion. Shown only for the combined view: a synthesis across stores
   doesn't make sense once you've already filtered to one of them. */
/* Tier + evidence cues are read from each step's own text (title + rationale,
   written server-side) rather than invented here, so the label can't claim
   something the rationale doesn't support. First step is always the strongest
   ("Fix first"); the rest are classified from their wording. */
function stepTier(step, i) {
  const t = `${step.title} ${step.rationale}`.toLowerCase();
  if (i === 0) return "Fix first";
  if (/google play|android|app store|ios/.test(t)) return "Platform priority";
  if (/not statistically significant|mixed sentiment|monitor|targeted fix/.test(t)) return "Monitor";
  if (/investigate|check whether|root cause|underperform|support|signup|verification/.test(t)) return "Investigate";
  return "Next priority";
}
function stepCues(step) {
  const t = `${step.title} ${step.rationale}`.toLowerCase();
  const cues = [];
  if (/\bnot statistically significant\b/.test(t)) cues.push("Exploratory");
  else if (/statistically significant/.test(t)) cues.push("Statistically significant");
  if (/large effect|highest negative|outsized/.test(t)) cues.push("Large effect");
  if (/google play|android/.test(t)) cues.push("Google Play concentrated");
  return cues.slice(0, 2);
}

/* Recommended Next Steps — the second narrative anchor: the analysis is done,
   here is what to do, ranked. Priority is carried by typography and ranking,
   not by a badge on every row: the top action is emphasised (red rank, a
   single left accent), the rest stay quiet. */
function NextSteps({ onSelect, activeIdx, store = "all" }) {
  const { DATA } = useAppData();
  const steps = DATA.nextSteps || [];
  return (
    <Card className="tl-story-card tl-story-actions relative flex h-full flex-col overflow-hidden p-6 sm:p-8">
      <CardMotif variant="actions" className="-bottom-14 -right-12 w-52" />
      <div className="relative">
        <div className="flex items-start justify-between gap-4"><h2 className="text-[17px] font-bold tracking-tight" style={{ color: "#172033" }}>What to do next</h2><InsightPeriodStamp /></div>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed" style={{ color: INK2 }}>
          Ranked by priority. Each recommendation says what to change; open one for interventions, evidence and ownership.
          {store !== "all" && <span className="ml-1" style={{ color: INK3 }}>Recommendations currently reflect the all-source analysis.</span>}
        </p>
      </div>
      {steps.length ? (
      <ol className="relative mt-6 border-t border-[#EEE9E5]">
        {steps.map((s, i) => {
          const tier = stepTier(s, i);
          const lead = i === 0;
          const isActive = activeIdx === i; // stays visually identifiable behind the slide-over
          return (
            <li key={i} className="tl-action-row" style={{ animationDelay: `${220 + i * 75}ms` }}>
              <button onClick={() => onSelect && onSelect(i)}
                aria-expanded={isActive}
                className={`tl-action-trace group relative -mx-2 grid w-full grid-cols-[1.75rem_1fr_auto] items-center gap-4 rounded-lg border-b border-[#EEE9E5] py-4 pl-5 pr-2 text-left transition sm:grid-cols-[2rem_1fr_auto] sm:gap-5 ${
                  isActive ? "ring-1 ring-[#D2CECB]" : ""} ${
                  lead ? "bg-rose-500/[0.05] hover:bg-rose-500/[0.09]" : "hover:bg-black/[0.035]"}`}>
                <span className="text-[20px] font-bold leading-none tabular-nums" style={{ color: lead ? "#DC2626" : INK3 }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <div className="text-[12px] font-semibold" style={{ color: lead ? "#D94A4A" : INK2 }}>{tier}</div>
                  <div className="mt-0.5 text-[14.5px] font-semibold leading-snug" style={{ color: "#172033" }}>
                    {stepHeadline(s)}
                  </div>
                  <p className="mt-1 text-[13px] leading-relaxed" style={{ color: INK2 }}>{stepSubline(s)}</p>
                </div>
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full transition group-hover:bg-black/[0.05]" style={{ color: INK3 }}>
                  <ChevronRight size={18} strokeWidth={2} className="transition group-hover:translate-x-0.5" />
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      ) : (
        <div className="mt-6 rounded-lg border border-[#D8CEC8] bg-[#FFF9F6] px-4 py-5 text-[13px] leading-relaxed" style={{ color: INK2 }}>
          Not enough evidence in this view to reprioritize actions confidently.
        </div>
      )}
    </Card>
  );
}

/* A short imperative headline for a step: its first clause (before the first
   comma) so the ranked list stays scannable; the full text lives in the drawer. */
function stepHeadline(step) {
  const first = step.title.split(/[,.]/)[0].trim();
  return first.length > 3 ? first : step.title;
}
function stepSubline(step) {
  // The list should answer "what should I do?" first. When Anthropic supplies a
  // short outcome/intent line we use it; otherwise the evidence rationale is a
  // safe deterministic fallback.
  if (step.outcome) return step.outcome;
  const first = step.rationale.split(/(?<=\.)\s/)[0];
  return humanizeFindingImpact(first);
}

/* Structured detail for the action drawer, derived from the step text plus the
   real theme data it references — nothing invented. Themes are matched by
   keyword overlap with the step; impact / platform / confidence come straight
   from the matched theme's computed fields. */
function stepDetail(step, i, DATA) {
  const tier = stepTier(step, i);
  const cues = stepCues(step);
  const text = `${step.title} ${step.rationale}`.toLowerCase();
  const themes = DATA.scopes.all.themes.filter((t) => {
    const words = t.theme.toLowerCase().split(/\W+/).filter((w) => w.length > 4);
    return words.some((w) => text.includes(w));
  }).slice(0, 3);
  const lead = themes[0];
  const platform = lead?.sourceConcentration?.label
    || (/google play|android/.test(text) ? "Google Play" : /app store|ios/.test(text) ? "App Store" : "All sources");
  const confidence = /\bnot statistically significant\b/.test(text) ? "Exploratory"
    : /statistically significant/.test(text) || lead?.significant ? "High" : "Moderate";
  // Split into concrete actions on clause boundaries (commas), not on "and",
  // so a lead verb like "Audit and simplify …" stays one specific action
  // rather than a vague standalone "Audit".
  const actions = (step.suggestedInterventions?.length ? step.suggestedInterventions : step.title.split(/,\s*/))
    .map((a) => a.trim().replace(/^and\s+/i, "").replace(/\.$/, ""))
    .filter((a) => a.split(/\s+/).length >= 2);
  return { tier, cues, themes, lead, platform, confidence, actions, expectedImpact: step.expectedImpact, owner: step.owner };
}

/* Right-side slide-over action workspace. Slides in from the right (~260ms)
   over a dimmed dashboard when a recommendation is selected; never navigates
   away. Reserved for action workflows — analytical drill-down expands in place
   instead. Content order: Recommendation → Why → Evidence → Recommended
   response → Action setup → CTA. */
function ActionDrawer({ index, onClose }) {
  const { DATA } = useAppData();
  const steps = DATA.nextSteps || [];
  const open = index != null && !!steps[index];
  const [render, setRender] = useState(false);   // mount/unmount around the transition
  const [visible, setVisible] = useState(false);  // drives the slide/fade
  const [shown, setShown] = useState(index);       // last index (kept during exit)

  useEffect(() => {
    if (open) {
      setShown(index);
      setRender(true);
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    const t = setTimeout(() => setRender(false), 280);
    return () => clearTimeout(t);
  }, [open, index]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!render) return null;
  const si = shown != null ? shown : index;
  const step = steps[si];
  if (!step) return null;
  const d = stepDetail(step, si, DATA);
  const Label = ({ children }) => (
    <div className="text-[12px] font-semibold" style={{ color: INK2 }}>{children}</div>
  );

  return (
    /* The action drawer lives below the sticky application header. Keeping the
       drawer in the remaining viewport prevents its title/content from sitting
       underneath the translucent top chrome while preserving that chrome. */
    <div className="fixed bottom-0 left-0 right-0 top-[69px] z-40">
      <div className={`absolute inset-0 bg-slate-900/30 transition-opacity duration-300 ease-out ${visible ? "opacity-100" : "opacity-0"}`}
        onClick={onClose} />
      <div className={`absolute inset-y-0 right-0 flex w-full max-w-[460px] flex-col border-l border-[#D8D3CF] bg-white shadow-2xl transition-transform duration-300 ease-out ${
        visible ? "translate-x-0" : "translate-x-full"}`}>
        {/* Recommendation header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <div className="flex items-center gap-2 text-[12px] font-semibold">
              <span className="tabular-nums" style={{ color: INK3 }}>{String(si + 1).padStart(2, "0")}</span>
              <span style={{ color: si === 0 ? "#D94A4A" : INK2 }}>{d.tier}</span>
            </div>
            <h2 className="mt-1 text-[17px] font-bold leading-snug tracking-tight" style={{ color: INK }}>{step.title}</h2>
          </div>
          <button onClick={onClose} aria-label="Close"
            className="shrink-0 rounded-lg p-1.5 transition hover:bg-slate-100" style={{ color: INK3 }}>
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {/* Why */}
          <div>
            <Label>Why this is recommended</Label>
            <p className="mt-1 text-[13px] leading-relaxed" style={{ color: INK2 }}>{humanizeFindingImpact(step.rationale)}</p>
            {d.themes.length > 0 && (
              <p className="mt-2 text-[12px]" style={{ color: INK3 }}>
                Linked themes: <span style={{ color: INK2 }}>{d.themes.map((t) => t.theme).join(" · ")}</span>
              </p>
            )}
          </div>

          {/* Evidence */}
          <div>
            <Label>Evidence behind this recommendation</Label>
            <div className="mt-2 grid grid-cols-3 gap-3 border-y border-slate-100 py-3">
              <div>
                <div className="text-[11px]" style={{ color: INK3 }}>Rating impact</div>
                <div className="mt-0.5 text-[15px] font-bold tabular-nums" style={{ color: d.lead && d.lead.impact < 0 ? "#D94A4A" : INK }}>
                  {d.lead && d.lead.impact != null ? `${fmt(d.lead.impact)} ★` : "—"}
                </div>
              </div>
              <div>
                <div className="text-[11px]" style={{ color: INK3 }}>Confidence</div>
                <div className="mt-0.5 text-[15px] font-bold" style={{ color: INK }}>{d.confidence}</div>
              </div>
              <div>
                <div className="text-[11px]" style={{ color: INK3 }}>Source</div>
                <div className="mt-0.5 text-[15px] font-bold" style={{ color: INK }}>{d.platform}</div>
              </div>
            </div>
            {(d.cues.length > 0 || (d.lead && d.lead.volume != null)) && (
              <ul className="mt-2.5 space-y-1.5">
                {d.cues.map((c) => (
                  <li key={c} className="flex items-center gap-2 text-[13px]" style={{ color: INK2 }}>
                    <Check size={14} strokeWidth={2} className="shrink-0 text-emerald-600" />{c}
                  </li>
                ))}
                {d.lead && d.lead.volume != null && (
                  <li className="flex items-center gap-2 text-[13px]" style={{ color: INK2 }}>
                    <Check size={14} strokeWidth={2} className="shrink-0 text-emerald-600" />
                    {d.lead.volume} relevant mentions in “{d.lead.theme}”
                  </li>
                )}
              </ul>
            )}
          </div>

          {/* Recommended response */}
          {d.actions.length > 0 && (
            <div>
              <Label>Suggested interventions</Label>
              <ul className="mt-2 space-y-2">
                {d.actions.slice(0, 4).map((a, k) => (
                  <li key={k} className="flex gap-2.5 text-[13px] leading-relaxed" style={{ color: INK }}>
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: "#94A3B8" }} />
                    <span>{a.charAt(0).toUpperCase() + a.slice(1)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {d.expectedImpact && (
            <div>
              <Label>Expected customer impact</Label>
              <p className="mt-1 text-[13px] leading-relaxed" style={{ color: INK2 }}>{d.expectedImpact}</p>
            </div>
          )}

          {/* Action setup — sits directly under the content, no large gap. */}
          <div>
            <Label>Action setup</Label>
            <div className="mt-2 grid grid-cols-3 gap-3">
              {[["Owner", d.owner || "Unassigned"], ["Status", "Not started"], ["Due", "—"]].map(([k, val]) => (
                <div key={k}>
                  <div className="text-[11px]" style={{ color: INK3 }}>{k}</div>
                  <div className="mt-0.5 text-[13px]" style={{ color: INK2 }}>{val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sticky CTA bar */}
        <div className="border-t border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <button className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
              style={{ backgroundColor: CORAL }}>
              Create action<ArrowRight size={16} strokeWidth={2} />
            </button>
            <button className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium transition hover:bg-slate-50" style={{ color: INK2 }}>
              Export evidence
            </button>
          </div>
          <button className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium transition hover:bg-slate-50" style={{ color: INK2 }}>
            Send to CX platform
          </button>
        </div>
      </div>
    </div>
  );
}

function EvidencePreview({ liveRefreshState = "running" }) {
  const { DATA } = useAppData();
  const all = DATA?.scopes?.all;
  const reviews = Array.isArray(DATA?.reviews) ? DATA.reviews : [];
  const platforms = Array.isArray(DATA?.platform) ? DATA.platform : [];
  const ratings = reviews.map((r) => Number(r.rating)).filter(Number.isFinite);
  const lowRatings = ratings.filter((r) => r <= 2).length;
  const highRatings = ratings.filter((r) => r >= 4).length;
  const lowPct = ratings.length ? Math.round(lowRatings / ratings.length * 100) : null;
  const highPct = ratings.length ? Math.round(highRatings / ratings.length * 100) : null;
  const representative = [...reviews]
    .filter((r) => (r.text || '').trim().length > 35)
    .sort((a,b) => (Number(a.rating || 3) - Number(b.rating || 3)) || String(b.date || '').localeCompare(String(a.date || '')))
    .slice(0,3);
  return (
    <div className="px-8 py-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm" style={{ color: INK2 }}>You are viewing app review data for</div>
          <div className="mt-0.5"><CompanySwitcher /></div>
          <div className="mt-3.5 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-[#F0D4CB] bg-[#FFF7F4] px-2.5 py-1.5 text-xs font-semibold text-[#A6533E]"><RefreshCw size={13} className="animate-spin" />Live intelligence enriching</span>
            <span className="text-sm" style={{ color: INK2 }}><span className="font-semibold" style={{ color: INK }}>{reviews.length}</span> reviews collected</span>
          </div>
        </div>
        <div className="max-w-[460px] rounded-xl border border-[#E7DED9] bg-[#FFFDFC] px-4 py-3 text-[12px] leading-relaxed text-[#6F625C]">
          Ratings, sources and verbatims are ready. Throughline is now adding sentiment, themes, rating impact and recommendations in the background.
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="p-5"><div className="text-xs font-semibold uppercase tracking-[.08em]" style={{color:INK3}}>Reviews collected</div><div className="mt-2 text-[34px] font-bold" style={{color:INK}}>{reviews.length}</div></Card>
        <Card className="p-5"><div className="text-xs font-semibold uppercase tracking-[.08em]" style={{color:INK3}}>Average rating</div><div className="mt-2 text-[34px] font-bold" style={{color:INK}}>{all?.kpis?.avgRating != null ? `${Number(all.kpis.avgRating).toFixed(2)}★` : '—'}</div></Card>
        <Card className="p-5"><div className="text-xs font-semibold uppercase tracking-[.08em]" style={{color:INK3}}>1–2 star reviews</div><div className="mt-2 text-[34px] font-bold text-[#A44734]">{lowPct != null ? `${lowPct}%` : '—'}</div></Card>
        <Card className="p-5"><div className="text-xs font-semibold uppercase tracking-[.08em]" style={{color:INK3}}>4–5 star reviews</div><div className="mt-2 text-[34px] font-bold text-[#3F6D59]">{highPct != null ? `${highPct}%` : '—'}</div></Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <div className="text-[13px] font-semibold uppercase tracking-[.08em]" style={{color:INK3}}>Source evidence</div>
          <div className="mt-4 divide-y divide-[#ECE5E1]">
            {platforms.map((p) => <div key={p.id} className="flex items-center justify-between py-4">
              <div><div className="font-semibold" style={{color:INK}}>{p.label}</div><div className="mt-0.5 text-sm" style={{color:INK3}}>{p.nReviews} reviews</div></div>
              <div className="text-right"><div className="text-xl font-bold" style={{color:INK}}>{p.avgRating != null ? `${Number(p.avgRating).toFixed(2)}★` : '—'}</div></div>
            </div>)}
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between"><div className="text-[13px] font-semibold uppercase tracking-[.08em]" style={{color:INK3}}>Customer evidence</div><span className="text-xs" style={{color:INK3}}>Analysis still running</span></div>
          <div className="mt-3 space-y-3">
            {representative.map((r) => <div key={r.id} className="border-t border-[#ECE5E1] pt-3 first:border-0 first:pt-0"><div className="mb-1 text-xs font-semibold" style={{color:INK3}}>{r.sourceLabel} · {r.rating ? `${r.rating}★` : 'unrated'}</div><div className="text-[14px] leading-relaxed" style={{color:INK2}}>“{String(r.text).slice(0,220)}{String(r.text).length>220?'…':''}”</div></div>)}
          </div>
        </Card>
      </div>
    </div>
  );
}

function sliceForWeek(slice, reviews, week) {
  if (!week) return slice;
  const start = new Date(`${week.start}T00:00:00`), end = new Date(`${week.end}T23:59:59`);
  const selected = reviews.filter((review) => { const d = new Date(review.date); return d >= start && d <= end; });
  const ids = new Set(selected.map((review) => review.id));
  const phrases = selected.flatMap((review) => review.phrases || []);
  const ratings = selected.map((review) => Number(review.rating)).filter(Number.isFinite);
  const positive = phrases.filter((p) => Number(p.score) > .2).length;
  const negative = phrases.filter((p) => Number(p.score) < -.2).length;
  const themes = slice.themes.map((theme) => {
    const verbatimIds = (theme.verbatimIds || []).filter((id) => ids.has(id));
    return { ...theme, verbatimIds, volume: verbatimIds.length };
  }).filter((theme) => theme.volume > 0);
  const emotionCounts = {};
  phrases.forEach((p) => { if (p.emotion) emotionCounts[p.emotion] = (emotionCounts[p.emotion] || 0) + 1; });
  const totalEmotions = Object.values(emotionCounts).reduce((a,b) => a+b, 0) || 1;
  const emotions = Object.entries(emotionCounts).sort((a,b) => b[1]-a[1]).map(([label,count]) => ({ label, count, pct: count/totalEmotions*100, valence: slice.emotions.find((emotion) => emotion.label === label)?.valence || "neu" }));
  return {
    ...slice,
    kpis: { ...slice.kpis, avgRating: ratings.length ? ratings.reduce((a,b)=>a+b,0)/ratings.length : null, nss: phrases.length ? (positive-negative)/phrases.length*100 : null, nReviews: selected.length, nPhrases: phrases.length },
    themes, emotions,
    scatter: selected.filter((r) => r.rating != null && r.score != null).map((r) => ({ r:r.rating, s:r.score })),
    painPoints: slice.painPoints.filter((point) => selected.some((review) => review.text === point.quote)),
  };
}

function InsightGenerator({ state, onGenerate, reviewCount, publicDemo = false }) {
  const generating = state === "generating";
  const ready = state === "ready";
  const failed = state === "error";
  return (
    <Card className={`relative z-20 overflow-visible transition-colors duration-500 ${generating ? "border-[#F0714E]/50 bg-[#FFF7F3]" : "bg-[#FBF8F6]"}`}>
      <div className="flex flex-col items-center justify-center px-6 py-7 text-center">
        <div className="flex items-center gap-2"><button type="button" onClick={onGenerate} disabled={generating}
          className={`group inline-flex min-w-[230px] items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold shadow-sm transition-all duration-500 focus:outline-none focus:ring-2 focus:ring-[#F0714E]/25 ${ready || generating ? "bg-[#F0714E] text-white" : "bg-[#DED8D4] text-[#554B46] hover:bg-[#D2CAC5]"}`}>
          <Sparkles size={17} className={generating ? "animate-pulse" : "transition-transform group-hover:rotate-6"} />
          {generating ? "Generating insights…" : ready ? "Regenerate insights & actions" : failed ? "Try generating again" : "Generate insights & actions"}
        </button><InfoPopover label="How insight generation works"><strong className="block text-[11px]">What happens when you generate</strong><span className="mt-1 block text-slate-300">Throughline sends the analyzed themes and supporting evidence for synthesis into an executive summary and ranked actions. This is the credit-using step; review collection and the core dashboard are already complete.</span></InfoPopover></div>
        {generating ? (
          <div className="mt-4 w-full max-w-xl" role="status" aria-live="polite">
            <div className="tl-generate-track"><span /></div>
            <div className="mt-2 text-xs font-medium text-[#7B655D]">Synthesizing {reviewCount} reviews into findings and ranked actions</div>
          </div>
        ) : (
          <p className={`mt-2 text-xs ${failed ? "text-red-600" : "text-[#8A7F79]"}`}>{failed ? "Insight generation did not complete. Your evidence remains available and no result was replaced." : publicDemo ? "Portfolio demo uses a cached synthesis and does not call a live model." : "Uses AI credits to create an executive summary and prioritized recommendations."}</p>
        )}
      </div>
    </Card>
  );
}

function DashboardView({ store, setStore, reviewsById, liveRefreshState = "idle", liveRefreshMessage = "", liveStage = 0, onRefreshData, onExtendWindow, publicDemo = false }) {
  const { DATA, activeSlug, setRuntimeCompanies } = useAppData();
  const slice = DATA.scopes[store];
  const label = (DATA.sources.find((s) => s.id === store) || {}).label || store;
  const scopedReviews = useMemo(
    () => (store === "all" ? DATA.reviews : DATA.reviews.filter((r) => r.source === store)),
    [store, DATA]
  );
  const dateRange = dateRangeOf(scopedReviews);
  // Keep the recommendation surface stable across source filters. The current
  // prototype stores one recommendation set at company level, so filtered
  // views preserve it and label that scope explicitly rather than collapsing
  // the card and causing the dashboard layout to jump.
  const showSteps = true;

  // Shared selection: the matrix drives which topic the Customer Voice panel
  // shows. Null = no manual pick yet, so we fall back to the top pain point's
  // theme (the worst-scoring review's topic), else the highest-priority theme.
  const [activeTopic, setActiveTopic] = useState(null);
  const [activeStepIdx, setActiveStepIdx] = useState(null); // action drawer selection
  const [showValidation, setShowValidation] = useState(false); // full-width detailed validation
  const [activeWeek, setActiveWeek] = useState(null);
  const [insightState, setInsightState] = useState(publicDemo ? "idle" : DATA?.narrative ? "ready" : "idle");
  useEffect(() => { setShowValidation(false); }, [store]); // reset when scope changes
  useEffect(() => { setActiveTopic(null); }, [store]); // topics differ per scope
  useEffect(() => { setActiveWeek(null); }, [store]);
  useEffect(() => { setActiveTopic(null); }, [activeWeek]);
  useEffect(() => { setInsightState(publicDemo ? "idle" : DATA?.narrative ? "ready" : "idle"); }, [activeSlug, DATA?.narrative, publicDemo]);
  const generateInsights = async () => {
    setInsightState("generating");
    if (publicDemo) {
      window.setTimeout(() => setInsightState("ready"), 1350);
      return;
    }
    try {
      const response = await fetch("/api/generate-narrative", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companySlug: activeSlug, company: DATA.company }) });
      const started = await response.json();
      if (!response.ok || !started?.ok) throw new Error(started?.error || "Could not start insight generation.");
      const poll = async () => {
        try {
          const statusResponse = await fetch(`/api/narrative-status?id=${encodeURIComponent(started.jobId)}&t=${Date.now()}`, { cache: "no-store" });
          const result = await statusResponse.json();
          if (!statusResponse.ok || !result?.ok || result?.status === "error") throw new Error(result?.error || "Insight generation did not complete.");
          if (result?.status === "complete" && result?.data) {
            setRuntimeCompanies((current) => ({ ...current, [activeSlug]: result.data }));
            setInsightState("ready");
            return;
          }
          window.setTimeout(() => void poll(), 1200);
        } catch (error) {
          console.error(error);
          setInsightState("error");
        }
      };
      window.setTimeout(() => void poll(), 500);
    } catch (error) {
      console.error(error);
      setInsightState("error");
    }
  };
  const displayReviews = activeWeek == null ? scopedReviews : scopedReviews.filter((review) => { const week=slice.weekly?.[activeWeek]; if(!week) return true; const d=new Date(review.date); return d>=new Date(`${week.start}T00:00:00`) && d<=new Date(`${week.end}T23:59:59`); });
  const displaySlice = useMemo(() => sliceForWeek(slice, scopedReviews, activeWeek == null ? null : slice.weekly?.[activeWeek]), [slice, scopedReviews, activeWeek]);
  const defaultTopic = displaySlice.painPoints[0]?.tag || displaySlice.themes[0]?.theme || null;
  const resolvedTopic = activeTopic || defaultTopic;
  const progressProcessed = Number(DATA?.analysisProgress?.processedReviews || 0);
  const progressTotal = Number(DATA?.analysisProgress?.totalReviews || slice.kpis.nReviews || 0);
  const progressStage = ["Discovering reviews", "Analysing feedback", "Finding themes", "Building recommendations"][Math.min(3, liveStage)] || "Analysing feedback";
  return (
    <div className="px-8 py-5">
      <div className="tl-reveal-section flex flex-wrap items-center justify-between gap-4 border-b border-[#DDD6D1] pb-4">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-5 gap-y-3">
          {/* A sentence lead-in, not a report title — signals the company is a
              switchable selection, with the company as the dominant anchor.
              CompanySwitcher makes that literal: the name itself opens the
              picker for every company analyzed locally. */}
          {/* One control row directly under the company: source selector, the
              date-range picker, then the review / scored-phrase counts. */}
          <div className="flex flex-wrap items-center gap-2.5">
            <SourceSelector store={store} setStore={setStore} />
            {dateRange && <DatePicker readOnly={publicDemo} current={DATA?.ingestion?.window?.effective_days || 30} onSelect={onExtendWindow} range={`${DATA?.ingestion?.window?.effective_days || 30} days · ${dateRange}`} />}
            <span className="text-sm" style={{ color: INK2 }}>
              <span className="font-semibold" style={{ color: INK }}>{slice.kpis.nReviews}</span> reviews
              <span className="mx-1.5 text-slate-300">·</span>
              <span className="font-semibold text-[#4B403C]">{slice.kpis.nPhrases}</span> scored phrases
            </span>
            {!publicDemo && liveRefreshState !== "running" && <button type="button" onClick={onRefreshData} className="inline-flex min-w-[92px] items-center justify-center gap-1.5 rounded-md border border-[#DED6D1] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#4B403C] hover:bg-[#FFF9F6]"><RefreshCw size={13} />Refresh data</button>}
            {liveRefreshState === "running" && <><div className="tl-processing-compact" role="status" aria-live="polite">
              <span className="tl-processing-mark" aria-hidden="true"><i /></span>
              <span className="min-w-0"><strong>{publicDemo ? "Preparing dashboard" : "Updating review data"}</strong><small>{publicDemo ? `${progressTotal || slice.kpis.nReviews} cached reviews · ${progressStage}` : `${progressTotal || slice.kpis.nReviews} found · ${progressStage}`}</small></span>
              <span className="tl-processing-time">{publicDemo ? "a few sec" : "~2 min"}</span>
            </div><InfoPopover attention label="What is happening in the background"><strong className="block text-[11px]">{publicDemo ? "Replaying the analysis workflow" : "Updating the evidence base"}</strong><span className="mt-1 block text-slate-300">{publicDemo ? "This portfolio version assembles a cached, pre-analyzed review snapshot so you can experience the product flow without triggering API calls or external data collection." : "Throughline is collecting public App Store and Google Play reviews, removing duplicates, scoring customer phrases and organizing them into themes. The dashboard updates automatically as each stage finishes."}</span></InfoPopover></>}
          </div>
          {(() => {
            const windowMeta = DATA?.ingestion?.window || {};
            const effectiveDays = Number(windowMeta.effective_days || 0);
            const reviewCount = Number(windowMeta.review_count ?? slice.kpis.nReviews ?? 0);
            const minimum = Number(windowMeta.minimum_reviews || 25);
            const options = [60, 90, 180].filter((days) => days > effectiveDays);
            if (effectiveDays < 30 || reviewCount >= minimum || !options.length) return null;
            const primaryCount = Number(windowMeta.primary_review_count || 0);
            return (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-[#E6D8D1] bg-[#FFF9F6] px-3 py-2 text-xs text-[#5E514A]">
                <span className="font-semibold text-[#172033]">Limited recent evidence.</span>
                <span>{primaryCount ? `${primaryCount} reviews in ${windowMeta.requested_days || 30} days · ` : ""}{reviewCount} reviews in the last {effectiveDays} days.</span>
                <span>Extend the evidence window?</span>
                {options.slice(0, 3).map((days) => (
                  <button key={days} type="button" onClick={() => onExtendWindow?.(days)}
                    className="rounded-md border border-[#DCCFC8] bg-white px-2.5 py-1 font-semibold text-[#A6533E] hover:bg-[#FFF4EF]">
                    {days === 60 ? "60 days" : days === 90 ? "90 days" : "6 months"}
                  </button>
                ))}
              </div>
            );
          })()}
        </div>
        {/* Validation status + methodology sit together, top-right: a quiet
            "the engine is running and its findings are validated" cluster. */}
      </div>

      <div className="tl-reveal-section mt-3"><KpiRow slice={displaySlice} store={store} /></div>
      <div className="tl-reveal-section mt-3"><WeeklyPulse key={store} weeks={slice.weekly || []} activeWeek={activeWeek} onSelectWeek={setActiveWeek} /></div>

      {/* Matrix left and dominant (70%), Customer Voice right (30%). items-stretch
          so both cards are the same height — tops AND bottoms aligned — reading
          as one coordinated section. (Sticky dropped: it left the panel a
          different height from the matrix, which read as misalignment.) */}
      <div className="tl-reveal-section mt-4 grid grid-cols-1 items-stretch gap-4 lg:grid-cols-10">
        <div className="h-full lg:col-span-7">
          <ThemeMatrix slice={displaySlice} reviewsById={reviewsById}
            activeTopic={resolvedTopic} onSelectTopic={setActiveTopic} />
        </div>
        <div className="h-full lg:col-span-3">
          <CustomerVoice slice={displaySlice} reviewsById={reviewsById}
            topicName={resolvedTopic} isDefault={!activeTopic} />
        </div>
      </div>

      <div className="tl-reveal-section mt-4"><InsightGenerator publicDemo={publicDemo} state={insightState} onGenerate={generateInsights} reviewCount={displaySlice.kpis.nReviews} /></div>

      {/* Lower dashboard as one narrative, two rows:
          Row 1 — what we found (Key Findings) → what to do (Next Steps).
          Row 2 — what evidence explains it (Platform & Emotion) → why we
          trust it (Model Validation). Both rows are the same 50/50 grid so
          their outer edges line up and the four cards read as one section. */}
      {insightState === "ready" && showSteps ? (
        <div className="tl-reveal-section mt-4 grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
          <KeyFindings slice={displaySlice} />
          <NextSteps onSelect={setActiveStepIdx} activeIdx={activeStepIdx} store={store} />
        </div>
      ) : insightState === "ready" ? (
        <div className="tl-reveal-section mt-4"><KeyFindings slice={displaySlice} /></div>
      ) : null}

      {/* Analytical drill-down expands IN PLACE: clicking "View detailed
          validation" swaps this row for a full-width Trust panel (Evidence
          collapses); "Back to summary" restores the Evidence + Trust layout. */}
      <div className="tl-reveal-section mt-4">
        {showValidation ? (
          <ValidationExpanded slice={displaySlice} reviews={displayReviews} onBack={() => setShowValidation(false)} />
        ) : (
          <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
            <PlatformEmotion slice={displaySlice} />
            <ValidationPlot slice={displaySlice} reviews={displayReviews} onViewDetail={() => setShowValidation(true)} />
          </div>
        )}
      </div>

      <ActionDrawer index={activeStepIdx} onClose={() => setActiveStepIdx(null)} />
    </div>
  );
}

/* ------------------------------------------------------------------
   Review Explorer
   ------------------------------------------------------------------ */

function ReviewCard({ r }) {
  const v = valenceOf(r.score);
  const TrendIcon = v === "neg" ? TrendingDown : TrendingUp;
  return (
    <Card accent={v === "neg" ? "neg" : v === "pos" ? "pos" : undefined} className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-200 bg-white p-2">
            <SourceMark source={r.source} className="h-full w-full" />
          </div>
          <div className="leading-tight">
            {/* Store reviews are anonymous — the store is the identity we have. */}
            <div className="text-[15px] font-bold text-[#172033]">
              {r.source === "app_store" ? "App Store User" : "Google Play User"}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[13px] text-[#8A7F79]">
              <SourceMark source={r.source} className="h-3.5 w-3.5" />
              <span>{r.sourceLabel}</span>
              <span className="text-slate-300">•</span>
              <span>{relativeDate(r.date)}</span>
              {r.version && <><span className="text-slate-300">•</span><span className="font-sans text-[11px] tabular-nums">v{r.version}</span></>}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <Stars rating={r.rating} size={17} />
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-sans text-[12px] font-semibold tabular-nums ${
            v === "pos" ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : v === "neg" ? "border-red-200 bg-red-50 text-red-700"
              : "border-amber-200 bg-amber-50 text-amber-700"}`}>
            <TrendIcon size={12} strokeWidth={2.5} />
            Score: {r.score === null ? "n/a" : fmt(r.score)}
          </span>
        </div>
      </div>

      <p className="mt-4 border-b border-slate-100 pb-4 text-[14px] leading-relaxed text-[#4B403C]">{r.text}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {r.themes.map((t) => (
          <span key={t} title={t}
            className={`rounded-md border px-2.5 py-1 font-sans text-[12px] ${
              v === "pos" ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : v === "neg" ? "border-red-200 bg-red-50 text-red-700"
                : "border-amber-200 bg-amber-50 text-amber-700"}`}>
            {hashtag(t)}
          </span>
        ))}
        {r.primaryEmotion && (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 font-sans text-[12px] text-[#4B403C]">
            <span aria-hidden="true">{emotionOf(r.primaryEmotion).emoji}</span>{emotionOf(r.primaryEmotion).label}
          </span>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
        <span className="inline-flex items-center gap-2 text-sm font-medium text-[#4B403C]">
          <Eye size={16} strokeWidth={2} />View Details
        </span>
        <button className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800">
          <CornerUpLeft size={15} strokeWidth={2} />Reply
        </button>
      </div>
    </Card>
  );
}

function ExplorerView({ store, sentiment, query, rating, setRating, sort, setSort }) {
  const { DATA } = useAppData();
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = DATA.reviews.filter((r) => {
      if (store !== "all" && r.source !== store) return false;
      if (sentiment !== "all" && valenceOf(r.score) !== sentiment) return false;
      if (rating !== "all" && String(r.rating) !== rating) return false;
      if (q) {
        const hay = [r.text, r.primaryEmotion].concat(r.themes || []).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const cmp = {
      newest: (a, b) => (b.date || "").localeCompare(a.date || ""),
      oldest: (a, b) => (a.date || "").localeCompare(b.date || ""),
      lowest: (a, b) => (a.score || 0) - (b.score || 0),
      highest: (a, b) => (b.score || 0) - (a.score || 0),
    }[sort];
    return out.slice().sort(cmp);
  }, [store, sentiment, query, rating, sort, DATA]);

  return (
    <div className="px-8 py-7">
      <h1 className="text-[32px] font-bold tracking-tight text-[#172033]">Review Explorer</h1>
      <p className="mt-1 text-sm text-[#8A7F79]">Analyze qualitative feedback across all channels.</p>

      <div className="mt-4 font-sans text-[11px] tabular-nums text-[#8A7F79]">
        {rows.length} of {DATA.reviews.length} reviews
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        {rows.length ? rows.map((r) => <ReviewCard key={r.id} r={r} />) : (
          <Card className="col-span-full grid place-items-center px-8 py-16 text-center">
            <div>
              <Search size={24} className="mx-auto text-slate-300" strokeWidth={1.75} />
              <div className="mt-3 text-sm font-semibold text-[#172033]">No reviews match</div>
              <p className="mt-1 text-sm text-[#8A7F79]">Try clearing a filter or the search box.</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   App
   ------------------------------------------------------------------ */

function PlaceholderView({ label }) {
  return (
    <div className="px-8 py-7">
      <h1 className="text-[28px] font-bold tracking-tight text-[#172033]">{label}</h1>
      <Card className="mt-6 grid place-items-center px-8 py-20 text-center">
        <div>
          <LineChart size={28} strokeWidth={1.75} className="mx-auto text-slate-300" />
          <div className="mt-4 text-sm font-semibold text-[#172033]">{label} is not built yet</div>
          <p className="mt-1.5 max-w-sm text-sm text-[#8A7F79]">
            Dashboard and Review Explorer are the two implemented views.
          </p>
        </div>
      </Card>
    </div>
  );
}

const Dropdown = ({ value, onChange, options }) => (
  <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-[#4B403C]">
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="cursor-pointer appearance-none bg-transparent pr-4 focus:outline-none">
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
    <ChevronDown size={15} strokeWidth={2} className="pointer-events-none -ml-4 text-[#8A7F79]" />
  </label>
);

export default function App() {
  // Root of the company-switch feature: whichever company is active lives
  // here, alongside its narrative, and is handed down via context so every
  // component below reads it exactly as it used to read the old static
  // `DATA`/`NARR` globals.
  const slugs = Object.keys(COMPANIES);
  const [runtimeCompanies, setRuntimeCompanies] = useState(() => ({ ...COMPANIES }));
  const [activeSlug, setActiveSlug] = useState(() => (slugs.includes("klarna") ? "klarna" : slugs[0]));
  const [entryStage, setEntryStage] = useState("search");
  const [liveReady, setLiveReady] = useState(false);
  const [liveError, setLiveError] = useState("");
  const [liveJobId, setLiveJobId] = useState(null);
  const [liveRefreshState, setLiveRefreshState] = useState("idle");
  const [liveRefreshMessage, setLiveRefreshMessage] = useState("");
  const [liveStage, setLiveStage] = useState(0);
  const [liveReviewSnippets, setLiveReviewSnippets] = useState([]);
  const [pendingCompanyLabel, setPendingCompanyLabel] = useState("");
  const [pendingHasSnapshot, setPendingHasSnapshot] = useState(false);
  const demoRunRef = useRef(0);
  const DATA = runtimeCompanies[activeSlug];
  const NARR = (DATA && DATA.narrative) || {};

  const startAnalysis = async (companyQuery, options = {}) => {
    const known = runtimeCompanies[companyQuery];
    if (PUBLIC_DEMO) {
      if (!known) return;
      const run = ++demoRunRef.current;
      setActiveSlug(companyQuery);
      setPendingCompanyLabel(known.company || companyQuery);
      setPendingHasSnapshot(true);
      setLiveReady(false);
      setLiveError("");
      setLiveStage(0);
      setLiveRefreshState("running");
      setLiveRefreshMessage("Preparing cached portfolio evidence…");
      setEntryStage("analyzing");
      const advance = async (delay, stage, message) => {
        await new Promise((resolve) => window.setTimeout(resolve, delay));
        if (demoRunRef.current !== run) return false;
        setLiveStage(stage);
        setLiveRefreshMessage(message);
        return true;
      };
      if (!await advance(620, 1, "Structuring cached review evidence…")) return;
      if (!await advance(650, 2, "Resolving themes and sentiment…")) return;
      if (!await advance(690, 3, "Assembling the dashboard…")) return;
      await new Promise((resolve) => window.setTimeout(resolve, 430));
      if (demoRunRef.current !== run) return;
      setLiveReady(true);
      await new Promise((resolve) => window.setTimeout(resolve, 1850));
      if (demoRunRef.current !== run) return;
      setLiveRefreshState("complete");
      setLiveRefreshMessage("Cached intelligence ready");
      await new Promise((resolve) => window.setTimeout(resolve, 900));
      if (demoRunRef.current === run) setLiveRefreshState("idle");
      return;
    }
    if (known) setActiveSlug(companyQuery);
    setPendingCompanyLabel(known?.company || companyQuery);
    setPendingHasSnapshot(Boolean(known));
    setLiveReady(false);
    setLiveError("");
    setLiveJobId(null);
    setLiveRefreshState("starting");
    setLiveRefreshMessage(known ? "Starting live 30-day refresh…" : "Finding public app-store sources…");
    setLiveStage(0);
    setLiveReviewSnippets([]);
    setEntryStage("analyzing");
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: companyQuery,
          hasSnapshot: Boolean(known),
          windowDays: options.windowDays || 30,
          countryHint: (() => {
            try {
              const locale = Intl.DateTimeFormat().resolvedOptions().locale || navigator.language || "";
              const match = String(locale).match(/[-_]([A-Za-z]{2})(?:$|[-_])/);
              return match ? match[1].toLowerCase() : null;
            } catch { return null; }
          })(),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result?.ok || !result?.jobId) {
        throw new Error(result?.error || "Live analysis could not start.");
      }
      setLiveJobId(result.jobId);
      setLiveRefreshState("running");
      if (known) {
        setLiveRefreshMessage("Core dashboard ready · Deep analysis continuing…");
        // Existing intelligence can open immediately while fresh analysis runs.
        setLiveReady(true);
      } else {
        setLiveRefreshMessage("Public reviews found · Building first company snapshot…");
      }
    } catch (error) {
      setLiveRefreshState("error");
      setLiveError(error?.message || "Live analysis could not start.");
    }
  };

  useEffect(() => {
    if (!liveJobId || liveRefreshState !== "running") return undefined;
    let cancelled = false;
    const poll = async () => {
      try {
        const response = await fetch(`/api/analyze-status?id=${encodeURIComponent(liveJobId)}&t=${Date.now()}`, { cache: "no-store" });
        const result = await response.json();
        if (cancelled) return;
        if (result?.status === "running") {
          if (Number.isFinite(result?.stage)) setLiveStage(result.stage);
          if (Array.isArray(result?.reviewSnippets) && result.reviewSnippets.length) setLiveReviewSnippets(result.reviewSnippets);
        }
        if (result?.status === "partial" && result?.data) {
          const resolvedSlug = result.data.companySlug || String(result.data.company || pendingCompanyLabel || "company")
            .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
          setRuntimeCompanies((current) => ({ ...current, [resolvedSlug]: result.data }));
          setActiveSlug(resolvedSlug);
          setPendingCompanyLabel(result.data.company || pendingCompanyLabel);
          setPendingHasSnapshot(true);
          setLiveReady(true);
          setLiveStage(3);
          setLiveRefreshState("running");
          const progress = result.data.analysisProgress;
          if (result.data.evidenceOnly) {
            setLiveRefreshMessage(`Reviews ready · Enriching ${progress?.totalReviews || result.data.reviews?.length || 0} reviews with themes and sentiment…`);
          } else if (progress?.isPartial) {
            setLiveRefreshMessage(`Initial analysis ready · Processing remaining feedback (${progress.processedReviews}/${progress.totalReviews})…`);
          } else {
            setLiveRefreshMessage("Core dashboard ready · Executive interpretation continuing…");
          }
          // Do not make the loading surface depend on a second effect noticing
          // liveReady. Once a valid first-pass payload exists, reveal it now.
          setEntryStage((stage) => stage === "analyzing" ? "revealing" : stage);
          window.setTimeout(poll, 1200);
          return;
        }
        if (result?.status === "complete" && result?.data) {
          const resolvedSlug = result.data.companySlug || String(result.data.company || pendingCompanyLabel || "company")
            .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
          setRuntimeCompanies((current) => ({ ...current, [resolvedSlug]: result.data }));
          setActiveSlug(resolvedSlug);
          setPendingCompanyLabel(result.data.company || pendingCompanyLabel);
          setPendingHasSnapshot(true);
          setLiveReady(true);
          setEntryStage((stage) => stage === "analyzing" ? "revealing" : stage);
          setLiveRefreshState("complete");
          setLiveRefreshMessage("Live intelligence updated");
          setLiveJobId(null);
          window.setTimeout(() => {
            setLiveRefreshState((state) => state === "complete" ? "idle" : state);
          }, 4200);
          return;
        }
        if (result?.status === "error" || !result?.ok) {
          setLiveRefreshState("error");
          setLiveRefreshMessage(result?.error || "Live refresh incomplete · showing last available intelligence");
          setLiveJobId(null);
          return;
        }
        window.setTimeout(poll, 1200);
      } catch (error) {
        if (!cancelled) window.setTimeout(poll, 1800);
      }
    };
    const timer = window.setTimeout(poll, 350);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [liveJobId, liveRefreshState, activeSlug, pendingCompanyLabel]);


  // Belt-and-suspenders handoff: a valid payload must never remain hidden behind
  // the first-load skeleton, even if a render/effect race occurs.
  useEffect(() => {
    if (entryStage !== "analyzing" || !liveReady) return undefined;
    const timer = window.setTimeout(() => setEntryStage("revealing"), 120);
    return () => window.clearTimeout(timer);
  }, [entryStage, liveReady]);

  // The reveal stage mounts the real dashboard immediately underneath a short
  // visual bridge. This keeps data/layout ready before the loading surface
  // disappears and avoids a blank frame or hard route swap.
  useEffect(() => {
    if (entryStage !== "revealing") return undefined;
    const timer = window.setTimeout(() => setEntryStage("dashboard"), 440);
    return () => window.clearTimeout(timer);
  }, [entryStage]);

  const [store, setStore] = useState("all");
  const [sentiment, setSentiment] = useState("all");
  const [query, setQuery] = useState("");
  const [rating, setRating] = useState("all");
  const [sort, setSort] = useState("newest");

  // A source/topic pick made for the previous company's sources doesn't
  // carry over — switching companies resets scope back to "All Sources".
  useEffect(() => { setStore("all"); }, [activeSlug]);

  const reviewsById = useMemo(() => {
    const m = {};
    DATA.reviews.forEach((r) => { m[r.id] = r; });
    return m;
  }, [DATA]);

  if (entryStage === "search") {
    return <SearchPage demoMode={PUBLIC_DEMO} companies={runtimeCompanies} onSelectCompany={startAnalysis} />;
  }

  if (entryStage === "analyzing") {
    return (
      <AnalysisLoading
        company={pendingCompanyLabel || DATA?.company || activeSlug}
        data={pendingHasSnapshot ? DATA : null}
        ready={liveReady}
        error={liveError}
        onBack={() => { setLiveError(""); setEntryStage("search"); }}
        onComplete={() => setEntryStage("revealing")}
        backendStage={liveStage}
        reviewSnippets={liveReviewSnippets}
        demoMode={PUBLIC_DEMO}
      />
    );
  }

  return (
    <AppDataContext.Provider value={{ DATA, NARR, activeSlug, setActiveSlug, companies: runtimeCompanies, setRuntimeCompanies }}>
    <div className={`${entryStage === "revealing" ? "tl-dashboard-reveal " : ""}min-h-screen bg-[#F6F3F1] font-sans text-[#172033] antialiased`}>
      <div className="tl-dashboard-shell">
        <TopHeader query={query} setQuery={setQuery} />
        {DATA?.evidenceOnly ? <EvidencePreview liveRefreshState={liveRefreshState} /> : <DashboardView publicDemo={PUBLIC_DEMO} store={store} setStore={setStore} reviewsById={reviewsById} liveRefreshState={liveRefreshState} liveRefreshMessage={liveRefreshMessage} liveStage={liveStage} onRefreshData={() => startAnalysis(activeSlug)} onExtendWindow={(days) => startAnalysis(activeSlug, { windowDays: days })} />}
        <CompanyBattleCard publicDemo={PUBLIC_DEMO} activeSlug={activeSlug} companies={runtimeCompanies} onCompanyReady={(slug, data) => setRuntimeCompanies((current) => ({ ...current, [slug]: data }))} />
      </div>
      {entryStage === "revealing" && <DashboardTransitionOverlay />}
    </div>
    </AppDataContext.Provider>
  );
}
