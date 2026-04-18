/**
 * SmartWater AI – Frontend Decision Engine v2
 * =============================================
 * Fully separated leak and contamination detection paths.
 * No cross-dependencies between the two detection domains.
 *
 * Architecture
 * ───────────────────────────────────────────────────────────────────
 *  detectLeak(sensor, neighbors)        → uses ONLY pressure + flow
 *  detectContamination(sensor)          → uses ONLY TDS + turbidity + pH
 *  detectSensorAnomaly(sensor, neighbors) → calls both, returns combined result
 *  generateAIInsight(sensor, neighbors, cycles) → mutual exclusion: contamination > leak
 *  mergeInsightQueue(existing, newInsights) → dedup + sort + cap at MAX_QUEUE
 */

// ─── Thresholds ─────────────────────────────────────────────────────────────
export const THRESHOLDS = {
  // ── Leak (pressure / flow ONLY) ───────────────────────────────────────────
  LEAK_NEIGHBOR_PRESSURE_DIFF: 0.5,  // bar  – deviation from pipeline avg = leak signal
  LEAK_PRESSURE_ABSOLUTE_LOW:  1.8,  // bar  – dangerously low absolute pressure
  LEAK_FLOW_HIGH:              28,   // L/s  – excessive flow = pipe breach signature
  LEAK_SCORE_CRITICAL:         70,
  LEAK_SCORE_WARNING:          35,

  // ── Contamination (TDS / turbidity / pH ONLY) ─────────────────────────────
  TURBIDITY_WARNING:   5.0,   // NTU
  TURBIDITY_CRITICAL:  15.0,
  TDS_WARNING:         500,   // mg/L
  TDS_CRITICAL:        900,
  PH_LOW:              6.5,
  PH_HIGH:             8.5,

  // ── Temporal validation ───────────────────────────────────────────────────
  TEMPORAL_CYCLES_REQUIRED: 2,
};

// ─── Internal Confidence Helper ──────────────────────────────────────────────
function calcConfidence(deviationRatio, agreeFraction, persistedCycles) {
  const deviationScore = Math.min(50, deviationRatio * 50);   // 0–50 pts
  const agreementScore = agreeFraction * 30;                   // 0–30 pts
  const temporalScore  = Math.min(20, persistedCycles * 10);  // 0–20 pts
  return Math.round(deviationScore + agreementScore + temporalScore);
}

// ============================================================================
//  DETECTION PATH 1: LEAK
//  Uses: pressure, flow  |  Never touches: TDS, turbidity, pH
// ============================================================================
/**
 * @param {object}   sensor     – live sensor reading
 * @param {object[]} neighbors  – other sensors on the same pipeline
 * @returns {{ leakScore: number, leakEvidence: object }}
 */
export function detectLeak(sensor, neighbors) {
  let leakScore = 0;
  const leakEvidence = {
    currentPressure: parseFloat((sensor.pressure ?? 0).toFixed(2)),
    currentFlow:     parseFloat((sensor.flow     ?? 0).toFixed(1)),
  };

  // 1. Neighbour pressure comparison
  const validNeighbors = neighbors.filter(n => n.pressure != null && n.pressure > 0);
  if (validNeighbors.length > 0) {
    const neighborAvg   = validNeighbors.reduce((s, n) => s + n.pressure, 0) / validNeighbors.length;
    const pressureDiff  = neighborAvg - (sensor.pressure ?? 0);
    leakEvidence.neighborAvg  = parseFloat(neighborAvg.toFixed(2));
    leakEvidence.pressureDiff = parseFloat(pressureDiff.toFixed(2));

    if (pressureDiff > THRESHOLDS.LEAK_NEIGHBOR_PRESSURE_DIFF) {
      const deviationPct = (pressureDiff / neighborAvg) * 100;
      leakEvidence.deviationPct = parseFloat(deviationPct.toFixed(1));
      leakScore = Math.max(leakScore, Math.min(100, deviationPct * 2));
    }
  }

  // 2. Absolute pressure floor
  if ((sensor.pressure ?? 0) < THRESHOLDS.LEAK_PRESSURE_ABSOLUTE_LOW && (sensor.pressure ?? 0) > 0) {
    leakScore = Math.max(leakScore, 85);
  }

  // 3. Excessive flow
  if ((sensor.flow ?? 0) > THRESHOLDS.LEAK_FLOW_HIGH) {
    const excess    = (sensor.flow - THRESHOLDS.LEAK_FLOW_HIGH);
    const flowScore = Math.min(100, (excess / 10) * 40 + 50);
    leakEvidence.flowAnomaly = parseFloat(excess.toFixed(1));
    leakScore = Math.max(leakScore, flowScore);
  }

  return { leakScore: Math.round(leakScore), leakEvidence };
}

// ============================================================================
//  DETECTION PATH 2: CONTAMINATION
//  Uses: TDS, turbidity, pH  |  Never touches: pressure, flow
// ============================================================================
/**
 * @param {object} sensor – live sensor reading
 * @returns {{ contaminationLevel: number, contaminationEvidence: object, isToxic: boolean }}
 */
export function detectContamination(sensor) {
  const turb = sensor.turbidity ?? 0;
  const tds  = sensor.tds      ?? 0;
  const ph   = sensor.ph       ?? 7.0;

  const contaminationEvidence = {
    turbidity: parseFloat(turb.toFixed(2)),
    tds:       Math.round(tds),
    ph:        parseFloat(ph.toFixed(2)),
  };

  let contaminationLevel = 0;

  // Score by severity — only quality parameters
  if (turb > THRESHOLDS.TURBIDITY_CRITICAL || tds > THRESHOLDS.TDS_CRITICAL) {
    contaminationLevel = 100;
  } else if (turb > THRESHOLDS.TURBIDITY_WARNING || tds > THRESHOLDS.TDS_WARNING) {
    contaminationLevel = 60;
  } else if (ph < THRESHOLDS.PH_LOW || ph > THRESHOLDS.PH_HIGH) {
    contaminationLevel = 30;
  }

  // Compute exceedances for evidence display
  if (turb > THRESHOLDS.TURBIDITY_WARNING) {
    contaminationEvidence.turbidityExcess = parseFloat((turb - THRESHOLDS.TURBIDITY_WARNING).toFixed(2));
  }
  if (tds > THRESHOLDS.TDS_WARNING) {
    contaminationEvidence.tdsExcess = Math.round(tds - THRESHOLDS.TDS_WARNING);
  }

  return {
    contaminationLevel,
    contaminationEvidence,
    isToxic: contaminationLevel >= 100,
  };
}

// ============================================================================
//  COMBINED DETECTOR  (used by App.jsx for temporal tracking)
//  Returns separate scores so App.jsx can track them with SEPARATE persistence keys
// ============================================================================
/**
 * @param {object}   sensor
 * @param {object[]} neighbors
 * @returns {{
 *   leakScore:          number,
 *   contaminationLevel: number,
 *   leakEvidence:       object,
 *   contaminationEvidence: object,
 *   isToxic:            boolean,
 * }}
 */
export function detectSensorAnomaly(sensor, neighbors) {
  const { leakScore, leakEvidence }                         = detectLeak(sensor, neighbors);
  const { contaminationLevel, contaminationEvidence, isToxic } = detectContamination(sensor);
  return { leakScore, contaminationLevel, leakEvidence, contaminationEvidence, isToxic };
}

// ============================================================================
//  INSIGHT GENERATOR  – mutual exclusion: contamination > leak
//  persistKey format the caller must use:
//    • `${sensor.id}-LEAK`          for leak tracking
//    • `${sensor.id}-CONTAMINATION` for contamination tracking
// ============================================================================
/**
 * @param {object}   sensor
 * @param {object[]} neighbors
 * @param {number}   leakCycles   – consecutive cycles the LEAK signal has persisted
 * @param {number}   contamCycles – consecutive cycles the CONTAMINATION signal has persisted
 * @returns {object|null} structured insight, or null if stable
 */
export function generateAIInsight(sensor, neighbors, leakCycles = 0, contamCycles = 0) {
  const { leakScore, contaminationLevel, leakEvidence, contaminationEvidence, isToxic }
    = detectSensorAnomaly(sensor, neighbors);

  const pipeline  = sensor.pipeline_name || `Pipeline #${sensor.pipeline_id}`;
  const node      = sensor.name          || `Sensor #${sensor.id}`;
  const timestamp = new Date().toLocaleTimeString();

  // ── PRIORITY 1: CONTAMINATION  (checked first – takes precedence) ──────────
  if (contaminationLevel >= 60 && contamCycles >= THRESHOLDS.TEMPORAL_CYCLES_REQUIRED) {
    const severity    = isToxic ? 'CRITICAL' : 'WARNING';
    const id          = `${sensor.id}-CONTAMINATION`;

    // Confidence: deviation magnitude + how many cycles it has persisted
    const deviationRatio = contaminationLevel / 100;
    // Agreement: how many sensors on same pipeline also exceed turbidity limit
    const agreeing = neighbors.filter(n => (n.turbidity ?? 0) > THRESHOLDS.TURBIDITY_WARNING || (n.tds ?? 0) > THRESHOLDS.TDS_WARNING).length;
    const agreeFraction  = neighbors.length > 0 ? agreeing / neighbors.length : 0;
    const confidence     = calcConfidence(deviationRatio, agreeFraction, contamCycles);

    const evidenceBullets = [
      `Turbidity: ${contaminationEvidence.turbidity} NTU  (safe limit: ${THRESHOLDS.TURBIDITY_WARNING} NTU)`,
      `TDS: ${contaminationEvidence.tds} mg/L  (safe limit: ${THRESHOLDS.TDS_WARNING} mg/L)`,
      `pH: ${contaminationEvidence.ph}  (safe range: ${THRESHOLDS.PH_LOW}–${THRESHOLDS.PH_HIGH})`,
      ...(contaminationEvidence.turbidityExcess != null ? [`Turbidity excess: +${contaminationEvidence.turbidityExcess} NTU above limit`] : []),
      ...(contaminationEvidence.tdsExcess != null ? [`TDS excess: +${contaminationEvidence.tdsExcess} mg/L above safe limit`] : [])
    ];

    return {
      id,
      type:     severity,
      kind:     'CONTAMINATION',      // ← explicit discriminator
      sensorId: sensor.id,
      pipeline,
      node,
      timestamp,

      event: isToxic
        ? `☣️ Contamination Detected – ${pipeline}`
        : `⚠️ Quality Degradation – ${pipeline}`,

      evidence: evidenceBullets,

      reasoning: isToxic
        ? `Turbidity (${contaminationEvidence.turbidity} NTU) and TDS (${contaminationEvidence.tds} mg/L) critically exceed WHO drinking-water standards. Anomaly confirmed over ${contamCycles} consecutive monitoring cycles.`
        : `Water quality parameters are outside safe operational limits. pH ${contaminationEvidence.ph} and turbidity ${contaminationEvidence.turbidity} NTU indicate likely contamination ingress at node ${node}.`,

      action: isToxic
        ? 'Issue Boil Water advisory immediately. Halt supply and initiate pipe flushing protocol.'
        : 'Increase monitoring frequency and dispatch water sample for laboratory analysis.',

      impact: isToxic
        ? 'Prevents public health risk and potential disease outbreak in the served area.'
        : 'Early detection prevents escalation to a full contamination emergency.',

      leakScore:          0,          // NOT a leak – explicitly zero
      contaminationLevel,
      confidence,
    };
  }

  // ── PRIORITY 2: LEAK  (only if contamination is not active) ───────────────
  if (leakScore >= THRESHOLDS.LEAK_SCORE_WARNING && leakCycles >= THRESHOLDS.TEMPORAL_CYCLES_REQUIRED) {
    const severity = leakScore >= THRESHOLDS.LEAK_SCORE_CRITICAL ? 'CRITICAL' : 'WARNING';
    const id       = `${sensor.id}-LEAK`;

    // Agreement: fraction of neighbours with higher pressure (they're not leaking)
    const validNeighbors  = neighbors.filter(n => n.pressure != null && n.pressure > 0);
    const agreedNeighbors = validNeighbors.filter(n => n.pressure > (sensor.pressure ?? 0) + 0.3).length;
    const agreeFraction   = validNeighbors.length > 0 ? agreedNeighbors / validNeighbors.length : 0;
    const confidence      = calcConfidence(leakScore / 100, agreeFraction, leakCycles);

    const pressureDrop = leakEvidence.pressureDiff ?? 0;
    const evidenceBullets = [
      `Pressure drop vs neighbours: ${pressureDrop.toFixed(2)} bar`,
      `Neighbour avg pressure: ${leakEvidence.neighborAvg ?? 'N/A'} bar`,
      `Current sensor pressure: ${leakEvidence.currentPressure} bar`,
      `Current flow rate: ${leakEvidence.currentFlow} L/s`,
      ...(leakEvidence.flowAnomaly != null ? [`Flow anomaly above threshold: +${leakEvidence.flowAnomaly} L/s`] : []),
      ...(leakEvidence.deviationPct != null ? [`Pressure deviation: ${leakEvidence.deviationPct}% below pipeline baseline`] : [])
    ];

    return {
      id,
      type:     severity,
      kind:     'LEAK',               // ← explicit discriminator
      sensorId: sensor.id,
      pipeline,
      node,
      timestamp,

      event: severity === 'CRITICAL'
        ? `🚨 Leak Detected – ${pipeline}`
        : `⚠️ Pressure Anomaly – ${pipeline}`,

      evidence: evidenceBullets,

      reasoning: pressureDrop > 0.8
        ? `Pressure drop of ${pressureDrop.toFixed(2)} bar relative to ${validNeighbors.length} neighbouring sensors strongly indicates a localised pipe rupture or valve failure. Anomaly confirmed over ${leakCycles} cycles.`
        : `Deviation from pipeline pressure baseline suggests a localised pressure imbalance. Confirmed over ${leakCycles} consecutive monitoring cycles.`,

      action: severity === 'CRITICAL'
        ? 'Dispatch inspection crew immediately and isolate segment via secondary valves.'
        : 'Schedule predictive maintenance inspection within 24 hours.',

      impact: severity === 'CRITICAL'
        ? 'Prevents uncontrolled water loss and downstream service disruption.'
        : 'Early intervention reduces risk of escalation to full pipe failure.',

      leakScore,
      contaminationLevel: 0,          // NOT contamination – explicitly zero
      confidence,
    };
  }

  // ── STABLE – no confirmed anomaly ─────────────────────────────────────────
  return null;
}

// ============================================================================
//  QUEUE MANAGEMENT
// ============================================================================
const MAX_QUEUE = 4;

/**
 * Merge new insights into the existing queue.
 * Deduplication is by insight.id (= sensorId-KIND).
 * Insights no longer present in newInsights are removed.
 */
export function mergeInsightQueue(existingQueue, newInsights) {
  // Build a map from the new batch (latest wins)
  const newMap = new Map(newInsights.map(i => [i.id, i]));

  // Keep old entries ONLY if they are also in this new batch (i.e. still active)
  // This ensures clearing works: when an anomaly resolves, it disappears
  const merged = new Map();
  existingQueue.forEach(i => {
    if (newMap.has(i.id)) merged.set(i.id, newMap.get(i.id)); // update with fresher data
  });
  // Add any brand-new insights not already in the queue
  newMap.forEach((insight, id) => {
    if (!merged.has(id)) merged.set(id, insight);
  });

  return Array.from(merged.values())
    .sort((a, b) => {
      const rank = { CRITICAL: 0, WARNING: 1 };
      return (rank[a.type] ?? 2) - (rank[b.type] ?? 2);
    })
    .slice(0, MAX_QUEUE);
}
