import React, { useEffect, useMemo, useState } from "react";
import { Search, ArrowRight, Database, ScanSearch, LayoutDashboard, Check, ShieldCheck } from "lucide-react";
import { GOOGLE_PLAY_LOGO, APP_STORE_LOGO } from "./logos";
import "./EntryFlow.css";

const CORAL = "#F0714E";
const INK = "#172033";
const INK2 = "#34445C";

function companyEntries(companies) {
  return Object.entries(companies || {}).map(([slug, data]) => ({
    slug,
    label: data?.company || slug,
    reviewCount: Number(data?.scopes?.all?.kpis?.nReviews || data?.reviews?.length || 0),
  })).sort((a, b) => b.reviewCount - a.reviewCount || a.label.localeCompare(b.label));
}

function SignalField({ engaged = false, loading = false }) {
  const fragments = [
    [8,28,14],[16,69,9],[25,46,12],[34,23,8],[42,78,13],[52,36,10],
    [61,62,7],[70,29,12],[78,73,9],[87,43,11],[93,61,6],[47,17,7],
  ];
  return (
    <svg
      aria-hidden="true"
      className="tl-signal-field absolute inset-0 h-full w-full"
      data-engaged={engaged || loading ? "true" : "false"}
      viewBox="0 0 1000 650"
      preserveAspectRatio="none"
    >
      <path d="M-80 385 C110 330 225 430 390 350 S700 245 1080 355" fill="none" stroke="#F0714E" strokeWidth="1.15" opacity={loading ? ".62" : ".38"} className="tl-signal-path" />
      <path d="M-40 270 C170 330 300 225 490 300 S760 410 1060 285" fill="none" stroke="#172033" strokeWidth=".7" opacity=".055" />
      <path d="M80 515 C280 445 390 540 585 470 S835 425 1040 490" fill="none" stroke="#172033" strokeWidth=".65" opacity=".04" />
      {fragments.map(([x,y,w], i) => (
        <g key={i} className={i % 2 ? "tl-fragment-a" : "tl-fragment-b"} style={{ transformOrigin: `${x}% ${y}%` }}>
          <line x1={x*10} y1={y*6.5} x2={x*10+w} y2={y*6.5} stroke="#172033" strokeWidth="1" opacity=".28" />
          {i % 3 === 0 ? <circle cx={x*10+w+8} cy={y*6.5} r="1.7" fill="#F0714E" opacity=".42" /> : null}
        </g>
      ))}
    </svg>
  );
}


function ReviewFragments({ reviews = [], snippets: suppliedSnippets = [], visible = false, stage = 0 }) {
  const placeholders = [
    "Support never got back to me…",
    "The latest update made this much harder to use.",
    "Fast, simple and exactly what I needed.",
    "I was charged but could not complete the order.",
    "Everything works until the final step.",
    "Why did this suddenly become so complicated?",
    "The core experience is still really good.",
  ];
  const snippets = useMemo(() => {
    const supplied = (suppliedSnippets || []).map((text) => ({ text }));
    const real = [...supplied, ...(reviews || [])]
      .filter((review) => typeof review?.text === "string" && review.text.trim().length > 12)
      .slice(0, 9)
      .map((review) => {
        const clean = review.text.replace(/\s+/g, " ").trim();
        return clean.length > 72 ? `${clean.slice(0, 69)}…` : clean;
      });
    return real.length ? real : placeholders;
  }, [reviews, suppliedSnippets]);

  return (
    <div aria-hidden="true" className={`tl-review-fragments ${visible ? "is-visible" : ""} stage-${stage}`}>
      {snippets.slice(0, 9).map((text, index) => (
        <span key={`${index}-${text.slice(0, 12)}`} className={`tl-review-fragment rf-${index + 1}`}>
          <span className="tl-review-dot" />“{text}”
        </span>
      ))}
    </div>
  );
}


function ReferenceSignalGraphic({ compact = false, snippets = [] }) {
  const incoming = [
    "M18 78 H168 C205 78 214 92 246 92 H316 C360 92 374 108 412 108 H486",
    "M26 104 H202 C238 104 250 122 286 122 H386 C424 122 440 138 486 138 H548",
    "M12 132 H178 C224 132 240 148 282 148 H420 C458 148 478 154 548 154",
    "M38 158 H230 C266 158 282 170 316 170 H446 C492 170 516 164 578 160",
    "M72 184 H248 C292 184 312 178 344 178 H466 C512 178 548 170 608 162",
    "M42 212 H214 C258 212 278 198 324 198 H468 C526 198 562 178 620 164",
    "M92 238 H278 C324 238 344 216 386 216 H500 C548 216 586 186 632 166",
    "M118 260 H328 C372 260 392 234 432 234 H530 C576 234 608 194 644 168",
    "M246 56 H356 C390 56 400 76 430 76 H502 C532 76 552 104 588 118 H632",
    "M310 86 H402 C438 86 448 106 480 106 H548 C578 106 600 132 640 146",
    "M354 196 H442 C474 196 496 184 526 184 H580 C606 184 622 174 652 164",
    "M420 236 H486 C522 236 548 212 574 202 C600 192 622 178 660 166"
  ];
  const converge = [
    "M486 108 C560 108 596 136 682 156",
    "M548 138 C600 138 626 148 682 156",
    "M548 154 C602 154 632 156 682 156",
    "M578 160 C620 160 646 158 682 156",
    "M608 162 C640 162 660 159 682 156",
    "M620 164 C646 164 664 160 682 156",
    "M632 166 C650 166 668 160 682 156",
    "M644 168 C658 166 670 160 682 156",
    "M632 118 C650 130 664 144 682 156",
    "M640 146 C654 148 666 152 682 156",
    "M652 164 C662 162 672 159 682 156",
    "M660 166 C668 162 674 159 682 156"
  ];
  const textSnips = (snippets || []).filter(Boolean).slice(0, 4);
  return (
    <div className={`tl-ref-signal ${compact ? "is-compact" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 1440 310" preserveAspectRatio="none" className="tl-ref-signal-svg">
        <g className="tl-ref-incoming-base">
          {incoming.map((d,i)=><path key={i} d={d} className={`rp rp-${i+1}`}/>)}
        </g>
        <g className="tl-ref-incoming-motion">
          {incoming.slice(0,8).map((d,i)=><path key={i} d={d} className={`rm rm-${i+1}`}/>)}
        </g>
        <g className="tl-ref-converge">
          {converge.map((d,i)=><path key={i} d={d} className={`rc rc-${i+1}`}/>)}
        </g>
        <path className="tl-ref-output" d="M754 156 C858 149 970 166 1088 163 C1202 160 1314 162 1448 162" />
        <path className="tl-ref-output-pulse" d="M754 156 C858 149 970 166 1088 163 C1202 160 1314 162 1448 162" />
        <g className="tl-ref-ticks">
          {[1088,1198,1302,1392].map((x,i)=><line key={i} x1={x-4} y1="163" x2={x+4} y2="163"/>)}
        </g>
        <g className="tl-ref-microticks">
          <line x1="102" y1="78" x2="112" y2="78"/><line x1="172" y1="104" x2="182" y2="104"/>
          <line x1="240" y1="148" x2="250" y2="148"/><line x1="306" y1="184" x2="316" y2="184"/>
          <line x1="382" y1="216" x2="392" y2="216"/><line x1="454" y1="122" x2="464" y2="122"/>
          <line x1="520" y1="196" x2="530" y2="196"/>
        </g>
      </svg>
      <div className="tl-ref-hub">
        <span className="tl-ref-hub-mark"><i/><b/><i/></span>
        <span className="tl-ref-halo h1"/><span className="tl-ref-halo h2"/>
      </div>
      {textSnips.length ? <div className="tl-ref-live-voices">
        {textSnips.map((t,i)=><span key={i} className={`lv lv-${i+1}`}>{t.length>58?`${t.slice(0,55)}…`:t}</span>)}
      </div> : null}
    </div>
  );
}

function SignatureSignalLoader({ company, activeStep = 0, elapsedSeconds = 0, reviewSnippets = [], sourceLabels = [], ready = false }) {
  const count = reviewSnippets?.length || 0;
  const uiStep = ready ? 4 : activeStep === 0 ? 0 : activeStep === 1 ? 1 : activeStep === 2 ? 2 : 3;
  const milestones = [
    { icon: Database, title: "Sources connected", detail: sourceLabels.length ? sourceLabels.map(s=>s.label).join(" · ") : "Google Play · App Store" },
    { icon: Search, title: "Finding reviews", detail: count ? `${count}+ reviews found` : "Public feedback arriving" },
    { icon: ScanSearch, title: "Extracting signals", detail: "Customer signals identified" },
    { icon: LayoutDashboard, title: "Themes emerging", detail: "Themes taking shape" },
    { icon: Check, title: "Initial view ready", detail: "Almost there…" },
  ];
  const eta = elapsedSeconds < 40 ? "First signal expected in ~25–40s" : elapsedSeconds < 70 ? "More evidence than expected · still processing" : "Finishing the first signal · taking longer than usual";
  return (
    <div className="tl-reference-loader">
      <div className="tl-reference-brand">Throughline</div>
      <ReferenceSignalGraphic snippets={reviewSnippets} />
      <section className="tl-reference-copy">
        <h1>Building Throughline for <em>{company}</em></h1>
        <p>Turning customer voices into clear direction.</p>
      </section>
      <div className="tl-reference-milestones">
        {milestones.map((m, i) => {
          const Icon = m.icon;
          const state = i < uiStep ? 'is-complete' : i === uiStep ? 'is-active' : 'is-pending';
          return <div key={m.title} className={`tl-reference-step ${state}`}>
            <div className="tl-reference-step-line"/>
            <div className="tl-reference-step-icon"><Icon size={22} strokeWidth={1.8}/></div>
            <strong>{m.title}</strong><span>{m.detail}</span>
          </div>
        })}
      </div>
      <div className="tl-reference-timing"><strong>{elapsedSeconds}s</strong><span>elapsed</span><i/><span>{eta}</span></div>
      <div className="tl-reference-trust"><ShieldCheck size={15}/><span>Secure · Private · Compliant</span></div>
    </div>
  );
}

function SourceMark({ id, label }) {
  const logo = id === "google_play" ? GOOGLE_PLAY_LOGO : id === "app_store" ? APP_STORE_LOGO : null;
  return (
    <span className="tl-source-mark">
      {logo ? <img src={logo} alt="" className="tl-source-logo" /> : null}
      <span>{label}</span>
    </span>
  );
}

function DashboardSkeleton({ visible = false, stage = 0 }) {
  return (
    <div aria-hidden="true" className={`tl-dashboard-skeleton tl-dashboard-blueprint ${visible ? "is-visible" : ""} stage-${stage}`}>
      <div className="tl-blueprint-topbar">
        <div className="tl-blueprint-brand"><span className="tl-blueprint-brandline" /></div>
        <div className="tl-blueprint-search" />
        <div className="tl-blueprint-actions"><span /><span /></div>
      </div>
      <div className="tl-blueprint-body">
        <div className="tl-blueprint-context">
          <span className="tl-blueprint-eyebrow" />
          <span className="tl-blueprint-company" />
          <div className="tl-blueprint-source-row"><span/><span/><span/></div>
        </div>
        <div className="tl-blueprint-kpis">
          {[0,1,2,3].map((i)=><div key={i} className="tl-blueprint-kpi"><span className="kpi-label"/><span className="kpi-value"/><span className="kpi-meta"/></div>)}
        </div>
        <div className="tl-blueprint-primary">
          <div className="tl-blueprint-theme-panel">
            <div className="tl-blueprint-panel-head"><span/><span/></div>
            {[0,1,2,3].map((i)=><div key={i} className="tl-blueprint-theme-row"><span className="theme-name"/><span className="theme-volume"/><span className="theme-bar"/><span className="theme-action"/></div>)}
          </div>
          <div className="tl-blueprint-voice-panel">
            <div className="tl-blueprint-panel-head"><span/><span/></div>
            <div className="tl-blueprint-voice-chip"/>
            <div className="tl-blueprint-quote"><span/><span/><span/></div>
          </div>
        </div>
        <div className="tl-blueprint-secondary">
          <div className="tl-blueprint-insight-panel"><span className="section-title"/><span className="insight-headline"/><span className="insight-line"/><span className="insight-line short"/></div>
          <div className="tl-blueprint-action-panel"><span className="section-title"/><div className="action-row"/><div className="action-row muted"/></div>
        </div>
      </div>
      <div className="tl-blueprint-scanline" />
    </div>
  );
}

export function SearchPage({ companies, onSelectCompany, demoMode = false }) {
  const entries = useMemo(() => companyEntries(companies), [companies]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [suggestionPage, setSuggestionPage] = useState(0);
  const [suggestionsPaused, setSuggestionsPaused] = useState(false);
  const normalized = query.trim().toLowerCase();
  const suggestions = normalized
    ? entries.filter((entry) => entry.label.toLowerCase().includes(normalized))
    : entries;
  const suggestionCount = Math.min(4, entries.length);
  const visibleSuggestions = Array.from({ length: suggestionCount }, (_, offset) => entries[(suggestionPage + offset) % entries.length]).filter(Boolean);

  useEffect(() => {
    if (suggestionsPaused || entries.length <= suggestionCount) return undefined;
    const timer = window.setInterval(() => setSuggestionPage((page) => (page + suggestionCount) % entries.length), 5000);
    return () => window.clearInterval(timer);
  }, [entries.length, suggestionCount, suggestionsPaused]);

  const submit = (event) => {
    event.preventDefault();
    const raw = query.trim();
    if (!raw) {
      setError("Enter a company or product name.");
      return;
    }
    const exact = entries.find((entry) => entry.label.toLowerCase() === normalized);
    if (demoMode && !exact) {
      setError(`This public demo includes ${entries.map((entry) => entry.label).join(", ")}. Live company analysis is kept private.`);
      return;
    }
    setError("");
    // Known companies reuse their stable slug. Any other query is sent to the
    // runtime resolver, which discovers public iOS / Android listings without
    // requiring the company to be preconfigured in the frontend.
    onSelectCompany(exact ? exact.slug : raw);
  };

  const choose = (slug) => {
    setError("");
    onSelectCompany(slug);
  };

  return (
    <div className="tl-search-reference min-h-screen font-sans text-slate-900 antialiased">
      <header className="tl-search-reference-header"><strong>Throughline</strong>{demoMode && <span className="tl-demo-label">Working prototype · portfolio demo</span>}</header>
      <main className="tl-search-reference-main">
        <ReferenceSignalGraphic compact />
        <section className="tl-search-reference-copy">
          <h1>Find the signal in customer feedback</h1>
          <p>Search a company. Throughline turns recent public customer voices into clear direction.</p>
        </section>
        <form onSubmit={submit} className="tl-search-reference-form">
          <div className={`tl-search-reference-box ${query ? "has-query" : ""}`}>
            <Search size={20} strokeWidth={1.8}/>
            <input autoFocus value={query} onChange={(event)=>{setQuery(event.target.value);setError("");}} placeholder="Search a company" aria-label="Search a company"/>
            <button type="submit">{demoMode ? "Open demo" : "Analyze"} <ArrowRight size={16}/></button>
          </div>
          {error ? <p className="tl-search-reference-error">{error}</p> : null}
        </form>
        <div className="tl-search-reference-try" onMouseEnter={()=>setSuggestionsPaused(true)} onMouseLeave={()=>setSuggestionsPaused(false)}>
          <span>{demoMode ? "Available" : "Try"}</span>
          <div key={suggestionPage} className="tl-search-suggestion-roll">
            {visibleSuggestions.map((entry, index)=><button key={entry.slug} style={{"--tl-company-delay":`${index * 55}ms`}} type="button" onClick={()=>choose(entry.slug)}>{entry.label}</button>)}
          </div>
        </div>
        <div className="tl-search-reference-trust"><ShieldCheck size={15}/><span>{demoMode ? "Cached demonstration data · no credentials required" : "Secure · Private · Compliant"}</span></div>
      </main>
    </div>
  );
}

const STEPS = [
  "Collecting sources",
  "Structuring feedback",
  "Identifying themes",
  "Building your dashboard",
];

export function AnalysisLoading({ company, data, ready = false, error = "", onComplete, onBack, backendStage = 0, reviewSnippets = [] }) {
  const [activeStep, setActiveStep] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const isFirstLoad = !data;

  useEffect(() => {
    setActiveStep(0);
    setElapsedSeconds(0);
  }, [company]);

  useEffect(() => {
    setActiveStep(Math.max(0, Math.min(3, Number(backendStage) || 0)));
  }, [backendStage]);

  useEffect(() => {
    if (!isFirstLoad || error) return undefined;
    const started = Date.now();
    const tick = () => setElapsedSeconds(Math.floor((Date.now() - started) / 1000));
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [company, isFirstLoad, error]);

  useEffect(() => {
    if (!ready || activeStep < 3) return undefined;
    const timer = window.setTimeout(() => onComplete(), 260);
    return () => window.clearTimeout(timer);
  }, [ready, activeStep, onComplete]);

  const sourceLabels = (data?.sources || []).filter((source) => source.id !== "all");
  const stageCopy = [
    "Finding and validating the public feedback sources for this product.",
    "Reviews are arriving and being structured into usable evidence.",
    "Patterns are emerging across themes, sentiment and rating impact.",
    "The first usable dashboard is resolving from the evidence now.",
  ];
  const activeStageLabel = activeStep === 0 && elapsedSeconds >= 28 ? "Validating source identity" : STEPS[activeStep];
  const adaptiveStageCopy = activeStep === 0 && elapsedSeconds >= 28
    ? "Matching the right product across public app-store sources — not just the brand name."
    : stageCopy[activeStep];
  const estimateCopy = elapsedSeconds < 40
    ? "Expected first signal · 25–40s"
    : elapsedSeconds < 75
      ? "Taking longer than usual · still building the first signal"
      : "Still working · this source match is taking longer than usual";

  return (
    <div className="tl-loading-experience relative min-h-screen overflow-hidden bg-[#FBF7F6] font-sans text-slate-900 antialiased">
      <SignatureSignalLoader
        company={company}
        activeStep={activeStep}
        elapsedSeconds={elapsedSeconds}
        reviewSnippets={reviewSnippets}
        sourceLabels={sourceLabels}
        ready={ready}
      />
      {error ? (
        <section className="tl-loading-error tl-signature-error" aria-live="assertive">
          <p className="text-sm font-semibold text-red-700">Live analysis couldn’t complete</p>
          <p className="mt-2 text-sm leading-6 text-[#4B403C]">{error}</p>
          <button type="button" onClick={onBack} className="mt-5 rounded-lg border border-[#D2CECB] bg-white px-4 py-2 text-sm font-semibold text-[#172033] hover:bg-[#FBF7F6]">Back to search</button>
        </section>
      ) : null}
    </div>
  );
}


export function DashboardTransitionOverlay() {
  return (
    <div className="tl-transition-overlay pointer-events-none fixed inset-0 z-[100] overflow-hidden">
      <div className="tl-transition-wash absolute inset-0" />
      <svg aria-hidden="true" className="absolute inset-0 h-full w-full" viewBox="0 0 1000 650" preserveAspectRatio="none">
        <path d="M-90 380 C120 315 260 430 420 340 S735 245 1090 350" fill="none" stroke="#F0714E" strokeWidth="1.45" opacity=".7" />
      </svg>
    </div>
  );
}
