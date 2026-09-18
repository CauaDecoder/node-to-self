import { describe, expect, it } from 'vitest'
import { renderSafeMarkdown } from './markdown'

describe('safe markdown', () => {
  it('escapes HTML, does not render images, and accepts only http links', () => {
    const preview = renderSafeMarkdown('<img src="https://example.test/a.png"> [safe](https://example.com) [bad](javascript:alert(1))')
    expect(preview).toContain('&lt;img')
    expect(preview).toContain('href="https://example.com"')
    expect(preview).not.toContain('javascript:')
  })

  it('renders unordered and ordered lists', () => {
    const preview = renderSafeMarkdown('- one\n- two\n\n1. first\n2. second')
    expect(preview).toContain('<ul><li>one</li><li>two</li></ul>')
    expect(preview).toContain('<ol><li>first</li><li>second</li></ol>')
  })

  it('renders read-only checkboxes', () => {
    const preview = renderSafeMarkdown('- [ ] todo\n- [x] done')
    expect(preview).toContain('<input type="checkbox" disabled />')
    expect(preview).toContain('<input type="checkbox" disabled checked />')
  })

  it('renders italic text without breaking bold', () => {
    const preview = renderSafeMarkdown('**bold** and *italic*')
    expect(preview).toContain('<strong>bold</strong>')
    expect(preview).toContain('<em>italic</em>')
  })

  it('renders fenced code blocks without applying inline formatting', () => {
    const preview = renderSafeMarkdown('```\nconst a = *not italic*\n```')
    expect(preview).toContain('<pre><code>const a = *not italic*</code></pre>')
  })

  it('renders blockquotes and horizontal rules', () => {
    const preview = renderSafeMarkdown('> quoted text\n\n---')
    expect(preview).toContain('<blockquote><p>quoted text</p></blockquote>')
    expect(preview).toContain('<hr />')
  })

  it('escapes script tags and attribute-based XSS attempts inside list and quote content', () => {
    const preview = renderSafeMarkdown('- <script>alert(1)</script>\n> <img src=x onerror=alert(1)>')
    expect(preview).not.toContain('<script>')
    expect(preview).toContain('&lt;script&gt;')
    expect(preview).not.toContain('<img ')
    expect(preview).toContain('&lt;img')
  })
})
