import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { newTracker, type TrackerConfiguration } from '@snowplow/browser-tracker';

import { seedSnowplowDomainUserId } from '../src/domain-user-id';
import type { SeedSnowplowDomainUserIdOptions } from '../src/domain-user-id';

const HOST = 'store.example.com';
const COLLECTOR = 'https://collector.example.com';
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let namespaceCounter = 0;

/**
 * Boot a real Snowplow tracker with the given storage options and read back the
 * domain_userid through Snowplow's own parser. A unique namespace per call avoids
 * Snowplow's global tracker registry returning a cached instance.
 */
function bootTracker(config: TrackerConfiguration) {
  namespaceCounter += 1;
  const tracker = newTracker(`sp-${namespaceCounter}`, COLLECTOR, config);
  if (!tracker) {
    throw new Error('newTracker returned no tracker');
  }
  return tracker;
}

function clearAllCookies() {
  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0].trim();
    if (name) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    }
  }
}

function readCookie(name: string): string | undefined {
  for (const part of document.cookie.split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) {
      return decodeURIComponent(value.join('='));
    }
  }
  return undefined;
}

beforeEach(() => {
  clearAllCookies();
  window.localStorage.clear();
});

describe('seedSnowplowDomainUserId — round-trip against the real Snowplow tracker', () => {
  it('seeds a domain_userid the tracker reads back (cookie strategy)', () => {
    const options: SeedSnowplowDomainUserIdOptions = {
      cookieName: '_ck_',
      cookieDomain: HOST,
      stateStorageStrategy: 'cookie',
    };

    const result = seedSnowplowDomainUserId('abc123', options);
    expect(result.seeded).toBe(true);
    expect(result.storage).toBe('cookie');

    const tracker = bootTracker({ appId: 'test', ...options });
    expect(tracker.getDomainUserId()).toBe('abc123');
  });

  it('seeds via cookie when strategy is cookieAndLocalStorage (matches the tracker reader)', () => {
    const options: SeedSnowplowDomainUserIdOptions = {
      cookieName: '_cl_',
      cookieDomain: HOST,
      stateStorageStrategy: 'cookieAndLocalStorage',
    };

    const result = seedSnowplowDomainUserId('cl-id', options);
    expect(result.seeded).toBe(true);
    expect(result.storage).toBe('cookie');

    const tracker = bootTracker({ appId: 'test', ...options });
    expect(tracker.getDomainUserId()).toBe('cl-id');
  });

  it('seeds via localStorage when strategy is localStorage', () => {
    const options: SeedSnowplowDomainUserIdOptions = {
      cookieName: '_ls_',
      cookieDomain: HOST,
      stateStorageStrategy: 'localStorage',
    };

    const result = seedSnowplowDomainUserId('ls-id', options);
    expect(result.seeded).toBe(true);
    expect(result.storage).toBe('localStorage');

    const tracker = bootTracker({ appId: 'test', ...options });
    expect(tracker.getDomainUserId()).toBe('ls-id');
  });

  it('seeds host-only cookies (cookieDomain: "") under the hostname hash — regression for the falsy fallback', () => {
    // With nullish (`??`) fallback this seeded under hash('' + path), which the
    // tracker never reads. The falsy (`||`) fallback hashes the hostname like Snowplow.
    const options: SeedSnowplowDomainUserIdOptions = {
      cookieName: '_ho_',
      cookieDomain: '',
      stateStorageStrategy: 'cookie',
    };

    const result = seedSnowplowDomainUserId('host-only-id', options);
    expect(result.seeded).toBe(true);

    const tracker = bootTracker({ appId: 'test', ...options });
    expect(tracker.getDomainUserId()).toBe('host-only-id');
  });

  it('seeds correctly when cookieDomain is omitted (root-domain discovery runs on both sides)', () => {
    const options: SeedSnowplowDomainUserIdOptions = {
      cookieName: '_rd_',
      stateStorageStrategy: 'cookie',
    };

    const result = seedSnowplowDomainUserId('discovered-id', options);
    expect(result.seeded).toBe(true);

    const tracker = bootTracker({ appId: 'test', ...options });
    expect(tracker.getDomainUserId()).toBe('discovered-id');
  });
});

describe('seedSnowplowDomainUserId — negative control', () => {
  it('an unseeded tracker mints a fresh random domain_userid (proves the round-trips exercise seeding)', () => {
    const tracker = bootTracker({
      appId: 'test',
      cookieName: '_neg_',
      cookieDomain: HOST,
      stateStorageStrategy: 'cookie',
    });

    const domainUserId = tracker.getDomainUserId();
    expect(domainUserId).toMatch(UUID_V4);
    expect(domainUserId).not.toBe('abc123');
  });
});

describe('seedSnowplowDomainUserId — overwriteExisting', () => {
  it('does not replace an existing value by default, but replaces when asked', () => {
    const options: SeedSnowplowDomainUserIdOptions = {
      cookieName: '_ow_',
      cookieDomain: HOST,
      stateStorageStrategy: 'cookie',
    };

    // Assert the non-overwrite case against the raw cookie rather than by booting a
    // tracker: booting an interim tracker would warm Snowplow's in-memory cookie cache
    // and mask the final write in this single-process test.
    const first = seedSnowplowDomainUserId('id-1', options);
    expect(first.seeded).toBe(true);

    const secondAttempt = seedSnowplowDomainUserId('id-2', options);
    expect(secondAttempt.seeded).toBe(false);
    expect(readCookie(first.idStateName!)).toMatch(/^id-1\./);

    const overwrite = seedSnowplowDomainUserId('id-2', { ...options, overwriteExisting: true });
    expect(overwrite.seeded).toBe(true);
    expect(readCookie(overwrite.idStateName!)).toMatch(/^id-2\./);
    expect(bootTracker({ appId: 'test', ...options }).getDomainUserId()).toBe('id-2');
  });
});

describe('seedSnowplowDomainUserId — stateStorageStrategy: none', () => {
  it('writes nothing and reports it did not seed', () => {
    const result = seedSnowplowDomainUserId('x', {
      cookieName: '_none_',
      cookieDomain: HOST,
      stateStorageStrategy: 'none',
    });

    expect(result).toEqual({ seeded: false, storage: 'none' });
    expect(document.cookie).not.toContain('_none_id.');
  });
});

describe('seedSnowplowDomainUserId — validation', () => {
  it.each([
    ['', /must not be empty/],
    ['has.dot', /must not contain dots/],
    ['has space', /whitespace or semicolons/],
    ['has;semicolon', /whitespace or semicolons/],
  ])('rejects %j', (value, message) => {
    expect(() => seedSnowplowDomainUserId(value)).toThrow(message);
  });
});

describe('seedSnowplowDomainUserId — seeded:false when the browser rejects the write', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports seeded:false for a Secure cookie on a plain http document', () => {
    // The default cookieSecure:true cookie cannot be stored on an http page — browsers
    // (and jsdom) silently drop it. The helper detects the failed write via
    // `cookie(name) === value` and surfaces it, rather than falsely reporting success.
    // This is the contract the README tells callers to check.
    const httpDom = new JSDOM('<!doctype html>', { url: 'http://store.example.com' });
    vi.stubGlobal('window', httpDom.window);
    vi.stubGlobal('document', httpDom.window.document);

    const result = seedSnowplowDomainUserId('http-id', {
      cookieName: '_sec_',
      cookieDomain: HOST,
      cookieSecure: true,
      stateStorageStrategy: 'cookie',
    });

    expect(result.seeded).toBe(false);
    expect(httpDom.window.document.cookie).not.toContain('_sec_id.');
  });
});

describe('seedSnowplowDomainUserId — overwriteExisting (localStorage)', () => {
  it('does not replace an existing localStorage value by default, but replaces when asked', () => {
    const options: SeedSnowplowDomainUserIdOptions = {
      cookieName: '_owl_',
      cookieDomain: HOST,
      stateStorageStrategy: 'localStorage',
    };

    const first = seedSnowplowDomainUserId('ls-1', options);
    expect(first.seeded).toBe(true);

    const skip = seedSnowplowDomainUserId('ls-2', options);
    expect(skip.seeded).toBe(false);
    expect(window.localStorage.getItem(first.idStateName!)).toMatch(/^ls-1\./);

    const overwrite = seedSnowplowDomainUserId('ls-2', { ...options, overwriteExisting: true });
    expect(overwrite.seeded).toBe(true);
    expect(window.localStorage.getItem(overwrite.idStateName!)).toMatch(/^ls-2\./);
  });
});

describe('seedSnowplowDomainUserId — refresh idempotency (seed -> tracker -> refresh -> seed)', () => {
  it('a second seed after the tracker has run is a no-op and keeps the original duid + session id', () => {
    const options: SeedSnowplowDomainUserIdOptions = {
      cookieName: '_refresh_',
      cookieDomain: HOST,
      stateStorageStrategy: 'cookie',
    };

    // First page load: seed, then let the real Snowplow tracker take over. Booting the
    // tracker is what makes this stronger than the raw-cookie overwrite test above — the
    // tracker reads and rewrites the id cookie, so we prove the guard survives Snowplow's
    // own mutation, not just a back-to-back double seed.
    const first = seedSnowplowDomainUserId('known-duid', options);
    expect(first.seeded).toBe(true);

    const t1 = bootTracker({ appId: 'test', ...options });
    expect(t1.getDomainUserId()).toBe('known-duid');

    const cookieAfterBoot = readCookie(first.idStateName!);
    const sessionIdAfterBoot = cookieAfterBoot!.split('.')[5]; // sessionId slot in the serialized id state

    // Page refresh: seed runs again with a DIFFERENT identifier. The default guard must
    // reject it (the existing value wins) — this is the contract the README promises.
    const second = seedSnowplowDomainUserId('different-duid', options);
    expect(second.seeded).toBe(false);

    const cookieAfterReseed = readCookie(second.idStateName!);
    expect(cookieAfterReseed!.startsWith('known-duid.')).toBe(true);
    expect(cookieAfterReseed!.split('.')[5]).toBe(sessionIdAfterBoot);
    expect(cookieAfterReseed).toBe(cookieAfterBoot); // the no-op wrote nothing

    // A freshly booted tracker still reports the original identifier.
    expect(bootTracker({ appId: 'test', ...options }).getDomainUserId()).toBe('known-duid');
  });
});
