import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { App } from './App'
import { resetProjectStoreForTests } from '../store/project-store'

describe('App', () => {
  beforeEach(() => resetProjectStoreForTests())

  it('offers a local project creation flow', () => {
    render(<App />)
    expect(screen.getByRole('main', { name: 'Project chooser' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create project' })).toBeInTheDocument()
  })
})
