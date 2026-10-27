// 第 06 讲（分组密码）专用工具函数
// 注意：除 AES 外，这里的密码全部是“教学用玩具密码”，分组只有 16 位，毫无安全性可言，
// 只用来演示结构与性质（工作模式、雪崩效应、Feistel 可逆性、中间相遇攻击）。

export const hex = (v: number, digits = 4) => v.toString(16).toUpperCase().padStart(digits, '0')
export const bin = (v: number, bits = 16) => v.toString(2).padStart(bits, '0')
export const popcount = (v: number) => { let c = 0; while (v) { c += v & 1; v >>>= 1 } return c }
const rotl32 = (x: number, r: number) => (r %= 32, r === 0 ? x >>> 0 : ((x << r) | (x >>> (32 - r))) >>> 0)

/* ========================= Toy16：16 位玩具 SPN ========================= */
// S 盒取自 H. Heys《A Tutorial on Linear and Differential Cryptanalysis》，
// 满足课件 P31 的要求：改变输入的任意 1 位，输出至少改变 2 位。
export const SBOX = [0xE, 0x4, 0xD, 0x1, 0x2, 0xF, 0xB, 0x8, 0x3, 0xA, 0x6, 0xC, 0x5, 0x9, 0x0, 0x7]
export const SBOX_INV = (() => { const r = new Array(16); SBOX.forEach((v, i) => (r[v] = i)); return r })()

// 置换层：把 16 位看成 4×4 矩阵做转置——第 i 个 S 盒的第 j 位 → 第 j 个 S 盒的第 i 位。
// 于是每个 S 盒的 4 个输出位分别送往下一轮的 4 个不同 S 盒（课件 P31 的第二条设计要求）。
// 位编号：0 为最高位。转置是自逆的。
export const PERM = Array.from({ length: 16 }, (_, j) => (j % 4) * 4 + Math.floor(j / 4))
export function permute(x: number) {
  let y = 0
  for (let j = 0; j < 16; j++) if (x & (1 << (15 - j))) y |= 1 << (15 - PERM[j])
  return y
}
export function subst(x: number, box = SBOX) {
  let y = 0
  for (let i = 0; i < 4; i++) y |= box[(x >> (12 - 4 * i)) & 15] << (12 - 4 * i)
  return y
}
// 密钥编排：32 位主密钥，第 i 个子密钥 = 主密钥循环左移 4(i−1) 位后的高 16 位
export const spnSubkeys = (master: number, rounds = 4) =>
  Array.from({ length: rounds + 1 }, (_, i) => rotl32(master >>> 0, 4 * i) >>> 16)

export interface Stage { label: string; v: number; kind: 'in' | 'key' | 'sub' | 'perm' | 'out' }
// r 轮 SPN：每轮 = 密钥混合 + S 盒代换 + 置换；最后再做一次密钥混合（共 r+1 个子密钥），与课件 P29 一致
export function spnTrace(x: number, master: number, opt: { rounds?: number; noPerm?: boolean; noSub?: boolean } = {}) {
  const r = opt.rounds ?? 4, ks = spnSubkeys(master, r)
  const st: Stage[] = [{ label: '输入', v: x, kind: 'in' }]
  let v = x
  for (let i = 0; i < r; i++) {
    v ^= ks[i]; st.push({ label: `第 ${i + 1} 轮 ⊕K${i + 1}`, v, kind: 'key' })
    if (!opt.noSub) { v = subst(v); st.push({ label: `第 ${i + 1} 轮 S 盒`, v, kind: 'sub' }) }
    if (!opt.noPerm) { v = permute(v); st.push({ label: `第 ${i + 1} 轮 置换`, v, kind: 'perm' }) }
  }
  v ^= ks[r]; st.push({ label: `末尾 ⊕K${r + 1}`, v, kind: 'out' })
  return st
}
export function spnEnc(x: number, master: number) {
  const ks = spnSubkeys(master)
  let v = x
  for (let i = 0; i < 4; i++) v = permute(subst(v ^ ks[i]))
  return (v ^ ks[4]) & 0xFFFF
}
export function spnDec(y: number, master: number) {
  const ks = spnSubkeys(master)
  let v = y ^ ks[4]
  for (let i = 3; i >= 0; i--) v = subst(permute(v), SBOX_INV) ^ ks[i]
  return v & 0xFFFF
}

/* ========================= 工作模式（基于 Toy16） ========================= */
export type Mode = 'ECB' | 'CBC' | 'OFB' | 'CTR'
// 返回密文块数组：除 ECB 外第 0 个元素是 IV / ctr
export function modeEnc(mode: Mode, blocks: number[], key: number, iv: number) {
  const E = (x: number) => spnEnc(x, key)
  if (mode === 'ECB') return blocks.map(E)
  const out = [iv]
  if (mode === 'CBC') { let prev = iv; for (const m of blocks) { prev = E(prev ^ m); out.push(prev) } }
  if (mode === 'OFB') { let y = iv; for (const m of blocks) { y = E(y); out.push(m ^ y) } }
  if (mode === 'CTR') blocks.forEach((m, i) => out.push(m ^ E((iv + i + 1) & 0xFFFF)))
  return out
}
export function modeDec(mode: Mode, c: number[], key: number) {
  const E = (x: number) => spnEnc(x, key), D = (y: number) => spnDec(y, key)
  if (mode === 'ECB') return c.map(D)
  const iv = c[0], body = c.slice(1)
  if (mode === 'CBC') return body.map((ci, i) => D(ci) ^ c[i])
  if (mode === 'OFB') { let y = iv; return body.map(ci => { y = E(y); return ci ^ y }) }
  return body.map((ci, i) => ci ^ E((iv + i + 1) & 0xFFFF))
}
// 文本 ↔ 16 位块（每块 2 个 ASCII 字符，不足补 '.'）
export function textToBlocks(s: string) {
  const t = s.length % 2 ? s + '.' : s
  const r: number[] = []
  for (let i = 0; i < t.length; i += 2) r.push(((t.charCodeAt(i) & 0xFF) << 8) | (t.charCodeAt(i + 1) & 0xFF))
  return r
}
const printable = (c: number) => (c >= 32 && c < 127 ? String.fromCharCode(c) : '·')
export const blockToText = (b: number) => printable(b >> 8) + printable(b & 0xFF)

/* ========================= 玩具 Feistel（16 位分组，8 位半块） ========================= */
// 轮函数 f_i(R) = ((R⊕k_i)² >> 4) mod 256 —— 刻意选成“不可逆”的：256 个输入只有 167 种输出
export const feistelF = (k: number, r: number) => { const x = (r ^ k) & 0xFF; return ((x * x) >> 4) & 0xFF }
export const feistelKeys = (master: number, rounds: number) =>
  Array.from({ length: rounds }, (_, i) => (rotl32(master >>> 0, 5 * i) >>> 24) & 0xFF)
export const fRangeSize = (k: number) => new Set(Array.from({ length: 256 }, (_, r) => feistelF(k, r))).size

/* ========================= 中间相遇攻击用的玩具密码 ========================= */
// 12 位密钥 → 扩展成 32 位主密钥后用 Toy16 加密。密钥空间只有 4096，便于在浏览器里跑完整攻击。
export const expandKey12 = (k: number) => (Math.imul(k & 0xFFF, 0x9E3779B1) ^ ((k & 0xFFF) << 20) ^ 0x5A5A) >>> 0
export const E12 = (k: number, x: number) => spnEnc(x, expandKey12(k))
export const D12 = (k: number, y: number) => spnDec(y, expandKey12(k))

/* ========================= AES-128（真实算法，FIPS-197） ========================= */
const xtime = (a: number) => ((a << 1) ^ (a & 0x80 ? 0x1B : 0)) & 0xFF
export function gmul(a: number, b: number) {
  let p = 0
  while (b) { if (b & 1) p ^= a; a = xtime(a); b >>= 1 }
  return p
}
// 按定义生成 S 盒：求 GF(2^8) 乘法逆元，再做仿射变换
export const AES_SBOX = (() => {
  const s = new Array(256)
  for (let x = 0; x < 256; x++) {
    let inv = 0
    if (x) for (let y = 1; y < 256; y++) if (gmul(x, y) === 1) { inv = y; break }
    let b = inv, r = inv
    for (let i = 0; i < 4; i++) { b = ((b << 1) | (b >> 7)) & 0xFF; r ^= b }
    s[x] = r ^ 0x63
  }
  return s
})()
const RCON = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1B, 0x36]
// 输出 11 个轮密钥，每个 16 字节（按列优先，与状态矩阵排布一致）
export function aesKeyExpand(key: number[]) {
  const w: number[][] = []
  for (let i = 0; i < 4; i++) w.push(key.slice(4 * i, 4 * i + 4))
  for (let i = 4; i < 44; i++) {
    let t = w[i - 1].slice()
    if (i % 4 === 0) { t = [t[1], t[2], t[3], t[0]].map(b => AES_SBOX[b]); t[0] ^= RCON[i / 4 - 1] }
    w.push(w[i - 4].map((b, j) => b ^ t[j]))
  }
  return Array.from({ length: 11 }, (_, r) => w.slice(4 * r, 4 * r + 4).flat())
}
// 状态 s 为 16 字节、列优先：s[r + 4c] 是第 r 行第 c 列
export const subBytes = (s: number[]) => s.map(b => AES_SBOX[b])
export const shiftRows = (s: number[]) => s.map((_, i) => { const r = i % 4, c = Math.floor(i / 4); return s[r + 4 * ((c + r) % 4)] })
export function mixColumns(s: number[]) {
  const o = s.slice()
  for (let c = 0; c < 4; c++) {
    const [a0, a1, a2, a3] = s.slice(4 * c, 4 * c + 4)
    o[4 * c] = gmul(a0, 2) ^ gmul(a1, 3) ^ a2 ^ a3
    o[4 * c + 1] = a0 ^ gmul(a1, 2) ^ gmul(a2, 3) ^ a3
    o[4 * c + 2] = a0 ^ a1 ^ gmul(a2, 2) ^ gmul(a3, 3)
    o[4 * c + 3] = gmul(a0, 3) ^ a1 ^ a2 ^ gmul(a3, 2)
  }
  return o
}
export const addRoundKey = (s: number[], k: number[]) => s.map((b, i) => b ^ k[i])

export type AesStep = 'Init' | 'SubBytes' | 'ShiftRows' | 'MixColumns' | 'AddRoundKey'
export interface AesStage { round: number; step: AesStep; s: number[] }
// 完整记录 AES-128 加密的每一步
export function aesTrace(pt: number[], key: number[]) {
  const rk = aesKeyExpand(key)
  const out: AesStage[] = [{ round: 0, step: 'Init', s: pt.slice() }]
  let s = addRoundKey(pt, rk[0]); out.push({ round: 0, step: 'AddRoundKey', s })
  for (let r = 1; r <= 10; r++) {
    s = subBytes(s); out.push({ round: r, step: 'SubBytes', s })
    s = shiftRows(s); out.push({ round: r, step: 'ShiftRows', s })
    if (r < 10) { s = mixColumns(s); out.push({ round: r, step: 'MixColumns', s }) }
    s = addRoundKey(s, rk[r]); out.push({ round: r, step: 'AddRoundKey', s })
  }
  return { stages: out, rk }
}
export const parseHexBytes = (h: string) => {
  const t = h.replace(/[^0-9a-fA-F]/g, '').padEnd(32, '0').slice(0, 32)
  return Array.from({ length: 16 }, (_, i) => parseInt(t.slice(2 * i, 2 * i + 2), 16))
}
export const bytesHex = (b: number[]) => b.map(x => hex(x, 2)).join('')
