/**
 * 统计管理模块
 * 前端 localStorage + 后端 JSON 持久化
 */

const Stats = {
    _currentSession: null,
    _localHistory: [],

    init() {
        try {
            const saved = localStorage.getItem('dual_n_back_sessions');
            if (saved) {
                this._localHistory = JSON.parse(saved);
            }
        } catch (e) {
            this._localHistory = [];
        }
    },

    /**
     * 开始记录新会话
     */
    startSession(nBack, totalTrials, modeName) {
        const today = new Date().toISOString().slice(0, 10);
        const todaySessions = this._localHistory.filter(
            s => (s.date || '').startsWith(today)
        );

        this._currentSession = {
            date: new Date().toISOString().replace('T', ' ').slice(0, 19),
            nLevel: nBack,
            nBackPos: Config.get('independentNBack') ? Config.get('nBackPos') || nBack : nBack,
            nBackAudio: Config.get('independentNBack') ? Config.get('nBackAudio') || nBack : nBack,
            independentNBack: Config.get('independentNBack'),
            totalTrials: totalTrials,
            modeName: modeName || 'Dual N-Back',
            modeId: 2,
            ticks: Config.get('ticksPerTrial'),
            manual: Config.get('manual'),
            percent: 0,
            positionScore: 0,
            audioScore: 0,
            sessionOfDay: todaySessions.length + 1,
        };
    },

    /**
     * 记录会话结果
     */
    recordResult(percent, posScore, audioScore, trials) {
        if (!this._currentSession) return;
        this._currentSession.percent = Math.round(percent * 10) / 10;
        this._currentSession.positionScore = Math.round(posScore * 10) / 10;
        this._currentSession.audioScore = Math.round(audioScore * 10) / 10;
        this._currentSession.trials = trials;
        this._currentSession.session = this._localHistory.length + 1;
    },

    /**
     * 完成会话，保存到本地
     */
    async finishSession() {
        if (!this._currentSession) return null;

        const session = { ...this._currentSession };
        this._localHistory.push(session);
        localStorage.setItem('dual_n_back_sessions', JSON.stringify(this._localHistory));

        this._currentSession = null;
        return session;
    },

    /**
     * 获取今日会话数
     */
    getTodaySessions() {
        const today = new Date().toISOString().slice(0, 10);
        return this._localHistory.filter(s => (s.date || '').startsWith(today)).length;
    },

    /**
     * 获取最近的 N-Back 级别（用于跨会话连续性）
     */
    getLastNBack() {
        if (this._localHistory.length === 0) return null;

        const latest = this._localHistory[this._localHistory.length - 1];
        const today = new Date().toISOString().slice(0, 10);

        // 同一天内的会话保持 N-Back 连续性
        if ((latest.date || '').startsWith(today)) {
            return latest.nLevel;
        }
        return null;
    },

    getAllSessions() {
        return [...this._localHistory];
    },

    clear() {
        this._localHistory = [];
        this._currentSession = null;
        localStorage.removeItem('dual_n_back_sessions');
    }
};
