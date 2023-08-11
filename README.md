# Google Analytics 4 Managed Component

Find out more about Managed Components [here](https://blog.cloudflare.com/zaraz-open-source-managed-components-and-webcm/) for inspiration and motivation details.

<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->

[![All Contributors](https://img.shields.io/badge/all_contributors-3-orange.svg?style=flat-square)](#contributors-)

<!-- ALL-CONTRIBUTORS-BADGE:END -->

[![Released under the Apache license.](https://img.shields.io/badge/license-apache-blue.svg)](./LICENSE)
[![PRs welcome!](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)

## 🚀 Quickstart local dev environment

1. Make sure you're running node version >=18.
2. Install dependencies with `npm i`
3. Run unit test watcher with `npm run test:dev`

## Supported Event Types

`pageview`, `ecommerce`, `event`

## ⚙️ Tool Settings

> Settings are used to configure the tool in a Component Manager config file

### Measurement ID `string` _required_

`tid` is the unique identifier of your Google Analytics 4 account. [Learn more](https://www.semrush.com/blog/google-analytics-tracking-id/#how-to-find-google-analytics-tracking-id)

### Hide Originating IP Address `boolean`

`hideOriginalIP` will prevent sending the visitor IP address to Google Analytics 4

### E-commerce tracking `boolean`

`ecommerce` Enable forwarding E-commerce events to Google Analytics as part of the enhanced e-commerce tracking feature. [Learn more](https://developers.google.com/analytics/devguides/collection/analyticsjs/enhanced-ecommerce#ecommerce-tracking)

### Google Analytics Audiences `boolean`

`ga-audiences` enables/disables Audiences collection through Google Analytics

### Cookie Base Domain `string` _required_

`baseDomain` manually set the domain for all Google Analytics cookies

## 🧱 Fields Description

> Fields are properties that can/must be sent with certain events

### User ID/Visitor ID `string`

`uid` lets you associate your own identifiers with individual users so you can connect their behavior across different sessions and on various devices and platforms. [Learn more](https://developers.google.com/analytics/devguides/collection/ga4/user-id?technology=gtagjs)

### Event Name `string`

`en` will be sent as Event Name to Google Analytics. [Learn more](https://support.google.com/analytics/answer/1033068?hl=en)

### Non-interaction `boolean`

`ni` events are not taken into account when Google Analytics calculates bounces and session duration. [Learn more](https://support.google.com/analytics/answer/1033068?hl=en#NonInteractionEvents)

### Custom Fields

Custom fields can be used to send properties to Google Analytics. To specify user properties, please add the `up.` prefix to your property's name.

## 📝 License

Licensed under the [Apache License](./LICENSE).

## 💜 Thanks

Thanks to everyone contributing in any manner for this repo and to everyone working on Open Source in general.

## Contributors ✨

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tr>
    <td align="center"><a href="https://github.com/simonabadoiu"><img src="https://avatars.githubusercontent.com/u/1610123?v=4?s=75" width="75px;" alt=""/><br /><sub><b>Simona Badoiu</b></sub></a><br /><a href="https://github.com/managed-components/@managed-components/google-analytics-4/commits?author=simonabadoiu" title="Code">💻</a></td>
    <td align="center"><a href="https://yoavmoshe.com/about"><img src="https://avatars.githubusercontent.com/u/55081?v=4?s=75" width="75px;" alt=""/><br /><sub><b>Yo'av Moshe</b></sub></a><br /><a href="https://github.com/managed-components/@managed-components/google-analytics-4/commits?author=bjesus" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/jonnyparris"><img src="https://avatars.githubusercontent.com/u/6400000?v=4?s=75" width="75px;" alt=""/><br /><sub><b>Ruskin</b></sub></a><br /><a href="https://github.com/managed-components/@managed-components/google-analytics-4/commits?author=jonnyparris" title="Code">💻</a></td>
  </tr>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!
