import { buildSelfDescribingEvent } from '@snowplow/tracker-core';

import { ECOMMERCE_ACTION_SCHEMA, PSYKHE_PRODUCT_DWELL_TIME_SCHEMA } from './schemata.js';
import { Action, DwellAction } from './types.js';

/**
 * Build an Ecommerce Action Event
 * For tracking ecommerce actions
 *
 * @param event - Contains the properties for Cart related events
 * @returns PayloadBuilder to be sent to {@link @snowplow/tracker-core#TrackerCore.track}
 */
export function buildEcommerceActionEvent(event: Action) {
  return buildSelfDescribingEvent({
    event: {
      schema: ECOMMERCE_ACTION_SCHEMA,
      data: removeEmptyProperties({ ...event }),
    },
  });
}

export function buildDwellTimeEvent(event: DwellAction) {
  return buildSelfDescribingEvent({
    event: {
      schema: PSYKHE_PRODUCT_DWELL_TIME_SCHEMA,
      data: removeEmptyProperties({ ...event }),
    },
  });
}

/**
 * Returns a copy of a JSON with undefined and null properties removed
 *
 * @param event - Object to clean
 * @returns A cleaned copy of eventJson
 */
function removeEmptyProperties(event: Record<string, unknown>): Record<string, unknown> {
  const ret: Record<string, unknown> = {};
  for (const k in event) {
    if (event[k] !== null && typeof event[k] !== 'undefined') {
      ret[k] = event[k];
    }
  }
  return ret;
}
