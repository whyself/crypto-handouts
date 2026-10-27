<script setup lang="ts">
import { ref, computed } from 'vue'

// 四种攻击模型：能力逐级增强，用“预言机”箭头表示敌手可额外获得的东西
const MODELS = [
  { name: '唯密文 COA', d: '<b>唯密文攻击（COA）</b>：敌手只能被动观察密文，然后猜。——前面对移位 / 单表 / 维吉尼亚的统计攻击都是唯密文攻击。', o: [] as string[], dash: false },
  { name: '已知明文 KPA', d: '<b>已知明文攻击（KPA）</b>：攻击目标密文之前，敌手已知一些明文/密文对（但明文不由他挑）。——例：已知某封信开头是“Dear”。对移位密码，<b>一对</b>就足以算出 k。', o: ['已知 (m₁,c₁), (m₂,c₂)…'], dash: true },
  { name: '选择明文 CPA', d: '<b>选择明文攻击（CPA）</b>：敌手可以<b>自选明文</b>并拿到对应密文（相当于能调用加密预言机）。——例：二战中盟军故意诱使日军加密包含 “AF” 的消息，确认中途岛目标。', o: ['加密预言机：m ↦ Enc_k(m)'], dash: false },
  { name: '选择密文 CCA', d: '<b>选择密文攻击（CCA）</b>：在 CPA 基础上，敌手还能<b>自选密文</b>并拿到对应明文（解密预言机，但不能直接问目标密文）。——最强的模型，后续课程的 CCA 安全即针对它。', o: ['加密预言机：m ↦ Enc_k(m)', '解密预言机：c ↦ Dec_k(c)'], dash: false }
]
const t = ref(0)
const cur = computed(() => MODELS[t.value])
</script>

<template>
  <Widget title="四种攻击模型">
    <div class="ctrl">
      <div class="seg"><button v-for="(x, i) in MODELS" :key="i" :class="{ on: t === i }" @click="t = i">{{ x.name }}</button></div>
    </div>
    <svg viewBox="0 0 720 170" style="width:100%;height:auto">
      <defs>
        <marker id="tm-ar" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" style="fill:var(--ink)" /></marker>
        <marker id="tm-ar2" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" style="fill:var(--accent)" /></marker>
      </defs>
      <rect x="20" y="50" width="150" height="70" rx="10" style="fill:var(--warn-bg);stroke:var(--warn)" />
      <text x="95" y="80" text-anchor="middle" font-size="15" font-weight="700" style="fill:var(--warn)">敌手</text>
      <text x="95" y="102" text-anchor="middle" font-size="12" style="fill:var(--ink-2)">目标：从 c* 得到 m*</text>
      <rect x="550" y="50" width="150" height="70" rx="10" style="fill:var(--accent-soft);stroke:var(--accent)" />
      <text x="625" y="80" text-anchor="middle" font-size="15" font-weight="700" style="fill:var(--accent)">加密系统</text>
      <text x="625" y="102" text-anchor="middle" font-size="12" style="fill:var(--ink-2)">密钥 k（保密）</text>
      <line x1="550" y1="68" x2="175" y2="68" style="stroke:var(--ink)" marker-end="url(#tm-ar)" />
      <text x="362" y="62" text-anchor="middle" font-size="12" style="fill:var(--ink)">截获目标密文 c*</text>
      <g v-for="(o, i) in cur.o" :key="o">
        <line x1="175" :y1="100 + i * 32" x2="545" :y2="100 + i * 32" style="stroke:var(--accent)" :stroke-dasharray="cur.dash ? '4 4' : '0'" marker-end="url(#tm-ar2)" />
        <line x1="545" :y1="108 + i * 32" x2="175" :y2="108 + i * 32" style="stroke:var(--accent)" :stroke-dasharray="cur.dash ? '4 4' : '0'" marker-end="url(#tm-ar2)" />
        <text x="362" :y="96 + i * 32" text-anchor="middle" font-size="12" font-weight="700" style="fill:var(--accent)">{{ o }}</text>
      </g>
      <text x="20" y="160" font-size="12" style="fill:var(--ink-3)">能力强度：</text>
      <rect v-for="i in 4" :key="i" :x="90 + (i - 1) * 40" y="150" width="34" height="12" rx="3" :style="{ fill: i - 1 <= t ? 'var(--warn)' : 'var(--line-2)' }" />
    </svg>
    <div style="font-size:14.5px;line-height:1.8" v-html="cur.d" />
  </Widget>
</template>
