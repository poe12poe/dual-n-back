# 双N脑力训练 WebUI — 开发文档

> 基于 [brainworkshop/brainworkshop](https://github.com/brain-workshop/brainworkshop) (v5.0.3) 改造  
> Phase 1 完成：Dual N-Back 可玩版本  
> 开发日期：2026-05-26

---

## 一、项目概述

将原版 Python + Pyglet 桌面版脑力训练程序，重写为 WebUI 版本。
当前实现 Dual N-Back（位置+声音双任务）模式，所有核心游戏逻辑跑在浏览器端。

**技术栈**：HTML5 Canvas + Web Audio API + Python Flask/Waitress

---

## 二、目录结构

```
dual-n-back-webui/
├── app.py                          # Flask 入口（Waitress 生产服务器）
├── requirements.txt                # flask, waitress
├── data/
│   └── stats.json                  # 后端持久化统计数据（自动生成）
├── static/
│   ├── index.html                  # 主页面
│   ├── css/
│   │   └── style.css               # 样式（支持 .dark 黑白双主题）
│   ├── js/
│   │   ├── config.js               # 配置管理（localStorage 读写）
│   │   ├── stimuli.js              # 刺激序列生成器
│   │   ├── scorer.js               # 评分引擎（BW + Jaeggi）
│   │   ├── audio.js                # Web Audio API 封装
│   │   ├── stats.js                # 统计记录（localStorage + 后端同步）
│   │   ├── renderer.js             # Canvas 渲染（九宫格/方块/标签）
│   │   ├── game-core.js            # 游戏状态机 + Tick 循环
│   │   ├── ui.js                   # UI 交互（设置面板/摘要/统计）
│   │   └── main.js                 # 入口（初始化/事件绑定/渲染循环）
│   └── res/
│       └── sounds/
│           └── letters/            # 8 个字母 WAV（c,h,k,l,q,r,s,t）
└── DEVELOPMENT.md                  # 本文档
```

---

## 三、核心架构

### 3.1 游戏状态机

```
IDLE → COUNTDOWN(3秒) → RUNNING → SUMMARY(5秒倒计时) → RUNNING 或 IDLE
```

无 FEEDBACK_PAUSE 状态——反馈在按键瞬间显示，trial 之间 3 秒无缝衔接。

### 3.2 Tick 循环

- 使用 `requestAnimationFrame` + 时间累加器模拟 100ms/tick
- 每 trial = 30 ticks = 3 秒
- tick 0：显示刺激方块 + 播放声音 + 清除旧反馈
- tick 1~29：接收用户输入
- tick 30：记录答案 → 立即进入下一 trial

### 3.3 刺激生成

`stimuli.js` — 完全迁移原版逻辑：
- 随机生成位置（0-8 九宫格）和声音（c/h/k/l/q/r/s/t）
- 12.5% 概率强制生成 N-Back 匹配
- 12.5% 概率生成干扰（n-1/n+1/2n 步前匹配）
- Jaeggi 模式：固定 4+4+2 个匹配
- Trial 总数 = 20 + nBack²

### 3.4 评分

`scorer.js`：
- **BW 标准**：`TP/(TP+FP+FN)`，各维度平均
- **Jaeggi**：`(TP+TN)/total`，取最低维度
- N-Back 调整：≥80% 晋级，<50% 连续 3 次降级

### 3.5 反馈系统

不同于原版的 trial 结束后统一反馈，WebUI 版采用**即时反馈**：
- 用户按 A/左键 → `_handlePositionInput()` 立即检查位置是否为匹配 → 底部「位置」标签变绿/红
- 用户按 L/右键 → `_handleAudioInput()` 同上 → 底部「声音」标签变绿/红
- 每次按键播放不同频率的提示音（880Hz 正确，220Hz 错误）
- 新 trial 开始时清除

### 3.6 输入方式

| 操作 | 键盘 | 鼠标 |
|------|------|------|
| 开始训练 | 空格 | 点画布 |
| 位置匹配 | A | 左键 |
| 声音匹配 | L | 右键 |
| 退出 | Esc | — |
| 摘要界面继续 | 空格 | 点画布 |

鼠标事件绑定在 `document` 上用 `pointerdown`（因为预览面板中 canvas 事件可能被拦截）。

### 3.7 数据存储

- **配置**：`localStorage` key `dual_n_back_config`（JSON）
- **前端统计**：`localStorage` key `dual_n_back_sessions`（JSON 数组）
- **后端统计**：`POST /api/stats` → `data/stats.json`
- 会话结束时前端和后端同时写入

---

## 四、运行方式

```bash
cd dual-n-back-webui
pip install -r requirements.txt
python app.py
# 访问 http://localhost:5000
```

Waitress 监听 `0.0.0.0:5000`，非 debug 模式稳定运行。

---

## 五、调试中修复的关键 Bug

| Bug | 原因 | 修复 |
|-----|------|------|
| Flask 反复自杀 | debug mode 的 watchdog(windowsapi) 不稳定 | 换 Waitress 生产服务器 |
| 页面闪空白 | 服务器中途死亡，资源加载失败 | 同上 + 加全局 error 捕获 |
| 声音两遍回声 | `_nextTrial()` 调 `_showStimulus()` 后 `_runTick()` tick=0 又调一次 | 去掉 `_nextTrial` 中的重复调用 |
| 第一个 trial 被跳过 | `_startTrial()` 设 tick=30 而非 0 | 改为 tick=0 |
| 统计全为 0 | 评分引擎用 `actualMatches.length` 循环，但传入的是 Object 不是 Array | 改为 `[]` |
| 声音从未播放 | `GameCore.init()` 只调 `AudioEngine.init()` 没调 `loadSoundSet()` | 补上 `loadSoundSet()` |
| 反馈不显示 | idle 渲染循环只在 IDLE/SUMMARY 状态跑，RUNNING 时反馈动画没渲染 | 扩展渲染循环覆盖 RUNNING 状态 |
| 标签文字重叠 | `labelH = fontSize * 1.6` 太小，两行文本挤一起 | 改为 2.6 倍 + 调整文本位置 |
| 鼠标不响应 | canvas 的 `mousedown` 在预览面板不触发 | 改为 document 级 `pointerdown` + 判断 Canvas 区域 |
| 倒计时数字偏移 | 默认 alphabetic 基线 + 偏移量不准 | `textBaseline='middle'` + 画在正中 |
| 标签不对称 | leftX 比 rightX 偏左很多 | 统一为 centerX ± 0.18 |
| **声音误判（致命）** | `nBackAudio=3` 默认值泄漏到非独立模式，声音按 3-back 判对错 | `init()` 中独立模式才读取独立 N 配置 |
| **跨会话状态残留** | 独立 N 用完 `nBackPos=3`，下一轮非独立 `start()` 没重置 | `start()` 每次重新从 Config 读 N，用 `_sessionN` 锁定 |
| **评分除零** | 无位置匹配时 TP=FP=FN=0，`0/0=0%` | 改为 100%（完美抑制控制） |
| **漏按无反馈** | trial 结束有匹配但未按键 → 静默 | `_checkAnswers()` 检测漏按，自动标红 + 低音 |
| **鼠标双键不灵敏** | `pointerdown` + `e.buttons` 在部分浏览器不可靠 | 绑 canvas 单 handler，去掉 `preventDefault()` |
| **统计面板旧数据无日期** | `startSession()` 没存 `date` 字段 | 初始化时写入 ISO 日期 + `sessionOfDay` |
| **canvas is not defined** | 精简鼠标事件时删掉了 `const canvas = ...` | 补回声明 |
| **摘要闪烁 `cdText is not defined`** | 插入 trialRows 代码时覆盖了倒计时变量 | 补回 `this._summaryCountdown = 20` |
| **独立 N 开关不显示输入框** | `_populateSettings` 用了未定义的 `self` | 改为 `this` |
| **刺激方块圆形残留** | `_drawAnimSquare` 用了 `ctx.arc()` | 改为 `_roundRect()` 画正方形 |
| **IDM 拦截 WAV 下载** | IDM 检测到音频请求后弹下载框 | Flask `after_request` 设 `Content-Disposition: inline` |

### exe 原生窗口构建 — 未解决

目标：单文件 exe，原生窗口（非浏览器）。

| 尝试 | 方案 | 结果 |
|------|------|------|
| 1 | C# verbatim 字符串嵌入 HTML → Process.Start 浏览器 | ✅ 能跑，但出浏览器标签页 |
| 2 | WebView2 + `NavigateToString` | ❌ 空白（570KB 字符串超 API 限制） |
| 3 | WebView2 + base64 → NavigateToString | ❌ 空白（同上） |
| 4 | WebView2 + 写临时文件 → `Navigate(file://)` | ❌ 文件协议被安全策略拦截 |
| 5 | WebView2 + 写临时文件 + `--allow-file-access-from-files` | ❌ exe 崩溃（csc.exe 扛不住 570KB 源码） |
| 6 | csc `/resource` 二进制嵌入 → WebView2 加载 | ❌ exe 崩溃（同上） |
| 7 | dotnet SDK `dotnet publish --self-contained` | 🔲 需 .NET 8 SDK，当前未安装 |

**根因**：csc.exe（C# 5 / .NET Framework 4.8）无法处理 570KB 的字符串或资源嵌入。
**解决方案**：安装 .NET 8 SDK，用 `dotnet publish -r win-x64 --self-contained -p:PublishSingleFile=true` 编译。产物 ~60MB（含自包含运行时），但真正独立、无依赖。

1. **不用前端框架**：游戏逻辑简单，纯 JS 避免额外依赖和构建步骤
2. **Canvas 而非 DOM**：刺激方块动画、反馈需要高频重绘，DOM 操作开销大
3. **WAV 不转 ogg**：本地服务器带宽足够，8 个文件仅 360KB
4. **即时反馈而非 trial 结束统一反馈**：原版 pyglet 在 tick 内实时渲染反馈，Web 版沿用此逻辑——按键瞬间就判断对错
5. **去掉 FEEDBACK_PAUSE 状态**：原版有短暂反馈暂停，Web 版改为连续 3 秒 trial 无间隔，节奏更快
6. **倒计时 3 秒**：原版约 4 秒，Web 版缩短到 3 秒
7. **Mouse → Pointer 事件**：`pointerdown` 比 `mousedown` 在现代浏览器和预览面板中兼容性更好

---

## 七、术语约定

| 术语 | 含义 | 代码对应 |
|------|------|----------|
| **刺激方块** | 九宫格中移动的蓝色方块（视觉刺激） | `currentPosition`, `_drawSquare()` |
| **声音刺激** | 播放的字母发音（听觉刺激） | `currentAudio`, `AudioEngine.play()` |
| **维度** | 一个刺激通道（位置/声音/颜色/图像） | `dim`, `_dimFeedback` |
| **trial** | 一轮刺激（播放+等待响应，3秒） | `tick`, `ticksPerTrial` |
| **session** | 一次完整的 N-Back 训练会话 | `session`, `totalTrials` |

---

## 八、原版游戏模式 & 实现思路

### 8.1 模式列表（按复杂度）

| 模式ID | 名称 | 维度 | 按键 | 难度 |
|--------|------|------|------|------|
| 10 | Position N-Back | 位置 | A | ★ |
| 11 | Sound N-Back | 声音 | L | ★ |
| 2 | **Dual N-Back**（已实现） | 位置+声音 | A+L | ★★ |
| 20 | Position+Color | 位置+颜色 | A+F | ★★ |
| 21 | Position+Image | 位置+图像 | A+J | ★★ |
| 22 | Color+Sound | 颜色+声音 | F+L | ★★ |
| 3 | Triple N-Back | 位置+颜色+声音 | A+F+L | ★★★ |
| 28 | Quad N-Back | 位置+颜色+图像+声音 | A+F+J+L | ★★★★ |
| 107 | Pentuple | +第二声音 | A+F+J+L+; | ★★★★★ |
| 4 | Dual Combination | 视觉n视觉+视觉n听觉+听觉n视觉+听觉 | S+D+J+L | ★★★ |
| 7 | Arithmetic | 算术 | 0-9 | ★★★ |

扩展机制（位掩码叠加）：
- `| 128` → Crab 模式（反向匹配，N 按 5→3→1 循环）
- `| 256/512/768` → Multi-stim（2-4 个同时刺激方块）
- `| 1024` → Self-paced（自定义节奏）

### 8.2 实现思路

**Position-Only / Sound-Only（最低成本）**
- 代码改动：渲染层跳过另一个维度，评分只取单维度
- 按键：只监听一个键
- 工作量：小

**Triple / Quad（加颜色/图像）**
- 颜色：8 种颜色方块已有素材（`res/misc/colored-squares/`）
- 图像：已有 sprites 素材（面孔/NPS/多边形），Canvas 绘制 sprite
- 刺激生成：stimuli.js 加 `color` 和 `image` 字段
- 维度标签：底部加第三/第四个标签
- 工作量：中

**独立 N-Back（位置 2-Back + 声音 3-Back）**
- `nBackPos` / `nBackAudio` 分开存储
- 刺激生成：位置回溯 `nBackPos` 步，声音回溯 `nBackAudio` 步
- 评分：各维度独立评分，独立晋级/降级
- UI：左上角显示两个 N 值、摘要分开展示
- 工作量：小

**Crab 模式**
- 匹配逻辑反转：每 N 个 trial，N 值按预设序列循环（如 5→3→1）
- 刺激生成：`_crabSequence` 数组驱动
- 工作量：小

**Arithmetic**
- 播放"加/减/乘/除"音频 + 数字音频
- 用户按键 0-9 回答结果
- 已有素材（`res/sounds/operations/`）
- 工作量：中

---

## 九、声音集图像集扩展思路

| 资源 | 位置 | 数量 | 实现 |
|------|------|------|------|
| 中文数字 | 需录制 | 8 | 录音或用 TTS 合成 |
| 数字声音 | `res/sounds/numbers/` | 14 | 直接使用 |
| Morse | `res/sounds/morse/` | 36 | 直接使用 |
| NATO 音标 | `res/sounds/nato/` | 26 | 直接使用 |
| 钢琴音符 | `res/sounds/piano/` | 8 | 直接使用 |
| 卡通面孔 | `res/sprites/cartoon-faces/` | 26 | Canvas drawImage |
| NPS 图标 | `res/sprites/national-park-service/` | 53 | Canvas drawImage |
| 几何图形 | `res/sprites/polygons-basic/` | 8 | Canvas drawImage |

---

## 十、待实现

---

## 九、参考资源

- 原版仓库：https://github.com/brain-workshop/brainworkshop
- 原始研究：Jaeggi et al. 2008, PNAS — Dual N-Back 改善工作记忆和流体智力
- 资源文件来源：`brainworkshop/dist/res/`（sounds/letters/、sprites/、music/）
