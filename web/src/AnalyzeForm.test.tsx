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
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ user: 'bob', result: 'all' }))
  })

  it('Quick scan submits depth 8 and last 50', () => {
    const onSubmit = vi.fn()
    render(<AnalyzeForm onSubmit={onSubmit} disabled={false} />)
    fireEvent.click(screen.getByRole('button', { name: /quick scan/i }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ depth: '8', last: '50' }))
  })
})
