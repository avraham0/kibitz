import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AnalyzeForm } from './AnalyzeForm.js'

describe('AnalyzeForm', () => {
  it('starts with an empty username and seeds from initial', () => {
    const { unmount } = render(<AnalyzeForm onSubmit={vi.fn()} disabled={false} />)
    expect((screen.getByPlaceholderText(/username/i) as HTMLInputElement).value).toBe('')
    unmount()
    render(<AnalyzeForm onSubmit={vi.fn()} disabled={false} initial={{ user: 'bob' }} />)
    expect((screen.getByPlaceholderText(/username/i) as HTMLInputElement).value).toBe('bob')
  })

  it('submits trimmed params and blocks empty username', () => {
    const onSubmit = vi.fn()
    render(<AnalyzeForm onSubmit={onSubmit} disabled={false} />)
    fireEvent.change(screen.getByPlaceholderText(/username/i), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /analyze/i }))
    expect(onSubmit).not.toHaveBeenCalled() // empty username
    fireEvent.change(screen.getByPlaceholderText(/username/i), { target: { value: ' bob ' } })
    fireEvent.click(screen.getByRole('button', { name: /analyze/i }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ user: 'bob', result: 'all' }))
  })
})
