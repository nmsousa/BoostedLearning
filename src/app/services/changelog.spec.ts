import { CHANGELOG } from './changelog';
import pkg from '../../../package.json';

describe('changelog', () => {
  it('has an entry for the current version, first', () => {
    expect(CHANGELOG[0].version).toBe(pkg.version);
  });

  // The "What's new" list shows the release date; a missing date shows nothing.
  it('gives every recent release a valid date', () => {
    for (const e of CHANGELOG.slice(0, 10)) {
      expect(e.date, e.version).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    }
  });
});
