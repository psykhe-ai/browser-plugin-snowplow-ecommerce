import { describe, expect, it } from 'vitest';
import { newTracker, trackPageView } from '@snowplow/browser-tracker';
import type { Payload, SelfDescribingJson } from '@snowplow/tracker-core';

import {
  PageType,
  PsykheSnowplowEcommercePlugin,
  setEcommerceUser,
  setPageType,
  trackAddToCart,
  trackCheckoutStep,
  trackExperimentExposure,
  trackListClick,
  trackProductDwellTime,
  trackProductListView,
  trackProductView,
  trackRefund,
  trackRemoveFromCart,
  trackSiteSearch,
  trackTransaction,
  withExperimentCtx,
  withRecommendIdCtx,
  type CommonEcommerceEventProperties,
  type Experiment,
} from '../src/index';

const EXPERIMENT_CONTEXT = 'iglu:com.psykhe/experiment/jsonschema/1-0-0';
const EXPOSURE = 'iglu:com.psykhe/experiment_exposure/jsonschema/1-0-0';
const experiments: Experiment[] = [
  { experimentId: 'recommendations-v1', variationId: 'baseline' },
  {
    experimentId: 'layout-v3',
    variationId: 'compact',
    hashAttribute: 'id',
    hashValue: 'visitor-123',
    custom: [
      { key: 'placement', value: 'product_page' },
      { key: 'note', value: null },
    ],
  },
];
const product = { product_id: 'sku-123', price: 100, currency: 'usd' };
let namespaceCounter = 0;

function bootTracker() {
  const payloads: Payload[] = [];
  const id = `experiments-${++namespaceCounter}`;
  const tracker = newTracker(id, 'https://collector.example.com', {
    appId: 'experiment-test',
    cookieName: `_experiment_${namespaceCounter}_`,
    stateStorageStrategy: 'cookieAndLocalStorage',
    encodeBase64: false,
    // Exercise real payload construction while retaining events locally, below the flush threshold.
    bufferSize: 1000,
    contexts: { session: true, webPage: true },
    plugins: [
      PsykheSnowplowEcommercePlugin(),
      { afterTrack: (payload) => payloads.push({ ...payload }) },
    ],
  });
  if (!tracker) throw new Error('newTracker returned no tracker');
  return { id, tracker, payloads };
}

function contexts(payload: Payload): SelfDescribingJson[] {
  return JSON.parse(payload.co as string).data;
}

function event(payload: Payload): SelfDescribingJson {
  return JSON.parse(payload.ue_pr as string).data;
}

describe('experiment exposure through the real browser tracker', () => {
  it.each(['class getters', 'inherited properties'])(
    'preserves experiment identifiers supplied through %s',
    (source) => {
      class GetterExperiment implements Experiment {
        get experimentId() { return 'recommendations-v1'; }
        get variationId() { return 'baseline'; }
      }
      const experiment: Experiment = source === 'class getters'
        ? new GetterExperiment()
        : Object.create({ experimentId: 'recommendations-v1', variationId: 'baseline' });
      const { id, payloads } = bootTracker();
      trackExperimentExposure({ experiments: [experiment] }, [id]);
      expect(contexts(payloads[0])).toContainEqual({
        schema: EXPERIMENT_CONTEXT,
        data: { experimentId: 'recommendations-v1', variationId: 'baseline' },
      });
    },
  );

  it('sends concurrent experiments with standard identity, page, time and existing contexts', () => {
    const { id, tracker, payloads } = bootTracker();
    setPageType({ type: 'pdp' }, [id]);
    setEcommerceUser({ id: 'customer-123' }, [id]);
    trackExperimentExposure(
      {
        experiments,
        trigger: 'scroll_50_percent',
        context: [withRecommendIdCtx('recommendation-123')],
        timestamp: { type: 'ttm', value: 1790851200000 },
      },
      [id],
    );

    expect(payloads).toHaveLength(1);
    const payload = payloads[0];
    expect(event(payload)).toEqual({ schema: EXPOSURE, data: { trigger: 'scroll_50_percent' } });
    expect(contexts(payload).filter((context) => context.schema === EXPERIMENT_CONTEXT)).toEqual(
      experiments.map((data) => ({ schema: EXPERIMENT_CONTEXT, data })),
    );
    expect(payload.duid).toBe(tracker.getDomainUserId());
    expect(payload.sid).toMatch(/^[0-9a-f-]{36}$/);
    expect(payload.eid).toMatch(/^[0-9a-f-]{36}$/);
    expect(payload.url).toBe('https://store.example.com/');
    expect(payload.ttm).toBe('1790851200000');
    expect(contexts(payload)).toEqual(
      expect.arrayContaining([
        withRecommendIdCtx('recommendation-123'),
        expect.objectContaining({ data: { type: 'pdp' } }),
        expect.objectContaining({ data: { id: 'customer-123' } }),
      ]),
    );
  });

  it('accepts an exposure without a trigger and does not persist experiment state', () => {
    const { id, payloads } = bootTracker();
    trackExperimentExposure({ experiments: [experiments[0]] }, [id]);
    trackProductView(product, [id]);
    expect(event(payloads[0])).toEqual({ schema: EXPOSURE, data: {} });
    expect(
      contexts(payloads[0]).filter((context) => context.schema === EXPERIMENT_CONTEXT),
    ).toEqual([{ schema: EXPERIMENT_CONTEXT, data: experiments[0] }]);
    expect(
      contexts(payloads[1]).filter((context) => context.schema === EXPERIMENT_CONTEXT),
    ).toEqual([]);
    expect(payloads[1].duid).toBe(payloads[0].duid);
    expect(payloads[1].sid).toBe(payloads[0].sid);
  });

  it('targets requested trackers and builds a separate event for each tracker', () => {
    const first = bootTracker();
    const second = bootTracker();
    const excluded = bootTracker();
    trackExperimentExposure({ experiments }, [first.id, second.id]);
    expect(first.payloads).toHaveLength(1);
    expect(second.payloads).toHaveLength(1);
    expect(excluded.payloads).toHaveLength(0);
    expect(first.payloads[0].eid).not.toBe(second.payloads[0].eid);
    expect(first.payloads[0].duid).toBe(first.tracker.getDomainUserId());
    expect(second.payloads[0].duid).toBe(second.tracker.getDomainUserId());
    expect(event(first.payloads[0])).toEqual(event(second.payloads[0]));
  });
});

const interactions: [string, (options: CommonEcommerceEventProperties, id: string) => void][] = [
  ['checkout', (options, id) => trackCheckoutStep({ step: 1, ...options }, [id])],
  [
    'list view',
    (options, id) =>
      trackProductListView({ name: 'dresses', products: [product], ...options }, [id]),
  ],
  ['product view', (options, id) => trackProductView({ ...product, ...options }, [id])],
  [
    'list click',
    (options, id) => trackListClick({ productList: 'dresses', product, ...options }, [id]),
  ],
  [
    'search',
    (options, id) =>
      trackSiteSearch({ query: 'dress', resultProducts: [product], ...options }, [id]),
  ],
  [
    'add to cart',
    (options, id) =>
      trackAddToCart({ total_value: 100, currency: 'usd', products: [product], ...options }, [id]),
  ],
  [
    'remove from cart',
    (options, id) =>
      trackRemoveFromCart({ total_value: 0, currency: 'usd', products: [product], ...options }, [
        id,
      ]),
  ],
  [
    'transaction',
    (options, id) =>
      trackTransaction(
        {
          transaction_id: 'order-123',
          revenue: 100,
          currency: 'usd',
          products: [product],
          ...options,
        },
        [id],
      ),
  ],
  [
    'refund',
    (options, id) =>
      trackRefund(
        {
          transaction_id: 'order-123',
          refund_amount: 100,
          currency: 'usd',
          products: [product],
          ...options,
        },
        [id],
      ),
  ],
  [
    'dwell',
    (options, id) =>
      trackProductDwellTime({ product, duration: 500, pageType: PageType.PDP, ...options }, [id]),
  ],
];

describe('optional experiments on ecommerce interactions', () => {
  it.each(interactions)(
    '%s retains product data and caller contexts without mutating them',
    (_name, track) => {
      const { id, payloads } = bootTracker();
      const context = [withRecommendIdCtx('recommendation-123')];
      const before = structuredClone(context);
      track({ context, experiments }, id);
      track({ context }, id);
      expect(context).toEqual(before);
      expect(contexts(payloads[0]).filter((entry) => entry.schema === EXPERIMENT_CONTEXT)).toEqual(
        experiments.map((data) => ({ schema: EXPERIMENT_CONTEXT, data })),
      );
      expect(contexts(payloads[1]).filter((entry) => entry.schema === EXPERIMENT_CONTEXT)).toEqual(
        [],
      );
      expect(contexts(payloads[0])).toContainEqual(withRecommendIdCtx('recommendation-123'));
      expect(contexts(payloads[0])).toEqual(
        expect.arrayContaining(
          contexts(payloads[1]).filter((entry) => entry.schema.startsWith('iglu:com.psykhe/')),
        ),
      );
      for (const entry of contexts(payloads[0])) {
        expect(entry.data).not.toHaveProperty('experiments');
      }
    },
  );

  it('offers a context helper for standard Snowplow APIs', () => {
    const { id, payloads } = bootTracker();
    trackPageView({ context: experiments.map(withExperimentCtx) }, [id]);
    expect(payloads[0].e).toBe('pv');
    expect(
      contexts(payloads[0]).filter((context) => context.schema === EXPERIMENT_CONTEXT),
    ).toEqual(experiments.map((data) => ({ schema: EXPERIMENT_CONTEXT, data })));
  });
});

describe('client validation', () => {
  it.each(
    [
      undefined,
      [],
      null,
      Array(1),
      [{ variationId: 'baseline' }],
      [{ experimentId: 'one' }],
      [{ experimentId: ' ', variationId: 'baseline' }],
      [{ experimentId: 'one', variationId: 0 }],
      [{ experimentId: 'x'.repeat(161), variationId: 'baseline' }],
      [{ experimentId: 'one', variationId: 'x'.repeat(101) }],
      [experiments[0], { experimentId: 'two', variationId: '' }],
      [{ ...experiments[0], hashAttribute: 'x'.repeat(101) }],
      [{ ...experiments[0], hashValue: 'x'.repeat(161) }],
      [{ ...experiments[0], custom: { placement: 'product_page' } }],
      [{ ...experiments[0], custom: [null] }],
      [{ ...experiments[0], custom: [{ key: 7 }] }],
      [{ ...experiments[0], custom: [{ value: 7 }] }],
    ].map((invalid) => [invalid]),
  )('rejects invalid experiments before tracking: %j', (invalid) => {
    const { id, payloads } = bootTracker();
    expect(() => trackExperimentExposure({ experiments: invalid as Experiment[] }, [id])).toThrow(
      TypeError,
    );
    expect(payloads).toHaveLength(0);
  });

  it.each([null, 7, 'x'.repeat(129)])('rejects invalid triggers before tracking: %j', (trigger) => {
    const { id, payloads } = bootTracker();
    expect(() =>
      trackExperimentExposure({ experiments, trigger: trigger as string }, [id]),
    ).toThrow(TypeError);
    expect(payloads).toHaveLength(0);
  });

  it('rejects an invalid experiment on an interaction before sending to any tracker', () => {
    const first = bootTracker();
    const second = bootTracker();
    const context = [withRecommendIdCtx('recommendation-123')];
    const before = structuredClone(context);
    expect(() =>
      trackAddToCart({
        total_value: 100,
        currency: 'usd',
        products: [product],
        context,
        experiments: [experiments[0], { experimentId: 'invalid', variationId: '' }],
      }, [first.id, second.id]),
    ).toThrow(TypeError);
    expect(first.payloads).toHaveLength(0);
    expect(second.payloads).toHaveLength(0);
    expect(context).toEqual(before);
  });

  it('uses schema character limits for Unicode identifiers and permits nullable optional data', () => {
    const { id, payloads } = bootTracker();
    const experiment: Experiment = {
      experimentId: '🧪'.repeat(160),
      variationId: '🧪'.repeat(100),
      hashAttribute: null,
      hashValue: null,
      custom: null,
    };
    trackExperimentExposure({ experiments: [experiment], trigger: '🧪'.repeat(128) }, [id]);
    expect(contexts(payloads[0])).toContainEqual({ schema: EXPERIMENT_CONTEXT, data: experiment });
    expect(() => withExperimentCtx({ ...experiment, experimentId: '🧪'.repeat(161) })).toThrow(
      TypeError,
    );
  });

  it('copies custom metadata when constructing reusable contexts', () => {
    const experiment: Experiment = {
      ...experiments[0],
      custom: [{ key: 'placement', value: 'pdp' }],
    };
    const context = withExperimentCtx(experiment);
    experiment.variationId = 'changed';
    experiment.custom![0].value = 'changed';
    expect(context.data).toEqual({
      ...experiments[0],
      custom: [{ key: 'placement', value: 'pdp' }],
    });
  });
});
