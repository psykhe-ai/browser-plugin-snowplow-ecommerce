import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const snowplowPackageJson = require('@snowplow/browser-tracker-core/package.json');
const source = readFileSync(join(rootDir, 'src/domain-user-id.ts'), 'utf8');
const referencedVersions = new Set(
  [...source.matchAll(/snowplow-javascript-tracker\/blob\/([^/]+)\//g)].map((match) => match[1]),
);

if (referencedVersions.size !== 1) {
  throw new Error(
    `Expected exactly one Snowplow source version in src/domain-user-id.ts, found: ${[
      ...referencedVersions,
    ].join(', ')}`,
  );
}

const [referencedVersion] = referencedVersions;
if (referencedVersion !== snowplowPackageJson.version) {
  throw new Error(
    `src/domain-user-id.ts references Snowplow ${referencedVersion}, but @snowplow/browser-tracker-core ${snowplowPackageJson.version} is installed. Re-check the mirrored internals and update the source links.`,
  );
}
