<script setup lang="ts">
import { ref } from 'vue'

// 保密性 vs 完整性：信封从 Alice 经公网到 Bob，敌手在中途窃听/篡改
const SCENES = [
  { name: '① 明文传输', intro: '明文直接发送', send: '转¥5000给Bob', eve: '读到：转¥5000给Bob', mid: '', recv: '转¥5000给Bob', ok: false,
    res: '<b class="bad-c">保密性被破坏</b>：明文在公网上传输，敌手一眼看到全部内容。（这里假设敌手只窃听、不篡改）' },
  { name: '② 加密', intro: '先加密再发送', send: 'Enc(M)=7f3a9c…', eve: '读到：7f3a9c…（看不懂）', mid: '', recv: 'Dec → 转¥5000给Bob', ok: true,
    res: '<b class="ok-c">保密性达成</b>：敌手只看到密文，Bob 用密钥解密得到原文。' },
  { name: '③ 篡改攻击', intro: '敌手篡改消息', send: '转¥5000给Bob', eve: '改为：转¥500000给Eve', mid: '转¥500000给Eve', recv: '照单执行：转¥500000给Eve', ok: false,
    res: '<b class="bad-c">完整性被破坏</b>：Bob 收到 M′ ≠ M 却浑然不觉（对应课件 P30 的转账篡改）。' },
  { name: '④ 完整性保护', intro: '附带认证标签 tag', send: 'M ‖ tag', eve: '改为：M′ ‖ tag', mid: 'M′ ‖ tag', recv: '验证 tag 失败 → 拒收', ok: true,
    res: '<b class="ok-c">完整性达成</b>：敌手可以改，但改了会被发现（后续课程的 MAC / 数字签名）。' }
]

const scene = ref(0)
const busy = ref(false)
const x = ref(150)
const env = ref('')
const tampered = ref(false)
const eve = ref('')
const bob = ref('')
const msg = ref('点击“播放”。场景：' + SCENES[0].intro)

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
function tween(x0: number, x1: number, ms: number) {
  return new Promise<void>(res => {
    const t0 = performance.now()
    const f = (t: number) => {
      const p = Math.min(1, (t - t0) / ms)
      const e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2
      x.value = x0 + (x1 - x0) * e
      p < 1 ? requestAnimationFrame(f) : res()
    }
    requestAnimationFrame(f)
  })
}
function reset() {
  env.value = ''; eve.value = ''; bob.value = ''; tampered.value = false; x.value = 150
  msg.value = '点击“播放”。场景：' + SCENES[scene.value].intro
}
function pick(i: number) {
  if (busy.value) return
  scene.value = i
  reset()
}
async function play() {
  if (busy.value) return
  busy.value = true
  reset()
  const s = SCENES[scene.value]
  env.value = s.send
  msg.value = 'Alice 发送：' + s.send
  await tween(150, 360, 1100)
  eve.value = s.eve
  msg.value = '敌手截获 → ' + s.eve
  await sleep(900)
  if (s.mid) { env.value = s.mid; tampered.value = true; await sleep(500) }
  await tween(360, 600, 1000)
  bob.value = (s.ok ? '✓ ' : '✗ ') + s.recv
  msg.value = s.res
  busy.value = false
}
</script>

<template>
  <Widget title="保密性 vs 完整性：敌手能做什么？">
    <p class="widget-note">选一个场景并播放，观察敌手在中途看到/改动了什么、Bob 最终收到了什么。</p>
    <div class="ctrl">
      <div class="seg">
        <button v-for="(s, i) in SCENES" :key="i" :class="{ on: scene === i }" @click="pick(i)">{{ s.name }}</button>
      </div>
      <button class="btn primary" @click="play">▶ 播放</button>
    </div>
    <svg viewBox="0 0 720 270" style="width:100%;height:auto;display:block">
      <path d="M265 150 q-30 -40 20 -55 q20 -35 70 -20 q40 -25 75 10 q45 0 35 45 q20 30 -25 40 h-150 q-50 0 -25 -20 z"
        style="fill:var(--accent-soft);stroke:var(--accent)" stroke-width="1.5" />
      <text x="360" y="140" text-anchor="middle" font-size="15" font-weight="700" style="fill:var(--accent)">公共网络</text>
      <line x1="110" y1="135" x2="610" y2="135" style="stroke:var(--ink-3)" stroke-dasharray="4 5" />
      <g v-for="p in [{ x: 70, n: 'Alice', c: '#3b6fd8' }, { x: 650, n: 'Bob', c: '#d84a3b' }]" :key="p.n">
        <circle :cx="p.x" cy="110" r="13" :fill="p.c" />
        <path :d="`M${p.x - 18} 162 Q${p.x} 118 ${p.x + 18} 162 Z`" :fill="p.c" />
        <text :x="p.x" y="186" text-anchor="middle" font-size="15" style="fill:var(--ink)">{{ p.n }}</text>
      </g>
      <circle cx="360" cy="28" r="11" style="fill:var(--ink)" />
      <path d="M345 72 Q360 36 375 72 Z" style="fill:var(--ink)" />
      <text x="395" y="40" font-size="14" font-weight="700" style="fill:var(--warn)">敌手 Eve</text>
      <text x="395" y="62" font-size="13" style="fill:var(--warn)">{{ eve }}</text>
      <g v-if="env" :transform="`translate(${x},215)`">
        <rect x="-78" y="-16" width="156" height="30" rx="6" style="fill:var(--paper);stroke:var(--ink-2)" />
        <text x="0" y="4" text-anchor="middle" font-size="12.5" :style="{ fill: tampered ? 'var(--warn)' : 'var(--ink)' }">{{ env }}</text>
      </g>
      <text x="712" y="258" text-anchor="end" font-size="13" font-weight="700"
        :style="{ fill: SCENES[scene].ok ? 'var(--ex)' : 'var(--warn)' }">{{ bob }}</text>
    </svg>
    <div class="out prose" v-html="msg" />
  </Widget>
</template>
