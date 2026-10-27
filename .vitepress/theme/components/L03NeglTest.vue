<script setup lang="ts">
import { ref, computed } from 'vue'
import { log2Fact } from '../lib/l03'

// 把 f(n) 写成 n^{-k(n)}，即 k(n) = log(1/f(n)) / log n（“等效多项式次数”）。
// f 可忽略 ⇔ 对每个 c，最终都有 k(n) > c ⇔ k(n) → ∞。横轴取 x = log2 n。
interface F { id: string; tex: string; k: (x: number) => number; neg: boolean; why: string; pts?: (c: number) => [number, number][] }

const FS: F[] = [
  { id: 'exp', tex: '2<sup>−n</sup>', k: x => Math.pow(2, x) / x, neg: true, why: 'k(n) = n / log₂n → ∞，增长极快。' },
  { id: 'sqrt', tex: '2<sup>−√n</sup>', k: x => Math.pow(2, x / 2) / x, neg: true, why: 'k(n) = √n / log₂n → ∞：比 2<sup>−n</sup> 慢，但仍可忽略。' },
  { id: 'fact', tex: '1/n!', k: x => log2Fact(Math.pow(2, x)) / x, neg: true, why: 'n! ≥ 2<sup>n−1</sup>，k(n) ≈ n − n/ln n → ∞（P37）。' },
  { id: 'nlog', tex: 'n<sup>−log₂n</sup>', k: x => x, neg: true, why: 'k(n) = log₂n → ∞：超多项式但亚指数，仍可忽略。' },
  { id: 'loglog', tex: '(log₂n)<sup>−log₂n</sup>', k: x => (x > 1 ? Math.log2(x) : 0), neg: true, why: 'k(n) = log₂log₂n → ∞，慢得惊人：要 k > c 需 n > 2<sup>2<sup>c</sup></sup>（期中 Q2-1）。' },
  { id: 'poly', tex: '1/n<sup>10</sup>', k: () => 10, neg: false, why: 'k(n) ≡ 10，取 c = 10（或任何 c ≥ 10）就永远越不过去。' },
  { id: 'inv', tex: '1/n', k: () => 1, neg: false, why: 'k(n) ≡ 1：取 c = 1 即可否定（P36）。' },
  { id: 'binom', tex: '1/C(n,3)', k: x => (x <= Math.log2(3) ? 0 : (3 * x + Math.log2(1 - Math.pow(2, -x)) + Math.log2(1 - Math.pow(2, 1 - x)) - Math.log2(6)) / x), neg: false, why: 'C(n,3) = n(n−1)(n−2)/6 是多项式，k(n) → 3（期中 Q2-2）。' },
  {
    id: 'tri', tex: '期中 Q2-3', k: x => Math.pow(2, x) * Math.log2(3) / x, neg: false,
    why: 'n 不被 3 整除时 f(n) = 3<sup>−n</sup>（实线，飞速上升）；但在子序列 n = 3<sup>j</sup> 上 f(n) = f(1) = 1/3（红点），k(n) = log₂3 / log₂n → 0。无穷多个 n 越不过任何 c。',
    pts: () => Array.from({ length: 80 }, (_, j) => [(j + 1) * Math.log2(3), 1 / (j + 1)] as [number, number]).filter(p => p[0] <= 128)
  },
  { id: 'ratio', tex: '期中 Q2-5：2<sup>−n</sup>/2<sup>−2n</sup>', k: x => -Math.pow(2, x) / x, neg: false, why: 'g/h = 2<sup>n</sup>，甚至趋于无穷大；两个可忽略函数之商不一定可忽略。' }
]

const cur = ref(FS[0])
const c = ref(5)
const XMAX = 128, YMAX = 40
const W = 680, H = 250, L = 40, T = 10, B = 30
const xOf = (x: number) => L + (x / XMAX) * (W - L - 10)
const yOf = (k: number) => T + (1 - Math.max(-2, Math.min(YMAX, k)) / YMAX) * (H - T - B)

const pathD = computed(() => {
  const pts: string[] = []
  for (let i = 1; i <= 512; i++) {
    const x = (i / 512) * XMAX
    pts.push(`${xOf(x).toFixed(1)},${yOf(cur.value.k(x)).toFixed(1)}`)
  }
  return 'M' + pts.join('L')
})
const dots = computed(() => (cur.value.pts ? cur.value.pts(c.value) : []))

// 在显示范围内找最后一个 k(x) ≤ c 的位置（数值近似）
const lastFail = computed(() => {
  let last = -1
  for (let i = 1; i <= 4096; i++) {
    const x = (i / 4096) * XMAX
    if (cur.value.k(x) <= c.value) last = x
  }
  for (const [x, k] of dots.value) if (k <= c.value) last = Math.max(last, x)
  return last
})
const verdict = computed(() => {
  // 带子序列（红点）的函数：只要红点在 c 之下，就是无穷多次失败
  if (dots.value.some(([, k]) => k <= c.value)) return { ok: false, t: `子序列 n = 3^j 上永远 f(n) ≥ 1/n^${c.value}` }
  if (lastFail.value < 0) return { ok: true, t: `整个范围内都有 f(n) < 1/n^${c.value}` }
  if (lastFail.value >= XMAX - 0.05) return { ok: false, t: `直到 n = 2^${XMAX} 仍有 f(n) ≥ 1/n^${c.value}` }
  const xs = lastFail.value
  return { ok: true, t: `N_c ≈ 2^${xs.toFixed(xs < 10 ? 2 : 1)}${xs < 20 ? `（≈ ${Math.round(Math.pow(2, xs)).toLocaleString()}）` : ''}：此后 f(n) < 1/n^${c.value}` }
})
</script>

<template>
  <Widget title="可忽略判定器：等效多项式次数 k(n)">
    <p class="widget-note">把 f(n) 写成 n<sup>−k(n)</sup>。“f(n) &lt; 1/n<sup>c</sup>”等价于“k(n) &gt; c”。所以 f 可忽略 ⇔ 对每条水平线 c，曲线最终都永远待在它上方。横轴是 log₂n（右端 n = 2¹²⁸）。</p>
    <div class="ctrl">
      <div class="seg"><button v-for="f in FS" :key="f.id" :class="{ on: cur.id === f.id }" @click="cur = f" v-html="f.tex" /></div>
    </div>
    <div class="ctrl"><label>c = <b>{{ c }}</b><input v-model.number="c" type="range" min="1" max="35" step="1"></label></div>
    <svg :viewBox="`0 0 ${W} ${H}`" style="width:100%;height:auto">
      <rect :x="L" :y="yOf(c)" :width="W - L - 10" :height="H - B - yOf(c)" style="fill:var(--warn-bg)" />
      <g v-for="v in [0, 10, 20, 30, 40]" :key="v">
        <line :x1="L" :x2="W - 10" :y1="yOf(v)" :y2="yOf(v)" style="stroke:var(--line-2)" />
        <text :x="L - 6" :y="yOf(v) + 4" font-size="10" text-anchor="end" style="fill:var(--ink-3)">{{ v }}</text>
      </g>
      <g v-for="v in [0, 16, 32, 64, 96, 128]" :key="'x' + v">
        <text :x="xOf(v)" :y="H - 12" font-size="10" text-anchor="middle" style="fill:var(--ink-3)">2^{{ v }}</text>
      </g>
      <line :x1="L" :x2="W - 10" :y1="yOf(c)" :y2="yOf(c)" style="stroke:var(--warn);stroke-width:1.5;stroke-dasharray:6 4" />
      <text :x="W - 12" :y="yOf(c) - 5" font-size="11" text-anchor="end" style="fill:var(--warn)">k = c = {{ c }}（下方阴影：f(n) ≥ 1/n^c）</text>
      <path :d="pathD" style="fill:none;stroke:var(--accent);stroke-width:2.5" />
      <circle v-for="(p, i) in dots" :key="i" :cx="xOf(p[0])" :cy="yOf(p[1])" r="3" style="fill:var(--warn)" />
      <line v-if="lastFail > 0 && lastFail < XMAX - 0.05" :x1="xOf(lastFail)" :x2="xOf(lastFail)" :y1="T" :y2="H - B" style="stroke:var(--ex);stroke-dasharray:3 3" />
    </svg>
    <div class="stats">
      <div class="stat"><b :class="verdict.ok ? 'ok-c' : 'bad-c'" style="font-size:15px">{{ verdict.t }}</b><span>当前 c 下的数值观察（范围 n ≤ 2¹²⁸）</span></div>
      <div class="stat"><b :class="cur.neg ? 'ok-c' : 'bad-c'">{{ cur.neg ? '可忽略' : '不可忽略' }}</b><span>理论结论</span></div>
    </div>
    <div class="out prose" v-html="cur.why" />
    <p class="widget-note" style="margin-top:8px">注意：图只能看有限范围，结论要靠证明。比如 (log₂n)<sup>−log₂n</sup> 在 c ≥ 7 时需要 n &gt; 2<sup>128</sup> 才越过（c = 8 时要 n &gt; 2<sup>256</sup>），图里已经看不到了，但它仍然可忽略。</p>
  </Widget>
</template>
