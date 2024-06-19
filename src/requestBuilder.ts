import { Client, ComponentSettings, MCEvent } from '@managed-components/types'
import {
  buildProductRequest,
  EVENTS,
  mapProductToItem,
  PREFIX_PARAMS_MAPPING,
} from './ecommerce'
import { flattenKeys, getParamSafely } from './utils'

const getRandomInt = () => Math.floor(2147483647 * Math.random())

const firstPageEvent = (client: Client) => {
  const countedEvent = client.get('countedEvent')
  if (countedEvent) {
    return false
  } else {
    return true
  }
}
function getToolRequest(
  eventType: string,
  event: MCEvent,
  settings: ComponentSettings
): Record<string, unknown> {
  let payload: MCEvent['payload'] = {}

  // avoid sending ecommerce flattened products list to GA4
  const { client, payload: fullPayload } = event
  if (eventType === 'ecommerce') {
    const restOfPayload: Record<string, unknown> = {}
    for (const key of Object.keys(fullPayload.ecommerce)) {
      if (
        key !== 'products' &&
        key !== 'currency' &&
        !PREFIX_PARAMS_MAPPING[key]
      ) {
        restOfPayload[key] = fullPayload.ecommerce[key]
      }
    }
    payload = restOfPayload
  } else {
    payload = fullPayload
  }

  let eventsCounter = parseInt(client.get('counter') || '')
  if (!Number.isInteger(eventsCounter)) eventsCounter = 0
  eventsCounter++
  client.set('counter', eventsCounter.toString())

  const requestBody: Record<string, unknown> = {
    v: 2,
    // gtm: '2oe5j0', // TODO: GTM version hash? not clear if we need this
    tid: settings.tid,
    sr: client.screenWidth + 'x' + client.screenHeight,
    ul: client.language,
    dt: client.title,
    _s: eventsCounter,
    ...(!(payload.hideOriginalIP || settings.hideOriginalIP) && {
      _uip: client.ip,
    }),
    ...getParamSafely('dr', [payload.dr, client.referer]),
    ...getParamSafely('dl', [payload.dl, client.url.href]),
    ...(payload.ir && { ir: true }),
    ...(payload.dbg && { dbg: true }),
  }

  // Session counting
  let sessionCounter = parseInt(client.get('session_counter') || '')
  if (!Number.isInteger(sessionCounter)) {
    sessionCounter = 0
  }
  if (client) {
    // Determine if the session is engaged to set the 'seg' value
    const pageviewCounter = parseInt(client.get('pageviewCounter') || '0')
    const conversionCounter = parseInt(client.get('conversionCounter') || '0')
    const engagementDuration = parseInt(client.get('engagementDuration') || '0')

    // Session will be marked engaged if longer than 10 seconds, has at least 1 conversion event, and 2 or more pageviews
    if (
      engagementDuration >= 10 &&
      conversionCounter > 0 &&
      pageviewCounter > 1
    ) {
      requestBody['seg'] = 1 // Session engaged
    } else {
      requestBody['seg'] = 0
    }
  }

  // Create, refresh or renew session id
  const sessionLength = 30 * 60 * 1000 // By default, GA4 keeps sessions for 30 minutes
  let currentSessionID = client.get('ga4sid')
  if (!currentSessionID) {
    requestBody['_ss'] = 1 // Session start
    sessionCounter++
    currentSessionID = getRandomInt().toString()
  }
  client.set('ga4sid', currentSessionID, { expiry: sessionLength })
  requestBody['sid'] = currentSessionID
  requestBody['_p'] = currentSessionID

  client.set('session_counter', sessionCounter.toString(), {
    scope: 'infinite',
  })
  requestBody['sct'] = sessionCounter

  // Handle Client ID
  let cid = client.get('ga4')?.split('.').slice(-2).join('.')
  if (!cid) {
    cid = crypto.randomUUID()
    requestBody['_fv'] = 1 // No Client ID -> setting "First Visit"
  }
  client.set('ga4', cid, { scope: 'infinite' })
  requestBody['cid'] = cid

  //const notTheFirstSession = parseInt(requestBody['_s'] as string) > 1
  const engagementDuration =
    parseInt(String(client.get('engagementDuration')), 10) || 0

  // include _et parameter for engagement time metrics
  if (
    (eventType === 'event' || eventType === 'ecommerce') &&
    firstPageEvent(client)
  ) {
    requestBody._et = engagementDuration

    // mark first event to avoid sending _et with upcoming events on that page
    event.client.set('countedEvent', '1', { scope: 'page' })
    // Reset engagementDuration and engagementStart after event has been dispatched so it does not accumulate
    event.client.set('engagementDuration', '0')
    const now = Date.now()
    event.client.set('engagementStart', `${now}`)
  } else if (eventType === 'user_engagement') {
    requestBody._et = engagementDuration
    // Reset engagementDuration after event has been dispatched so it does not accumulate
    event.client.set('engagementDuration', '0')
  }

  /* Start of gclid treating */
  if (client.url.searchParams?.get('gl')) {
    try {
      const _gl = client.url.searchParams?.get('gl') as string
      const gclaw = atob(_gl.split('*').pop()?.replaceAll('.', '') || '')
      client.set('gclaw', gclaw, { scope: 'infinite' })
      requestBody.gclid = gclaw.split('.').pop()
    } catch (e) {
      console.log('Google Analytics: Error parsing gclaw', e)
    }
  }
  if (client.get('gcl_aw')) {
    requestBody.gclid = client.get('gcl_aw')?.split('.').pop()
  }
  if (client.get('gclid')) {
    requestBody.gclid = client.get('gclid')
  }
  /* End of gclid treating */

  if (requestBody.gclid) {
    const url = new URL(requestBody.dl as string)
    url.searchParams.get('gclid') ||
      url.searchParams.append('gclid', requestBody.gclid as string)
    requestBody.dl = url
  }

  Object.entries({
    utma: '_utma',
    utmz: '_utmz',
    dpd: '_dpd',
    utm_wtk: 'utm_wtk',
  }).forEach(([searchParam, cookieName]) => {
    if (client.url.searchParams.get(searchParam)) {
      client.set(cookieName, client.url.searchParams.get(searchParam), {
        scope: 'infinite',
      })
    }
  })

  // Don't append ep/epn to these keys
  const builtInKeys = [
    'tid',
    'uid',
    'en',
    'ni',
    'conversion',
    'dr',
    'dl',
    'ir',
    'dbg',
    'gcs',
    'gcd',
  ]
  const eventData = flattenKeys(payload)

  // Remove setting keys from the payload that is sent to GA4
  delete eventData['hideOriginalIP']
  delete eventData['ga-audiences']
  // `up.X`s are User Properties and should stay with this prefix
  // Otherwise, it's an Event Property. If numerical - prefixed with `epn.`,
  // and if a string, it's just `ep.`
  for (const key in eventData) {
    if (!builtInKeys.includes(key) && !key.startsWith('up.')) {
      if (Number(eventData[key])) eventData['epn.' + key] = eventData[key]
      else eventData['ep.' + key] = eventData[key]
      delete eventData[key]
    }
  }

  if (eventData.conversion) {
    eventData._c = 1
  }
  delete eventData.conversion

  const toolRequest = { ...requestBody, ...eventData }
  return toolRequest
}

const getFinalURL = (
  eventType: string,
  event: MCEvent,
  settings: ComponentSettings
) => {
  const { payload } = event
  let toolRequest: Record<string, string> = {}
  // toolRequest['ep.debug_mode'] = true

  toolRequest.en = payload.en || eventType

  // ecommerce events
  if (eventType === 'ecommerce') {
    const ecommerceData = payload.ecommerce
    let prQueryParams

    // event name and currency will always be added as non prefixed query params
    const eventName = event.name || ''
    toolRequest.en = EVENTS[eventName] || eventName
    ecommerceData.currency && (toolRequest.cu = ecommerceData.currency)

    for (const key of Object.keys(PREFIX_PARAMS_MAPPING)) {
      const param = PREFIX_PARAMS_MAPPING[key]
      const prefix = Number(ecommerceData[key]) ? 'epn' : 'ep'
      ecommerceData[key] &&
        (toolRequest[`${prefix}.${param}`] = ecommerceData[key])
    }

    if (ecommerceData.products) {
      // handle products list
      for (const [index, product] of (ecommerceData.products || []).entries()) {
        const item = mapProductToItem(product)
        prQueryParams = buildProductRequest(item)
        toolRequest[`pr${index + 1}`] = prQueryParams
      }
    } else {
      // handle single product data
      const item = mapProductToItem(ecommerceData)
      prQueryParams = buildProductRequest(item)
      if (prQueryParams) toolRequest['pr1'] = prQueryParams
    }
  }

  const partialToolRequest = getToolRequest(eventType, event, settings)

  toolRequest = {
    ...toolRequest,
    ...(partialToolRequest as unknown as Record<string, string>),
  }

  // Presence of `debug_mode` key will still enable debug mode.
  // Removing the key allows conditionally disabling debug_mode.
  if (
    !toolRequest['ep.debug_mode'] ||
    toolRequest['ep.debug_mode'] === 'false'
  ) {
    delete toolRequest['ep.debug_mode']
  }

  const queryParams = new URLSearchParams(toolRequest).toString()

  const baseURL = 'https://www.google-analytics.com/g/collect?'
  const finalURL = baseURL + queryParams

  return { finalURL, requestBody: toolRequest }
}

export { getToolRequest, getFinalURL }
