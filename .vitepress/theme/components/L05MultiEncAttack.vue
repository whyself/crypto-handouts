<script setup lang="ts">
import { ref, computed } from 'vue'
import { toyF, randBits, randBit, hex } from '../lib/l05'

// PrivK^mult 实验：确定性方案（PRG 一次填充）vs 随机化方案（构造 3.30）
// 敌手固定策略：M0 = (cat, cat)，M1 = (cat, dog)；若 c1 = c2 则猜 b' = 0，否则猜 1
const scheme = ref<'det' | 'rand'>('det')
const N = 24 // 3 个 ASCII 字符 = 24 位

const enc = (s: string) => [...s].reduce((a, ch) => (a << 8) | ch.charCodeAt(0), 0)
const M0 = ['cat', 'cat'], M1 = ['cat', 'dog']

interface Round { b: number; c: string[]; guess: number; win: boolean }
const last = ref<Round | null>(null)
const stats = ref({ n: 0, w: 0 })

function encrypt(k: number, m: string) {
  if (scheme.value === 'det') {
    const pad = toyF(k, 0, N) // 由同一密钥派生的同一个 pad
    return hex(pad ^ enc(m), N)
  }
  const r = randBits(N)
  return `⟨${hex(r, N)}, ${hex(toyF(k, r, N) ^ enc(m), N)}⟩`
}

function round(): Round {
  const k = randBits(30), b = randBit()
  const M = b === 0 ? M0 : M1
  const c = M.map(m => encrypt(k, m))
  const guess = c[0] === c[1] ? 0 : 1
  return { b, c, guess, win: guess === b }
}
function once() {
  const r = round()
  last.value = r
  stats.value.n++; if (r.win) stats.value.w++
}
function many(t: number) {
  let w = 0
  for (let i = 0; i < t; i++) if (round().win) w++
  stats.value.n += t; stats.value.w += w
  last.value = round()
}
function pick(v: 'det' | 'rand') { scheme.value = v; stats.value = { n: 0, w: 0 }; last.value = null }
const rate = computed(() => (stats.value.n ? stats.value.w / stats.value.n : 0))
</script>

<template>
  <Widget title="多次加密实验 PrivK<sup>mult</sup>：确定性加密必然被攻破">
    <p class="widget-note">敌手提交 <b>M</b><sub>0</sub> = (cat, cat)，<b>M</b><sub>1</sub> = (cat, dog)。挑战者用<b>同一把密钥</b>加密 <b>M</b><sub>b</sub> 的两条消息。敌手的策略只有一行：<b>两条密文相同就猜 0，不同就猜 1</b>。切换方案，看这招灵不灵。</p>
    <div class="ctrl">
      <div class="seg">
        <button :class="{ on: scheme === 'det' }" @click="pick('det')">PRG 一次填充：c = G(k) ⊕ m（确定性）</button>
        <button :class="{ on: scheme === 'rand' }" @click="pick('rand')">构造 3.30：c = ⟨r, F<sub>k</sub>(r) ⊕ m⟩（随机化）</button>
      </div>
    </div>
    <div class="ctrl">
      <button class="btn primary" @click="once">▶ 跑一轮</button>
      <button class="btn" @click="many(1000)">连跑 1000 轮</button>
    </div>
    <div v-if="last" class="out prose">
      <div>挑战者秘密选择 b = <b>{{ last.b }}</b>，加密 ({{ (last.b ? M1 : M0).join(', ') }})</div>
      <div style="font-family:var(--vp-font-family-mono);font-size:13.5px">c<sub>1</sub> = {{ last.c[0] }}<br>c<sub>2</sub> = {{ last.c[1] }}</div>
      <div>敌手：c<sub>1</sub> {{ last.c[0] === last.c[1] ? '=' : '≠' }} c<sub>2</sub> → 猜 b′ = <b>{{ last.guess }}</b>
        <b :class="last.win ? 'ok-c' : 'bad-c'">{{ last.win ? '✓ 猜对' : '✗ 猜错' }}</b></div>
    </div>
    <div class="stats">
      <div class="stat"><b>{{ stats.n }}</b><span>总轮数</span></div>
      <div class="stat"><b :class="rate > .9 ? 'bad-c' : ''">{{ (rate * 100).toFixed(1) }}%</b><span>敌手获胜率</span></div>
      <div class="stat"><b>{{ scheme === 'det' ? '1' : '1/2' }}</b><span>理论值</span></div>
    </div>
    <p class="widget-note" style="margin:0">
      <template v-if="scheme === 'det'">确定性加密：同一明文在同一密钥下永远得到同一密文，“两条消息是否相同”这一信息被原样泄露 → 获胜率 100%。</template>
      <template v-else>随机化加密：每次加密都用新的随机 r，即使明文相同密文也（以压倒性概率）不同，敌手只能瞎猜 → 获胜率约 50%。</template>
    </p>
  </Widget>
</template>
