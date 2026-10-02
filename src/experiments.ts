import type { SelfDescribingJson } from '@snowplow/tracker-core';

import { EXPERIMENT_SCHEMA } from './schemata.js';
import type { Experiment } from './types.js';

/** Build an experiment context for other Snowplow tracking functions. */
export function withExperimentCtx(experiment: Experiment): SelfDescribingJson {
  if (!experiment || typeof experiment !== 'object' || Array.isArray(experiment)) {
    throw new TypeError('An experiment must be an object');
  }
  // Read identifiers once so getters and inherited fields survive serialization.
  const data: Experiment & Record<string, unknown> = {
    experimentId: experiment.experimentId,
    variationId: experiment.variationId,
  };
  for (const [field, maximum] of [
    ['experimentId', 160],
    ['variationId', 100],
  ] as const) {
    const value = data[field];
    if (typeof value !== 'string' || !value.trim() || [...value].length > maximum) {
      throw new TypeError(`${field} must be a nonblank string of up to ${maximum} characters`);
    }
  }
  for (const [field, maximum] of [
    ['hashAttribute', 100],
    ['hashValue', 160],
  ] as const) {
    const value = experiment[field];
    if (
      value !== undefined &&
      value !== null &&
      (typeof value !== 'string' || [...value].length > maximum)
    ) {
      throw new TypeError(`${field} must be a string of up to ${maximum} characters or null`);
    }
    if (value !== undefined) data[field] = value;
  }
  const custom = experiment.custom;
  if (custom === null) data.custom = null;
  if (custom !== undefined && custom !== null) {
    if (!Array.isArray(custom)) {
      throw new TypeError('custom must be an array or null');
    }
    data.custom = Array.from(custom, (entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        throw new TypeError('custom entries must be objects');
      }
      const { key, value } = entry;
      if ((key !== undefined && typeof key !== 'string') ||
        (value !== undefined && value !== null && typeof value !== 'string')) {
        throw new TypeError(
          'custom entries must have a string key and a string or null value when supplied',
        );
      }
      return {
        ...(key !== undefined ? { key } : {}),
        ...(value !== undefined ? { value } : {}),
      };
    });
  }
  return {
    schema: EXPERIMENT_SCHEMA,
    data,
  };
}

/** Copy event contexts and append the caller's experiment observations. */
export function buildEventContexts(
  context: SelfDescribingJson[] = [],
  experiments: Experiment[] = [],
): SelfDescribingJson[] {
  if (!Array.isArray(experiments)) {
    throw new TypeError('experiments must be an array');
  }
  // Array.from visits empty slots too, so sparse arrays cannot bypass validation.
  return [...context, ...Array.from(experiments, withExperimentCtx)];
}
