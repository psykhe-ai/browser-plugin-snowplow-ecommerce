# @psykhe-ai/browser-plugin-snowplow-ecommerce

Snowplow plugin for tracking ecommerce events on storefronts that use PSYKHE AI recommendations.

## Prerequisites

- **Snowplow JavaScript Tracker 4.5.0** with **session context enabled**.

## Features

- Tracks product views, clicks, cart changes, checkout steps, dwell, and transactions
- Attaches PSYKHE AI recommendation context to Snowplow ecommerce events
- Compatible with [@snowplow/browser-tracker](https://www.npmjs.com/package/@snowplow/browser-tracker)

## Installation

```bash
pnpm add @psykhe-ai/browser-plugin-snowplow-ecommerce
```

## Usage

<details>
<summary>Tracker initialization</summary>

```ts
import { newTracker } from '@snowplow/browser-tracker';
import { PsykheSnowplowEcommercePlugin } from '@psykhe-ai/browser-plugin-snowplow-ecommerce';

const PSYKHE_BASE_URL = 'https://api.psykhe.dev';
const POST_PATH = '/v1/collector';

// Client identifier, e.g. 'store-name.com'
const clientIdentifier = 'store-name.com';

newTracker('psykhe-ai', PSYKHE_BASE_URL, {
  appId: clientIdentifier,
  appVersion: '1.0.0',
  postPath: POST_PATH,
  cookieName: '_psykhe_',
  cookieDomain: document.location.hostname,
  stateStorageStrategy: 'cookieAndLocalStorage',
  cookieSecure: true,
  cookieSameSite: 'Lax',
  keepalive: true,
  credentials: 'include',
  bufferSize: 1,
  contexts: {
    session: true,
    webPage: true,
    browser: true,
  },
  plugins: [PsykheSnowplowEcommercePlugin()],
});
```

</details>

### Seed Snowplow `domain_userid` (optional)

Seeding `domain_userid` is optional and uncommon. Most integrations should omit it and let Snowplow generate and manage
`domain_userid`. Use this helper only when Snowplow must reuse an identifier that already exists in the storefront.

<details>
<summary>Reuse an existing <code>domain_userid</code></summary>

Snowplow's browser tracker does not expose a public initialization option for `domain_userid`. To reuse an existing
identifier, call `seedSnowplowDomainUserId()` immediately before `newTracker()`, using the same storage options for both
calls.

```ts
import { newTracker } from '@snowplow/browser-tracker';
import {
  PsykheSnowplowEcommercePlugin,
  seedSnowplowDomainUserId,
} from '@psykhe-ai/browser-plugin-snowplow-ecommerce';

const PSYKHE_BASE_URL = 'https://api.psykhe.dev';

// Use the same storage options for the seed call and `newTracker()` so the
// seeded state is the one Snowplow reads back.
const cookieName = '_psykhe_';
const cookieDomain = document.location.hostname;
const stateStorageStrategy = 'cookieAndLocalStorage';

const { seeded } = seedSnowplowDomainUserId('06be9692-4f70-4887-be27-15e98fdfc7c8', {
  cookieName,
  cookieDomain,
  stateStorageStrategy,
});

newTracker('psykhe-ai', PSYKHE_BASE_URL, {
  // Same config as the tracker initialization example above.
  cookieName,
  cookieDomain,
  stateStorageStrategy,
  plugins: [PsykheSnowplowEcommercePlugin()],
});
```

Pass the same storage-related options to `seedSnowplowDomainUserId()` that you pass to `newTracker()`, especially
`cookieName`, `cookieDomain`, `cookieSecure`, `cookieLifetime`, `sessionCookieTimeout`, and `stateStorageStrategy`. By
default, the helper does not replace an existing Snowplow visitor state value. Pass `overwriteExisting: true` only when
you intentionally want to replace it.

**Re-seeding is a no-op by default.** Once a `domain_userid` exists for these storage options, whether you seeded it on
an earlier load or Snowplow already created one, a later call with a _different_ identifier leaves the existing
identifier in use and returns `{ seeded: false }`. This makes `seedSnowplowDomainUserId()` safe to run on every page
load. Pass `overwriteExisting: true` only when the new identifier should replace the existing value.

This helper mirrors Snowplow Browser Tracker 4.5.0's first-party state format because Snowplow does not export the
parser/serializer used during initialization. Re-check the Snowplow source links in `src/domain-user-id.ts` before
upgrading Snowplow.

The identifier must not contain dots, whitespace, or semicolons because Snowplow stores it inside a dot-delimited
first-party state value.

The call returns a `{ seeded }` flag. Use it to detect when nothing was written, for example with the default
`cookieSecure: true` over plain `http` (the browser rejects the secure cookie), or when an existing value was left in
place without `overwriteExisting: true`.

</details>

### PSYKHE AI recommendation context

When a product listing or search result comes from PSYKHE AI, pass the `recommendationId` with the
`withRecommendIdCtx` context helper. This links interaction events to the recommendation or search result that produced
them.

### Helper functions

The plugin exports a helper function for each event listed in
the [Event Categories](https://docs.psykhe.dev/api/tracking-api/getting-started). Each helper builds the Snowplow
self-describing event and attaches PSYKHE AI contexts.

| Helper                    | Event captured                      |
| ------------------------- | ----------------------------------- |
| `trackProductView()`      | Product Page View (mandatory)       |
| `trackProductListView()`  | Product List Impression (mandatory) |
| `trackAddToCart()`        | Add to Cart (mandatory)             |
| `trackTransaction()`      | Complete Transaction (mandatory)    |
| `trackProductDwellTime()` | PDP/PLP dwell time (recommended)    |

Filter dwell and hover durations as described in Getting Started > Quality Filters.

### Track events

#### Set user identity

You can call `setEcommerceUser()` once when the tracker is initialized, and again when the user logs in or logs out, to
keep event identity current.

```ts
import { setEcommerceUser } from '@psykhe-ai/browser-plugin-snowplow-ecommerce';

setEcommerceUser({
  id: 'user-identifier',
  is_guest: false,
});
```

<details>
<summary>Product view (PDP)</summary>

```ts
import { trackProductView } from '@psykhe-ai/browser-plugin-snowplow-ecommerce';

trackProductView({
  product_id: 'sku-123',
  variant_id: 'sku-123-white',
  name: 'Linen Shirt',
  price: 100,
  currency: 'usd',
});
```

</details>

<details>
<summary>Product dwell time</summary>

> Filter out events shorter than 300 ms (for example, a user scrolling past without viewing) or longer than 5 minutes
> (for example, a user leaving the tab open).

```ts
import { trackProductDwellTime, PageType } from '@psykhe-ai/browser-plugin-snowplow-ecommerce';

trackProductDwellTime({
  product: {
    product_id: 'sku-124',
    variant_id: 'sku-124-blue',
    name: 'Cotton Dress',
    price: 100,
    currency: 'usd',
  },
  duration: 500,
  pageType: PageType.PDP,
});
```

</details>

<details>
<summary>Product list view (PLP)</summary>

```ts
import {
  trackProductListView,
  withRecommendIdCtx,
} from '@psykhe-ai/browser-plugin-snowplow-ecommerce';

trackProductListView({
  name: 'dresses',
  products: [
    {
      product_id: 'sku-201',
      variant_id: 'sku-201-black',
      name: 'Silk Dress',
      price: 180,
      currency: 'usd',
    },
    {
      product_id: 'sku-202',
      variant_id: 'sku-202-blue',
      name: 'Cotton Dress',
      price: 120,
      currency: 'usd',
    },
  ],
});

trackProductListView({
  name: 'dresses',
  products: [
    {
      product_id: 'sku-201',
      variant_id: 'sku-201-black',
      name: 'Silk Dress',
      price: 180,
      currency: 'usd',
    },
    {
      product_id: 'sku-202',
      variant_id: 'sku-202-blue',
      name: 'Cotton Dress',
      price: 120,
      currency: 'usd',
    },
  ],
  context: [withRecommendIdCtx('recommendation-id-001')],
});
```

</details>

<details>
<summary>Product dwell time on PLP</summary>

> Filter out events shorter than 300 ms (for example, a user scrolling past without viewing) or longer than 5 minutes
> (for example, a user leaving the tab open).

```ts
trackProductDwellTime({
  product: {
    product_id: 'sku-202',
    variant_id: 'sku-202-blue',
    name: 'Cotton Dress',
    price: 120,
    currency: 'usd',
  },
  duration: 400,
  pageType: PageType.PLP,
  context: [withRecommendIdCtx('recommendation-id-001')],
});
```

</details>

<details>
<summary>Product list click</summary>

```ts
import { trackListClick } from '@psykhe-ai/browser-plugin-snowplow-ecommerce';

trackListClick({
  productList: 'collection-handle',
  product: {
    product_id: 'sku-203',
    variant_id: 'sku-203-green',
    position: 10,
    name: 'Wrap Dress',
    price: 150,
    currency: 'usd',
  },
  context: [withRecommendIdCtx('recommendation-id-002')],
});

trackListClick({
  productList: 'collection-handle',
  product: {
    product_id: 'sku-201',
    variant_id: 'sku-201-black',
    position: 10,
    name: 'Silk Dress',
    price: 180,
    currency: 'usd',
  },
});
```

</details>

<details>
<summary>Add to cart</summary>

```ts
import { trackAddToCart } from '@psykhe-ai/browser-plugin-snowplow-ecommerce';

trackAddToCart({
  cart_id: 'cart-id',
  total_value: 1000,
  currency: 'usd',
  products: [
    {
      product_id: 'sku-203',
      variant_id: 'sku-203-green',
      position: 11,
      quantity: 1,
      name: 'Wrap Dress',
      price: 150,
      currency: 'usd',
    },
  ],
  context: [withRecommendIdCtx('recommendation-id-003')],
});

trackAddToCart({
  cart_id: 'cart-id',
  total_value: 1000,
  currency: 'usd',
  products: [
    {
      product_id: 'sku-301',
      variant_id: 'sku-301-white',
      quantity: 1,
      name: 'Oxford Shirt',
      price: 500,
      currency: 'usd',
    },
  ],
  context: [withRecommendIdCtx('recommendation-id-003')],
});
```

</details>

<details>
<summary>Remove from cart</summary>

```ts
import { trackRemoveFromCart } from '@psykhe-ai/browser-plugin-snowplow-ecommerce';

trackRemoveFromCart({
  cart_id: 'cart-id',
  total_value: 900,
  currency: 'usd',
  products: [
    {
      product_id: 'sku-203',
      variant_id: 'sku-203-green',
      quantity: 1,
      name: 'Wrap Dress',
      price: 150,
      currency: 'usd',
    },
  ],
});
```

</details>

<details>
<summary>Checkout steps</summary>

```ts
import { trackCheckoutStep } from '@psykhe-ai/browser-plugin-snowplow-ecommerce';

trackCheckoutStep({
  step: 1,
  account_type: 'customer',
});

trackCheckoutStep({
  step: 1,
  account_type: 'guest',
});
```

</details>

<details>
<summary>Complete transaction</summary>

```ts
import { trackTransaction } from '@psykhe-ai/browser-plugin-snowplow-ecommerce';

trackTransaction({
  currency: 'usd',
  revenue: 1100,
  transaction_id: 'transaction-id-123',
  total_quantity: 2,
  products: [
    {
      product_id: 'sku-301',
      variant_id: 'sku-301-white',
      quantity: 1,
      price: 600,
      currency: 'usd',
      name: 'Oxford Shirt',
    },
    {
      product_id: 'sku-302',
      variant_id: 'sku-302-navy',
      quantity: 1,
      price: 500,
      currency: 'usd',
      name: 'Wool Jacket',
    },
  ],
});
```

</details>

<details>
<summary>Track site search</summary>

```ts
import { trackSiteSearch } from '@psykhe-ai/browser-plugin-snowplow-ecommerce';

trackSiteSearch({
  query: 'linen shirt',
  results_count: 128,
});

trackSiteSearch({
  query: 'linen shirt',
  results_count: 128,
  context: [withRecommendIdCtx('recommendation-id-010')],
});
```

</details>

## Development

- Build with `pnpm build`
