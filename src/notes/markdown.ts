const escapeHtml = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')

function inline(text: string): string {
  return escapeHtml(text)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label: string, href: string) => (/^https?:\/\//i.test(href) ? `<a href="${href}" target="_blank" rel="noreferrer">${label}</a>` : label))
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<![*\w])\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

export function renderSafeMarkdown(markdown: string): string {
  const lines = markdown.split('\n')
  const blocks: string[] = []
  let inCode = false
  let codeLines: string[] = []
  let listType: 'ul' | 'ol' | null = null
  let listItems: string[] = []
  let inQuote = false
  let quoteLines: string[] = []

  const flushList = (): void => {
    if (!listType) return
    blocks.push(`<${listType}>${listItems.join('')}</${listType}>`)
    listType = null
    listItems = []
  }
  const flushQuote = (): void => {
    if (!inQuote) return
    blocks.push(`<blockquote>${quoteLines.join('')}</blockquote>`)
    inQuote = false
    quoteLines = []
  }

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (inCode) {
        blocks.push(`<pre><code>${codeLines.join('\n')}</code></pre>`)
        inCode = false
        codeLines = []
      } else {
        flushList()
        flushQuote()
        inCode = true
      }
      continue
    }
    if (inCode) {
      codeLines.push(escapeHtml(line))
      continue
    }
    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) {
      flushList()
      flushQuote()
      blocks.push('<hr />')
      continue
    }
    const checkbox = /^\s*[-*]\s+\[([ xX])\]\s+(.*)$/.exec(line)
    const unordered = !checkbox ? /^\s*[-*]\s+(.*)$/.exec(line) : null
    const ordered = /^\s*\d+\.\s+(.*)$/.exec(line)
    const quote = /^\s*>\s?(.*)$/.exec(line)

    if (checkbox) {
      if (listType !== 'ul') { flushList(); listType = 'ul' }
      const checked = checkbox[1].toLowerCase() === 'x'
      listItems.push(`<li class="task-item"><input type="checkbox" disabled${checked ? ' checked' : ''} /> ${inline(checkbox[2])}</li>`)
      continue
    }
    if (unordered) {
      if (listType !== 'ul') { flushList(); listType = 'ul' }
      listItems.push(`<li>${inline(unordered[1])}</li>`)
      continue
    }
    if (ordered) {
      if (listType !== 'ol') { flushList(); listType = 'ol' }
      listItems.push(`<li>${inline(ordered[1])}</li>`)
      continue
    }
    flushList()

    if (quote) {
      inQuote = true
      quoteLines.push(`<p>${inline(quote[1])}</p>`)
      continue
    }
    flushQuote()

    if (line.startsWith('### ')) blocks.push(`<h3>${inline(line.slice(4))}</h3>`)
    else if (line.startsWith('## ')) blocks.push(`<h2>${inline(line.slice(3))}</h2>`)
    else if (line.startsWith('# ')) blocks.push(`<h1>${inline(line.slice(2))}</h1>`)
    else if (line.trim() !== '') blocks.push(`<p>${inline(line)}</p>`)
  }
  flushList()
  flushQuote()
  if (inCode) blocks.push(`<pre><code>${codeLines.join('\n')}</code></pre>`)
  return blocks.join('')
}
