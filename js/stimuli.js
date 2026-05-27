/**
 * 刺激序列生成器
 * 迁移自 brainworkshop.pyw 的 bt_sequence 生成逻辑
 */

const StimuliGenerator = {
    // 九宫格位置 0-8
    POSITIONS: [0, 1, 2, 3, 4, 5, 6, 7, 8],

    // 声音字母（标准 letters 集：c, h, k, l, q, r, s, t）
    LETTERS: ['c', 'h', 'k', 'l', 'q', 'r', 's', 't'],

    /**
     * 生成完整刺激序列
     * @param {number} totalTrials - 总 trial 数
     * @param {number} nBackPos - 位置 N-Back 级别
     * @param {number} nBackAudio - 声音 N-Back 级别
     * @param {object} config - 配置项
     * @returns {Array} 刺激序列数组
     */
    generate(totalTrials, nBackPos, nBackAudio, config = {}) {
        const nBack = nBackPos; // 向后兼容：取较大值作为总 nBack
        const {
            chanceOfGuaranteedMatch = 0.125,
            chanceOfInterference = 0.125,
            jaeggiMode = false
        } = config;

        const sequence = [];

        // 先随机生成各维度的值
        for (let i = 0; i < totalTrials; i++) {
            sequence.push({
                position: this._randomPick(this.POSITIONS),
                audio: this._randomPick(this.LETTERS),
            });
        }

        // 非 Jaeggi 模式：按概率注入匹配和干扰
        if (!jaeggiMode) {
            const minN = Math.min(nBackPos, nBackAudio);
            const maxN = Math.max(nBackPos, nBackAudio);
            for (let i = maxN; i < totalTrials; i++) {
                // 位置匹配（回溯 nBackPos 步）
                const rPos = Math.random();
                if (i >= nBackPos && rPos < chanceOfGuaranteedMatch) {
                    sequence[i].position = sequence[i - nBackPos].position;
                } else if (i >= nBackPos && rPos < chanceOfGuaranteedMatch + chanceOfInterference) {
                    const offset = this._randomPick([
                        Math.max(1, nBackPos - 1),
                        nBackPos + 1,
                        nBackPos * 2
                    ]);
                    if (i >= offset) {
                        sequence[i].position = sequence[i - offset].position;
                    }
                }

                // 声音匹配（回溯 nBackAudio 步）
                const rAudio = Math.random();
                if (i >= nBackAudio && rAudio < chanceOfGuaranteedMatch) {
                    sequence[i].audio = sequence[i - nBackAudio].audio;
                } else if (i >= nBackAudio && rAudio < chanceOfGuaranteedMatch + chanceOfInterference) {
                    const offset = this._randomPick([
                        Math.max(1, nBackAudio - 1),
                        nBackAudio + 1,
                        nBackAudio * 2
                    ]);
                    if (i >= offset) {
                        sequence[i].audio = sequence[i - offset].audio;
                    }
                }
            }
        } else {
            // Jaeggi 模式：每会话固定 4 个位置匹配 + 4 个声音匹配 + 2 个双匹配
            this._applyJaeggiMatches(sequence, totalTrials, nBack);
        }

        // 标记每个 trial 是否为匹配（各维度独立 N）
        const startMark = Math.max(nBackPos, nBackAudio);
        for (let i = startMark; i < totalTrials; i++) {
            if (i >= nBackPos) {
                sequence[i].positionMatch = (sequence[i].position === sequence[i - nBackPos].position);
            }
            if (i >= nBackAudio) {
                sequence[i].audioMatch = (sequence[i].audio === sequence[i - nBackAudio].audio);
            }
        }

        return sequence;
    },

    /**
     * 计算总 trial 数（原版公式）
     * total = numTrials + numTrialsFactor * nBack^numTrialsExponent
     */
    calcTotalTrials(nBack, numTrials = 20, factor = 1, exponent = 2) {
        // 最小保证 20 + N 个 trial，这样前面 N 个 trial 作为预热
        return numTrials + factor * Math.pow(nBack, exponent);
    },

    _randomPick(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    },

    _applyJaeggiMatches(sequence, totalTrials, nBack) {
        // 简化实现：随机选 4 个位置匹配、4 个声音匹配、2 个双匹配
        const availableIndices = [];
        for (let i = nBack; i < totalTrials; i++) {
            availableIndices.push(i);
        }
        this._shuffle(availableIndices);

        const dualCount = 2;
        const posCount = 4;
        const audioCount = 4;

        let idx = 0;
        for (let i = 0; i < dualCount && idx < availableIndices.length; i++, idx++) {
            const t = availableIndices[idx];
            sequence[t].position = sequence[t - nBack].position;
            sequence[t].audio = sequence[t - nBack].audio;
        }
        for (let i = 0; i < posCount && idx < availableIndices.length; i++, idx++) {
            const t = availableIndices[idx];
            sequence[t].position = sequence[t - nBack].position;
        }
        for (let i = 0; i < audioCount && idx < availableIndices.length; i++, idx++) {
            const t = availableIndices[idx];
            sequence[t].audio = sequence[t - nBack].audio;
        }
    },

    _shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    }
};
