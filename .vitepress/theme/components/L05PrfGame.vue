<script setup lang="ts">
import { ref, computed } from 'vue'
import { toyF, randBits, randBit, bin, LazyRandomFunction } from '../lib/l05'

// PRF 区分游戏：预言机背后要么是 F_k（随机密钥），要么是惰性采样的真随机函数 f
const N = 8
type Fam = 'toy' | 'xor' | 'q4'
const FAMS: Record<Fam, { name: string; out: number; f: (k: number, x: number) => number; tip: string; D: string }> = {
  toy: {
    name: '玩具 PRF', out: 8, f: (k, x) => toyF(k, x, 8),
    tip: '一个“看起来随机”的混合函数（演示用，并非真正安全）。你应该找不到稳定的区分方法。',
    D: '找不到好办法：随便查两个点、输出随机比特，优势 ≈ 0。'
  },
  xor: {
    name: 'F_k(x) = k ⊕ x', out: 8, f: (k, x) => (k & 0xff) ^ x,
    tip: '查询 x₁、x₂，检查 y₁ ⊕ y₂ 是否等于 x₁ ⊕ x₂。对 F_k 恒成立；对真随机函数仅以 2⁻ⁿ 的概率成立。',
    D: 'D：查询 x₁ = 00000000、x₂ = 11111111，若 y₁ ⊕ y₂ = x₁ ⊕ x₂ 输出 1。'
  },
  q4: {
    name: 'F′_k(x) = F_k(x) ‖ F_k(x̄)（期中 Q4）', out: 16, f: (k, x) => (toyF(k, x, 8) << 8) | toyF(k, x ^ 0xff, 8),
    tip: '查询 x 与其按位取反 x̄：F′(x) = a‖b 时 F′(x̄) = b‖a。对真随机函数，“前后半段恰好对调”的概率只有 2⁻¹⁶。',
    D: 'D：查询 x 与 x̄，若 y₁ 的后半段 = y₂ 的前半段，输出 1。'
  }
}
const fam = ref<Fam>('xor')
const cur = computed(() => FAMS[fam.value])

let k = randBits(30)
const world = ref(randBit()) // 0：F_k；1：真随机函数
let rf = new LazyRandomFunction(16)
const log = ref<{ x: number; y: number; fresh: boolean }[]>([])
const xIn = ref('00000000')
const god = ref(false)
const guessed = ref<number | null>(null)
const score = ref({ n: 0, w: 0 })
const err = ref('')

function oracle(x: number) {
  if (world.value === 0) return { y: cur.value.f(k, x), fresh: false }
  rf.nOut = cur.value.out
  return rf.query(x)
}
function ask(x: number) {
  log.value.push({ x, ...oracle(x) })
}
function query() {
  const t = xIn.value.trim()
  if (!/^[01]{8}$/.test(t)) { err.value = '请输入 8 位二进制串'; return }
  err.value = ''
  ask(parseInt(t, 2))
}
function guess(g: number) {
  guessed.value = g
  score.value.n++
  if (g === world.value) score.value.w++
}
function reset() {
  k = randBits(30); world.value = randBit(); rf = new LazyRandomFunction(cur.value.out)
  log.value = []; guessed.value = null; err.value = ''
}
function pick(f: Fam) { fam.value = f; score.value = { n: 0, w: 0 }; reset() }

// 自动判别器：分别在两个世界中运行 T 次，估计 Pr[D=1]
const auto = ref<{ p0: number; p1: number } | null>(null)
function runD(o: (x: number) => number) {
  if (fam.value === 'xor') { const y1 = o(0), y2 = o(0xff); return (y1 ^ y2) === 0xff ? 1 : 0 }
  if (fam.value === 'q4') { const x = randBits(8); const y1 = o(x), y2 = o(x ^ 0xff); return (y1 & 0xff) === (y2 >>> 8) ? 1 : 0 }
  o(randBits(8)); o(randBits(8)); return randBit()
}
function autoRun() {
  const T = 2000
  let c0 = 0, c1 = 0
  for (let i = 0; i < T; i++) {
    const kk = randBits(30)
    c0 += runD(x => cur.value.f(kk, x))
    const g = new LazyRandomFunction(cur.value.out)
    c1 += runD(x => g.query(x).y)
  }
  auto.value = { p0: c0 / T, p1: c1 / T }
}
const tableRows = computed(() => [...log.value].map((r, i) => ({ ...r, i })).reverse())
</script>

<template>
  <Widget title="PRF 区分游戏：F<sub>k</sub> 还是真随机函数？">
    <p class="widget-note">挑战者秘密抛硬币：要么给你 F<sub>k</sub>(·)（k 均匀随机且<b>对你保密</b>），要么给你一个真随机函数 f(·)。你只能输入 x、看到 y。打开“上帝视角”可以看到挑战者如何<b>惰性采样</b>真随机函数：第一次被问到的 x 才现场抛硬币决定 f(x)，再问就查表。</p>
    <div class="ctrl">
      <div class="seg">
        <button v-for="(v, key) in FAMS" :key="key" :class="{ on: fam === key }" @click="pick(key as Fam)">{{ v.name }}</button>
      </div>
    </div>
    <div class="ctrl">
      <label>x = <input v-model="xIn" type="text" size="9" @keyup.enter="query"></label>
      <button class="btn" @click="query">查询</button>
      <button class="btn" @click="ask(randBits(8))">随机 x</button>
      <label><input v-model="god" type="checkbox"> 上帝视角</label>
      <button class="btn" @click="reset">↺ 新一局</button>
    </div>
    <p v-if="err" class="widget-note bad-c">{{ err }}</p>
    <div class="logbox">
      <table class="mini-table">
        <tr><th>#</th><th>x</th><th>y = O(x)</th><th v-if="god">挑战者内部</th></tr>
        <tr v-for="r in tableRows" :key="r.i">
          <td>{{ r.i + 1 }}</td><td><code>{{ bin(r.x, 8) }}</code></td><td><code>{{ bin(r.y, cur.out) }}</code></td>
          <td v-if="god" style="font-size:12.5px">
            <span v-if="world === 0" class="muted">计算 F_k(x)，k = {{ bin(k & 0xff, 8) }}…</span>
            <span v-else-if="r.fresh" class="ok-c">✦ 新 x：均匀采样 {{ cur.out }} 位写入表</span>
            <span v-else style="color:var(--prin)">↺ 已在表中：直接查表</span>
          </td>
        </tr>
        <tr v-if="!log.length"><td :colspan="god ? 4 : 3" class="muted">还没有查询</td></tr>
      </table>
    </div>
    <div class="ctrl">
      <span style="font-size:13.5px">你的判断：</span>
      <button class="btn" :disabled="guessed !== null" @click="guess(0)">是 F<sub>k</sub></button>
      <button class="btn" :disabled="guessed !== null" @click="guess(1)">是真随机函数 f</button>
      <span v-if="guessed !== null" style="font-size:14px">答案：{{ world === 0 ? 'F_k' : '真随机函数' }} →
        <b :class="guessed === world ? 'ok-c' : 'bad-c'">{{ guessed === world ? '✓ 正确' : '✗ 错误' }}</b>（点“新一局”继续）</span>
    </div>
    <div class="stats">
      <div class="stat"><b>{{ score.w }} / {{ score.n }}</b><span>你的战绩</span></div>
      <div v-if="god && world === 1" class="stat"><b>{{ rf.table.size }}</b><span>惰性表中已采样的点数</span></div>
    </div>
    <div class="out prose">
      <span class="lbl">提示</span>{{ cur.tip }}
      <div style="margin-top:6px"><button class="btn" @click="autoRun">运行自动判别器 D（每个世界 2000 次）</button> <span class="muted" style="font-size:13px">{{ cur.D }}</span></div>
      <div v-if="auto" style="margin-top:6px">
        Pr[D<sup>F<sub>k</sub></sup> = 1] ≈ <b>{{ auto.p0.toFixed(3) }}</b>，Pr[D<sup>f</sup> = 1] ≈ <b>{{ auto.p1.toFixed(3) }}</b>，
        优势 |差| ≈ <b :class="Math.abs(auto.p0 - auto.p1) > .1 ? 'bad-c' : 'ok-c'">{{ Math.abs(auto.p0 - auto.p1).toFixed(3) }}</b>
      </div>
    </div>
  </Widget>
</template>

<style scoped>
.logbox { max-height: 230px; overflow: auto; border: 1px solid var(--line); border-radius: 8px; margin: 6px 0; }
.btn:disabled { opacity: .45; cursor: not-allowed; }
</style>
