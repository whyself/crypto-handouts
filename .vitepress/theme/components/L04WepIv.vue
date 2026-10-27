<script setup lang="ts">
import { ref, computed } from 'vue'

// WEP 短 IV 缺陷：IV 只有 24 位 → 计数器式 IV 几小时就用完；随机 IV 由生日悖论更快撞车
const bits = ref(24)
const pktBytes = ref(1500)
const mbps = ref(11)

const pps = computed(() => (mbps.value * 1e6) / (pktBytes.value * 8))              // 每秒包数
const space = computed(() => Math.pow(2, bits.value))
const tExhaust = computed(() => space.value / pps.value)                          // 计数器 IV 用尽的时间（秒）
const nBday = computed(() => Math.sqrt(Math.PI / 2 * space.value))                // 随机 IV 首次碰撞的期望包数
const tBday = computed(() => nBday.value / pps.value)

function fmtT(s: number) {
  if (s < 1) return (s * 1000).toFixed(1) + ' 毫秒'
  if (s < 120) return s.toFixed(1) + ' 秒'
  if (s < 7200) return (s / 60).toFixed(1) + ' 分钟'
  if (s < 86400 * 3) return (s / 3600).toFixed(2) + ' 小时'
  if (s < 86400 * 365 * 3) return (s / 86400).toFixed(1) + ' 天'
  return (s / 86400 / 365).toExponential(2) + ' 年'
}
const fmtN = (x: number) => (x < 1e10 ? Math.round(x).toLocaleString() : x.toExponential(2))

// 模拟：每次试验不断随机抽 IV，记录第一次出现重复时已发了多少包
const trials = ref<number[]>([])
const running = ref(false)
function simulate() {
  running.value = true
  setTimeout(() => {
    const res: number[] = []
    const N = space.value
    const T = bits.value <= 28 ? 300 : 60
    for (let t = 0; t < T; t++) {
      const seen = new Set<number>()
      let k = 0
      for (;;) {
        const iv = Math.floor(Math.random() * N)
        k++
        if (seen.has(iv)) break
        seen.add(iv)
      }
      res.push(k)
    }
    trials.value = res
    running.value = false
  }, 20)
}
const mean = computed(() => (trials.value.length ? trials.value.reduce((a, b) => a + b, 0) / trials.value.length : 0))
// 直方图（20 个桶）
const hist = computed(() => {
  if (!trials.value.length) return { bins: [] as number[], max: 1, w: 1 }
  const mx = Math.max(...trials.value)
  const w = mx / 20
  const bins = new Array(20).fill(0)
  for (const v of trials.value) bins[Math.min(19, Math.floor(v / w))]++
  return { bins, max: Math.max(...bins), w }
})
</script>

<template>
  <Widget title="WEP 的短 IV：多久就会出现重复的密钥流？">
    <p class="widget-note">WEP 用 RC4(IV ‖ k) 加密每个数据包，k 长期不变，所以<b>IV 重复 ⇔ 密钥流重复</b>。调整参数，看看 IV 空间多快被耗尽。</p>
    <div class="ctrl">
      <label>IV 长度 <b>{{ bits }}</b> 位<input v-model.number="bits" type="range" min="8" max="48" @input="trials = []"></label>
      <label>包长 <input v-model.number="pktBytes" type="number" min="64" max="9000" style="width:80px"> 字节</label>
      <label>速率 <input v-model.number="mbps" type="number" min="1" max="10000" style="width:80px"> Mbps</label>
      <button class="btn" @click="bits = 24; pktBytes = 1500; mbps = 11; trials = []">课件参数（P47）</button>
    </div>
    <div class="stats">
      <div class="stat"><b>{{ fmtN(space) }}</b><span>IV 总数 2^{{ bits }}</span></div>
      <div class="stat"><b>{{ Math.round(pps).toLocaleString() }}</b><span>每秒发包数</span></div>
      <div class="stat"><b>{{ fmtT(tExhaust) }}</b><span>计数器式 IV：全部用完</span></div>
      <div class="stat"><b class="bad-c">{{ fmtT(tBday) }}</b><span>随机 IV：首次碰撞（期望 ≈ {{ fmtN(nBday) }} 包）</span></div>
    </div>
    <div class="out prose">
      <span class="lbl">课件的算式</span>
      2<sup>{{ bits }}</sup> × {{ pktBytes }} × 8 ÷ ({{ mbps }} × 10<sup>6</sup>) ≈ <b>{{ fmtT(tExhaust) }}</b>。随机选 IV 时，由生日悖论，大约 √(π/2 · 2<sup>{{ bits }}</sup>) ≈ {{ fmtN(nBday) }} 个包后就期望出现第一次重复——远早于“全部用完”。
    </div>
    <div class="ctrl" style="margin-top:10px">
      <button class="btn primary" :disabled="running || bits > 32" @click="simulate">{{ running ? '模拟中…' : '模拟：随机抽 IV 直到撞车' }}</button>
      <span v-if="bits > 32" class="muted" style="font-size:13px">（IV 超过 32 位时模拟太慢，只看公式即可）</span>
      <span v-if="trials.length" style="font-size:13.5px">{{ trials.length }} 次试验，平均 <b>{{ fmtN(mean) }}</b> 个包出现首次重复（理论 {{ fmtN(nBday) }}）</span>
    </div>
    <svg v-if="trials.length" viewBox="0 0 620 170" style="width:100%;max-width:620px;height:auto;display:block">
      <line x1="40" y1="140" x2="610" y2="140" style="stroke:var(--line)" />
      <rect v-for="(b, k) in hist.bins" :key="k" :x="42 + k * 28" :y="140 - b / hist.max * 120" width="24" :height="b / hist.max * 120" rx="2" style="fill:var(--accent)" />
      <line :x1="42 + mean / hist.w * 28" y1="12" :x2="42 + mean / hist.w * 28" y2="140" style="stroke:var(--prin)" stroke-dasharray="4 3" />
      <text :x="46 + mean / hist.w * 28" y="22" font-size="12" style="fill:var(--prin)">平均</text>
      <text x="42" y="158" font-size="11" style="fill:var(--ink-3)">0</text>
      <text x="602" y="158" text-anchor="end" font-size="11" style="fill:var(--ink-3)">{{ fmtN(hist.w * 20) }} 包</text>
      <text x="40" y="12" font-size="11" style="fill:var(--ink-3)">首次 IV 重复时已发送的包数（分布）</text>
    </svg>
  </Widget>
</template>
