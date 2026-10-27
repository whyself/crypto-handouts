<script setup lang="ts">
import { ref, computed } from 'vue'
import { fmtPow10 } from '../lib/l03'

// “重复直到成功”：单次成功率 p(n)，独立重复 q(n) = n^d 次
const PS = [
  { id: 'inv', tex: 'p = 1/n', lg: (n: number) => -Math.log10(n), neg: false },
  { id: 'inv3', tex: 'p = 1/n³', lg: (n: number) => -3 * Math.log10(n), neg: false },
  { id: 'half', tex: 'p = 2<sup>−n/2</sup>', lg: (n: number) => -n / 2 * Math.log10(2), neg: true },
  { id: 'exp', tex: 'p = 2<sup>−n</sup>', lg: (n: number) => -n * Math.log10(2), neg: true }
]
const pi = ref(0)
const d = ref(2)
const n = ref(64)
const P = computed(() => PS[pi.value])

// log10 of 1-(1-p)^q，用 log1p / expm1 保证精度
function lgRepeat(nn: number) {
  const p = Math.pow(10, P.value.lg(nn))
  const q = Math.pow(nn, d.value)
  const lnFail = q * Math.log1p(-Math.min(p, 1 - 1e-16))
  const succ = -Math.expm1(lnFail)
  return succ > 0 ? Math.log10(succ) : Math.log10(q) + P.value.lg(nn)
}
const lgBound = (nn: number) => Math.min(0, d.value * Math.log10(nn) + P.value.lg(nn))

const NMIN = 4, NMAX = 256
const W = 680, H = 240, L = 50, T = 12, B = 28
const yLo = computed(() => Math.max(-80, Math.min(-2, P.value.lg(NMAX))))
const xOf = (x: number) => L + ((x - NMIN) / (NMAX - NMIN)) * (W - L - 10)
const yOf = (v: number) => T + (Math.max(yLo.value, Math.min(0, v)) / yLo.value) * (H - T - B)
function path(f: (x: number) => number) {
  const pts: string[] = []
  for (let x = NMIN; x <= NMAX; x += 1) pts.push(`${xOf(x).toFixed(1)},${yOf(f(x)).toFixed(1)}`)
  return 'M' + pts.join('L')
}
const ticks = computed(() => Array.from({ length: 5 }, (_, i) => Math.round(yLo.value * i / 4)))
</script>

<template>
  <Widget title="“重复直到成功”能否翻盘？">
    <p class="widget-note">PPT 敌手最多能把一次攻击独立重复 q(n) = n<sup>d</sup> 次（多项式次）。看看单次成功率是“非可忽略”还是“可忽略”时，结局有何不同。纵轴为 log₁₀ 概率。</p>
    <div class="ctrl">
      <div class="seg"><button v-for="(x, i) in PS" :key="x.id" :class="{ on: pi === i }" @click="pi = i" v-html="x.tex" /></div>
      <label>重复次数 q = n^<b>{{ d }}</b><input v-model.number="d" type="range" min="1" max="6" step="1"></label>
    </div>
    <svg :viewBox="`0 0 ${W} ${H}`" style="width:100%;height:auto">
      <g v-for="v in ticks" :key="v">
        <line :x1="L" :x2="W - 10" :y1="yOf(v)" :y2="yOf(v)" style="stroke:var(--line-2)" />
        <text :x="L - 6" :y="yOf(v) + 4" font-size="10" text-anchor="end" style="fill:var(--ink-3)">10^{{ v }}</text>
      </g>
      <text v-for="x in [4, 64, 128, 192, 256]" :key="'x' + x" :x="xOf(x)" :y="H - 10" font-size="10" text-anchor="middle" style="fill:var(--ink-3)">{{ x }}</text>
      <path :d="path(P.lg)" style="fill:none;stroke:var(--ink-3);stroke-width:2;stroke-dasharray:5 4" />
      <path :d="path(lgBound)" style="fill:none;stroke:var(--warn);stroke-width:1.5;stroke-dasharray:2 3" />
      <path :d="path(lgRepeat)" style="fill:none;stroke:var(--accent);stroke-width:2.5" />
      <line :x1="xOf(n)" :x2="xOf(n)" :y1="T" :y2="H - B" style="stroke:var(--ink);stroke-dasharray:4 3" />
      <g font-size="11">
        <line :x1="L + 10" :x2="L + 34" y1="22" y2="22" style="stroke:var(--accent);stroke-width:2.5" /><text :x="L + 40" y="26" style="fill:var(--ink-2)">重复 q 次后至少成功一次</text>
        <line :x1="L + 200" :x2="L + 224" y1="22" y2="22" style="stroke:var(--ink-3);stroke-width:2;stroke-dasharray:5 4" /><text :x="L + 230" y="26" style="fill:var(--ink-2)">单次成功率 p</text>
        <line :x1="L + 330" :x2="L + 354" y1="22" y2="22" style="stroke:var(--warn);stroke-width:1.5;stroke-dasharray:2 3" /><text :x="L + 360" y="26" style="fill:var(--ink-2)">上界 q·p</text>
      </g>
    </svg>
    <div class="ctrl"><label>n = <b>{{ n }}</b><input v-model.number="n" type="range" :min="NMIN" :max="NMAX" step="1" style="width:300px"></label></div>
    <div class="stats">
      <div class="stat"><b>{{ fmtPow10(P.lg(n)) }}</b><span>单次成功率 p(n)</span></div>
      <div class="stat"><b>{{ fmtPow10(d * Math.log10(n)) }}</b><span>重复次数 q(n) = n^{{ d }}</span></div>
      <div class="stat"><b :class="P.neg ? 'ok-c' : 'bad-c'">{{ fmtPow10(lgRepeat(n)) }}</b><span>至少成功一次</span></div>
    </div>
    <p class="widget-note" style="margin:0"><template v-if="P.neg">单次成功率可忽略：乘上任何多项式 q(n) 依然可忽略（命题 1.3），蓝线终将一路下坠。</template><template v-else>单次成功率不可忽略：只要重复 n<sup>{{ d }}</sup> 次，成功率就被推到接近 1（例如 p = 1/n 时，1 − (1 − 1/n)<sup>n²</sup> ≈ 1 − e<sup>−n</sup>）。</template></p>
  </Widget>
</template>
