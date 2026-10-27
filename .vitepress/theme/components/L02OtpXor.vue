<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

// 一次一密：逐位异或动画 + 两种误用（密钥重用、已知明文）
const MODES = ['① 加密与解密', '② 密钥用了两次', '③ 已知明文攻击']
const mode = ref(0)

const MAXC = 6
const toBits = (s: string) => [...s.slice(0, MAXC)].flatMap(ch => {
  const v = ch.charCodeAt(0) & 0xff
  return Array.from({ length: 8 }, (_, i) => (v >> (7 - i)) & 1)
})
const toText = (b: number[]) => {
  let s = ''
  for (let i = 0; i + 8 <= b.length; i += 8) {
    const v = b.slice(i, i + 8).reduce((a, x) => a * 2 + x, 0)
    s += v >= 32 && v < 127 ? String.fromCharCode(v) : '·'
  }
  return s
}
const xor = (a: number[], b: number[]) => a.map((x, i) => x ^ (b[i] ?? 0))
const rnd = (n: number) => Array.from({ length: n }, () => (Math.random() < 0.5 ? 0 : 1))

// ① 加密
const pt = ref('attack')
const M = computed(() => toBits(pt.value))
// 服务端渲染时先用固定密钥，挂载后再换成随机密钥，避免水合不一致
const K = ref<number[]>(Array.from({ length: MAXC * 8 }, (_, i) => ((i * 7 + 3) >> 2) & 1))
onMounted(() => { K.value = rnd(MAXC * 8) })
const C = computed(() => xor(M.value, K.value))
const D = computed(() => xor(C.value, K.value))
const cur = ref(-1) // 动画进行到第几位（-1 表示全部显示）
let timer: ReturnType<typeof setInterval> | undefined
function stop() { if (timer) clearInterval(timer); timer = undefined }
function play() {
  stop()
  cur.value = 0
  timer = setInterval(() => {
    if (cur.value >= M.value.length - 1) { stop(); cur.value = -1; return }
    cur.value++
  }, 140)
}
function newKey() { stop(); cur.value = -1; K.value = rnd(MAXC * 8) }
watch(pt, () => { stop(); cur.value = -1 })
onUnmounted(stop)
const shown = (i: number) => cur.value < 0 || i <= cur.value

// ② 密钥重用
const p1 = ref('attack')
const p2 = ref('retire')
const C1 = computed(() => xor(toBits(p1.value), K.value))
const C2 = computed(() => xor(toBits(p2.value), K.value))
const X = computed(() => xor(C1.value, C2.value).slice(0, Math.min(C1.value.length, C2.value.length)))
const crib = ref('attack')
const recovered = computed(() => toText(xor(X.value, toBits(crib.value))))

// ③ 已知明文：M ⊕ C = K
const kpM = ref('101')
const kpC = ref('111')
const kpK = computed(() => {
  if (!/^[01]+$/.test(kpM.value) || !/^[01]+$/.test(kpC.value) || kpM.value.length !== kpC.value.length) return null
  return [...kpM.value].map((x, i) => (+x) ^ (+kpC.value[i])).join('')
})

const rows0 = computed(() => [{ n: 'M', b: M.value }, { n: 'K', b: K.value }, { n: 'C', b: C.value }, { n: 'C⊕K', b: D.value }])
const rows1 = computed(() => [{ n: 'C₁', b: C1.value }, { n: 'C₂', b: C2.value }, { n: 'C₁⊕C₂', b: X.value },
  { n: 'M₁⊕M₂', b: xor(toBits(p1.value), toBits(p2.value)) }])
const groups = (b: number[]) => Array.from({ length: Math.ceil(b.length / 8) }, (_, j) => b.slice(j * 8, j * 8 + 8))
</script>

<template>
  <Widget title="一次一密：逐位异或，以及它为什么只能用一次">
    <div class="ctrl">
      <div class="seg"><button v-for="(m, i) in MODES" :key="i" :class="{ on: mode === i }" @click="mode = i">{{ m }}</button></div>
    </div>

    <template v-if="mode === 0">
      <div class="ctrl">
        <label>明文（ASCII，最多 6 个字符）<input v-model="pt" type="text" maxlength="6" style="width:120px"></label>
        <button class="btn" @click="newKey">重新生成随机密钥</button>
        <button class="btn primary" @click="play">▶ 逐位加密</button>
      </div>
      <div class="cards">
        <div v-for="(_, j) in groups(M)" :key="j" class="bcard">
          <div class="bh">字符 “{{ pt[j] }}”<span v-if="cur < 0"> → 密文字节 → 解密得 “{{ toText(D.slice(j * 8, j * 8 + 8)) }}”</span></div>
          <div v-for="(row, r) in rows0" :key="r" class="brow">
            <span class="rn">{{ row.n }}</span>
            <span v-for="i in 8" :key="i" class="cell"
              :class="{ on: cur === j * 8 + i - 1 && r < 3 }"
              :style="{ opacity: r >= 2 && !shown(j * 8 + i - 1) ? .15 : 1, color: r === 1 ? 'var(--accent)' : r === 2 ? 'var(--warn)' : 'var(--ink)' }">{{ row.b[j * 8 + i - 1] }}</span>
          </div>
        </div>
      </div>
      <div class="out prose">
        异或真值表：0⊕0=0，0⊕1=1，1⊕0=1，1⊕1=0。密钥位是均匀随机的，所以每一个密文位都是均匀随机的，且与明文位<b>独立</b>——无论明文是什么。
        解密再异或一次同一个密钥：(M⊕K)⊕K = M⊕(K⊕K) = M⊕0 = M。
      </div>
    </template>

    <template v-else-if="mode === 1">
      <p class="widget-note">同一把密钥 K 加密了两条消息。敌手把两条密文异或，<b>密钥被消掉</b>，得到两条明文的异或。</p>
      <div class="ctrl">
        <label>M₁ <input v-model="p1" type="text" maxlength="6" style="width:110px"></label>
        <label>M₂ <input v-model="p2" type="text" maxlength="6" style="width:110px"></label>
      </div>
      <p class="widget-note" style="margin:0">每块从上到下：C₁ = M₁⊕K，C₂ = M₂⊕K，C₁⊕C₂，M₁⊕M₂（后两行永远相同）</p>
      <div class="cards">
        <div v-for="(_, j) in groups(X)" :key="j" class="bcard">
          <div class="bh">“{{ p1[j] }}” 与 “{{ p2[j] }}”</div>
          <div v-for="(row, r) in rows1" :key="r" class="brow">
            <span class="rn">{{ row.n }}</span>
            <span v-for="i in 8" :key="i" class="cell" :style="{ color: r >= 2 ? 'var(--warn)' : 'var(--ink)' }">{{ row.b[j * 8 + i - 1] }}</span>
          </div>
        </div>
      </div>
      <div class="ctrl">
        <label>敌手猜测 M₁ 可能是 <input v-model="crib" type="text" maxlength="6" style="width:110px"></label>
      </div>
      <div class="out"><span class="lbl">C₁⊕C₂⊕(猜测的 M₁) = M₂ ？</span>{{ recovered }}</div>
      <p class="widget-note" style="margin:8px 0 0">猜对 M₁（哪怕只猜对一部分，如常见词 “the”），就能直接读出 M₂ 的对应位置。这就是 “two-time pad” 攻击。</p>
    </template>

    <template v-else>
      <p class="widget-note">只要敌手知道一对 (M, C)，就能算出密钥 K = M ⊕ C——这把密钥若再被使用，后面的密文全部暴露。</p>
      <div class="ctrl">
        <label>M <input v-model="kpM" type="text" style="width:120px"></label>
        <label>C = Enc<sub>K</sub>(M) <input v-model="kpC" type="text" style="width:120px"></label>
      </div>
      <div class="out"><span class="lbl">K = M ⊕ C</span>{{ kpK ?? '请输入等长的 0/1 串' }}</div>
    </template>
  </Widget>
</template>

<style scoped>
/* 每个字节一块卡片，卡片自动换行，窄屏也不需要横向滚动 */
.cards { display: flex; flex-wrap: wrap; gap: 10px; margin: 10px 0; }
.bcard { border: 1px solid var(--line); border-radius: 8px; padding: 6px 8px; background: var(--vp-c-bg); }
.bh { font-size: 12px; color: var(--ink-3); margin-bottom: 4px; white-space: nowrap; }
.brow { display: flex; align-items: center; gap: 1px; margin: 2px 0; white-space: nowrap; }
.rn { flex: none; width: 50px; font: 600 11.5px var(--vp-font-family-mono); color: var(--ink-2); }
.brow .cell { width: 15px; height: 21px; font-size: 12px; border-radius: 3px; }
</style>
