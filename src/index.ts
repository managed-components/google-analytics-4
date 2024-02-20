import { ComponentSettings, Manager, MCEvent } from '@managed-components/types'
import { getFinalURL } from './requestBuilder'

const SESSION_DURATION_IN_MIN = 30

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

export default async function (manager: Manager, settings: ComponentSettings) {
  const sendEvent = async (
    eventType: string,
    event: MCEvent,
    settings: ComponentSettings
  ) => {
    const { client } = event
    const { finalURL, requestBody } = getFinalURL(eventType, event, settings)

    manager.fetch(finalURL, {
      headers: { 'User-Agent': client.userAgent },
    })

    if (settings['ga-audiences'] || event.payload['ga-audiences']) {
      sendGaAudiences(event, settings, requestBody)
    }

    client.set('let', Date.now().toString()) // reset the last event time
  }

  const onVisibilityChange =
    (settings: ComponentSettings) => (event: MCEvent) => {
      const { client, payload } = event

      if (payload.visibilityChange[0].state == 'visible') {
        event.client.set(
          'engagementStart',
          payload.visibilityChange[0].timestamp
        )
      } else if (payload.visibilityChange[0].state == 'hidden') {
        // on pageblur
        computeEngagementDuration(event)

        const msSinceLastEvent = Date.now() - parseInt(client.get('let') || '0') // _let = "_lastEventTime"
        if (msSinceLastEvent > 10000) {
          // order matters so engagement duration is set before dispatching the hit
          computeEngagementDuration(event)

          sendEvent('user_engagement', event, settings)

          // Reset engagementDuration after event has been dispatched so it does not accumulate
          event.client.set('engagementDuration', '0')
        }
      }
    }

  const computeEngagementDuration = (event: MCEvent) => {
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

  manager.createEventListener('visibilityChange', onVisibilityChange(settings))

  manager.addEventListener('event', event => {
    // order matters so engagement duration is set before dispatching the hit
    computeEngagementDuration(event)

    sendEvent('event', event, settings)

    // Reset engagementDuration after event has been dispatched so it does not accumulate
    event.client.set('engagementDuration', '0')
  })

  manager.addEventListener('pageview', event => {
    event.client.attachEvent('visibilityChange')

    // order matters so engagement duration is set before dispatching the hit
    computeEngagementDuration(event)

    sendEvent('page_view', event, settings)

    // Reset engagementDuration after event has been dispatched so it does not accumulate
    event.client.set('engagementDuration', '0')
  })

  manager.addEventListener('ecommerce', async event => {
    // order matters so engagement duration is set before dispatching the hit
    computeEngagementDuration(event)

    sendEvent('ecommerce', event, settings)

    // Reset engagementDuration after event has been dispatched so it does not accumulate
    event.client.set('engagementDuration', '0')
  })
}
