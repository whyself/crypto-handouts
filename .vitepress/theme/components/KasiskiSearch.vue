<script setup lang="ts">
import { ref, computed } from 'vue'
import { gcd } from '../lib/crypto'

// Kasiski：找密文中重复出现的片段，距离的公约数给出密钥长度候选
const COLORS = ['#e8a33d', '#3cc7b6', '#8c96ff', '#f07b93', '#7fbf4d', '#c58cf0']
const ct = ref('ULE PSO ENG LII WREBR RHLSMEYWE XHH DFXTHJ GVOP LII PRKU SFIADI')
const minLen = ref(3)

const result = computed(() => {
  const raw = ct.value.toUpperCase(), s = raw.replace(/[^A-Z]/g, ''), L = minLen.value
  const found: Record<string, Set<number>> = {}
  for (let i = 0; i + L <= s.length; i++) {
    const sub = s.substr(i, L)
    for (let j = i + 1; j + L <= s.length; j++) if (s.substr(j, L) === sub) (found[sub] ||= new Set()).add(i).add(j)
  }
  const reps = Object.entries(found).map(([k, v]) => {
    const pos = [...v].sort((a, b) => a - b)
    return { k, pos, ds: pos.slice(1).map(p => p - pos[0]) }
  })
  const mark = new Array(s.length).fill(-1)
  reps.slice(0, COLORS.length).forEach((r, ci) => r.pos.forEach(p => { for (let t = 0; t < L; t++) mark[p + t] = ci }))
  // 按原文（含空格）逐字符着色
  let n = 0
  const chars = [...raw].map(ch => /[A-Z]/.test(ch) ? { ch, ci: mark[n++] } : { ch, ci: -1 })
  const g = reps.reduce((acc, r) => r.ds.reduce((a, d) => gcd(a, d), acc), 0)
  const divs: number[] = []
  for (let d = 2; d <= g; d++) if (g % d === 0) divs.push(d)
  return { reps, chars, g, divs }
})
</script>

<template>
  <Widget title="Kasiski 重复片段搜索">
    <div class="ctrl"><textarea v-model="ct" rows="2" /></div>
    <div class="ctrl">
      <label>最短片段长度
        <select v-model.number="minLen"><option :value="2">2</option><option :value="3">3</option><option :value="4">4</option></select>
      </label>
      <span class="muted" style="font-size:13px">可以粘贴自己的维吉尼亚密文</span>
    </div>
    <div class="out" style="line-height:2.1">
      <span v-for="(c, i) in result.chars" :key="i"
        :style="c.ci >= 0 ? { background: COLORS[c.ci], color: '#111', borderRadius: '3px', fontWeight: 700 } : {}">{{ c.ch }}</span>
    </div>
    <div style="margin-top:10px;font-size:14px">
      <template v-if="result.reps.length">
        <div style="border:1px solid var(--line);border-radius:8px;overflow:hidden;margin-bottom:8px">
          <table class="mini-table">
            <thead><tr><th>重复片段</th><th>出现位置（从 0 计，去空格）</th><th>距离</th></tr></thead>
            <tbody>
              <tr v-for="(r, ci) in result.reps" :key="r.k">
                <td><span :style="{ background: COLORS[ci % COLORS.length], color: '#111', padding: '0 4px', borderRadius: '3px', fontFamily: 'var(--vp-font-family-mono)' }">{{ r.k }}</span></td>
                <td style="font-family:var(--vp-font-family-mono)">{{ r.pos.join(', ') }}</td>
                <td style="font-family:var(--vp-font-family-mono)">{{ r.ds.join(', ') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        所有距离的最大公约数 = <b>{{ result.g }}</b> → 密钥长度候选：<b>{{ result.divs.join(', ') || '—' }}</b>
        <span class="muted">（课件示例的真实密钥 beads 长度为 5，是 30 的因子）</span>
      </template>
      <template v-else>没有找到长度 ≥ {{ minLen }} 的重复片段。</template>
    </div>
  </Widget>
</template>
