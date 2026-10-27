<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { toyF, toyG0, toyG1, randBits, bin } from '../lib/l05'

// PRF 与 PRG 互相构造：① PRF→PRG（课件 P40）② PRG→PRF 查表法（课件 P40，修正版）③ GGM 树（补充）
const tab = ref<'a' | 'b' | 'c'>('a')
const N = 8
const seed = ref(0)
onMounted(() => { seed.value = randBits(N) })
const reseed = () => { seed.value = randBits(N) }

// ① G(s) = F_s(⟨1⟩) ‖ … ‖ F_s(⟨l⟩)
const L = ref(4)
const blocksA = computed(() => Array.from({ length: L.value }, (_, i) => toyF(seed.value, i + 1, N)))

// ② G 的扩展因子 n·2^t，F_k(x) 取第 x 块
const t = ref(2)
const xb = ref(1)
const blocksB = computed(() => Array.from({ length: 2 ** t.value }, (_, i) => toyF(seed.value, 1000 + i, N)))
function setT(v: number) { t.value = v; xb.value = Math.min(xb.value, 2 ** v - 1) }

// ③ GGM：F_k(x₁x₂x₃) = G_{x₃}(G_{x₂}(G_{x₁}(k)))
const D = 3
const xbits = ref([0, 1, 1])
const tree = computed(() => {
  // levels[d][i]：第 d 层第 i 个节点（i 的二进制即从根到该节点的路径）
  const levels: number[][] = [[seed.value]]
  for (let d = 1; d <= D; d++) {
    levels.push(levels[d - 1].flatMap(s => [toyG0(s, N), toyG1(s, N)]))
  }
  return levels
})
const pathIdx = computed(() => {
  const idx = [0]
  for (let d = 0; d < D; d++) idx.push(idx[d] * 2 + xbits.value[d])
  return idx
})
const nx = (d: number, i: number) => 20 + (i + 0.5) * (680 / 2 ** d)
const ny = (d: number) => 30 + d * 62
const onPath = (d: number, i: number) => pathIdx.value[d] === i
</script>

<template>
  <Widget title="PRF ⇄ PRG：互相构造">
    <div class="ctrl">
      <div class="seg">
        <button :class="{ on: tab === 'a' }" @click="tab = 'a'">① PRF → PRG</button>
        <button :class="{ on: tab === 'b' }" @click="tab = 'b'">② PRG → PRF（查表法）</button>
        <button :class="{ on: tab === 'c' }" @click="tab = 'c'">③ GGM 树（补充）</button>
      </div>
      <button class="btn" @click="reseed">🎲 换种子 / 密钥</button>
    </div>

    <template v-if="tab === 'a'">
      <p class="widget-note">把种子 s 当作 PRF 的密钥，在 1, 2, …, l 这些<b>固定</b>输入上求值并拼接：G(s) = F<sub>s</sub>(⟨1⟩) ‖ F<sub>s</sub>(⟨2⟩) ‖ … ‖ F<sub>s</sub>(⟨l⟩)。只要 l ≥ 2，输出长度 l·n &gt; n，就是一个扩展的 PRG。</p>
      <div class="ctrl"><label>l = <b>{{ L }}</b><input v-model.number="L" type="range" min="2" max="8"></label></div>
      <div class="out"><span class="lbl">种子 s（n = 8 位）</span>{{ bin(seed, N) }}</div>
      <div class="blocks">
        <div v-for="(b, i) in blocksA" :key="i" class="blk"><small>F<sub>s</sub>(⟨{{ i + 1 }}⟩)</small><code>{{ bin(b, N) }}</code></div>
      </div>
      <p class="widget-note" style="margin:0">为什么伪随机？若某 D 能区分 G(s) 与均匀串，则构造 D′：查询自己的预言机 O 在 ⟨1⟩,…,⟨l⟩ 上的值并拼接后交给 D。O = F<sub>s</sub> 时得到 G(s)；O = f 时得到 l 个互不相同输入上的真随机输出，即均匀的 l·n 位串。于是 D′ 以同样优势区分 PRF，矛盾。</p>
    </template>

    <template v-else-if="tab === 'b'">
      <p class="widget-note">用扩展因子为 n·2<sup>t</sup> 的 PRG：把 G(k) 切成 2<sup>t</sup> 块、每块 n 位，F<sub>k</sub>(x) 就取第 x 块（x 是 t 位输入）。这其实是把一个真随机函数的<b>整张函数表</b>换成伪随机串。</p>
      <div class="ctrl">
        <span style="font-size:13.5px">输入长度 t =</span>
        <div class="seg"><button v-for="v in [1, 2, 3, 4]" :key="v" :class="{ on: t === v }" @click="setT(v)">{{ v }}</button></div>
        <label>x = <select v-model.number="xb"><option v-for="i in 2 ** t" :key="i" :value="i - 1">{{ bin(i - 1, t) }}</option></select></label>
      </div>
      <div class="blocks">
        <div v-for="(b, i) in blocksB" :key="i" class="blk" :class="{ sel: i === xb }"><small>块 {{ bin(i, t) }}</small><code>{{ bin(b, N) }}</code></div>
      </div>
      <div class="stats">
        <div class="stat"><b>F<sub>k</sub>({{ bin(xb, t) }}) = {{ bin(blocksB[xb], N) }}</b><span>取第 x 块</span></div>
        <div class="stat"><b>{{ N * 2 ** t }} 位</b><span>|G(k)| = n·2<sup>t</sup></span></div>
      </div>
      <p class="widget-note" style="margin:0"><span class="bad-c">局限</span>：G 的输出长度随 t 指数增长，必须 t = O(log n) 才能多项式时间求值；若想要 t = n（长度保持的 PRF），需要 n·2ⁿ 位输出——不可行。这正是 GGM 树要解决的问题。</p>
    </template>

    <template v-else>
      <p class="widget-note">给定长度加倍的 PRG G(s) = G<sub>0</sub>(s) ‖ G<sub>1</sub>(s)。从根（密钥 k）出发，按 x 的每一位向左（0）或向右（1）走，每一步应用一次 G<sub>0</sub> 或 G<sub>1</sub>，叶子就是 F<sub>k</sub>(x)。<b>只需计算路径上的 t 次 PRG</b>，不必展开整棵树。点击下方比特切换 x。</p>
      <div class="ctrl">
        <span style="font-size:13.5px">x =</span>
        <button v-for="(b, i) in xbits" :key="i" class="btn" style="font-family:var(--vp-font-family-mono);min-width:38px" @click="xbits[i] ^= 1">{{ b }}</button>
      </div>
      <svg viewBox="0 0 720 230" style="width:100%;height:auto">
        <g v-for="d in D" :key="'e' + d">
          <g v-for="(_, i) in tree[d]" :key="i">
            <line :x1="nx(d - 1, i >> 1)" :y1="ny(d - 1) + 12" :x2="nx(d, i)" :y2="ny(d) - 12"
              :style="{ stroke: onPath(d, i) && onPath(d - 1, i >> 1) ? 'var(--accent)' : 'var(--line)', strokeWidth: onPath(d, i) && onPath(d - 1, i >> 1) ? 2.5 : 1 }" />
            <text :x="(nx(d - 1, i >> 1) + nx(d, i)) / 2 + (i % 2 ? 7 : -7)" :y="(ny(d - 1) + ny(d)) / 2 + 4" font-size="10" text-anchor="middle" style="fill:var(--ink-3)">G{{ i % 2 }}</text>
          </g>
        </g>
        <g v-for="(lv, d) in tree" :key="'n' + d">
          <g v-for="(v, i) in lv" :key="i">
            <rect :x="nx(d, i) - 33" :y="ny(d) - 12" width="66" height="24" rx="6"
              :style="{ fill: onPath(d, i) ? (d === D ? 'var(--accent)' : 'var(--accent-soft)') : 'var(--vp-c-bg)', stroke: onPath(d, i) ? 'var(--accent)' : 'var(--line)' }" />
            <text :x="nx(d, i)" :y="ny(d) + 4" text-anchor="middle" font-size="11"
              :style="{ fill: onPath(d, i) && d === D ? '#fff' : 'var(--ink)', fontFamily: 'var(--vp-font-family-mono)' }">{{ bin(v, N) }}</text>
          </g>
        </g>
        <text :x="nx(0, 0) - 40" y="34" font-size="12" text-anchor="end" style="fill:var(--accent)">根 = k</text>
      </svg>
      <div class="out">F<sub>k</sub>({{ xbits.join('') }}) = G<sub>{{ xbits[2] }}</sub>(G<sub>{{ xbits[1] }}</sub>(G<sub>{{ xbits[0] }}</sub>(k))) = {{ bin(tree[D][pathIdx[D]], N) }}</div>
      <p class="widget-note" style="margin:8px 0 0">GGM 构造（Goldreich–Goldwasser–Micali, 1986）不在本讲课件中，属补充说明：它证明了“只要存在 PRG，就存在长度保持的 PRF”。安全性证明用混合论证逐层把 G 的输出换成真随机串（教材第 2 版 §7.5 / 第 3 版 §8.5）。</p>
    </template>
  </Widget>
</template>

<style scoped>
.blocks { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0; }
.blk { display: flex; flex-direction: column; align-items: center; border: 1px solid var(--line); border-radius: 8px; padding: 4px 8px; background: var(--vp-c-bg); }
.blk small { font-size: 11px; color: var(--ink-3); }
.blk.sel { border-color: var(--accent); background: var(--accent-soft); }
</style>
