import sha1 from 'sha1';
import { v4 as uuidV4 } from 'uuid';
import {
  attemptGetLocalStorage,
  attemptWriteLocalStorage,
  cookie,
  findRootDomain,
  fixupDomain,
  fixupUrl,
  getReferrer,
} from '@snowplow/browser-tracker-core';
import type {
  CookieSameSite,
  ParsedIdCookie,
  StateStorageStrategy,
  TrackerConfiguration,
} from '@snowplow/browser-tracker-core';

export type SnowplowStateStorageStrategy = StateStorageStrategy;

export interface SeedSnowplowDomainUserIdOptions
  extends Pick<
    TrackerConfiguration,
    | 'cookieName'
    | 'cookieDomain'
    | 'cookieSameSite'
    | 'cookieSecure'
    | 'stateStorageStrategy'
    | 'discoverRootDomain'
    | 'cookieLifetime'
    | 'sessionCookieTimeout'
  > {
  /**
   * Must match Snowplow's active cookie path. Snowplow does not expose this as
   * a `newTracker` option, but it can be changed with `setCookiePath()`.
   */
  cookiePath?: string;
  /**
   * Replace an existing Snowplow visitor state value.
   */
  overwriteExisting?: boolean;
}

export interface SeedSnowplowDomainUserIdResult {
  seeded: boolean;
  storage: Exclude<SnowplowStateStorageStrategy, 'cookieAndLocalStorage'>;
  idStateName?: string;
  sessionStateName?: string;
}

const DEFAULT_COOKIE_NAME = '_sp_';
const DEFAULT_COOKIE_PATH = '/';
const DEFAULT_COOKIE_SAME_SITE: CookieSameSite = 'Lax';
const DEFAULT_COOKIE_SECURE = true;
const DEFAULT_VISITOR_COOKIE_TIMEOUT = 63072000;
const DEFAULT_SESSION_COOKIE_TIMEOUT = 1800;

// Mirrors Snowplow Browser Tracker 4.5.0 internals:
// - state key naming from `getSnowplowCookieName` in tracker/index.ts
// - id value shape from `parseIdCookie` in tracker/id_cookie.ts
// Re-check those files when upgrading @snowplow/browser-tracker-core.
// https://github.com/snowplow/snowplow-javascript-tracker/blob/4.5.0/libraries/browser-tracker-core/src/tracker/index.ts
// https://github.com/snowplow/snowplow-javascript-tracker/blob/4.5.0/libraries/browser-tracker-core/src/tracker/id_cookie.ts

/**
 * Seeds Snowplow's first-party visitor state before `newTracker` runs so the
 * browser tracker reuses a caller-provided domain_userid.
 */
export function seedSnowplowDomainUserId(
  domainUserId: string,
  options: SeedSnowplowDomainUserIdOptions = {},
): SeedSnowplowDomainUserIdResult {
  assertBrowserEnvironment();
  assertValidDomainUserId(domainUserId);

  const stateStorageStrategy = options.stateStorageStrategy ?? 'cookieAndLocalStorage';
  if (stateStorageStrategy === 'none') {
    return { seeded: false, storage: 'none' };
  }

  const cookieNamePrefix = options.cookieName ?? DEFAULT_COOKIE_NAME;
  // Falsy fallback (not nullish), matching Snowplow's `configCookiePath || '/'`: an empty
  // cookiePath must coerce to '/', otherwise the domain hash diverges from newTracker().
  const cookiePath = options.cookiePath || DEFAULT_COOKIE_PATH;
  const cookieSameSite = options.cookieSameSite ?? DEFAULT_COOKIE_SAME_SITE;
  const cookieSecure = options.cookieSecure ?? DEFAULT_COOKIE_SECURE;
  // Mirror Snowplow's resolution exactly: discover the root domain only when the caller left
  // cookieDomain falsy (undefined or ''), via the same `&& !configCookieDomain` guard.
  const discoverRootDomain = options.discoverRootDomain ?? options.cookieDomain === undefined;
  let cookieDomain = options.cookieDomain;
  if (discoverRootDomain && !cookieDomain) {
    cookieDomain = findRootDomain(cookieSameSite, cookieSecure);
  }
  // Snowplow hashes `(configCookieDomain || domainAlias) + (configCookiePath || '/')`, where
  // domainAlias is the fixupUrl-normalized hostname (handles translate/cache hosts), not the raw one.
  const domainAlias = fixupDomain(
    fixupUrl(window.location.hostname, window.location.href, getReferrer())[0],
  );
  const domainHash = sha1(`${cookieDomain || domainAlias}${cookiePath}`).slice(0, 4);
  const idStateName = `${cookieNamePrefix}id.${domainHash}`;
  const sessionStateName = `${cookieNamePrefix}ses.${domainHash}`;
  const storage = stateStorageStrategy === 'localStorage' ? 'localStorage' : 'cookie';

  if (!options.overwriteExisting && getStateValue(idStateName, storage)) {
    return {
      seeded: false,
      storage,
      idStateName,
      sessionStateName,
    };
  }

  const state = buildInitialSnowplowState(domainUserId);
  const visitorTtl = options.cookieLifetime ?? DEFAULT_VISITOR_COOKIE_TIMEOUT;
  const sessionTtl = options.sessionCookieTimeout ?? DEFAULT_SESSION_COOKIE_TIMEOUT;

  let idStateSeeded: boolean;
  let sessionStateSeeded: boolean;

  if (storage === 'localStorage') {
    idStateSeeded = writeLocalStorage(idStateName, state.idCookie, visitorTtl);
    sessionStateSeeded = writeLocalStorage(sessionStateName, '*', sessionTtl);
  } else {
    const cookieOptions = {
      ttl: visitorTtl,
      path: cookiePath,
      domain: cookieDomain,
      sameSite: cookieSameSite,
      secure: cookieSecure,
    };
    const sessionCookieOptions = {
      ...cookieOptions,
      ttl: sessionTtl,
    };

    idStateSeeded = writeCookie(idStateName, state.idCookie, cookieOptions);
    sessionStateSeeded = writeCookie(sessionStateName, '*', sessionCookieOptions);
  }

  const seeded = idStateSeeded && sessionStateSeeded;

  return {
    seeded,
    storage,
    idStateName,
    sessionStateName,
  };
}

function buildInitialSnowplowState(domainUserId: string) {
  const nowTs = Math.round(Date.now() / 1000);
  // Snowplow uses `uuid` v4 for generated domain/session/page identifiers.
  // We use the same package so the seeded session id matches Snowplow's format.
  // https://github.com/snowplow/snowplow-javascript-tracker/blob/4.5.0/libraries/browser-tracker-core/src/tracker/id_cookie.ts#L32
  const sessionId = uuidV4();

  // This is the serialized form produced by Snowplow's `serializeIdCookie`.
  // It intentionally excludes the leading "cookies enabled" marker, because
  // Snowplow adds that only while parsing the persisted value.
  // Source:
  // https://github.com/snowplow/snowplow-javascript-tracker/blob/4.5.0/libraries/browser-tracker-core/src/tracker/id_cookie.ts#L62-L135
  // https://github.com/snowplow/snowplow-javascript-tracker/blob/4.5.0/libraries/browser-tracker-core/src/tracker/id_cookie.ts#L245-L253
  const parsedIdCookie: ParsedIdCookie = [
    '0', // cookieDisabled: "0" means storage is enabled
    domainUserId,
    nowTs,
    1,
    nowTs,
    undefined,
    sessionId,
    '',
    '',
    undefined,
    0,
  ];

  return {
    idCookie: parsedIdCookie.slice(1).join('.'),
  };
}

function getStateValue(name: string, storage: 'cookie' | 'localStorage') {
  if (storage === 'localStorage') {
    return attemptGetLocalStorage(name);
  }
  return cookie(name);
}

function writeLocalStorage(name: string, value: string, ttl: number) {
  return attemptWriteLocalStorage(name, value, ttl);
}

interface CookieWriteOptions {
  ttl: number;
  path: string;
  domain?: string;
  sameSite: CookieSameSite;
  secure: boolean;
}

function writeCookie(name: string, value: string, options: CookieWriteOptions) {
  cookie(
    name,
    value,
    options.ttl,
    options.path,
    options.domain,
    options.sameSite,
    options.secure,
  );
  return cookie(name) === value;
}

function assertBrowserEnvironment() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error(
      'seedSnowplowDomainUserId must be called in a browser before Snowplow newTracker is initialized.',
    );
  }
}

function assertValidDomainUserId(domainUserId: string) {
  if (!domainUserId) {
    throw new Error('Snowplow domain_userid must not be empty.');
  }
  if (domainUserId.includes('.')) {
    throw new Error(
      'Snowplow domain_userid must not contain dots because Snowplow stores it in a dot-delimited value.',
    );
  }
  if (/[\s;]/.test(domainUserId)) {
    throw new Error('Snowplow domain_userid must not contain whitespace or semicolons.');
  }
}
