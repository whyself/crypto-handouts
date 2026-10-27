<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { A, mod, idx, lettersOnly, shift, vigenere, Ij, bestJ, PARA } from '../lib/crypto'

// I_j 自动破解：移位密码直接找 j；维吉尼亚先按 m 分组，每组各找 j
const mode = ref<'shift' | 'vig'>('shift')
const ct = ref('')
const m = ref(6)
const col = ref(0)
const WORDS = ['crypto', 'beads', 'secure', 'katz', 'nanjing', 'cipher', 'random', 'lindell']

function newCt() {
  ct.value = mode.value === 'shift'
    ? shift(PARA, 1 + Math.floor(Math.random() * 25), true)
    : vigenere(PARA, WORDS[Math.floor(Math.random() * WORDS.length)])
  col.value = 0
}
function setMode(v: 'shift' | 'vig') { mode.value = v; newCt() }
onMounted(newCt)

const letters = computed(() => lettersOnly(ct.value))
const groups = computed(() => {
  const mm = mode.value === 'shift' ? 1 : m.value
  return Array.from({ length: mm }, (_, r) => [...letters.value].filter((_, i) => i % mm === r).join(''))
})
const Is = computed(() => groups.value.map(g => Ij(g)))
const bests = computed(() => Is.value.map(bestJ))
const key = computed(() => bests.value.map(b => A[b]).join(''))
const view = computed(() => Math.min(col.value, groups.value.length - 1))
const avgFit = computed(() => Is.value.reduce((a, I, i) => a + I[bests.value[i]], 0) / Is.value.length)
const avgAll = computed(() => Is.value[0].reduce((a, v) => a + v, 0) / 26)
const plain = computed(() => {
  let n = 0
  const k = key.value
  return ct.value.toLowerCase().replace(/[a-z]/g, ch => A[mod(idx(ch) - idx(k[n++ % k.length]), 26)])
})

// 自动搜索 m：取各组最佳 I_j 平均值首次超过 0.058 的最小 m
function autoM() {
  for (let mm = 1; mm <= 12; mm++) {
    const fit = Array.from({ length: mm }, (_, r) => Math.max(...Ij([...letters.value].filter((_, i) => i % mm === r).join('')))).reduce((a, v) => a + v, 0) / mm
    if (fit > .058) { m.value = mm; break }
  }
}

const xOf = (j: number) => 40 + j * 26
const yOf = (v: number) => 180 - v / .075 * 150
const title = computed(() => mode.value === 'shift'
  ? '对每个 j 计算 I_j，绿色为最接近 0.065 的 j'
  : `第 ${view.value} 组：y${view.value}, y${view.value + m.value}, y${view.value + 2 * m.value}, …（共 ${groups.value[view.value]?.length ?? 0} 个字母）`)
</script>

<template>
  <Widget title="I<sub>j</sub> 自动破解：移位密码 &amp; 维吉尼亚密码">
    <div class="ctrl">
      <div class="seg">
        <button :class="{ on: mode === 'shift' }" @click="setMode('shift')">移位密码</button>
        <button :class="{ on: mode === 'vig' }" @click="setMode('vig')">维吉尼亚密码</button>
      </div>
      <button class="btn" @click="newCt">🎲 用随机密钥重新加密</button>
    </div>
    <div class="ctrl"><textarea v-model="ct" rows="3" /></div>
    <div v-if="mode === 'vig'" class="ctrl">
      <label>密钥长度 m = <b>{{ m }}</b><input v-model.number="m" type="range" min="1" max="12"></label>
      <button class="btn" @click="autoM">自动搜索 m</button>
      <label>查看第
        <select v-model.number="col"><option v-for="i in m" :key="i" :value="i - 1">{{ i - 1 }}</option></select> 组
      </label>
    </div>
    <p v-if="mode === 'vig'" class="widget-note">提示：先用 Kasiski 估计 m，或拖动滑块看哪个 m 让各组的最佳 I_j 都接近 0.065。</p>
    <svg viewBox="0 0 720 210" style="width:100%;height:auto">
      <text x="40" y="14" font-size="12" style="fill:var(--ink-3)">{{ title }}</text>
      <g v-for="v in [0, .02, .04, .06]" :key="v">
        <text x="34" :y="yOf(v) + 4" font-size="10" text-anchor="end" style="fill:var(--ink-3)">{{ v.toFixed(2) }}</text>
        <line x1="38" x2="716" :y1="yOf(v)" :y2="yOf(v)" style="stroke:var(--line-2)" />
      </g>
      <g v-for="(v, j) in Is[view]" :key="j">
        <rect :x="xOf(j) + 2" :y="yOf(v)" width="21" :height="180 - yOf(v)" rx="2"
          :style="{ fill: j === bests[view] ? 'var(--ex)' : 'var(--accent)' }" :opacity="j === bests[view] ? 1 : .45">
          <title>j={{ j }}  I_j={{ v.toFixed(4) }}</title>
        </rect>
        <text :x="xOf(j) + 12" y="196" font-size="10" text-anchor="middle" :font-weight="j === bests[view] ? 700 : 400"
          :style="{ fill: j === bests[view] ? 'var(--ex)' : 'var(--ink-3)', fontFamily: 'var(--vp-font-family-mono)' }">{{ j }}</text>
      </g>
      <line x1="38" x2="716" :y1="yOf(.065)" :y2="yOf(.065)" style="stroke:var(--warn)" stroke-dasharray="5 4" />
      <text x="716" :y="yOf(.065) - 5" font-size="11" text-anchor="end" style="fill:var(--warn)">0.065</text>
    </svg>
    <div class="stats">
      <template v-if="mode === 'shift'">
        <div class="stat"><b>k = {{ bests[0] }}</b><span>推断的移位量</span></div>
        <div class="stat"><b>{{ Is[0][bests[0]].toFixed(4) }}</b><span>I_k</span></div>
        <div class="stat"><b>{{ avgAll.toFixed(4) }}</b><span>所有 I_j 的平均（≈1/26≈0.038）</span></div>
      </template>
      <template v-else>
        <div class="stat"><b style="font-family:var(--vp-font-family-mono)">{{ key }}</b><span>推断的密钥</span></div>
        <div class="stat"><b>{{ avgFit.toFixed(4) }}</b><span>各组最佳 I_j 的平均</span></div>
        <div class="stat"><b :class="Math.abs(avgFit - .065) < .008 ? 'ok-c' : 'bad-c'">{{ Math.abs(avgFit - .065) < .008 ? 'm 很可能正确' : 'm 可能不对' }}</b><span>判据：接近 0.065</span></div>
      </template>
    </div>
    <div class="out" style="max-height:110px;overflow:auto;font-size:14px"><span class="lbl">按推断的密钥解密</span>{{ plain }}</div>
  </Widget>
</template>
