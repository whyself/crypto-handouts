<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { SCHEMES, parse, show, cipherDist, keysTo, sampleKey, frac, fix } from '../lib/l02'

// 贝叶斯后验计算器：改明文分布、改观察到的密文，看后验是否等于先验
const IDS = ['shft1', 'shft2', 'shft1bias', 'otp4']
const PRESET: Record<string, { ms: [string, number][]; c: string }> = {
  shft1: { ms: [['b', 60], ['g', 40]], c: 'Z' },
  shft2: { ms: [['ann', 60], ['bob', 40]], c: 'DQQ' },
  shft1bias: { ms: [['b', 60], ['g', 40]], c: 'B' },
  otp4: { ms: [['0000', 50], ['1111', 30], ['1010', 20]], c: '0110' }
}
const sid = ref('shft1')
const S = computed(() => SCHEMES[sid.value])
const rows = ref<{ m: string; w: number }[]>([])
const cs = ref('')
function load() {
  const p = PRESET[sid.value]
  rows.value = p.ms.map(([m, w]) => ({ m, w }))
  cs.value = p.c
}
load()
watch(sid, load)

const total = computed(() => rows.value.reduce((a, r) => a + (+r.w || 0), 0) || 1)
const cNorm = computed(() => cs.value.trim().toUpperCase())
const cOk = computed(() => !!parse(S.value, cNorm.value.toLowerCase()))

const table = computed(() => rows.value.map(r => {
  const m = parse(S.value, r.m)
  const prior = (+r.w || 0) / total.value
  if (!m || !cOk.value) return { m: r.m, ok: !!m, prior, lik: 0, joint: 0, keys: '' }
  const lik = cipherDist(S.value, m).get(cNorm.value) || 0
  const ks = keysTo(S.value, m, cNorm.value)
  const keys = ks.length === 0 ? '不存在（∅）' : ks.length <= 2 ? ks.map(k => k.label).join('，') : `${ks.length} 把`
  return { m: r.m, ok: true, prior, lik, joint: prior * lik, keys }
}))
const pc = computed(() => table.value.reduce((a, r) => a + r.joint, 0))
const post = computed(() => table.value.map(r => (pc.value > 0 ? r.joint / pc.value : 0)))
const dup = computed(() => new Set(rows.value.map(r => r.m.trim().toLowerCase())).size !== rows.value.length)
const allOk = computed(() => table.value.every(r => r.ok) && cOk.value && !dup.value)
const same = computed(() => table.value.every((r, i) => Math.abs(r.prior - post.value[i]) < 1e-9))

function add() { if (rows.value.length < 4) rows.value.push({ m: S.value.defaults[0], w: 10 }) }
function del(i: number) { if (rows.value.length > 2) rows.value.splice(i, 1) }
// 按当前分布抽一条消息、按 Gen 抽一把密钥，加密得到一条“真实可能出现”的密文
function sample() {
  let r = Math.random() * total.value
  let pick = rows.value[0]
  for (const x of rows.value) { r -= +x.w || 0; if (r <= 0) { pick = x; break } }
  const m = parse(S.value, pick.m)
  if (m) cs.value = show(S.value, S.value.enc(sampleKey(S.value).k, m), true)
}
</script>

<template>
  <Widget title="后验 = 先验？贝叶斯计算器">
    <p class="widget-note">设定明文的先验分布（权重会自动归一化），输入敌手看到的密文 c，按全概率公式与贝叶斯定理算出后验 Pr[M=m | C=c]。完美保密要求：对<b>任意</b>先验、任意可能出现的 c，后验都等于先验。</p>
    <div class="ctrl">
      <div class="seg"><button v-for="id in IDS" :key="id" :class="{ on: sid === id }" @click="sid = id" v-html="SCHEMES[id].name" /></div>
    </div>
    <p class="widget-note" style="margin:0">{{ S.note }}</p>
    <div class="ctrl" v-for="(r, i) in rows" :key="i">
      <label>m<sub>{{ i + 1 }}</sub> <input v-model="r.m" type="text" style="width:80px"></label>
      <label>权重 <input v-model.number="r.w" type="range" min="0" max="100"></label>
      <span style="font:13px var(--vp-font-family-mono);color:var(--ink-2)">Pr[M={{ r.m }}] = {{ fix(table[i].prior, 3) }}</span>
      <button class="btn" v-if="rows.length > 2" @click="del(i)">删除</button>
    </div>
    <div class="ctrl">
      <button class="btn" v-if="rows.length < 4" @click="add">+ 再加一条候选消息</button>
      <label>观察到的密文 c <input v-model="cs" type="text" style="width:90px"></label>
      <button class="btn primary" @click="sample">按分布随机加密一次</button>
    </div>
    <div v-if="!allOk" class="out prose bad-c">
      {{ dup ? '候选消息有重复。' : `消息与密文都必须是 ${S.len} 个${S.alpha === 'bit' ? '比特（0/1）' : '英文字母'}。` }}
    </div>
    <template v-else>
      <div style="overflow-x:auto">
        <table class="mini-table">
          <thead><tr><th>m</th><th>先验 Pr[M=m]</th><th>把 m 加密成 {{ cNorm }} 的密钥</th><th>Pr[C={{ cNorm }} | M=m]</th><th>乘积</th><th>后验 Pr[M=m | C={{ cNorm }}]</th></tr></thead>
          <tbody>
            <tr v-for="(r, i) in table" :key="i">
              <td style="font-family:var(--vp-font-family-mono)">{{ r.m }}</td>
              <td>{{ fix(r.prior) }}</td>
              <td>{{ r.keys }}</td>
              <td>{{ frac(r.lik) }}</td>
              <td>{{ fix(r.joint, 5) }}</td>
              <td :style="{ fontWeight: 700, color: Math.abs(post[i] - r.prior) < 1e-9 ? 'var(--ex)' : 'var(--warn)' }">{{ pc > 0 ? fix(post[i]) : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="out prose" style="margin-top:10px">
        全概率公式：Pr[C={{ cNorm }}] = Σ Pr[M=m]·Pr[C={{ cNorm }} | M=m] = <b>{{ fix(pc, 5) }}</b>
        <span v-if="pc > 0">（≈ {{ frac(pc) }}）</span>
      </div>
      <div v-if="pc > 0" class="bars">
        <div v-for="(r, i) in table" :key="i" class="bar-row">
          <span class="bn">{{ r.m }}</span>
          <div class="bw">
            <div class="bar" :style="{ width: r.prior * 100 + '%', background: 'var(--ink-3)' }" />
            <div class="bar" :style="{ width: post[i] * 100 + '%', background: Math.abs(post[i] - r.prior) < 1e-9 ? 'var(--ex)' : 'var(--warn)' }" />
          </div>
        </div>
        <p class="widget-note" style="margin:4px 0 0">灰条 = 先验，彩条 = 后验</p>
      </div>
      <div class="out prose">
        <template v-if="pc === 0">在这个分布下 Pr[C={{ cNorm }}] = 0，这个密文根本不会出现，定义对它不作要求。点“按分布随机加密一次”换一个。</template>
        <template v-else-if="same"><b class="ok-c">后验 = 先验</b>：看到密文后，敌手对明文的认识没有任何改变。</template>
        <template v-else><b class="bad-c">后验 ≠ 先验</b>：密文泄露了关于明文的信息，该方案<b>不是</b>完美保密的（一个反例就够）。</template>
      </div>
    </template>
  </Widget>
</template>

<style scoped>
.bars { margin: 10px 0; }
.bar-row { display: flex; align-items: center; gap: 10px; margin: 4px 0; }
.bn { width: 52px; font: 13px var(--vp-font-family-mono); color: var(--ink-2); }
.bw { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.bar { height: 9px; border-radius: 4px; transition: width .3s; min-width: 1px; }
</style>
