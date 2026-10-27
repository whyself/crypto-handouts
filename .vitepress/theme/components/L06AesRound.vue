<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { aesTrace, parseHexBytes, bytesHex, hex, popcount, type AesStep } from '../lib/l06'

// AES-128 逐步演示（真实算法，FIPS-197）：状态矩阵 4×4 字节，按列填充
const FIPS_PT = '3243f6a8885a308d313198a2e0370734'
const FIPS_KEY = '2b7e151628aed2a6abf7158809cf4f3c'
const FIPS_CT = '3925841D02DC09FBDC118597196A0B32'
const ptHex = ref(FIPS_PT)
const keyHex = ref(FIPS_KEY)
const idx = ref(1)
const cmp = ref(false)
const col = ref(0)

const pt = computed(() => parseHexBytes(ptHex.value))
const key = computed(() => parseHexBytes(keyHex.value))
const tr = computed(() => aesTrace(pt.value, key.value))
// 对照组：明文第 1 个字节的最高位翻转
const tr2 = computed(() => { const p = pt.value.slice(); p[0] ^= 0x80; return aesTrace(p, key.value) })
const N = computed(() => tr.value.stages.length)
watch([ptHex, keyHex], () => { if (idx.value >= N.value) idx.value = N.value - 1 })

const cur = computed(() => tr.value.stages[idx.value])
const prev = computed(() => tr.value.stages[Math.max(0, idx.value - 1)])
const other = computed(() => tr2.value.stages[idx.value])
const rk = computed(() => tr.value.rk[cur.value.round])
const ct = computed(() => bytesHex(tr.value.stages[N.value - 1].s))
const diffBytes = computed(() => cur.value.s.filter((b, i) => b !== other.value.s[i]).length)
const diffBits = computed(() => cur.value.s.reduce((a, b, i) => a + popcount(b ^ other.value.s[i]), 0))

const NAME: Record<AesStep, string> = { Init: '明文装入状态矩阵', SubBytes: 'SubBytes 字节代换', ShiftRows: 'ShiftRows 行移位', MixColumns: 'MixColumns 列混合', AddRoundKey: 'AddRoundKey 轮密钥加' }
const DESC: Record<AesStep, string> = {
  Init: '16 字节明文按<b>列</b>依次填入 4×4 状态矩阵：第 1–4 字节是第 0 列，依此类推。',
  SubBytes: '每个字节独立查同一张 8 位 S 盒（GF(2⁸) 求逆 + 仿射变换）——这是 AES 中唯一的<b>非线性</b>步骤，提供“混淆”。对应课件图中 A<sub>i</sub> → B<sub>i</sub>。',
  ShiftRows: '第 r 行循环左移 r 个字节（第 0 行不动）。它把同一列的 4 个字节分散到 4 个不同的列，为下一步的列混合做准备——“扩散”的一半。',
  MixColumns: '每一列看成 GF(2⁸) 上的 4 维向量，左乘固定的 4×4 矩阵。一列中任一字节变化会影响该列全部 4 个字节——“扩散”的另一半。<b>最后一轮没有这一步。</b>',
  AddRoundKey: '状态与本轮的 128 位轮密钥逐字节异或，即 SPN 中的“密钥混合”。第 0 轮在所有轮之前先做一次（白化），所以 10 轮共用 11 个轮密钥。'
}
const label = (i: number) => { const s = tr.value.stages[i]; return s.step === 'Init' ? '输入' : `第 ${s.round} 轮 · ${s.step}` }
// 状态矩阵第 r 行第 c 列 = s[r + 4c]
const at = (s: number[], r: number, c: number) => s[r + 4 * c]
const changed = (r: number, c: number) => idx.value > 0 && at(cur.value.s, r, c) !== at(prev.value.s, r, c)
const differs = (r: number, c: number) => cmp.value && at(cur.value.s, r, c) !== at(other.value.s, r, c)
const MIX = [[2, 3, 1, 1], [1, 2, 3, 1], [1, 1, 2, 3], [3, 1, 1, 2]]
function jump(step: AesStep) {
  const r = cur.value.round
  const i = tr.value.stages.findIndex(s => s.round === r && s.step === step)
  if (i >= 0) idx.value = i
}
const roundSteps = computed(() => tr.value.stages.filter(s => s.round === cur.value.round).map(s => s.step))
</script>

<template>
  <Widget title="AES-128 一轮四步：状态矩阵可视化">
    <p class="widget-note">这是<b>真实的 AES-128</b>。默认输入取自 FIPS-197 附录 B 的官方示例，可逐步核对。</p>
    <div class="ctrl">
      <label style="flex:1">明文（32 位 hex）<input v-model.lazy="ptHex" type="text" style="flex:1;font-family:var(--vp-font-family-mono)"></label>
    </div>
    <div class="ctrl">
      <label style="flex:1">密钥（32 位 hex）<input v-model.lazy="keyHex" type="text" style="flex:1;font-family:var(--vp-font-family-mono)"></label>
      <button class="btn" @click="ptHex = FIPS_PT; keyHex = FIPS_KEY">FIPS-197 示例</button>
      <button class="btn" @click="ptHex = '00'.repeat(16); keyHex = '00'.repeat(16)">全零</button>
    </div>
    <div class="ctrl">
      <button class="btn" :disabled="idx === 0" @click="idx--">◀ 上一步</button>
      <input v-model.number="idx" type="range" min="0" :max="N - 1" style="flex:1">
      <button class="btn primary" :disabled="idx === N - 1" @click="idx++">下一步 ▶</button>
    </div>
    <div class="ctrl">
      <b style="font-size:14px">{{ label(idx) }}</b>
      <div v-if="cur.round > 0" class="seg">
        <button v-for="s in roundSteps" :key="s" :class="{ on: cur.step === s }" @click="jump(s)">{{ s }}</button>
      </div>
      <label><input v-model="cmp" type="checkbox"> 对照：明文第 1 字节最高位翻转</label>
    </div>

    <div class="aes">
      <div>
        <div class="cap">上一步的状态</div>
        <table class="mat">
          <tr v-for="r in 4" :key="r">
            <td v-for="c in 4" :key="c" :class="{ hcol: cur.step === 'MixColumns' && c - 1 === col }">{{ hex(at(prev.s, r - 1, c - 1), 2) }}</td>
            <td v-if="cur.step === 'ShiftRows'" class="note">← {{ r - 1 }}</td>
          </tr>
        </table>
      </div>
      <div class="arrow">{{ cur.step === 'AddRoundKey' ? '⊕' : '⟶' }}</div>
      <div v-if="cur.step === 'AddRoundKey'">
        <div class="cap">轮密钥 K{{ cur.round }}</div>
        <table class="mat key">
          <tr v-for="r in 4" :key="r"><td v-for="c in 4" :key="c">{{ hex(at(rk, r - 1, c - 1), 2) }}</td></tr>
        </table>
      </div>
      <div v-if="cur.step === 'AddRoundKey'" class="arrow">=</div>
      <div>
        <div class="cap">当前状态</div>
        <table class="mat">
          <tr v-for="r in 4" :key="r">
            <td v-for="c in 4" :key="c" :class="{ chg: changed(r - 1, c - 1), dif: differs(r - 1, c - 1), hcol: cur.step === 'MixColumns' && c - 1 === col }"
              @click="col = c - 1">{{ hex(at(cur.s, r - 1, c - 1), 2) }}</td>
          </tr>
        </table>
      </div>
    </div>

    <div class="out prose" v-html="DESC[cur.step]" />
    <div v-if="cur.step === 'MixColumns'" class="out" style="margin-top:8px;font-size:13px">
      <span class="lbl">第 {{ col }} 列（点击右侧矩阵换一列）：新列 = M · 旧列，在 GF(2⁸) 中运算（加法是异或）</span>
      <div v-for="r in 4" :key="r">
        {{ hex(at(cur.s, r - 1, col), 2) }} = <span v-for="(m, j) in MIX[r - 1]" :key="j">{{ j ? ' ⊕ ' : '' }}{{ m === 1 ? '' : '0' + m + '·' }}{{ hex(at(prev.s, j, col), 2) }}</span>
      </div>
    </div>
    <div class="stats">
      <div v-if="cmp" class="stat"><b class="bad-c">{{ diffBytes }} / 16</b><span>与对照组不同的字节</span></div>
      <div v-if="cmp" class="stat"><b class="bad-c">{{ diffBits }} / 128</b><span>与对照组不同的比特</span></div>
      <div class="stat"><b style="font-size:14px;font-family:var(--vp-font-family-mono)">{{ ct }}</b><span>最终密文 {{ ct === FIPS_CT ? '（与 FIPS-197 一致 ✓）' : '' }}</span></div>
    </div>
    <p class="widget-note">打开“对照”后逐步前进：第 1 轮的 MixColumns 后 1 个字节的差异扩散到一整列（4 字节），第 2 轮结束时已扩散到全部 16 字节——AES 的雪崩只需两轮。</p>
  </Widget>
</template>

<style scoped>
.aes { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; margin: 10px 0; }
.cap { font-size: 12px; color: var(--ink-3); margin-bottom: 4px; text-align: center; }
.mat { border-collapse: separate; border-spacing: 3px; }
.mat td { width: 38px; height: 32px; text-align: center; font: 14px var(--vp-font-family-mono); border: 1px solid var(--line); border-radius: 5px; background: var(--vp-c-bg); color: var(--ink); padding: 0; cursor: default; transition: background .25s; }
.mat td.chg { background: var(--accent-soft); border-color: var(--accent); }
.mat td.dif { outline: 2px solid var(--warn); outline-offset: -2px; color: var(--warn); font-weight: 700; }
.mat td.hcol { box-shadow: inset 0 0 0 2px var(--prin); }
.mat td.note { border: 0; background: transparent; color: var(--ink-3); font-size: 11px; width: auto; }
.mat.key td { background: var(--prin-bg); }
.arrow { font-size: 22px; color: var(--ink-3); }
</style>
