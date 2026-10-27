<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { randBits, bitsToStr, PRGS, rangeOf, SEED_LEN, OUT_LEN, log2Binom, fmtPow10, type Bits } from '../lib/l03'

// PRG 区分游戏：拿到 y，它要么是 G(s)（s 均匀），要么是真随机 r ∈ {0,1}^16
const gi = ref(0)
const G = computed(() => PRGS[gi.value])

// ---- 手动 ----
const y = ref<Bits>([])
const isPrg = ref(true)
const answered = ref(false)
const lastOk = ref(false)
const st = reactive({ n: 0, w: 0 })
function draw() {
  isPrg.value = Math.random() < 0.5
  y.value = isPrg.value ? G.value.G(randBits(SEED_LEN)) : randBits(OUT_LEN)
  answered.value = false
}
function guess(g: boolean) {
  lastOk.value = g === isPrg.value
  st.n++; if (lastOk.value) st.w++
  answered.value = true
}
function setG(i: number) { gi.value = i; st.n = 0; st.w = 0; y.value = []; answered.value = false }

// ---- 自动区分器 D：输出 1 表示“我认为是伪随机” ----
const DS = [
  { name: 'D_半：两半相等？', D: (v: Bits) => bitsToStr(v.slice(0, 8)) === bitsToStr(v.slice(8)) },
  { name: 'D_奇偶：y₉ = y₁？', D: (v: Bits) => v[8] === v[0] },
  { name: 'D_穷举：y ∈ G_mix 的值域？（2⁸ 步）', D: (v: Bits) => rangeOf(PRGS[0]).has(bitsToStr(v)) }
]
const TRIALS = 4000
const res = ref<{ pg: number; pr: number }[] | null>(null)
function runAll() {
  res.value = DS.map(d => {
    let a = 0, b = 0
    for (let t = 0; t < TRIALS; t++) {
      if (d.D(G.value.G(randBits(SEED_LEN)))) a++
      if (d.D(randBits(OUT_LEN))) b++
    }
    return { pg: a / TRIALS, pr: b / TRIALS }
  })
}

// ---- 期中 Q3(3)：G'(s) = 0^{l} 若 s 中 1 的个数恰为 ⌊n/2⌋ ----
const nn = ref(64)
const lgHit = computed(() => (log2Binom(nn.value, Math.floor(nn.value / 2)) - nn.value) * Math.log10(2))
</script>

<template>
  <Widget title="PRG 区分器游戏">
    <div class="ctrl">
      <span style="font-size:13.5px;color:var(--ink-2)">生成器（种子 8 位 → 输出 16 位）：</span>
      <div class="seg"><button v-for="(g, i) in PRGS" :key="g.id" :class="{ on: gi === i }" @click="setG(i)">{{ g.name }}</button></div>
    </div>
    <p class="widget-note">{{ G.desc }}</p>
    <div class="ctrl">
      <button class="btn primary" @click="draw">抽一个样本 y</button>
      <div class="out" style="flex:1;min-width:220px"><span class="lbl">y（按两半显示）</span>{{ y.length ? bitsToStr(y.slice(0, 8)) + ' │ ' + bitsToStr(y.slice(8)) : '—' }}</div>
    </div>
    <div class="ctrl">
      <button class="btn" :disabled="!y.length || answered" @click="guess(true)">我猜：伪随机 G(s)</button>
      <button class="btn" :disabled="!y.length || answered" @click="guess(false)">我猜：真随机 r</button>
      <span v-if="answered" :class="lastOk ? 'ok-c' : 'bad-c'" style="font-weight:700">{{ lastOk ? '猜对' : '猜错' }}——它是{{ isPrg ? '伪随机 G(s)' : '真随机 r' }}</span>
      <span class="muted" style="font-size:13px">已猜 {{ st.n }} 次，正确率 {{ st.n ? (st.w / st.n * 100).toFixed(1) + '%' : '—' }}</span>
    </div>
    <hr style="border:0;border-top:1px dashed var(--line);margin:14px 0">
    <div class="ctrl"><button class="btn primary" @click="runAll">对当前生成器运行三个区分器（各 {{ TRIALS }} 次）</button></div>
    <table v-if="res" class="mini-table">
      <thead><tr><th>区分器 D</th><th>Pr[D(G(s)) = 1]</th><th>Pr[D(r) = 1]</th><th>优势 |差|</th></tr></thead>
      <tbody>
        <tr v-for="(r, i) in res" :key="i" :class="{ best: Math.abs(r.pg - r.pr) > .3 }">
          <td>{{ DS[i].name }}</td><td>{{ r.pg.toFixed(3) }}</td><td>{{ r.pr.toFixed(3) }}</td><td>{{ Math.abs(r.pg - r.pr).toFixed(3) }}</td>
        </tr>
      </tbody>
    </table>
    <p class="widget-note" style="margin-top:8px">任何 G 都逃不过 D_穷举 这类区分器（值域只占 2<sup>n</sup>/2<sup>l(n)</sup>）——但它要 2<sup>n</sup> 步，不是 PPT 的。PRG 的定义只要求骗过所有 <b>PPT</b> 区分器。</p>
    <hr style="border:0;border-top:1px dashed var(--line);margin:14px 0">
    <p class="widget-note"><b>期中 Q3(3)</b>：G′(s) 在 s 恰有 ⌊n/2⌋ 个 1 时输出全 0。区分器“y 是否全 0”的优势 ≈ Pr[s 恰有 ⌊n/2⌋ 个 1] = C(n,⌊n/2⌋)/2<sup>n</sup>。</p>
    <div class="ctrl"><label>n = <b>{{ nn }}</b><input v-model.number="nn" type="range" min="4" max="4096" step="4" style="width:280px"></label></div>
    <div class="stats">
      <div class="stat"><b>{{ fmtPow10(lgHit, 3) }}</b><span>C(n,⌊n/2⌋) / 2ⁿ</span></div>
      <div class="stat"><b>{{ Math.sqrt(2 / Math.PI / nn).toPrecision(4) }}</b><span>Stirling 近似 √(2/(πn))</span></div>
      <div class="stat"><b>{{ (1 / (nn + 1)).toPrecision(4) }}</b><span>下界 1/(n+1)</span></div>
    </div>
    <p class="widget-note" style="margin:0">优势只按 1/√n 的速度下降——是多项式倒数量级，不可忽略，所以 G′ 不是 PRG。</p>
  </Widget>
</template>
