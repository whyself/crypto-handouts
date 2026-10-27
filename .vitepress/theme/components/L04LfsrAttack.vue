<script setup lang="ts">
import { ref, computed } from 'vue'
import { lfsrRun, solveGF2 } from '../lib/l04'

// LFSR 重构攻击：观察 2n 个连续输出位 → 前 n 位即初始状态 → 列 n 个 GF(2) 线性方程 → 高斯消元解出抽头
const mode = ref<'slides' | 'hidden' | 'custom'>('slides')
const n = ref(4)
const secretC = ref<number[]>([1, 0, 1, 0])     // 隐藏的真实抽头 c_i（下标即 i）
const secretS = ref<number[]>([1, 1, 0, 0])     // 隐藏的初始状态 s_i^(0)
const custom = ref('1100111110')
const stepIdx = ref(0)

const EXTRA = 24
// 敌手看到的 2n 位（以及之后用于验证的若干位）
const truth = computed(() => lfsrRun(secretS.value, secretC.value, 2 * n.value + EXTRA))
const obs = computed<number[]>(() => {
  if (mode.value === 'custom') {
    const b = custom.value.replace(/[^01]/g, '').split('').map(Number)
    return b.slice(0, 2 * Math.floor(b.length / 2))
  }
  return truth.value.slice(0, 2 * n.value)
})
const nn = computed(() => (mode.value === 'custom' ? obs.value.length / 2 : n.value))
const names = computed(() => Array.from({ length: nn.value }, (_, k) => 'c' + (nn.value - 1 - k)))
// 第 t 个方程：y_{n+t+1} = c_{n-1}·y_{t+n} ⊕ … ⊕ c_0·y_{t+1}
const A = computed(() => Array.from({ length: nn.value }, (_, t) => Array.from({ length: nn.value }, (_, k) => obs.value[t + nn.value - 1 - k])))
const b = computed(() => Array.from({ length: nn.value }, (_, t) => obs.value[nn.value + t]))
const res = computed(() => (nn.value ? solveGF2(A.value, b.value, names.value) : null))
const shown = computed(() => res.value ? res.value.steps[Math.min(stepIdx.value, res.value.steps.length - 1)] : null)
const done = computed(() => !!res.value && stepIdx.value >= res.value.steps.length - 1)

// 用恢复出的 (状态, 抽头) 预测后续输出，与真实输出比对
const recC = computed(() => (res.value?.x ? res.value.x.slice().reverse() : null)) // 转回 c_0..c_{n-1}
const predict = computed(() => (recC.value ? lfsrRun(obs.value.slice(0, nn.value), recC.value, 2 * nn.value + EXTRA) : []))

function load(m: 'slides' | 'hidden' | 'custom') {
  mode.value = m
  stepIdx.value = 0
  if (m === 'slides') { n.value = 4; secretC.value = [1, 0, 1, 0]; secretS.value = [1, 1, 0, 0] }
  if (m === 'hidden') newHidden()
}
function newHidden() {
  const k = n.value < 4 ? 6 : n.value
  n.value = k
  secretC.value = Array.from({ length: k }, (_, i) => (i === 0 ? 1 : Math.random() < .5 ? 1 : 0))
  do { secretS.value = Array.from({ length: k }, () => (Math.random() < .5 ? 1 : 0)) } while (secretS.value.every(x => !x))
  stepIdx.value = 0
}
function setN(k: number) { n.value = k; newHidden() }
const eqText = (t: number) => {
  const N = nn.value
  return `y${N + t + 1} = ${obs.value[N + t]} = ` + A.value[t].map((v, k) => `${names.value[k]}·${v}`).join(' ⊕ ')
}
</script>

<template>
  <Widget title="LFSR 重构攻击：2n 位输出 → 解线性方程 → 恢复整个 LFSR">
    <p class="widget-note">敌手只看到连续 2n 个输出位。前 n 位正好就是初始状态 (s<sub>n−1</sub>,…,s<sub>0</sub>) 的逆序读出；后 n 位每一位都是前 n 位的一个<b>线性</b>组合，于是得到关于 c<sub>i</sub> 的 n 元线性方程组（模 2）。</p>
    <div class="ctrl">
      <div class="seg">
        <button :class="{ on: mode === 'slides' }" @click="load('slides')">课件例子（P35）</button>
        <button :class="{ on: mode === 'hidden' }" @click="load('hidden')">随机隐藏 LFSR</button>
        <button :class="{ on: mode === 'custom' }" @click="load('custom')">自己输入比特</button>
      </div>
      <template v-if="mode === 'hidden'">
        <div class="seg"><button v-for="k in [4, 5, 6, 7, 8]" :key="k" :class="{ on: n === k }" @click="setN(k)">n={{ k }}</button></div>
        <button class="btn" @click="newHidden">🎲 换一个</button>
      </template>
      <label v-if="mode === 'custom'" style="flex:1">2n 个比特<input v-model="custom" type="text" style="flex:1" @input="stepIdx = 0"></label>
    </div>

    <div v-if="nn" class="out" style="font-size:16px">
      <span class="lbl">观察到的 2n = {{ 2 * nn }} 个输出位（蓝 = 初始状态，橙 = 用来列方程的“右端”）</span>
      <span v-for="(v, i) in obs" :key="i" :style="{ color: i < nn ? 'var(--prin)' : 'var(--accent)', fontWeight: 700, marginRight: '4px' }">{{ v }}</span>
    </div>
    <p v-if="nn" style="margin:8px 0;font-size:14px">
      ① 初始状态：(s{{ nn - 1 }}, …, s0)<sup>(0)</sup> = (y{{ nn }}, …, y1) = <b style="font-family:var(--vp-font-family-mono)">({{ obs.slice(0, nn).slice().reverse().join(', ') }})</b>
    </p>
    <div v-if="nn" class="out prose" style="font-family:var(--vp-font-family-mono);font-size:13.5px">
      <span class="lbl">② 列出 {{ nn }} 个方程（第 t 个方程的系数就是 t 时刻的状态）</span>
      <div v-for="t in nn" :key="t">({{ t }})&nbsp; {{ eqText(t - 1) }}</div>
    </div>

    <template v-if="res && shown">
      <div class="ctrl" style="margin-top:10px">
        <span style="font-size:14px">③ 高斯消元（模 2）：第 {{ Math.min(stepIdx, res.steps.length - 1) + 1 }} / {{ res.steps.length }} 步</span>
        <button class="btn" :disabled="stepIdx === 0" @click="stepIdx--">上一步</button>
        <button class="btn primary" :disabled="done" @click="stepIdx++">下一步</button>
        <button class="btn" @click="stepIdx = res.steps.length - 1">直接看结果</button>
      </div>
      <p class="widget-note" style="margin:4px 0">{{ shown.note }}</p>
      <table class="mini-table" style="width:auto">
        <thead><tr><th v-for="nm in names" :key="nm">{{ nm }}</th><th>| b</th></tr></thead>
        <tbody>
          <tr v-for="(r, ri) in shown.rows" :key="ri">
            <td v-for="(v, k) in r.slice(0, nn)" :key="k" style="font-family:var(--vp-font-family-mono);text-align:center">{{ v }}</td>
            <td style="font-family:var(--vp-font-family-mono);color:var(--accent)">| {{ r[nn] }}</td>
          </tr>
        </tbody>
      </table>
      <div v-if="done" class="out prose" style="margin-top:10px">
        <template v-if="res.status === 'none'"><b class="bad-c">方程组无解</b>：这串比特不可能由任何 {{ nn }} 阶 LFSR 产生。</template>
        <template v-else>
          <b :class="res.status === 'unique' ? 'ok-c' : 'bad-c'">{{ res.status === 'unique' ? '唯一解' : '解不唯一' }}</b>：
          ({{ names.join(', ') }}) = <b style="font-family:var(--vp-font-family-mono)">({{ res.x!.join(', ') }})</b>
          <span v-if="res.status === 'many'">（自由变量：{{ res.free.map(i => names[i]).join('、') }}；这里取它们为 0 的一个特解。说明这 2n 位输出的“线性复杂度”小于 n，更短的 LFSR 就能生成它们——仍然可以预测后续输出。）</span>
          <span v-if="mode !== 'custom'">　真实抽头：<span style="font-family:var(--vp-font-family-mono)">({{ secretC.slice().reverse().join(', ') }})</span></span>
          <div style="margin-top:6px;font-family:var(--vp-font-family-mono);font-size:14px">
            <span class="lbl" style="font:12px var(--vp-font-family-base);color:var(--ink-3);display:block">④ 用恢复的 LFSR 预测之后的 {{ EXTRA }} 位{{ mode !== 'custom' ? '，并与真实输出逐位比对' : '' }}</span>
            预测：<span v-for="(v, i) in predict.slice(2 * nn)" :key="'p' + i" :style="{ color: mode !== 'custom' && v !== truth[2 * nn + i] ? 'var(--warn)' : 'var(--ex)' }">{{ v }}</span><br>
            <template v-if="mode !== 'custom'">真实：<span v-for="(v, i) in truth.slice(2 * nn)" :key="'t' + i">{{ v }}</span>
              　<b :class="predict.slice(2 * nn).every((v, i) => v === truth[2 * nn + i]) ? 'ok-c' : 'bad-c'">{{ predict.slice(2 * nn).every((v, i) => v === truth[2 * nn + i]) ? '全部命中 ✓' : '有偏差' }}</b>
            </template>
          </div>
        </template>
      </div>
    </template>
  </Widget>
</template>
