<script setup lang="ts">
import { ref } from 'vue'

// 安全目标逐级加强：前三种各配一个反例
const GOALS = [
  { t: '敌手不能从密文恢复出<b>密钥</b>', d: '反例：<i>Enc<sub>k</sub></i>(<i>m</i>) = <i>m</i>（直接输出明文）。敌手永远得不到密钥，但明文一览无余。', ok: false },
  { t: '敌手不能从密文恢复出<b>整个明文</b>', d: '反例：一个方案泄露明文的前一半。敌手恢复不了“整个”明文，但已经知道一半了。', ok: false },
  { t: '敌手不能从密文恢复出明文的<b>任何一个字符</b>', d: '反例：明文是工资数字，方案不泄露任何一位，却泄露“工资是否高于 10 万”。没有字符泄露，信息照样泄露了。', ok: false },
  { t: '无论敌手事先已掌握什么信息，密文都<b>不应泄露关于明文的任何额外信息</b>', d: '这才是“正确”的直觉——后续课程会把它严格化为完美保密、语义安全 / 不可区分性（如 CPA 安全）。', ok: true }
]
const g = ref(0)
</script>

<template>
  <Widget title="安全目标：哪一种才够？">
    <div class="ctrl">
      <div class="seg"><button v-for="(_, i) in GOALS" :key="i" :class="{ on: g === i }" @click="g = i">{{ '①②③④'[i] }}</button></div>
      <button class="btn" :disabled="g >= 3" @click="g = Math.min(3, g + 1)">为什么还不够？→ 下一级</button>
    </div>
    <div v-for="(x, j) in GOALS.slice(0, g + 1)" :key="j" class="goal" :style="{ opacity: j < g ? .55 : 1 }">
      <b class="dot" :style="{ background: x.ok ? 'var(--ex)' : 'var(--warn)' }">{{ x.ok ? '✓' : '✗' }}</b>
      <div><div v-html="x.t" /><div class="d" v-html="x.d" /></div>
    </div>
    <p class="widget-note" style="margin:8px 0 0">课件 P115–118 逐条给出四种目标；反例为教材 1.4.1 节思路的补充说明。</p>
  </Widget>
</template>

<style scoped>
.goal { display: flex; gap: 10px; padding: 10px 0; border-bottom: 1px dashed var(--line); transition: opacity .3s; }
.dot { flex: none; width: 24px; height: 24px; border-radius: 50%; color: #fff; text-align: center; line-height: 24px; font-size: 13px; }
.d { font-size: 14px; color: var(--ink-2); margin-top: 4px; }
</style>
