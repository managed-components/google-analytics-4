export const flattenKeys = (obj: { [k: string]: unknown } = {}, prefix = '') =>
  Object.keys(obj).reduce((acc: { [k: string]: unknown }, k) => {
    const pre = prefix.length ? `${prefix}.` : ''
    const value = obj[k]
    if (
      typeof value === 'object' &&
      !Array.isArray(obj[k]) &&
      value !== null &&
      Object.keys(value).length > 0
    ) {
      Object.assign(acc, flattenKeys(value as Record<string, string>, pre + k))
    } else if (Array.isArray(value) && value !== null) {
      value.forEach((v: unknown, i: number) => {
        if (typeof v === 'object' && v !== null) {
          Object.assign(
            acc,
            flattenKeys(v as Record<string, string>, pre + k + '.' + i)
          )
        } else {
          acc[pre + k + '.' + i] = v
        }
      })
    } else {
      acc[pre + k] = value
    }
    return acc
  }, {})

/**
 * @param paramKey - The key that needs to be merged into original object
 * @param paramValuesToUse - fallback values that `getParamSafely` will try and retrieve
 * @returns object - The return value of getParamSafely must be spread to merge into another object
 * @todo add test
 */
export const getParamSafely = (
  paramKey: string,
  paramValuesToUse: Array<string>
) => {
  for (const param of paramValuesToUse) {
    if (param) {
      return { [paramKey]: param }
    }
  }
  return {}
}
