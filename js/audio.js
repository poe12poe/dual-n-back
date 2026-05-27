/**
 * 音频模块 - Web Audio API 封装
 * 预加载声音文件，支持即时播放
 */

const AudioEngine = {
    _ctx: null,
    _buffers: {},   // { letter: AudioBuffer }
    _loaded: false,

    async init(soundSet = 'letters') {
        if (this._ctx) {
            await this._ctx.close();
        }
        this._ctx = new (window.AudioContext || window.webkitAudioContext)();
        this._buffers = {};
        this._loaded = false;
        this._soundSet = soundSet;
    },

    /**
     * 预加载声音集
     */
    async loadSoundSet(soundSet = 'letters') {
        if (!this._ctx) await this.init(soundSet);

        const letters = ['c', 'h', 'k', 'l', 'q', 'r', 's', 't'];
        for (const letter of letters) {
            const b64 = SOUND_DATA[letter];
            if (!b64) {
                console.warn(`AudioEngine: no embedded data for "${letter}"`);
                continue;
            }
            try {
                const binary = atob(b64);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                this._buffers[letter] = await this._ctx.decodeAudioData(bytes.buffer.slice(0));
                console.log(`AudioEngine: loaded "${letter}"`);
            } catch (e) {
                console.warn(`Failed to decode "${letter}"`, e);
            }
        }

        const loaded = Object.keys(this._buffers).length;
        console.log(`AudioEngine: loaded ${loaded}/${letters.length} sounds`);
        this._loaded = loaded > 0;
    },

    /**
     * 确保 AudioContext 处于运行状态（处理浏览器自动播放限制）
     */
    async _ensureRunning() {
        if (!this._ctx) return false;
        if (this._ctx.state === 'suspended') {
            await this._ctx.resume();
        }
        return this._ctx.state === 'running';
    },

    /**
     * 播放指定字母的声音
     */
    async play(letter) {
        if (!this._ctx || !this._buffers[letter]) {
            if (!this._buffers[letter]) {
                console.warn(`AudioEngine: no buffer for "${letter}"`);
            }
            return;
        }

        const running = await this._ensureRunning();
        if (!running) {
            console.warn('AudioEngine: AudioContext not running');
            return;
        }

        const source = this._ctx.createBufferSource();
        source.buffer = this._buffers[letter];

        const gainNode = this._ctx.createGain();
        gainNode.gain.value = 0.8;

        source.connect(gainNode);
        gainNode.connect(this._ctx.destination);
        source.start(0);
    },

    /**
     * 播放反馈音效
     */
    async playFeedback(type) {
        if (!this._ctx) return;
        const running = await this._ensureRunning();
        if (!running) return;

        const osc = this._ctx.createOscillator();
        const gain = this._ctx.createGain();
        osc.connect(gain);
        gain.connect(this._ctx.destination);

        if (type === 'correct') {
            osc.frequency.value = 880;
            gain.gain.value = 0.15;
        } else if (type === 'wrong') {
            osc.frequency.value = 220;
            gain.gain.value = 0.15;
        } else if (type === 'advance') {
            osc.frequency.value = 660;
            gain.gain.value = 0.2;
        }

        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.001, this._ctx.currentTime + 0.2);
        osc.stop(this._ctx.currentTime + 0.2);
    },

    async resume() {
        return this._ensureRunning();
    }
};
