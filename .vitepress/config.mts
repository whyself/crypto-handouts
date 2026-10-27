import { defineConfig } from 'vitepress'
import container from 'markdown-it-container'

// 提示框类型 → 默认标签
const BOXES: Record<string, string> = { def: '定义', prin: '原则', ex: '示例', warn: '注意', exam: '核心' }

// 解析容器标题：`::: def [自定义标签] 标题文字 @P58–60`
function parseTitle(info: string, md: any) {
  let s = info.trim(), tag = '', page = ''
  const mt = s.match(/^\[([^\]]+)\]\s*/)
  if (mt) { tag = mt[1]; s = s.slice(mt[0].length) }
  const mp = s.match(/\s*@(P\S+)$/)
  if (mp) { page = mp[1]; s = s.slice(0, mp.index) }
  return { tag, title: s ? md.renderInline(s) : '', page: page ? `<span class="src">${page}</span>` : '' }
}

export default defineConfig({
  lang: 'zh-CN',
  title: '密码学讲义',
  description: '南京大学 · 密码学 · 中文交互式讲义',
  base: '/crypto-handouts/',
  cleanUrls: true,
  srcExclude: ['AUTHORING.md', 'README.md'],
  lastUpdated: true,
  markdown: {
    math: true,
    config(md) {
      for (const [name, label] of Object.entries(BOXES)) {
        md.use(container, name, {
          render(tokens: any[], idx: number) {
            const t = tokens[idx]
            if (t.nesting !== 1) return '</div>\n'
            const { tag, title, page } = parseTitle(t.info.trim().slice(name.length), md)
            return `<div class="box ${name}"><div class="box-h"><span class="tag">${tag || label}</span><span>${title}</span>${page}</div>\n`
          }
        })
      }
      // 先想再看：标题是问题，正文是答案
      md.use(container, 'qa', {
        render(tokens: any[], idx: number) {
          const t = tokens[idx]
          if (t.nesting !== 1) return '</QaCard>\n'
          const { title, page } = parseTitle(t.info.trim().slice(2), md)
          return `<QaCard><template #q>${title}${page}</template>\n`
        }
      })
      md.use(container, 'tldr', { render: (tk: any[], i: number) => tk[i].nesting === 1 ? '<div class="tldr">\n' : '</div>\n' })
      md.use(container, 'recap', { render: (tk: any[], i: number) => tk[i].nesting === 1 ? '<div class="recap">\n' : '</div>\n' })
      md.use(container, 'card', {
        render(tokens: any[], idx: number) {
          const t = tokens[idx]
          if (t.nesting !== 1) return '</div>\n'
          const { title } = parseTitle(t.info.trim().slice(4), md)
          return `<div class="card"><b>${title}</b>\n`
        }
      })
    }
  },
  themeConfig: {
    nav: [{ text: '讲义', link: '/lectures/00-01' }],
    sidebar: [
      {
        text: '期中前',
        items: [
          { text: '00–01 导论与古典密码', link: '/lectures/00-01' },
          { text: '02 完美保密', link: '/lectures/02' },
          { text: '03 计算安全', link: '/lectures/03' },
          { text: '04 流密码', link: '/lectures/04' },
          { text: '05 CPA 安全与伪随机函数', link: '/lectures/05' },
          { text: '06 分组密码', link: '/lectures/06' }
        ]
      }
    ],
    outline: { level: [2, 3], label: '本页目录' },
    docFooter: { prev: '上一讲', next: '下一讲' },
    lastUpdated: { text: '最后更新' },
    darkModeSwitchLabel: '外观',
    lightModeSwitchTitle: '切换到浅色',
    darkModeSwitchTitle: '切换到深色',
    sidebarMenuLabel: '目录',
    returnToTopLabel: '回到顶部',
    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '搜索讲义', buttonAriaLabel: '搜索讲义' },
          modal: { noResultsText: '没有找到结果', resetButtonTitle: '清除', footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' } }
        }
      }
    }
  }
})
