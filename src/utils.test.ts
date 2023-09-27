import { getParamSafely } from './utils'

describe('getParamSafely works', () => {
  const relatedValue = 'abcd'
  const relatedObject: Record<string, string> = {
    href: 'https://example.com',
  }
  // Test 1
  it('With two params, first param missing, return 2nd param', () => {
    const result = getParamSafely('someKey', [
      relatedObject?.nonExistantKey,
      relatedValue,
    ])
    expect({ ...result }).not.toEqual({})
    expect({ ...result }).toEqual({ someKey: 'abcd' })
  })

  //   // Test 2
  it('With two params, first param hit', () => {
    const result = getParamSafely('someKey', [
      relatedObject?.href,
      relatedValue,
    ])
    expect({ ...result }).not.toEqual({})
    expect({ ...result }).toEqual({ someKey: 'https://example.com' })
  })

  // Test 3
  it('With two params, both param missing', () => {
    const result = getParamSafely('someKey', [
      relatedObject?.something,
      relatedObject.xyz,
    ])
    expect({ ...result }).toEqual({})
  })
})
