import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Check, ChevronRight, Download, Info, RefreshCw, Search, ShieldCheck, Sparkles, TrendingUp, X } from "lucide-react";
import battleCardNarratives from "./battle_card_narratives.json";

/*
 * Company Battle Card
 * -------------------
 * Scores are deterministic. Anthropic is interpretation only: if a precomputed
 * AI narrative is added to the comparison data later, the UI can surface it
 * without changing the scorecard mechanics.
 */

const UX_DIMENSIONS = [
  {
    id: "ease",
    label: "Ease of use & navigation",
    keywords: ["usability", "navigation", "redesign", "feature parity", "compatibility", "library", "import"],
  },
  {
    id: "reliability",
    label: "Reliability & performance",
    keywords: ["stability", "performance", "technical", "crash", "freeze"],
  },
  {
    id: "access",
    label: "Onboarding & access",
    keywords: ["login", "signup", "sign up", "identity", "verification", "authentication", "account access", "data privacy"],
  },
  {
    id: "core",
    label: "Core feature experience",
    keywords: ["building capability", "voice quality", "narration", "loyalty card", "payment plans", "spending limits", "content import", "feature parity"],
  },
  {
    id: "overall",
    label: "Overall product experience",
    keywords: ["overall app", "overall experience", "overall app and service"],
  },
];

const CX_DIMENSIONS = [
  {
    id: "overall",
    label: "Overall customer experience",
    keywords: ["overall app", "overall experience", "overall app and service"],
  },
  {
    id: "trust",
    label: "Trust & confidence",
    keywords: ["identity", "verification", "authentication", "login", "account access", "signup", "data privacy", "disputes", "refunds"],
  },
  {
    id: "support",
    label: "Service & support",
    keywords: ["customer support", "support responsiveness", "disputes", "refunds"],
  },
  {
    id: "value",
    label: "Value perception",
    keywords: ["pricing", "subscription", "billing", "credits", "payment plans", "spending limits", "charges"],
  },
  {
    id: "advocacy",
    label: "Loyalty & advocacy",
    keywords: ["loyalty", "overall app", "overall experience", "voice quality", "building capability"],
  },
];

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const scoreFromSentiment = (sentiment) => clamp(Math.round((Number(sentiment) + 1) * 50), 0, 100);

const evidenceLevel = (n) => {
  if (!n) return { label: "No evidence", tone: "none" };
  if (n >= 25) return { label: "High evidence", tone: "high" };
  if (n >= 10) return { label: "Moderate evidence", tone: "moderate" };
  return { label: "Limited evidence", tone: "limited" };
};

function matchedThemes(data, keywords) {
  const themes = data?.scopes?.all?.themes || [];
  return themes.filter((theme) => {
    const haystack = `${theme.theme || ""} ${theme.summary || ""} ${theme.action || ""}`.toLowerCase();
    return keywords.some((keyword) => haystack.includes(keyword));
  });
}

function dimensionScore(data, dimension) {
  const themes = matchedThemes(data, dimension.keywords);
  if (!themes.length) return { score: null, evidence: 0, sentiment: null, themes: [], confidence: evidenceLevel(0) };

  const weighted = themes.reduce(
    (acc, theme) => {
      const weight = Math.max(1, Number(theme.volume) || 1);
      acc.sum += (Number(theme.sentiment) || 0) * weight;
      acc.weight += weight;
      acc.evidence += Number(theme.volume) || 0;
      return acc;
    },
    { sum: 0, weight: 0, evidence: 0 }
  );
  const sentiment = weighted.weight ? weighted.sum / weighted.weight : 0;
  return {
    score: scoreFromSentiment(sentiment),
    evidence: weighted.evidence,
    sentiment,
    themes,
    confidence: evidenceLevel(weighted.evidence),
  };
}

function buildComparison(companyA, companyB, lens) {
  const dimensions = lens === "cx" ? CX_DIMENSIONS : UX_DIMENSIONS;
  return dimensions.map((dimension) => {
    const a = dimensionScore(companyA, dimension);
    const b = dimensionScore(companyB, dimension);
    return {
      ...dimension,
      a,
      b,
      gap: a.score == null || b.score == null ? null : a.score - b.score,
    };
  });
}

function comparisonSignals(rows) {
  const comparable = rows.filter((r) => r.gap != null);
  const byGap = [...comparable].sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
  const largest = byGap[0] || null;
  const sharedStrength = [...comparable]
    .filter((r) => r.a.score >= 65 && r.b.score >= 65)
    .sort((a, b) => ((b.a.score + b.b.score) / 2) - ((a.a.score + a.b.score) / 2))[0] || null;
  const sharedFriction = [...comparable]
    .filter((r) => r.a.score < 50 && r.b.score < 50)
    .sort((a, b) => ((a.a.score + a.b.score) / 2) - ((b.a.score + b.b.score) / 2))[0] || null;
  return { largest, sharedStrength, sharedFriction };
}

function deterministicTakeaway(rows, aName, bName) {
  const comparable = rows.filter((r) => r.gap != null).sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
  if (!comparable.length) return "There is not enough matched evidence to identify a meaningful experience pattern yet.";

  const aAdvantages = comparable.filter((r) => r.gap >= 6);
  const bAdvantages = comparable.filter((r) => r.gap <= -6);
  const signals = comparisonSignals(rows);
  const missing = rows.filter((r) => r.a.score == null || r.b.score == null);
  const largest = comparable[0];
  const leader = largest.gap > 0 ? aName : bName;
  const trailing = largest.gap > 0 ? bName : aName;
  const split = aAdvantages.length > 0 && bAdvantages.length > 0;

  const pattern = split
    ? `The comparison is split rather than one-sided: ${aName} is stronger on ${aAdvantages[0].label.toLowerCase()}, while ${bName} is stronger on ${bAdvantages[0].label.toLowerCase()}.`
    : `${leader}'s clearest separation is on ${largest.label.toLowerCase()}, where the experience score is ${Math.abs(largest.gap)} points higher than ${trailing}.`;

  let implication = "";
  if (signals.sharedStrength && signals.sharedFriction) {
    implication = `Both companies perform well on ${signals.sharedStrength.label.toLowerCase()}, but ${signals.sharedFriction.label.toLowerCase()} is a shared weakness, so the meaningful differentiation sits elsewhere.`;
  } else if (signals.sharedStrength) {
    implication = `${signals.sharedStrength.label} is a shared strength, so it is less useful as a differentiator than the larger gaps above.`;
  } else if (signals.sharedFriction) {
    implication = `${signals.sharedFriction.label} is weak for both, making it a common experience risk rather than a differentiator.`;
  } else {
    implication = `The practical distinction is concentrated in a small number of dimensions rather than a broad advantage across the whole experience.`;
  }

  const uncertainty = missing.length
    ? `Matched evidence is incomplete for ${missing.map((r) => r.label.toLowerCase()).join(" and ")}, so that area should not be used to draw a firm conclusion.`
    : `Evidence is available across all standardized dimensions in this lens.`;

  return `${pattern} ${implication} ${uncertainty}`;
}

function CompareGlyph({ className = "" }) {
  return (
    <svg viewBox="0 0 38 38" className={className} aria-hidden="true">
      <path d="M3 10.5C10 10.5 11 18.9 18.2 19c7.2.1 8.4 8.5 16.8 8.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M3 27.5c7 0 8-8.4 15.2-8.5C25.4 18.9 26.6 10.5 35 10.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" opacity=".5" />
      <circle cx="18.8" cy="19" r="3.4" fill="#F0714E" stroke="#FFFDFC" strokeWidth="1.5" />
    </svg>
  );
}

function comparisonEvidencePeriod(a, b) {
  const bounds = (data) => {
    const dates = (data?.reviews || []).map((review) => review.date).filter(Boolean).sort();
    return dates.length ? [dates[0], dates[dates.length - 1]] : null;
  };
  const aa = bounds(a), bb = bounds(b);
  if (!aa || !bb) return null;
  const start = aa[0] > bb[0] ? aa[0] : bb[0];
  const end = aa[1] < bb[1] ? aa[1] : bb[1];
  if (start > end) return "No overlapping review period";
  const pretty = (value) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
  return `${pretty(start)} – ${pretty(end)}`;
}

function HelpPopover({ type, open, setOpen }) {
  const isScore = type === "score";
  const label = isScore ? "How experience score works" : "Battle card methodology";
  return (
    <div className="relative" data-battle-help>
      <button
        type="button"
        onClick={() => setOpen(open ? null : type)}
        className={isScore
          ? "inline-flex h-7 w-7 items-center justify-center rounded-full text-[#8A7F79] transition hover:bg-[#F3EEEB] hover:text-[#172033] focus:outline-none focus:ring-2 focus:ring-[#F0714E]/25"
          : "font-medium text-[#4B403C] underline decoration-[#BFAFA6] underline-offset-4 transition hover:text-[#172033] focus:outline-none focus:ring-2 focus:ring-[#F0714E]/20"}
        aria-label={label}
        aria-expanded={open}
      >
        {isScore ? <Info size={15} strokeWidth={2} /> : "Methodology"}
      </button>
      {open && (
        <div className={`absolute z-30 w-[340px] rounded-lg border border-[#D2C7C1] bg-[#FFFDFC] p-4 shadow-[0_14px_30px_rgba(23,32,51,0.12)] ${isScore ? "left-0 top-9" : "bottom-7 left-0"}`} role="dialog" aria-label={label}>
          <div className="flex items-start justify-between gap-3">
            <div className="text-sm font-semibold text-[#172033]">{isScore ? "How Experience Score works" : "How this comparison is built"}</div>
            <button type="button" onClick={() => setOpen(null)} aria-label="Close" className="rounded p-1 text-[#8A7F79] hover:bg-[#F3EEEB] hover:text-[#172033]"><X size={14} /></button>
          </div>
          {isScore ? (
            <>
              <p className="mt-2 text-[13px] leading-5 text-[#4B403C]">A normalized 0–100 measure based on sentiment within reviews mapped to this experience dimension.</p>
              <div className="mt-3 grid grid-cols-3 gap-2 border-y border-[#E7DFDB] py-3 text-center">
                <div><div className="font-semibold text-[#172033]">0–49</div><div className="text-[11px] text-[#8A7F79]">Negative</div></div>
                <div><div className="font-semibold text-[#172033]">50</div><div className="text-[11px] text-[#8A7F79]">Neutral</div></div>
                <div><div className="font-semibold text-[#172033]">51–100</div><div className="text-[11px] text-[#8A7F79]">Positive</div></div>
              </div>
              <p className="mt-3 text-[12px] leading-5 text-[#8A7F79]">Review volume is shown separately as Evidence and never increases the score.</p>
            </>
          ) : (
            <div className="mt-2 space-y-2 text-[12px] leading-5 text-[#4B403C]">
              <p>Reviews are mapped into the same standardized dimensions for both companies so the comparison remains apples-to-apples.</p>
              <p>Experience Score reflects sentiment quality only. Evidence volume and confidence are shown separately and do not inflate the score.</p>
              <p className="text-[#8A7F79]">If matched evidence is insufficient for either company, Throughline leaves the score unavailable rather than estimating it.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Dumbbell({ a, b, aName, bName }) {
  if (a == null || b == null) {
    return <div className="flex h-11 items-center text-xs text-[#8A7F79]">Not enough matched evidence</div>;
  }
  const left = Math.min(a, b);
  const right = Math.max(a, b);
  const closeScores = Math.abs(a - b) < 4;
  const aTop = closeScores ? 9 : 13;
  const bTop = closeScores ? 18 : 13;
  return (
    <div className="relative h-11 min-w-[220px]" aria-label={`${aName} Experience Score ${a} out of 100, ${bName} Experience Score ${b} out of 100`}>
      <div className="absolute left-0 right-0 top-[21px] h-px bg-[#D9D0CB]" />
      <div className="absolute top-[19px] h-[5px] rounded-full bg-[#E4C1B4]" style={{ left: `${left}%`, width: `${Math.max(2, right - left)}%` }} />
      <div className="absolute -translate-x-1/2" style={{ left: `${a}%`, top: `${aTop}px` }}>
        <span className="block h-[17px] w-[17px] rounded-full border-[3px] border-[#FFFDFC] bg-[#172033] shadow-[0_1px_3px_rgba(23,32,51,.22)]" />
      </div>
      <div className="absolute -translate-x-1/2" style={{ left: `${b}%`, top: `${bTop}px` }}>
        <span className="block h-[17px] w-[17px] rounded-full border-[3px] border-[#FFFDFC] bg-[#F0714E] shadow-[0_1px_3px_rgba(240,113,78,.25)]" />
      </div>
    </div>
  );
}

function EvidenceBadge({ confidence }) {
  const styles = {
    high: "border-[#C6D9D0] bg-[#F1F7F4] text-[#365D4C]",
    moderate: "border-[#DED1B8] bg-[#FBF7ED] text-[#7B6237]",
    limited: "border-[#E3C6BB] bg-[#FCF2EE] text-[#8A4C38]",
    none: "border-[#DED6D1] bg-[#F8F5F3] text-[#8A7F79]",
  };
  return <span className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${styles[confidence.tone]}`}>{confidence.label}</span>;
}

function DimensionEvidence({ row, aName, bName, onBack }) {
  const side = (label, d, accent) => (
    <div className="border-t border-[#E6DEDA] pt-3 first:border-0 first:pt-0">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[13px] font-semibold text-[#172033]">{label}</div>
        <div className="tabular-nums" style={{ color: accent }}><span className="text-lg font-semibold">{d.score ?? "—"}</span>{d.score != null && <span className="ml-0.5 text-[10px] font-medium text-[#8A7F79]">/100</span>}</div>
      </div>
      <div className="mt-1 flex items-center gap-2 text-[11px] text-[#8A7F79]">
        <span><span className="font-medium text-[#4B403C]">Evidence:</span> {d.evidence} mentions</span><span>·</span><EvidenceBadge confidence={d.confidence} />
      </div>
      {d.themes.length ? (
        <div className="mt-2 space-y-1">
          {d.themes.slice(0, 3).map((t) => <div key={t.theme} className="text-[12px] leading-4 text-[#4B403C]">{t.theme}</div>)}
        </div>
      ) : <div className="mt-2 text-xs text-[#8A7F79]">No matched theme evidence.</div>}
    </div>
  );

  return (
    <div className="rounded-xl border border-[#D8CEC8] bg-[#FFFDFC] p-5">
      <button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-[#8A7F79] hover:text-[#172033]"><ArrowLeft size={13} /> Back to summary</button>
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8A7F79]">Evidence behind this dimension</div>
      <h3 className="mt-1 text-lg font-semibold text-[#172033]">{row.label}</h3>
      <p className="mt-1 text-xs leading-5 text-[#8A7F79]">Scores use only reviews mapped to this standardized dimension.</p>
      <div className="mt-4 space-y-4">
        {side(aName, row.a, "#172033")}
        {side(bName, row.b, "#F0714E")}
      </div>
    </div>
  );
}

function buildExecutiveDifferences(rows, signals, aName, bName) {
  const comparable = rows.filter((r) => r.gap != null).sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
  const advantages = comparable.filter((r) => Math.abs(r.gap) >= 4).slice(0, 2).map((r) => {
    const leader = r.gap > 0 ? aName : bName;
    const lagger = r.gap > 0 ? bName : aName;
    const leaderScore = r.gap > 0 ? r.a.score : r.b.score;
    const laggerScore = r.gap > 0 ? r.b.score : r.a.score;
    const weakArea = leaderScore < 50 && laggerScore < 50;
    return {
      tone: weakArea ? "attention" : "positive",
      label: weakArea ? "Relative advantage in a weak area" : `Stronger for ${leader}`,
      text: `${r.label}: ${leader} scores ${Math.abs(r.gap)} points higher (${leaderScore} vs ${laggerScore}).`,
    };
  });
  const items = [...advantages];
  if (signals.sharedStrength) items.push({ tone: "positive", label: "Shared strength", text: `${signals.sharedStrength.label}: both companies score 65 or higher.` });
  if (signals.sharedFriction) items.push({ tone: "negative", label: "Shared weakness", text: `${signals.sharedFriction.label}: both companies score below 50.` });
  const missing = rows.filter((r) => r.a.score == null || r.b.score == null);
  if (missing.length) items.push({ tone: "attention", label: "Evidence gap", text: `${missing.map((r) => r.label).join(", ")} cannot be compared reliably with the matched evidence available.` });
  return items.slice(0, 4);
}

function ExportExecutiveSummary({ rows, signals, aName, bName, takeaway }) {
  const items = buildExecutiveDifferences(rows, signals, aName, bName);
  return (
    <section className="battle-export-only border-b border-[#D8CEC8] px-8 py-6">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8A7F79]">Executive summary · Main differences</div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {items.map((item, idx) => (
          <div key={`${item.label}-${idx}`} className={`rounded-lg border px-4 py-3 ${item.tone === "positive" ? "border-[#C7DAD0] bg-[#F2F8F5]" : item.tone === "negative" ? "border-[#E5C3BA] bg-[#FCF1EE]" : "border-[#E2D6BD] bg-[#FBF7EE]"}`}>
            <div className={`text-[10px] font-semibold uppercase tracking-[0.08em] ${item.tone === "positive" ? "text-[#3F6D59]" : item.tone === "negative" ? "text-[#A44734]" : "text-[#81683B]"}`}>{item.label}</div>
            <div className="mt-1 text-[12px] leading-5 text-[#172033]">{item.text}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-lg border border-[#D9C6BD] bg-[#FBF3EF] px-4 py-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8A7F79]">Throughline interpretation</div>
        <p className="mt-1 text-[12px] leading-5 text-[#4B403C]">{takeaway}</p>
      </div>
    </section>
  );
}

function exportBattleCardPDF() {
  document.body.classList.add("battle-card-print");
  const cleanup = () => document.body.classList.remove("battle-card-print");
  window.addEventListener("afterprint", cleanup, { once: true });
  window.print();
  window.setTimeout(cleanup, 1500);
}

function BattleCardResult({ activeData, comparisonData, activeSlug, comparisonSlug, lens, onLensChange, onChange, onClose }) {
  const [openHelp, setOpenHelp] = useState(null);
  const [selectedRow, setSelectedRow] = useState(null);
  const rows = useMemo(() => buildComparison(activeData, comparisonData, lens), [activeData, comparisonData, lens]);
  const aName = activeData?.company || "Current company";
  const bName = comparisonData?.company || "Comparison company";
  const signals = comparisonSignals(rows);
  const canonicalKey = [activeSlug, comparisonSlug].sort().join("__") + `__${lens}`;
  const aiNarrative = battleCardNarratives?.[canonicalKey];
  const takeaway = aiNarrative?.summary || deterministicTakeaway(rows, aName, bName);
  const isAISummary = aiNarrative?.generatedBy === "anthropic";

  useEffect(() => {
    if (!openHelp) return undefined;
    const onPointerDown = (event) => {
      if (!event.target.closest?.("[data-battle-help]")) setOpenHelp(null);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpenHelp(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openHelp]);

  const gapLabel = (row) => {
    if (!row || row.gap == null) return "Not enough evidence";
    if (Math.abs(row.gap) < 4) return `Near parity · ${Math.abs(row.gap)}-point gap`;
    return `${row.gap > 0 ? aName : bName} +${Math.abs(row.gap)}`;
  };

  return (
    <>
      <div className="flex items-start justify-between gap-6 border-b border-[#DED6D1] px-8 py-6">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[#8A7F79]">Company Battle Card</div>
          <h2 className="mt-1 text-[28px] font-semibold tracking-[-0.03em] text-[#172033]">{aName} <span className="font-normal text-[#8A7F79]">↔</span> {bName}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[#8A7F79]">
            <div className="battle-lens-switch battle-print-hide" role="group" aria-label="Comparison lens"><button type="button" className={lens === "ux" ? "is-active" : ""} onClick={() => onLensChange("ux")}>UX / Product</button><button type="button" className={lens === "cx" ? "is-active" : ""} onClick={() => onLensChange("cx")}>CX</button></div><span>All matched sources</span><span>·</span><span>Standardized dimensions</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={exportBattleCardPDF} className="battle-print-hide inline-flex items-center gap-1.5 rounded-lg border border-[#D7CDC7] bg-[#FFFDFC] px-3 py-2 text-xs font-semibold text-[#4B403C] transition hover:border-[#BFAFA6] hover:bg-[#F8F4F2] hover:text-[#172033]">
            <Download size={14} /> Export PDF
          </button>
          <button type="button" onClick={onChange} className="battle-print-hide rounded-lg border border-[#D7CDC7] bg-white px-3 py-2 text-xs font-semibold text-[#4B403C] transition hover:bg-[#F8F4F2]">Change comparison</button>
          <button type="button" onClick={onClose} aria-label="Close battle card" className="battle-print-hide rounded-lg p-2 text-[#8A7F79] transition hover:bg-[#F3EEEB] hover:text-[#172033]"><X size={19} /></button>
        </div>
      </div>

      <ExportExecutiveSummary rows={rows} signals={signals} aName={aName} bName={bName} takeaway={takeaway} />

      <div className="grid gap-6 px-7 py-6 lg:grid-cols-[minmax(0,1fr)_270px]">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-1.5">
            <h3 className="text-sm font-semibold text-[#172033]">Experience comparison</h3>
            <HelpPopover type="score" open={openHelp === "score"} setOpen={setOpenHelp} />
          </div>
          <p className="mb-5 max-w-2xl text-[13px] leading-5 text-[#4B403C]"><span className="font-semibold text-[#172033]">Experience Score (0–100)</span> shows how positively the dimension is discussed. <span className="font-semibold text-[#172033]">Evidence mentions</span> show how many review mentions support the score.</p>

          <div className="grid grid-cols-[minmax(170px,1fr)_minmax(230px,1.35fr)_84px_84px] items-end gap-4 border-b border-[#D8CEC8] pb-2 text-[11px] font-semibold text-[#8A7F79]">
            <div>Dimension</div>
            <div>Experience comparison</div>
            <div className="text-right">
              <div className="text-[#172033]">{aName}</div>
              <div className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.06em] text-[#8A7F79]">Score /100</div>
            </div>
            <div className="text-right">
              <div className="text-[#F0714E]">{bName}</div>
              <div className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.06em] text-[#8A7F79]">Score /100</div>
            </div>
          </div>

          <div className="divide-y divide-[#E7DFDB]">
            {rows.map((row) => {
              const delta = row.gap == null ? null : Math.abs(row.gap);
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSelectedRow(row)}
                  className="group relative grid w-full grid-cols-[minmax(170px,1fr)_minmax(230px,1.35fr)_84px_84px] items-center gap-4 py-4 text-left transition hover:bg-[#FBF7F5] focus:bg-[#FBF7F5] focus:outline-none"
                >
                  <div className="min-w-0 pr-2">
                    <div className="text-[13px] font-semibold leading-5 text-[#172033]">{row.label}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[#8A7F79]">
                      <span><span className="font-medium text-[#4B403C]">Evidence mentions:</span> {aName} {row.a.evidence} · {bName} {row.b.evidence}</span>
                      {delta != null && delta >= 10 && <span className="font-medium text-[#A94F36]">· {gapLabel(row)}</span>}
                    </div>
                  </div>
                  <Dumbbell a={row.a.score} b={row.b.score} aName={aName} bName={bName} />
                  <div className="text-right tabular-nums text-[#172033]">
                    <span className="text-base font-semibold">{row.a.score ?? "—"}</span>{row.a.score != null && <span className="ml-0.5 text-[10px] font-medium text-[#8A7F79]">/100</span>}
                  </div>
                  <div className="text-right tabular-nums text-[#F0714E]">
                    <span className="text-base font-semibold">{row.b.score ?? "—"}</span>{row.b.score != null && <span className="ml-0.5 text-[10px] font-medium text-[#8A7F79]">/100</span>}
                  </div>
                  <div className="pointer-events-none absolute right-3 top-2 z-10 translate-y-1 rounded-lg border border-[#D8CEC8] bg-[#FFFDFC] px-3 py-2 text-[10px] leading-4 text-[#4B403C] opacity-0 shadow-[0_10px_25px_rgba(23,32,51,.10)] transition group-hover:translate-y-0 group-hover:opacity-100 group-focus:translate-y-0 group-focus:opacity-100">
                    <div className="font-semibold text-[#172033]">{gapLabel(row)}</div>
                    <div>{aName}: score {row.a.score ?? "—"}/100 · {row.a.evidence} evidence mentions · {row.a.confidence.label}</div>
                    <div>{bName}: score {row.b.score ?? "—"}/100 · {row.b.evidence} evidence mentions · {row.b.confidence.label}</div>
                    <div className="mt-1 text-[#8A7F79]">Click for evidence</div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-5 border-t border-[#D8CEC8] pt-4 text-[11px] text-[#8A7F79]">
            <div className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#172033]" /> {aName}</div>
            <div className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#F0714E]" /> {bName}</div>
            <HelpPopover type="methodology" open={openHelp === "methodology"} setOpen={setOpenHelp} />
          </div>
        </div>

        <aside className="space-y-3">
          {selectedRow ? (
            <DimensionEvidence row={selectedRow} aName={aName} bName={bName} onBack={() => setSelectedRow(null)} />
          ) : (
            <>
              <div className="rounded-xl border border-[#D8CEC8] bg-[#FFFDFC] p-5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8A7F79]">Guided readout</div>
                <div className="mt-4 space-y-3">
                  <div className="rounded-lg border border-[#E4C3B9] bg-[#FFF4F0] p-3.5">
                    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#A44734]"><TrendingUp size={13} /> Relative advantage</div>
                    <div className="mt-1.5 text-sm font-semibold leading-5 text-[#172033]">{signals.largest ? `${signals.largest.gap > 0 ? aName : bName} is stronger on ${signals.largest.label.toLowerCase()}` : "Not enough evidence"}</div>
                    {signals.largest && <div className="mt-1 text-xs text-[#4B403C]">{Math.abs(signals.largest.gap)}-point advantage · {signals.largest.a.score} vs {signals.largest.b.score}</div>}
                  </div>

                  <div className="rounded-lg border border-[#C9D8D1] bg-[#F3F8F5] p-3.5">
                    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#3F6D59]"><ShieldCheck size={13} /> Shared strength</div>
                    <div className="mt-1.5 text-sm font-semibold leading-5 text-[#172033]">{signals.sharedStrength?.label || "No clear shared strength"}</div>
                    {signals.sharedStrength && <div className="mt-1 text-xs text-[#4B403C]">Positive for both · scores {signals.sharedStrength.a.score} and {signals.sharedStrength.b.score}</div>}
                  </div>

                  <div className={`rounded-lg border p-3.5 ${signals.sharedFriction ? "border-[#E7C1B8] bg-[#FCF1EE]" : "border-[#DED6D1] bg-[#FAF7F5]"}`}>
                    <div className={`flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.08em] ${signals.sharedFriction ? "text-[#A44734]" : "text-[#8A7F79]"}`}><AlertTriangle size={13} /> Shared weakness</div>
                    <div className="mt-1.5 text-sm font-semibold leading-5 text-[#172033]">{signals.sharedFriction?.label || "No material shared weakness"}</div>
                    {signals.sharedFriction && <div className="mt-1 text-xs text-[#4B403C]">Negative for both · scores {signals.sharedFriction.a.score} and {signals.sharedFriction.b.score}</div>}
                  </div>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-xl border border-[#D9C6BD] bg-[#FBF3EF] p-5">
                <img src="/throughline-motif-findings.png" alt="" aria-hidden="true" className="pointer-events-none absolute -bottom-12 -right-10 w-36 opacity-[0.045]" />
                <div className="relative">
                  <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8A7F79]">
                    <Sparkles size={13} className="text-[#F0714E]" /> Throughline interpretation
                    {isAISummary && <span className="normal-case tracking-normal font-medium text-[#A35A44]">AI-generated</span>}
                  </div>
                  <p className="mt-2 text-[13px] leading-[1.6] text-[#4B403C]">{takeaway}</p>
                  {!isAISummary && <div className="mt-3 text-[10px] text-[#8A7F79]">Interpretive fallback · Anthropic narrative not generated yet.</div>}
                </div>
              </div>
            </>
          )}
        </aside>
      </div>
    </>
  );
}

function Setup({ activeData, alternatives, lens, setLens, comparisonSlug, setComparisonSlug, query, setQuery, analysisState, analysisMessage, onAnalyze, onBuild, onClose, publicDemo = false }) {
  const normalized = query.trim().toLowerCase();
  const visibleAlternatives = alternatives.filter(([, data]) => !normalized || String(data.company || "").toLowerCase().includes(normalized));
  const exactMatch = alternatives.find(([, data]) => String(data.company || "").toLowerCase() === normalized);
  const analyzing = analysisState === "running";
  const selectedData = alternatives.find(([slug]) => slug === comparisonSlug)?.[1];
  const sharedPeriod = selectedData ? comparisonEvidencePeriod(activeData, selectedData) : null;
  return (
    <>
      <div className="flex items-start justify-between border-b border-[#DED6D1] px-8 py-6">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[#8A7F79]">Company Battle Card</div>
          <h2 className="mt-1 text-[26px] font-semibold tracking-[-0.025em] text-[#172033]">Compare {activeData?.company}</h2>
          <p className="mt-1 text-sm text-[#4B403C]">Choose the lens and the company you want to understand alongside it.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close comparison" className="rounded-lg p-2 text-[#8A7F79] transition hover:bg-[#F3EEEB] hover:text-[#172033]"><X size={19} /></button>
      </div>

      <div className="px-8 py-7">
        <div>
          <div className="mb-3 flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded-full bg-[#172033] text-[10px] font-bold text-white">1</span><span className="text-xs font-semibold text-[#172033]">Choose comparison lens</span></div>
          <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-[#D7CDC7] bg-[#F8F4F2] p-1">
            {[
              ["ux", "UX / Product", "Usability, reliability, onboarding and core product experience"],
              ["cx", "CX", "Trust, service, value and overall customer experience"],
            ].map(([id, label, description]) => (
              <button
                key={id}
                type="button"
                onClick={() => setLens(id)}
                className={`rounded-lg px-4 py-3 text-left transition ${lens === id ? "border border-[#F0714E] bg-[#FFF7F3] shadow-[inset_3px_0_0_#F0714E,0_1px_2px_rgba(23,32,51,.06)]" : "border border-transparent hover:bg-white/50"}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-[#172033]">{label}</div>
                  {lens === id && <span className="grid h-5 w-5 place-items-center rounded-full bg-[#F0714E] text-white"><Check size={12} strokeWidth={3} /></span>}
                </div>
                <div className="mt-1 text-[11px] leading-4 text-[#8A7F79]">{description}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-7">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded-full bg-[#172033] text-[10px] font-bold text-white">2</span><span className="text-xs font-semibold text-[#172033]">Find a company</span></div>
            <div className="text-[11px] text-[#8A7F79]">Current company is excluded</div>
          </div>
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A7F79]" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} disabled={analyzing} placeholder="Search App Store and Google Play" className="h-11 w-full rounded-xl border border-[#D8CEC8] bg-white pl-10 pr-4 text-sm text-[#172033] outline-none transition placeholder:text-[#A59B95] focus:border-[#8EA1B2] focus:ring-2 focus:ring-[#8EA1B2]/15" />
          </div>
          <div className="mb-2 mt-4 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#8A7F79]">{normalized ? "Matching analysed companies" : "Previously analysed"}</div>
          <div className="grid gap-3 sm:grid-cols-2">
            {visibleAlternatives.slice(0, 6).map(([slug, data]) => (
              <button
                key={slug}
                type="button"
                onClick={() => setComparisonSlug(slug)}
                className={`group flex items-center justify-between rounded-xl border px-4 py-4 text-left transition ${comparisonSlug === slug ? "border-[#F0714E] bg-[#FFF7F3] shadow-[inset_3px_0_0_#F0714E]" : "border-[#D8CEC8] bg-[#FFFDFC] hover:border-[#BDAEA6] hover:bg-[#FCF9F7]"}`}
              >
                <div>
                  <div className="text-sm font-semibold text-[#172033]">{data.company}</div>
                  <div className="mt-1 text-[11px] text-[#8A7F79]">{data?.scopes?.all?.kpis?.nReviews ?? "—"} reviews available</div>
                </div>
                <div className={`grid h-8 w-8 place-items-center rounded-full border transition ${comparisonSlug === slug ? "border-[#F0714E] bg-[#F0714E] text-white" : "border-[#D8CEC8] bg-white text-[#8A7F79] group-hover:text-[#172033]"}`}>
                  {comparisonSlug === slug ? <Check size={15} strokeWidth={2.5} /> : <ChevronRight size={15} />}
                </div>
              </button>
            ))}
          </div>
          {!visibleAlternatives.length && normalized && !analyzing && <div className="mt-3 flex items-center justify-between gap-4 rounded-xl border border-[#D8CEC8] bg-[#FAF8F6] px-4 py-3.5"><div><div className="text-sm font-semibold text-[#172033]">{query.trim()}</div><div className="mt-0.5 text-[11px] text-[#8A7F79]">{publicDemo ? "Not included in this cached portfolio demonstration" : "No comparison data available yet"}</div></div>{publicDemo ? <span className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[#8A7F79]">Live analysis kept private</span> : <button type="button" onClick={onAnalyze} className="inline-flex items-center gap-2 rounded-lg bg-[#172033] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#26334A]"><Search size={13} />Analyse for comparison</button>}</div>}
          {analyzing && <div className="mt-3 rounded-xl border border-[#BAC7D3] bg-[#F5F8FA] px-4 py-3.5" role="status" aria-live="polite"><div className="flex items-center gap-3"><span className="battle-analysis-mark" aria-hidden="true"><i /></span><div className="min-w-0"><div className="text-xs font-semibold text-[#172033]">Preparing {query.trim()} for comparison</div><div className="mt-0.5 truncate text-[11px] text-[#637184]">{analysisMessage || "Collecting public reviews and matching experience dimensions…"}</div></div><span className="ml-auto text-[10px] font-semibold text-[#637184]">~2 min</span></div></div>}
          {analysisState === "error" && <div className="mt-3 flex items-center justify-between rounded-xl border border-[#E5C3BA] bg-[#FCF2EE] px-4 py-3 text-xs text-[#8A4C38]"><span>{analysisMessage || "The comparison analysis did not complete."}</span><button type="button" onClick={onAnalyze} className="font-semibold underline underline-offset-2">Try again</button></div>}
          {exactMatch && normalized && <button type="button" onClick={() => setComparisonSlug(exactMatch[0])} className="mt-3 text-xs font-semibold text-[#A14A42]">Use analysed {exactMatch[1].company}</button>}
          {selectedData && <div className="mt-4 flex items-center gap-3 border-t border-[#E7DFDB] pt-3 text-[11px]"><span className="font-semibold uppercase tracking-[0.08em] text-[#8A7F79]">Shared evidence period</span><span className="font-medium text-[#4B403C]">{sharedPeriod || "Period unavailable"}</span><span className="text-[#B5AAA4]">·</span><span className="text-[#8A7F79]">All matched sources</span></div>}
        </div>
      </div>

      <div className="flex items-center justify-between gap-5 border-t border-[#DED6D1] bg-[#FAF7F5] px-8 py-4">
        <p className="max-w-lg text-[11px] leading-4 text-[#8A7F79]">The battle card compares standardized dimensions so unlike products can still be understood through the same experience lens.</p>
        <button
          type="button"
          disabled={!comparisonSlug}
          onClick={onBuild}
          className="inline-flex items-center gap-2 rounded-lg bg-[#F0714E] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#D95F3E] disabled:cursor-not-allowed disabled:bg-[#C8C0BC] disabled:opacity-100"
        >
          Build {lens === "cx" ? "CX" : "UX"} comparison <ChevronRight size={15} />
        </button>
      </div>
    </>
  );
}

export default function CompanyBattleCard({ activeSlug, companies, onCompanyReady, publicDemo = false }) {
  const [open, setOpen] = useState(false);
  const [lens, setLens] = useState("ux");
  const [comparisonSlug, setComparisonSlug] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [query, setQuery] = useState("");
  const [analysisState, setAnalysisState] = useState("idle");
  const [analysisMessage, setAnalysisMessage] = useState("");
  const [analysisJobId, setAnalysisJobId] = useState(null);

  const activeData = companies[activeSlug];
  const alternatives = Object.entries(companies).filter(([slug]) => slug !== activeSlug);
  const comparisonData = comparisonSlug ? companies[comparisonSlug] : null;

  const analyzeForComparison = async () => {
    const company = query.trim();
    if (!company || publicDemo) return;
    setAnalysisState("running");
    setAnalysisMessage("Finding public app-store sources…");
    try {
      const response = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ company, hasSnapshot: false, windowDays: 30, countryHint: "auto" }) });
      const result = await response.json();
      if (!response.ok || !result?.ok || !result?.jobId) throw new Error(result?.error || "Comparison analysis could not start.");
      setAnalysisJobId(result.jobId);
      setAnalysisMessage("Collecting reviews and extracting customer signals…");
    } catch (error) {
      setAnalysisState("error");
      setAnalysisMessage(error?.message || "Comparison analysis could not start.");
    }
  };

  useEffect(() => {
    if (!analysisJobId || analysisState !== "running") return undefined;
    let cancelled = false;
    let timer;
    const poll = async () => {
      try {
        const response = await fetch(`/api/analyze-status?id=${encodeURIComponent(analysisJobId)}&t=${Date.now()}`, { cache: "no-store" });
        const result = await response.json();
        if (cancelled) return;
        if (result?.status === "partial" && result?.data) {
          const progress = result.data.analysisProgress;
          setAnalysisMessage(progress?.isPartial ? `Initial evidence ready · processing ${progress.processedReviews} of ${progress.totalReviews} reviews` : "Matching evidence to UX and CX dimensions…");
        } else if (result?.status === "complete" && result?.data) {
          const slug = result.data.companySlug || String(result.data.company || query).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
          onCompanyReady?.(slug, result.data);
          setComparisonSlug(slug);
          setQuery(result.data.company || query);
          setAnalysisState("ready");
          setAnalysisMessage(`${result.data?.scopes?.all?.kpis?.nReviews || result.data?.reviews?.length || 0} reviews ready for comparison`);
          setAnalysisJobId(null);
          return;
        } else if (result?.status === "error" || !result?.ok) {
          throw new Error(result?.error || "Comparison analysis did not complete.");
        }
        timer = window.setTimeout(poll, 1200);
      } catch (error) {
        if (!cancelled) {
          setAnalysisState("error");
          setAnalysisMessage(error?.message || "Comparison analysis did not complete.");
          setAnalysisJobId(null);
        }
      }
    };
    poll();
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [analysisJobId, analysisState]);

  const close = () => {
    setOpen(false);
    setShowResult(false);
  };

  const openSetup = () => {
    setShowResult(false);
    setComparisonSlug("");
    setQuery("");
    setAnalysisState("idle");
    setAnalysisMessage("");
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={openSetup}
        className="compare-intercept group fixed right-0 top-[42%] z-40 h-[124px] w-[54px] translate-x-[1px] overflow-hidden rounded-l-2xl border border-r-0 border-[#D2C7C1] bg-[#FFFDFC]/97 text-[#172033] shadow-[-8px_10px_28px_rgba(23,32,51,0.10)] backdrop-blur-sm transition-[width,box-shadow,border-color] duration-300 hover:w-[176px] hover:border-[#C3B5AD] hover:shadow-[-12px_14px_34px_rgba(23,32,51,0.14)] focus:w-[176px] focus:border-[#F0714E]/55 focus:outline-none focus:ring-2 focus:ring-[#F0714E]/25"
        aria-label="Compare companies — open Company Battle Card"
      >
        <span className="compare-intercept-glyph absolute left-[13px] top-[18px] block shrink-0"><CompareGlyph className="h-7 w-7 text-[#172033] transition-transform duration-300 group-hover:scale-110 group-focus:scale-110" /><span className="compare-intercept-spark" aria-hidden="true" /></span>
        <span className="compare-intercept-idle absolute left-1/2 top-[76px] -translate-x-1/2 -rotate-90 whitespace-nowrap text-[11px] font-semibold tracking-[0.08em] transition-opacity duration-150 group-hover:opacity-0 group-focus:opacity-0">Compare</span>
        <span className="compare-intercept-labels pointer-events-none absolute left-[57px] top-[42px] min-w-[106px] translate-x-2 opacity-0 transition-all duration-250 group-hover:translate-x-0 group-hover:opacity-100 group-focus:translate-x-0 group-focus:opacity-100">
          <span className="block text-[15px] font-semibold leading-5 text-[#172033]">Compare</span>
          <span className="mt-0.5 block whitespace-nowrap text-[10px] leading-4 text-[#8A7F79]">Company battle card</span>
        </span>
      </button>

      {open && (
        <div className="battle-card-overlay fixed inset-0 z-[90] grid place-items-center bg-[#172033]/42 p-5 backdrop-blur-[2px]" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <section role="dialog" aria-modal="true" aria-label="Company Battle Card" className="battle-card-dialog max-h-[calc(100vh-64px)] w-full max-w-[1020px] overflow-y-auto overflow-x-hidden rounded-[18px] border border-[#CFC4BE] bg-[#FFFDFC] shadow-[0_34px_110px_rgba(10,18,32,.34)]">
            {showResult && comparisonData ? (
              <BattleCardResult activeData={activeData} comparisonData={comparisonData} activeSlug={activeSlug} comparisonSlug={comparisonSlug} lens={lens} onLensChange={setLens} onChange={() => setShowResult(false)} onClose={close} />
            ) : (
              <Setup
                activeData={activeData}
                alternatives={alternatives}
                lens={lens}
                setLens={setLens}
                comparisonSlug={comparisonSlug}
                setComparisonSlug={setComparisonSlug}
                query={query}
                setQuery={setQuery}
                analysisState={analysisState}
                analysisMessage={analysisMessage}
                onAnalyze={analyzeForComparison}
                publicDemo={publicDemo}
                onBuild={() => setShowResult(true)}
                onClose={close}
              />
            )}
          </section>
        </div>
      )}
    </>
  );
}
