import { ComponentSettings, MCEvent } from '@managed-components/types'
import {
  buildProductRequest,
  EVENTS,
  PREFIX_PARAMS_MAPPING,
} from './ecommerce'
import { flattenKeys, isNumber } from './utils'

const getRandomInt = () => Math.floor(2147483647 * Math.random())

const getToolRequest = (
  eventType: string,
  event: MCEvent,
  settings: ComponentSettings
) => {
  let payload = {}

  // avoid sending ecommerce flattened products list to GA4
  const { client, payload: fullPayload } = event
  if (eventType === 'ecommerce') {
    const { products, ...restOfPayload } = fullPayload.ecommerce
    payload = restOfPayload
  } else {
    payload = fullPayload
  }
  client.get('counter')
    ? client.set('counter', (parseInt(client.get('counter')) + 1).toString())
    : client.set('counter', '1')
  const requestBody: Record<string, unknown> = {
    v: 2,
    gtm: '2oe5j0', // gtm version hash
    tid: settings.tid,
    dl: client.url.href,
    ul: client.language,
    dt: client.title,
    _p: getRandomInt(),
    _s: client.get('counter'),
    ...(settings.hideOriginalIP && {
      _uip: client.ip,
    }),
    ...(client.referer && { dr: client.referer }),
  }

  // Check if this is a new session
  if (client.get('_ga4s')) {
    requestBody['seg'] = 1 // Session engaged
  } else {
    requestBody['seg'] = 0
    requestBody['_ss'] = 1 // Session start
    client.set('_ga4s', '1', { scope: 'session' })
  }

  if (client.get('_ga4')) {
    requestBody['cid'] = client.get('_ga4').split('.').slice(-2).join('.')
  } else {
    const uid = crypto.randomUUID()

    requestBody['cid'] = uid
    client.set('_ga4', uid, { scope: 'infinite' })
    requestBody['_fv'] = 1 // first visit
  }

  requestBody['sid'] = client.get('_ga4sid')
  if (!requestBody['sid']) {
    requestBody['sid'] = getRandomInt()
    client.set('_ga4sid', (requestBody['sid'] as number).toString(), {
      scope: 'infinite',
    })
  }

  if (parseInt(requestBody['_s'] as string) > 1) {
    const msSinceLastEvent = Date.now() - parseInt(client.get('_let')) // _let = "_lastEventTime"
    requestBody._et = msSinceLastEvent
  }
  client.set('_let', Date.now().toString())

  /* Start of gclid treating */
  if (client.url.searchParams?.get('_gl')) {
    try {
      const _gl = client.url.searchParams?.get('_gl') as string
      const gclaw = atob(_gl.split('*').pop()?.replaceAll('.', '') || '')
      client.set('_gclaw', gclaw, { scope: 'infinite' })
      requestBody.gclid = gclaw.split('.').pop()
    } catch (e) {
      console.log('Google Analytics: Error parsing gclaw', e)
    }
  }
  if (client.get('_gcl_aw')) {
    requestBody.gclid = client.get('_gcl_aw').split('.').pop()
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

  const builtInKeys = ['tid', 'uid', 'en', 'ni', 'conversion']
  const eventData = flattenKeys(payload)

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
  const toolRequest = getToolRequest(eventType, event, settings)

  // toolRequest['ep.debug_mode'] = true

  toolRequest.en = eventType

  // ecommerce events
  if (eventType === 'ecommerce') {
    const ecommerceData = payload.ecommerce
    let prQueryParams

    // event name and currency will always be added as non prefixed query params
    const eventName = event.name || ''
    toolRequest.en = EVENTS[eventName] ? EVENTS[eventName] : eventName
    ecommerceData.currency && (toolRequest.cu = ecommerceData.currency)

    for (const key of Object.keys(PREFIX_PARAMS_MAPPING)) {
      const param = PREFIX_PARAMS_MAPPING[key]
      const prefix = isNumber(ecommerceData[key]) ? 'epn' : 'ep'
      ecommerceData[key] &&
        (toolRequest[`${prefix}.${param}`] = ecommerceData[key])
    }

    if (ecommerceData.products) {
      // handle products list
      for (const [index, product] of (ecommerceData.products || []).entries()) {
        prQueryParams = buildProductRequest(product)
        toolRequest[`pr${index + 1}`] = prQueryParams
      }
    } else {
      // handle single product data
      prQueryParams = buildProductRequest(ecommerceData)
      if (prQueryParams) toolRequest['pr1'] = prQueryParams
    }
  }

  const queryParams = new URLSearchParams(toolRequest).toString()

  const baseURL = 'https://www.google-analytics.com/g/collect?'
  const finalURL = baseURL + queryParams

  return { finalURL, requestBody: toolRequest }
}

export { getToolRequest, getFinalURL }
