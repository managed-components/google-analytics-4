import { Client, MCEvent } from '@managed-components/types'
import { SESSION_DURATION_IN_MIN } from '.'

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
// pageviews in session counter
export const countPageview = (client: Client) => {
  let pageviewCounter = parseInt(client.get('pageviewCounter') || '0') || 0

  if (pageviewCounter === 0) {
    client.set('pageviewCounter', '1', { scope: 'session' })
  } else {
    pageviewCounter++
    client.set('pageviewCounter', `${pageviewCounter}`, { scope: 'session' })
  }
}

// conversion events in session counter
export const countConversion = (event: MCEvent) => {
  const { client } = event
  let conversionCounter = parseInt(client.get('conversionCounter') || '0') || 0
  if (conversionCounter === 0 && event.payload.conversion) {
    client.set('conversionCounter', '1', { scope: 'session' })
  } else {
    conversionCounter++
    client.set('conversionCounter', `${conversionCounter}`, {
      scope: 'session',
    })
  }
}

export const computeEngagementDuration = (event: MCEvent) => {
  const now = new Date(Date.now()).getTime()

  let engagementDuration =
    parseInt(event.client.get('engagementDuration') || '0') || 0
  let engagementStart =
    parseInt(event.client.get('engagementStart') || '0') || now
  const delaySinceLast = (now - engagementStart) / 1000 / 60

  // Last interaction occured in a previous session, reset engagementStart
  if (delaySinceLast > SESSION_DURATION_IN_MIN) {
    engagementStart = now
  }

  engagementDuration += now - engagementStart

  event.client.set('engagementDuration', `${engagementDuration}`)

  // engagement start gets reset on every new pageview or event
  event.client.set('engagementStart', `${now}`)
}

