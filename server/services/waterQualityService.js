/**
 * Water Quality Clinical Classification Service
 * Translates raw chemical telemetry into health-based actionable insights.
 */
const waterQualityService = {
    // Threshold Definitions
    THRESHOLDS: {
        DRINKABLE: { ph: [6.5, 8.5], tds: 300, turbidity: 1.0 },
        SAFE_USE: { ph: [6.0, 9.0], tds: 600, turbidity: 5.0 },
    },

    /**
     * Main Classification Engine
     */
    classify: (ph, tds, turbidity) => {
        let status = "Drinkable";
        let isDrinkable = true;
        let isUsable = true;
        let isToxic = false;
        let color = "emerald"; // emerald, amber, red
        let reasons = [];

        // 1. DRINKABLE CHECK
        if (ph < 6.5 || ph > 8.5) {
            isDrinkable = false;
            reasons.push(ph < 6.5 ? "pH level is too acidic for consumption" : "pH level is too alkaline for consumption");
        }
        if (tds >= 300) {
            isDrinkable = false;
            if (tds <= 600) reasons.push("Mineral content (TDS) is above optimal drinking levels");
        }
        if (turbidity > 1.0) {
            isDrinkable = false;
            reasons.push("Clarity (Turbidity) is below drinking standards");
        }

        // 2. TOXIC / UNSAFE CHECK
        if (tds > 1000 || ph < 5.0 || ph > 10.0 || turbidity > 10.0) {
            isToxic = true;
            isDrinkable = false;
            isUsable = false;
            status = "Unsafe / Toxic";
            color = "red";
            if (tds > 1000) reasons.push("TDS exceeds toxic safety limits (>1000 mg/L)");
            if (ph < 5.0 || ph > 10.0) reasons.push("Extreme pH levels indicate severe chemical contamination");
            if (turbidity > 10.0) reasons.push("Extreme turbidity suggests heavy pollutant load");
        }
        // 3. SAFE FOR USE CHECK
        else if (!isDrinkable) {
            status = "Safe for Use (Not Drinking)";
            color = "amber";
            reasons.push("Safe for washing and industrial uses only");
        } else {
            status = "✅ Safe to Drink";
            color = "emerald";
            reasons.push("Water is drinkable with balanced pH and low impurities");
        }

        return {
            status,
            isDrinkable,
            isUsable,
            isToxic,
            color,
            explanation: reasons.join(". "),
            mineralLevel: waterQualityService.getMineralLevel(tds)
        };
    },

    /**
     * Mineral Level Interpretation
     */
    getMineralLevel: (tds) => {
        if (tds < 150) return { label: "Low minerals", class: "text-blue-500" };
        if (tds <= 300) return { label: "Good", class: "text-emerald-500" };
        if (tds <= 600) return { label: "Moderate", class: "text-amber-500" };
        if (tds <= 1000) return { label: "High (Hard Water)", class: "text-orange-500" };
        return { label: "Very High (Unsafe)", class: "text-red-500 font-black" };
    }
};

module.exports = waterQualityService;
