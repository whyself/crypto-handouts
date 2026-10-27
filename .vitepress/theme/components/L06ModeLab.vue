<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { type Mode, modeEnc, modeDec, textToBlocks, blockToText, hex, popcount } from '../lib/l06'

// 工作模式实验台：同一明文在四种模式下的密文、重复加密、密文出错后的传播范围
// 底层分组密码是 Toy16（16 位教学用玩具 SPN），每块 = 2 个字符
const MODES: Mode[] = ['ECB', 'CBC', 'OFB', 'CTR']
const INFO: Record<Mode, { inv: boolean; encPar: boolean; decPar: boolean; pre: boolean; rnd: boolean; cpa: boolean }> = {
  ECB: { inv: true, encPar: true, decPar: true, pre: false, rnd: false, cpa: false },
  CBC: { inv: true, encPar: false, decPar: true, pre: false, rnd: true, cpa: true },
  OFB: { inv: false, encPar: false, decPar: false, pre: true, rnd: true, cpa: true },
  CTR: { inv: false, encPar: true, decPar: true, pre: true, rnd: true, cpa: true }
}
const mode = ref<Mode>('ECB')
const pt = ref('attack!!attack!!')
const KEY = 0x3A94D63F
const rnd16 = () => Math.floor(Math.random() * 65536)
const iv1 = ref(0x5C21)
const iv2 = ref(0xA0E7)
const fixedIv = ref(false)
const flipAt = ref(-1) // 被翻转了 1 位的密文块下标（在完整密文数组中）

const blocks = computed(() => textToBlocks(pt.value || '..'))
const c1 = computed(() => modeEnc(mode.value, blocks.value, KEY, iv1.value))
const c2 = computed(() => modeEnc(mode.value, blocks.value, KEY, fixedIv.value ? iv1.value : iv2.value))
const hasIv = computed(() => mode.value !== 'ECB')

// 统计重复出现的密文块，给相同的块涂相同颜色
const PALETTE = ['#e3a33b', '#3b9fd8', '#c45ab3', '#4caf7a', '#d8613b', '#7a6fd8']
function repeatColors(arr: number[]) {
  const cnt = new Map<number, number>(), col = new Map<number, string>()
  arr.forEach(v => cnt.set(v, (cnt.get(v) || 0) + 1))
  let n = 0
  for (const [v, k] of cnt) if (k > 1) col.set(v, PALETTE[n++ % PALETTE.length])
  return col
}
const ptColors = computed(() => repeatColors(blocks.value))
const ctColors = computed(() => repeatColors(c1.value.slice(hasIv.value ? 1 : 0)))
const repeats = computed(() => ctColors.value.size)

// 传输出错：把第 flipAt 个密文块的最低位翻转，再解密
const corrupted = computed(() => c1.value.map((v, i) => (i === flipAt.value ? v ^ 1 : v)))
const dec = computed(() => modeDec(mode.value, corrupted.value, KEY))
const diffBits = computed(() => dec.value.map((d, i) => popcount(d ^ blocks.value[i])))
const badBlocks = computed(() => diffBits.value.filter(x => x).length)

watch([mode, pt], () => { flipAt.value = -1 })
function newIv() { iv1.value = rnd16(); iv2.value = rnd16(); flipAt.value = -1 }
const yes = (b: boolean) => (b ? '✓' : '✗')

const propNote = computed(() => {
  if (flipAt.value < 0) return '点击上方“第 1 次加密”中的任意一个密文块（含 IV），模拟传输中翻转了它的 1 个比特。'
  const isIv = hasIv.value && flipAt.value === 0
  const m = mode.value
  if (m === 'ECB') return 'ECB：只有被改的那一块解密出乱码（约一半比特出错），其余块不受影响。'
  if (m === 'CBC') return isIv
    ? 'CBC：IV 翻转 1 位 → 只有 m₁ 的同一位置翻转 1 位（m₁ = F⁻¹(c₁) ⊕ IV）。'
    : 'CBC：被改的块 cᵢ 经过 F⁻¹ 后整块变乱码；下一块 mᵢ₊₁ = F⁻¹(cᵢ₊₁) ⊕ cᵢ 只在同一位置翻转 1 位；再往后完全正常——错误最多影响两块（“自同步”）。'
  if (m === 'OFB') return isIv
    ? 'OFB：IV 错了 → 整条密钥流 y₁, y₂, … 全变，所有块都解错。'
    : 'OFB：cᵢ = mᵢ ⊕ yᵢ，密钥流不依赖密文，所以只有同一块的同一位翻转——像流密码一样“位对位”，但也意味着敌手可以定点翻转明文比特。'
  return isIv
    ? 'CTR：ctr 错了 → 每块的 Fₖ(ctr+i) 全变，所有块都解错。'
    : 'CTR：与 OFB 相同，只有同一块的同一位翻转。'
})
</script>

<template>
  <Widget title="工作模式实验台：ECB / CBC / OFB / CTR">
    <p class="widget-note">底层分组密码是本页自制的 <b>Toy16</b>（16 位分组的玩具 SPN，仅供教学），每块装 2 个字符。颜色相同的块 = 取值相同的块。</p>
    <div class="ctrl">
      <div class="seg">
        <button v-for="m in MODES" :key="m" :class="{ on: mode === m }" @click="mode = m">{{ m }}</button>
      </div>
      <button class="btn" @click="pt = 'attack!!attack!!'">预设：attack!!attack!!</button>
      <button class="btn" @click="pt = 'YES!YES!NO!!YES!'">预设：YES!YES!NO!!YES!</button>
    </div>
    <div class="ctrl"><label style="width:100%">明文<input v-model="pt" type="text" maxlength="24" style="flex:1"></label></div>

    <div class="row-lbl">明文分块 m₁ … mₗ</div>
    <div class="blocks">
      <span v-if="hasIv" class="blk ghost"><b>&nbsp;</b><small>&nbsp;</small></span>
      <span v-for="(b, i) in blocks" :key="'p' + i" class="blk"
        :style="ptColors.get(b) ? { borderColor: ptColors.get(b), boxShadow: `inset 0 -4px 0 ${ptColors.get(b)}` } : {}">
        <b>{{ blockToText(b) }}</b><small>{{ hex(b) }}</small>
      </span>
    </div>

    <div class="row-lbl">第 1 次加密 → 密文 <span v-if="hasIv">（第一块是 {{ mode === 'CTR' ? 'ctr' : 'IV' }}，明文发送）</span> · 点一块可翻转它的 1 位</div>
    <div class="blocks">
      <button v-for="(c, i) in c1" :key="'c' + i" class="blk click" :class="{ iv: hasIv && i === 0, flip: i === flipAt }"
        :style="!(hasIv && i === 0) && ctColors.get(c) ? { borderColor: ctColors.get(c), boxShadow: `inset 0 -4px 0 ${ctColors.get(c)}` } : {}"
        @click="flipAt = flipAt === i ? -1 : i">
        <b>{{ hex(i === flipAt ? c ^ 1 : c) }}</b><small>{{ hasIv && i === 0 ? (mode === 'CTR' ? 'ctr' : 'IV') : 'c' + (hasIv ? i : i + 1) }}</small>
      </button>
    </div>

    <div class="row-lbl">第 2 次加密同一明文 <span v-if="hasIv">（{{ fixedIv ? '沿用同一个 IV —— 错误用法' : '换一个新的随机 IV' }}）</span></div>
    <div class="blocks">
      <span v-for="(c, i) in c2" :key="'d' + i" class="blk" :class="{ iv: hasIv && i === 0, same: c === c1[i] && !(hasIv && i === 0) }">
        <b>{{ hex(c) }}</b><small>{{ c === c1[i] && !(hasIv && i === 0) ? '相同!' : '' }}&nbsp;</small>
      </span>
    </div>
    <div class="ctrl" style="margin-top:6px">
      <button class="btn" :disabled="!hasIv" @click="newIv">🎲 重新选随机 IV</button>
      <label><input v-model="fixedIv" type="checkbox" :disabled="!hasIv"> 两次加密用同一个 IV / ctr</label>
    </div>

    <div class="row-lbl">接收方解密（{{ flipAt < 0 ? '密文无差错' : '密文有 1 位差错' }}）</div>
    <div class="blocks">
      <span v-if="hasIv" class="blk ghost"><b>&nbsp;</b><small>&nbsp;</small></span>
      <span v-for="(d, i) in dec" :key="'m' + i" class="blk" :class="{ bad: diffBits[i] > 1, one: diffBits[i] === 1 }">
        <b>{{ blockToText(d) }}</b><small>{{ diffBits[i] ? diffBits[i] + ' 位错' : 'OK' }}</small>
      </span>
    </div>
    <div class="out prose" style="margin-top:8px">{{ propNote }}<span v-if="flipAt >= 0">（本次：{{ badBlocks }} 块受影响）</span></div>

    <div class="stats">
      <div class="stat"><b :class="repeats ? 'bad-c' : 'ok-c'">{{ repeats }}</b><span>第 1 次密文中重复的块值</span></div>
      <div class="stat"><b>{{ yes(INFO[mode].rnd) }}</b><span>概率加密（随机 IV）</span></div>
      <div class="stat"><b :class="INFO[mode].cpa ? 'ok-c' : 'bad-c'">{{ yes(INFO[mode].cpa) }}</b><span>F 为 PRF/PRP 时 CPA 安全</span></div>
      <div class="stat"><b>{{ INFO[mode].inv ? '需要' : '不需要' }}</b><span>解密要用 F⁻¹</span></div>
      <div class="stat"><b>{{ yes(INFO[mode].encPar) }} / {{ yes(INFO[mode].decPar) }}</b><span>加密 / 解密可并行</span></div>
      <div class="stat"><b>{{ yes(INFO[mode].pre) }}</b><span>密钥流可预计算</span></div>
    </div>
  </Widget>
</template>

<style scoped>
.row-lbl { font-size: 12.5px; color: var(--ink-3); margin: 10px 0 4px; }
.blocks { display: flex; flex-wrap: wrap; gap: 6px; }
.blk { display: inline-flex; flex-direction: column; align-items: center; justify-content: center; min-width: 58px; padding: 4px 6px;
  border: 1.5px solid var(--line); border-radius: 7px; background: var(--vp-c-bg); font-family: var(--vp-font-family-mono); color: var(--ink); }
.blk b { font-size: 15px; white-space: pre; }
.blk small { font-size: 10px; color: var(--ink-3); }
.blk.ghost { visibility: hidden; }
.blk.click { cursor: pointer; }
.blk.click:hover { border-color: var(--accent); }
.blk.iv { background: var(--prin-bg); border-style: dashed; }
.blk.flip { background: var(--warn-bg); border-color: var(--warn) !important; }
.blk.same { background: var(--warn-bg); border-color: var(--warn); }
.blk.same small, .blk.bad small { color: var(--warn); font-weight: 700; }
.blk.bad { background: var(--warn-bg); border-color: var(--warn); }
.blk.one { background: var(--accent-soft); border-color: var(--accent); }
.blk.one small { color: var(--accent); font-weight: 700; }
</style>
