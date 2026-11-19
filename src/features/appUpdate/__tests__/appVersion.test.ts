import { NativeModules } from 'react-native';
import { getInstalledAppVersion } from '../appVersion';

describe('getInstalledAppVersion', () => {
  const originalModule = NativeModules.AppVersion;

  afterEach(() => {
    NativeModules.AppVersion = originalModule;
  });

  it('returns the version exposed by the Android native module', () => {
    NativeModules.AppVersion = { versionName: '1.8.2' };

    expect(getInstalledAppVersion()).toBe('1.8.2');
  });

  it.each([undefined, {}, { versionName: '' }, { versionName: 182 }])(
    'fails open when the native value is unavailable: %p',
    nativeValue => {
      NativeModules.AppVersion = nativeValue;

      expect(getInstalledAppVersion()).toBeNull();
    },
  );
});
