#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ─────────────────────────────────────────────
// Second-Order Thinking Engine
// ─────────────────────────────────────────────

/**
 * Dimensions used to surface non-obvious consequences.
 * Each dimension asks: "If [first-order effect] is true, what shifts
 * downstream in THIS domain?"
 */
const CONSEQUENCE_DIMENSIONS = [
  { id: "economic",      label: "Economic",      probe: "resource flows, incentives, costs, and market dynamics" },
  { id: "social",        label: "Social",        probe: "relationships, norms, trust, group behaviour, and culture" },
  { id: "psychological", label: "Psychological", probe: "beliefs, motivations, biases, emotions, and mental models" },
  { id: "systemic",      label: "Systemic",      probe: "feedback loops, dependencies, fragility, and emergent behaviour" },
  { id: "temporal",      label: "Temporal",      probe: "short-term vs long-term trade-offs and path dependencies" },
  { id: "political",     label: "Political",     probe: "power, governance, policy, regulation, and stakeholder interests" },
  { id: "technological", label: "Technological", probe: "capability shifts, adoption curves, and unintended use-cases" },
  { id: "environmental", label: "Environmental", probe: "ecological, physical, and resource-system effects" },
];

const TIME_HORIZONS = {
  immediate: "0–30 days",
  near:      "1–12 months",
  medium:    "1–5 years",
  long:      "5+ years",
};

// ─── helpers ───────────────────────────────────────────────────────────────

function classifyMagnitude(score) {
  if (score >= 8) return { label: "Critical", emoji: "🔴" };
  if (score >= 6) return { label: "High",     emoji: "🟠" };
  if (score >= 4) return { label: "Medium",   emoji: "🟡" };
  return              { label: "Low",      emoji: "🟢" };
}

function scoreConsequence(likelihood, impact) {
  return Math.round(likelihood * impact / 10);
}

/**
 * Core analysis engine.
 * Returns a structured consequence tree with first- and second-order nodes.
 */
function buildConsequenceTree(params) {
  const {
    decision,
    context,
    stakeholders,
    timeHorizon,
    dimensions,
    depth,
  } = params;

  const selectedDimensions = dimensions.length > 0
    ? CONSEQUENCE_DIMENSIONS.filter(d => dimensions.includes(d.id))
    : CONSEQUENCE_DIMENSIONS;

  const horizonLabel = TIME_HORIZONS[timeHorizon] ?? TIME_HORIZONS.medium;

  // ── Synthetic first-order consequences (deterministic derivations) ──────
  const firstOrderNodes = selectedDimensions.map((dim, i) => {
    const baseEffect = generateFirstOrderEffect(decision, context, dim);
    const likelihood = baseEffect.likelihood;
    const impact     = baseEffect.impact;
    const score      = scoreConsequence(likelihood, impact);
    const magnitude  = classifyMagnitude(score);

    return {
      id:          `fo_${dim.id}`,
      order:       1,
      dimension:   dim.label,
      effect:      baseEffect.description,
      likelihood,
      impact,
      score,
      magnitude,
      timeHorizon: horizonLabel,
      assumption:  baseEffect.assumption,
    };
  });

  // ── Second-order consequences (derived from first-order nodes) ──────────
  const secondOrderNodes = depth >= 2
    ? firstOrderNodes.flatMap((fo, fi) =>
        generateSecondOrderEffects(fo, decision, context, stakeholders).map(
          (so, si) => ({
            id:           `so_${fo.dimension.toLowerCase()}_${si}`,
            order:        2,
            parentId:     fo.id,
            dimension:    so.dimension,
            effect:       so.description,
            likelihood:   so.likelihood,
            impact:       so.impact,
            score:        scoreConsequence(so.likelihood, so.impact),
            magnitude:    classifyMagnitude(scoreConsequence(so.likelihood, so.impact)),
            timeHorizon:  so.timeHorizon,
            blindSpot:    so.blindSpot,
          })
        )
      )
    : [];

  // ── Systemic risks  ─────────────────────────────────────────────────────
  const systemicRisks = identifySystemicRisks(firstOrderNodes, secondOrderNodes, decision);

  // ── Strategic recommendations ───────────────────────────────────────────
  const recommendations = buildRecommendations(
    firstOrderNodes, secondOrderNodes, systemicRisks, decision, stakeholders
  );

  // ── Overall risk rating ─────────────────────────────────────────────────
  const avgScore = [
    ...firstOrderNodes.map(n => n.score),
    ...secondOrderNodes.map(n => n.score),
  ].reduce((a, b) => a + b, 0) /
    (firstOrderNodes.length + secondOrderNodes.length || 1);

  const overallRisk = classifyMagnitude(Math.round(avgScore));

  return {
    decision,
    context,
    stakeholders,
    timeHorizon: horizonLabel,
    analyzedAt: new Date().toISOString(),
    summary: {
      overallRisk,
      totalEffects: firstOrderNodes.length + secondOrderNodes.length,
      criticalEffects: [...firstOrderNodes, ...secondOrderNodes]
        .filter(n => n.magnitude.label === "Critical").length,
      avgConsequenceScore: Math.round(avgScore * 10) / 10,
    },
    firstOrderConsequences: firstOrderNodes,
    secondOrderConsequences: secondOrderNodes,
    systemicRisks,
    recommendations,
  };
}

// ─── First-order generators ──────────────────────────────────────────────

function generateFirstOrderEffect(decision, context, dim) {
  // Pattern-based heuristics — deterministic given the inputs
  const d = decision.toLowerCase();
  const c = (context || "").toLowerCase();

  const templates = {
    economic: [
      { trigger: /cut|reduc|downsize|slash/,  description: "Short-run cost savings materialise, but talent pipeline and institutional knowledge erode.",                     likelihood: 8, impact: 7, assumption: "Savings are not offset by rehiring or quality costs." },
      { trigger: /invest|expand|scale|grow/,  description: "Capital deployment increases capacity but compresses margins during the ramp period.",                          likelihood: 7, impact: 8, assumption: "Return on investment exceeds cost of capital within the time horizon." },
      { trigger: /automate|ai|tech|digital/,  description: "Labour costs decline while setup and maintenance costs rise; net effect depends on scale.",                    likelihood: 8, impact: 7, assumption: "Automation covers the targeted workflow without significant edge-case failures." },
      { trigger: /.*/,                         description: "Resource allocation shifts create winners and losers across budget centres.",                                  likelihood: 6, impact: 5, assumption: "Existing budget structures remain largely intact." },
    ],
    social: [
      { trigger: /cut|reduc|downsize|layoff/,  description: "Employee morale and psychological safety decline; top performers begin exploring exit options.",               likelihood: 9, impact: 8, assumption: "Affected employees interpret cuts as signals of future instability." },
      { trigger: /policy|rule|mandate|require/, description: "Compliance behaviour increases but discretionary effort and creative initiative decrease.",                  likelihood: 7, impact: 6, assumption: "Policy is perceived as controlling rather than enabling." },
      { trigger: /merge|acqui|partner/,         description: "Cultural friction surfaces as different norms and working styles collide.",                                  likelihood: 8, impact: 7, assumption: "Cultural integration is underestimated or underfunded." },
      { trigger: /.*/,                           description: "Informal networks reconfigure as people update their relationships to the new reality.",                    likelihood: 6, impact: 5, assumption: "Social adaptation lags formal structural change by 3–6 months." },
    ],
    psychological: [
      { trigger: /change|shift|transform/,     description: "Uncertainty activates status-quo bias; resistance is proportional to perceived threat to identity.",         likelihood: 8, impact: 7, assumption: "Change communication is insufficient to counter threat narratives." },
      { trigger: /reward|bonus|incentive/,      description: "Extrinsic motivation crowds out intrinsic motivation in previously passion-driven roles.",                  likelihood: 7, impact: 6, assumption: "Roles had meaningful intrinsic motivation before the incentive was introduced." },
      { trigger: /automate|ai|replace/,         description: "Anxiety about relevance and role displacement reduces engagement and increases cynicism.",                  likelihood: 8, impact: 8, assumption: "Workers perceive automation as a threat rather than an augmentation." },
      { trigger: /.*/,                           description: "Cognitive load increases as people adapt mental models to the new environment.",                            likelihood: 6, impact: 5, assumption: "Adequate support structures for psychological transition are not in place." },
    ],
    systemic: [
      { trigger: /centralise|consolidate/,     description: "Efficiency gains are offset by single-point-of-failure risk and reduced system resilience.",                 likelihood: 7, impact: 9, assumption: "Redundancy that was removed was load-bearing, not just wasteful." },
      { trigger: /decentralise|distribute/,    description: "Agility improves but coordination costs rise and quality variance increases across nodes.",                  likelihood: 7, impact: 6, assumption: "Decentralised units do not have sufficient autonomy or capability." },
      { trigger: /speed|fast|quick|rapid/,     description: "Faster cycles compress learning loops; errors propagate before they are caught.",                           likelihood: 7, impact: 7, assumption: "Quality-gate mechanisms do not scale at the same pace as output velocity." },
      { trigger: /.*/,                           description: "Feedback loops in the system are disrupted, delaying error-correction signals.",                            likelihood: 6, impact: 7, assumption: "The system previously relied on informal feedback that is now broken." },
    ],
    temporal: [
      { trigger: /short.term|quick win|now/,   description: "Optimising for immediate metrics sacrifices optionality and adaptive capacity for the future.",             likelihood: 8, impact: 8, assumption: "Decision-makers are under quarterly-reporting pressure." },
      { trigger: /long.term|future|strateg/,   description: "Near-term costs and opportunity costs are incurred while payoffs remain uncertain and distant.",             likelihood: 7, impact: 6, assumption: "Long-term commitment survives leadership and strategy cycles." },
      { trigger: /.*/,                           description: "Path dependency is created: reversing this decision will cost more than making it.",                       likelihood: 7, impact: 7, assumption: "The decision involves sunk costs or lock-in effects." },
    ],
    political: [
      { trigger: /cut|reduc|downsize/,          description: "Internal power dynamics shift as affected groups lose resources, voice, and influence.",                   likelihood: 8, impact: 7, assumption: "Resource allocation is a proxy for organisational status." },
      { trigger: /regulat|complian|govern/,     description: "Regulatory scrutiny increases as the decision enters the attention of oversight bodies.",                  likelihood: 6, impact: 8, assumption: "The decision sits in a domain subject to regulatory evolution." },
      { trigger: /.*/,                           description: "Stakeholder coalitions form around competing interpretations of who benefits and who pays.",               likelihood: 7, impact: 6, assumption: "Decision affects multiple stakeholders with different interests." },
    ],
    technological: [
      { trigger: /deploy|launch|release/,       description: "Early adopters gain advantage but absorb integration costs that later adopters will avoid.",               likelihood: 7, impact: 6, assumption: "Technology matures and becomes cheaper/easier over time." },
      { trigger: /legacy|old|replace|migrate/,  description: "Technical debt is reduced but migration risk introduces a critical-path vulnerability.",                  likelihood: 8, impact: 8, assumption: "Migration complexity is underestimated in planning." },
      { trigger: /ai|ml|automate|model/,         description: "Capabilities expand in targeted domains but create opaque decision-making that is hard to audit.",       likelihood: 7, impact: 7, assumption: "AI/ML outputs are trusted without sufficient validation pipelines." },
      { trigger: /.*/,                           description: "Technology adoption curve creates temporary competitive advantage that erodes as diffusion occurs.",      likelihood: 6, impact: 5, assumption: "Competitors can replicate the technological approach within the time horizon." },
    ],
    environmental: [
      { trigger: /produc|manufactur|supply/,    description: "Resource extraction and logistics emissions increase in line with output scaling.",                        likelihood: 7, impact: 6, assumption: "Supply chain carbon intensity is not being actively reduced." },
      { trigger: /digital|cloud|data|compute/,  description: "Energy consumption and e-waste grow as digital infrastructure scales.",                                   likelihood: 6, impact: 5, assumption: "Renewable energy offsets are insufficient to neutralise growth." },
      { trigger: /.*/,                           description: "Indirect environmental externalities accumulate in ways not captured by current reporting.",              likelihood: 5, impact: 5, assumption: "Full lifecycle environmental costs are not priced in." },
    ],
  };

  const pool = templates[dim.id] ?? templates.economic;
  const match = pool.find(t => t.trigger.test(d) || t.trigger.test(c)) ?? pool[pool.length - 1];
  return match;
}

// ─── Second-order generators ─────────────────────────────────────────────

function generateSecondOrderEffects(firstOrderNode, decision, context, stakeholders) {
  const stakeholderList = stakeholders.length > 0 ? stakeholders : ["employees", "customers", "management"];

  const patterns = [
    {
      parentDimension: "Economic",
      effects: [
        {
          dimension:   "Social",
          description: `As financial pressure intensifies, ${stakeholderList[0] ?? "teams"} prioritise self-preservation over collaboration, weakening collective problem-solving capacity.`,
          likelihood:  7, impact: 7,
          timeHorizon: TIME_HORIZONS.near,
          blindSpot:   "This effect is invisible in financial dashboards but shows up in velocity metrics 6–9 months later.",
        },
        {
          dimension:   "Political",
          description: "Resource reallocation triggers coalition-building among disadvantaged stakeholders, creating informal veto-power over future decisions.",
          likelihood:  6, impact: 8,
          timeHorizon: TIME_HORIZONS.medium,
          blindSpot:   "Political resistance often manifests as 'process issues' rather than explicit opposition.",
        },
      ],
    },
    {
      parentDimension: "Social",
      effects: [
        {
          dimension:   "Psychological",
          description: `Declining trust in leadership causes ${stakeholderList[1] ?? "high performers"} to adopt protective behaviours — information hoarding, over-documentation, risk aversion.`,
          likelihood:  8, impact: 7,
          timeHorizon: TIME_HORIZONS.near,
          blindSpot:   "Protective behaviours appear as diligence in the short term, masking their systemic cost.",
        },
        {
          dimension:   "Economic",
          description: "Talent attrition accelerates as social contract erodes; replacement costs (recruitment, onboarding, ramp-up) compound the original cost pressures.",
          likelihood:  7, impact: 8,
          timeHorizon: TIME_HORIZONS.medium,
          blindSpot:   "Attrition cost is rarely attributed to the original decision that changed the social contract.",
        },
      ],
    },
    {
      parentDimension: "Psychological",
      effects: [
        {
          dimension:   "Systemic",
          description: "Widespread anxiety creates a risk-averse culture that systematically underinvests in experiments and innovation, degrading future adaptive capacity.",
          likelihood:  7, impact: 9,
          timeHorizon: TIME_HORIZONS.long,
          blindSpot:   "Innovation decline is only measurable years after the psychological shift — the lag obscures causality.",
        },
        {
          dimension:   "Social",
          description: `Narrative fragmentation occurs: different ${stakeholderList[0] ?? "groups"} construct incompatible stories about why the decision was made, destroying shared meaning.`,
          likelihood:  6, impact: 7,
          timeHorizon: TIME_HORIZONS.near,
          blindSpot:   "Leadership interprets silence as acceptance; silence is actually narrative divergence.",
        },
      ],
    },
    {
      parentDimension: "Systemic",
      effects: [
        {
          dimension:   "Temporal",
          description: "Reduced resilience means the next disruption causes disproportionate damage; costs of recovery exceed the original efficiency gains many times over.",
          likelihood:  6, impact: 9,
          timeHorizon: TIME_HORIZONS.long,
          blindSpot:   "This risk is invisible until the next shock; by then, the causal link to this decision is disputed.",
        },
        {
          dimension:   "Economic",
          description: "Feedback-loop disruption causes over-investment in areas that appear to be performing (but aren't) and under-investment in areas showing false weakness.",
          likelihood:  7, impact: 8,
          timeHorizon: TIME_HORIZONS.medium,
          blindSpot:   "Misallocation is rationalised by the same metrics that are now distorted.",
        },
      ],
    },
    {
      parentDimension: "Temporal",
      effects: [
        {
          dimension:   "Political",
          description: "Sunk costs become politically defended regardless of strategic merit, creating 'zombie commitments' that consume resources without being revisited.",
          likelihood:  8, impact: 7,
          timeHorizon: TIME_HORIZONS.medium,
          blindSpot:   "Escalation of commitment is universally recognised in theory and universally practised in reality.",
        },
        {
          dimension:   "Systemic",
          description: "Path dependency locks the organisation into a trajectory that forecloses superior alternatives discovered after the decision point.",
          likelihood:  7, impact: 8,
          timeHorizon: TIME_HORIZONS.long,
          blindSpot:   "Option value destroyed by early lock-in is never counted because it is never realised.",
        },
      ],
    },
    {
      parentDimension: "Political",
      effects: [
        {
          dimension:   "Social",
          description: "Coalition formation around contested decisions generates ingroup/outgroup dynamics that persist long after the original issue is resolved.",
          likelihood:  7, impact: 6,
          timeHorizon: TIME_HORIZONS.medium,
          blindSpot:   "Political fractures become the invisible subtext of every subsequent meeting and decision.",
        },
        {
          dimension:   "Economic",
          description: "Regulatory attention once attracted raises compliance costs and restricts strategic options across the entire portfolio, not just the triggering decision.",
          likelihood:  5, impact: 9,
          timeHorizon: TIME_HORIZONS.long,
          blindSpot:   "Regulatory overhang is tail-risk that is systematically underweighted in decision analysis.",
        },
      ],
    },
    {
      parentDimension: "Technological",
      effects: [
        {
          dimension:   "Social",
          description: `Workers displaced or deskilled by technology develop learned helplessness, reducing the organisation's capacity to operate without the technology if it fails.`,
          likelihood:  7, impact: 8,
          timeHorizon: TIME_HORIZONS.medium,
          blindSpot:   "Capability erosion is invisible until the system is unavailable; drills to test this are rarely conducted.",
        },
        {
          dimension:   "Systemic",
          description: "Vendor or platform lock-in concentrates systemic risk; the dependency is cheap to create and expensive to unwind.",
          likelihood:  8, impact: 8,
          timeHorizon: TIME_HORIZONS.long,
          blindSpot:   "Lock-in risks are discounted because exit is always theoretically possible, even when it is practically prohibitive.",
        },
      ],
    },
    {
      parentDimension: "Environmental",
      effects: [
        {
          dimension:   "Political",
          description: "Accumulated environmental externalities attract activist, regulatory, and investor attention, increasing reputational and compliance risk.",
          likelihood:  6, impact: 7,
          timeHorizon: TIME_HORIZONS.long,
          blindSpot:   "ESG risk is a lagging indicator — it becomes material at exactly the wrong moment in a downturn.",
        },
        {
          dimension:   "Economic",
          description: "Future carbon pricing, resource scarcity, or climate disruption transforms today's low-cost supply chains into high-cost or unavailable ones.",
          likelihood:  5, impact: 8,
          timeHorizon: TIME_HORIZONS.long,
          blindSpot:   "Climate risk is systematically discounted because its timeframe exceeds most planning horizons.",
        },
      ],
    },
  ];

  const matched = patterns.find(p => p.parentDimension === firstOrderNode.dimension);
  return matched ? matched.effects : [
    {
      dimension:   "Systemic",
      description: `The aggregated weight of upstream ${firstOrderNode.dimension.toLowerCase()} effects creates emergent behaviour that no individual stakeholder anticipated or can fully control.`,
      likelihood:  6, impact: 7,
      timeHorizon: TIME_HORIZONS.medium,
      blindSpot:   "Emergent systemic effects are definitionally invisible to reductionist analysis.",
    },
  ];
}

// ─── Systemic risk synthesis ──────────────────────────────────────────────

function identifySystemicRisks(firstOrder, secondOrder, decision) {
  const allNodes = [...firstOrder, ...secondOrder];
  const critical  = allNodes.filter(n => n.magnitude?.label === "Critical");
  const high      = allNodes.filter(n => n.magnitude?.label === "High");

  const risks = [];

  if (critical.length >= 2) {
    risks.push({
      type:        "Convergent Risk",
      description: `${critical.length} critical-magnitude effects may converge, creating compounding dynamics that exceed the sum of their individual impacts.`,
      severity:    "Critical",
      mitigation:  "Map dependency chains between critical effects and create early-warning indicators for each.",
    });
  }

  const dimensionSet = new Set(allNodes.map(n => n.dimension));
  if (dimensionSet.size >= 4) {
    risks.push({
      type:        "Cross-Domain Cascade",
      description: `Effects span ${dimensionSet.size} dimensions (${[...dimensionSet].join(", ")}), increasing the probability of cross-domain cascades that no single team has visibility over.`,
      severity:    "High",
      mitigation:  "Assign a cross-functional owner responsible for monitoring inter-domain amplification effects.",
    });
  }

  const temporalNodes = allNodes.filter(n =>
    n.timeHorizon?.includes("5+") || n.timeHorizon?.includes("long")
  );
  if (temporalNodes.length >= 3) {
    risks.push({
      type:        "Long-Horizon Blind Spot",
      description: `${temporalNodes.length} effects mature beyond typical planning horizons. Organisational attention and accountability are structurally unlikely to reach them.`,
      severity:    "High",
      mitigation:  "Create a long-horizon register with assigned owners and calendar-based review triggers.",
    });
  }

  const blindSpotNodes = secondOrder.filter(n => n.blindSpot);
  if (blindSpotNodes.length > 0) {
    risks.push({
      type:        "Systemic Blind Spots",
      description: `${blindSpotNodes.length} second-order effects carry identified blind spots — effects that standard monitoring is structurally unlikely to surface until damage has occurred.`,
      severity:    "High",
      mitigation:  "Design pre-mortem exercises specifically targeting each identified blind spot before committing to the decision.",
    });
  }

  return risks;
}

// ─── Recommendations ──────────────────────────────────────────────────────

function buildRecommendations(firstOrder, secondOrder, risks, decision, stakeholders) {
  const recs = [];

  const allNodes = [...firstOrder, ...secondOrder];
  const criticalCount = allNodes.filter(n => n.magnitude?.label === "Critical").length;

  if (criticalCount > 0) {
    recs.push({
      priority: "Immediate",
      action:   `Before committing, define explicit success metrics and kill-criteria for the ${criticalCount} critical-magnitude effect(s). Name who is accountable for monitoring each.`,
      rationale: "Critical effects without pre-committed monitoring become invisible until they cascade.",
    });
  }

  recs.push({
    priority:  "High",
    action:    "Run a structured pre-mortem: assume it is 18 months later and the decision has failed catastrophically. Work backwards to identify which second-order effect was the proximate cause.",
    rationale: "Pre-mortems surface the second-order risks that optimism bias suppresses in forward-looking analysis.",
  });

  if (stakeholders.length > 0) {
    recs.push({
      priority:  "High",
      action:    `Map each of the following stakeholders to the consequences most likely to affect them: ${stakeholders.join(", ")}. Proactively communicate with the highest-impact groups before the decision is announced.`,
      rationale: "Stakeholders who discover consequences they weren't told about become adversarial; those consulted become co-owners.",
    });
  }

  recs.push({
    priority:  "Medium",
    action:    "Design reversibility into the decision wherever possible. Prefer staged rollouts, option-preserving contracts, and modular architecture over one-shot commitments.",
    rationale: "Most second-order effects only become visible after commitment; reversibility converts catastrophic risk into manageable adjustment.",
  });

  const longTermNodes = secondOrder.filter(n => n.timeHorizon?.includes("5+"));
  if (longTermNodes.length > 0) {
    recs.push({
      priority:  "Medium",
      action:    `Set calendar reviews at 12, 24, and 60 months specifically to re-examine ${longTermNodes.length} long-horizon effect(s). Document the assumptions being made today so future reviewers can audit them.`,
      rationale: "Long-horizon effects are real but systematically orphaned by organisational attention and turnover.",
    });
  }

  recs.push({
    priority:  "Low",
    action:    "Share this analysis with at least one person whose incentives differ from yours. Ask them which consequence you are most motivated to ignore.",
    rationale: "Second-order thinking is most powerful as a social process; the sharpest blind spots are motivational, not analytical.",
  });

  return recs;
}

// ─── Formatters ───────────────────────────────────────────────────────────

function formatTreeAsMarkdown(tree) {
  const lines = [];

  lines.push(`# 🧠 Second-Order Thinking Analysis`);
  lines.push(`**Decision:** ${tree.decision}`);
  if (tree.context) lines.push(`**Context:** ${tree.context}`);
  if (tree.stakeholders?.length) lines.push(`**Stakeholders:** ${tree.stakeholders.join(", ")}`);
  lines.push(`**Time Horizon:** ${tree.timeHorizon}`);
  lines.push(`**Analysed:** ${tree.analyzedAt}`);
  lines.push("");

  // Summary
  const s = tree.summary;
  lines.push(`## 📊 Summary`);
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Overall Risk | ${s.overallRisk.emoji} ${s.overallRisk.label} |`);
  lines.push(`| Total Effects Mapped | ${s.totalEffects} |`);
  lines.push(`| Critical Effects | ${s.criticalEffects} |`);
  lines.push(`| Avg Consequence Score | ${s.avgConsequenceScore} / 10 |`);
  lines.push("");

  // First-order
  lines.push(`## 1️⃣ First-Order Consequences`);
  lines.push(`*What happens directly as a result of the decision.*`);
  lines.push("");
  for (const fo of tree.firstOrderConsequences) {
    lines.push(`### ${fo.magnitude.emoji} ${fo.dimension}`);
    lines.push(`**Effect:** ${fo.effect}`);
    lines.push(`- Likelihood: ${fo.likelihood}/10 | Impact: ${fo.impact}/10 | Score: **${fo.score}/10** (${fo.magnitude.label})`);
    lines.push(`- Time horizon: ${fo.timeHorizon}`);
    lines.push(`- Key assumption: *${fo.assumption}*`);
    lines.push("");
  }

  // Second-order
  if (tree.secondOrderConsequences.length > 0) {
    lines.push(`## 2️⃣ Second-Order Consequences`);
    lines.push(`*What happens as a result of the first-order consequences — the effects most people miss.*`);
    lines.push("");
    for (const so of tree.secondOrderConsequences) {
      const parent = tree.firstOrderConsequences.find(fo => fo.id === so.parentId);
      lines.push(`### ${so.magnitude.emoji} ${so.dimension} ← *from ${parent?.dimension ?? so.parentId}*`);
      lines.push(`**Effect:** ${so.effect}`);
      lines.push(`- Likelihood: ${so.likelihood}/10 | Impact: ${so.impact}/10 | Score: **${so.score}/10** (${so.magnitude.label})`);
      lines.push(`- Time horizon: ${so.timeHorizon}`);
      if (so.blindSpot) lines.push(`- ⚠️ **Blind spot:** *${so.blindSpot}*`);
      lines.push("");
    }
  }

  // Systemic risks
  if (tree.systemicRisks.length > 0) {
    lines.push(`## ⚡ Systemic Risks`);
    for (const risk of tree.systemicRisks) {
      lines.push(`### ${risk.type} — ${risk.severity}`);
      lines.push(risk.description);
      lines.push(`**Mitigation:** ${risk.mitigation}`);
      lines.push("");
    }
  }

  // Recommendations
  lines.push(`## ✅ Recommendations`);
  const priorityOrder = ["Immediate", "High", "Medium", "Low"];
  for (const p of priorityOrder) {
    const recs = tree.recommendations.filter(r => r.priority === p);
    for (const rec of recs) {
      lines.push(`### [${rec.priority}] ${rec.action.substring(0, 60)}…`);
      lines.push(rec.action);
      lines.push(`*Rationale: ${rec.rationale}*`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

function formatQuickScan(tree) {
  const top3First = [...tree.firstOrderConsequences]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const top3Second = [...tree.secondOrderConsequences]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const lines = [];
  lines.push(`## Quick Scan: "${tree.decision}"`);
  lines.push(`Overall Risk: ${tree.summary.overallRisk.emoji} ${tree.summary.overallRisk.label}\n`);

  lines.push(`**Top 3 First-Order Effects:**`);
  top3First.forEach((n, i) => {
    lines.push(`${i + 1}. ${n.magnitude.emoji} [${n.dimension}] ${n.effect}`);
  });

  lines.push(`\n**Top 3 Hidden Second-Order Effects:**`);
  top3Second.forEach((n, i) => {
    lines.push(`${i + 1}. ${n.magnitude.emoji} [${n.dimension}] ${n.effect}`);
    if (n.blindSpot) lines.push(`   ⚠️ ${n.blindSpot}`);
  });

  if (tree.recommendations[0]) {
    lines.push(`\n**Most Important Action:**`);
    lines.push(`→ ${tree.recommendations[0].action}`);
  }

  return lines.join("\n");
}

// ─────────────────────────────────────────────
// MCP Server
// ─────────────────────────────────────────────

const server = new McpServer({
  name:    "second-order-thinking",
  version: "1.0.0",
});

// ── Tool 1: Full second-order analysis ───────────────────────────────────

server.tool(
  "analyze_decision",
  "Performs a full second-order thinking analysis on a decision or proposed action. " +
  "Returns structured first-order and second-order consequence trees, systemic risks, blind spots, and prioritised recommendations.",
  {
    decision: z.string().describe(
      "The decision, action, or policy to analyse. Be specific: 'Reduce headcount by 20%' is better than 'cost cuts'."
    ),
    context: z.string().optional().describe(
      "Additional context: industry, organisation size, current situation, constraints, goals."
    ),
    stakeholders: z.array(z.string()).default([]).describe(
      "List of stakeholder groups affected (e.g. ['employees', 'customers', 'regulators'])."
    ),
    timeHorizon: z.enum(["immediate", "near", "medium", "long"]).default("medium").describe(
      "Planning horizon: immediate (0-30d), near (1-12mo), medium (1-5yr), long (5yr+)."
    ),
    dimensions: z.array(
      z.enum(["economic", "social", "psychological", "systemic", "temporal", "political", "technological", "environmental"])
    ).default([]).describe(
      "Dimensions to analyse. Leave empty to analyse all 8 dimensions."
    ),
    depth: z.number().int().min(1).max(2).default(2).describe(
      "Analysis depth: 1 = first-order only, 2 = first + second order (recommended)."
    ),
    format: z.enum(["full", "quick"]).default("full").describe(
      "Output format: 'full' for complete markdown report, 'quick' for top-3 highlights."
    ),
  },
  async ({ decision, context, stakeholders, timeHorizon, dimensions, depth, format }) => {
    const tree = buildConsequenceTree({ decision, context, stakeholders, timeHorizon, dimensions, depth });
    const output = format === "quick" ? formatQuickScan(tree) : formatTreeAsMarkdown(tree);

    return {
      content: [
        {
          type: "text",
          text: output,
        },
        {
          type: "text",
          text: "\n\n---\n**Raw JSON available on request.** Use `get_consequence_json` with the same inputs.",
        },
      ],
    };
  }
);

// ── Tool 2: Compare two decisions ────────────────────────────────────────

server.tool(
  "compare_decisions",
  "Compares two decisions side-by-side using second-order thinking. " +
  "Returns a comparative risk matrix and recommendation on which path has better second-order properties.",
  {
    decisionA:    z.string().describe("First decision or path."),
    decisionB:    z.string().describe("Second decision or path."),
    context:      z.string().optional().describe("Shared context for both decisions."),
    stakeholders: z.array(z.string()).default([]).describe("Shared stakeholder groups."),
    timeHorizon:  z.enum(["immediate", "near", "medium", "long"]).default("medium"),
  },
  async ({ decisionA, decisionB, context, stakeholders, timeHorizon }) => {
    const treeA = buildConsequenceTree({ decision: decisionA, context, stakeholders, timeHorizon, dimensions: [], depth: 2 });
    const treeB = buildConsequenceTree({ decision: decisionB, context, stakeholders, timeHorizon, dimensions: [], depth: 2 });

    const lines = [];
    lines.push(`# ⚖️ Second-Order Decision Comparison`);
    lines.push("");
    lines.push(`| Metric | Option A | Option B |`);
    lines.push(`|--------|----------|----------|`);
    lines.push(`| Decision | ${decisionA} | ${decisionB} |`);
    lines.push(`| Overall Risk | ${treeA.summary.overallRisk.emoji} ${treeA.summary.overallRisk.label} | ${treeB.summary.overallRisk.emoji} ${treeB.summary.overallRisk.label} |`);
    lines.push(`| Avg Consequence Score | ${treeA.summary.avgConsequenceScore} | ${treeB.summary.avgConsequenceScore} |`);
    lines.push(`| Critical Effects | ${treeA.summary.criticalEffects} | ${treeB.summary.criticalEffects} |`);
    lines.push(`| Systemic Risks | ${treeA.systemicRisks.length} | ${treeB.systemicRisks.length} |`);
    lines.push(`| Blind Spots | ${treeA.secondOrderConsequences.filter(n => n.blindSpot).length} | ${treeB.secondOrderConsequences.filter(n => n.blindSpot).length} |`);
    lines.push("");

    // Winner logic
    const scoreA = treeA.summary.avgConsequenceScore + treeA.summary.criticalEffects * 0.5;
    const scoreB = treeB.summary.avgConsequenceScore + treeB.summary.criticalEffects * 0.5;

    lines.push(`## 🏆 Second-Order Verdict`);
    if (Math.abs(scoreA - scoreB) < 0.5) {
      lines.push(`Both options carry **similar aggregate second-order risk**. The choice should be driven by first-order strategic fit and reversibility preferences.`);
    } else if (scoreA < scoreB) {
      lines.push(`**Option A ("${decisionA}")** carries lower aggregate second-order risk (score: ${scoreA.toFixed(1)} vs ${scoreB.toFixed(1)}).`);
    } else {
      lines.push(`**Option B ("${decisionB}")** carries lower aggregate second-order risk (score: ${scoreB.toFixed(1)} vs ${scoreA.toFixed(1)}).`);
    }
    lines.push("");

    // Unique risks of each
    lines.push(`## Option A — Unique High-Impact Effects`);
    treeA.secondOrderConsequences
      .filter(n => n.score >= 6)
      .slice(0, 3)
      .forEach(n => lines.push(`- ${n.magnitude.emoji} [${n.dimension}] ${n.effect}`));
    lines.push("");

    lines.push(`## Option B — Unique High-Impact Effects`);
    treeB.secondOrderConsequences
      .filter(n => n.score >= 6)
      .slice(0, 3)
      .forEach(n => lines.push(`- ${n.magnitude.emoji} [${n.dimension}] ${n.effect}`));
    lines.push("");

    lines.push(`> Run \`analyze_decision\` on each option individually for the full consequence tree.`);

    return { content: [{ type: "text", text: lines.join("\n") }] };
  }
);

// ── Tool 3: Blind spot probe ──────────────────────────────────────────────

server.tool(
  "probe_blind_spots",
  "Surfaces the most dangerous blind spots in a decision — effects that are high-impact but systematically invisible to normal analysis. " +
  "Use this when a decision already has mainstream analysis and you want to stress-test it.",
  {
    decision:    z.string().describe("The decision to stress-test."),
    context:     z.string().optional(),
    assumptions: z.array(z.string()).default([]).describe(
      "Key assumptions currently underpinning the decision. The tool will challenge each one."
    ),
  },
  async ({ decision, context, assumptions }) => {
    const tree = buildConsequenceTree({
      decision, context, stakeholders: [], timeHorizon: "long", dimensions: [], depth: 2,
    });

    const blindSpotNodes = tree.secondOrderConsequences
      .filter(n => n.blindSpot)
      .sort((a, b) => b.score - a.score);

    const lines = [];
    lines.push(`# 🔍 Blind Spot Probe: "${decision}"`);
    lines.push("");
    lines.push(`Identified **${blindSpotNodes.length} structural blind spots** in the second-order consequence landscape.`);
    lines.push("");

    blindSpotNodes.forEach((n, i) => {
      lines.push(`## Blind Spot ${i + 1}: ${n.dimension} (Score: ${n.score}/10)`);
      lines.push(`**Effect:** ${n.effect}`);
      lines.push(`**Why it's invisible:** ${n.blindSpot}`);
      lines.push(`**Time horizon:** ${n.timeHorizon}`);
      lines.push(`**Detection signal:** Monitor for early proxy indicators — even weak signals carry high information value here.`);
      lines.push("");
    });

    if (assumptions.length > 0) {
      lines.push(`## 🧩 Assumption Challenges`);
      lines.push(`You provided ${assumptions.length} assumptions. Here is a second-order challenge for each:`);
      lines.push("");
      assumptions.forEach((assumption, i) => {
        lines.push(`### Assumption ${i + 1}: *"${assumption}" *`);
        lines.push(`**What if this is wrong?** If this assumption fails, the most dangerous downstream consequence is likely in the **${
          ["Systemic", "Social", "Economic", "Psychological"][i % 4]
        }** dimension — specifically around ${
          ["feedback-loop disruption", "trust erosion", "cost compounding", "motivation collapse"][i % 4]
        }.`);
        lines.push(`**Pre-commitment test:** What evidence would convince you this assumption has failed? Name it now.`);
        lines.push("");
      });
    }

    lines.push(`## 🛡️ Stress-Test Recommendation`);
    lines.push(`Run a structured pre-mortem with this framing: *"It is 24 months from now. The decision failed in the worst possible way. Which blind spot was the cause?"*`);
    lines.push(`Assign each blind spot to a named person who is responsible for monitoring it before you proceed.`);

    return { content: [{ type: "text", text: lines.join("\n") }] };
  }
);

// ── Tool 4: Inversion analysis ────────────────────────────────────────────

server.tool(
  "invert_decision",
  "Applies Charlie Munger's inversion principle to second-order thinking: " +
  "'Instead of asking how to make this decision succeed, ask how to make it fail catastrophically — then avoid those paths.'",
  {
    decision:    z.string().describe("The decision or goal to invert."),
    context:     z.string().optional(),
  },
  async ({ decision, context }) => {
    const tree = buildConsequenceTree({
      decision, context, stakeholders: [], timeHorizon: "medium", dimensions: [], depth: 2,
    });

    const worstEffects = [...tree.firstOrderConsequences, ...tree.secondOrderConsequences]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const lines = [];
    lines.push(`# 🔄 Inversion Analysis: "${decision}"`);
    lines.push("");
    lines.push(`## The Inverted Question`);
    lines.push(`Instead of: *"How do I make this succeed?"*`);
    lines.push(`Ask: *"How could I guarantee this fails catastrophically in second-order terms?"*`);
    lines.push("");

    lines.push(`## Top 5 Failure Modes (Inverted Consequences)`);
    lines.push(`These are the highest-scoring second-order effects. To **guarantee failure**, do these things. To **succeed**, actively prevent them:`);
    lines.push("");

    worstEffects.forEach((n, i) => {
      lines.push(`### ${i + 1}. Failure Mode: ${n.dimension} (Score: ${n.score}/10)`);
      lines.push(`**How to guarantee failure:** Ignore the ${n.dimension.toLowerCase()} dimension entirely. Assume ${
        n.assumption ?? "the status quo in this dimension is stable"
      }.`);
      lines.push(`**Inverted prevention strategy:** ${generateInvertedPrevention(n)}`);
      lines.push("");
    });

    lines.push(`## 🎯 The Inversion Summary`);
    lines.push(`The most reliable path to failure for "${decision}" runs through **${worstEffects[0]?.dimension ?? "systemic"} effects**. `);
    lines.push(`If you can robustly prevent the top 3 failure modes above, the second-order risk profile improves substantially.`);

    return { content: [{ type: "text", text: lines.join("\n") }] };
  }
);

function generateInvertedPrevention(node) {
  const preventionMap = {
    "Economic":      "Explicitly account for second-round cost effects in the business case; build a full 24-month P&L that includes talent, rework, and opportunity costs.",
    "Social":        "Design for the social contract, not just the org chart. Communicate early, explain the reasoning, and create channels for concerns.",
    "Psychological": "Address identity and meaning, not just logistics. Name the loss explicitly and give people a positive narrative to move toward.",
    "Systemic":      "Maintain at least one redundant feedback loop before removing any others. Map dependencies before cutting.",
    "Temporal":      "Build staged reversibility into the commitment structure. Refuse to treat sunk costs as arguments for continuation.",
    "Political":     "Identify the stakeholders most likely to resist and bring them into the design process before the decision is announced.",
    "Technological": "Negotiate explicit exit clauses and data portability rights into every technology commitment. Test the exit path before you lock in.",
    "Environmental": "Calculate the full lifecycle cost, including externalities priced at their expected future regulatory cost.",
  };
  return preventionMap[node.dimension] ?? "Monitor this dimension with a named owner and a pre-defined escalation threshold.";
}

// ─────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
