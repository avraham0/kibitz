import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AnalyzeForm } from './AnalyzeForm.js'

describe('AnalyzeForm', () => {
  it('prefills the default username', () => {
    render(<AnalyzeForm onSubmit={vi.fn()} disabled={false} />)
    expect((screen.getByPlaceholderText('username') as HTMLInputElement).value).toBe('avraham00')
  })

  it('submits trimmed params and blocks empty username', () => {
    const onSubmit = vi.fn()
    render(<AnalyzeForm onSubmit={onSubmit} disabled={false} />)
    fireEvent.change(screen.getByPlaceholderText('username'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /analyze/i }))
    expect(onSubmit).not.toHaveBeenCalled() // empty username
    fireEvent.change(screen.getByPlaceholderText('username'), { target: { value: ' bob ' } })
    fireEvent.click(screen.getByRole('button', { name: /analyze/i }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ user: 'bob', since: expect.stringMatching(/^\d{4}-\d{2}$/) }))
  })

  it('shows the YYYY-MM field only when range is custom and submits its value', () => {
    const onSubmit = vi.fn()
    render(<AnalyzeForm onSubmit={onSubmit} disabled={false} />)
    expect(screen.queryByPlaceholderText('2025-01')).toBeNull()
    fireEvent.change(screen.getByRole('combobox', { name: /range/i }), { target: { value: 'custom' } })
    fireEvent.change(screen.getByPlaceholderText('2025-01'), { target: { value: '2024-03' } })
    fireEvent.click(screen.getByRole('button', { name: /analyze/i }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ since: '2024-03' }))
  })
})
