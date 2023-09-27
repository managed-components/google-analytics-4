export const flattenKeys = (obj: { [k: string]: any } = {}, prefix = '') =>
  Object.keys(obj).reduce((acc: { [k: string]: any }, k) => {
    const pre = prefix.length ? `${prefix}.` : ''
    if (
      typeof obj[k] === 'object' &&
      !Array.isArray(obj[k]) &&
      obj[k] !== null &&
      Object.keys(obj[k]).length > 0
    ) {
      Object.assign(acc, flattenKeys(obj[k], pre + k))
    } else if (Array.isArray(obj[k]) && obj[k] !== null) {
      obj[k].forEach((v: any, i: number) => {
        if (typeof v === 'object' && v !== null) {
          Object.assign(acc, flattenKeys(v, pre + k + '.' + i))
        } else {
          acc[pre + k + '.' + i] = v
        }
      })
    } else {
      acc[pre + k] = obj[k]
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
  paramValuesToUse.forEach(param => {
    if (param) return { [paramKey]: param }
  })
  return {}
}
