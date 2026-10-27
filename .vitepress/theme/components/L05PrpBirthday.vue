<script setup lang="ts">
import { ref, computed } from 'vue'
import { randBits } from '../lib/l05'

// 命题 3.27 的直觉：随机置换与随机函数唯一的区别是“随机函数可能碰撞”
// 判别器 D：查询 q 个不同的 x，若出现 f(x) = f(y) 就断定是“函数”
const l = ref(16)          // 分组长度 l_in
const lq = ref(8)          // log2 q
const q = computed(() => Math.max(1, Math.round(2 ** lq.value)))

// 碰撞概率：用 1 − exp(−q(q−1)/2^{l+1}) 近似（expm1 保证极小值精度）（l 大时足够精确），并给出上界 q²/2^{l+1}
const pc = (lg: number, L: number) => { const qq = 2 ** lg; return -Math.expm1(-qq * (qq - 1) / 2 ** (L + 1)) }
const p = computed(() => pc(lq.value, l.value))
const ub = computed(() => q.value ** 2 / 2 ** (l.value + 1))

function fmt(x: number) {
  if (x === 0) return '0'
  if (x >= 1e-3) return x.toFixed(4)
  const e = Math.floor(Math.log2(x))
  return `≈ 2^${e}`
}

// 曲线：横轴 log2 q ∈ [0, l]
const W = 680, H = 170, X0 = 30, Y0 = 150
const xs = (g: number) => X0 + (g / l.value) * (W - X0 - 10)
const ys = (v: number) => Y0 - v * 130
const path = computed(() => {
  const pts: string[] = []
  for (let i = 0; i <= 120; i++) { const g = (i / 120) * l.value; pts.push(`${xs(g).toFixed(1)},${ys(pc(g, l.value)).toFixed(1)}`) }
  return 'M' + pts.join(' L')
})

// 小参数下的模拟
const sim = ref<{ f: number; perm: number } | null>(null)
const canSim = computed(() => l.value <= 20 && q.value <= 4096 && q.value <= 2 ** l.value)
function runSim() {
  const T = 1000, N = 2 ** l.value
  let cf = 0, cp = 0
  for (let t = 0; t < T; t++) {
    // 随机函数：每个新 x 独立均匀采样输出
    const seen = new Set<number>(); let col = false
    for (let i = 0; i < q.value; i++) { const y = randBits(l.value); if (seen.has(y)) { col = true; break } seen.add(y) }
    if (col) cf++
    // 随机置换：惰性采样时从“尚未用过的输出”中均匀取，永不碰撞
    const used = new Set<number>(); let col2 = false
    for (let i = 0; i < q.value; i++) { let y; do { y = randBits(l.value) } while (used.has(y) && used.size < N); if (used.has(y)) col2 = true; used.add(y) }
    if (col2) cp++
  }
  sim.value = { f: cf / T, perm: cp / T }
}
</script>

<template>
  <Widget title="PRP vs PRF：区分它们只能靠“碰撞”">
    <p class="widget-note">判别器 D：向预言机查询 q 个<b>不同</b>的输入，只要看到两个相同的输出就输出 1（“这是函数”）。对随机置换，D 永远输出 0；对随机函数，D 输出 1 的概率就是生日碰撞概率。二者之差即 D 的区分优势。</p>
    <div class="ctrl">
      <label>分组长度 l = <b>{{ l }}</b> 位<input v-model.number="l" type="range" min="4" max="128" @input="lq = Math.min(lq, l); sim = null"></label>
      <label><span>查询次数 q = 2<sup>{{ lq }}</sup></span><input v-model.number="lq" type="range" min="0" :max="l" step="1" @input="sim = null"></label>
    </div>
    <svg :viewBox="`0 0 ${W} ${H + 10}`" style="width:100%;height:auto">
      <line :x1="X0" :y1="Y0" :x2="W - 10" :y2="Y0" style="stroke:var(--ink-3)" />
      <line :x1="X0" :y1="ys(1)" :x2="X0" :y2="Y0" style="stroke:var(--ink-3)" />
      <text :x="X0 - 4" :y="ys(1) + 4" font-size="10" text-anchor="end" style="fill:var(--ink-3)">1</text>
      <text :x="X0 - 4" :y="Y0 + 4" font-size="10" text-anchor="end" style="fill:var(--ink-3)">0</text>
      <line :x1="xs(l / 2)" :y1="ys(1)" :x2="xs(l / 2)" :y2="Y0" style="stroke:var(--warn)" stroke-dasharray="4 4" />
      <text :x="xs(l / 2) + 4" :y="ys(1) + 10" font-size="11" style="fill:var(--warn)">q = 2^(l/2)（生日界）</text>
      <path :d="path" style="fill:none;stroke:var(--accent)" stroke-width="2" />
      <line :x1="X0" :y1="Y0 - 1" :x2="W - 10" :y2="Y0 - 1" style="stroke:var(--ex)" stroke-width="2.5" />
      <circle :cx="xs(lq)" :cy="ys(p)" r="5" style="fill:var(--accent)" />
      <text :x="W - 12" :y="Y0 + 16" font-size="11" text-anchor="end" style="fill:var(--ink-3)">log₂ q → {{ l }}</text>
      <text :x="X0 + 6" :y="Y0 + 16" font-size="11" style="fill:var(--ex)">绿线：随机置换下 Pr[D=1] ≡ 0</text>
    </svg>
    <div class="stats">
      <div class="stat"><b>{{ fmt(p) }}</b><span>Pr[D<sup>f</sup>=1]（随机函数出现碰撞）</span></div>
      <div class="stat"><b>0</b><span>Pr[D<sup>π</sup>=1]（随机置换）</span></div>
      <div class="stat"><b>{{ fmt(Math.min(1, ub)) }}</b><span>上界 q²/2<sup>l+1</sup></span></div>
    </div>
    <div class="ctrl">
      <button class="btn" :disabled="!canSim" @click="runSim">在两个世界各模拟 1000 次</button>
      <span v-if="!canSim" class="muted" style="font-size:13px">（模拟仅在 l ≤ 20 且 q ≤ 4096 时可用）</span>
      <span v-if="sim" style="font-size:14px">随机函数中出现碰撞：<b>{{ sim.f.toFixed(3) }}</b>；随机置换中：<b>{{ sim.perm.toFixed(3) }}</b></span>
    </div>
    <p class="widget-note" style="margin:0">试试 l = 128（AES 的分组长度）：哪怕 q = 2⁴⁰，优势也只有约 2⁻⁴⁹。只要 l<sub>in</sub> ≥ n 且 q 是多项式，q²/2<sup>l+1</sup> 就可忽略——PRP 也就可以当 PRF 用（命题 3.27）。反过来把 l 调到 8，q = 32 时就已经很容易区分了。</p>
  </Widget>
</template>

<style scoped>
.btn:disabled { opacity: .45; cursor: not-allowed; }
</style>
