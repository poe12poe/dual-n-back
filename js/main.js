/**
 * 主入口
 * 初始化所有模块，绑定事件，启动渲染循环
 */

// ---------- 全局错误捕获 ----------
window._errorMessages = [];

window.addEventListener('error', function (e) {
    const msg = `[${e.filename?.split('/').pop() || '?'}:${e.lineno}] ${e.message}`;
    window._errorMessages.push(msg);
    console.error(msg);
    _showErrorOnCanvas(msg);
});

window.addEventListener('unhandledrejection', function (e) {
    const msg = `[Promise] ${e.reason?.message || e.reason}`;
    window._errorMessages.push(msg);
    console.error(msg);
    _showErrorOnCanvas(msg);
});

function _showErrorOnCanvas(msg) {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#F44336';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    const lines = window._errorMessages.slice(-5);
    ctx.fillText('Error: ' + lines[lines.length - 1], 10, 30);
}

// ---------- 主逻辑 ----------

let _renderLoopId = null;
let _countdownValue = 0;
let _countdownTimer = null;

async function init() {
    try {
        // 初始化所有模块
        await GameCore.init();
        UI.init();
        Renderer.init('game-canvas');
    } catch (e) {
        window._errorMessages.push('[Init] ' + e.message);
        console.error('[Init]', e);
        _showErrorOnCanvas('[Init] ' + e.message);
        return;
    }

    try {
        // 应用主题
        const isDark = Config.get('blackBackground');
        document.body.classList.toggle('dark', isDark);
        const themeBtn = document.getElementById('theme-toggle');
        if (themeBtn) themeBtn.textContent = isDark ? '\u2600' : '\u263E';

    // 键盘事件
    document.addEventListener('keydown', (e) => {
        // 设置/摘要面板打开时不处理游戏按键（由 UI 模块自行处理）
        const settingsPanel = document.getElementById('settings-panel');
        if (settingsPanel && settingsPanel.classList.contains('visible')) return;

        const summaryPanel = document.getElementById('summary-panel');
        if (summaryPanel && summaryPanel.classList.contains('visible')) return;

        GameCore.handleKey(e.key);
    });

    // 鼠标事件：单 handler + e.buttons 位掩码检测双键
    const canvas = document.getElementById('game-canvas');
    if (!canvas) return;

    canvas.addEventListener('pointerdown', (e) => {
        AudioEngine.resume();

        if (GameCore.getState() === STATE.IDLE) {
            const statsPanel = document.getElementById('stats-panel');
            if (statsPanel && statsPanel.classList.contains('visible')) return;
            GameCore.start();
            return;
        }
        if (GameCore.getState() !== STATE.RUNNING) return;

        // e.buttons: 1=左键按下  2=右键按下  3=双键同时
        const b = e.buttons;
        if (b & 1) GameCore.handleMousePosition();
        if (b & 2) GameCore.handleMouseAudio();
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // 游戏状态变化回调
    GameCore.onStateChange = (state, data) => {
        console.log('State:', state, data);

        if (state === STATE.IDLE) {
            UI.hideSummary();
            Renderer.renderIdle();
            _stopCountdown();
        } else if (state === STATE.COUNTDOWN) {
            UI.hideSummary();
            _startCountdown();
        } else if (state === STATE.SUMMARY) {
            _stopCountdown();
            UI.showSummary(data);
            Renderer.renderIdle();
        }
    };

    // Tick 回调
    GameCore.onTick = (data) => {
        if (_countdownTimer) return; // 倒计时期间不渲染游戏内容
        Renderer.render(data);
    };

    // 开始空闲渲染循环
    _startIdleRender();
    } catch (e) {
        window._errorMessages.push('[Init Setup] ' + e.message);
        console.error('[Init Setup]', e);
        _showErrorOnCanvas('[Setup] ' + e.message);
    }
}

function _startIdleRender() {
    const loop = () => {
        const state = GameCore.getState();
        if (state === STATE.IDLE || state === STATE.SUMMARY) {
            Renderer.renderIdle();
        } else if (state === STATE.RUNNING) {
            // 持续渲染以支持反馈动画
            Renderer.render(GameCore.getRenderData());
        }
        _renderLoopId = requestAnimationFrame(loop);
    };
    _renderLoopId = requestAnimationFrame(loop);
}

function _startCountdown() {
    _countdownValue = 3;
    Renderer.renderCountdown(_countdownValue);

    _countdownTimer = setInterval(() => {
        _countdownValue--;
        if (_countdownValue <= 0) {
            _stopCountdown();
        } else {
            Renderer.renderCountdown(_countdownValue);
        }
    }, 1000);
}

function _stopCountdown() {
    if (_countdownTimer) {
        clearInterval(_countdownTimer);
        _countdownTimer = null;
    }
    _countdownValue = 0;
}

// 设置面板按钮事件
function setupSettingsButtons() {
    const saveBtn = document.getElementById('btn-save-settings');
    const resetBtn = document.getElementById('btn-reset-settings');
    const statsBtn = document.getElementById('stats-toggle');

    if (saveBtn) saveBtn.addEventListener('click', () => UI.saveSettings());
    if (resetBtn) resetBtn.addEventListener('click', () => UI.resetSettings());
    if (statsBtn) statsBtn.addEventListener('click', () => UI.showStats());
}

// 启动
document.addEventListener('DOMContentLoaded', () => {
    init();
    setupSettingsButtons();
});
