<script setup lang="ts">
import { ref, computed } from 'vue'
import { fmtTime, fmtPow10 } from '../lib/l03'

// 上半：多项式 vs 指数步数在 2 GHz（≈2^31 次/秒）机器上要跑多久（课件 P20–24 的两个例子）
// 下半：具体安全 (t, ε)：t 步穷举 n 位密钥，成功率 ε = t / 2^n
const FNS = [
  { id: 'p4', tex: '10<sup>8</sup>·n<sup>4</sup>', lg: (n: number) => 8 + 4 * Math.log10(n), poly: true },
  { id: 'p3', tex: 'n<sup>3</sup>', lg: (n: number) => 3 * Math.log10(n), poly: true },
  { id: 'p10', tex: 'n<sup>10</sup>', lg: (n: number) => 10 * Math.log10(n), poly: true },
  { id: 'e2', tex: '2<sup>n/2</sup>', lg: (n: number) => n / 2 * Math.log10(2), poly: false },
  { id: 'e', tex: '2<sup>n</sup>', lg: (n: number) => n * Math.log10(2), poly: false }
]
const fi = ref(0)
const n = ref(80)
const HZ = Math.pow(2, 31)
const lgSec = computed(() => FNS[fi.value].lg(n.value) - Math.log10(HZ))
const UNIVERSE = 58 * Math.log10(2) // 课件：宇宙年龄约 2^58 秒
function preset(f: number, nn: number) { fi.value = f; n.value = nn }

// 具体安全
const keyLen = ref(64)
const tau = ref(40) // 攻击者步数 t = 2^tau
const lgEps = computed(() => Math.min(0, (tau.value - keyLen.value) * Math.log10(2)))
const tSec = computed(() => Math.pow(2, tau.value) / HZ)
</script>

<template>
  <Widget title="多项式 vs 指数 · 具体安全 (t, ε)">
    <p class="widget-note">一台 2 GHz 计算机每秒约 2<sup>31</sup> 个时钟周期。选一个运行步数函数，拖动安全参数 n。</p>
    <div class="ctrl">
      <div class="seg"><button v-for="(f, i) in FNS" :key="f.id" :class="{ on: fi === i }" @click="fi = i" v-html="f.tex" /></div>
      <button class="btn" @click="preset(0, 80)">课件例 1：10⁸·n⁴，n = 80</button>
      <button class="btn" @click="preset(4, 89)">课件例 2：2ⁿ，n = 89</button>
    </div>
    <div class="ctrl"><label>n = <b>{{ n }}</b><input v-model.number="n" type="range" min="8" max="256" step="1" style="width:280px"></label></div>
    <div class="stats">
      <div class="stat"><b>{{ fmtPow10(FNS[fi].lg(n)) }}</b><span>所需步数（时钟周期）</span></div>
      <div class="stat"><b :class="lgSec < Math.log10(31557600 * 100) ? 'ok-c' : 'bad-c'">{{ fmtTime(Math.pow(10, lgSec)) }}</b><span>2 GHz 单机耗时</span></div>
      <div class="stat"><b>{{ lgSec > UNIVERSE - 6 ? fmtPow10(lgSec - UNIVERSE) + ' 倍' : '远小于' }}</b><span>相对宇宙年龄（≈2<sup>58</sup> 秒）</span></div>
    </div>
    <p class="widget-note">{{ FNS[fi].poly ? '多项式：n 翻倍，时间只乘上一个常数倍（如 n⁴ 变成 16 倍）——硬件升级就能追上。' : '指数：n 每加 1，时间就翻倍（2ⁿ）或乘 √2——硬件升级永远追不上。' }}</p>
    <hr style="border:0;border-top:1px dashed var(--line);margin:14px 0">
    <p class="widget-note"><b>具体方法（补充）</b>：若一个方案的最优攻击就是穷举 n 位密钥，那么运行 t 步的敌手成功率 ε ≈ t / 2<sup>n</sup>，即方案是 (t, ε)-安全的。</p>
    <div class="ctrl">
      <label>密钥长度 n = <b>{{ keyLen }}</b><input v-model.number="keyLen" type="range" min="16" max="256" step="8"></label>
      <label>敌手步数 t = 2^<b>{{ tau }}</b><input v-model.number="tau" type="range" min="0" max="128" step="1"></label>
    </div>
    <div class="stats">
      <div class="stat"><b>{{ fmtTime(tSec) }}</b><span>t 步在 2 GHz 单机上的耗时</span></div>
      <div class="stat"><b :class="lgEps > -6 ? 'bad-c' : 'ok-c'">{{ fmtPow10(lgEps) }}</b><span>成功率 ε = t / 2ⁿ</span></div>
    </div>
  </Widget>
</template>
