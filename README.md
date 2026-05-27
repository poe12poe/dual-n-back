# 双N脑力训练 — Dual N-Back

> A browser-based Dual N-Back training game. No installation required — just open `index.html` and play.

**双N脑力训练**是一款基于浏览器的双重N-Back认知训练游戏，无需安装任何软件，双击 `index.html` 即可开始训练。

---

## ▶ 如何运行 / How to Run

**中文**

1. 点击右侧 **Code → Download ZIP** 下载压缩包
2. 解压到任意文件夹
3. 双击 `index.html`，用浏览器打开即可开始训练

> 推荐使用 Chrome 或 Edge 浏览器以获得最佳音效体验。

---

**English**

1. Click **Code → Download ZIP** on the right to download
2. Unzip to any folder
3. Double-click `index.html` to open in your browser and start training

> Chrome or Edge recommended for best audio support.

---

## 🎮 游戏说明 / How to Play

双N-Back 是一种提升工作记忆和流体智力的认知训练方法（Jaeggi et al., 2008）。

每轮游戏中，屏幕上会出现一个移动的方块，同时播放一个字母声音。当**当前的位置或声音**与 **N 步之前的位置或声音**相同时，需要按下对应按键。

| 操作 | 键盘 | 鼠标 |
|------|------|------|
| 开始训练 | 空格键 | 点击画面 |
| 位置匹配 | A | 左键 |
| 声音匹配 | L | 右键 |
| 退出当前局 | Esc | — |

游戏会根据表现自动调整难度：正确率 ≥ 80% 晋升 N 值，< 50% 连续 3 次降级。

---

## ⚙ 功能特性

- 纯浏览器运行，无需 Python、Node.js 等任何依赖
- 支持亮色/暗色主题切换
- 支持独立 N 模式（位置 N 和声音 N 可分别设定）
- 自动记录历史训练数据（本地 localStorage）
- 支持 BW 和 Jaeggi 两种评分标准
- 即时按键反馈（绿色=正确，红色=错误）

---

## 🏗 技术栈

- HTML5 Canvas（游戏画面渲染）
- Web Audio API（实时合成字母发音）
- 原生 JavaScript（无框架依赖）
- localStorage（本地数据持久化）

---

## 📖 参考资料

- 原版游戏：[Brain Workshop](https://github.com/brain-workshop/brainworkshop)
- 研究论文：Jaeggi et al. (2008) — *Improving fluid intelligence with training on working memory*, PNAS
