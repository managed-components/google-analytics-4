import { ComponentSettings, Manager, MCEvent } from '@managed-components/types'
import { getFinalURL } from './requestBuilder'
import {
  computeEngagementDuration,
  countConversion,
  countPageview,
  sendUserEngagementEvent,
} from './utils'

const sendGaAudiences = (
  event: MCEvent,
  settings: ComponentSettings,
  requestBody: Record<string, unknown>
) => {
  const { client } = event

  const baseDoubleClick = 'https://stats.g.doubleclick.net/g/collect?'
  const cid = requestBody['cid']
  if (!cid || typeof cid != 'string') {
    throw new Error('cid in requestBody should be a string')
  }
  const doubleClick: Record<string, string> = {
    t: 'dc',
    aip: '1',
    _r: '3',
    v: '1',
    _v: 'j86',
    tid: settings.tid,
    cid,
    _u: 'KGDAAEADQAAAAC~',
    z: (+Math.floor(2147483647 * Math.random())).toString(),
  }
  const doubleClickParams = new URLSearchParams(doubleClick).toString()
  const finalDoubleClickURL = baseDoubleClick + doubleClickParams

  if (
    (settings['ga-audiences'] || event.payload['ga-audiences']) &&
    (!client.get('_z_ga_audiences') ||
      client.get('_z_ga_audiences') !== requestBody['cid'])
  ) {
    // Build the GAv4 Audiences request
    const audiences = {
      ...doubleClick,
      t: 'sr',
      _r: '4',
      slf_rd: '1',
    }
    const audienceParams = new URLSearchParams(audiences).toString()
    const baseAudienceURL = 'https://www.google.com/ads/ga-audiences?'
    const finalAudienceURL = baseAudienceURL + audienceParams
    let clientJSAudience = ''
    // Call GAv4-Audiences on Google.com
    client.fetch(finalAudienceURL)
    client.set('_z_ga_audiences', cid, {
      scope: 'infinite',
    })
    // Trigger the DoubleClick with XHR because we need the response text - it holds the local Google domain
    clientJSAudience += `x=new XMLHttpRequest,x.withCredentials=!0,x.open("POST","${finalDoubleClickURL}",!0),x.onreadystatechange=function(){`
    clientJSAudience += `if (4 == x.readyState) {`
    clientJSAudience += `const domain = x.responseText.trim();`
    clientJSAudience += `if (domain.startsWith("1g") && domain.length > 2) {`
    // Trigger the request to the local Google domain too
    clientJSAudience += `fetch("${finalAudienceURL}".replace("www.google.com", "www.google."+domain.slice(2)));`
    clientJSAudience += `}}`
    clientJSAudience += `},x.send();`
    client.execute(clientJSAudience)
  } else {
    // If no GAv4-Audiences, just trigger DoubleClick normally
    client.fetch(finalDoubleClickURL)
  }
}
export const sendEvent = async (
  eventType: string,
  event: MCEvent,
  settings: ComponentSettings,
  manager: Manager
) => {
  const { client } = event
  const { finalURL, requestBody } = getFinalURL(eventType, event, settings)

  manager.fetch(finalURL, {
    headers: { 'User-Agent': client.userAgent },
  })

  if (settings['ga-audiences'] || event.payload['ga-audiences']) {
    sendGaAudiences(event, settings, requestBody)
  }
}

const onVisibilityChange =
  (settings: ComponentSettings, manager: Manager) => (event: MCEvent) => {
    const { client, payload } = event
    if (payload.visibilityChange[0].state == 'visible') {
      client.set('engagementStart', payload.visibilityChange[0].timestamp)
    } else if (payload.visibilityChange[0].state == 'hidden') {
      // when visibilityChange status changes to hidden, fire `user_engagement` event
      sendUserEngagementEvent(event, settings, manager)
    }
  }

export default async function (manager: Manager, settings: ComponentSettings) {
  manager.createEventListener(
    'visibilityChange',
    onVisibilityChange(settings, manager)
  )

  manager.addEventListener('pageview', event => {
    event.client.attachEvent('visibilityChange')

    // if engagement duration is >1 send a user_engagement event before pageview, to count the time on previous page properly
    const engagementDuration =
      parseInt(String(event.client.get('engagementDuration')), 10) || 0
    if (engagementDuration >= 1) {
      sendUserEngagementEvent(event, settings, manager)
    }
    // engagement start gets reset on every new pageview or event
    const now = new Date(Date.now()).getTime()
    event.client.set('engagementStart', `${now}`)
    // Reset engagementDuration after pageview has been dispatched so it restarts the count
    event.client.set('engagementDuration', '0')
    // count pageviews for 'seg' value
    countPageview(event.client)

    sendEvent('page_view', event, settings, manager)
  })

  manager.addEventListener('event', event => {
    // count conversion events for 'seg' value
    countConversion(event)
    // order matters so engagement duration is set before dispatching the hit
    computeEngagementDuration(event, settings)

    sendEvent('event', event, settings, manager)
  })

  manager.addEventListener('ecommerce', async event => {
    event.payload.conversion = true // set ecommerce events as conversion events
    // count conversion events for 'seg' value
    countConversion(event)
    // order matters so engagement duration is set before dispatching the hit
    computeEngagementDuration(event, settings)

    sendEvent('ecommerce', event, settings, manager)
  })
}
