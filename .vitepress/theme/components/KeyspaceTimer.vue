<script setup lang="ts">
import { ref, computed } from 'vue'

// 穷举攻击计时器：时间 = 2^bits / (2^speed × 10^machines) 秒
const PRESETS = [
  { name: '移位 26', bits: 4.7 },
  { name: '单表 26!≈2⁸⁸', bits: 88.4 },
  { name: 'DES 2⁵⁶', bits: 56 },
  { name: 'AES-128', bits: 128 }
]
const bits = ref(88.4)
const speed = ref(32)
const machines = ref(0)

const YEAR = 31557600
const log2sec = computed(() => bits.value - speed.value - machines.value * Math.log2(10))
const sec = computed(() => Math.pow(2, log2sec.value))

const timeText = computed(() => {
  const s = sec.value, y = s / YEAR
  if (s < 1) return '< 1 秒'
  if (s < 3600) return s.toFixed(1) + ' 秒'
  if (s < 86400 * 2) return (s / 3600).toFixed(1) + ' 小时'
  if (y < 1) return (s / 86400).toFixed(1) + ' 天'
  if (y < 1e4) return y.toFixed(1) + ' 年'
  return y.toExponential(2).replace('e+', ' × 10^') + ' 年'
})
const universe = computed(() => {
  const u = sec.value / YEAR / 1.38e10
  if (u >= 1) return u.toPrecision(3) + ' 倍'
  return u < 1e-4 ? '< 0.01%' : (u * 100).toPrecision(2) + '%'
})
const LIMIT = Math.log2(YEAR * 100)
const breakable = computed(() => log2sec.value < LIMIT)

// 对数时间轴
const MARKS: [number, string][] = [[0, '1秒'], [Math.log2(3600), '1时'], [Math.log2(86400), '1天'], [Math.log2(YEAR), '1年'], [LIMIT, '100年'], [Math.log2(YEAR * 1.38e10), '宇宙年龄']]
const W = 680
const xOf = (v: number) => 10 + Math.max(0, Math.min(1, v / 110)) * W
</script>

<template>
  <Widget title="穷举攻击计时器">
    <p class="widget-note">调整密钥空间、单机速度和机器数量，看看“100 年才能破解”这种说法有多不靠谱（0.4.1 例 2）。</p>
    <div class="ctrl">
      <div class="seg">
        <button v-for="p in PRESETS" :key="p.name" :class="{ on: bits === p.bits }" @click="bits = p.bits">{{ p.name }}</button>
      </div>
    </div>
    <div class="ctrl">
      <label>密钥空间 2^<b>{{ bits.toFixed(1) }}</b><input v-model.number="bits" type="range" min="1" max="128" step="0.1"></label>
      <label>单机 2^<b>{{ speed }}</b> 次/秒<input v-model.number="speed" type="range" min="10" max="50" step="1"></label>
      <label>机器数 10^<b>{{ machines }}</b><input v-model.number="machines" type="range" min="0" max="9" step="1"></label>
    </div>
    <div class="stats">
      <div class="stat"><b>{{ timeText }}</b><span>遍历全部密钥所需时间</span></div>
      <div class="stat"><b>{{ universe }}</b><span>相对宇宙年龄 1.38×10¹⁰ 年</span></div>
      <div class="stat"><b :class="breakable ? 'bad-c' : 'ok-c'">{{ breakable ? '可被破解' : '穷举不可行' }}</b><span>以“100 年内”为界</span></div>
    </div>
    <svg viewBox="0 0 700 70" style="width:100%;height:auto">
      <text x="10" y="12" font-size="11" style="fill:var(--ink-3)">时间（对数刻度）</text>
      <rect x="10" y="22" :width="W" height="12" rx="6" style="fill:var(--line-2)" />
      <rect x="10" y="22" :width="Math.max(4, xOf(log2sec) - 10)" height="12" rx="6" :style="{ fill: breakable ? 'var(--warn)' : 'var(--ex)' }" />
      <g v-for="[v, t] in MARKS" :key="t">
        <line :x1="xOf(v)" :x2="xOf(v)" y1="16" y2="40" style="stroke:var(--ink-3)" />
        <text :x="xOf(v)" y="56" font-size="11" text-anchor="middle" style="fill:var(--ink-3)">{{ t }}</text>
      </g>
    </svg>
  </Widget>
</template>
