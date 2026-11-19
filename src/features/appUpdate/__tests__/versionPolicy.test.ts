import { requiresForcedUpdate } from '../versionPolicy';

describe('requiresForcedUpdate', () => {
  it.each([
    ['1.8.1', '1.8.2'],
    ['1.7.9', '1.8.0'],
    ['1.8', '1.8.1'],
    ['v1.8.2', 'v1.9.0'],
  ])('requires an update when %s is older than %s', (current, minimum) => {
    expect(requiresForcedUpdate(current, minimum)).toBe(true);
  });

  it.each([
    ['1.8.2', '1.8.2'],
    ['1.8.3', '1.8.2'],
    ['1.8', '1.8.0'],
    ['1.8.2-beta.1', '1.8.2'],
  ])('allows %s when the minimum is %s', (current, minimum) => {
    expect(requiresForcedUpdate(current, minimum)).toBe(false);
  });

  it.each([
    ['', '1.8.2'],
    ['1.8.2', ''],
    ['unknown', '1.8.2'],
    ['1.8.2', 'latest'],
    ['1..2', '1.8.2'],
    ['1.8.2', '9.0.0+'],
  ])('fails open for invalid versions %p and %p', (current, minimum) => {
    expect(requiresForcedUpdate(current, minimum)).toBe(false);
  });

  it.each([26, true, null, { version: '9.0.0' }])(
    'fails open when a runtime version value is not a string: %p',
    minimum => {
      expect(requiresForcedUpdate('1.8.2', minimum)).toBe(false);
    },
  );
});
