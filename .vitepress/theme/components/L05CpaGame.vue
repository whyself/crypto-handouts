<script setup lang="ts">
import { ref, computed } from 'vue'
import { toyF, randBits, randBit, hex, bin, parseByte } from '../lib/l05'

// CPA 不可区分实验 PrivK^cpa：读者扮演敌手，可随时调用加密预言机 Enc_k(·)
const N = 8
const scheme = ref<'det' | 'rand'>('det')
const phase = ref<'pre' | 'chal' | 'done'>('pre')
let k = randBits(30)
let b = randBit()

interface Q { m: number; r?: number; s: number; after: boolean }
const log = ref<Q[]>([])
const qIn = ref('00')
const m0In = ref('00')
const m1In = ref('ff')
const err = ref('')
const chal = ref<{ m0: number; m1: number; r?: number; s: number } | null>(null)
const guess = ref<number | null>(null)
const score = ref({ n: 0, w: 0 })

function encrypt(m: number) {
  if (scheme.value === 'det') return { s: toyF(k, 0, N) ^ m }
  const r = randBits(N)
  return { r, s: toyF(k, r, N) ^ m }
}
const show = (c: { r?: number; s: number }) => (c.r === undefined ? hex(c.s, N) : `⟨${hex(c.r, N)}, ${hex(c.s, N)}⟩`)

function query() {
  const m = parseByte(qIn.value)
  if (m === null) { err.value = '请输入 1 字节十六进制，如 3a'; return }
  err.value = ''
  log.value.push({ m, ...encrypt(m), after: phase.value !== 'pre' })
}
function submit() {
  const m0 = parseByte(m0In.value), m1 = parseByte(m1In.value)
  if (m0 === null || m1 === null) { err.value = 'm0、m1 都必须是 1 字节十六进制（等长）'; return }
  err.value = ''
  chal.value = { m0, m1, ...encrypt(b === 0 ? m0 : m1) }
  phase.value = 'chal'
}
function doGuess(g: number) {
  guess.value = g
  phase.value = 'done'
  score.value.n++
  if (g === b) score.value.w++
}
function reset() {
  k = randBits(30); b = randBit()
  log.value = []; chal.value = null; guess.value = null; phase.value = 'pre'; err.value = ''
}
function pick(v: 'det' | 'rand') { scheme.value = v; score.value = { n: 0, w: 0 }; reset() }

// 与挑战密文“撞车”的预言机记录：确定性方案看整条密文，随机化方案看 r
function hit(q: Q) {
  const c = chal.value
  if (!c) return false
  return scheme.value === 'det' ? q.s === c.s : q.r === c.r
}
const STEPS = ['① k ← Gen(1ⁿ)', '② A 查询预言机，输出 m₀, m₁', '③ b ← {0,1}，c ← Enc_k(m_b)', '④ A 继续查询，输出 b′', '⑤ b′ = b 则输出 1']
const stepOn = computed(() => (phase.value === 'pre' ? 1 : phase.value === 'chal' ? 3 : 4))
</script>

<template>
  <Widget title="CPA 不可区分实验：你来当敌手">
    <p class="widget-note">消息长度 n = 8 位（1 字节，十六进制输入）。整个实验中你都可以调用加密预言机 Enc<sub>k</sub>(·)。选一个方案，想办法让 b′ = b 的概率明显高于 1/2。</p>
    <div class="ctrl">
      <div class="seg">
        <button :class="{ on: scheme === 'det' }" @click="pick('det')">确定性：c = G(k) ⊕ m</button>
        <button :class="{ on: scheme === 'rand' }" @click="pick('rand')">构造 3.30：⟨r, F<sub>k</sub>(r) ⊕ m⟩</button>
      </div>
      <button class="btn" @click="reset">↺ 新一轮（换密钥）</button>
    </div>
    <div class="flow">
      <span v-for="(s, i) in STEPS" :key="i" :class="{ on: i === stepOn, done: i < stepOn }">{{ s }}</span>
    </div>
    <div class="grid2">
      <div>
        <div class="sub">加密预言机 Enc<sub>k</sub>(·)</div>
        <div class="ctrl" style="margin:6px 0">
          <label>m = <input v-model="qIn" type="text" size="3" @keyup.enter="query"></label>
          <button class="btn" :disabled="phase === 'done'" @click="query">查询</button>
        </div>
        <div class="logbox">
          <table class="mini-table">
            <tr><th>#</th><th>m</th><th>Enc<sub>k</sub>(m)</th></tr>
            <tr v-for="(q, i) in log" :key="i" :class="{ best: hit(q) }">
              <td>{{ i + 1 }}{{ q.after ? '′' : '' }}</td><td><code>{{ hex(q.m, N) }}</code></td><td><code>{{ show(q) }}</code></td>
            </tr>
            <tr v-if="!log.length"><td colspan="3" class="muted">还没有查询</td></tr>
          </table>
        </div>
      </div>
      <div>
        <div class="sub">挑战</div>
        <div class="ctrl" style="margin:6px 0">
          <label>m₀ = <input v-model="m0In" type="text" size="3" :disabled="phase !== 'pre'"></label>
          <label>m₁ = <input v-model="m1In" type="text" size="3" :disabled="phase !== 'pre'"></label>
          <button class="btn primary" :disabled="phase !== 'pre'" @click="submit">提交</button>
        </div>
        <div v-if="chal" class="out">
          <span class="lbl">挑战密文 c = Enc<sub>k</sub>(m_b)</span>{{ show(chal) }}
          <span v-if="chal.r !== undefined" class="lbl">r* = {{ bin(chal.r, N) }}</span>
        </div>
        <div v-if="phase === 'chal'" class="ctrl">
          <span style="font-size:13.5px">你的猜测：</span>
          <button class="btn" @click="doGuess(0)">b′ = 0</button>
          <button class="btn" @click="doGuess(1)">b′ = 1</button>
        </div>
        <div v-if="phase === 'done'" class="out prose">
          真实 b = <b>{{ b }}</b>，你猜 {{ guess }} →
          <b :class="guess === b ? 'ok-c' : 'bad-c'">{{ guess === b ? '获胜（实验输出 1）' : '失败（实验输出 0）' }}</b>
        </div>
      </div>
    </div>
    <p v-if="err" class="widget-note bad-c">{{ err }}</p>
    <div class="stats">
      <div class="stat"><b>{{ score.w }} / {{ score.n }}</b><span>你的战绩</span></div>
      <div class="stat"><b>{{ score.n ? (score.w / score.n * 100).toFixed(0) + '%' : '—' }}</b><span>获胜率</span></div>
    </div>
    <p class="widget-note" style="margin:0">
      <template v-if="scheme === 'det'">提示：提交挑战后，把 m₀ 再交给预言机——若结果与 c 相同（绿色行），则 b = 0。确定性方案对 CPA 敌手毫无招架之力。</template>
      <template v-else>提示：每次加密都换新的 r，预言机的回答与挑战密文无关……除非某次查询恰好用到了 r*（绿色行）。n = 8 时 r 只有 256 种，多查几次就可能撞上——这正是证明里 q(n)/2ⁿ 那一项；n 足够大时它可忽略。</template>
    </p>
  </Widget>
</template>

<style scoped>
.flow { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0 12px; }
.flow span { font-size: 12.5px; padding: 3px 9px; border-radius: 99px; border: 1px solid var(--line); color: var(--ink-3); background: var(--vp-c-bg); }
.flow span.done { color: var(--ink-2); }
.flow span.on { background: var(--accent); border-color: var(--accent); color: #fff; }
.grid2 { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; }
.sub { font-size: 13px; font-weight: 700; color: var(--ink-2); }
.logbox { max-height: 220px; overflow: auto; border: 1px solid var(--line); border-radius: 8px; }
.btn:disabled { opacity: .45; cursor: not-allowed; }
@media (max-width: 640px) { .grid2 { grid-template-columns: 1fr; } }
</style>
