<script setup lang="ts">
import { ref, computed } from 'vue'
import { E12, D12, hex } from '../lib/l06'

// 3DES 的 EDE 结构 + 双重加密的中间相遇攻击
// 底层“DES”用玩具密码代替：E_k = Toy16，密钥只有 12 位（4096 种），这样攻击能在浏览器里瞬间跑完
const x = ref(0x4869)
const k1 = ref(0x5A3)
const k2 = ref(0xC71)
const k3 = ref(0x2E8)
const variant = ref<'3key' | '2key' | 'same'>('3key')
const K3 = computed(() => (variant.value === '3key' ? k3.value : k1.value))
const K2 = computed(() => (variant.value === 'same' ? k1.value : k2.value))
const a = computed(() => E12(k1.value, x.value))
const b = computed(() => D12(K2.value, a.value))
const y = computed(() => E12(K3.value, b.value))
const single = computed(() => E12(K3.value, x.value))

const h3 = (r: typeof k1) => computed({ get: () => hex(r.value, 3), set: (s: string) => { const v = parseInt(s, 16); if (!isNaN(v)) r.value = v & 0xFFF } })
const hk1 = h3(k1), hk2 = h3(k2), hk3 = h3(k3)
const hx = computed({ get: () => hex(x.value), set: (s: string) => { const v = parseInt(s, 16); if (!isNaN(v)) x.value = v & 0xFFFF } })

// ---------- 中间相遇攻击 ----------
const rnd12 = () => Math.floor(Math.random() * 4096)
const s1 = ref(0x3B1), s2 = ref(0x96D) // 双重加密的秘密密钥
const m1 = 0x4869, m2 = 0x2121
const c1 = computed(() => E12(s2.value, E12(s1.value, m1)))
const c2 = computed(() => E12(s2.value, E12(s1.value, m2)))
const res = ref<null | { table: number; cand: [number, number][]; final: [number, number][]; ms: number }>(null)
function newSecret() { s1.value = rnd12(); s2.value = rnd12(); res.value = null }
function attack() {
  const t0 = performance.now()
  // ① 正向：对所有 k1 算 z = E_k1(m1)，存表 z → [k1…]
  const T = new Map<number, number[]>()
  for (let a = 0; a < 4096; a++) { const z = E12(a, m1); const l = T.get(z); l ? l.push(a) : T.set(z, [a]) }
  // ② 反向：对所有 k2 算 z' = D_k2(c1)，查表——在“中间”相遇
  const cand: [number, number][] = []
  for (let b = 0; b < 4096; b++) for (const a of T.get(D12(b, c1.value)) || []) cand.push([a, b])
  // ③ 用第二对明密文过滤假阳性
  const final = cand.filter(([a, b]) => E12(b, E12(a, m2)) === c2.value)
  res.value = { table: T.size, cand, final, ms: performance.now() - t0 }
}
</script>

<template>
  <Widget title="3DES：EDE 结构与中间相遇攻击">
    <p class="widget-note">为了能在浏览器里跑完攻击，这里的“DES”换成了玩具密码：16 位分组、<b>12 位密钥</b>（只有 4096 个），仅供教学。</p>
    <div class="ctrl">
      <div class="seg">
        <button :class="{ on: variant === '3key' }" @click="variant = '3key'">变体 1：三个独立密钥</button>
        <button :class="{ on: variant === '2key' }" @click="variant = '2key'">变体 2：两密钥（k₃ = k₁）</button>
        <button :class="{ on: variant === 'same' }" @click="variant = 'same'">k₁ = k₂ = k₃</button>
      </div>
    </div>
    <div class="ctrl">
      <label>x<input v-model.lazy="hx" type="text" style="width:62px"></label>
      <label>k₁<input v-model.lazy="hk1" type="text" style="width:52px"></label>
      <label>k₂<input v-model.lazy="hk2" type="text" style="width:52px" :disabled="variant === 'same'"></label>
      <label>k₃<input v-model.lazy="hk3" type="text" style="width:52px" :disabled="variant !== '3key'"></label>
    </div>
    <div class="ede">
      <span class="v">x<br><b>{{ hex(x) }}</b></span><span class="ar">→</span>
      <span class="op e">E<sub>k₁</sub><br><small>{{ hex(k1, 3) }}</small></span><span class="ar">→</span>
      <span class="v">{{ hex(a) }}</span><span class="ar">→</span>
      <span class="op d">D<sub>k₂</sub><br><small>{{ hex(K2, 3) }}</small></span><span class="ar">→</span>
      <span class="v">{{ hex(b) }}</span><span class="ar">→</span>
      <span class="op e">E<sub>k₃</sub><br><small>{{ hex(K3, 3) }}</small></span><span class="ar">→</span>
      <span class="v">y<br><b>{{ hex(y) }}</b></span>
    </div>
    <div class="out prose">
      <template v-if="variant === 'same'">
        k₁ = k₂ 时，D<sub>k₂</sub> 恰好抵消了 E<sub>k₁</sub>（中间值 {{ hex(b) }} = x），于是 y = E<sub>k₃</sub>(x) = <b>{{ hex(single) }}</b>，与单次加密完全一样 {{ y === single ? '✓' : '✗' }}。
        这就是中间用 <b>D</b> 而不是 E 的原因：<b>向后兼容</b>，三重 DES 设备把三个密钥设成相同就能和老的单 DES 设备互通。<span style="color:var(--ink-3)">（补充说明）</span>
      </template>
      <template v-else-if="variant === '2key'">两密钥变体：F″(x) = F<sub>k₁</sub>(F⁻¹<sub>k₂</sub>(F<sub>k₁</sub>(x)))，密钥长 2n 位（真实 DES 为 112 位）。</template>
      <template v-else>三密钥变体：F″(x) = F<sub>k₃</sub>(F⁻¹<sub>k₂</sub>(F<sub>k₁</sub>(x)))，密钥长 3n 位（真实 DES 为 168 位），但由于中间相遇攻击，安全强度只有约 2n 位（112 位）。</template>
    </div>

    <hr style="border:0;border-top:1px dashed var(--line);margin:16px 0 10px">
    <p style="margin:0 0 6px;font-weight:650">为什么不用“双重加密” E<sub>k₂</sub>(E<sub>k₁</sub>(x))？—— 中间相遇攻击</p>
    <p class="widget-note">敌手已知两对明密文（双重加密，秘密密钥 k₁、k₂ 共 24 位）：({{ hex(m1) }} → {{ hex(c1) }})、({{ hex(m2) }} → {{ hex(c2) }})。</p>
    <div class="ctrl">
      <button class="btn" @click="newSecret">🎲 换一对秘密密钥</button>
      <button class="btn primary" @click="attack">⚔ 运行中间相遇攻击</button>
    </div>
    <div class="mitm">
      <div class="col"><b>① 正向</b>：对全部 2¹² 个 k₁ 计算 E<sub>k₁</sub>(m₁)，存入表</div>
      <div class="mid">⇢ 在中间值处相遇 ⇠</div>
      <div class="col"><b>② 反向</b>：对全部 2¹² 个 k₂ 计算 D<sub>k₂</sub>(c₁)，查表</div>
    </div>
    <div v-if="res" class="stats">
      <div class="stat"><b>{{ 4096 * 2 }}</b><span>密码运算次数 ≈ 2·2¹²</span></div>
      <div class="stat"><b>16,777,216</b><span>穷举 (k₁,k₂) 需要 2²⁴ 次</span></div>
      <div class="stat"><b>{{ res.cand.length }}</b><span>满足第 1 对的候选（≈ 2²⁴/2¹⁶ = 256）</span></div>
      <div class="stat"><b :class="res.final.length ? 'ok-c' : 'bad-c'">{{ res.final.length }}</b><span>再用第 2 对过滤后剩下</span></div>
      <div class="stat"><b>{{ res.ms.toFixed(1) }} ms</b><span>实际耗时</span></div>
    </div>
    <div v-if="res" class="out prose">
      找到的密钥：<b v-for="([a, b], i) in res.final" :key="i" style="margin-right:10px;font-family:var(--vp-font-family-mono)">k₁={{ hex(a, 3) }}, k₂={{ hex(b, 3) }}</b>
      （真实答案 k₁={{ hex(s1, 3) }}, k₂={{ hex(s2, 3) }}）<br>
      结论：双重加密把密钥加长到 2n 位，攻击代价却只是约 2·2ⁿ 次运算 + 2ⁿ 的存储——对 DES 来说约 2⁵⁷，几乎没比单 DES 强。
      同样的思路用在三重加密上，只能“剥掉”一层，代价约 2²ⁿ，这就是 3DES（168 位密钥）只有 <b>112 位安全强度</b>的原因。<span style="color:var(--ink-3)">（课件 P46 课后阅读：教材 6.2.4 节）</span>
    </div>
  </Widget>
</template>

<style scoped>
.ede { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; margin: 10px 0; font-family: var(--vp-font-family-mono); }
.ede .v { padding: 6px 10px; border: 1px solid var(--line); border-radius: 7px; background: var(--vp-c-bg); text-align: center; font-size: 13px; color: var(--ink); }
.ede .op { padding: 6px 12px; border-radius: 7px; text-align: center; font-weight: 700; font-size: 14px; }
.ede .op small { font-weight: 400; font-size: 11px; }
.ede .op.e { background: var(--accent-soft); border: 1px solid var(--accent); color: var(--accent); }
.ede .op.d { background: var(--prin-bg); border: 1px solid var(--prin); color: var(--prin); }
.ede .ar { color: var(--ink-3); }
.mitm { display: grid; grid-template-columns: 1fr auto 1fr; gap: 10px; align-items: center; font-size: 13.5px; margin: 8px 0; }
.mitm .col { border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; background: var(--vp-c-bg); }
.mitm .mid { color: var(--warn); font-weight: 700; white-space: nowrap; }
@media (max-width: 640px) { .mitm { grid-template-columns: 1fr; } }
</style>
