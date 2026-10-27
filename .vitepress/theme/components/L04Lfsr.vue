<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { lfsrStep, lfsrCycle } from '../lib/l04'

// LFSR 逐拍移位动画：可设阶数 n、反馈系数 c_i 与初始状态，观察输出序列与周期
// 记号与课件 P16 一致：s[i] 为第 i 个寄存器，输出 s[0]，反馈写入 s[n-1]
interface Bit { id: number; v: number; pos: number } // pos：显示槽位，0 为最左（s_{n-1}），n-1 为最右（s_0）

const n = ref(4)
const c = ref<number[]>([1, 0, 1, 0])          // c[i] 即 c_i；课件例子 (c3,c2,c1,c0)=(0,1,0,1)
const init = ref<number[]>([1, 1, 0, 0])       // init[i] 即 s_i^(0)；课件例子 (s3,s2,s1,s0)=(0,0,1,1)
const bits = ref<Bit[]>([])
const outs = ref<number[]>([])
const hist = ref<{ t: number; st: string; o: number }[]>([])
const fbShow = ref<number | null>(null)
const busy = ref(false)
const playing = ref(false)
let uid = 0
let stopFlag = false

const W = 58, X0 = 70, Y = 96
const slotX = (p: number) => X0 + p * W
// 当前状态（按 s_0..s_{n-1} 的下标顺序）
const cur = computed(() => {
  const s = new Array(n.value).fill(0)
  for (const b of bits.value) if (b.pos >= 0 && b.pos < n.value) s[n.value - 1 - b.pos] = b.v
  return s
})
const stateStr = (s: number[]) => '(' + s.slice().reverse().join(', ') + ')'
const cyc = computed(() => lfsrCycle(init.value, c.value))
const maxLen = computed(() => (1 << n.value) - 1)
const isZero = computed(() => init.value.every(x => !x))

function reset() {
  stopFlag = true
  playing.value = false
  bits.value = init.value.map((v, i) => ({ id: uid++, v, pos: n.value - 1 - i }))
  outs.value = []
  hist.value = [{ t: 0, st: stateStr(init.value), o: init.value[0] }]
  fbShow.value = null
  busy.value = false
}

function setN(k: number) {
  n.value = k
  c.value = findMax(k)
  init.value = Array.from({ length: k }, (_, i) => (i === 0 ? 1 : 0))
  reset()
}
// 找一组使周期达到 2^n - 1 的反馈系数（从小到大枚举，c_0 必须为 1）
function findMax(k: number, random = false) {
  const cands: number[][] = []
  for (let m = 0; m < (1 << (k - 1)); m++) {
    const cc = Array.from({ length: k }, (_, i) => (i === 0 ? 1 : (m >> (i - 1)) & 1))
    const s = Array.from({ length: k }, (_, i) => (i === 0 ? 1 : 0))
    if (lfsrCycle(s, cc).lambda === (1 << k) - 1) { if (!random) return cc; cands.push(cc) }
  }
  return cands[Math.floor(Math.random() * cands.length)]
}
function presetSlides() {
  n.value = 4; c.value = [1, 0, 1, 0]; init.value = [1, 1, 0, 0]; reset()
}
function presetMax() { c.value = findMax(n.value, true); reset() }
function toggleC(i: number) { if (busy.value) return; c.value[i] ^= 1; reset() }
function toggleS(i: number) { if (busy.value) return; init.value[i] ^= 1; reset() }

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
async function step(anim = true) {
  if (busy.value) return
  busy.value = true
  const s = cur.value
  const { out, next } = lfsrStep(s, c.value)
  const fb = next[n.value - 1]
  if (anim) { fbShow.value = fb; await sleep(420) }
  bits.value.push({ id: uid++, v: fb, pos: -1 })
  await nextTick()
  if (anim) await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
  bits.value.forEach(b => b.pos++)
  if (anim) await sleep(480)
  bits.value = bits.value.filter(b => b.pos < n.value)
  outs.value.push(out)
  hist.value.push({ t: hist.value.length, st: stateStr(next), o: next[0] })
  fbShow.value = null
  busy.value = false
}
async function play() {
  if (playing.value) { stopFlag = true; playing.value = false; return }
  playing.value = true; stopFlag = false
  for (let k = 0; k < 64 && !stopFlag; k++) { await step(true); await sleep(120) }
  playing.value = false
}
async function fast(k: number) { for (let i = 0; i < k; i++) await step(false) }

presetSlides()
</script>

<template>
  <Widget title="LFSR 逐拍移位：反馈、输出与周期">
    <p class="widget-note">点击寄存器下方的 c<sub>i</sub> 开关设置抽头（亮 = 1，参与异或），点击寄存器设置初始状态。每一拍：被抽头的寄存器异或得到反馈位 → 全体右移一格 → s<sub>0</sub> 被移出成为输出、反馈位进入 s<sub>n−1</sub>。</p>
    <div class="ctrl">
      <span class="muted" style="font-size:13px">阶数 n</span>
      <div class="seg">
        <button v-for="k in [3, 4, 5, 6, 7, 8]" :key="k" :class="{ on: n === k }" @click="setN(k)">{{ k }}</button>
      </div>
      <button class="btn" @click="presetSlides">课件例子（P17）</button>
      <button class="btn" @click="presetMax">随机最大长度抽头</button>
    </div>
    <svg :viewBox="`0 0 ${X0 + n * W + 90} 170`" style="width:100%;max-width:640px;height:auto;display:block;margin:auto">
      <!-- 反馈线 -->
      <path :d="`M${slotX(0) + 4} ${Y} H${X0 - 30} V30 H${slotX(n - 1) + W / 2}`" fill="none" style="stroke:var(--ink-3)" stroke-width="1.4" />
      <path :d="`M${slotX(0) - 2} ${Y} l-8 -5 v10 z`" style="fill:var(--ink-3)" />
      <g v-for="p in n" :key="'tap' + p">
        <template v-if="c[n - p]">
          <line :x1="slotX(p - 1) + W / 2" :y1="Y - 22" :x2="slotX(p - 1) + W / 2" y2="36" style="stroke:var(--accent)" stroke-width="1.6" />
          <circle :cx="slotX(p - 1) + W / 2" cy="30" r="7" style="fill:var(--paper);stroke:var(--accent)" stroke-width="1.4" />
          <text :x="slotX(p - 1) + W / 2" y="34.5" text-anchor="middle" font-size="13" style="fill:var(--accent)">⊕</text>
        </template>
      </g>
      <text v-if="fbShow !== null" :x="X0 - 30" y="22" text-anchor="middle" font-size="15" font-weight="700" style="fill:var(--warn)">{{ fbShow }}</text>
      <!-- 寄存器框 -->
      <g v-for="p in n" :key="'box' + p" style="cursor:pointer" @click="toggleS(n - p)">
        <rect :x="slotX(p - 1) + 3" :y="Y - 22" :width="W - 6" height="44" rx="7"
          :style="{ fill: 'var(--vp-c-bg)', stroke: c[n - p] && fbShow !== null ? 'var(--accent)' : 'var(--ink-3)' }" stroke-width="2" />
        <text :x="slotX(p - 1) + W / 2" :y="Y + 40" text-anchor="middle" font-size="12" style="fill:var(--ink-3)">s{{ n - p }}</text>
      </g>
      <!-- 比特（带位移动画） -->
      <g v-for="b in bits" :key="b.id" :style="{ transform: `translate(${slotX(b.pos) + W / 2}px, ${Y + 6}px)`, transition: busy ? 'transform .45s ease, opacity .45s' : 'none', opacity: b.pos >= n ? 0.35 : 1 }">
        <text text-anchor="middle" font-size="20" font-weight="700" :style="{ fill: b.v ? 'var(--accent)' : 'var(--ink-2)', fontFamily: 'var(--vp-font-family-mono)' }">{{ b.v }}</text>
      </g>
      <!-- 输出 -->
      <line :x1="slotX(n - 1) + W - 3" :y1="Y" :x2="slotX(n) + 40" :y2="Y" style="stroke:var(--ink-3)" stroke-width="1.4" />
      <path :d="`M${slotX(n) + 46} ${Y} l-8 -5 v10 z`" style="fill:var(--ink-3)" />
      <text :x="slotX(n) + 30" :y="Y - 10" text-anchor="middle" font-size="12" style="fill:var(--ink-3)">输出</text>
      <!-- 系数开关 -->
      <g v-for="p in n" :key="'c' + p" style="cursor:pointer" @click="toggleC(n - p)">
        <rect :x="slotX(p - 1) + 12" y="140" :width="W - 24" height="24" rx="12"
          :style="{ fill: c[n - p] ? 'var(--accent)' : 'var(--paper)', stroke: c[n - p] ? 'var(--accent)' : 'var(--line)' }" />
        <text :x="slotX(p - 1) + W / 2" y="156" text-anchor="middle" font-size="12" :style="{ fill: c[n - p] ? '#fff' : 'var(--ink-3)' }">c{{ n - p }}={{ c[n - p] }}</text>
      </g>
    </svg>
    <div class="ctrl" style="margin-top:8px">
      <button class="btn primary" :disabled="busy" @click="step(true)">单步 ▶</button>
      <button class="btn" @click="play">{{ playing ? '⏸ 暂停' : '⏵ 连续播放' }}</button>
      <button class="btn" :disabled="busy" @click="fast(maxLen + 1)">快进 2ⁿ 拍</button>
      <button class="btn" @click="reset">重置</button>
    </div>
    <div class="out"><span class="lbl">输出序列 y₁, y₂, …（已输出 {{ outs.length }} 位）</span>{{ outs.join('') || '—' }}</div>
    <div class="stats">
      <div class="stat"><b>{{ isZero ? '—' : cyc.lambda }}</b><span>状态周期 λ</span></div>
      <div class="stat"><b>{{ cyc.mu }}</b><span>前周期 μ（进入循环前的拍数）</span></div>
      <div class="stat"><b>{{ maxLen }}</b><span>上界 2ⁿ − 1</span></div>
      <div class="stat"><b :class="!isZero && cyc.lambda === maxLen ? 'ok-c' : 'bad-c'">{{ isZero ? '全 0 卡死' : cyc.lambda === maxLen ? '是' : '否' }}</b><span>最大长度 LFSR？</span></div>
    </div>
    <p v-if="c[0] === 0" class="widget-note" style="color:var(--warn)">c₀ = 0 时 s₀ 不参与反馈，状态转移不可逆：序列可能先走几拍“尾巴”（μ &gt; 0）才进入循环。</p>
    <div style="max-height:220px;overflow:auto;border:1px solid var(--line);border-radius:8px">
      <table class="mini-table">
        <thead><tr><th>时刻 t</th><th>状态 (s{{ n - 1 }}, …, s0)</th><th>本拍输出 s0</th></tr></thead>
        <tbody>
          <tr v-for="h in hist" :key="h.t" :class="{ best: h.t > 0 && h.t === cyc.mu + cyc.lambda }">
            <td>{{ h.t }}</td>
            <td style="font-family:var(--vp-font-family-mono)">{{ h.st }}<span v-if="h.t > 0 && h.t === cyc.mu + cyc.lambda"> ← 与 t={{ cyc.mu }} 的状态相同，开始重复</span></td>
            <td style="font-family:var(--vp-font-family-mono)">{{ h.o }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </Widget>
</template>
