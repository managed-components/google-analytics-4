import { Client, ComponentSettings, MCEvent } from '@managed-components/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sendGaAudiences } from './index'

const settings = {
  tid: 'G-TEST',
  'ga-audiences': true,
} as ComponentSettings

const makeEvent = () => {
  const client = {
    fetch: vi.fn(),
    execute: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
  } as unknown as Client

  return {
    event: { client, payload: {}, type: 'pageview' } as MCEvent,
    client,
  }
}

describe('Google Analytics audiences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends audience requests with credentials and consent signals', () => {
    const { event, client } = makeEvent()
    const gcd = '11r1r1r1r5'

    sendGaAudiences(event, settings, { cid: 'client-id', gcd })

    expect(client.fetch).toHaveBeenCalledOnce()
    expect(client.fetch).toHaveBeenCalledWith(
      expect.stringContaining(`gcd=${gcd}`),
      { credentials: 'include' }
    )
    expect(client.execute).toHaveBeenCalledWith(
      expect.stringContaining('credentials:"include"')
    )
    expect(client.set).toHaveBeenCalledWith('_z_ga_audiences', 'client-id', {
      expiry: 86400000,
    })
  })

  it('does not send or mark audiences while advertising consent is denied', () => {
    const { event, client } = makeEvent()

    sendGaAudiences(event, settings, {
      cid: 'client-id',
      gcd: '11p1p1p1p5',
    })

    expect(client.fetch).not.toHaveBeenCalled()
    expect(client.execute).not.toHaveBeenCalled()
    expect(client.set).not.toHaveBeenCalled()
  })

  it.each(['11p1r1r1r5', '11r1r1p1r5', '11r1r1r1p5'])(
    'does not send audiences when an advertising consent signal is denied',
    gcd => {
      const { event, client } = makeEvent()

      sendGaAudiences(event, settings, { cid: 'client-id', gcd })

      expect(client.fetch).not.toHaveBeenCalled()
      expect(client.set).not.toHaveBeenCalled()
    }
  )

  it('allows audience collection when only analytics storage is denied', () => {
    const { event, client } = makeEvent()

    sendGaAudiences(event, settings, {
      cid: 'client-id',
      gcd: '11r1p1r1r5',
    })

    expect(client.fetch).toHaveBeenCalledOnce()
  })

  it('retries audience collection after consent changes to granted', () => {
    const { event, client } = makeEvent()

    sendGaAudiences(event, settings, {
      cid: 'client-id',
      gcd: '11p1p1p1p5',
    })
    sendGaAudiences(event, settings, {
      cid: 'client-id',
      gcd: '11r1r1r1r5',
    })

    expect(client.fetch).toHaveBeenCalledOnce()
    expect(client.set).toHaveBeenCalledOnce()
  })

  it('keeps audience collection enabled when consent mode is not configured', () => {
    const { event, client } = makeEvent()

    sendGaAudiences(event, settings, { cid: 'client-id' })

    expect(client.fetch).toHaveBeenCalledOnce()
    expect(client.set).toHaveBeenCalledOnce()
  })

  it.each([{ gcd: 'invalid' }, { gcs: 'invalid' }])(
    'fails closed for malformed consent signals',
    requestBody => {
      const { event, client } = makeEvent()

      sendGaAudiences(event, settings, { cid: 'client-id', ...requestBody })

      expect(client.fetch).not.toHaveBeenCalled()
      expect(client.set).not.toHaveBeenCalled()
    }
  )

  it.each([{ gcd: null }, { gcs: 1 }])(
    'fails closed for non-string consent signals',
    requestBody => {
      const { event, client } = makeEvent()

      sendGaAudiences(event, settings, { cid: 'client-id', ...requestBody })

      expect(client.fetch).not.toHaveBeenCalled()
      expect(client.set).not.toHaveBeenCalled()
    }
  )

  it.each([
    { gcs: 'G111', sent: true },
    { gcs: 'G101', sent: false },
  ])('respects legacy ad storage consent', ({ gcs, sent }) => {
    const { event, client } = makeEvent()

    sendGaAudiences(event, settings, { cid: 'client-id', gcs })

    expect(client.fetch).toHaveBeenCalledTimes(sent ? 1 : 0)
  })
})
