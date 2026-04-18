const db = require('../db');
const waterQuality = require('./waterQualityService');

/**
 * AI Engine Service - 6 Layer Decision Support
 */
const aiEngine = {
    // --- LAYER 1: DETECTION (Normalized, Averaged, False-Positive-Safe) ---
    detectAnomalies: (sensor, neighbors = [], history = []) => {
        const insights = [];
        let isAnomaly = false;

        // ── Normalisation constants ────────────────────────────────────────────
        const MAX_PRESSURE_DROP  = 2.0;   // bar  – max realistic single-cycle drop
        const MAX_FLOW_CHANGE    = 15.0;  // L/s  – max realistic flow surge
        const MAX_NEIGHBOR_DIFF  = 1.5;   // bar  – max expected neighbour deviation
        const MIN_SIGNAL         = 0.15;  // below this each score is treated as noise

        // 1. Sudden Pressure Drop (normalised 0–1)
        let pressureScore = 0;
        let pressureDrop  = 0;
        if (history.length >= 1) {
            const prev = history[0];
            pressureDrop = Math.max(0, (prev.pressure || 0) - (sensor.pressure || 0));
            pressureScore = Math.min(1, pressureDrop / MAX_PRESSURE_DROP);
            if (pressureScore >= MIN_SIGNAL) {
                insights.push(`Pressure drop: ${pressureDrop.toFixed(2)} bar vs previous reading`);
            }
        }

        // 2. Flow Anomaly (normalised 0–1)
        let flowScore   = 0;
        let flowChange  = 0;
        if (history.length >= 1) {
            const prev = history[0];
            flowChange = Math.max(0, (sensor.flow || 0) - (prev.flow || 0)); // only upward surge
            flowScore  = Math.min(1, flowChange / MAX_FLOW_CHANGE);
            if (flowScore >= MIN_SIGNAL) {
                insights.push(`Flow surge: +${flowChange.toFixed(1)} L/s above previous reading`);
            }
        }

        // 3. Neighbour comparison (normalised 0–1)
        let neighborScore    = 0;
        let neighborAvg      = 0;
        let neighborDeviation = 0;
        if (neighbors.length > 0) {
            const validNeighbors = neighbors.filter(n => n.pressure > 0);
            if (validNeighbors.length > 0) {
                neighborAvg  = validNeighbors.reduce((a, n) => a + n.pressure, 0) / validNeighbors.length;
                // Only score when THIS sensor is LOWER than neighbours (not just different)
                neighborDeviation = Math.max(0, neighborAvg - (sensor.pressure || 0));
                neighborScore = Math.min(1, neighborDeviation / MAX_NEIGHBOR_DIFF);
                if (neighborScore >= MIN_SIGNAL) {
                    insights.push(`Neighbour avg: ${neighborAvg.toFixed(2)} bar vs current ${(sensor.pressure || 0).toFixed(2)} bar (diff: ${neighborDeviation.toFixed(2)} bar)`);
                }
            }
        }

        // 4. Absolute limit overrides (only for extreme values)
        let absoluteBoost = 0;
        if ((sensor.pressure || 0) > 0 && (sensor.pressure || 0) < 1.2) {
            absoluteBoost = 0.85; // critically low pressure
            insights.push(`Critical pressure: ${(sensor.pressure || 0).toFixed(2)} bar`);
        }
        if ((sensor.flow || 0) > 32) {
            absoluteBoost = Math.max(absoluteBoost, 0.80);
            insights.push(`Excessive flow: ${(sensor.flow || 0).toFixed(1)} L/s`);
        }

        // ── AVERAGED formula (no single metric drives 100%) ───────────────────
        // Guard: if all three signals are below noise threshold, score = 0
        const activeScores = [pressureScore, flowScore, neighborScore].filter(s => s >= MIN_SIGNAL);
        let leakScore = 0;
        if (activeScores.length > 0) {
            // Average of normalised scores → prevents single-metric dominance
            const avg = activeScores.reduce((a, b) => a + b, 0) / activeScores.length;
            leakScore = Math.round(Math.min(100, Math.max(absoluteBoost, avg) * 100));
        } else if (absoluteBoost > 0) {
            leakScore = Math.round(absoluteBoost * 100);
        }
        // Else leakScore stays 0 — no signal, no alarm

        if (leakScore > 40) isAnomaly = true;

        // ── Quality check (does NOT inflate leakScore) ────────────────────────
        const health = waterQuality.classify(sensor.ph, sensor.tds, sensor.turbidity);
        if (health.isToxic) isAnomaly = true;

        return {
            isAnomaly,
            leakScore,
            pressureScore:    Math.round(pressureScore * 100),
            flowScore:        Math.round(flowScore * 100),
            neighborScore:    Math.round(neighborScore * 100),
            pressureDrop:     parseFloat(pressureDrop.toFixed(2)),
            flowChange:       parseFloat(flowChange.toFixed(1)),
            neighborAvg:      parseFloat(neighborAvg.toFixed(2)),
            neighborDeviation: parseFloat(neighborDeviation.toFixed(2)),
            detectionInsights: insights,
            health
        };
    },


    // --- LAYER 2: PREDICTION & FORECASTING (Enriched Trend Analysis) ---
    getAdvancedAnalytics: (sensor, history = []) => {
        const params = ['pressure', 'flow', 'ph', 'turbidity', 'tds'];
        const analysis = {};
        const insights = [];

        if (history.length < 3) {
            return {
                status: 'Insufficient History',
                confidence: 0,
                metrics: {},
                generalExplanantion: 'Minimum 3 historical points required for predictive modeling.'
            };
        }

        let totalConfidence = 0;

        params.forEach(param => {
            const values = [sensor[param], ...history.map(h => h[param])].filter(v => v !== undefined);
            if (values.length < 3) return;

            // 1. Trend Detection (Slope calculation)
            const slopes = [];
            for (let i = 0; i < values.length - 1; i++) {
                slopes.push(values[i] - values[i + 1]);
            }
            const avgSlope = slopes.reduce((a, b) => a + b, 0) / slopes.length;
            const trend = avgSlope > 0.05 ? 'Increasing' : (avgSlope < -0.05 ? 'Decreasing' : 'Stable');
            const direction = avgSlope > 0.05 ? '↑' : (avgSlope < -0.05 ? '↓' : '→');

            // 2. Future Value Forecast (Simple linear extrapolation)
            const predictedValue = values[0] + avgSlope;

            // 3. Confidence Score (based on slope consistency)
            const variance = slopes.reduce((a, b) => a + Math.pow(b - avgSlope, 2), 0) / slopes.length;
            const paramConfidence = Math.max(0, 100 - (variance * 1000)); // Lower variance = higher confidence

            analysis[param] = {
                current: parseFloat(values[0]?.toFixed(2)),
                avgSlope: parseFloat(avgSlope.toFixed(4)),
                trend,
                direction,
                predicted: parseFloat(predictedValue.toFixed(2)),
                confidence: Math.round(paramConfidence)
            };
            totalConfidence += paramConfidence;
        });

        const overallConfidence = Math.round(totalConfidence / Object.keys(analysis).length);

        // 4. Multi-Parameter AI Logic & Explainable Output (XAI)
        // Check for Leak Risk (Pressure ↓ and Flow ↑)
        if (analysis.pressure?.trend === 'Decreasing' && analysis.flow?.trend === 'Increasing') {
            insights.push({
                type: 'Leak Risk',
                level: 'High',
                explanation: 'Critical correlation detected: Sustained pressure drop combined with abnormal flow oscillation strongly suggests a structural pipe rupture.'
            });
        } else if (analysis.pressure?.trend === 'Decreasing') {
            insights.push({
                type: 'Pressure Alert',
                level: 'Medium',
                explanation: 'Gradual pressure decline observed. While flow remains stable, this trend indicates potential friction loss or minor weepage.'
            });
        }

        // Check for Contamination Risk (Turbidity ↑ and TDS ↑)
        if (analysis.turbidity?.trend === 'Increasing' && analysis.tds?.trend === 'Increasing') {
            insights.push({
                type: 'Quality Degradation',
                level: 'High',
                explanation: 'Dual-variable anomaly: Synchronized rise in turbidity and TDS levels indicates significant particulate intrusion or chemical imbalance.'
            });
        } else if (analysis.ph?.trend !== 'Stable') {
            insights.push({
                type: 'pH Instability',
                level: 'Low',
                explanation: `pH levels are ${analysis.ph.trend.toLowerCase()}, which may affect mineral solubility and pipe longevity.`
            });
        }

        if (insights.length === 0) {
            insights.push({
                type: 'System Health',
                level: 'Low',
                explanation: 'Operational parameters exhibit high statistical stability. No significant predictive anomalies identified.'
            });
        }

        return {
            status: 'success',
            confidence: overallConfidence,
            metrics: analysis,
            insights: insights,
            executiveSummary: insights[0].explanation
        };
    },

    // --- LAYER 3: DECISION (Update with Advanced Risk Logic) ---
    evaluateRisk: (advancedAnalytics) => {
        let maxImpact = 0;
        advancedAnalytics.insights.forEach(insight => {
            const score = insight.level === 'High' ? 90 : (insight.level === 'Medium' ? 50 : 20);
            if (score > maxImpact) maxImpact = score;
        });

        // Decay risk if confidence is low
        const riskScore = maxImpact * (advancedAnalytics.confidence / 100);

        let level = 'Low';
        if (riskScore > 70) level = 'High';
        else if (riskScore > 35) level = 'Medium';

        return { score: Math.round(riskScore), level };
    },

    // --- LAYER 4: RECOMMENDATION (Actionable Advice) ---
    getRecommendations: (riskLevel, detectionInsights) => {
        const recommendations = [];
        if (riskLevel === 'High') {
            recommendations.push("Dispatch emergency repair crew immediately.");
            recommendations.push("Isolate segment via secondary valves.");
            recommendations.push("Issue 'Boil Water' advisory if contamination is flagged.");
        } else if (riskLevel === 'Medium') {
            recommendations.push("Schedule preventive maintenance within 24 hours.");
            recommendations.push("Increase sensor polling frequency to 1s.");
        } else {
            recommendations.push("Routine monitoring sufficient.");
        }
        return recommendations;
    },

    // --- LAYER 5: RESOURCE ALLOCATION (Priority Ranking) ---
    rankPipelines: async (pipelines, sensors) => {
        const ranking = pipelines.map(pipe => {
            const pipeSensors = sensors.filter(s => s.pipeline_id === pipe.id);
            if (!pipeSensors.length) return { ...pipe, priorityScore: 0 };

            const avgRisk = pipeSensors.reduce((acc, s) => acc + (s.riskScore || 0), 0) / pipeSensors.length;
            // Weighted by length and sensor density (placeholder for impacts)
            const priorityScore = avgRisk * 1.2;

            return {
                id: pipe.id,
                name: pipe.name,
                priorityScore,
                riskLevel: avgRisk > 70 ? 'High' : (avgRisk > 40 ? 'Medium' : 'Low'),
                techRequired: avgRisk > 70 ? 3 : (avgRisk > 40 ? 1 : 0)
            };
        }).sort((a, b) => b.priorityScore - a.priorityScore);

        return ranking;
    },

    // --- LAYER 6: DECISION SUPPORT ENGINE (Combinator) ---
    generateExecutiveDecision: (riskLevel, prediction) => {
        if (riskLevel === 'High') return "IMMEDIATE INTERVENTION REQUIRED";
        if (riskLevel === 'Medium' && prediction.trend !== 'Stable') return "PREVENTIVE ACTION RECOMMENDED";
        if (riskLevel === 'Medium') return "INCREASED SURVEILLANCE";
        return "ALL SYSTEMS NOMINAL";
    },

    // --- LAYER 7: PRESCRIPTIVE ACTION QUEUE (Critical Focus Mode) ---
    getPrescriptiveActions: (sensor, neighbors = [], history = []) => {
        const detection = aiEngine.detectAnomalies(sensor, neighbors, history);
        const actions = [];

        // 1. CRITICAL LEAK (RED)
        if (detection.leakScore > 40) {
            actions.push({
                type: 'CRITICAL',
                condition: 'CRITICAL PIPE LEAK',
                atNode: sensor.name,
                explanation: `Detected pressure drop of ${detection.detectionInsights.find(i => i.includes('Pressure'))?.split(': ')[1] || 'significant amount'} with abnormal flow oscillation.`,
                impact: 'Causes volumetric loss and service interruption in surrounding sectors.',
                priority: 'URGENT'
            });
        }

        // 2. CONTAMINATION WARNING (YELLOW)
        if (sensor.turbidity > 2.5 || sensor.tds > 800) {
            actions.push({
                type: 'WARNING',
                condition: 'QUALITY CONTAMINATION',
                atNode: sensor.name,
                explanation: `Turbidity (${sensor.turbidity.toFixed(1)} NTU) exceeds safe drinking water standards.`,
                impact: 'Risk of sediment buildup and potential health safety violation.',
                priority: 'HIGH'
            });
        }

        // 3. SYSTEM STABLE (GREEN)
        if (actions.length === 0) {
            actions.push({
                type: 'STABLE',
                condition: 'NOMINAL OPERATION',
                atNode: sensor.name,
                explanation: 'Telemetry data indicates all hydraulic and quality parameters are within nominal equilibrium.',
                impact: 'Optimized network health and consistent water delivery.',
                priority: 'TARGET'
            });
        }

        return actions;
    },

    // --- UTILITY: Simplified Trend Analysis ---
    predictTrends: (sensor, history = []) => {
        if (!history || history.length === 0) return { trend: 'Stable', prediction: sensor.pressure };

        const prev = history[0];
        const diff = sensor.pressure - prev.pressure;
        const trend = Math.abs(diff) < 0.05 ? 'Stable' : (diff > 0 ? 'Increasing' : 'Decreasing');

        return {
            trend,
            prediction: sensor.pressure + diff
        };
    }
};

module.exports = aiEngine;
