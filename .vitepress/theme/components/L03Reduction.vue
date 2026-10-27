<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue'

// 定理 3.2 的规约：区分器 A′ 把 EAV 敌手 A 当子程序，自己扮演挑战者
const world = ref<'prg' | 'rand'>('prg')
const step = ref(0)
const eps = ref(0.15)
let timer: ReturnType<typeof setInterval> | null = null
const playing = ref(false)

const STEPS = [
  { t: '0. A′ 收到挑战串 w', d: '外部的 PRG 挑战者给 A′ 一个 l(n) 位的串 w：要么 w = G(s)（s ← {0,1}ⁿ 均匀），要么 w = r（r ← {0,1}<sup>l(n)</sup> 均匀）。A′ 不知道是哪种。' },
  { t: '1. A 输出 m₀, m₁', d: 'A′ 以 1ⁿ 启动 A；A 输出两条等长消息 m₀, m₁，交给它以为的“挑战者”——其实是 A′。' },
  { t: '2. A′ 造挑战密文', d: 'A′ 自己均匀选 b ← {0,1}，计算 c := w ⊕ m<sub>b</sub> 交给 A。<b>A′ 并不知道 G 的种子，也不需要知道</b>：w 直接充当密钥流。' },
  { t: '3. A 输出 b′', d: 'A 按它的攻击策略输出猜测 b′。' },
  { t: '4. A′ 输出 [b′ = b]', d: '若 b′ = b（A 赢了）A′ 输出 1（“我猜 w 是伪随机的”），否则输出 0。' }
]

const worldText = computed(() => world.value === 'prg'
  ? '当 w = G(s)：A 看到的 c = G(s) ⊕ m<sub>b</sub>，s 均匀——与真实实验 PrivK<sup>eav</sup><sub>A,Π</sub>(n) 中 A 的视图<b>分布完全相同</b>。所以 Pr[A′(G(s)) = 1] = Pr[PrivK<sup>eav</sup><sub>A,Π</sub>(n) = 1] = 1/2 + ε(n)。'
  : '当 w = r：c = r ⊕ m<sub>b</sub> 正是一次性密码本 Π′ 的密文。OTP 完美保密 ⇒ 完美不可区分，A 的胜率恰为 1/2，所以 Pr[A′(r) = 1] = 1/2。')

function play() {
  if (playing.value) { stop(); return }
  step.value = 0; playing.value = true
  timer = setInterval(() => { if (step.value >= 4) stop(); else step.value++ }, 1300)
}
function stop() { playing.value = false; if (timer) { clearInterval(timer); timer = null } }
onBeforeUnmount(stop)

const on = (k: number) => step.value >= k
const cur = (k: number) => step.value === k
</script>

<template>
  <Widget title="规约证明的结构：用 A 造出 PRG 区分器 A′">
    <div class="ctrl">
      <div class="seg">
        <button :class="{ on: world === 'prg' }" @click="world = 'prg'">世界 0：w = G(s)</button>
        <button :class="{ on: world === 'rand' }" @click="world = 'rand'">世界 1：w = r（真随机）</button>
      </div>
      <button class="btn primary" @click="play">{{ playing ? '暂停' : '▶ 播放' }}</button>
      <button class="btn" :disabled="step <= 0" @click="step--">← 上一步</button>
      <button class="btn" :disabled="step >= 4" @click="step++">下一步 →</button>
    </div>
    <svg viewBox="0 0 720 270" style="width:100%;height:auto">
      <defs>
        <marker id="l03r-a" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" style="fill:var(--ink)" /></marker>
        <marker id="l03r-b" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" style="fill:var(--accent)" /></marker>
      </defs>
      <!-- 外部 PRG 挑战者 -->
      <rect x="10" y="80" width="130" height="90" rx="10" style="fill:var(--prin-bg);stroke:var(--prin)" />
      <text x="75" y="112" text-anchor="middle" font-size="13" font-weight="700" style="fill:var(--prin)">PRG 挑战者</text>
      <text x="75" y="134" text-anchor="middle" font-size="12" style="fill:var(--ink-2)">{{ world === 'prg' ? 's ← {0,1}ⁿ' : 'r ← {0,1}^l(n)' }}</text>
      <text x="75" y="154" text-anchor="middle" font-size="12" style="fill:var(--ink-2)">{{ world === 'prg' ? 'w := G(s)' : 'w := r' }}</text>
      <!-- A′ 大框 -->
      <rect x="190" y="20" width="510" height="230" rx="14" style="fill:var(--paper);stroke:var(--ink-2);stroke-width:1.5" />
      <text x="206" y="44" font-size="15" font-weight="700" style="fill:var(--ink)">规约 A′（PRG 区分器）</text>
      <!-- A 小框 -->
      <rect x="540" y="60" width="140" height="170" rx="10" style="fill:var(--warn-bg);stroke:var(--warn)" />
      <text x="610" y="100" text-anchor="middle" font-size="22" font-style="italic" font-weight="700" style="fill:var(--warn)">A</text>
      <text x="610" y="124" text-anchor="middle" font-size="11" style="fill:var(--ink-2)">EAV 敌手（黑盒）</text>
      <!-- 模拟挑战者 -->
      <rect x="250" y="70" width="190" height="150" rx="10" :style="{ fill: on(2) ? 'var(--accent-soft)' : 'var(--vp-c-bg)', stroke: 'var(--accent)' }" />
      <text x="345" y="92" text-anchor="middle" font-size="12" font-weight="700" style="fill:var(--accent)">A′ 模拟的挑战者</text>
      <text v-if="on(2)" x="345" y="120" text-anchor="middle" font-size="13" style="fill:var(--ink)">b ← {0,1}</text>
      <text v-if="on(2)" x="345" y="142" text-anchor="middle" font-size="13" style="fill:var(--ink)">c := w ⊕ m_b</text>
      <text v-if="on(4)" x="345" y="190" text-anchor="middle" font-size="13" font-weight="700" style="fill:var(--ex)">输出 1 ⇔ b′ = b</text>
      <!-- 箭头 -->
      <g :opacity="on(0) ? 1 : .15">
        <line x1="140" y1="125" x2="246" y2="125" style="stroke:var(--accent);stroke-width:2" marker-end="url(#l03r-b)" />
        <text x="193" y="118" text-anchor="middle" font-size="13" font-weight="700" style="fill:var(--accent)">w</text>
      </g>
      <g :opacity="on(1) ? 1 : .15">
        <line x1="538" y1="82" x2="444" y2="82" style="stroke:var(--ink)" marker-end="url(#l03r-a)" />
        <text x="490" y="76" text-anchor="middle" font-size="12" :font-weight="cur(1) ? 700 : 400" style="fill:var(--ink)">m₀, m₁</text>
      </g>
      <g :opacity="on(2) ? 1 : .15">
        <line x1="442" y1="140" x2="536" y2="140" style="stroke:var(--ink)" marker-end="url(#l03r-a)" />
        <text x="490" y="134" text-anchor="middle" font-size="12" :font-weight="cur(2) ? 700 : 400" style="fill:var(--ink)">c</text>
      </g>
      <g :opacity="on(3) ? 1 : .15">
        <line x1="538" y1="196" x2="444" y2="196" style="stroke:var(--ink)" marker-end="url(#l03r-a)" />
        <text x="490" y="190" text-anchor="middle" font-size="12" :font-weight="cur(3) ? 700 : 400" style="fill:var(--ink)">b′</text>
      </g>
      <g :opacity="on(4) ? 1 : .15">
        <line x1="250" y1="210" x2="150" y2="250" style="stroke:var(--ex);stroke-width:2" marker-end="url(#l03r-a)" />
        <text x="150" y="232" text-anchor="middle" font-size="12" font-weight="700" style="fill:var(--ex)">输出 0/1</text>
      </g>
    </svg>
    <div class="out prose"><b v-html="STEPS[step].t" />：<span v-html="STEPS[step].d" /></div>
    <div class="out prose" style="margin-top:8px" v-html="worldText" />
    <div class="ctrl">
      <label>设 A 在 Π 上的优势 ε(n) = <b>{{ eps.toFixed(2) }}</b><input v-model.number="eps" type="range" min="0" max="0.5" step="0.01"></label>
    </div>
    <div class="stats">
      <div class="stat"><b>{{ (0.5 + eps).toFixed(2) }}</b><span>Pr[A′(G(s)) = 1] = 1/2 + ε</span></div>
      <div class="stat"><b>0.50</b><span>Pr[A′(r) = 1] = 1/2</span></div>
      <div class="stat"><b :class="eps > 0 ? 'bad-c' : 'ok-c'">{{ eps.toFixed(2) }}</b><span>A′ 的区分优势 = ε（规约是“紧”的）</span></div>
    </div>
    <p class="widget-note" style="margin:0">A 若有不可忽略的优势 ε，A′ 就以同样不可忽略的优势区分 G(s) 与 r，与“G 是 PRG”矛盾。A′ 的开销只比 A 多一次异或和一次比较，仍是 PPT。</p>
  </Widget>
</template>
