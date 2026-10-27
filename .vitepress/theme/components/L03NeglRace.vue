<script setup lang="ts">
import { ref, computed } from 'vue'
import { fmtPow10 } from '../lib/l03'

// 复刻课件 P31–34 的对数图：比较 log10(2^-n) 与 log10(n^-c)，并可拖动 n 读数
const RANGES = [100, 1000, 15000, 200000]
const nMax = ref(100)
const n = ref(60)
const CS = [2, 10, 100, 1000, 10000]
const shown = ref<Record<number, boolean>>({ 2: true, 10: true, 100: true, 1000: false, 10000: false })
const COLORS: Record<number, string> = { 2: 'var(--warn)', 10: 'var(--ex)', 100: 'var(--prin)', 1000: '#a855f7', 10000: '#0d9488' }

// log10 值
const lgExp = (x: number) => -x * Math.log10(2)
const lgPoly = (x: number, c: number) => -c * Math.log10(x)

// 交点：最小的 N_c，使得对所有 n > N_c 都有 2^-n < n^-c（即 n > c·log2 n）
function cross(c: number) {
  let x = Math.max(2, c * 2)
  for (let i = 0; i < 60; i++) x = c * Math.log2(x)
  return Math.floor(x)
}
const crosses = computed(() => CS.map(c => ({ c, N: cross(c) })))

const W = 680, H = 260, L = 64, T = 14, B = 34
const visible = computed(() => CS.filter(c => shown.value[c]))
const yMin = computed(() => {
  let m = lgExp(nMax.value)
  for (const c of visible.value) m = Math.min(m, lgPoly(nMax.value, c))
  return m
})
const xOf = (x: number) => L + ((x - 1) / (nMax.value - 1)) * (W - L - 10)
const yOf = (v: number) => T + (v / yMin.value) * (H - T - B)

function path(f: (x: number) => number) {
  const pts: string[] = []
  const N = 240
  for (let i = 0; i <= N; i++) {
    const x = 1 + (nMax.value - 1) * i / N
    pts.push(`${xOf(x).toFixed(1)},${yOf(f(x)).toFixed(1)}`)
  }
  return 'M' + pts.join('L')
}
const ticksY = computed(() => Array.from({ length: 5 }, (_, i) => yMin.value * i / 4))
const ticksX = computed(() => Array.from({ length: 5 }, (_, i) => Math.round(1 + (nMax.value - 1) * i / 4)))

function setRange(r: number) { nMax.value = r; n.value = Math.round(r * 0.6) }
const fmt = (lg: number) => fmtPow10(lg, 2)
</script>

<template>
  <Widget title="2<sup>−n</sup> 与 1/n<sup>c</sup> 的赛跑（对数纵轴）">
    <p class="widget-note">纵轴是 log₁₀ f(n)。在小范围内 1/n¹⁰⁰⁰⁰ 遥遥领先（更小），但把横轴拉长，2<sup>−n</sup> 这条直线迟早会从所有 1/n<sup>c</sup> 下方穿过——这正是“可忽略”的含义。</p>
    <div class="ctrl">
      <span style="font-size:13.5px;color:var(--ink-2)">横轴范围 n ≤</span>
      <div class="seg"><button v-for="r in RANGES" :key="r" :class="{ on: nMax === r }" @click="setRange(r)">{{ r }}</button></div>
    </div>
    <div class="ctrl">
      <label v-for="c in CS" :key="c"><input v-model="shown[c]" type="checkbox"><span :style="{ color: COLORS[c], fontWeight: 700 }">1/n<sup>{{ c }}</sup></span></label>
    </div>
    <svg :viewBox="`0 0 ${W} ${H}`" style="width:100%;height:auto">
      <g v-for="v in ticksY" :key="'y' + v">
        <line :x1="L" :x2="W - 10" :y1="yOf(v)" :y2="yOf(v)" style="stroke:var(--line-2)" />
        <text :x="L - 6" :y="yOf(v) + 4" font-size="10" text-anchor="end" style="fill:var(--ink-3)">{{ Math.round(v) }}</text>
      </g>
      <g v-for="x in ticksX" :key="'x' + x">
        <text :x="xOf(x)" :y="H - 16" font-size="10" text-anchor="middle" style="fill:var(--ink-3)">{{ x }}</text>
      </g>
      <text :x="W - 10" :y="H - 2" font-size="11" text-anchor="end" style="fill:var(--ink-3)">n</text>
      <path v-for="c in visible" :key="c" :d="path(x => lgPoly(x, c))" style="fill:none;stroke-width:2" :style="{ stroke: COLORS[c] }" />
      <path :d="path(lgExp)" style="fill:none;stroke:var(--accent);stroke-width:2.5" />
      <line :x1="xOf(n)" :x2="xOf(n)" :y1="T" :y2="H - B" style="stroke:var(--ink);stroke-dasharray:4 3" />
      <circle :cx="xOf(n)" :cy="yOf(lgExp(n))" r="4" style="fill:var(--accent)" />
    </svg>
    <div class="ctrl"><label>n = <b>{{ n }}</b><input v-model.number="n" type="range" min="1" :max="nMax" step="1" style="width:300px"></label></div>
    <table class="mini-table">
      <thead><tr><th>函数</th><th>在 n = {{ n }} 处的值</th><th>2<sup>−n</sup> 更小吗？</th><th>从哪个 n 起 2<sup>−n</sup> 永远更小</th></tr></thead>
      <tbody>
        <tr class="best"><td><b style="color:var(--accent)">2<sup>−n</sup></b></td><td>{{ fmt(lgExp(n)) }}</td><td>—</td><td>—</td></tr>
        <tr v-for="x in crosses" :key="x.c">
          <td><b :style="{ color: COLORS[x.c] }">1/n<sup>{{ x.c }}</sup></b></td>
          <td>{{ n === 1 ? '1' : fmt(lgPoly(n, x.c)) }}</td>
          <td :class="lgExp(n) < lgPoly(n, x.c) ? 'ok-c' : 'bad-c'">{{ lgExp(n) < lgPoly(n, x.c) ? '是' : '否' }}</td>
          <td>n &gt; {{ x.N.toLocaleString() }}</td>
        </tr>
      </tbody>
    </table>
    <p class="widget-note" style="margin-top:8px">最后一列就是定义 1.2 里的 N<sub>c</sub>：由 n &gt; c·log₂n 解出。c 越大 N<sub>c</sub> 越大，但对每个 c 它都存在。</p>
  </Widget>
</template>
