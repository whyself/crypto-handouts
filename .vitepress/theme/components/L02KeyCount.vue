<script setup lang="ts">
import { ref, computed } from 'vue'

// |K| ≥ |M| 的计数直观：固定密文 c，每把密钥只能把 c 解成一条消息
const L = 3
const NM = 1 << L
const bits = (v: number) => v.toString(2).padStart(L, '0')
const nk = ref(4)          // 密钥空间大小 |K|（取 {000, 001, …} 的前 nk 个）
const c = ref(5)           // 敌手看到的密文
const keys = computed(() => Array.from({ length: nk.value }, (_, i) => i))
const dec = (k: number) => c.value ^ k                       // Dec_k(c) = c ⊕ k
const hit = computed(() => new Set(keys.value.map(dec)))
const post = (m: number) => (hit.value.has(m) ? 1 / nk.value : 0) // 均匀先验下的后验
const yK = (i: number) => 34 + i * 30
const yM = (i: number) => 34 + i * 30
</script>

<template>
  <Widget title="密钥不够用会怎样？|𝒦| ≥ |ℳ| 的计数直观">
    <p class="widget-note">消息空间 ℳ = {0,1}³（8 条消息，先验均匀，各 1/8）。加密为 c = m ⊕ k，但密钥只从前 |𝒦| 个比特串里均匀选。固定敌手看到的密文 c，从每把密钥连线到它把 c 解密成的那条消息。</p>
    <div class="ctrl">
      <label>|𝒦| = <b>{{ nk }}</b><input v-model.number="nk" type="range" min="1" max="8"></label>
      <label>密文 c =
        <select v-model.number="c"><option v-for="v in NM" :key="v" :value="v - 1">{{ bits(v - 1) }}</option></select>
      </label>
    </div>
    <svg viewBox="0 0 640 280" style="width:100%;max-width:640px;height:auto;display:block;margin:auto">
      <text x="130" y="16" text-anchor="middle" font-size="13" font-weight="700" style="fill:var(--accent)">密钥 k ∈ 𝒦</text>
      <text x="500" y="16" text-anchor="middle" font-size="13" font-weight="700" style="fill:var(--ink)">消息 m = Dec<tspan font-size="10" dy="4">k</tspan><tspan dy="-4">(c)</tspan></text>
      <line v-for="k in keys" :key="'l' + k" :x1="170" :y1="yK(k) - 4" :x2="455" :y2="yM(dec(k)) - 4" stroke-width="1.6" style="stroke:var(--accent)" />
      <g v-for="i in NM" :key="'k' + i">
        <rect x="90" :y="yK(i - 1) - 18" width="80" height="24" rx="6"
          :style="{ fill: i - 1 < nk ? 'var(--accent-soft)' : 'transparent', stroke: i - 1 < nk ? 'var(--accent)' : 'var(--line)', strokeDasharray: i - 1 < nk ? '' : '3 3' }" />
        <text x="130" :y="yK(i - 1) - 1" text-anchor="middle" font-size="13"
          :style="{ fill: i - 1 < nk ? 'var(--accent)' : 'var(--ink-3)', fontFamily: 'var(--vp-font-family-mono)' }">{{ bits(i - 1) }}</text>
      </g>
      <g v-for="i in NM" :key="'m' + i">
        <rect x="455" :y="yM(i - 1) - 18" width="90" height="24" rx="6"
          :style="{ fill: hit.has(i - 1) ? 'var(--ex-bg)' : 'var(--warn-bg)', stroke: hit.has(i - 1) ? 'var(--ex)' : 'var(--warn)' }" />
        <text x="500" :y="yM(i - 1) - 1" text-anchor="middle" font-size="13" style="font-family:var(--vp-font-family-mono);fill:var(--ink)">{{ bits(i - 1) }}</text>
        <text x="555" :y="yM(i - 1) - 1" font-size="12" :style="{ fill: hit.has(i - 1) ? 'var(--ex)' : 'var(--warn)' }">后验 {{ post(i - 1) === 0 ? '0' : '1/' + nk }}</text>
      </g>
    </svg>
    <div class="stats">
      <div class="stat"><b>{{ nk }}</b><span>|𝒦|（连线数）</span></div>
      <div class="stat"><b>{{ hit.size }}</b><span>c 可能解出的消息数 ≤ |𝒦|</span></div>
      <div class="stat"><b>{{ NM - hit.size }}</b><span>后验变成 0 的消息数</span></div>
    </div>
    <div class="out prose">
      <template v-if="nk < NM">只有 {{ nk }} 把密钥，c 最多解出 {{ nk }} 条消息；其余 {{ NM - hit.size }} 条消息的后验 Pr[M=m | C=c] = <b class="bad-c">0 ≠ 1/8</b>。敌手看到密文就排除了它们——<b class="bad-c">不是完美保密</b>。</template>
      <template v-else>|𝒦| = |ℳ| = 8：每条消息恰好被一把密钥连到，后验都是 <b class="ok-c">1/8 = 先验</b>。这就是一次一密（l = 3）。</template>
    </div>
  </Widget>
</template>
