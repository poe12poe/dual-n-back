/**
 * 游戏核心引擎
 * 状态机 + Tick 循环 + 键盘输入处理
 * 迁移自 brainworkshop.pyw 的 Mode 类和主循环
 */

const TICK_DURATION = 100;  // 每 tick 100ms (原版 pyglet 0.1s)

// 游戏状态枚举
const STATE = {
    IDLE: 'idle',           // 等待开始
    COUNTDOWN: 'countdown', // 倒计时 (3, 2, 1)
    RUNNING: 'running',     // 游戏进行中
    SUMMARY: 'summary',     // 显示结果
};

const GameCore = {
    _state: STATE.IDLE,
    _animFrameId: null,
    _lastTickTime: 0,

    // 游戏数据
    nBack: 2,
    nBackPos: 2,
    nBackAudio: 2,
    totalTrials: 29,
    trialNumber: 0,
    tick: 0,
    ticksPerTrial: 30,
    sequence: [],
    scoreAdjusted: false,
    independentNBack: false,

    // 用户输入记录
    _positionInputs: {},    // { trialIndex: true/false }
    _audioInputs: {},       // { trialIndex: true/false }

    // 当前 trial 的按键状态
    _posPressed: false,
    _audioPressed: false,

    // 回调
    onStateChange: null,    // (state, data)
    onTick: null,           // (gameData)

    async init() {
        Config.init();
        Stats.init();
        await AudioEngine.init();
        await AudioEngine.loadSoundSet();

        const lastN = Stats.getLastNBack();
        this.nBack = lastN || Config.get('nBack');
        this.independentNBack = Config.get('independentNBack');
        this.nBackPos = this.independentNBack ? (Config.get('nBackPos') || this.nBack) : this.nBack;
        this.nBackAudio = this.independentNBack ? (Config.get('nBackAudio') || this.nBack) : this.nBack;
        this.ticksPerTrial = Config.get('ticksPerTrial');
        this.totalTrials = StimuliGenerator.calcTotalTrials(
            this.nBack,
            Config.get('numTrials'),
            Config.get('numTrialsFactor'),
            Config.get('numTrialsExponent')
        );
    },

    /**
     * 开始游戏
     */
    async start() {
        if (this._state === STATE.COUNTDOWN || this._state === STATE.RUNNING) return;

        // 确保 AudioContext 已激活（浏览器自动播放策略）
        await AudioEngine.resume();

        // 生成刺激序列（每次 start 重新读取 N 设置）
        this.independentNBack = Config.get('independentNBack');
        const sessionNPos = this.independentNBack
            ? (Config.get('nBackPos') || this.nBack)
            : this.nBack;
        const sessionNAudio = this.independentNBack
            ? (Config.get('nBackAudio') || this.nBack)
            : this.nBack;
        this.nBackPos = sessionNPos;
        this.nBackAudio = sessionNAudio;
        const config = {
            chanceOfGuaranteedMatch: Config.get('chanceOfGuaranteedMatch'),
            chanceOfInterference: Config.get('chanceOfInterference'),
            jaeggiMode: Config.get('jaeggiMode'),
        };
        this.sequence = StimuliGenerator.generate(
            this.totalTrials, sessionNPos, sessionNAudio, config
        );
        this._sessionNPos = sessionNPos;
        this._sessionNAudio = sessionNAudio;

        // 重置状态
        this.trialNumber = 0;
        this.tick = 0;
        this._positionInputs = {};
        this._audioInputs = {};
        this._posPressed = false;
        this._audioPressed = false;
        this.scoreAdjusted = false;
        Scorer.reset();

        // 开始倒计时
        this._setState(STATE.COUNTDOWN, { count: 3 });
        Stats.startSession(this.nBack, this.totalTrials, 'Dual N-Back');

        // 启动游戏循环
        this._startLoop();
    },

    /**
     * 停止游戏
     */
    stop() {
        this._stopLoop();
        this._setState(STATE.IDLE);
    },

    /**
     * 键盘输入处理（即时反馈）
     */
    handleKey(key) {
        AudioEngine.resume();

        if (this._state === STATE.IDLE && key === ' ') {
            this.start();
            return;
        }

        if (this._state === STATE.RUNNING) {
            if (key === 'a' || key === 'A') {
                this._handlePositionInput();
            } else if (key === 'l' || key === 'L') {
                this._handleAudioInput();
            } else if (key === 'Escape') {
                this.stop();
            }
        }
    },

    /**
     * 鼠标输入：左键 → 位置匹配
     */
    handleMousePosition() {
        AudioEngine.resume();
        if (this._state === STATE.RUNNING) {
            this._handlePositionInput();
        }
    },

    /**
     * 鼠标输入：右键 → 声音匹配
     */
    handleMouseAudio() {
        AudioEngine.resume();
        if (this._state === STATE.RUNNING) {
            this._handleAudioInput();
        }
    },

    /**
     * 处理位置输入 + 即时反馈
     */
    _handlePositionInput() {
        if (this._posPressed) return; // 每个 trial 只记录一次
        this._posPressed = true;

        const ti = this.trialNumber;
        if (ti < (this._sessionNPos ?? this.nBackPos)) return;

        const match = this.sequence[ti]?.positionMatch || false;
        AudioEngine.playFeedback(match ? 'correct' : 'wrong', 'position');
        Renderer.showDimFeedback('position', match ? 'correct' : 'wrong');
    },

    /**
     * 处理声音输入 + 即时反馈
     */
    _handleAudioInput() {
        if (this._audioPressed) return;
        this._audioPressed = true;

        const ti = this.trialNumber;
        if (ti < (this._sessionNAudio ?? this.nBackAudio)) return;

        const match = this.sequence[ti]?.audioMatch || false;
        AudioEngine.playFeedback(match ? 'correct' : 'wrong', 'audio');
        Renderer.showDimFeedback('audio', match ? 'correct' : 'wrong');
    },

    /**
     * 主 Tick 循环
     */
    _startLoop() {
        this._lastTickTime = performance.now();
        const loop = (timestamp) => {
            if (this._state === STATE.IDLE || this._state === STATE.SUMMARY) {
                this._animFrameId = null;
                return;
            }

            const elapsed = timestamp - this._lastTickTime;

            if (elapsed >= TICK_DURATION) {
                this._lastTickTime = timestamp;
                this._processTick();
            }

            this._animFrameId = requestAnimationFrame(loop);
        };
        this._animFrameId = requestAnimationFrame(loop);
    },

    _stopLoop() {
        if (this._animFrameId) {
            cancelAnimationFrame(this._animFrameId);
            this._animFrameId = null;
        }
    },

    /**
     * 处理单个 tick
     */
    _processTick() {
        const state = this._state;

        if (state === STATE.COUNTDOWN) {
            this.tick++;
            if (this.tick >= 30) { // 3 秒倒计时
                this.tick = 0;
                this._setState(STATE.RUNNING);
                this._startTrial();
            }
        } else if (state === STATE.RUNNING) {
            this._runTick();
        }
    },

    /**
     * 运行中的 tick 逻辑
     */
    _runTick() {
        // tick 0: 显示新刺激 + 播放声音
        if (this.tick === 0) {
            this._posPressed = false;
            this._audioPressed = false;
            this._showStimulus();
        }

        // 每个 tick 检查是否有新按键（由 handleKey 设置标志）
        // 按键在 tick 结束时收集

        this.tick++;

        // trial 结束
        if (this.tick >= this.ticksPerTrial) {
            this._checkAnswers();
            this.tick = 0;
            this._nextTrial();
        }
    },

    _startTrial() {
        this.trialNumber = 0;
        this.tick = 0;
    },

    /**
     * 显示当前 trial 的刺激
     */
    _showStimulus() {
        const stim = this.sequence[this.trialNumber];
        if (!stim) return;

        // 清除上一 trial 的反馈
        Renderer.clearDimFeedback();

        // 播放声音
        AudioEngine.play(stim.audio);

        // 通知 UI 更新
        if (this.onTick) {
            this.onTick({
                nBack: this.nBack,
                trialNumber: this.trialNumber + 1,
                totalTrials: this.totalTrials,
                currentPosition: stim.position,
                currentAudio: stim.audio,
                state: STATE.RUNNING,
            });
        }
    },

    /**
     * 记录当前 trial 的输入结果 + 漏按反馈
     */
    _checkAnswers() {
        const ti = this.trialNumber;

        this._positionInputs[ti] = this._posPressed;
        this._audioInputs[ti] = this._audioPressed;

        // 漏按反馈：有匹配但用户没按 → 标红
        const nPos = this._sessionNPos ?? this.nBackPos;
        const nAudio = this._sessionNAudio ?? this.nBackAudio;
        const stim = this.sequence[ti];
        if (stim && ti >= nPos && !this._posPressed && stim.positionMatch) {
            AudioEngine.playFeedback('wrong', 'position');
            Renderer.showDimFeedback('position', 'wrong');
        }
        if (stim && ti >= nAudio && !this._audioPressed && stim.audioMatch) {
            AudioEngine.playFeedback('wrong', 'audio');
            Renderer.showDimFeedback('audio', 'wrong');
        }
    },

    /**
     * 进入下一个 trial（或结束）
     */
    _nextTrial() {
        this.trialNumber++;

        if (this.trialNumber >= this.totalTrials) {
            this._endSession();
        } else {
            this.tick = 0;
            this._posPressed = false;
            this._audioPressed = false;
            // _showStimulus() 由 _runTick() 在 tick=0 时触发，避免重复播放
        }
    },

    /**
     * 会话结束：评分 + 调整 N-Back
     */
    async _endSession() {
        this._stopLoop();

        // 提取答案数组
        const posResponses = [];
        const audioResponses = [];
        const posMatches = [];
        const audioMatches = [];

        for (let i = 0; i < this.totalTrials; i++) {
            posResponses.push(this._positionInputs[i] || false);
            audioResponses.push(this._audioInputs[i] || false);
            posMatches.push(this.sequence[i]?.positionMatch || false);
            audioMatches.push(this.sequence[i]?.audioMatch || false);
        }

        // 从第 nBack 个 trial 开始计分
        // 各维度从各自的 N 开始计分
        const nPos = this._sessionNPos ?? this.nBackPos;
        const nAudio = this._sessionNAudio ?? this.nBackAudio;
        const posResult = Scorer.calcModalScore(posResponses, posMatches, nPos);
        const audioResult = Scorer.calcModalScore(audioResponses, audioMatches, nAudio);

        const jaeggiMode = Config.get('jaeggiMode');
        const overallPercent = Scorer.calcOverall(posResult, audioResult, jaeggiMode);

        // 构建逐 trial 细节
        const trialDetails = [];
        for (let i = 0; i < this.totalTrials; i++) {
            const s = this.sequence[i] || {};
            const posMatch = posMatches[i];
            const audioMatch = audioMatches[i];
            const posPressed = posResponses[i];
            const audioPressed = audioResponses[i];
            const scoringPos = (i >= nPos);
            const scoringAudio = (i >= nAudio);

            trialDetails.push({
                trial: i + 1,
                pos: (s.position ?? '-'),
                audio: (s.audio ?? '-').toUpperCase(),
                posMatch, audioMatch,
                posPressed, audioPressed,
                posOk: scoringPos ? (posPressed === posMatch) : null,
                audioOk: scoringAudio ? (audioPressed === audioMatch) : null,
                scoringPos, scoringAudio,
            });
        }

        // 调整 N-Back（独立模式下各维度分别调整）
        let posAdj = null, audioAdj = null;
        if (this.independentNBack) {
            posAdj = Scorer.adjustNBack(this.nBackPos, jaeggiMode ? posResult.scoreJaeggi : posResult.scoreBW, {
                jaeggiMode, thresholdAdvance: Config.get('thresholdAdvance'),
                thresholdFallback: Config.get('thresholdFallback'),
                jaeggiAdvance: Config.get('jaeggiAdvance'),
                jaeggiFallback: Config.get('jaeggiFallback'),
                manual: Config.get('manual'),
            });
            audioAdj = Scorer.adjustNBack(this.nBackAudio, jaeggiMode ? audioResult.scoreJaeggi : audioResult.scoreBW, {
                jaeggiMode, thresholdAdvance: Config.get('thresholdAdvance'),
                thresholdFallback: Config.get('thresholdFallback'),
                jaeggiAdvance: Config.get('jaeggiAdvance'),
                jaeggiFallback: Config.get('jaeggiFallback'),
                manual: Config.get('manual'),
            });

            const oldPos = this.nBackPos, oldAudio = this.nBackAudio;
            if (!Config.get('manual')) {
                if (posAdj.action === 'advance') this.nBackPos = posAdj.newN;
                else if (posAdj.action === 'fallback') this.nBackPos = posAdj.newN;
                if (audioAdj.action === 'advance') this.nBackAudio = audioAdj.newN;
                else if (audioAdj.action === 'fallback') this.nBackAudio = audioAdj.newN;
            }
            this.nBack = Math.max(this.nBackPos, this.nBackAudio);
            this.totalTrials = StimuliGenerator.calcTotalTrials(
                this.nBack, Config.get('numTrials'),
                Config.get('numTrialsFactor'), Config.get('numTrialsExponent')
            );
            this.scoreAdjusted = (oldPos !== this.nBackPos || oldAudio !== this.nBackAudio);

            Stats.startSession(this.nBack, this.totalTrials, 'Dual N-Back');
            Stats.recordResult(overallPercent,
                jaeggiMode ? posResult.scoreJaeggi : posResult.scoreBW,
                jaeggiMode ? audioResult.scoreJaeggi : audioResult.scoreBW,
                this.totalTrials
            );
            await Stats.finishSession();

            this._setState(STATE.SUMMARY, {
                overallPercent,
                posScore: jaeggiMode ? posResult.scoreJaeggi : posResult.scoreBW,
                audioScore: jaeggiMode ? audioResult.scoreJaeggi : audioResult.scoreBW,
                posTP: posResult.TP, posFP: posResult.FP, posFN: posResult.FN,
                audioTP: audioResult.TP, audioFP: audioResult.FP, audioFN: audioResult.FN,
                independentNBack: true,
                oldN: oldPos, newN: Math.max(this.nBackPos, this.nBackAudio),
                oldPos, oldAudio,
                newPos: this.nBackPos,
                newAudio: this.nBackAudio,
                posAdj: posAdj?.action || 'maintain',
                audioAdj: audioAdj?.action || 'maintain',
                jaeggiMode,
                trialDetails,
            });
            return;
        }

        const adjustment = Scorer.adjustNBack(this.nBack, overallPercent, {
            jaeggiMode,
            thresholdAdvance: Config.get('thresholdAdvance'),
            thresholdFallback: Config.get('thresholdFallback'),
            jaeggiAdvance: Config.get('jaeggiAdvance'),
            jaeggiFallback: Config.get('jaeggiFallback'),
            manual: Config.get('manual'),
        });

        const oldN = this.nBack;
        if (!Config.get('manual') && adjustment.action !== 'maintain' && adjustment.action !== 'fallback_warning') {
            this.nBack = adjustment.newN;
            this.nBackPos = this.nBack;
            this.nBackAudio = this.nBack;
            this.totalTrials = StimuliGenerator.calcTotalTrials(
                this.nBack,
                Config.get('numTrials'),
                Config.get('numTrialsFactor'),
                Config.get('numTrialsExponent')
            );
            this.scoreAdjusted = true;
        }

        // 播放晋级/降级音效
        if (adjustment.action === 'advance') {
            AudioEngine.playFeedback('advance');
        }

        // 保存统计
        Stats.recordResult(
            overallPercent,
            jaeggiMode ? posResult.scoreJaeggi : posResult.scoreBW,
            jaeggiMode ? audioResult.scoreJaeggi : audioResult.scoreBW,
            this.totalTrials
        );
        await Stats.finishSession();

        // 显示结果
        this._setState(STATE.SUMMARY, {
            overallPercent,
            posScore: jaeggiMode ? posResult.scoreJaeggi : posResult.scoreBW,
            audioScore: jaeggiMode ? audioResult.scoreJaeggi : audioResult.scoreBW,
            posTP: posResult.TP, posFP: posResult.FP, posFN: posResult.FN,
            audioTP: audioResult.TP, audioFP: audioResult.FP, audioFN: audioResult.FN,
            oldN, newN: this.nBack,
            adjustment: adjustment.action,
            jaeggiMode,
            trialDetails,
        });
    },

    /**
     * 获取当前游戏数据（供渲染器使用）
     */
    getRenderData() {
        return {
            nBack: this.nBack,
            nBackPos: this.nBackPos,
            nBackAudio: this.nBackAudio,
            independentNBack: this.independentNBack,
            trialNumber: this.trialNumber + 1,
            totalTrials: this.totalTrials,
            currentPosition: this.sequence[this.trialNumber]?.position ?? null,
            currentAudio: this.sequence[this.trialNumber]?.audio ?? null,
            state: this._state,
        };
    },

    getState() {
        return this._state;
    },

    _setState(newState, data = {}) {
        this._state = newState;
        if (this.onStateChange) {
            this.onStateChange(newState, data);
        }
    }
};
