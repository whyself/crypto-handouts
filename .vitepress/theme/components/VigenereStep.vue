<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { A, idx, lettersOnly } from '../lib/crypto'

// 维吉尼亚逐字母加密：step 为当前高亮列，-1 表示尚未开始
const pt = ref('tellhimaboutme')
const key = ref('cafe')
const step = ref(-1)
const showAll = ref(false)
let timer: ReturnType<typeof setInterval> | null = null
const playing = ref(false)

const cols = computed(() => {
  const p = lettersOnly(pt.value), k = lettersOnly(key.value) || 'a'
  return [...p].map((ch, i) => {
    const kc = k[i % k.length]
    return { p: ch, k: kc, c: A[(idx(ch) + idx(kc)) % 26].toUpperCase() }
  })
})
const keyLen = computed(() => (lettersOnly(key.value) || 'a').length)

function stop() { if (timer) clearInterval(timer); timer = null; playing.value = false }
function restartIfDone() { if (step.value >= cols.value.length - 1) { step.value = -1; showAll.value = false } }
function next() {
  showAll.value = false
  if (step.value < cols.value.length - 1) step.value++
  else stop()
}
function play() {
  if (playing.value) return stop()
  restartIfDone()
  playing.value = true
  next()
  timer = setInterval(next, 900)
}
function single() { stop(); restartIfDone(); next() }
function all() { stop(); step.value = cols.value.length - 1; showAll.value = true }
watch([pt, key], () => { stop(); step.value = -1; showAll.value = false })
onUnmounted(stop)

const cur = computed(() => (step.value >= 0 && !showAll.value ? cols.value[step.value] : null))
const prevSame = computed(() => cur.value ? cols.value.slice(0, step.value).map((c, j) => ({ ...c, j })).filter(c => c.p === cur.value!.p) : [])
const explain = computed(() => {
  if (showAll.value) return '密文：<b style="font-family:var(--vp-font-family-mono)">' + cols.value.map(c => c.c).join('') + '</b>'
  const d = cur.value
  if (!d) return `密钥 “${lettersOnly(key.value) || 'a'}” 循环重复：第 i 个字母用第 (i mod ${keyLen.value}) 个密钥字母做移位。`
  let s = `第 ${step.value} 位：<b style="font-family:var(--vp-font-family-mono)">${d.p}(${idx(d.p)}) + ${d.k}(${idx(d.k)}) = ${idx(d.p) + idx(d.k)} mod 26 = ${idx(d.c)} → ${d.c}</b>`
  if (prevSame.value.length) s += `　<span style="color:var(--prin)">· 前面的 “${d.p}” 被加密成了 ${prevSame.value.map(c => c.c).join('、')}（蓝框），这次是 ${d.c}</span>`
  return s
})
const isMark = (j: number) => prevSame.value.some(c => c.j === j)
</script>

<template>
  <Widget title="维吉尼亚逐字母加密">
    <div class="ctrl">
      <label>明文<input v-model="pt" type="text" style="width:190px"></label>
      <label>密钥<input v-model="key" type="text" style="width:100px"></label>
      <button class="btn primary" @click="play">{{ playing ? '⏸ 暂停' : '▶ 逐步播放' }}</button>
      <button class="btn" @click="single">单步</button>
      <button class="btn" @click="all">全部显示</button>
    </div>
    <div style="overflow-x:auto;padding-bottom:4px">
      <div :style="{ display: 'grid', gap: '4px', width: 'max-content', gridTemplateColumns: `44px repeat(${cols.length}, 30px)` }">
        <div class="row-lbl">明文</div>
        <div v-for="(c, i) in cols" :key="'p' + i" class="cell" :class="{ on: cur && i === step }">{{ c.p }}<small>{{ idx(c.p) }}</small></div>
        <div class="row-lbl">密钥</div>
        <div v-for="(c, i) in cols" :key="'k' + i" class="cell" :class="{ on: cur && i === step }" style="color:var(--accent)">{{ c.k }}<small>{{ idx(c.k) }}</small></div>
        <div class="row-lbl">密文</div>
        <div v-for="(c, i) in cols" :key="'c' + i" class="cell" :class="{ on: cur && i === step, mark: isMark(i) }"
          :style="{ opacity: i <= step ? 1 : .15 }">{{ c.c }}<small>{{ idx(c.c) }}</small></div>
      </div>
    </div>
    <div class="out prose" style="margin-top:10px" v-html="explain" />
  </Widget>
</template>

<style scoped>
.row-lbl { font-size: 12px; color: var(--ink-3); align-self: center; }
</style>
