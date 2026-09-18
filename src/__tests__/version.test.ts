import { readFileSync } from 'fs';
import { join } from 'path';

import { otplessRnVersion } from '../version';

/**
 * Drift guard for the wrapper-attribution token.
 *
 * The token sent to the native SDKs at `initialize` embeds `otplessRnVersion`
 * (`react-native-android-<version>` / `react-native-ios-<version>`). If a
 * release bumps `version` in `package.json` but forgets the constant, every
 * session would be attributed to the previous package version - silently. This
 * test makes that a CI failure instead.
 */
describe('otplessRnVersion', () => {
  it('matches the version in package.json', () => {
    const pkgPath = join(__dirname, '..', '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

    expect(typeof pkg.version).toBe('string');
    expect(pkg.version).not.toHaveLength(0);
    expect(otplessRnVersion).toBe(pkg.version);
  });
});
