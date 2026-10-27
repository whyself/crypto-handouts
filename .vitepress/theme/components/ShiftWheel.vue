<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { A, shift, freqs, FREQ } from '../lib/crypto'

// 移位密码转盘：外圈明文、内圈密文；内圈平滑转动，字母保持正向
const k = ref(3)
const cur = ref(3)
const pt = ref('see u tomorrow')
const ct = computed(() => shift(pt.value, k.value, true))

let raf = 0
watch(k, (to) => {
  const from = cur.value, t0 = performance.now()
  cancelAnimationFrame(raf)
  const f = (t: number) => {
    const p = Math.min(1, (t - t0) / 350)
    cur.value = from + (to - from) * (1 - Math.pow(1 - p, 3))
    if (p < 1) raf = requestAnimationFrame(f)
  }
  raf = requestAnimationFrame(f)
})

const pos = (i: number, r: number) => {
  const a = (i / 26) * 2 * Math.PI - Math.PI / 2
  return { x: 150 + r * Math.cos(a), y: 150 + r * Math.sin(a) + 5 }
}

// 暴力破解：试遍 26 个密钥，按与英文频率的吻合度 Σ p_i q_i 挑最像英文的
const bfCt = ref('VHHXWRPRUURZ')
const rows = ref<{ k: number; pt: string; s: number }[]>([])
const best = computed(() => rows.value.reduce((a, b) => (Math.abs(b.s - .065) < Math.abs(a.s - .065) ? b : a), rows.value[0]))
function bruteForce() {
  rows.value = Array.from({ length: 26 }, (_, k) => {
    const p = shift(bfCt.value, -k)
    const q = freqs(p)
    return { k, pt: p, s: FREQ.reduce((a, f, i) => a + f * q[i], 0) }
  })
}
</script>

<template>
  <Widget title="移位密码转盘 + 暴力破解">
    <div class="two-col" style="display:grid;grid-template-columns:240px minmax(0,1fr);gap:18px;align-items:start">
      <svg viewBox="0 0 300 300" style="width:100%;max-width:260px;margin:auto;display:block">
        <circle cx="150" cy="150" r="142" style="fill:var(--vp-c-bg);stroke:var(--line)" />
        <circle cx="150" cy="150" r="112" style="fill:var(--accent-soft);stroke:var(--accent)" />
        <circle cx="150" cy="150" r="82" style="fill:var(--paper);stroke:var(--line)" />
        <text v-for="(c, i) in A" :key="'o' + c" v-bind="pos(i, 127)" text-anchor="middle" font-size="14"
          :font-weight="i === 0 ? 700 : 400" :style="{ fill: i === 0 ? 'var(--accent)' : 'var(--ink)', fontFamily: 'var(--vp-font-family-mono)' }">{{ c }}</text>
        <text v-for="(c, i) in A" :key="'i' + c" v-bind="pos(i - cur, 97)" text-anchor="middle" font-size="14" font-weight="700"
          style="fill:var(--accent);font-family:var(--vp-font-family-mono)">{{ c.toUpperCase() }}</text>
        <path d="M143 2 l7 12 l7 -12 z" style="fill:var(--warn)" />
        <text x="150" y="146" text-anchor="middle" font-size="12" style="fill:var(--ink-3)">外圈 明文</text>
        <text x="150" y="164" text-anchor="middle" font-size="12" style="fill:var(--ink-3)">内圈 密文</text>
      </svg>
      <div>
        <div class="ctrl"><label>密钥 k = <b style="font-family:var(--vp-font-family-mono)">{{ k }}</b><input v-model.number="k" type="range" min="0" max="25"></label></div>
        <div class="ctrl">
          <button class="btn" @click="k = 3">凯撒 k=3</button>
          <button class="btn" @click="k = 13">ROT-13</button>
          <button class="btn" @click="k = 0">k=0</button>
        </div>
        <div class="ctrl"><label style="width:100%">明文<input v-model="pt" type="text" style="flex:1"></label></div>
        <div class="out"><span class="lbl">密文 c = (m + k) mod 26</span>{{ ct }}</div>
      </div>
    </div>
    <hr style="border:0;border-top:1px dashed var(--line);margin:18px 0 12px">
    <div class="ctrl">
      <label style="flex:1">截获的密文<input v-model="bfCt" type="text" style="flex:1"></label>
      <button class="btn primary" @click="bruteForce">穷举全部 26 个密钥</button>
    </div>
    <div v-if="rows.length" style="max-height:320px;overflow:auto;border:1px solid var(--line);border-radius:8px">
      <table class="mini-table">
        <thead><tr><th>k</th><th>候选明文 = 密文向前移 k 位</th><th>与英文频率的吻合度 Σpᵢqᵢ</th></tr></thead>
        <tbody>
          <tr v-for="r in rows" :key="r.k" :class="{ best: r === best }">
            <td>{{ r.k }}</td>
            <td style="font-family:var(--vp-font-family-mono)">{{ r.pt }}<span v-if="r === best"> ← 最像英文</span></td>
            <td style="font-family:var(--vp-font-family-mono)">{{ r.s.toFixed(4) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </Widget>
</template>
