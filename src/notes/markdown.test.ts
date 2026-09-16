import { describe, expect, it } from 'vitest'
import { renderSafeMarkdown } from './markdown'

describe('safe markdown', () => {
  it('escapes HTML, does not render images, and accepts only http links', () => {
    const preview = renderSafeMarkdown('<img src="https://example.test/a.png"> [safe](https://example.com) [bad](javascript:alert(1))')
    expect(preview).toContain('&lt;img')
    expect(preview).toContain('href="https://example.com"')
    expect(preview).not.toContain('javascript:')
  })
})
