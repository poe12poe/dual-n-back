/**
 * UI 交互管理
 * 设置面板、结果面板、摘要显示
 */

const UI = {
    _summaryCallback: null,

    init() {
        this._setupSettingsToggle();
        this._setupThemeToggle();
    },

    _setupSettingsToggle() {
        const btn = document.getElementById('settings-toggle');
        const panel = document.getElementById('settings-panel');
        if (!btn || !panel) return;

        btn.addEventListener('click', () => {
            panel.classList.toggle('visible');
            if (panel.classList.contains('visible')) {
                this._populateSettings();
            }
        });

        // 点击外部关闭
        document.addEventListener('click', (e) => {
            if (!panel.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
                panel.classList.remove('visible');
            }
        });
    },

    _setupThemeToggle() {
        const btn = document.getElementById('theme-toggle');
        if (!btn) return;

        btn.addEventListener('click', () => {
            const current = Config.get('blackBackground');
            Config.set('blackBackground', !current);
            this._applyTheme();
        });
    },

    _applyTheme() {
        const isDark = Config.get('blackBackground');
        document.body.classList.toggle('dark', isDark);
        const btn = document.getElementById('theme-toggle');
        if (btn) btn.textContent = isDark ? '\u2600' : '\u263E';
    },

    _populateSettings() {
        // N-Back 级别
        const nBackInput = document.getElementById('set-nback');
        if (nBackInput) nBackInput.value = Config.get('nBack');

        // Trial 数
        const trialsInput = document.getElementById('set-trials');
        if (trialsInput) trialsInput.value = Config.get('numTrials');

        // 评分模式
        const jaeggiCheck = document.getElementById('set-jaeggi');
        if (jaeggiCheck) jaeggiCheck.checked = Config.get('jaeggiMode');

        // Trial 时长
        const ticksInput = document.getElementById('set-ticks');
        if (ticksInput) ticksInput.value = Config.get('ticksPerTrial');

        // 动画
        const animateCheck = document.getElementById('set-animate');
        if (animateCheck) animateCheck.checked = Config.get('animateSquares');

        // 反馈
        const feedbackCheck = document.getElementById('set-feedback');
        if (feedbackCheck) feedbackCheck.checked = Config.get('showFeedback');

        // 网格线
        const gridCheck = document.getElementById('set-gridlines');
        if (gridCheck) gridCheck.checked = Config.get('gridlines');

        // 十字准星
        const crossCheck = document.getElementById('set-crosshairs');
        if (crossCheck) crossCheck.checked = Config.get('crosshairs');

        // 独立 N-Back
        const indepCheck = document.getElementById('set-independent-nback');
        if (indepCheck) {
            indepCheck.checked = Config.get('independentNBack');
            this._toggleIndependentNFields(indepCheck.checked);
            indepCheck.onchange = () => this._toggleIndependentNFields(indepCheck.checked);
        }
        const posN = document.getElementById('set-nback-pos');
        if (posN) posN.value = Config.get('nBackPos') || Config.get('nBack');
        const audioN = document.getElementById('set-nback-audio');
        if (audioN) audioN.value = Config.get('nBackAudio') || Config.get('nBack');
    },

    _toggleIndependentNFields(show) {
        const posGroup = document.getElementById('group-nback-pos');
        const audioGroup = document.getElementById('group-nback-audio');
        if (posGroup) posGroup.style.display = show ? '' : 'none';
        if (audioGroup) audioGroup.style.display = show ? '' : 'none';
    },

    saveSettings() {
        const nBack = parseInt(document.getElementById('set-nback')?.value) || 2;
        const numTrials = parseInt(document.getElementById('set-trials')?.value) || 20;
        const jaeggiMode = document.getElementById('set-jaeggi')?.checked || false;
        const ticksPerTrial = parseInt(document.getElementById('set-ticks')?.value) || 30;
        const animateSquares = document.getElementById('set-animate')?.checked ?? true;
        const showFeedback = document.getElementById('set-feedback')?.checked ?? true;
        const gridlines = document.getElementById('set-gridlines')?.checked ?? true;
        const crosshairs = document.getElementById('set-crosshairs')?.checked ?? true;
        const independentNBack = document.getElementById('set-independent-nback')?.checked || false;
        const nBackPos = parseInt(document.getElementById('set-nback-pos')?.value) || 2;
        const nBackAudio = parseInt(document.getElementById('set-nback-audio')?.value) || 3;

        Config.set('nBack', Math.max(1, Math.min(20, nBack)));
        Config.set('independentNBack', independentNBack);
        Config.set('nBackPos', Math.max(1, Math.min(20, nBackPos)));
        Config.set('nBackAudio', Math.max(1, Math.min(20, nBackAudio)));
        Config.set('numTrials', Math.max(5, Math.min(50, numTrials)));
        Config.set('jaeggiMode', jaeggiMode);
        Config.set('ticksPerTrial', Math.max(10, Math.min(60, ticksPerTrial)));
        Config.set('animateSquares', animateSquares);
        Config.set('showFeedback', showFeedback);
        Config.set('gridlines', gridlines);
        Config.set('crosshairs', crosshairs);

        // 应用更改
        GameCore.nBack = Config.get('nBack');
        GameCore.independentNBack = Config.get('independentNBack');
        GameCore.nBackPos = Config.get('nBackPos') || Config.get('nBack');
        GameCore.nBackAudio = Config.get('nBackAudio') || Config.get('nBack');
        GameCore.ticksPerTrial = Config.get('ticksPerTrial');
        GameCore.totalTrials = StimuliGenerator.calcTotalTrials(
            GameCore.nBack,
            Config.get('numTrials'),
            Config.get('numTrialsFactor'),
            Config.get('numTrialsExponent')
        );

        document.getElementById('settings-panel').classList.remove('visible');
        Renderer.renderIdle();
    },

    resetSettings() {
        Config.reset();
        this._populateSettings();
    },

    /**
     * 显示会话摘要（含 5 秒自动倒计时）
     */
    _summaryTimer: null,
    _summaryCountdown: 0,

    showSummary(data) {
        try {
        const summary = document.getElementById('summary-panel');
        if (!summary) return;

        const jaeggiMode = data.jaeggiMode;
        const scoreLabel = jaeggiMode ? 'Jaeggi 评分' : 'BW 评分';

        const adjLabels = {
            'advance': '晋级 ↑',
            'fallback': '降级 ↓',
            'fallback_warning': '警戒（维持）',
            'maintain': '维持',
        };

        // 生成逐 trial 表格
        let trialRows = '';
        if (data.trialDetails) {
            trialRows = data.trialDetails.map(t => {
                const posIcon = t.posOk === true ? '<span class="tc-ok">✓</span>' :
                                t.posOk === false ? '<span class="tc-wrong">✗</span>' :
                                '<span class="tc-na">-</span>';
                const audioIcon = t.audioOk === true ? '<span class="tc-ok">✓</span>' :
                                  t.audioOk === false ? '<span class="tc-wrong">✗</span>' :
                                  '<span class="tc-na">-</span>';
                const posBg = t.posOk === true ? 'tc-green' : t.posOk === false ? 'tc-red' : '';
                const audioBg = t.audioOk === true ? 'tc-green' : t.audioOk === false ? 'tc-red' : '';
                return `<tr class="${posBg} ${audioBg}">
                    <td>${t.trial}</td>
                    <td>${t.pos}</td><td>${t.posMatch ? '✓' : ''}</td>
                    <td>${t.posPressed ? '按' : ''}</td><td>${posIcon}</td>
                    <td>${t.audio}</td><td>${t.audioMatch ? '✓' : ''}</td>
                    <td>${t.audioPressed ? '按' : ''}</td><td>${audioIcon}</td>
                </tr>`;
            }).join('');
        }

        this._summaryCountdown = 20;
        const cdText = this._summaryCountdown;

        summary.innerHTML = `
            <div class="summary-layout">
                <div class="summary-content">
                <h2>训练完成</h2>
                <div class="summary-score">${data.overallPercent.toFixed(1)}%</div>
                <div class="summary-label">${scoreLabel}</div>
                <div class="summary-details">
                    <div class="summary-row">
                        <span>位置记忆</span>
                        <span>${data.posScore.toFixed(1)}%</span>
                    </div>
                    <div class="summary-row">
                        <span>声音记忆</span>
                        <span>${data.audioScore.toFixed(1)}%</span>
                    </div>
                    <div class="summary-row">
                        <span>位置 命中/虚报/漏报</span>
                        <span>${data.posTP} / ${data.posFP} / ${data.posFN}</span>
                    </div>
                    <div class="summary-row">
                        <span>声音 命中/虚报/漏报</span>
                        <span>${data.audioTP} / ${data.audioFP} / ${data.audioFN}</span>
                    </div>
                    ${data.independentNBack ? `
                    <div class="summary-row">
                        <span>位置 N 调整</span>
                        <span>${data.oldPos} → ${data.newPos} (${adjLabels[data.posAdj] || data.posAdj})</span>
                    </div>
                    <div class="summary-row">
                        <span>声音 N 调整</span>
                        <span>${data.oldAudio} → ${data.newAudio} (${adjLabels[data.audioAdj] || data.audioAdj})</span>
                    </div>` : `
                    <div class="summary-row">
                        <span>N-Back 调整</span>
                        <span>${data.oldN} → ${data.newN} (${adjLabels[data.adjustment] || data.adjustment})</span>
                    </div>`}
                </div>
                <div class="summary-countdown" id="summary-countdown">
                    ${cdText} 秒后自动开始下一轮...
                </div>
                <div class="summary-buttons">
                    <button class="btn-secondary" id="btn-exit">退出 (Esc)</button>
                    <button class="btn-secondary" id="btn-pause">暂停</button>
                    <button class="btn-secondary" id="btn-copy-md">复制为 MD</button>
                    <button class="btn-primary" id="btn-restart">继续 (空格)</button>
                </div>
            </div>
            ${data.trialDetails ? `
            <div class="trial-panel">
                <h3>逐 Trial 详情</h3>
                <div class="trial-table-wrap">
                    <table class="trial-table">
                        <thead><tr>
                            <th>#</th>
                            <th>位置</th><th>匹配</th>
                            <th>输入</th><th>结果</th>
                            <th>声音</th><th>匹配</th>
                            <th>输入</th><th>结果</th>
                        </tr></thead>
                        <tbody>${trialRows}</tbody>
                    </table>
                </div>
            </div>` : ''}
            </div>
        `;

        summary.classList.add('visible');

        // --- 按钮事件 ---
        const self = this;

        document.getElementById('btn-restart').addEventListener('click', () => {
            self._continueGame(summary);
        });
        document.getElementById('btn-exit').addEventListener('click', () => {
            self._exitToIdle(summary);
        });
        document.getElementById('btn-pause').addEventListener('click', () => {
            self._togglePause(summary);
        });
        document.getElementById('btn-copy-md').addEventListener('click', () => {
            self._copyAsMarkdown(data);
        });

        // --- 点击遮罩空白区域 = 退出 ---
        summary.addEventListener('click', (e) => {
            if (e.target === summary) {
                self._exitToIdle(summary);
            }
        });

        // --- 键盘事件 ---
        this._summaryCallback = (e) => {
            if (e.key === ' ' || e.code === 'Space') {
                e.preventDefault();
                self._continueGame(summary);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                self._exitToIdle(summary);
            }
        };
        document.addEventListener('keydown', this._summaryCallback);

        // --- 5 秒倒计时 ---
        this._startCountdown(summary);
        } catch (e) {
            console.error('showSummary error:', e);
            alert('训练数据展示出错: ' + e.message);
        }
    },

    _startCountdown(summary) {
        const cdEl = document.getElementById('summary-countdown');
        this._summaryCountdown = 20;

        this._summaryTimer = setInterval(() => {
            this._summaryCountdown--;
            if (cdEl) {
                cdEl.textContent = `${this._summaryCountdown} 秒后自动开始下一轮...`;
            }
            if (this._summaryCountdown <= 0) {
                this._continueGame(summary);
            }
        }, 1000);
    },

    _continueGame(summary) {
        this._cleanupSummary(summary);
        GameCore.start();
    },

    _exitToIdle(summary) {
        this._cleanupSummary(summary);
        GameCore.stop();
    },

    _togglePause(summary) {
        const btn = document.getElementById('btn-pause');
        const cdEl = document.getElementById('summary-countdown');
        if (this._summaryTimer) {
            clearInterval(this._summaryTimer);
            this._summaryTimer = null;
            if (btn) btn.textContent = '继续倒计时';
            if (cdEl) cdEl.textContent = `已暂停（${this._summaryCountdown} 秒）`;
        } else {
            if (btn) btn.textContent = '暂停';
            this._startCountdown(summary);
        }
    },

    _copyAsMarkdown(data) {
        const lines = [];
        lines.push('## 训练结果');
        lines.push('');
        lines.push(`- 模式: Dual N-Back | N: ${data.oldN ?? '-'} → ${data.newN ?? '-'}`);
        if (data.independentNBack) {
            lines.push(`- 位置: ${data.oldPos} → ${data.newPos} (${data.posAdj}) | 声音: ${data.oldAudio} → ${data.newAudio} (${data.audioAdj})`);
        }
        lines.push(`- 总得分: ${data.overallPercent.toFixed(1)}%`);
        lines.push(`- 位置: ${data.posScore.toFixed(1)}% (TP=${data.posTP} FP=${data.posFP} FN=${data.posFN})`);
        lines.push(`- 声音: ${data.audioScore.toFixed(1)}% (TP=${data.audioTP} FP=${data.audioFP} FN=${data.audioFN})`);
        lines.push('');
        lines.push('| # | 位置 | 匹配 | 按 | o | 声音 | 匹配 | 按 | o |');
        lines.push('|---|------|------|----|---|------|------|----|---|');

        if (data.trialDetails) {
            for (const t of data.trialDetails) {
                const po = t.posOk === true ? '✓' : t.posOk === false ? '✗' : '-';
                const ao = t.audioOk === true ? '✓' : t.audioOk === false ? '✗' : '-';
                lines.push(`| ${t.trial} | ${t.pos} | ${t.posMatch ? '✓' : ''} | ${t.posPressed ? '按' : ''} | ${po} | ${t.audio} | ${t.audioMatch ? '✓' : ''} | ${t.audioPressed ? '按' : ''} | ${ao} |`);
            }
        }

        const md = lines.join('\n');
        navigator.clipboard.writeText(md).then(() => {
            const btn = document.getElementById('btn-copy-md');
            if (btn) {
                const orig = btn.textContent;
                btn.textContent = '✓ 已复制';
                btn.classList.add('copied');
                setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 2000);
            }
        }).catch(() => {
            alert('复制失败，请手动选择表格后 Ctrl+C');
        });
    },

    _cleanupSummary(summary) {
        if (this._summaryTimer) {
            clearInterval(this._summaryTimer);
            this._summaryTimer = null;
        }
        if (this._summaryCallback) {
            document.removeEventListener('keydown', this._summaryCallback);
            this._summaryCallback = null;
        }
        if (summary) summary.classList.remove('visible');
    },

    hideSummary() {
        const summary = document.getElementById('summary-panel');
        this._cleanupSummary(summary);
    },

    _statsDates: [],
    _statsCurrentIndex: 0,

    showStats() {
        const sessions = Stats.getAllSessions();
        if (sessions.length === 0) {
            alert('暂无训练记录');
            return;
        }

        // 按日期分组（最新在前）
        const dateMap = {};
        for (const s of sessions) {
            const d = (s.date || '').match(/^\d{4}-(\d{2})-(\d{2})/);
            const key = d ? `${parseInt(d[1])}-${parseInt(d[2])}` : '-';
            if (!dateMap[key]) dateMap[key] = [];
            dateMap[key].push(s);
        }
        this._statsDates = Object.keys(dateMap).sort((a, b) => {
            // 按日期降序
            const [m1, d1] = a.split('-').map(Number);
            const [m2, d2] = b.split('-').map(Number);
            return (m2 * 100 + d2) - (m1 * 100 + d1);
        });
        this._statsCurrentIndex = 0;

        const panel = document.getElementById('stats-panel');
        if (!panel) return;

        panel.innerHTML = '';
        panel.classList.add('visible');

        this._renderStatsPage(panel);

        // 点击外部关闭
        const closeStats = (e) => {
            if (!panel.contains(e.target) && e.target.id !== 'stats-toggle') {
                panel.classList.remove('visible');
                document.removeEventListener('click', closeStats);
            }
        };
        document.addEventListener('click', closeStats);
    },

    _modeLabel(s) {
        const pn = s.nBackPos ?? s.nLevel;
        const an = s.nBackAudio ?? s.nLevel;
        if (s.independentNBack && pn !== an) return `位${pn}声${an}`;
        return `双${pn}`;
    },

    _renderStatsPage(panel) {
        const dateKey = this._statsDates[this._statsCurrentIndex];
        if (!dateKey) return;
        const sessions = Stats.getAllSessions().filter(s => {
            const d = (s.date || '').match(/^\d{4}-(\d{2})-(\d{2})/);
            return d ? `${parseInt(d[1])}-${parseInt(d[2])}` === dateKey : false;
        }).reverse(); // 最新的排前面

        const total = this._statsDates.length;
        const idx = this._statsCurrentIndex;
        const dateLabel = `${dateKey} (${sessions.length}次)`;

        let html = '<div class="stats-header">';
        html += '<h3>训练记录</h3>';
        html += '<div class="stats-nav">';
        html += `<button class="btn-sm" id="stats-prev" ${idx >= total - 1 ? 'disabled' : ''}>◀</button>`;
        html += `<span class="stats-date-label">${dateLabel}</span>`;
        html += `<button class="btn-sm" id="stats-next" ${idx <= 0 ? 'disabled' : ''}>▶</button>`;
        html += '</div></div>';

        html += '<table class="stats-table">';
        html += '<tr><th>#</th><th>模式</th><th>位N</th><th>声N</th><th>得分</th><th>位置</th><th>声音</th></tr>';

        for (const s of sessions) {
            html += `<tr>
                <td>${s.sessionOfDay || '-'}</td>
                <td>${this._modeLabel(s)}</td>
                <td>${s.nBackPos ?? s.nLevel}</td>
                <td>${s.nBackAudio ?? s.nLevel}</td>
                <td>${s.percent}%</td>
                <td>${s.positionScore}%</td>
                <td>${s.audioScore}%</td>
            </tr>`;
        }
        html += '</table>';

        panel.innerHTML = `<div class="stats-panel-inner">${html}</div>`;
        panel.onclick = (e) => {
            if (e.target === panel) panel.classList.remove('visible');
        };

        // 翻页按钮
        const self = this;
        const prevBtn = document.getElementById('stats-prev');
        const nextBtn = document.getElementById('stats-next');
        if (prevBtn) prevBtn.onclick = () => { self._statsCurrentIndex++; self._renderStatsPage(panel); };
        if (nextBtn) nextBtn.onclick = () => { self._statsCurrentIndex--; self._renderStatsPage(panel); };
    },
};
