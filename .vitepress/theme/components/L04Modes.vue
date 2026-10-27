<script setup lang="ts">
import { ref, computed } from 'vue'
import { rc4Stream, asciiBytes, hex, xorBytes, show } from '../lib/l04'

// 同步模式 vs 非同步模式（课件 P13）
// 同步：一条长密钥流 G(k) 依次切成 Part1、Part2、Part3，双方都要记住“用到哪了”
// 非同步：每条消息选新的 IV，用 G(k, IV) 产生独立的密钥流，IV 随密文明文发送
const mode = ref<'sync' | 'unsync'>('sync')
const lost = ref(false)      // 同步模式：第 2 条消息在传输中丢失
const ivRepeat = ref(false)  // 非同步模式：IV₃ 不小心等于 IV₁
const key = 'course-key'
const msgs = ref(['hello bob', 'meet at 9pm', 'bring the map'])
const ivs = computed(() => [0x3a91c2, 0x07be55, ivRepeat.value ? 0x3a91c2 : 0xd40e18])

const G = (len: number) => rc4Stream(asciiBytes(key), len)
const Giv = (iv: number, len: number) => rc4Stream([iv >> 16 & 255, iv >> 8 & 255, iv & 255].concat(asciiBytes(key)), len) // 仿照 WEP：种子 = IV ‖ key

interface Row { name: string; ks: string; c: number[]; iv?: string; arrived: boolean; rks: string; dec: string; ok: boolean }
const rows = computed<Row[]>(() => {
  const m = msgs.value.map(s => asciiBytes(s))
  const total = m.reduce((a, b) => a + b.length, 0)
  const res: Row[] = []
  if (mode.value === 'sync') {
    const g = G(total)
    let off = 0, roff = 0
    m.forEach((mi, k) => {
      const seg = g.slice(off, off + mi.length)
      const c = xorBytes(mi, seg)
      const arrived = !(lost.value && k === 1)
      let rks = '—', dec = '（未收到）', ok = false
      if (arrived) {
        const rseg = g.slice(roff, roff + c.length)
        const d = xorBytes(c, rseg)
        rks = `G(k)[${roff}…${roff + c.length - 1}]`
        dec = show(d); ok = d.every((v, q) => v === mi[q])
        roff += c.length
      }
      res.push({ name: `m${k + 1}`, ks: `G(k)[${off}…${off + mi.length - 1}]`, c, arrived, rks, dec, ok })
      off += mi.length
    })
  } else {
    m.forEach((mi, k) => {
      const iv = ivs.value[k]
      const c = xorBytes(mi, Giv(iv, mi.length))
      const d = xorBytes(c, Giv(iv, c.length))
      const ivs6 = iv.toString(16).padStart(6, '0').toUpperCase()
      res.push({ name: `m${k + 1}`, ks: `G(k, IV${k + 1})`, c, iv: ivs6, arrived: true, rks: `G(k, ${ivs6})`, dec: show(d), ok: true })
    })
  }
  return res
})
// 非同步模式 IV 重复时，敌手可算 c1 ⊕ c3 = m1 ⊕ m3
const leak = computed(() => show(xorBytes(xorBytes(rows.value[0].c, rows.value[2].c), asciiBytes(msgs.value[0]))))
</script>

<template>
  <Widget title="流密码的两种工作模式：同步 vs 非同步">
    <div class="ctrl">
      <div class="seg">
        <button :class="{ on: mode === 'sync' }" @click="mode = 'sync'">同步模式</button>
        <button :class="{ on: mode === 'unsync' }" @click="mode = 'unsync'">非同步模式</button>
      </div>
      <label v-if="mode === 'sync'"><input v-model="lost" type="checkbox"> 第 2 条消息在网络中丢失</label>
      <label v-else><input v-model="ivRepeat" type="checkbox"> IV₃ 与 IV₁ 重复</label>
    </div>
    <div class="ctrl">
      <label v-for="(_, k) in msgs" :key="k">m{{ k + 1 }}<input v-model="msgs[k]" type="text" style="width:130px"></label>
    </div>
    <p class="widget-note" v-if="mode === 'sync'">发送方与接收方共享 k，各自维护一个“已用到 G(k) 第几位”的计数器（即流密码的内部状态）。密文本身不携带任何位置信息。</p>
    <p class="widget-note" v-else>每条消息选一个新的 IV，用 G(k, IV) 现算一段密钥流；IV 不保密，和密文一起发送（这里仿照 WEP，种子 = IV ‖ k）。</p>
    <div style="overflow:auto;border:1px solid var(--line);border-radius:8px">
      <table class="mini-table">
        <thead><tr><th>消息</th><th>发送方用的密钥流</th><th>传输的内容</th><th>接收方用的密钥流</th><th>解密结果</th></tr></thead>
        <tbody>
          <tr v-for="r in rows" :key="r.name">
            <td>{{ r.name }}</td>
            <td style="font-family:var(--vp-font-family-mono);font-size:12.5px">{{ r.ks }}</td>
            <td style="font-family:var(--vp-font-family-mono);font-size:12px" :style="{ opacity: r.arrived ? 1 : .4, textDecoration: r.arrived ? 'none' : 'line-through' }">
              <span v-if="r.iv" style="color:var(--prin)">IV={{ r.iv }} ‖ </span>{{ hex(r.c.slice(0, 6), '') }}…
            </td>
            <td style="font-family:var(--vp-font-family-mono);font-size:12.5px">{{ r.rks }}</td>
            <td style="font-family:var(--vp-font-family-mono);white-space:pre"><b :class="r.arrived ? (r.ok ? 'ok-c' : 'bad-c') : ''">{{ r.dec }}</b></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="out prose" style="margin-top:10px">
      <template v-if="mode === 'sync' && !lost">同步模式运转正常：双方计数器一致，每条消息消耗密钥流中<b>互不重叠</b>的一段，相当于把所有消息拼起来当成一条长消息加密。</template>
      <template v-else-if="mode === 'sync'"><b class="bad-c">失步！</b>m₂ 丢失后接收方的计数器落后了 {{ msgs[1].length }} 字节，m₃ 用错了密钥流段，解出乱码；之后的所有消息都会错。同步模式要求<b>可靠、有序</b>的信道，适合一次会话内连续传输。</template>
      <template v-else-if="!ivRepeat">非同步模式：每条消息自带 IV，丢包、乱序都不影响其他消息的解密。代价是每条消息要多传一个 IV，并且要求 G 在“同一 k、不同 IV”下的输出彼此看起来独立（对 G 的要求更强）。</template>
      <template v-else><b class="bad-c">IV 重复 ⇒ 密钥流重复！</b>敌手看到两个相同的 IV 就知道 c₁ ⊕ c₃ = m₁ ⊕ m₃；只要猜中 m₁（例如固定的问候语），就立即得到 m₃ 的对应部分：“{{ leak }}”。这正是 WEP 的死穴（4.9 节）。</template>
    </div>
  </Widget>
</template>
