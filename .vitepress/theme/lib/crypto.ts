// 古典密码通用工具（各讲交互组件复用）
export const A = 'abcdefghijklmnopqrstuvwxyz'

// 标准英文字母频率 p_i（Katz & Lindell 教材图 1.3）
export const FREQ = [.082, .015, .028, .042, .127, .022, .020, .061, .070, .001, .008, .040, .024,
  .067, .075, .019, .001, .060, .063, .090, .028, .010, .024, .002, .020, .001]

export const mod = (a: number, n: number) => ((a % n) + n) % n
export const idx = (ch: string) => A.indexOf(ch.toLowerCase())
export const lettersOnly = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')
export const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)

export function shift(text: string, k: number, upper = false) {
  return text.replace(/[a-z]/gi, ch => {
    const c = A[mod(idx(ch) + k, 26)]
    return upper ? c.toUpperCase() : c
  })
}

export function vigenere(text: string, key: string, dir: 1 | -1 = 1, upper = dir === 1) {
  let n = 0
  return text.toLowerCase().replace(/[a-z]/g, ch => {
    const c = A[mod(idx(ch) + dir * idx(key[n++ % key.length]), 26)]
    return upper ? c.toUpperCase() : c
  })
}

export function freqs(text: string) {
  const c = new Array(26).fill(0)
  for (const ch of lettersOnly(text)) c[idx(ch)]++
  const n = c.reduce((a, b) => a + b, 0) || 1
  return c.map(x => x / n)
}

// I_j = Σ p_i · q_{i+j}
export function Ij(text: string) {
  const q = freqs(text)
  return Array.from({ length: 26 }, (_, j) => FREQ.reduce((s, p, i) => s + p * q[mod(i + j, 26)], 0))
}

// 取 I_j 最接近 0.065 的 j
export const bestJ = (I: number[]) => I.reduce((b, v, j) => (Math.abs(v - .065) < Math.abs(I[b] - .065) ? j : b), 0)

// 演示用英文段落
export const PARA = 'cryptography is the practice and study of techniques for secure communication in the presence of adversaries. for most of history the design of ciphers was more of an art than a science, and every classical cipher that people believed to be unbreakable was eventually broken. the simple substitution cipher looks strong because the number of possible keys is enormous, yet an attacker who counts how often each letter appears in the ciphertext can quickly guess the most common letters such as e, t, a and o. once a few letters are known, the remaining ones follow from common words and patterns. this is why modern cryptography insists on precise definitions, clear assumptions and rigorous proofs of security.'
