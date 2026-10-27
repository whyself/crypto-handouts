// 第 02 讲（完美保密）交互组件共用的工具：小型加密方案的枚举、密文分布、分数格式化
import { A, mod } from './crypto'

export type Sym = number[]

export interface KeyEntry { k: Sym; p: number; label: string }

export interface Scheme {
  id: string
  name: string            // 显示名（可含 HTML）
  len: number             // 消息长度（字母个数或比特数）
  alpha: 'letter' | 'bit'
  keys: KeyEntry[]        // 枚举全部密钥及其概率（Gen 的输出分布）
  enc: (k: Sym, m: Sym) => Sym
  defaults: [string, string]
  note: string            // 一句话说明
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i)

// Π_shft1：单字母移位，k ← {0..25} 均匀
const shft1: Scheme = {
  id: 'shft1', name: 'Π<sub>shft1</sub>（单字母移位）', len: 1, alpha: 'letter',
  keys: range(26).map(s => ({ k: [s], p: 1 / 26, label: `k=${s}` })),
  enc: (k, m) => m.map(x => mod(x + k[0], 26)),
  defaults: ['a', 'z'], note: '消息只有 1 个字母，密钥 26 个、均匀选取。'
}

// Π_shft2：三字母消息，三个字母共用同一个移位量
const shft2: Scheme = {
  id: 'shft2', name: 'Π<sub>shft2</sub>（三字母同一移位）', len: 3, alpha: 'letter',
  keys: range(26).map(s => ({ k: [s], p: 1 / 26, label: `k=${s}` })),
  enc: (k, m) => m.map(x => mod(x + k[0], 26)),
  defaults: ['ann', 'bob'], note: '三个字母用同一个 k，字母间的“差”原样保留在密文里。'
}

// 维吉尼亚：两字母消息，周期 t 在 {1,2} 中均匀选取（课件 P69 的例子）
const vig12: Scheme = {
  id: 'vig12', name: '维吉尼亚（周期 t∈{1,2}）', len: 2, alpha: 'letter',
  keys: [
    ...range(26).map(s => ({ k: [s, s], p: 1 / 52, label: `t=1, k=${A[s]}` })),
    ...range(676).map(i => ({ k: [Math.floor(i / 26), i % 26], p: 1 / 1352, label: `t=2, k=${A[Math.floor(i / 26)]}${A[i % 26]}` }))
  ],
  enc: (k, m) => m.map((x, i) => mod(x + k[i], 26)),
  defaults: ['aa', 'ab'], note: '一半概率两字母同移位（t=1），一半概率各自独立移位（t=2）。'
}

// 维吉尼亚：周期固定为 2，消息也恰好 2 个字母——其实就是 Z_26 上的一次一密
const vig2: Scheme = {
  id: 'vig2', name: '维吉尼亚（周期固定 2）', len: 2, alpha: 'letter',
  keys: range(676).map(i => ({ k: [Math.floor(i / 26), i % 26], p: 1 / 676, label: `k=${A[Math.floor(i / 26)]}${A[i % 26]}` })),
  enc: (k, m) => m.map((x, i) => mod(x + k[i], 26)),
  defaults: ['aa', 'ab'], note: '密钥和消息一样长且每位独立均匀——这正是 Z₂₆ 上的一次一密。'
}

// 一次一密：l = 4 比特
const otp4: Scheme = {
  id: 'otp4', name: '一次一密 OTP（l=4）', len: 4, alpha: 'bit',
  keys: range(16).map(v => { const k = toBits(v, 4); return { k, p: 1 / 16, label: `k=${k.join('')}` } }),
  enc: (k, m) => m.map((x, i) => x ^ k[i]),
  defaults: ['0000', '1111'], note: '密钥与消息等长、均匀随机，逐位异或。'
}

// 密钥分布不均匀的 Π_shft1：Pr[k=0]=1/2，其余 25 个各 1/50
const shft1bias: Scheme = {
  id: 'shft1bias', name: 'Π<sub>shft1</sub> 但密钥不均匀', len: 1, alpha: 'letter',
  keys: range(26).map(s => ({ k: [s], p: s === 0 ? 1 / 2 : 1 / 50, label: `k=${s}` })),
  enc: (k, m) => m.map(x => mod(x + k[0], 26)),
  defaults: ['b', 'g'], note: 'Gen 有一半概率输出 k=0（相当于没加密），其余密钥各 1/50。'
}

export const SCHEMES: Record<string, Scheme> = { shft1, shft2, vig12, vig2, otp4, shft1bias }

export function toBits(v: number, l: number): Sym {
  return range(l).map(i => (v >> (l - 1 - i)) & 1)
}

// 字符串 ↔ 符号序列；不合法时返回 null
export function parse(s: Scheme, str: string): Sym | null {
  const t = str.trim().toLowerCase()
  if (t.length !== s.len) return null
  if (s.alpha === 'bit') return /^[01]+$/.test(t) ? [...t].map(Number) : null
  return /^[a-z]+$/.test(t) ? [...t].map(ch => A.indexOf(ch)) : null
}
export function show(s: Scheme, x: Sym, upper = false): string {
  if (s.alpha === 'bit') return x.join('')
  const r = x.map(i => A[i]).join('')
  return upper ? r.toUpperCase() : r
}

// 给定明文 m，枚举密钥得到密文分布 Pr[C=c | M=m]（键为密文字符串）
export function cipherDist(s: Scheme, m: Sym): Map<string, number> {
  const d = new Map<string, number>()
  for (const e of s.keys) {
    const c = show(s, s.enc(e.k, m), true)
    d.set(c, (d.get(c) || 0) + e.p)
  }
  return d
}

// 能把 m 加密成 c 的全部密钥
export function keysTo(s: Scheme, m: Sym, c: string): KeyEntry[] {
  return s.keys.filter(e => show(s, s.enc(e.k, m), true) === c)
}

// 按概率抽取一把密钥
export function sampleKey(s: Scheme): KeyEntry {
  let r = Math.random()
  for (const e of s.keys) { r -= e.p; if (r <= 0) return e }
  return s.keys[s.keys.length - 1]
}

// 最优敌手在 PrivK^eav 中的成功率：1/2 + 1/4 · Σ_c |p0(c) − p1(c)|
export function optimalAdv(s: Scheme, m0: Sym, m1: Sym) {
  const d0 = cipherDist(s, m0), d1 = cipherDist(s, m1)
  const all = new Set([...d0.keys(), ...d1.keys()])
  let l1 = 0
  for (const c of all) l1 += Math.abs((d0.get(c) || 0) - (d1.get(c) || 0))
  return { d0, d1, rate: 0.5 + l1 / 4 }
}

// 把小数近似成分数显示，如 0.0384615 → "1/26"
export function frac(x: number, maxDen = 3000): string {
  if (Math.abs(x) < 1e-12) return '0'
  if (Math.abs(x - Math.round(x)) < 1e-9) return String(Math.round(x))
  for (let d = 2; d <= maxDen; d++) {
    const n = Math.round(x * d)
    if (Math.abs(n / d - x) < 1e-9) return `${n}/${d}`
  }
  return x.toFixed(4)
}

export const fix = (x: number, n = 4) => (Math.abs(x) < 1e-12 ? '0' : x.toFixed(n).replace(/0+$/, '').replace(/\.$/, ''))
