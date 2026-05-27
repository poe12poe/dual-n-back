/**
 * Canvas 渲染器
 * 九宫格、刺激方块动画、维度反馈标签、文字叠加
 */

const Renderer = {
    _canvas: null,
    _ctx: null,
    _width: 0,
    _height: 0,
    _gridSize: 0,
    _gridOriginX: 0,
    _gridOriginY: 0,
    _cellSize: 0,

    // 动画状态
    _animSquare: null,

    // 位置重复闪动：{ startTime }
    _flashStart: null,
    _lastPosition: null,

    // 维度反馈 { position: 'correct'|'wrong'|null, audio: 'correct'|'wrong'|null }
    _dimFeedback: { position: null, audio: null },

    init(canvasId) {
        this._canvas = document.getElementById(canvasId);
        this._ctx = this._canvas.getContext('2d');
        this._resize();
        window.addEventListener('resize', () => this._resize());
    },

    _resize() {
        const container = this._canvas.parentElement;
        const size = Math.min(container.clientWidth, container.clientHeight - 80);
        this._canvas.width = size;
        this._canvas.height = size;

        this._width = size;
        this._height = size;

        const padding = size * 0.08;
        const gridArea = size - padding * 2;
        this._gridSize = gridArea;
        this._cellSize = gridArea / 3;
        this._gridOriginX = padding;
        this._gridOriginY = padding;
    },

    render(state) {
        const ctx = this._ctx;
        const w = this._width;
        const h = this._height;
        const isDark = Config.get('blackBackground');

        ctx.fillStyle = isDark ? '#1a1a2e' : '#f5f5f0';
        ctx.fillRect(0, 0, w, h);

        this._drawGrid(isDark);

        if (state.currentPosition !== null && state.currentPosition !== undefined) {
            this._drawSquare(state.currentPosition, isDark);
        }

        if (this._animSquare) {
            this._drawAnimSquare(isDark);
        }

        if (!Config.get('hideText')) {
            this._drawOverlay(state, isDark);
        }

        // 底部维度反馈标签（始终绘制）
        this._drawDimLabels(isDark);
    },

    _drawGrid(isDark) {
        const ctx = this._ctx;
        const ox = this._gridOriginX;
        const oy = this._gridOriginY;
        const cs = this._cellSize;
        const gs = this._gridSize;

        const lineColor = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)';
        const lineWidth = Math.max(1, this._width / 400);

        ctx.strokeStyle = lineColor;
        ctx.lineWidth = lineWidth;

        if (Config.get('gridlines')) {
            for (let i = 1; i < 3; i++) {
                ctx.beginPath();
                ctx.moveTo(ox + cs * i, oy);
                ctx.lineTo(ox + cs * i, oy + gs);
                ctx.stroke();
            }
            for (let i = 1; i < 3; i++) {
                ctx.beginPath();
                ctx.moveTo(ox, oy + cs * i);
                ctx.lineTo(ox + gs, oy + cs * i);
                ctx.stroke();
            }
        }

        if (Config.get('crosshairs')) {
            const crossColor = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
            ctx.strokeStyle = crossColor;
            ctx.lineWidth = 0.5;
            for (let row = 0; row < 3; row++) {
                for (let col = 0; col < 3; col++) {
                    const cx = ox + cs * col + cs / 2;
                    const cy = oy + cs * row + cs / 2;
                    const hl = cs * 0.2;
                    ctx.beginPath();
                    ctx.moveTo(cx - hl, cy);
                    ctx.lineTo(cx + hl, cy);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.moveTo(cx, cy - hl);
                    ctx.lineTo(cx, cy + hl);
                    ctx.stroke();
                }
            }
        }
    },

    _drawSquare(position, isDark) {
        const ctx = this._ctx;
        const ox = this._gridOriginX;
        const oy = this._gridOriginY;
        const cs = this._cellSize;

        const col = position % 3;
        const row = Math.floor(position / 3);
        const cx = ox + cs * col + cs / 2;
        const cy = oy + cs * row + cs / 2;

        const squareSize = cs * 0.55;
        const radius = cs * 0.08;

        // 连续位置重复 → 刺激方块渐显闪动
        const repeating = (position === this._lastPosition);
        if (repeating) {
            this._flashStart = performance.now();
        }
        this._lastPosition = position;

        ctx.fillStyle = isDark ? '#00d4ff' : '#2196F3';

        // 闪动：快速渐显（透明度从 0.25 到 1.0，约 250ms）
        let flashAlpha = 1.0;
        if (this._flashStart) {
            const elapsed = performance.now() - this._flashStart;
            if (elapsed > 250) {
                this._flashStart = null;
            } else {
                flashAlpha = 0.25 + 0.75 * (elapsed / 250);
            }
        }

        ctx.globalAlpha = flashAlpha;
        ctx.shadowColor = isDark ? 'rgba(0, 212, 255, 0.4)' : 'rgba(33, 150, 243, 0.3)';
        ctx.shadowBlur = cs * 0.15;
        this._roundRect(cx - squareSize / 2, cy - squareSize / 2, squareSize, squareSize, radius);
        ctx.fill();
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0;

        if (Config.get('animateSquares')) {
            this._animSquare = {
                x: cx, y: cy, size: squareSize, alpha: 0.6,
                startTime: performance.now()
            };
        }
    },

    _drawAnimSquare(isDark) {
        const elapsed = performance.now() - this._animSquare.startTime;
        const duration = 500;
        if (elapsed > duration) { this._animSquare = null; return; }

        const progress = elapsed / duration;
        const scale = 1 + progress * 2.5;
        const alpha = 0.6 * (1 - progress);

        const ctx = this._ctx;
        const s = this._animSquare.size * scale;
        const x = this._animSquare.x - s / 2;
        const y = this._animSquare.y - s / 2;
        const r = s * 0.08;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = isDark ? '#00d4ff' : '#2196F3';
        this._roundRect(x, y, s, s, r);
        ctx.fill();
        ctx.restore();
    },

    /**
     * 底部左右两栏：位置 [A] 和 声音 [L]
     * 按键时变绿/红，持续到下一个刺激
     */
    _drawDimLabels(isDark) {
        const ctx = this._ctx;
        const w = this._width;
        const h = this._height;
        const fontSize = Math.max(13, w * 0.035);

        const labelY = h - fontSize * 0.8;
        const centerX = w / 2;

        // 两个标签区域，对称分布在中心两侧
        const offset = w * 0.18;
        const leftX = centerX - offset;
        const rightX = centerX + offset;
        const labelW = w * 0.2;
        const labelH = fontSize * 2.6;
        const labelTop = labelY - labelH * 0.5;

        ctx.font = `${fontSize}px "Microsoft YaHei", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // --- 位置标签 ---
        this._drawOneLabel(ctx, leftX, labelTop, labelW, labelH, fontSize,
            '位置', 'A/左键', this._dimFeedback.position, isDark);

        // --- 声音标签 ---
        this._drawOneLabel(ctx, rightX, labelTop, labelW, labelH, fontSize,
            '声音', 'L/右键', this._dimFeedback.audio, isDark);
    },

    _drawOneLabel(ctx, cx, top, w, h, fontSize, title, hint, feedback, isDark) {
        const neutralBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
        const neutralText = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';
        const correctBg = 'rgba(76, 175, 80, 0.3)';
        const correctText = '#4CAF50';
        const wrongBg = 'rgba(244, 67, 54, 0.3)';
        const wrongText = '#F44336';

        let bg, textColor;
        if (feedback === 'correct') {
            bg = correctBg; textColor = correctText;
        } else if (feedback === 'wrong') {
            bg = wrongBg; textColor = wrongText;
        } else {
            bg = neutralBg; textColor = neutralText;
        }

        // 背景圆角矩形
        ctx.fillStyle = bg;
        this._roundRect(cx - w / 2, top, w, h, h * 0.3);
        ctx.fill();

        // 标题
        ctx.fillStyle = textColor;
        ctx.font = `bold ${fontSize}px "Microsoft YaHei", sans-serif`;
        ctx.fillText(title, cx, top + h * 0.32);

        // 按键提示
        ctx.fillStyle = feedback ? textColor : (isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)');
        ctx.font = `${fontSize * 0.6}px "Microsoft YaHei", sans-serif`;
        ctx.fillText(`[${hint}]`, cx, top + h * 0.72);
    },

    _drawOverlay(state, isDark) {
        const ctx = this._ctx;
        const textColor = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)';
        const fontSize = Math.max(12, this._width * 0.04);

        ctx.fillStyle = textColor;
        ctx.textAlign = 'left';
        ctx.font = `${fontSize}px "Microsoft YaHei", sans-serif`;
        if (state.independentNBack) {
            ctx.fillText(`位置 ${state.nBackPos}-Back  声音 ${state.nBackAudio}-Back`, 12, fontSize + 8);
        } else {
            ctx.fillText(`N-Back: ${state.nBack}`, 12, fontSize + 8);
        }
        ctx.fillText(`Dual N-Back`, 12, fontSize * 2 + 14);

        ctx.textAlign = 'right';
        ctx.fillText(
            `Trial: ${state.trialNumber}/${state.totalTrials}`,
            this._width - 12, fontSize + 8
        );
    },

    // ---- 维度反馈 API ----

    showDimFeedback(dim, type) {
        this._dimFeedback[dim] = type;
    },

    clearDimFeedback() {
        this._dimFeedback = { position: null, audio: null };
        this._flashStart = null;
        this._lastPosition = null;
    },

    // ---- 空闲/倒计时 ----

    renderIdle() {
        this._flashStart = null;
        this._lastPosition = null;
        const ctx = this._ctx;
        const w = this._width;
        const h = this._height;
        const isDark = Config.get('blackBackground');

        ctx.fillStyle = isDark ? '#1a1a2e' : '#f5f5f0';
        ctx.fillRect(0, 0, w, h);

        const fontSize = Math.max(16, w * 0.05);
        ctx.fillStyle = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)';
        ctx.font = `${fontSize}px "Microsoft YaHei", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('按 [空格] 或点击画布开始训练', w / 2, h / 2);

        ctx.font = `${fontSize * 0.6}px "Microsoft YaHei", sans-serif`;
        ctx.fillText('Dual N-Back', w / 2, h / 2 + fontSize * 1.8);

        this._drawDimLabels(isDark);
    },

    renderCountdown(count) {
        const ctx = this._ctx;
        const w = this._width;
        const h = this._height;
        const isDark = Config.get('blackBackground');

        ctx.fillStyle = isDark ? '#1a1a2e' : '#f5f5f0';
        ctx.fillRect(0, 0, w, h);

        if (count > 0) {
            const fontSize = w * 0.2;
            ctx.fillStyle = isDark ? '#00d4ff' : '#2196F3';
            ctx.font = `bold ${fontSize}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(count.toString(), w / 2, h / 2);
        }
    },

    _roundRect(x, y, w, h, r) {
        const ctx = this._ctx;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }
};
