// 第 05 讲（CPA 安全与伪随机函数）交互组件共用的小工具
// 注意：这里的“玩具 PRF / PRG”只是用整数混合函数模拟“看起来随机”的行为，
// 用于演示，不具备任何真实的密码学安全性。

// 32 位整数混合（murmur3 的 fmix32 变体），输出无符号 32 位
export function mix32(h: number) {
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return (h ^ (h >>> 16)) >>> 0
}

// 玩具 PRF：F(k, x)，输出 nOut 位（nOut ≤ 30）
export function toyF(k: number, x: number, nOut = 8, salt = 0) {
  const h = mix32(mix32((k >>> 0) ^ 0x9e3779b9 ^ salt) ^ Math.imul(x + 1, 0x27d4eb2d))
  return h & (2 ** nOut - 1)
}

// 玩具长度加倍 PRG 的左右两半：G(s) = G0(s) ‖ G1(s)，各 n 位
export const toyG0 = (s: number, n = 8) => toyF(s, 0x5a5a, n, 0x1111)
export const toyG1 = (s: number, n = 8) => toyF(s, 0xa5a5, n, 0x2222)

// 均匀随机 n 位整数
export const randBits = (n: number) => Math.floor(Math.random() * 2 ** n)
export const randBit = () => (Math.random() < 0.5 ? 0 : 1)

// 格式化
export const bin = (v: number, n: number) => (v >>> 0).toString(2).padStart(n, '0').slice(-n)
export const hex = (v: number, n: number) => (v >>> 0).toString(16).padStart(Math.ceil(n / 4), '0')

// 解析两位十六进制字节（失败返回 null）
export function parseByte(s: string) {
  const t = s.trim().toLowerCase().replace(/^0x/, '')
  if (!/^[0-9a-f]{1,2}$/.test(t)) return null
  return parseInt(t, 16)
}

// 惰性采样的真随机函数：第一次查询时才均匀采样输出，之后查表
export class LazyRandomFunction {
  table = new Map<number, number>()
  constructor(public nOut: number) {}
  query(x: number) {
    const fresh = !this.table.has(x)
    if (fresh) this.table.set(x, randBits(this.nOut))
    return { y: this.table.get(x)!, fresh }
  }
}

// q 次独立均匀采样（取值空间 N）至少一次碰撞的精确概率
export function collisionProb(q: number, N: number) {
  let p = 1
  for (let i = 1; i < q; i++) {
    p *= 1 - i / N
    if (p <= 0) return 1
  }
  return 1 - p
}
