<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { feistelF, feistelKeys, fRangeSize, hex } from '../lib/l06'

// 玩具 Feistel：16 位分组 = 8 位 L + 8 位 R；轮函数 f_i(R) = ((R⊕k_i)² >> 4) mod 256（不可逆！）
// 演示：加密逐轮计算；解密 = 同一个结构 + 轮密钥倒序（首尾各交换一次左右）
const n = ref(3)
const master = ref(0xC0FFEE42)
const L0 = ref(0x4E)
const R0 = ref(0x4A)
const dir = ref<'enc' | 'dec'>('enc')
const step = ref(99)

const keys = computed(() => feistelKeys(master.value, n.value))
function ladder(L: number, R: number, ks: number[]) {
  const rows = [{ L, R, f: 0 }]
  for (const k of ks) { const f = feistelF(k, R); [L, R] = [R, L ^ f]; rows.push({ L, R, f }) }
  return rows
}
const enc = computed(() => ladder(L0.value, R0.value, keys.value))
const ct = computed(() => enc.value[n.value])
// 解密：输入 (R_n, L_n)，轮密钥 k_n … k_1，输出再交换一次
const decKeys = computed(() => keys.value.slice().reverse())
const dec = computed(() => ladder(ct.value.R, ct.value.L, decKeys.value))
const rows = computed(() => (dir.value === 'enc' ? enc.value : dec.value))
const ks = computed(() => (dir.value === 'enc' ? keys.value : decKeys.value))
const kName = (i: number) => (dir.value === 'enc' ? `k${i + 1}` : `k${n.value - i}`)
const recovered = computed(() => { const last = dec.value[n.value]; return { L: last.R, R: last.L } })
const ok = computed(() => recovered.value.L === L0.value && recovered.value.R === R0.value)

let timer: ReturnType<typeof setInterval> | undefined
function play() {
  clearInterval(timer); step.value = 0
  timer = setInterval(() => { if (step.value >= n.value) clearInterval(timer); else step.value++ }, 900)
}
watch([n, dir, master, L0, R0], () => { clearInterval(timer); step.value = 99 })
onBeforeUnmount(() => clearInterval(timer))
const shown = (i: number) => i <= step.value

// f 不可逆的证据：找一对碰撞
const range = computed(() => fRangeSize(keys.value[0]))
const collision = computed(() => {
  const seen = new Map<number, number>(), k = keys.value[0]
  for (let r = 0; r < 256; r++) { const v = feistelF(k, r); if (seen.has(v)) return { a: seen.get(v)!, b: r, v }; seen.set(v, r) }
  return null
})

const H = 92, top = 34
const y = (i: number) => top + i * H
const hx = (v: number) => hex(v, 2)
const hexOf = (r: typeof L0) => computed({ get: () => hex(r.value, 2), set: (s: string) => { const v = parseInt(s, 16); if (!isNaN(v)) r.value = v & 0xFF } })
const hL = hexOf(L0), hR = hexOf(R0)
const hK = computed({ get: () => hex(master.value, 8), set: (s: string) => { const v = parseInt(s, 16); if (!isNaN(v)) master.value = v >>> 0 } })
</script>

<template>
  <Widget title="Feistel 网络：用不可逆的 f 造出可逆的置换">
    <p class="widget-note">教学用玩具 Feistel：16 位分组（左右各 8 位），轮函数 f<sub>i</sub>(R) = ((R ⊕ k<sub>i</sub>)² ≫ 4) mod 256。</p>
    <div class="ctrl">
      <div class="seg">
        <button :class="{ on: dir === 'enc' }" @click="dir = 'enc'">加密</button>
        <button :class="{ on: dir === 'dec' }" @click="dir = 'dec'">解密（同一结构，密钥倒序）</button>
      </div>
      <label>轮数 {{ n }}<input v-model.number="n" type="range" min="1" max="6"></label>
      <button class="btn primary" @click="play">▶ 逐轮播放</button>
    </div>
    <div class="ctrl">
      <label>L₀<input v-model.lazy="hL" type="text" style="width:46px"></label>
      <label>R₀<input v-model.lazy="hR" type="text" style="width:46px"></label>
      <label>主密钥<input v-model.lazy="hK" type="text" style="width:100px"></label>
      <span style="font-size:13px;color:var(--ink-3)">轮密钥：<code v-for="(k, i) in keys" :key="i" style="margin-right:4px">k{{ i + 1 }}={{ hx(k) }}</code></span>
    </div>

    <svg :viewBox="`0 0 600 ${y(n) + 60}`" style="width:100%;max-width:600px;height:auto;display:block;margin:auto">
      <text v-if="dir === 'dec'" x="300" y="14" text-anchor="middle" font-size="12" style="fill:var(--prin)">输入密文先左右交换：(R{{ n }}, L{{ n }}) = ({{ hx(ct.R) }}, {{ hx(ct.L) }})</text>
      <!-- 各轮连线 -->
      <g v-for="i in n" :key="'r' + i" :opacity="shown(i) ? 1 : .25">
        <!-- R_{i-1} 向下，分到 f 与左下 -->
        <line x1="440" :y1="y(i - 1) + 16" x2="440" :y2="y(i - 1) + 46" style="stroke:var(--ink-2)" stroke-width="1.6" />
        <line x1="440" :y1="y(i - 1) + 46" x2="335" :y2="y(i - 1) + 46" style="stroke:var(--ink-2)" stroke-width="1.6" />
        <rect x="265" :y="y(i - 1) + 32" width="70" height="28" rx="6" :style="{ fill: step === i ? 'var(--accent)' : 'var(--accent-soft)', stroke: 'var(--accent)' }" />
        <text x="300" :y="y(i - 1) + 51" text-anchor="middle" font-size="13" font-weight="700" :style="{ fill: step === i ? '#fff' : 'var(--accent)' }">f · {{ kName(i - 1) }}</text>
        <text x="342" :y="y(i - 1) + 40" font-size="11" style="fill:var(--ink-3)">f 输出 {{ hx(rows[i].f) }}</text>
        <line x1="265" :y1="y(i - 1) + 46" x2="171" :y2="y(i - 1) + 46" style="stroke:var(--accent)" stroke-width="1.6" />
        <line x1="160" :y1="y(i - 1) + 16" x2="160" :y2="y(i - 1) + 35" style="stroke:var(--ink-2)" stroke-width="1.6" />
        <circle cx="160" :cy="y(i - 1) + 46" r="11" style="fill:var(--paper);stroke:var(--ink-2)" />
        <text x="160" :y="y(i - 1) + 51" text-anchor="middle" font-size="15" style="fill:var(--ink)">⊕</text>
        <!-- 交叉 -->
        <line x1="160" :y1="y(i - 1) + 57" x2="440" :y2="y(i) - 16" style="stroke:var(--warn)" stroke-width="1.6" />
        <line x1="440" :y1="y(i - 1) + 46" x2="160" :y2="y(i) - 16" style="stroke:var(--prin)" stroke-width="1.6" stroke-dasharray="5 3" />
      </g>
      <!-- 状态框 -->
      <g v-for="(r, i) in rows" :key="'s' + i">
        <rect x="105" :y="y(i) - 16" width="110" height="32" rx="7" style="fill:var(--vp-c-bg);stroke:var(--line)" />
        <rect x="385" :y="y(i) - 16" width="110" height="32" rx="7" style="fill:var(--vp-c-bg);stroke:var(--line)" />
        <text x="160" :y="y(i) + 5" text-anchor="middle" font-size="14" style="fill:var(--ink);font-family:var(--vp-font-family-mono)">{{ shown(i) ? hx(r.L) : '??' }}</text>
        <text x="440" :y="y(i) + 5" text-anchor="middle" font-size="14" style="fill:var(--ink);font-family:var(--vp-font-family-mono)">{{ shown(i) ? hx(r.R) : '??' }}</text>
        <text x="95" :y="y(i) + 5" text-anchor="end" font-size="12" style="fill:var(--ink-3)">{{ dir === 'enc' ? `L${i}` : `R${n - i}` }}</text>
        <text x="505" :y="y(i) + 5" font-size="12" style="fill:var(--ink-3)">{{ dir === 'enc' ? `R${i}` : `L${n - i}` }}</text>
      </g>
      <text v-if="dir === 'dec'" x="300" :y="y(n) + 40" text-anchor="middle" font-size="12" style="fill:var(--prin)">输出再左右交换 → (L₀, R₀) = ({{ hx(recovered.L) }}, {{ hx(recovered.R) }})</text>
      <text v-else x="300" :y="y(n) + 40" text-anchor="middle" font-size="12" style="fill:var(--ink-3)">密文 (L{{ n }}, R{{ n }}) = ({{ hx(ct.L) }}, {{ hx(ct.R) }})</text>
    </svg>

    <div class="stats">
      <div class="stat"><b>{{ hx(L0) }}{{ hx(R0) }}</b><span>明文 (L₀ ‖ R₀)</span></div>
      <div class="stat"><b>{{ hx(ct.L) }}{{ hx(ct.R) }}</b><span>密文 (L{{ n }} ‖ R{{ n }})</span></div>
      <div class="stat"><b :class="ok ? 'ok-c' : 'bad-c'">{{ hx(recovered.L) }}{{ hx(recovered.R) }} {{ ok ? '✓' : '✗' }}</b><span>倒序密钥解密结果</span></div>
      <div class="stat"><b class="bad-c">{{ range }} / 256</b><span>f₁ 的值域大小（不是双射）</span></div>
    </div>
    <div class="out prose">
      <template v-if="collision">f₁ 不可逆的证据：f₁({{ hx(collision.a) }}) = f₁({{ hx(collision.b) }}) = {{ hx(collision.v) }}。</template>
      但整个 Feistel 网络仍可逆：每轮只用 f 的<b>正向</b>计算——知道 (Lᵢ, Rᵢ) 就知道 Rᵢ₋₁ = Lᵢ，从而能重算 fᵢ(Rᵢ₋₁)，再由 Lᵢ₋₁ = Rᵢ ⊕ fᵢ(Rᵢ₋₁) 消掉它。
      切到“解密”可以看到：把密文左右交换、轮密钥倒序、再跑一遍<b>同一套电路</b>，最后交换一次，就回到了明文。
    </div>
  </Widget>
</template>
