import { ComponentSettings, Manager } from '@managed-components/types'

export default async function (manager: Manager, settings: ComponentSettings) {
  manager.addEventListener('pageview', event => {
    // do the things
  })
}
