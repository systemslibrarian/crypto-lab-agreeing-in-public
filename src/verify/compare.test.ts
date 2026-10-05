import { describe, expect, it } from 'vitest'

import { firstDifference, sameBytes } from './compare.js'

describe('sameBytes', () => {
  it('agrees on identical bytes', () => {
    expect(sameBytes(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true)
  })

  it('refuses a difference in the last byte', () => {
    expect(sameBytes(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false)
  })

  it('refuses a difference in the first byte', () => {
    expect(sameBytes(new Uint8Array([9, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(false)
  })

  it('refuses a prefix of itself rather than comparing only the overlap', () => {
    expect(sameBytes(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3]))).toBe(false)
  })

  it('reports two empty values as the same', () => {
    expect(sameBytes(new Uint8Array(), new Uint8Array())).toBe(true)
  })
})

describe('firstDifference', () => {
  it('returns -1 when the values are identical', () => {
    expect(firstDifference(new Uint8Array([7, 7]), new Uint8Array([7, 7]))).toBe(-1)
  })

  it('names the index rather than the fact', () => {
    expect(firstDifference(new Uint8Array([7, 7, 7]), new Uint8Array([7, 8, 7]))).toBe(1)
  })

  it('treats a length difference as a difference at the shorter length', () => {
    expect(firstDifference(new Uint8Array([7]), new Uint8Array([7, 7]))).toBe(1)
  })
})
