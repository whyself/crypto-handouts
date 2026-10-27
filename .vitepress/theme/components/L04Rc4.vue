<script setup lang="ts">
import { ref, computed } from 'vue'
import { utf8, hex } from '../lib/l04'

// RC4 逐步可视化：Init（KSA，打乱 S 盒）+ GetBits（PRGA，边交换边输出）
// N=16 是“缩小版”RC4（所有运算 mod 16），便于看清每一次交换；N=256 是标准 RC4
const N = ref(16)
const keyText = ref('Key')
const S = ref<number[]>([])
const T = ref<number[]>([])
const i = ref(0)
const j = ref(0)
const phase = ref<'ksa' | 'prga'>('ksa')
const ksaI = ref(0)
const out = ref<number[]>([])
const swap = ref<[number, number] | null>(null)
const tIdx = ref<number | null>(null)
const log = ref('点击“单步”开始 Init（KSA）。')
const line = ref(-1)
const playing = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null

const keyBytes = computed(() => { const b = utf8(keyText.value); return b.length ? b : [0] })

function reset() {
  stop()
  S.value = Array.from({ length: N.value }, (_, k) => k)
  T.value = Array.from({ length: N.value }, (_, k) => keyBytes.value[k % keyBytes.value.length] % N.value)
  i.value = 0; j.value = 0; ksaI.value = 0; phase.value = 'ksa'
  out.value = []; swap.value = null; tIdx.value = null; line.value = -1
  log.value = `S[k] := k，T[k] := key[k mod ${keyBytes.value.length}]${N.value < 256 ? ' mod ' + N.value : ''}（k = 0…${N.value - 1}），j := 0。点击“单步”。`
}
function setN(k: number) { N.value = k; reset() }

function step() {
  const n = N.value, s = S.value
  if (phase.value === 'ksa') {
    const ii = ksaI.value
    const jOld = j.value
    j.value = (j.value + s[ii] + T.value[ii]) % n
    log.value = `KSA i=${ii}：j := j + S[i] + T[i] = ${jOld} + ${s[ii]} + ${T.value[ii]} = ${j.value} (mod ${n})；交换 S[${ii}] 与 S[${j.value}]`
    ;[s[ii], s[j.value]] = [s[j.value], s[ii]]
    i.value = ii; swap.value = [ii, j.value]; tIdx.value = null; line.value = 1
    ksaI.value++
    if (ksaI.value === n) {
      phase.value = 'prga'; i.value = 0; j.value = 0
      log.value += `。KSA 结束，S 已被密钥打乱；令 i := 0, j := 0，进入 GetBits。`
    }
  } else {
    const iOld = i.value
    i.value = (i.value + 1) % n
    const jOld = j.value
    j.value = (j.value + s[i.value]) % n
    ;[s[i.value], s[j.value]] = [s[j.value], s[i.value]]
    const t = (s[i.value] + s[j.value]) % n
    const y = s[t]
    out.value.push(y)
    swap.value = [i.value, j.value]; tIdx.value = t; line.value = 2
    log.value = `GetBits：i := ${iOld}+1 = ${i.value}；j := ${jOld} + S[i] = ${j.value}；交换后 t := S[i] + S[j] = ${s[i.value]} + ${s[j.value]} = ${t}；输出 y = S[${t}] = ${y}`
  }
  S.value = s.slice()
}
function skipKsa() { stop(); while (phase.value === 'ksa') step() }
function gen(k: number) { stop(); skipKsa(); for (let r = 0; r < k; r++) step() }
function stop() { playing.value = false; if (timer) clearTimeout(timer); timer = null }
function play() {
  if (playing.value) return stop()
  playing.value = true
  const tick = () => {
    if (!playing.value) return
    step()
    if (phase.value === 'prga' && out.value.length >= 32) return stop()
    timer = setTimeout(tick, N.value === 16 ? 650 : 90)
  }
  tick()
}

// 布局：每行 16 格
const cs = computed(() => (N.value === 16 ? 40 : 30))
const rows = computed(() => N.value / 16)
const px = (k: number) => 10 + (k % 16) * cs.value
const py = (k: number) => 22 + Math.floor(k / 16) * cs.value
const posOf = computed(() => { const p: number[] = []; S.value.forEach((v, k) => { p[v] = k }); return p })
const role = (k: number) => {
  if (tIdx.value === k) return 't'
  if (swap.value && (swap.value[0] === k || swap.value[1] === k)) return 'sw'
  return ''
}
const fmtOut = computed(() => (N.value === 256 ? hex(out.value) : out.value.join(' ')))
reset()
</script>

<template>
  <Widget title="RC4：KSA 打乱 S 盒 + PRGA 逐字节输出">
    <p class="widget-note">每一格是 S 盒的一个位置，格内数字是该位置的值。<b>橙色</b>两格是本步刚交换的 S[i] 与 S[j]，<b>蓝色</b>是 PRGA 中被读出作为输出的 S[t]。注意 S 始终是 0…N−1 的一个<b>置换</b>——只交换、不改值。</p>
    <div class="ctrl">
      <div class="seg">
        <button :class="{ on: N === 16 }" @click="setN(16)">缩小版 N = 16</button>
        <button :class="{ on: N === 256 }" @click="setN(256)">标准 N = 256</button>
      </div>
      <label>密钥（ASCII）<input v-model="keyText" type="text" style="width:130px" @change="reset"></label>
      <span class="muted" style="font-size:12.5px">字节：{{ hex(keyBytes) }}</span>
    </div>
    <div class="ctrl">
      <button class="btn primary" @click="stop(); step()">单步 ▶</button>
      <button class="btn" @click="play">{{ playing ? '⏸ 暂停' : '⏵ 自动播放' }}</button>
      <button class="btn" :disabled="phase === 'prga'" @click="skipKsa">跳过 KSA</button>
      <button class="btn" @click="gen(10)">直接生成 10 个字节</button>
      <button class="btn" @click="reset">重置</button>
    </div>
    <svg :viewBox="`0 0 ${20 + 16 * cs} ${36 + rows * cs}`" style="width:100%;max-width:700px;height:auto;display:block;margin:auto">
      <text x="10" y="14" font-size="12" style="fill:var(--ink-3)">{{ phase === 'ksa' ? `阶段：Init / KSA（i = ${Math.min(ksaI, N - 1)} / ${N - 1}）` : `阶段：GetBits / PRGA（已输出 ${out.length} 个）` }}</text>
      <g v-for="k in N" :key="'b' + k">
        <rect :x="px(k - 1) + 1" :y="py(k - 1) + 1" :width="cs - 2" :height="cs - 2" rx="5"
          :style="{ fill: role(k - 1) === 't' ? 'var(--prin-bg)' : role(k - 1) === 'sw' ? 'var(--accent-soft)' : 'var(--vp-c-bg)', stroke: role(k - 1) === 't' ? 'var(--prin)' : role(k - 1) === 'sw' ? 'var(--accent)' : 'var(--line)' }" stroke-width="1.4" />
        <text v-if="N === 16" :x="px(k - 1) + cs / 2" :y="py(k - 1) + cs + 11" text-anchor="middle" font-size="9" style="fill:var(--ink-3)">{{ k - 1 }}</text>
      </g>
      <g v-for="v in N" :key="'v' + v" :style="{ transform: `translate(${px(posOf[v - 1]) + cs / 2}px, ${py(posOf[v - 1]) + cs / 2 + (N === 16 ? 5 : 4)}px)`, transition: 'transform .45s ease' }">
        <text text-anchor="middle" :font-size="N === 16 ? 15 : 10.5" font-weight="600" style="fill:var(--ink);font-family:var(--vp-font-family-mono)">{{ v - 1 }}</text>
      </g>
    </svg>
    <div class="two-col" style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;margin-top:10px">
      <div class="out prose" style="font-family:var(--vp-font-family-mono);font-size:13px;line-height:1.6">
        <span class="lbl">伪代码（所有加法 mod N）</span>
        <div :style="{ color: line === 1 ? 'var(--accent)' : 'var(--ink-2)', fontWeight: line === 1 ? 700 : 400 }">KSA: for i = 0..N−1:<br>&nbsp;&nbsp;j := j + S[i] + T[i]; swap(S[i], S[j])</div>
        <div :style="{ color: line === 2 ? 'var(--accent)' : 'var(--ink-2)', fontWeight: line === 2 ? 700 : 400, marginTop: '6px' }">PRGA: i := i + 1; j := j + S[i]<br>&nbsp;&nbsp;swap(S[i], S[j]); t := S[i] + S[j]; y := S[t]</div>
        <div style="margin-top:6px">i = {{ i }}，j = {{ j }}</div>
      </div>
      <div class="out prose"><span class="lbl">本步发生了什么</span>{{ log }}</div>
    </div>
    <div class="out" style="margin-top:10px"><span class="lbl">密钥流 y₁, y₂, …{{ N === 256 ? '（十六进制）' : '' }}</span>{{ fmtOut || '—' }}</div>
    <p class="widget-note" style="margin-top:8px">核对：标准 RC4 下密钥 “Key” 的密钥流前 10 字节应为 <code>EB 9F 77 81 B7 34 CA 72 A7 19</code>（常见测试向量），选 N = 256 后点“直接生成 10 个字节”即可验证。</p>
  </Widget>
</template>
