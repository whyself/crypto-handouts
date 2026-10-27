<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue'
import { subst, permute, spnSubkeys, PERM, hex, popcount } from '../lib/l06'

// 玩具 SPN（Toy16）逐轮演示 + 雪崩效应：翻转输入的 1 位，看差异如何一轮轮扩散
// 结构：4 轮 ×（⊕子密钥 → 4 个 4 位 S 盒 → 位置换），最后再 ⊕K5（共 5 个子密钥）
const x = ref(0x26B7)
const key = ref(0x3A94D63F)
const flipBit = ref(0) // 0 = 最高位
const noPerm = ref(false)
const noSub = ref(false)
const R = 4

interface Rnd { a: number; b: number; c: number }
function run(v: number, k = key.value) {
  const ks = spnSubkeys(k, R), rs: Rnd[] = []
  for (let i = 0; i < R; i++) {
    const a = v ^ ks[i], b = noSub.value ? a : subst(a), c = noPerm.value ? b : permute(b)
    rs.push({ a, b, c }); v = c
  }
  return { rs, out: v ^ ks[R], ks }
}
const A = computed(() => run(x.value))
const B = computed(() => run(x.value ^ (1 << (15 - flipBit.value))))
const bitsOf = (v: number) => Array.from({ length: 16 }, (_, j) => (v >> (15 - j)) & 1)

// 表格行：每一步两个状态的差异
const rows = computed(() => {
  const out: { label: string; v: number; d: number; end?: boolean }[] = [{ label: '输入 x', v: x.value, d: 1 << (15 - flipBit.value) }]
  A.value.rs.forEach((r, i) => {
    const s = B.value.rs[i]
    out.push({ label: `R${i + 1} ⊕K${i + 1}`, v: r.a, d: r.a ^ s.a })
    if (!noSub.value) out.push({ label: `R${i + 1} S 盒`, v: r.b, d: r.b ^ s.b, end: noPerm.value })
    if (!noPerm.value) out.push({ label: `R${i + 1} 置换`, v: r.c, d: r.c ^ s.c, end: true })
    if (noSub.value && noPerm.value) out[out.length - 1].end = true
  })
  out.push({ label: '输出 ⊕K5', v: A.value.out, d: A.value.out ^ B.value.out, end: true })
  return out
})
const perRound = computed(() => A.value.rs.map((r, i) => popcount(r.c ^ B.value.rs[i].c)))
const outDiff = computed(() => popcount(A.value.out ^ B.value.out))

// 逐轮结构图：选中第几轮
const sel = ref(0)
let timer: ReturnType<typeof setInterval> | undefined
function play() {
  clearInterval(timer); sel.value = 0
  timer = setInterval(() => { if (sel.value >= R - 1) clearInterval(timer); else sel.value++ }, 1100)
}
onBeforeUnmount(() => clearInterval(timer))
const bx = (j: number) => 30 + j * 37 + Math.floor(j / 4) * 8
const cur = computed(() => ({ A: A.value.rs[sel.value], B: B.value.rs[sel.value], k: A.value.ks[sel.value] }))
const inBits = computed(() => bitsOf(sel.value === 0 ? x.value : A.value.rs[sel.value - 1].c))
const inDiff = computed(() => bitsOf(sel.value === 0 ? 1 << (15 - flipBit.value) : A.value.rs[sel.value - 1].c ^ B.value.rs[sel.value - 1].c))

// 统计：随机 2000 组 (x, k, 翻转位)，每轮结束时平均翻转多少位
const avg = ref<number[]>([])
function stats() {
  const T = 2000, sum = new Array(R + 1).fill(0)
  for (let t = 0; t < T; t++) {
    const kk = (Math.random() * 2 ** 32) >>> 0
    const xx = Math.floor(Math.random() * 65536), bit = 1 << Math.floor(Math.random() * 16)
    const p = run(xx, kk), q = run(xx ^ bit, kk)
    p.rs.forEach((r, i) => (sum[i] += popcount(r.c ^ q.rs[i].c)))
    sum[R] += popcount(p.out ^ q.out)
  }
  avg.value = sum.map(s => s / T)
}
const hexIn = computed({ get: () => hex(x.value), set: (s: string) => { const v = parseInt(s, 16); if (!isNaN(v)) x.value = v & 0xFFFF } })
const hexKey = computed({ get: () => hex(key.value, 8), set: (s: string) => { const v = parseInt(s, 16); if (!isNaN(v)) key.value = v >>> 0 } })
</script>

<template>
  <Widget title="玩具 SPN 逐轮演示 + 雪崩效应">
    <p class="widget-note"><b>Toy16</b>：16 位分组、4 个 4 位 S 盒（取自 Heys 教程，改 1 位输入至少改 2 位输出）、4×4 转置作为置换层、4 轮 + 末尾密钥混合。<b>教学用简化版本，没有任何安全性。</b>点击“输入 x”那一行的某一位，选择要翻转的比特。</p>
    <div class="ctrl">
      <label>输入 x（hex）<input v-model.lazy="hexIn" type="text" style="width:70px"></label>
      <label>主密钥（hex）<input v-model.lazy="hexKey" type="text" style="width:100px"></label>
      <label><input v-model="noSub" type="checkbox"> 去掉 S 盒（只剩线性部分）</label>
      <label><input v-model="noPerm" type="checkbox"> 去掉置换层</label>
    </div>

    <div style="overflow-x:auto">
      <table class="mini-table spn">
        <thead><tr><th>步骤</th><th>状态（16 位；红色 = 与翻转后那次计算不同的位）</th><th>差异位数</th></tr></thead>
        <tbody>
          <tr v-for="(r, ri) in rows" :key="ri" :class="{ endrow: r.end }">
            <td style="white-space:nowrap">{{ r.label }}</td>
            <td class="bits">
              <template v-for="(b, j) in bitsOf(r.v)" :key="j">
                <span class="bit" :class="{ d: (r.d >> (15 - j)) & 1, pick: ri === 0, sel: ri === 0 && j === flipBit }"
                  @click="ri === 0 && (flipBit = j)">{{ b }}</span><span v-if="j % 4 === 3 && j < 15" class="gap" />
              </template>
            </td>
            <td><b :class="popcount(r.d) >= 6 ? 'bad-c' : ''">{{ popcount(r.d) }}</b></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="stats">
      <div v-for="(n, i) in perRound" :key="i" class="stat"><b>{{ n }}</b><span>第 {{ i + 1 }} 轮后差异位数</span></div>
      <div class="stat"><b :class="outDiff >= 5 ? 'ok-c' : 'bad-c'">{{ outDiff }} / 16</b><span>输出差异（理想 ≈ 8）</span></div>
    </div>

    <hr style="border:0;border-top:1px dashed var(--line);margin:14px 0 10px">
    <div class="ctrl">
      <span style="font-size:13px;color:var(--ink-3)">单轮结构图：</span>
      <div class="seg"><button v-for="i in R" :key="i" :class="{ on: sel === i - 1 }" @click="sel = i - 1">第 {{ i }} 轮</button></div>
      <button class="btn primary" @click="play">▶ 逐轮播放</button>
    </div>
    <svg viewBox="0 0 650 330" style="width:100%;height:auto;display:block">
      <text x="4" y="22" font-size="11" style="fill:var(--ink-3)">本轮输入</text>
      <text x="4" y="78" font-size="11" style="fill:var(--ink-3)">⊕K{{ sel + 1 }}</text>
      <text x="4" y="180" font-size="11" style="fill:var(--ink-3)">S 输出</text>
      <text x="4" y="306" font-size="11" style="fill:var(--ink-3)">置换后</text>
      <!-- 输入位 → 异或密钥 -->
      <g v-for="j in 16" :key="'i' + j">
        <line :x1="bx(j - 1)" y1="40" :x2="bx(j - 1)" y2="100" :style="{ stroke: inDiff[j - 1] ? 'var(--warn)' : 'var(--line)', strokeWidth: inDiff[j - 1] ? 2.5 : 1.2 }" />
        <circle :cx="bx(j - 1)" cy="30" r="10" :style="{ fill: inDiff[j - 1] ? 'var(--warn)' : 'var(--vp-c-bg)', stroke: 'var(--ink-3)' }" />
        <text :x="bx(j - 1)" y="34" text-anchor="middle" font-size="11" :style="{ fill: inDiff[j - 1] ? '#fff' : 'var(--ink)' }">{{ inBits[j - 1] }}</text>
        <circle :cx="bx(j - 1)" cy="74" r="7" style="fill:var(--paper);stroke:var(--ink-3)" />
        <text :x="bx(j - 1)" y="78" text-anchor="middle" font-size="11" style="fill:var(--ink-2)">⊕</text>
      </g>
      <text x="640" y="78" text-anchor="end" font-size="10" style="fill:var(--ink-3)">K{{ sel + 1 }} = {{ hex(cur.k) }}</text>
      <!-- S 盒 -->
      <g v-for="s in 4" :key="'s' + s">
        <rect :x="bx(4 * (s - 1)) - 14" y="100" :width="bx(4 * (s - 1) + 3) - bx(4 * (s - 1)) + 28" height="46" rx="8"
          :style="{ fill: ((cur.A.a ^ cur.B.a) >> (16 - 4 * s)) & 15 ? 'var(--warn-bg)' : 'var(--accent-soft)', stroke: ((cur.A.a ^ cur.B.a) >> (16 - 4 * s)) & 15 ? 'var(--warn)' : 'var(--accent)' }" />
        <text :x="(bx(4 * (s - 1)) + bx(4 * (s - 1) + 3)) / 2" y="128" text-anchor="middle" font-size="14" font-weight="700" style="fill:var(--ink)">{{ noSub ? '恒等' : 'S' + s }}</text>
      </g>
      <!-- S 输出位 -->
      <g v-for="j in 16" :key="'o' + j">
        <line :x1="bx(j - 1)" y1="146" :x2="bx(j - 1)" y2="166" :style="{ stroke: ((cur.A.b ^ cur.B.b) >> (16 - j)) & 1 ? 'var(--warn)' : 'var(--line)' }" />
        <circle :cx="bx(j - 1)" cy="176" r="10" :style="{ fill: ((cur.A.b ^ cur.B.b) >> (16 - j)) & 1 ? 'var(--warn)' : 'var(--vp-c-bg)', stroke: 'var(--ink-3)' }" />
        <text :x="bx(j - 1)" y="180" text-anchor="middle" font-size="11" :style="{ fill: ((cur.A.b ^ cur.B.b) >> (16 - j)) & 1 ? '#fff' : 'var(--ink)' }">{{ (cur.A.b >> (16 - j)) & 1 }}</text>
      </g>
      <!-- 置换连线 -->
      <g v-for="j in 16" :key="'p' + j">
        <line :x1="bx(j - 1)" y1="186" :x2="bx(noPerm ? j - 1 : PERM[j - 1])" y2="286"
          :style="{ stroke: ((cur.A.b ^ cur.B.b) >> (16 - j)) & 1 ? 'var(--warn)' : 'var(--ink-3)', strokeWidth: ((cur.A.b ^ cur.B.b) >> (16 - j)) & 1 ? 2.5 : 1, opacity: ((cur.A.b ^ cur.B.b) >> (16 - j)) & 1 ? 1 : .45 }" />
      </g>
      <g v-for="j in 16" :key="'c' + j">
        <circle :cx="bx(j - 1)" cy="300" r="10" :style="{ fill: ((cur.A.c ^ cur.B.c) >> (16 - j)) & 1 ? 'var(--warn)' : 'var(--vp-c-bg)', stroke: 'var(--ink-3)' }" />
        <text :x="bx(j - 1)" y="304" text-anchor="middle" font-size="11" :style="{ fill: ((cur.A.c ^ cur.B.c) >> (16 - j)) & 1 ? '#fff' : 'var(--ink)' }">{{ (cur.A.c >> (16 - j)) & 1 }}</text>
      </g>
    </svg>
    <p class="widget-note">红色 = 两次计算（原输入 / 翻转 1 位后的输入）在这个位置上的值不同。S 盒把 1 位差异放大成 ≥2 位；置换层把同一 S 盒的输出位分发到下一轮的不同 S 盒。</p>

    <div class="ctrl"><button class="btn" @click="stats">随机测 2000 组，统计平均差异位数</button></div>
    <div v-if="avg.length" class="stats">
      <div v-for="(a, i) in avg" :key="i" class="stat"><b>{{ a.toFixed(2) }}</b><span>{{ i < R ? `第 ${i + 1} 轮后` : '最终输出' }}</span></div>
    </div>
    <div class="out prose">
      试试勾选“去掉置换层”：差异永远被关在同一个 S 盒的 4 位里，出不来；勾选“去掉 S 盒”：整个密码变成线性的，1 位差异经过置换仍然只是 1 位。<b>代换（混淆）和置换（扩散）缺一不可</b>，两者交替多轮才能让差异扩散到约一半的输出位。
    </div>
  </Widget>
</template>

<style scoped>
.spn td { padding: 3px 8px; }
.spn tr.endrow td { border-bottom: 1.5px solid var(--line); }
.bits { font-family: var(--vp-font-family-mono); white-space: nowrap; }
.bit { display: inline-block; width: 17px; text-align: center; border-radius: 3px; font-size: 13px; color: var(--ink-2); }
.bit.d { background: var(--warn); color: #fff; font-weight: 700; }
.bit.pick { cursor: pointer; outline: 1px dashed var(--line); }
.bit.sel { outline: 2px solid var(--warn); }
.gap { display: inline-block; width: 8px; }
</style>
