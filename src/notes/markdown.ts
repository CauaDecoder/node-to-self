const escapeHtml = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')

export function renderSafeMarkdown(markdown: string): string {
  const linked = escapeHtml(markdown).replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label: string, href: string) => /^https?:\/\//i.test(href) ? `<a href="${href}" target="_blank" rel="noreferrer">${label}</a>` : label)
  return linked.split('\n').map((line) => line.startsWith('### ') ? `<h3>${line.slice(4)}</h3>` : line.startsWith('## ') ? `<h2>${line.slice(3)}</h2>` : line.startsWith('# ') ? `<h1>${line.slice(2)}</h1>` : `<p>${line.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>')}</p>`).join('')
}
