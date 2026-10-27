<script setup lang="ts">
import { ref, computed } from 'vue'
import { frac } from '../lib/l02'

// Shannon 定理检查器：|M|=|K|=|C|=n 的小方案，编辑加密表与密钥分布，
// 检查两个条件，并直接用引理 3.3 验证是否完美保密
const n = ref(3)
const tbl = ref<number[][]>([])   // tbl[k][m] = 密文下标
const w = ref<number[]>([])       // 密钥权重
const preset = ref(0)
const PRESETS = ['移位 mod n（均匀）', '移位 mod n（密钥不均匀）', '某条消息有两把密钥', '自定义']

function load(i: number) {
  preset.value = i
  const N = n.value
  tbl.value = Array.from({ length: N }, (_, k) => Array.from({ length: N }, (_, m) => (m + k) % N))
  w.value = Array(N).fill(1)
  if (i === 1) w.value[0] = 2
  // 最后一把密钥换成另一个置换 [0, N-1, …, 1]：每行仍是置换（能正确解密），但 m1 这一列出现重复
  if (i === 2) tbl.value[N - 1] = [0, ...Array.from({ length: N - 1 }, (_, j) => N - 1 - j)]
}
function setN(v: number) { n.value = v; load(preset.value === 3 ? 0 : preset.value) }
load(0)

function cycle(k: number, m: number) {
  tbl.value[k][m] = (tbl.value[k][m] + 1) % n.value
  preset.value = 3
}

const tot = computed(() => w.value.reduce((a, b) => a + (+b || 0), 0) || 1)
const p = computed(() => w.value.map(x => (+x || 0) / tot.value))
// 正确性：每把密钥下 Enc_k 必须是单射，否则无法唯一解密
const badRows = computed(() => tbl.value.map((r, k) => (new Set(r).size !== r.length ? k : -1)).filter(k => k >= 0))
const cond1 = computed(() => p.value.every(x => Math.abs(x - 1 / n.value) < 1e-9))
// 条件 2：对每个 (m, c) 恰好存在一把 k 使 Enc_k(m) = c
const cnt = computed(() => Array.from({ length: n.value }, (_, m) => Array.from({ length: n.value }, (_, c) => tbl.value.filter(r => r[m] === c).length)))
const cond2 = computed(() => cnt.value.every(r => r.every(x => x === 1)))
// lik[m][c] = Pr[C=c | M=m]
const lik = computed(() => Array.from({ length: n.value }, (_, m) => Array.from({ length: n.value }, (_, c) =>
  tbl.value.reduce((a, r, k) => a + (r[m] === c ? p.value[k] : 0), 0))))
const colOk = (c: number) => lik.value.every(r => Math.abs(r[c] - lik.value[0][c]) < 1e-9)
const perfect = computed(() => Array.from({ length: n.value }, (_, c) => colOk(c)).every(Boolean))
const unusedC = computed(() => Array.from({ length: n.value }, (_, c) => c).filter(c => !tbl.value.some(r => r.includes(c))))
</script>

<template>
  <Widget title="Shannon 定理检查器">
    <p class="widget-note">一个 |ℳ| = |𝒦| = |𝒞| = n 的小方案。表格第 k 行第 m 列是 Enc<sub>k</sub>(m)，<b>点击格子</b>可以改成别的密文；右侧输入密钥权重（自动归一化）。</p>
    <div class="ctrl">
      <div class="seg"><button v-for="v in [3, 4]" :key="v" :class="{ on: n === v }" @click="setN(v)">n = {{ v }}</button></div>
      <div class="seg"><button v-for="(t, i) in PRESETS" :key="i" :class="{ on: preset === i }" @click="i < 3 && load(i)" :disabled="i === 3">{{ t }}</button></div>
    </div>
    <div class="two-col" style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;align-items:start">
      <div style="overflow-x:auto">
        <table class="mini-table">
          <thead><tr><th>Enc<sub>k</sub>(m)</th><th v-for="m in n" :key="m">m{{ m }}</th><th>权重 → Pr[k]</th></tr></thead>
          <tbody>
            <tr v-for="(r, k) in tbl" :key="k" :style="badRows.includes(k) ? 'background:var(--warn-bg)' : ''">
              <th>k{{ k + 1 }}</th>
              <td v-for="(cv, m) in r" :key="m" style="padding:3px 4px">
                <button class="btn" style="padding:3px 9px;font-family:var(--vp-font-family-mono)"
                  :style="cnt[m][cv] !== 1 ? 'border-color:var(--warn);color:var(--warn)' : ''" @click="cycle(k, m)">c{{ cv + 1 }}</button>
              </td>
              <td style="white-space:nowrap"><input v-model.number="w[k]" type="number" min="0" step="1" style="width:52px;font:13px var(--vp-font-family-mono);color:var(--ink);background:var(--vp-c-bg);border:1px solid var(--line);border-radius:6px;padding:2px 4px" @input="preset = 3"> {{ frac(p[k]) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div>
        <div class="out prose">
          <div>条件 1（每把密钥概率都是 1/{{ n }}）：<b :class="cond1 ? 'ok-c' : 'bad-c'">{{ cond1 ? '✓ 满足' : '✗ 不满足' }}</b></div>
          <div>条件 2（每对 (m, c) 恰有唯一一把密钥）：<b :class="cond2 ? 'ok-c' : 'bad-c'">{{ cond2 ? '✓ 满足' : '✗ 不满足（红框格子所在的 (m,c) 有 0 把或多把密钥）' }}</b></div>
          <div v-if="badRows.length" class="bad-c">注意：k{{ badRows.map(x => x + 1).join('、k') }} 这一行有重复密文，Enc 不可逆，无法正确解密，这已经不是合法的加密方案。</div>
          <div v-if="unusedC.length" class="bad-c">注意：c{{ unusedC.map(x => x + 1).join('、c') }} 从不出现，实际 |𝒞| &lt; n，定理前提不成立。</div>
        </div>
        <p class="widget-note" style="margin:10px 0 4px">直接验证（引理 3.3）：Pr[C=c | M=m] 矩阵，每一<b>列</b>都相同 ⇔ 完美保密</p>
        <table class="mini-table">
          <thead><tr><th></th><th v-for="c in n" :key="c" :style="colOk(c - 1) ? '' : 'color:var(--warn)'">c{{ c }}</th></tr></thead>
          <tbody>
            <tr v-for="(r, m) in lik" :key="m"><th>m{{ m + 1 }}</th><td v-for="(x, c) in r" :key="c" :style="colOk(c) ? '' : 'color:var(--warn);font-weight:700'">{{ frac(x) }}</td></tr>
          </tbody>
        </table>
        <div class="out prose" style="margin-top:10px">
          结论：<b :class="perfect ? 'ok-c' : 'bad-c'">{{ perfect ? '完美保密' : '不是完美保密' }}</b>
          <span class="muted">（条件 1 ∧ 条件 2 = {{ cond1 && cond2 ? '真' : '假' }}{{ !badRows.length && !unusedC.length ? '，与 Shannon 定理一致' : '' }}）</span>
        </div>
      </div>
    </div>
  </Widget>
</template>
