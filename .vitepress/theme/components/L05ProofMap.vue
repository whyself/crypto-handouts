<script setup lang="ts">
import { ref, computed } from 'vue'
import { randBits, randBit, LazyRandomFunction } from '../lib/l05'

// 定理 3.31 证明结构：Π（用 F_k）→ Π̃（用真随机 f）→ 分析 Π̃
// 上半部分：规约 D 的框图逐步点亮；下半部分：在 Π̃ 中模拟“撞 r”敌手
const step = ref(0)
const oracle = ref<'F' | 'f'>('F')
const STEPS = [
  { t: '目标', d: '要证：对任意 PPT 敌手 A，Pr[PrivK<sup>cpa</sup><sub>A,Π</sub>(n) = 1] ≤ 1/2 + negl(n)。思路：先把 F<sub>k</sub> 换成真随机函数 f（得到 Π̃），再分析 Π̃。', hl: ['chain'] },
  { t: '构造 D', d: '用 A 构造一个 PRF 区分器 D。D 只能通过<b>预言机 O</b> 计算 O(·)，它<b>不知道</b> k，也不知道 O 到底是 F<sub>k</sub> 还是 f。D 在内部运行 A，并扮演 A 的挑战者。', hl: ['D', 'A', 'sim', 'O'] },
  { t: '回答加密查询', d: 'A 每次询问 Enc(m)：D 均匀选 r ← {0,1}ⁿ，向 O 查询得 y = O(r)，回给 A 密文 ⟨r, y ⊕ m⟩。', hl: ['q', 'sim', 'o'] },
  { t: '生成挑战', d: 'A 输出 m₀, m₁：D 自己抛 b ← {0,1}，选 r* ← {0,1}ⁿ，查询 y* = O(r*)，回给 A 挑战密文 c* = ⟨r*, y* ⊕ m_b⟩。之后照旧回答查询。', hl: ['c', 'sim', 'o'] },
  { t: '输出', d: 'A 输出 b′。若 b′ = b，D 输出 1，否则输出 0。D 的运行时间 = A 的时间 + 多项式开销，所以 D 是 PPT。', hl: ['out'] },
  { t: 'O = F<sub>k</sub>', d: 'A 看到的一切与它在 PrivK<sup>cpa</sup><sub>A,Π</sub> 中看到的<b>分布完全相同</b>，故 Pr[D<sup>F<sub>k</sub></sup>(1ⁿ) = 1] = Pr[PrivK<sup>cpa</sup><sub>A,Π</sub>(n) = 1]。', hl: ['O', 'chain0'], o: 'F' },
  { t: 'O = f', d: '同理 A 看到的是 PrivK<sup>cpa</sup><sub>A,Π̃</sub> 的视图，故 Pr[D<sup>f</sup>(1ⁿ) = 1] = Pr[PrivK<sup>cpa</sup><sub>A,Π̃</sub>(n) = 1]。', hl: ['O', 'chain1'], o: 'f' },
  { t: '用 PRF 定义', d: 'F 是 PRF ⇒ |Pr[D<sup>F<sub>k</sub></sup> = 1] − Pr[D<sup>f</sup> = 1]| ≤ negl(n)，代入两式即得 |Pr[PrivK<sub>A,Π</sub> = 1] − Pr[PrivK<sub>A,Π̃</sub> = 1]| ≤ negl(n)。', hl: ['chain01'] },
  { t: '分析 Π̃', d: '设 Repeat = “r* 与某次查询所用的 r 相同”。不发生 Repeat 时 f(r*) 从未被 A 间接看过，是均匀且独立于 A 视图的，c* 的第二部分等于一次一密，A 只能瞎猜（1/2）；Pr[Repeat] ≤ q(n)/2ⁿ（联合界）。故 Pr[PrivK<sub>A,Π̃</sub> = 1] ≤ 1/2 + q(n)/2ⁿ。', hl: ['chain12'] },
  { t: '合并', d: 'Pr[PrivK<sup>cpa</sup><sub>A,Π</sub> = 1] ≤ 1/2 + q(n)/2ⁿ + negl(n)。q 是多项式，q(n)/2ⁿ 可忽略，两个可忽略函数之和仍可忽略 ⇒ Π 是 CPA 安全的。∎', hl: ['chain', 'chain01', 'chain12'] }
]
const cur = computed(() => STEPS[step.value])
const on = (k: string) => cur.value.hl.includes(k)
function go(i: number) {
  step.value = Math.max(0, Math.min(STEPS.length - 1, i))
  const o = STEPS[step.value].o
  if (o) oracle.value = o as 'F' | 'f'
}
const box = (k: string) => ({ stroke: on(k) ? 'var(--accent)' : 'var(--line)', strokeWidth: on(k) ? 2.2 : 1.2 })
const arrow = (k: string) => ({ stroke: on(k) ? 'var(--accent)' : 'var(--ink-3)', strokeWidth: on(k) ? 2 : 1 })

// —— 撞 r 敌手的模拟 ——
const n = ref(6)
const q = ref(16)
const sim = ref<{ emp: number; T: number } | null>(null)
const exact = computed(() => 0.5 + 0.5 * (1 - Math.pow(1 - 2 ** -n.value, q.value)))
const bound = computed(() => Math.min(1, 0.5 + q.value / 2 ** n.value))
function runSim() {
  const T = 4000, N = n.value
  let w = 0
  for (let t = 0; t < T; t++) {
    const f = new LazyRandomFunction(N)
    const b = randBit()
    const m0 = 0, m1 = 2 ** N - 1
    // 敌手：用 m0 查询 q 次，记下 (r_i, s_i)
    const seen = new Map<number, number>()
    for (let i = 0; i < q.value; i++) { const r = randBits(N); seen.set(r, f.query(r).y ^ m0) }
    const rs = randBits(N)
    const ss = f.query(rs).y ^ (b ? m1 : m0)
    let g: number
    if (seen.has(rs)) g = ss === seen.get(rs) ? 0 : 1 // 撞上 r*：s* 与 s_i 相同说明加密的是 m0
    else g = randBit()
    if (g === b) w++
  }
  sim.value = { emp: w / T, T }
}
const bar = (v: number) => `${Math.min(100, v * 100)}%`
</script>

<template>
  <Widget title="定理 3.31 证明地图：规约 + “撞 r”分析">
    <div class="ctrl">
      <button class="btn" :disabled="step === 0" @click="go(step - 1)">← 上一步</button>
      <button class="btn primary" :disabled="step === STEPS.length - 1" @click="go(step + 1)">下一步 →</button>
      <span style="font-size:13px;color:var(--ink-3)">第 {{ step + 1 }} / {{ STEPS.length }} 步：<b style="color:var(--accent)" v-html="cur.t" /></span>
      <div class="seg" style="margin-left:auto">
        <button :class="{ on: oracle === 'F' }" @click="oracle = 'F'">O = F<sub>k</sub></button>
        <button :class="{ on: oracle === 'f' }" @click="oracle = 'f'">O = f</button>
      </div>
    </div>
    <svg viewBox="0 0 720 330" style="width:100%;height:auto;display:block">
      <defs>
        <marker id="l05pm-a" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" style="fill:var(--ink-3)" /></marker>
      </defs>
      <!-- 顶部：三段链 -->
      <g>
        <rect x="20" y="10" width="190" height="40" rx="8" :style="{ fill: on('chain0') || on('chain01') ? 'var(--accent-soft)' : 'var(--vp-c-bg)', ...box('chain') }" />
        <text x="115" y="35" text-anchor="middle" font-size="13" style="fill:var(--ink)">Pr[PrivK_A,Π = 1]（用 F_k）</text>
        <rect x="265" y="10" width="190" height="40" rx="8" :style="{ fill: on('chain1') || on('chain01') || on('chain12') ? 'var(--accent-soft)' : 'var(--vp-c-bg)', ...box('chain') }" />
        <text x="360" y="35" text-anchor="middle" font-size="13" style="fill:var(--ink)">Pr[PrivK_A,Π̃ = 1]（用 f）</text>
        <rect x="510" y="10" width="190" height="40" rx="8" :style="{ fill: on('chain12') ? 'var(--accent-soft)' : 'var(--vp-c-bg)', ...box('chain') }" />
        <text x="605" y="35" text-anchor="middle" font-size="13" style="fill:var(--ink)">1/2 + q(n)/2ⁿ</text>
        <text x="237" y="27" text-anchor="middle" font-size="12" font-weight="700" :style="{ fill: on('chain01') ? 'var(--accent)' : 'var(--ink-3)' }">±negl</text>
        <text x="237" y="44" text-anchor="middle" font-size="10" style="fill:var(--ink-3)">PRF</text>
        <text x="482" y="27" text-anchor="middle" font-size="14" font-weight="700" :style="{ fill: on('chain12') ? 'var(--accent)' : 'var(--ink-3)' }">≤</text>
        <text x="482" y="44" text-anchor="middle" font-size="10" style="fill:var(--ink-3)">Repeat</text>
      </g>
      <!-- 区分器 D -->
      <rect x="20" y="75" width="520" height="240" rx="12" :style="{ fill: on('D') ? 'var(--ex-bg)' : 'transparent', ...box('D') }" stroke-dasharray="6 4" />
      <text x="34" y="97" font-size="14" font-weight="700" style="fill:var(--ex)">区分器 D（不知道 k）</text>
      <rect x="40" y="120" width="150" height="160" rx="10" :style="{ fill: 'var(--warn-bg)', ...box('A') }" />
      <text x="115" y="190" text-anchor="middle" font-size="15" font-weight="700" style="fill:var(--warn)">CPA 敌手 A</text>
      <text x="115" y="212" text-anchor="middle" font-size="11.5" style="fill:var(--ink-2)">（当作黑盒调用）</text>
      <rect x="310" y="120" width="210" height="160" rx="10" :style="{ fill: 'var(--paper)', ...box('sim') }" />
      <text x="415" y="143" text-anchor="middle" font-size="13.5" font-weight="700" style="fill:var(--ink)">D 模拟的挑战者</text>
      <text x="415" y="168" text-anchor="middle" font-size="12" style="fill:var(--ink-2)">r ← {0,1}ⁿ，y := O(r)</text>
      <text x="415" y="188" text-anchor="middle" font-size="12" style="fill:var(--ink-2)">回答 ⟨r, y ⊕ m⟩</text>
      <text x="415" y="214" text-anchor="middle" font-size="12" style="fill:var(--ink-2)">b ← {0,1}，r* ← {0,1}ⁿ</text>
      <text x="415" y="234" text-anchor="middle" font-size="12" style="fill:var(--ink-2)">c* := ⟨r*, O(r*) ⊕ m_b⟩</text>
      <text x="415" y="262" text-anchor="middle" font-size="12" :style="{ fill: on('out') ? 'var(--accent)' : 'var(--ink-2)', fontWeight: on('out') ? 700 : 400 }">b′ = b ? 输出 1 : 输出 0</text>
      <!-- A ↔ 模拟挑战者 -->
      <line x1="192" y1="140" x2="306" y2="140" :style="arrow('q')" marker-end="url(#l05pm-a)" />
      <text x="249" y="134" text-anchor="middle" font-size="11.5" :style="{ fill: on('q') ? 'var(--accent)' : 'var(--ink-3)' }">查询 m</text>
      <line x1="306" y1="165" x2="192" y2="165" :style="arrow('q')" marker-end="url(#l05pm-a)" />
      <text x="249" y="181" text-anchor="middle" font-size="11.5" :style="{ fill: on('q') ? 'var(--accent)' : 'var(--ink-3)' }">⟨r, y ⊕ m⟩</text>
      <line x1="192" y1="215" x2="306" y2="215" :style="arrow('c')" marker-end="url(#l05pm-a)" />
      <text x="249" y="209" text-anchor="middle" font-size="11.5" :style="{ fill: on('c') ? 'var(--accent)' : 'var(--ink-3)' }">m₀, m₁</text>
      <line x1="306" y1="240" x2="192" y2="240" :style="arrow('c')" marker-end="url(#l05pm-a)" />
      <text x="249" y="256" text-anchor="middle" font-size="11.5" :style="{ fill: on('c') ? 'var(--accent)' : 'var(--ink-3)' }">c*</text>
      <line x1="192" y1="270" x2="306" y2="270" :style="arrow('out')" marker-end="url(#l05pm-a)" />
      <text x="249" y="290" text-anchor="middle" font-size="11.5" :style="{ fill: on('out') ? 'var(--accent)' : 'var(--ink-3)' }">b′</text>
      <!-- 预言机 O -->
      <rect x="590" y="140" width="110" height="110" rx="10" :style="{ fill: oracle === 'F' ? 'var(--prin-bg)' : 'var(--ex-bg)', ...box('O') }" />
      <text x="645" y="180" text-anchor="middle" font-size="13" font-weight="700" style="fill:var(--ink)">预言机 O</text>
      <text x="645" y="208" text-anchor="middle" font-size="16" font-weight="700" :style="{ fill: oracle === 'F' ? 'var(--prin)' : 'var(--ex)' }">{{ oracle === 'F' ? 'F_k(·)' : 'f(·)' }}</text>
      <text x="645" y="230" text-anchor="middle" font-size="11" style="fill:var(--ink-3)">{{ oracle === 'F' ? 'k 均匀随机' : 'f ∈ Funcₙ 均匀' }}</text>
      <line x1="522" y1="175" x2="586" y2="175" :style="arrow('o')" marker-end="url(#l05pm-a)" />
      <text x="555" y="169" text-anchor="middle" font-size="11.5" :style="{ fill: on('o') ? 'var(--accent)' : 'var(--ink-3)' }">r</text>
      <line x1="586" y1="215" x2="522" y2="215" :style="arrow('o')" marker-end="url(#l05pm-a)" />
      <text x="555" y="231" text-anchor="middle" font-size="11.5" :style="{ fill: on('o') ? 'var(--accent)' : 'var(--ink-3)' }">y</text>
    </svg>
    <div class="out prose" v-html="cur.d" />

    <h4 class="h4">在 Π̃ 中检验 q(n)/2ⁿ：“撞 r”敌手</h4>
    <p class="widget-note">敌手策略：先用 m₀ 查询 q 次，记下所有 (rᵢ, sᵢ)；提交 m₀ ≠ m₁；若挑战的 r* 恰好等于某个 rᵢ，就比较 s* 与 sᵢ 精确判断 b，否则瞎猜。这是针对 Π̃ 最自然的攻击，其获胜率恰为 1/2 + ½·Pr[Repeat]。</p>
    <div class="ctrl">
      <label>n = <b>{{ n }}</b><input v-model.number="n" type="range" min="3" max="16" @input="sim = null"></label>
      <label>q = <b>{{ q }}</b><input v-model.number="q" type="range" min="1" max="128" @input="sim = null"></label>
      <button class="btn" @click="runSim">模拟 4000 次</button>
    </div>
    <div class="bars">
      <div class="brow"><span>精确获胜率 ½ + ½·(1 − (1 − 2⁻ⁿ)^q)</span><div class="track"><div class="fill" :style="{ width: bar(exact), background: 'var(--prin)' }" /></div><b>{{ exact.toFixed(4) }}</b></div>
      <div class="brow"><span>模拟结果</span><div class="track"><div class="fill" :style="{ width: sim ? bar(sim.emp) : '0%', background: 'var(--ex)' }" /></div><b>{{ sim ? sim.emp.toFixed(4) : '—' }}</b></div>
      <div class="brow"><span>课件上界 ½ + q/2ⁿ</span><div class="track"><div class="fill" :style="{ width: bar(bound), background: 'var(--warn)' }" /></div><b>{{ (0.5 + q / 2 ** n).toFixed(4) }}</b></div>
    </div>
    <p class="widget-note" style="margin:0">把 n 拉大：即便 q = 128，优势也迅速趋于 0——这就是“q(n) 多项式、2ⁿ 指数 ⇒ q(n)/2ⁿ 可忽略”。</p>
  </Widget>
</template>

<style scoped>
.h4 { margin: 18px 0 6px; font-size: 15px; }
.bars { display: flex; flex-direction: column; gap: 6px; margin: 8px 0; }
.brow { display: grid; grid-template-columns: 240px minmax(0, 1fr) 64px; gap: 10px; align-items: center; font-size: 13px; color: var(--ink-2); }
.brow b { font-variant-numeric: tabular-nums; text-align: right; }
.track { height: 14px; background: var(--line-2); border-radius: 7px; overflow: hidden; position: relative; }
.track::after { content: ""; position: absolute; left: 50%; top: 0; bottom: 0; border-left: 1px dashed var(--ink-3); }
.fill { height: 100%; border-radius: 7px; transition: width .3s; }
.btn:disabled { opacity: .45; cursor: not-allowed; }
@media (max-width: 640px) { .brow { grid-template-columns: 1fr; } }
</style>
