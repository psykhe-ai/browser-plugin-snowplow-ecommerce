# @psykhe-ai/browser-plugin-snowplow-ecommerce

Snowplow plugin for tracking ecommerce events on PSYKHE AI-powered shops.

> Designed for all storefronts with integrated PSYKHE AI recommendations.

---

## 📋 Prerequisites

* **Snowplow JavaScript Tracker 4.5.0** with **enabled session context**.

---

## ✨ Features

* Tracks product views, clicks, cart changes, checkout steps, dwell, and transactions
* Automatically attaches PSYKHE AI recommendation contexts
* Built for [@snowplow/browser-tracker](https://www.npmjs.com/package/@snowplow/browser-tracker)

---

## 📦 Installation

```bash
pnpm add @psykhe-ai/browser-plugin-snowplow-ecommerce
```

---

## 🚀 Usage

<details>
<summary>Tracker Initialization</summary>

```ts
import { newTracker } from '@snowplow/browser-tracker';
import { PsykheSnowplowEcommercePlugin } from '@psykhe-ai/browser-plugin-snowplow-ecommerce';

const PSYKHE_BASE_URL = 'https://api.psykhe.dev';
const POST_PATH = '/v1/collector';

// Client identifier, e.g. "store-name.com"
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

---

### Seed Snowplow `domain_userid` (optional)

Seeding `domain_userid` is a **special case**. For most integrations, omit it and let Snowplow generate and manage
`domain_userid` on its own — that is the recommended setup. Expand the section below only when a client explicitly wants
Snowplow to reuse an identifier that already exists in their storefront.

<details>
<summary>Reuse an existing <code>domain_userid</code></summary>

Snowplow's browser tracker does not expose a public initialization option for `domain_userid`. To make Snowplow reuse
an existing identifier, call `seedSnowplowDomainUserId()` immediately before `newTracker()`, using the same storage
options for both calls.

```ts
import { newTracker } from '@snowplow/browser-tracker';
import {
  PsykheSnowplowEcommercePlugin,
  seedSnowplowDomainUserId,
} from '@psykhe-ai/browser-plugin-snowplow-ecommerce';

// Use the same storage options for the seed call and `newTracker()` so the
// seeded state is the one Snowplow reads back.
const cookieName = '_psykhe_';
const cookieDomain = document.location.hostname;
const stateStorageStrategy = 'cookieAndLocalStorage';

const { seeded } = seedSnowplowDomainUserId('your-existing-user-identifier', {
  cookieName,
  cookieDomain,
  stateStorageStrategy,
});

newTracker('psykhe-ai', PSYKHE_BASE_URL, {
  // ...same config as "Tracker Initialization" above...
  cookieName,
  cookieDomain,
  stateStorageStrategy,
  plugins: [PsykheSnowplowEcommercePlugin()],
});
```

Pass the same storage-related options to `seedSnowplowDomainUserId()` that you pass to `newTracker()`, especially
`cookieName`, `cookieDomain`, `cookieSecure`, `cookieLifetime`, `sessionCookieTimeout`, and `stateStorageStrategy`. By
default the helper does not replace an existing Snowplow visitor state value; pass `overwriteExisting: true` only when
you intentionally want to replace it.

**Re-seeding is a no-op by default.** Once a `domain_userid` exists for these storage options — whether you seeded it on
an earlier load or Snowplow already created one — a later call with a *different* identifier is rejected: the existing
identifier stays in use and the call returns `{ seeded: false }`. This makes `seedSnowplowDomainUserId()` safe to run on
every page load. Pass `overwriteExisting: true` only when you deliberately want the new identifier to win.

This helper mirrors Snowplow Browser Tracker 4.5.0's first-party state format because Snowplow does not export the
parser/serializer used during initialization. Re-check the linked Snowplow source comments in the package before
upgrading Snowplow.

The identifier must not contain dots, whitespace, or semicolons because Snowplow stores it inside a dot-delimited
first-party state value.

The call returns a `{ seeded }` flag. Check it: `seeded` is `false` when nothing was written — for example with the
default `cookieSecure: true` over plain `http` (the browser rejects the secure cookie), or when an existing value was
left in place without `overwriteExisting: true`.

</details>

### ℹ️ About PSYKHE AI recommendation context

If your product listings or search results come from PSYKHE AI, include the `recommendationId` using the
`withRecommendIdCtx` context helper. This ensures better downstream analytics by linking user interactions to specific
recommendation or search result contexts.

### Helper functions

The plugin exports **helper functions** for every event listed in
the [Event Categories](https://docs.psykhe.dev/api/tracking-api/getting-started). Each helper is a thin wrapper that
builds the
correct Snowplow self‑describing event and attaches Psykhe AI contexts.

| Helper                    | Event captured                      |
|---------------------------|-------------------------------------|
| `trackProductView()`      | Product Page View (mandatory)       |
| `trackProductListView()`  | Product List Impression (mandatory) |
| `trackAddToCart()`        | Add to Cart (mandatory)             |
| `trackTransaction()`      | Complete Transaction (mandatory)    |
| `trackProductDwellTime()` | PDP/PLP dwell time (recommended)    |

Remember to **filter dwell/hover durations** (≥ 300 ms) as described in Getting Started → Quality Filters.

If your product listings or search results come from PSYKHE AI, include a `recommendationId` using the
`withRecommendIdCtx` context helper. This ensures better downstream analytics by linking user interactions to specific
recommendation or search result contexts.

### 2. Track events

#### ➤ Set user identity

You can call `setEcommerceUser()` once when the tracker is initialized, and again when the user logs in or logs out, to
ensure the correct identity is always associated with events.

```ts
import { setEcommerceUser } from "@psykhe-ai/browser-plugin-snowplow-ecommerce";

setEcommerceUser({
  id: "user-identifier",
  is_guest: false
});
```

<details>
<summary>Product view (PDP)</summary>

```ts
import { trackProductView } from "@psykhe-ai/browser-plugin-snowplow-ecommerce";

trackProductView({
  product_id: "product-identifier",
  name: "Product Name",
  price: 100,
  currency: "usd"
});
```

</details>

<details>
<summary>Product dwell time</summary>


> ℹ️ It is recommended to filter out events shorter than 300ms (e.g., user scrolls past without viewing) or longer than
> 5 minutes (e.g., user left the tab open) to ensure data quality.

```ts
import { trackProductDwellTime, PageType } from "@psykhe-ai/browser-plugin-snowplow-ecommerce";

trackProductDwellTime({
  product: {
    product_id: "product-identifier-2",
    name: "Product Name",
    price: 100,
    currency: "usd"
  },
  duration: 500,
  pageType: PageType.PDP
});
```

</details>

<details>
<summary>Product list view (PLP)</summary>

```ts
import { trackProductListView, withRecommendIdCtx } from "@psykhe-ai/browser-plugin-snowplow-ecommerce";

trackProductListView({
  name: "dresses",
  products: [
    { product_id: "product-id-1", variant_id: "product-v-1", name: "Product Name", price: 100, currency: "usd" },
    { product_id: "product-id-2", variant_id: "product-v-2", name: "Product Name", price: 100, currency: "usd" }
  ]
});

trackProductListView({
  name: "dresses",
  products: [
    { product_id: "product-id-1", variant_id: "product-v-1", name: "Product Name", price: 100, currency: "usd" },
    { product_id: "product-id-2", variant_id: "product-v-2", name: "Product Name", price: 100, currency: "usd" }
  ],
  context: [withRecommendIdCtx("recoId1")]
});
```

</details>

<details>
<summary>Product dwell time on PLP</summary>


> ℹ️ It is recommended to filter out events shorter than 300ms (e.g., user scrolls past without viewing) or longer than
> 5 minutes (e.g., user left the tab open) to ensure data quality.

```ts
trackProductDwellTime({
  product: {
    product_id: "product-identifier-2",
    name: "Product Name",
    price: 100,
    currency: "usd"
  },
  duration: 400,
  pageType: PageType.PLP,
  context: [withRecommendIdCtx("recoId1")]
});
```

</details>

<details>
<summary>Product list click</summary>

```ts
import { trackListClick } from "@psykhe-ai/browser-plugin-snowplow-ecommerce";

trackListClick({
  productList: "collection-handle",
  product: {
    product_id: "product-id-3",
    variant_id: "product-v-3",
    position: 10,
    name: "Product Name",
    price: 100,
    currency: "usd"
  },
  context: [withRecommendIdCtx("recoId2")]
});

trackListClick({
  productList: "collection-handle",
  product: {
    product_id: "product-id-4",
    variant_id: "product-v-1",
    position: 10,
    name: "Product Name",
    price: 100,
    currency: "usd"
  }
});
```

</details>

<details>
<summary>Add to cart</summary>

```ts
import { trackAddToCart } from "@psykhe-ai/browser-plugin-snowplow-ecommerce";

trackAddToCart({
  cart_id: "cart-id",
  total_value: 1000,
  currency: "usd",
  products: [
    {
      product_id: "product-id-3",
      variant_id: "product-v-3",
      position: 11,
      quantity: 1,
      name: "Product Name",
      price: 100,
      currency: "usd"
    }
  ],
  context: [withRecommendIdCtx("recoId3")]
});

trackAddToCart({
  cart_id: "cart-id",
  total_value: 1000,
  currency: "usd",
  products: [
    {
      product_id: "product-id-3",
      variant_id: "product-v-3",
      quantity: 1,
      name: "cool shirt",
      price: 500,
      currency: "usd"
    }
  ],
  context: [withRecommendIdCtx("recoId3")]
});
```

</details>


<details>
<summary>Remove from cart</summary>

```ts
import { trackRemoveFromCart } from "@psykhe-ai/browser-plugin-snowplow-ecommerce";

trackRemoveFromCart({
  cart_id: "cart-id",
  total_value: 900,
  currency: "usd",
  products: [
    {
      product_id: "product-id-3",
      variant_id: "product-v-3",
      quantity: 1,
      name: "Product Name",
      price: 100,
      currency: "usd"
    }
  ]
});
```

</details>

<details>
<summary>Checkout steps</summary>

```ts
import { trackCheckoutStep } from "@psykhe-ai/browser-plugin-snowplow-ecommerce";

trackCheckoutStep({
  step: 1,
  account_type: "customer"
});

trackCheckoutStep({
  step: 1,
  account_type: "guest"
});
```

</details>


<details>
<summary>Complete transaction</summary>

```ts
import { trackTransaction } from "@psykhe-ai/browser-plugin-snowplow-ecommerce";

trackTransaction({
  currency: "usd",
  revenue: 1100,
  transaction_id: "transaction-id-123",
  total_quantity: 2,
  products: [
    {
      product_id: "product-id-3",
      variant_id: "product-v-3",
      quantity: 1,
      price: 600,
      currency: "usd",
      name: "Product Name"
    },
    {
      product_id: "product-id-3",
      variant_id: "product-v-4",
      quantity: 1,
      price: 500,
      currency: "usd",
      name: "Product Name"
    }
  ]
});
```

</details>

<details>
<summary>Track site search</summary>

```ts
import { trackSiteSearch } from "@psykhe-ai/browser-plugin-snowplow-ecommerce";

trackSiteSearch({
  query: "cool shirt",
  results_count: 128
});

trackSiteSearch({
  query: "cool shirt",
  results_count: 128,
  context: [withRecommendIdCtx("recoId10")]
});
```

</details>

---

## 🧪 Development

- Build with `pnpm build`

---
