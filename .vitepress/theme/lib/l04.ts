// 第 04 讲（流密码）专用工具函数：LFSR、GF(2) 线性方程组、RC4、字节/十六进制转换

// ---------- LFSR ----------
// 约定与课件 P16 一致：状态数组 s[0..n-1]，输出 s[0]；
// 新的 s[n-1] = ⊕ c[i]·s[i]，其余 s[i] ← s[i+1]
export function lfsrStep(s: number[], c: number[]): { out: number; next: number[] } {
  const n = s.length
  let fb = 0
  for (let i = 0; i < n; i++) fb ^= c[i] & s[i]
  const next = s.slice(1).concat(fb)
  return { out: s[0], next }
}

// 生成 len 个输出位
export function lfsrRun(s0: number[], c: number[], len: number): number[] {
  let s = s0.slice()
  const out: number[] = []
  for (let t = 0; t < len; t++) {
    const r = lfsrStep(s, c)
    out.push(r.out)
    s = r.next
  }
  return out
}

// 状态序列的“前周期 μ + 周期 λ”：第 μ 拍的状态在第 μ+λ 拍第一次重现
export function lfsrCycle(s0: number[], c: number[]): { mu: number; lambda: number } {
  const seen = new Map<string, number>()
  let s = s0.slice()
  for (let t = 0; ; t++) {
    const key = s.join('')
    const prev = seen.get(key)
    if (prev !== undefined) return { mu: prev, lambda: t - prev }
    seen.set(key, t)
    s = lfsrStep(s, c).next
  }
}

// ---------- GF(2) 高斯消元 ----------
// 解 A·x = b（模 2），记录每一步，便于在页面上逐步展示
export interface ElimStep { note: string; rows: number[][] }
export interface ElimResult {
  steps: ElimStep[]
  status: 'unique' | 'many' | 'none'
  x: number[] | null      // 唯一解或一个特解
  free: number[]          // 自由变量下标
}
export function solveGF2(A: number[][], b: number[], names: string[]): ElimResult {
  const n = A[0].length, m = A.length
  const M = A.map((r, i) => r.concat(b[i]))
  const steps: ElimStep[] = [{ note: '增广矩阵 [A | b]', rows: M.map(r => r.slice()) }]
  const pivCol: number[] = []
  let row = 0
  for (let col = 0; col < n && row < m; col++) {
    let p = -1
    for (let r = row; r < m; r++) if (M[r][col]) { p = r; break }
    if (p < 0) continue
    if (p !== row) {
      [M[p], M[row]] = [M[row], M[p]]
      steps.push({ note: `交换第 ${row + 1}、${p + 1} 行，使 ${names[col]} 的系数为 1`, rows: M.map(r => r.slice()) })
    }
    const elim: number[] = []
    for (let r = 0; r < m; r++) {
      if (r !== row && M[r][col]) {
        for (let k = col; k <= n; k++) M[r][k] ^= M[row][k]
        elim.push(r + 1)
      }
    }
    if (elim.length) steps.push({ note: `用第 ${row + 1} 行消去第 ${elim.join('、')} 行中的 ${names[col]}（按位异或）`, rows: M.map(r => r.slice()) })
    pivCol.push(col)
    row++
  }
  for (let r = row; r < m; r++) if (M[r][n]) return { steps, status: 'none', x: null, free: [] }
  const x = new Array(n).fill(0)
  pivCol.forEach((col, r) => { x[col] = M[r][n] })
  const free = Array.from({ length: n }, (_, i) => i).filter(i => !pivCol.includes(i))
  return { steps, status: free.length ? 'many' : 'unique', x, free }
}

// ---------- RC4 ----------
// 课件 P42/P44 的伪代码，N 可取 256（标准）或更小（教学用的缩小版）
export function rc4Ksa(key: number[], N = 256): number[] {
  const S = Array.from({ length: N }, (_, i) => i)
  const T = Array.from({ length: N }, (_, i) => key[i % key.length] % N)
  let j = 0
  for (let i = 0; i < N; i++) {
    j = (j + S[i] + T[i]) % N
    ;[S[i], S[j]] = [S[j], S[i]]
  }
  return S
}
export function rc4Stream(key: number[], len: number, N = 256): number[] {
  const S = rc4Ksa(key, N)
  let i = 0, j = 0
  const out: number[] = []
  for (let k = 0; k < len; k++) {
    i = (i + 1) % N
    j = (j + S[i]) % N
    ;[S[i], S[j]] = [S[j], S[i]]
    out.push(S[(S[i] + S[j]) % N])
  }
  return out
}

// ---------- 字节工具 ----------
export const utf8 = (s: string) => Array.from(new TextEncoder().encode(s))
export const fromUtf8 = (b: number[]) => new TextDecoder().decode(new Uint8Array(b))
export const hex = (b: number[], sep = ' ') => b.map(x => x.toString(16).padStart(2, '0').toUpperCase()).join(sep)
export const xorBytes = (a: number[], b: number[]) => a.slice(0, Math.min(a.length, b.length)).map((x, i) => x ^ b[i])
// 可打印 ASCII 显示，非可打印字节用 · 代替
export const show = (b: number[]) => b.map(x => (x >= 32 && x < 127 ? String.fromCharCode(x) : '·')).join('')
export const asciiBytes = (s: string) => Array.from(s).map(ch => ch.charCodeAt(0) & 0xff)
