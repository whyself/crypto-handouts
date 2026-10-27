<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { SCHEMES, parse, show, sampleKey, optimalAdv, frac, fix } from '../lib/l02'
import type { KeyEntry } from '../lib/l02'

// 不可区分游戏 PrivK^eav：读者当敌手，挑战者按所选方案加密 m_b
const IDS = ['shft1', 'shft2', 'vig12', 'vig2', 'otp4']
const sid = ref('vig12')
const S = computed(() => SCHEMES[sid.value])
const m0s = ref(S.value.defaults[0])
const m1s = ref(S.value.defaults[1])
watch(sid, () => { m0s.value = S.value.defaults[0]; m1s.value = S.value.defaults[1]; resetAll() })

const m0 = computed(() => parse(S.value, m0s.value))
const m1 = computed(() => parse(S.value, m1s.value))
const err = computed(() => {
  if (!m0.value || !m1.value) return S.value.alpha === 'bit' ? `消息必须是 ${S.value.len} 位 0/1 串` : `消息必须是 ${S.value.len} 个英文字母`
  return ''
})

// 游戏状态：0 选消息 → 1 等待猜测 → 2 揭晓
const step = ref(0)
const b = ref(0)
const key = ref<KeyEntry | null>(null)
const c = ref('')
const guess = ref(-1)
const hint = ref(false)
const n = ref(0), win = ref(0)

const opt = computed(() => (m0.value && m1.value ? optimalAdv(S.value, m0.value, m1.value) : null))
const post0 = computed(() => {
  if (!opt.value || !c.value) return 0.5
  const p0 = opt.value.d0.get(c.value) || 0, p1 = opt.value.d1.get(c.value) || 0
  return p0 / (p0 + p1)
})

function send() {
  if (err.value) return
  key.value = sampleKey(S.value)
  b.value = Math.random() < 0.5 ? 0 : 1
  c.value = show(S.value, S.value.enc(key.value.k, b.value ? m1.value! : m0.value!), true)
  guess.value = -1; hint.value = false
  step.value = 1
}
function answer(g: number) {
  if (step.value !== 1) return
  guess.value = g
  n.value++
  if (g === b.value) win.value++
  step.value = 2
}
function resetAll() { step.value = 0; n.value = 0; win.value = 0; c.value = ''; auto.value = null }

// 自动模式：最优敌手（看到 c 输出后验较大的 b）或随机猜，连玩 N 轮
const auto = ref<{ who: string; N: number; w: number } | null>(null)
function runAuto(who: 'opt' | 'rand') {
  if (err.value || !opt.value) return
  const { d0, d1 } = opt.value
  const N = 4000
  let w = 0
  for (let i = 0; i < N; i++) {
    const bb = Math.random() < 0.5 ? 0 : 1
    const kk = sampleKey(S.value)
    const cc = show(S.value, S.value.enc(kk.k, bb ? m1.value! : m0.value!), true)
    let g: number
    if (who === 'rand') g = Math.random() < 0.5 ? 0 : 1
    else {
      const p0 = d0.get(cc) || 0, p1 = d1.get(cc) || 0
      g = p0 > p1 ? 0 : p1 > p0 ? 1 : (Math.random() < 0.5 ? 0 : 1)
    }
    if (g === bb) w++
  }
  auto.value = { who: who === 'opt' ? '最优敌手' : '随机猜测', N, w }
}

const stepStyle = (i: number) => ({ stroke: step.value >= i ? 'var(--accent)' : 'var(--line)' })
const txtStyle = (i: number) => ({ fill: step.value >= i ? 'var(--accent)' : 'var(--ink-3)' })
</script>

<template>
  <Widget title="你来当敌手：不可区分游戏 PrivK<sup>eav</sup>">
    <p class="widget-note">选一个加密方案，自己挑两条消息 m₀、m₁ 交给挑战者；挑战者暗中抛硬币得到 b，把 m<sub>b</sub> 的密文给你，你来猜 b。多玩几轮看看胜率能否明显超过 50%。</p>
    <div class="ctrl">
      <div class="seg">
        <button v-for="id in IDS" :key="id" :class="{ on: sid === id }" @click="sid = id" v-html="SCHEMES[id].name" />
      </div>
    </div>
    <p class="widget-note" style="margin:0">{{ S.note }}</p>
    <div class="ctrl">
      <label>m₀ <input v-model="m0s" type="text" style="width:90px" :disabled="step === 1" @input="auto = null"></label>
      <label>m₁ <input v-model="m1s" type="text" style="width:90px" :disabled="step === 1" @input="auto = null"></label>
      <button class="btn primary" :disabled="!!err || step === 1" @click="send">① 发送给挑战者</button>
      <span v-if="err" class="bad-c" style="font-size:13px">{{ err }}</span>
    </div>

    <svg viewBox="0 0 720 230" style="width:100%;height:auto;display:block">
      <defs>
        <marker id="l02arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" style="fill:var(--ink-2)" />
        </marker>
      </defs>
      <rect x="10" y="20" width="170" height="190" rx="12" style="fill:var(--accent-soft);stroke:var(--accent)" />
      <text x="95" y="48" text-anchor="middle" font-size="15" font-weight="700" style="fill:var(--accent)">敌手 𝒜（你）</text>
      <text x="95" y="80" text-anchor="middle" font-size="13" style="fill:var(--ink-2)">选 m₀, m₁ ∈ ℳ</text>
      <text x="95" y="190" text-anchor="middle" font-size="13" style="fill:var(--ink-2)">根据 c 猜 b′</text>
      <rect x="540" y="20" width="170" height="190" rx="12" style="fill:var(--paper);stroke:var(--ink-3)" />
      <text x="625" y="48" text-anchor="middle" font-size="15" font-weight="700" style="fill:var(--ink)">挑战者</text>
      <text x="625" y="84" text-anchor="middle" font-size="13" style="fill:var(--ink-2)">k ← Gen</text>
      <text x="625" y="106" text-anchor="middle" font-size="13" style="fill:var(--ink-2)">b ← {0,1} 均匀</text>
      <text x="625" y="128" text-anchor="middle" font-size="13" style="fill:var(--ink-2)">c ← Enc<tspan font-size="10" dy="4">k</tspan><tspan dy="-4">(m</tspan><tspan font-size="10" dy="4">b</tspan><tspan dy="-4">)</tspan></text>
      <text x="625" y="160" text-anchor="middle" font-size="12.5" style="fill:var(--ink-3)">{{ step === 2 && key ? `${key.label}，b=${b}` : 'k、b 对你保密' }}</text>
      <line x1="185" y1="72" x2="535" y2="72" stroke-width="2" :style="stepStyle(1)" marker-end="url(#l02arr)" />
      <text x="360" y="62" text-anchor="middle" font-size="13" :style="txtStyle(1)">① m₀ = {{ m0s }}，m₁ = {{ m1s }}</text>
      <line x1="535" y1="128" x2="185" y2="128" stroke-width="2" :style="stepStyle(1)" marker-end="url(#l02arr)" />
      <text x="360" y="118" text-anchor="middle" font-size="13" :style="txtStyle(1)">② 挑战密文 c = {{ step >= 1 ? c : '?' }}</text>
      <line x1="185" y1="184" x2="535" y2="184" stroke-width="2" :style="stepStyle(2)" marker-end="url(#l02arr)" />
      <text x="360" y="174" text-anchor="middle" font-size="13" :style="txtStyle(2)">③ b′ = {{ guess >= 0 ? guess : '?' }}</text>
      <text v-if="step === 2" x="360" y="222" text-anchor="middle" font-size="14" font-weight="700"
        :style="{ fill: guess === b ? 'var(--ex)' : 'var(--warn)' }">{{ guess === b ? '✓ b′ = b，PrivK = 1（你赢了）' : '✗ b′ ≠ b，PrivK = 0' }}</text>
    </svg>

    <div class="ctrl">
      <button class="btn" :disabled="step !== 1" @click="answer(0)">猜 b′ = 0（是 m₀）</button>
      <button class="btn" :disabled="step !== 1" @click="answer(1)">猜 b′ = 1（是 m₁）</button>
      <button class="btn" :disabled="step === 0" @click="hint = !hint">{{ hint ? '收起提示' : '提示：后验概率' }}</button>
      <button class="btn" @click="send" :disabled="step !== 2 || !!err">再来一轮</button>
      <button class="btn" @click="resetAll">清零</button>
    </div>
    <div v-if="hint && step >= 1" class="out prose">
      看到 c = <b>{{ c }}</b> 后：Pr[b=0 | c] = {{ fix(post0) }}，Pr[b=1 | c] = {{ fix(1 - post0) }}。
      {{ Math.abs(post0 - 0.5) < 1e-9 ? '两者相等——密文对你毫无帮助，只能瞎猜。' : `应该猜 b′ = ${post0 > 0.5 ? 0 : 1}。` }}
    </div>
    <div class="stats">
      <div class="stat"><b>{{ n }}</b><span>已玩轮数</span></div>
      <div class="stat"><b>{{ win }}</b><span>猜对次数</span></div>
      <div class="stat"><b>{{ n ? (100 * win / n).toFixed(1) + '%' : '—' }}</b><span>你的胜率</span></div>
    </div>

    <hr style="border:0;border-top:1px dashed var(--line);margin:14px 0 10px">
    <div class="ctrl">
      <button class="btn primary" :disabled="!!err" @click="runAuto('opt')">让最优敌手玩 4000 轮</button>
      <button class="btn" :disabled="!!err" @click="runAuto('rand')">让随机猜测玩 4000 轮</button>
    </div>
    <div class="stats" v-if="opt">
      <div class="stat"><b>{{ fix(opt.rate) }}</b><span>理论最优胜率 ½ + ¼Σ|p₀−p₁|</span></div>
      <div class="stat" v-if="auto"><b>{{ (auto.w / auto.N).toFixed(3) }}</b><span>{{ auto.who }}：{{ auto.w }}/{{ auto.N }}</span></div>
    </div>
    <div class="out prose" v-if="opt">
      <template v-if="Math.abs(opt.rate - 0.5) < 1e-9">对这一对消息，任何敌手的胜率都恰为 <b>1/2</b>：两条消息的密文分布完全相同（p₀ ≡ p₁）。换别的 m₀、m₁ 也一样——这就是<b class="ok-c">完美不可区分</b>。</template>
      <template v-else>这一对消息的密文分布不同，最优敌手胜率 = <b>{{ frac(opt.rate) }}</b> &gt; 1/2，所以该方案<b class="bad-c">不是完美不可区分</b>的（只需找到一个敌手就够了）。</template>
    </div>
    <p class="widget-note" style="margin:8px 0 0">试试：Π<sub>shft2</sub> 选 aab 与 abc；维吉尼亚 t∈{1,2} 选 aa 与 ab（课件 P69–77 的敌手，理论胜率 3/4）；再换成“周期固定 2”或 OTP，怎么选都是 1/2。</p>
  </Widget>
</template>
