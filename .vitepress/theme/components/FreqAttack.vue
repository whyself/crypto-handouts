<script setup lang="ts">
import { ref, computed } from 'vue'
import { A, FREQ, idx, freqs, PARA } from '../lib/crypto'

// 单表替换 + 频率分析：把“密文频率排名”直接对上“英文频率排名”作首轮猜测
const pt = ref(PARA)
const perm = ref('XEUADNBKVMROCQFSYHWGLZIJPT') // 课件 P69 的置换

function randomPerm() {
  const a = [...A.toUpperCase()]
  for (let i = 25; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  perm.value = a.join('')
}

const ct = computed(() => pt.value.toLowerCase().replace(/[a-z]/g, ch => perm.value[idx(ch)]))
const inv = computed(() => Object.fromEntries([...perm.value].map((c, i) => [c, A[i]])))
const engRank = computed(() => [...A].map((c, i) => ({ c, f: FREQ[i] })).sort((a, b) => b.f - a.f))
const ctRank = computed(() => {
  const q = freqs(ct.value)
  return [...A].map((c, i) => ({ c: c.toUpperCase(), f: q[i] })).sort((a, b) => b.f - a.f)
    .map((r, i) => ({ ...r, ok: inv.value[r.c] === engRank.value[i].c }))
})
const guess = computed(() => {
  const g: Record<string, string> = {}
  ctRank.value.forEach((r, i) => { g[r.c] = engRank.value[i].c })
  return [...ct.value].map(ch => /[A-Z]/.test(ch) ? { t: g[ch], ok: g[ch] === inv.value[ch] } : { t: ch, ok: null })
})
const total = computed(() => guess.value.filter(g => g.ok !== null).length)
const good = computed(() => guess.value.filter(g => g.ok).length)
const hitLetters = computed(() => ctRank.value.filter(r => r.f > 0 && r.ok).length)

const xOf = (i: number) => 8 + i * 27
const h = (f: number) => f / .14 * 60
</script>

<template>
  <Widget title="单表替换 + 频率分析攻击">
    <p class="widget-note">① 用置换加密一段英文；② 敌手只看密文，把“密文频率排名”直接对上“英文频率排名”猜映射。绿色 = 猜对的字母。</p>
    <div class="ctrl"><textarea v-model="pt" rows="4" /></div>
    <div class="ctrl">
      <button class="btn" @click="randomPerm">🎲 换一个随机置换</button>
      <span class="muted" style="font-size:13px">（可以粘贴更长/更短的文本试试，结果实时更新）</span>
    </div>
    <div class="out" style="max-height:110px;overflow:auto"><span class="lbl">密文</span>{{ ct }}</div>
    <svg viewBox="0 0 720 190" style="width:100%;height:auto;margin:10px 0">
      <text x="8" y="12" font-size="11" style="fill:var(--ink-3)">英文标准频率（降序）</text>
      <text x="8" y="186" font-size="11" style="fill:var(--ink-3)">密文频率（降序）→ 同名次对应即为猜测</text>
      <g v-for="(r, i) in engRank" :key="'e' + r.c">
        <rect :x="xOf(i)" :y="78 - h(r.f)" width="22" :height="h(r.f)" rx="2" style="fill:var(--accent)" opacity=".75" />
        <text :x="xOf(i) + 11" y="92" font-size="12" text-anchor="middle" style="fill:var(--ink);font-family:var(--vp-font-family-mono)">{{ r.c }}</text>
      </g>
      <g v-for="(r, i) in ctRank" :key="'c' + r.c">
        <text :x="xOf(i) + 11" y="110" font-size="12" text-anchor="middle" font-weight="700"
          :style="{ fill: r.ok ? 'var(--ex)' : 'var(--warn)', fontFamily: 'var(--vp-font-family-mono)' }">{{ r.c }}</text>
        <rect :x="xOf(i)" y="116" width="22" :height="h(r.f)" rx="2" :style="{ fill: r.ok ? 'var(--ex)' : 'var(--ink-3)' }" opacity=".75" />
      </g>
    </svg>
    <div class="stats">
      <div class="stat"><b>{{ (good / Math.max(total, 1) * 100).toFixed(0) }}%</b><span>字符被直接猜对</span></div>
      <div class="stat"><b>{{ hitLetters }}</b><span>个字母映射排名完全命中</span></div>
      <div class="stat"><b>{{ total }}</b><span>密文字母数</span></div>
    </div>
    <div class="out" style="max-height:130px;overflow:auto;font-size:14px">
      <span class="lbl">仅凭频率排名的首轮猜测（再结合常见单词就能逐步修正）</span>
      <span v-for="(g, i) in guess" :key="i" :style="g.ok ? 'color:var(--ex);font-weight:700' : g.ok === false ? 'color:var(--ink-3)' : ''">{{ g.t }}</span>
    </div>
  </Widget>
</template>
