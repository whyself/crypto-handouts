<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { randBits, xor, bitsToStr, strToBits, PRGS, rangeOf, SEED_LEN, OUT_LEN, type Bits } from '../lib/l03'

// PrivK^eav 不可区分实验：读者扮演敌手 A，挑战者按所选方案加密 m_b
const SCHEMES = [
  { id: 'otp', name: '一次性密码本 OTP', desc: '密钥 k ← {0,1}¹⁶ 均匀随机，c = k ⊕ m_b。完美保密：任何策略的胜率都恰为 1/2。', enc: (m: Bits) => xor(randBits(OUT_LEN), m) },
  { id: 'mix', name: '构造 3.1 + G_mix', desc: '种子 s ← {0,1}⁸，c = G_mix(s) ⊕ m_b。肉眼看是乱码，但 8 位种子可以穷举。', enc: (m: Bits) => xor(PRGS[0].G(randBits(SEED_LEN)), m) },
  { id: 'dup', name: '构造 3.1 + G(s)=s‖s', desc: '种子 s ← {0,1}⁸，c = (s‖s) ⊕ m_b。“伪随机串”前后两半相同，泄露了 m_b 两半的异或。', enc: (m: Bits) => xor(PRGS[1].G(randBits(SEED_LEN)), m) }
]
const si = ref(0)
const scheme = computed(() => SCHEMES[si.value])

// ---- 手动对局 ----
const m0s = ref('0000000000000000')
const m1s = ref('0000000011111111')
const phase = ref<'choose' | 'guess' | 'done'>('choose')
const c = ref<Bits>([])
const b = ref(0)
const lastWin = ref(false)
const st = reactive({ n: 0, w: 0 })
const valid = computed(() => m0s.value.replace(/[^01]/g, '').length === OUT_LEN && m1s.value.replace(/[^01]/g, '').length === OUT_LEN)

function challenge() {
  b.value = Math.random() < 0.5 ? 0 : 1
  c.value = scheme.value.enc(strToBits(b.value ? m1s.value : m0s.value, OUT_LEN))
  phase.value = 'guess'
}
function guess(g: number) {
  lastWin.value = g === b.value
  st.n++; if (lastWin.value) st.w++
  phase.value = 'done'
}
function setScheme(i: number) { si.value = i; st.n = 0; st.w = 0; phase.value = 'choose' }
function presetMsgs(a: string, bb: string) { m0s.value = a; m1s.value = bb; phase.value = 'choose' }
const half = (x: Bits) => [bitsToStr(x.slice(0, 8)), bitsToStr(x.slice(8))]

// ---- 自动策略 ----
const Z = Array(OUT_LEN).fill(0) as Bits
const ONE = Array(OUT_LEN).fill(1) as Bits
const ZO = [...Array(8).fill(0), ...Array(8).fill(1)] as Bits
const STRATS = [
  { name: '随机猜', m0: Z, m1: ONE, A: (_c: Bits) => (Math.random() < 0.5 ? 0 : 1) },
  { name: '比较两半', m0: Z, m1: ZO, A: (cc: Bits) => (bitsToStr(cc.slice(0, 8)) === bitsToStr(cc.slice(8)) ? 0 : 1) },
  { name: '穷举 G_mix 种子', m0: Z, m1: ONE, A: (cc: Bits) => (rangeOf(PRGS[0]).has(bitsToStr(xor(cc, Z))) ? 0 : 1) }
]
const TRIALS = 4000
const matrix = ref<number[][] | null>(null)
function runAll() {
  matrix.value = STRATS.map(s => SCHEMES.map(sc => {
    let w = 0
    for (let t = 0; t < TRIALS; t++) {
      const bb = Math.random() < 0.5 ? 0 : 1
      const cc = sc.enc(bb ? s.m1 : s.m0)
      if (s.A(cc) === bb) w++
    }
    return w / TRIALS
  }))
}
</script>

<template>
  <Widget title="你来当敌手：PrivK<sup>eav</sup> 不可区分实验">
    <div class="ctrl">
      <span style="font-size:13.5px;color:var(--ink-2)">挑战者使用的方案：</span>
      <div class="seg"><button v-for="(s, i) in SCHEMES" :key="s.id" :class="{ on: si === i }" @click="setScheme(i)">{{ s.name }}</button></div>
    </div>
    <p class="widget-note">{{ scheme.desc }}</p>
    <div class="steps">
      <div class="step" :class="{ cur: phase === 'choose' }">
        <b>① 敌手选两条等长消息（16 位）</b>
        <div class="ctrl">
          <label>m₀ <input v-model="m0s" type="text" maxlength="16" style="width:170px;font-family:var(--vp-font-family-mono)" :disabled="phase === 'guess'"></label>
          <label>m₁ <input v-model="m1s" type="text" maxlength="16" style="width:170px;font-family:var(--vp-font-family-mono)" :disabled="phase === 'guess'"></label>
        </div>
        <div class="ctrl">
          <button class="btn" @click="presetMsgs('0000000000000000', '1111111111111111')">全 0 / 全 1</button>
          <button class="btn" @click="presetMsgs('0000000000000000', '0000000011111111')">全 0 / 前半 0 后半 1</button>
          <button class="btn primary" :disabled="!valid || phase === 'guess'" @click="challenge">发给挑战者 →</button>
        </div>
      </div>
      <div class="step" :class="{ cur: phase === 'guess' }">
        <b>② 挑战者：k ← Gen(1ⁿ)，b ← {0,1}，c ← Enc<sub>k</sub>(m<sub>b</sub>)</b>
        <div class="out"><span class="lbl">挑战密文 c（按两半显示）</span>{{ c.length ? half(c).join(' │ ') : '（等待消息）' }}</div>
      </div>
      <div class="step" :class="{ cur: phase === 'guess' || phase === 'done' }">
        <b>③ 敌手输出 b′</b>
        <div class="ctrl">
          <button class="btn" :disabled="phase !== 'guess'" @click="guess(0)">b′ = 0（是 m₀）</button>
          <button class="btn" :disabled="phase !== 'guess'" @click="guess(1)">b′ = 1（是 m₁）</button>
          <span v-if="phase === 'done'" :class="lastWin ? 'ok-c' : 'bad-c'" style="font-weight:700">实际 b = {{ b }}，{{ lastWin ? '你赢了（PrivK = 1）' : '你输了（PrivK = 0）' }}</span>
          <button v-if="phase === 'done'" class="btn" @click="challenge">再来一局（同样的消息）</button>
        </div>
      </div>
    </div>
    <div class="stats">
      <div class="stat"><b>{{ st.n }}</b><span>局数</span></div>
      <div class="stat"><b>{{ st.n ? (st.w / st.n * 100).toFixed(1) + '%' : '—' }}</b><span>胜率 Pr[PrivK = 1]</span></div>
      <div class="stat"><b>{{ st.n ? ((st.w / st.n - .5) >= 0 ? '+' : '') + (st.w / st.n - .5).toFixed(3) : '—' }}</b><span>优势 = 胜率 − 1/2</span></div>
    </div>
    <hr style="border:0;border-top:1px dashed var(--line);margin:14px 0">
    <div class="ctrl"><button class="btn primary" @click="runAll">让三种自动策略各玩 {{ TRIALS }} 局</button></div>
    <table v-if="matrix" class="mini-table">
      <thead><tr><th>策略（m₀, m₁）＼ 方案</th><th v-for="s in SCHEMES" :key="s.id">{{ s.name }}</th></tr></thead>
      <tbody>
        <tr v-for="(row, i) in matrix" :key="i">
          <td>{{ STRATS[i].name }}</td>
          <td v-for="(v, j) in row" :key="j" :class="v > .6 ? 'bad-c' : ''" :style="{ fontWeight: v > .6 ? 700 : 400 }">{{ (v * 100).toFixed(1) }}%</td>
        </tr>
      </tbody>
    </table>
    <p class="widget-note" style="margin-top:8px">“比较两半”是多项式时间的，所以 G(s)=s‖s 的方案不是 EAV 安全的。“穷举种子”要 2ⁿ 步，这里 n = 8 才跑得动；真实的 n = 128 时它不是 PPT 敌手，不在定义的考虑范围内。</p>
  </Widget>
</template>

<style scoped>
.steps { display: grid; gap: 8px; }
.step { border: 1px solid var(--line); border-radius: 9px; padding: 8px 12px; opacity: .65; transition: opacity .2s; }
.step.cur { opacity: 1; border-color: var(--accent); }
.step b { font-size: 14px; }
</style>
