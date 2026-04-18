const db = require('../db');
const waterQuality = require('./waterQualityService');

/**
 * AI Engine Service - 6 Layer Decision Support
 */
const aiEngine = {
    // --- LAYER 1: DETECTION (Graph + Threshold) ---
    detectAnomalies: (sensor, neighbors = [], history = []) => {
        const insights = [];
        let isAnomaly = false;

        // 1. Sudden Pressure Drop (∆P)
        let pressureDropScore = 0;
        if (history.length >= 1) {
            const prev = history[0];
            const drop = Math.max(0, prev.pressure - sensor.pressure);
            // Heightened sensitivity: a 1.5 bar drop should be nearly 100% leak probability
            if (drop > 0.4) {
                pressureDropScore = Math.min(100, drop * 60);
                insights.push(`Significant Pressure Drop: ${drop.toFixed(2)} bar detected vs previous`);
            }
        }

        // 2. Flow Anomaly (∆F)
        let flowAnomalyScore = 0;
        if (history.length >= 1) {
            const prev = history[0];
            const flowDev = Math.abs(sensor.flow - prev.flow);
            if (flowDev > 4) {
                flowAnomalyScore = Math.min(100, flowDev * 15);
                insights.push(`Flow Anomaly: Surge of ${flowDev.toFixed(1)} L/s detected`);
            }
        }

        // 3. Graph-Based Neighbor Comparison (Neighbor_Diff)
        let neighborDiffScore = 0;
        if (neighbors.length > 0) {
            const avgPressure = neighbors.reduce((acc, n) => acc + (n.pressure || 0), 0) / neighbors.length;
            const deviation = Math.abs(sensor.pressure - avgPressure);
            const deviationPercent = (deviation / (avgPressure || 1)) * 100;

            if (deviationPercent > 10) {
                neighborDiffScore = Math.min(deviationPercent * 2, 100);
                insights.push(`Infrastructure Drift: ${deviationPercent.toFixed(1)}% deviation from pipeline baseline`);
            }
        }

        // 4. Absolute Threshold Check (Critical failure states)
        if (sensor.pressure < 1.5) {
            insights.push(`Critical Pressure Failure: ${sensor.pressure.toFixed(2)} bar is dangerously low`);
            isAnomaly = true;
        }
        if (sensor.flow > 30) {
            insights.push(`Excessive Flow Volume: ${sensor.flow.toFixed(1)} L/s detected`);
            isAnomaly = true;
        }

        // Final Leak Score Calculation (Weighted)
        let leakScore = Math.max(pressureDropScore, flowAnomalyScore, neighborDiffScore);

        // Boost score if absolute thresholds are breached
        if (sensor.pressure < 1.5) leakScore = Math.max(leakScore, 85);
        if (sensor.flow > 30) leakScore = Math.max(leakScore, 80);

        if (leakScore > 40) isAnomaly = true;

        // Clinical Quality Check (Clinical Layer)
        const health = waterQuality.classify(sensor.ph, sensor.tds, sensor.turbidity);
        if (health.isToxic) {
            isAnomaly = true;
        }

        insights.push(...health.explanation.split('. '));

        return {
            isAnomaly,
            leakScore,
            detectionInsights: insights,
            health: health
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
