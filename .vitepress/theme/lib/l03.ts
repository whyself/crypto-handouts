// 第 03 讲（计算安全）交互组件的通用工具函数

// ---------- 比特串工具 ----------
export type Bits = number[]

export const randBits = (len: number): Bits => Array.from({ length: len }, () => (Math.random() < 0.5 ? 1 : 0))
export const xor = (a: Bits, b: Bits): Bits => a.map((x, i) => x ^ b[i])
export const bitsToStr = (a: Bits) => a.join('')
export const strToBits = (s: string, len: number): Bits => {
  const t = s.replace(/[^01]/g, '').slice(0, len).padEnd(len, '0')
  return [...t].map(Number)
}
export const toInt = (a: Bits) => a.reduce((v, x) => v * 2 + x, 0)
export const fromInt = (v: number, len: number): Bits =>
  Array.from({ length: len }, (_, i) => (v >> (len - 1 - i)) & 1)
export const weight = (a: Bits) => a.reduce((s, x) => s + x, 0)

// ---------- 玩具 PRG：种子 n = 8 位，输出 l = 16 位 ----------
export const SEED_LEN = 8
export const OUT_LEN = 16

// “看起来随机”的混合函数（仅用于演示，绝非真正的 PRG：种子只有 8 位，穷举即破）
function mix(seed: number): number {
  let x = (seed * 0x9e37 + 0x7f4a) & 0xffff
  for (let r = 0; r < 4; r++) {
    x ^= x << 7; x &= 0xffff
    x ^= x >>> 9
    x = (x * 0x2c1b + seed * 0x3b + r) & 0xffff
  }
  return x
}

export interface ToyPrg { id: string; name: string; desc: string; G: (s: Bits) => Bits }

export const PRGS: ToyPrg[] = [
  {
    id: 'mix', name: '混合函数 G_mix',
    desc: 'G(s) = 16 位混合函数输出。肉眼看不出规律，但种子只有 2⁸ = 256 种，输出最多只覆盖 2¹⁶ 个串中的 256 个——穷举种子即可区分。',
    G: s => fromInt(mix(toInt(s)), OUT_LEN)
  },
  {
    id: 'dup', name: '重复 G(s)=s‖s',
    desc: 'G(s) = s‖s：前后两半永远相同。区分器“检查两半是否相等”的优势为 1 − 2⁻⁸。',
    G: s => [...s, ...s]
  },
  {
    id: 'par', name: '奇偶 G(s)=s‖…',
    desc: 'G(s) = s 后面拼上 8 个比特，每个都是 s 的前缀奇偶校验位。区分器“检查第 9 位是否等于 s₁”优势约为 1/2。',
    G: s => {
      const out = [...s]
      let p = 0
      for (let i = 0; i < SEED_LEN; i++) { p ^= s[i]; out.push(p) }
      return out
    }
  }
]

// 预先计算 G_mix 的值域（用于“穷举种子”区分器）
let rangeCache: Map<string, Set<string>> | null = null
export function rangeOf(prg: ToyPrg): Set<string> {
  if (!rangeCache) rangeCache = new Map()
  let r = rangeCache.get(prg.id)
  if (!r) {
    r = new Set()
    for (let v = 0; v < 1 << SEED_LEN; v++) r.add(bitsToStr(prg.G(fromInt(v, SEED_LEN))))
    rangeCache.set(prg.id, r)
  }
  return r
}

// ---------- 数值工具（对数域，避免下溢） ----------
// log2(n!)，用 lgamma 的 Stirling 近似（n 较大时）或直接累加
export function log2Fact(n: number): number {
  if (n < 2) return 0
  if (n < 200) { let s = 0; for (let i = 2; i <= n; i++) s += Math.log2(i); return s }
  const ln = n * Math.log(n) - n + 0.5 * Math.log(2 * Math.PI * n) + 1 / (12 * n)
  return ln / Math.LN2
}

// log2 C(n, k)
export const log2Binom = (n: number, k: number) => log2Fact(n) - log2Fact(k) - log2Fact(n - k)

// 把 log10 值格式化成 “a × 10^b”
export function fmtPow10(lg: number, digits = 2): string {
  if (!isFinite(lg)) return lg < 0 ? '0' : '∞'
  if (lg > -3 && lg < 4) return Math.pow(10, lg).toPrecision(digits + 1).replace(/\.?0+$/, '')
  const e = Math.floor(lg)
  const m = Math.pow(10, lg - e)
  return `${m.toFixed(digits)} × 10^${e}`
}

// 把秒数格式化成易读时间
export function fmtTime(sec: number): string {
  const Y = 31557600
  if (sec < 1e-6) return '< 1 微秒'
  if (sec < 1) return (sec * 1000).toPrecision(3) + ' 毫秒'
  if (sec < 120) return sec.toPrecision(3) + ' 秒'
  if (sec < 7200) return (sec / 60).toPrecision(3) + ' 分钟'
  if (sec < 86400 * 2) return (sec / 3600).toPrecision(3) + ' 小时'
  if (sec < 86400 * 60) return (sec / 86400).toPrecision(3) + ' 天'
  if (sec < Y * 2) return (sec / 86400 / 7).toPrecision(3) + ' 周'
  if (sec < Y * 1e4) return (sec / Y).toPrecision(3) + ' 年'
  return fmtPow10(Math.log10(sec / Y)) + ' 年'
}
