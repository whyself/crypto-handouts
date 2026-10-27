<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { type Mode, modeEnc } from '../lib/l06'

// 复现课件 P14 的“ECB 企鹅”：自己画一只 64×64 的小企鹅，每像素 4 位颜色编号，
// 每 4 个横向相邻像素拼成一个 16 位分组，用 Toy16 分别以 ECB 和安全模式加密，再把密文当像素画出来
const N = 64
const PLAIN = ['#cfe3f2', '#232323', '#fafafa', '#f0a030']
// 密文的每个 4 位“像素”映射到 16 种颜色
const CPAL = Array.from({ length: 16 }, (_, i) => `hsl(${(i * 137) % 360} 55% ${35 + (i % 4) * 12}%)`)

function inE(x: number, y: number, cx: number, cy: number, rx: number, ry: number) {
  return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1
}
// 生成企鹅图：0 背景 1 黑 2 白 3 橙
const img: number[] = []
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  const px = x + .5, py = y + .5
  let c = 0
  if (inE(px, py, 32, 39, 18, 21) || inE(px, py, 32, 17, 12, 12) || inE(px, py, 15, 40, 4.5, 13) || inE(px, py, 49, 40, 4.5, 13)) c = 1
  if (inE(px, py, 32, 43, 12, 15) || inE(px, py, 32, 20, 8, 7)) c = 2
  if (inE(px, py, 28.5, 16, 1.8, 2.2) || inE(px, py, 35.5, 16, 1.8, 2.2)) c = 1
  if (inE(px, py, 32, 22.5, 4, 2)) c = 3
  if (inE(px, py, 24, 60, 6.5, 2.8) || inE(px, py, 40, 60, 6.5, 2.8)) c = 3
  img.push(c)
}
// 每 4 个像素 → 一个 16 位块
const blocks: number[] = []
for (let i = 0; i < img.length; i += 4) blocks.push((img[i] << 12) | (img[i + 1] << 8) | (img[i + 2] << 4) | img[i + 3])

const key = ref(0x3A94D63F)
const SECS: Mode[] = ['CBC', 'OFB', 'CTR']
const secure = ref<Mode>('CBC')
const cvPlain = ref<HTMLCanvasElement>()
const cvEcb = ref<HTMLCanvasElement>()
const cvSec = ref<HTMLCanvasElement>()
const distinct = ref({ ecb: 0, sec: 0 })

function paint(cv: HTMLCanvasElement | undefined, nibbles: number[], pal: string[]) {
  if (!cv) return
  const ctx = cv.getContext('2d')!
  for (let i = 0; i < nibbles.length; i++) { ctx.fillStyle = pal[nibbles[i]]; ctx.fillRect(i % N, Math.floor(i / N), 1, 1) }
}
const toNibbles = (bs: number[]) => bs.flatMap(b => [b >> 12, (b >> 8) & 15, (b >> 4) & 15, b & 15])

function draw() {
  const ecb = modeEnc('ECB', blocks, key.value, 0)
  const sec = modeEnc(secure.value, blocks, key.value, Math.floor(Math.random() * 65536)).slice(1)
  distinct.value = { ecb: new Set(ecb).size, sec: new Set(sec).size }
  paint(cvPlain.value, img, PLAIN)
  paint(cvEcb.value, toNibbles(ecb), CPAL)
  paint(cvSec.value, toNibbles(sec), CPAL)
}
onMounted(draw)
watch([key, secure], draw)
const reKey = () => { key.value = Math.floor(Math.random() * 2 ** 32) >>> 0 }
</script>

<template>
  <Widget title="ECB 企鹅：确定性加密泄露了图案">
    <p class="widget-note">64×64 像素、每像素 4 位，每 4 个横向像素组成一个 16 位分组（共 1024 块）。密文同样按 4 位一像素、用伪彩色画出。</p>
    <div class="ctrl">
      <button class="btn primary" @click="reKey">🎲 换一个随机密钥</button>
      <span style="font-size:13px;color:var(--ink-3)">右图使用的安全模式：</span>
      <div class="seg">
        <button v-for="m in SECS" :key="m" :class="{ on: secure === m }" @click="secure = m">{{ m }}</button>
      </div>
    </div>
    <div class="peng">
      <figure><canvas ref="cvPlain" :width="N" :height="N" /><figcaption>原图（明文）</figcaption></figure>
      <figure><canvas ref="cvEcb" :width="N" :height="N" /><figcaption>ECB 加密</figcaption></figure>
      <figure><canvas ref="cvSec" :width="N" :height="N" /><figcaption>{{ secure }} 加密（随机 IV）</figcaption></figure>
    </div>
    <div class="stats">
      <div class="stat"><b>1024</b><span>明文块总数</span></div>
      <div class="stat"><b class="bad-c">{{ distinct.ecb }}</b><span>ECB 密文中不同块值的个数</span></div>
      <div class="stat"><b class="ok-c">{{ distinct.sec }}</b><span>{{ secure }} 密文中不同块值的个数</span></div>
    </div>
    <div class="out prose">
      ECB 下“相同明文块 → 相同密文块”，大片背景、大片黑色都变成同一种重复花纹，企鹅轮廓一目了然——无论换哪个密钥都一样。
      安全模式下每块的输入都被 IV / 前一块密文 / 计数器“随机化”，密文看起来像噪声。
      <span style="color:var(--ink-3)">（16 位分组只有 65536 种取值，所以安全模式下也会偶尔撞出相同块；真实的 128 位分组几乎不可能。）</span>
    </div>
  </Widget>
</template>

<style scoped>
.peng { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 10px 0; }
.peng figure { margin: 0; text-align: center; }
.peng canvas { width: 100%; max-width: 220px; aspect-ratio: 1; image-rendering: pixelated; border: 1px solid var(--line); border-radius: 6px; }
.peng figcaption { font-size: 13px; color: var(--ink-2); margin-top: 4px; }
</style>
