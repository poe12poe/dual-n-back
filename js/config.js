/**
 * 配置管理模块
 * 读写 localStorage，管理所有游戏配置项
 */

const DEFAULT_CONFIG = {
    // 游戏模式
    gameMode: 2,            // 2 = Dual N-Back（Phase 1 固定）
    nBack: 2,               // 起始 N-Back 级别
    independentNBack: false, // 位置和声音独立 N 级别
    nBackPos: 2,             // 位置独立 N（independentNBack 为 true 时生效）
    nBackAudio: 3,           // 声音独立 N
    manual: false,          // 手动模式（手动调整 N-Back）

    // 评分
    jaeggiMode: false,      // Jaeggi 评分模式
    thresholdAdvance: 80,   // 标准晋级阈值 (%)
    thresholdFallback: 50,  // 标准降级阈值 (%)
    jaeggiAdvance: 90,      // Jaeggi 晋级阈值
    jaeggiFallback: 75,     // Jaeggi 降级阈值

    // Trial 设置
    numTrials: 20,          // 基础 trial 数
    numTrialsFactor: 1,     // Trial 数因子
    numTrialsExponent: 2,   // Trial 数指数
    ticksPerTrial: 30,      // 每 trial 的 tick 数 (30 = 3.0s)

    // 刺激生成
    chanceOfGuaranteedMatch: 0.15,   // 强制匹配概率
    chanceOfInterference: 0.15,      // 干扰概率

    // 显示
    animateSquares: true,   // 方块动画
    showFeedback: true,     // 显示正确/错误反馈
    hideText: false,        // 隐藏文字叠加
    blackBackground: false, // 黑底模式
    crosshairs: true,       // 十字准星
    gridlines: true,        // 网格线

    // 音频
    useMusic: false,        // 背景音乐（Phase 1 暂不启用）
    useApplause: false,     // 鼓掌音效
    soundSet: "letters",    // 声音集

    // 窗口
    fullscreen: false,
};

const CONFIG_KEY = "dual_n_back_config";

const Config = {
    _data: {},

    init() {
        try {
            const saved = localStorage.getItem(CONFIG_KEY);
            if (saved) {
                this._data = { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
            } else {
                this._data = { ...DEFAULT_CONFIG };
            }
        } catch (e) {
            this._data = { ...DEFAULT_CONFIG };
        }
    },

    get(key) {
        return this._data[key] ?? DEFAULT_CONFIG[key];
    },

    set(key, value) {
        this._data[key] = value;
        this._save();
    },

    getAll() {
        return { ...this._data };
    },

    reset() {
        this._data = { ...DEFAULT_CONFIG };
        this._save();
    },

    _save() {
        localStorage.setItem(CONFIG_KEY, JSON.stringify(this._data));
    }
};
