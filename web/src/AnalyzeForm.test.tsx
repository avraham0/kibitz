import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AnalyzeForm } from './AnalyzeForm.js'

describe('AnalyzeForm', () => {
  it('submits trimmed params and blocks empty username', () => {
    const onSubmit = vi.fn()
    render(<AnalyzeForm onSubmit={onSubmit} disabled={false} />)
    fireEvent.click(screen.getByRole('button', { name: /analyze/i }))
    expect(onSubmit).not.toHaveBeenCalled() // empty username
    fireEvent.change(screen.getByPlaceholderText('username'), { target: { value: ' bob ' } })
    fireEvent.click(screen.getByRole('button', { name: /analyze/i }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ user: 'bob' }))
  })
})
