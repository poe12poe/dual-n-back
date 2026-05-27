/**
 * 评分引擎
 * 实现 BW 标准评分和 Jaeggi 评分
 * N-Back 级别自适应调整
 */

const Scorer = {
    // 连续降级计数器 { nBack: count }
    _fallbackCounters: {},

    /**
     * 计算单模态得分
     * @param {Array} userResponses - 用户按键响应 { trialIndex: true/false }
     * @param {Array} actualMatches - 实际匹配情况 { trialIndex: true/false }
     * @param {number} startTrial - 开始计分的 trial（前 N 个 trial 不计分）
     * @returns {object} { TP, FP, FN, TN, score_bw, score_jaeggi }
     */
    calcModalScore(userResponses, actualMatches, startTrial) {
        let TP = 0, FP = 0, FN = 0, TN = 0;

        for (let i = startTrial; i < actualMatches.length; i++) {
            const pressed = userResponses[i] || false;
            const isMatch = actualMatches[i] || false;

            if (pressed && isMatch) TP++;
            else if (pressed && !isMatch) FP++;
            else if (!pressed && isMatch) FN++;
            else TN++;
        }

        const total = TP + FP + FN + TN;
        if (total === 0) return { TP: 0, FP: 0, FN: 0, TN: 0, scoreBW: 0, scoreJaeggi: 0 };

        // BW: TP/(TP+FP+FN)。若无信号且无虚报=完美抑制控制→100%
        const signalTotal = TP + FP + FN;
        const scoreBW = signalTotal > 0 ? (TP / signalTotal) * 100 : 100;
        const scoreJaeggi = (TP + TN) / total * 100;

        return { TP, FP, FN, TN, scoreBW, scoreJaeggi };
    },

    /**
     * Dual N-Back 综合评分
     * 各模态独立评分，取最低值（Jaeggi），或取平均（BW）
     */
    calcOverall(posResult, audioResult, jaeggiMode) {
        if (jaeggiMode) {
            return Math.min(posResult.scoreJaeggi, audioResult.scoreJaeggi);
        }
        // BW 模式：取各模态平均
        return (posResult.scoreBW + audioResult.scoreBW) / 2;
    },

    /**
     * 根据得分调整 N-Back 级别
     * @returns {{ newN: number, action: string }} action: 'advance' | 'maintain' | 'fallback'
     */
    adjustNBack(currentN, score, config) {
        const {
            jaeggiMode = false,
            thresholdAdvance = 80,
            thresholdFallback = 50,
            jaeggiAdvance = 90,
            jaeggiFallback = 75,
            manual = false
        } = config;

        if (manual) {
            return { newN: currentN, action: 'maintain' };
        }

        const advanceThreshold = jaeggiMode ? jaeggiAdvance : thresholdAdvance;
        const fallbackThreshold = jaeggiMode ? jaeggiFallback : thresholdFallback;

        if (score >= advanceThreshold) {
            return { newN: currentN + 1, action: 'advance' };
        }

        if (score < fallbackThreshold) {
            const key = currentN;
            this._fallbackCounters[key] = (this._fallbackCounters[key] || 0) + 1;
            if (this._fallbackCounters[key] >= 3) {
                this._fallbackCounters[key] = 0;
                return { newN: Math.max(1, currentN - 1), action: 'fallback' };
            }
            return { newN: currentN, action: 'fallback_warning' };
        }

        // 维持：重置降级计数器
        this._fallbackCounters[currentN] = 0;
        return { newN: currentN, action: 'maintain' };
    },

    reset() {
        this._fallbackCounters = {};
    }
};
