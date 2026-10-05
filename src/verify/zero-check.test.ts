import { describe, expect, it } from 'vitest'

import { isAllZero } from './zero-check.js'

describe('RFC 7748 §6.1 all-zero check', () => {
  it('reports 32 zero bytes as the all-zero value', () => {
    expect(isAllZero(new Uint8Array(32))).toBe(true)
  })

  it('does not report a value whose only non-zero byte is the last one', () => {
    const bytes = new Uint8Array(32)
    bytes[31] = 1
    expect(isAllZero(bytes)).toBe(false)
  })

  it('does not report a value whose only non-zero byte is the first one', () => {
    const bytes = new Uint8Array(32)
    bytes[0] = 1
    expect(isAllZero(bytes)).toBe(false)
  })
})
