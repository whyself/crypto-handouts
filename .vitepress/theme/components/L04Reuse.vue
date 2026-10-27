<script setup lang="ts">
import { ref, computed } from 'vue'
import { rc4Stream, asciiBytes, hex, xorBytes, show } from '../lib/l04'

// 流密码加密的两大软肋：① 密钥流重用 → 两段密文异或消去密钥流；② 比特翻转（可延展性）
const tab = ref<'reuse' | 'flip'>('reuse')
const key = ref('k3y-2025')
const ks = computed(() => rc4Stream(asciiBytes(key.value || 'k'), 256))

// ---------- ① 密钥流重用 ----------
const m1 = ref('attack the north gate at dawn')
const m2 = ref('the password is the usual one')
const c1 = computed(() => xorBytes(asciiBytes(m1.value), ks.value))
const c2 = computed(() => xorBytes(asciiBytes(m2.value), ks.value))
const x = computed(() => xorBytes(c1.value, c2.value))            // 敌手能算出的 c1 ⊕ c2
const mx = computed(() => xorBytes(asciiBytes(m1.value), asciiBytes(m2.value)))
const same = computed(() => x.value.every((v, k) => v === mx.value[k]))
const crib = ref(' the ')
const okCh = (b: number) => (b >= 97 && b <= 122) || b === 32 || b === 44 || b === 46 || b === 39
const drag = computed(() => {
  const g = asciiBytes(crib.value)
  if (!g.length) return []
  const rows: { p: number; txt: string; good: boolean }[] = []
  for (let p = 0; p + g.length <= x.value.length; p++) {
    const r = xorBytes(g, x.value.slice(p))
    rows.push({ p, txt: show(r), good: r.every(okCh) })
  }
  return rows
})
const goodCount = computed(() => drag.value.filter(r => r.good).length)

// ---------- ② 比特翻转 ----------
const msg = 'TRANSFER 0100 YUAN TO BOB'
const pos = 9                                   // 金额字段的位置（敌手知道报文格式）
const target = ref('9900')
const cOrig = computed(() => xorBytes(asciiBytes(msg), ks.value))
const delta = computed(() => {
  const t = (target.value + '0000').slice(0, 4)
  const d = new Array(msg.length).fill(0)
  for (let k = 0; k < 4; k++) d[pos + k] = msg.charCodeAt(pos + k) ^ t.charCodeAt(k)
  return d
})
const cMod = computed(() => xorBytes(cOrig.value, delta.value))
const recv = computed(() => show(xorBytes(cMod.value, ks.value)))
</script>

<template>
  <Widget title="密钥流不能重用 · 密文可以被“翻转”">
    <div class="ctrl">
      <div class="seg">
        <button :class="{ on: tab === 'reuse' }" @click="tab = 'reuse'">① 密钥流重用</button>
        <button :class="{ on: tab === 'flip' }" @click="tab = 'flip'">② 比特翻转攻击</button>
      </div>
      <label>密钥（敌手不知道）<input v-model="key" type="text" style="width:120px"></label>
    </div>

    <template v-if="tab === 'reuse'">
      <p class="widget-note">Alice 用<b>同一个密钥</b>（因而同一条 RC4 密钥流 G(k)）加密了两条消息。敌手只截获两段密文，把它们异或：c₁ ⊕ c₂ = (m₁ ⊕ G(k)) ⊕ (m₂ ⊕ G(k)) = m₁ ⊕ m₂——密钥流被完全消去。</p>
      <div class="ctrl"><label style="flex:1">m₁<input v-model="m1" type="text" style="flex:1"></label></div>
      <div class="ctrl"><label style="flex:1">m₂<input v-model="m2" type="text" style="flex:1"></label></div>
      <div class="out" style="font-size:13px"><span class="lbl">c₁ = m₁ ⊕ G(k)</span>{{ hex(c1) }}</div>
      <div class="out" style="font-size:13px;margin-top:6px"><span class="lbl">c₂ = m₂ ⊕ G(k)</span>{{ hex(c2) }}</div>
      <div class="out" style="font-size:13px;margin-top:6px"><span class="lbl">敌手计算 c₁ ⊕ c₂（不需要密钥）</span>{{ hex(x) }}</div>
      <div class="out" style="font-size:13px;margin-top:6px"><span class="lbl">对照：m₁ ⊕ m₂</span>{{ hex(mx) }} <b :class="same ? 'ok-c' : 'bad-c'">{{ same ? '　✓ 完全相同' : '' }}</b></div>
      <p class="widget-note" style="margin-top:12px"><b>拖动猜词（crib dragging）</b>：猜一个可能出现在某条消息里的词，把它与 c₁ ⊕ c₂ 的每个位置异或。若猜对了位置，得到的就是<b>另一条</b>消息在该处的明文——通常是可读的英文（下表绿色行）。</p>
      <div class="ctrl"><label>猜测片段<input v-model="crib" type="text" style="width:160px"></label><span class="muted" style="font-size:13px">可读候选 {{ goodCount }} / {{ drag.length }}；试试 “ the ”、“attack”、“password”</span></div>
      <div style="max-height:240px;overflow:auto;border:1px solid var(--line);border-radius:8px">
        <table class="mini-table">
          <thead><tr><th>位置</th><th>猜测 ⊕ (c₁⊕c₂)[位置…]</th></tr></thead>
          <tbody>
            <tr v-for="r in drag" :key="r.p" :class="{ best: r.good }">
              <td>{{ r.p }}</td>
              <td style="font-family:var(--vp-font-family-mono);white-space:pre">“{{ r.txt }}”</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <template v-else>
      <p class="widget-note">敌手不知道密钥，但知道报文格式（金额在第 9–12 字节，从 0 数起）以及原金额。由于 c = m ⊕ G(k)，把密文第 i 位翻转，解密后明文第 i 位就跟着翻转：发送 c′ = c ⊕ Δ，接收方得到 m ⊕ Δ。</p>
      <div class="out"><span class="lbl">原明文 m（敌手看不到，但猜得到格式）</span>{{ msg }}</div>
      <div class="ctrl" style="margin-top:8px"><label>敌手想改成的金额<input v-model="target" type="text" maxlength="4" style="width:80px"></label></div>
      <div class="out" style="font-size:13px"><span class="lbl">截获的密文 c</span>{{ hex(cOrig) }}</div>
      <div class="out" style="font-size:13px;margin-top:6px"><span class="lbl">Δ = (“0100” ⊕ “{{ (target + '0000').slice(0, 4) }}”) 放在第 9–12 字节，其余为 0</span>{{ hex(delta) }}</div>
      <div class="out" style="font-size:13px;margin-top:6px"><span class="lbl">发给接收方的 c′ = c ⊕ Δ</span>{{ hex(cMod) }}</div>
      <div class="out" style="margin-top:6px"><span class="lbl">接收方用正确密钥解密 c′</span><b class="bad-c">{{ recv }}</b></div>
      <p class="widget-note" style="margin-top:8px">整个过程敌手从未接触密钥，却精确地改写了明文——这就是课件说的“易受比特翻转攻击，因此通常需要额外的消息完整性校验”。</p>
    </template>
  </Widget>
</template>
