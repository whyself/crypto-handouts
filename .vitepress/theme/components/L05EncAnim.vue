<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { toyF, randBits, bin } from '../lib/l05'

// 构造 3.30 逐步演示：Enc_k(m) = ⟨r, F_k(r) ⊕ m⟩，Dec_k(⟨r, s⟩) = F_k(r) ⊕ s
const N = 8
let k = 0 // 密钥在挂载后再随机生成，避免服务端渲染与客户端不一致
const mIn = ref('A')
const step = ref(0)
const r = ref(0)
const hist = ref<{ m: string; r: number; s: number }[]>([])
let timer: ReturnType<typeof setInterval> | null = null

const m = computed(() => (mIn.value.charCodeAt(0) || 0) & 0xff)
const pad = computed(() => toyF(k, r.value, N))
const s = computed(() => pad.value ^ m.value)
const bits = (v: number) => [...bin(v, N)]

const STEPS = [
  '准备：明文 m（这里取一个 ASCII 字符 = 8 位），密钥 k 已由 Gen 均匀选出并保密。',
  'Enc 第 1 步：<b>每次加密都重新</b>均匀选取 r ← {0,1}ⁿ。',
  'Enc 第 2 步：把 r 喂给 PRF，得到 pad = F<sub>k</sub>(r)——它“看起来”是均匀随机的 n 位串。',
  'Enc 第 3 步：s = F<sub>k</sub>(r) ⊕ m（逐位异或，和一次一密一样）。',
  'Enc 输出：c = ⟨r, s⟩。注意 r <b>明文发送</b>——安全性不依赖 r 保密，而依赖 F<sub>k</sub>(r) 不可预测。',
  'Dec：收到 ⟨r, s⟩，用同一把 k 重算 F<sub>k</sub>(r)，再算 F<sub>k</sub>(r) ⊕ s = m。正确性成立。'
]
function next() {
  if (step.value === 0) r.value = randBits(N)
  if (step.value < 5) step.value++
  if (step.value === 4) hist.value.unshift({ m: mIn.value.charAt(0), r: r.value, s: s.value })
}
function play() {
  stop()
  step.value = 0
  timer = setInterval(() => { next(); if (step.value >= 5) stop() }, 900)
}
function stop() { if (timer) { clearInterval(timer); timer = null } }
function again() { step.value = 0; next(); next(); next(); next() }
onMounted(() => { k = randBits(30); r.value = randBits(N) })
onBeforeUnmount(stop)
</script>

<template>
  <Widget title="构造 3.30 逐步演示：Enc<sub>k</sub>(m) = ⟨r, F<sub>k</sub>(r) ⊕ m⟩">
    <div class="ctrl">
      <label>明文字符 m = <input v-model="mIn" type="text" size="2" maxlength="1" @input="step = 0"></label>
      <button class="btn primary" @click="play">▶ 自动播放</button>
      <button class="btn" :disabled="step >= 5" @click="next">下一步</button>
      <button class="btn" @click="again">同一 m 再加密一次</button>
    </div>
    <div class="rows">
      <div class="row"><span class="lab">m</span><span v-for="(c, i) in bits(m)" :key="i" class="cell">{{ c }}</span></div>
      <div class="row" :style="{ opacity: step >= 1 ? 1 : .15 }"><span class="lab">r</span><span v-for="(c, i) in bits(r)" :key="i" class="cell mark">{{ c }}</span><span class="note">← 新鲜随机</span></div>
      <div class="row" :style="{ opacity: step >= 2 ? 1 : .15 }"><span class="lab">F<sub>k</sub>(r)</span><span v-for="(c, i) in bits(pad)" :key="i" class="cell">{{ c }}</span><span class="note">← PRF 输出作 pad</span></div>
      <div class="row" :style="{ opacity: step >= 3 ? 1 : .15 }"><span class="lab">s = ⊕</span><span v-for="(c, i) in bits(s)" :key="i" class="cell" :class="{ on: step === 3 }">{{ c }}</span></div>
      <div class="row" :style="{ opacity: step >= 4 ? 1 : .15 }"><span class="lab">c</span>
        <code class="ct">⟨{{ bin(r, N) }}, {{ bin(s, N) }}⟩</code></div>
      <div class="row" :style="{ opacity: step >= 5 ? 1 : .15 }"><span class="lab">Dec</span>
        <code class="ct">F<sub>k</sub>({{ bin(r, N) }}) ⊕ {{ bin(s, N) }} = {{ bin(pad ^ s, N) }} = “{{ String.fromCharCode(pad ^ s) }}” ✓</code></div>
    </div>
    <div class="out prose" v-html="STEPS[step]" />
    <div v-if="hist.length" style="margin-top:10px">
      <div class="widget-note" style="margin-bottom:4px">已产生的密文（同一明文多次加密，密文几乎总是不同 → <b>概率加密</b>）：</div>
      <table class="mini-table">
        <tr><th>m</th><th>r</th><th>s = F<sub>k</sub>(r) ⊕ m</th></tr>
        <tr v-for="(h, i) in hist.slice(0, 6)" :key="i"><td><code>{{ h.m }}</code></td><td><code>{{ bin(h.r, N) }}</code></td><td><code>{{ bin(h.s, N) }}</code></td></tr>
      </table>
    </div>
  </Widget>
</template>

<style scoped>
.rows { display: flex; flex-direction: column; gap: 6px; margin: 8px 0 12px; }
.row { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; transition: opacity .3s; }
.lab { width: 64px; font-size: 13px; color: var(--ink-2); font-weight: 600; }
.note { font-size: 12px; color: var(--ink-3); margin-left: 6px; }
.ct { font-size: 13.5px; }
.cell { width: 26px; height: 30px; }
.btn:disabled { opacity: .45; cursor: not-allowed; }
</style>
