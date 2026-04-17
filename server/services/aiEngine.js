const db = require('../db');
const waterQuality = require('./waterQualityService');

/**
 * AI Engine Service - 6 Layer Decision Support
 */
const aiEngine = {
    // --- LAYER 1: DETECTION (Graph + Threshold) ---
    detectAnomalies: (sensor, neighbors = []) => {
        const insights = [];
        let leakScore = 0;
        let isAnomaly = false;

        // A. Graph-Based Detection
        if (neighbors.length > 0) {
            const avgPressure = neighbors.reduce((acc, n) => acc + (n.pressure || 0), 0) / neighbors.length;
            const deviation = Math.abs(sensor.pressure - avgPressure);
            const deviationPercent = (deviation / avgPressure) * 100;

            if (deviationPercent > 15) {
                isAnomaly = true;
                leakScore += Math.min(deviationPercent, 60);
                insights.push(`Graph Deviation: ${deviationPercent.toFixed(1)}% from peer average`);
            }
        }

        // B. Threshold-Based Detection (Enhanced Health Logic)
        const health = waterQuality.classify(sensor.ph, sensor.tds, sensor.turbidity);

        if (health.isToxic) {
            leakScore += 60;
            isAnomaly = true;
        } else if (!health.isDrinkable) {
            leakScore += 20;
        }

        insights.push(...health.explanation.split('. '));

        return {
            isAnomaly,
            leakScore,
            detectionInsights: insights,
            health: health // Pass through the clinical data
        };
    },

    // --- LAYER 2: PREDICTION (Trend Analysis) ---
    predictTrends: (sensor, history = []) => {
        if (history.length < 2) return { trend: 'Stable', prediction: 'Insufficient data for forecast' };

        const latest = history[0];
        const previous = history[1];

        // Pressure Trend
        const pressureChange = latest.pressure - previous.pressure;
        const pressureTrend = pressureChange < -0.2 ? 'Dropping' : (pressureChange > 0.2 ? 'Rising' : 'Stable');

        // Quality Trend
        const turbidityChange = latest.turbidity - previous.turbidity;
        const qualityTrend = turbidityChange > 0.5 ? 'Degrading' : 'Stable';

        let prediction = "System parameters within normal fluctuation ranges.";
        if (pressureTrend === 'Dropping') prediction = "⚠️ Pressure likely to drop significantly in next 10-15 minutes.";
        if (qualityTrend === 'Degrading') prediction = "⚠️ Water quality shows a degrading trend; monitor closely.";

        return { trend: pressureTrend, qualityTrend, prediction };
    },

    // --- LAYER 3: DECISION (Risk Logic) ---
    evaluateRisk: (detection, prediction) => {
        let totalScore = detection.leakScore;
        if (prediction.trend === 'Dropping') totalScore += 15;
        if (prediction.qualityTrend === 'Degrading') totalScore += 20;

        let level = 'Low';
        if (totalScore > 70) level = 'High';
        else if (totalScore > 40) level = 'Medium';

        return { score: Math.min(totalScore, 100), level };
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
    }
};

module.exports = aiEngine;
