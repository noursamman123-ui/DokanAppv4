import { NativeModules } from 'react-native';

type AppVersionNativeModule = {
  versionName?: unknown;
};

export const getInstalledAppVersion = (): string | null => {
  const appVersion = NativeModules.AppVersion as
    | AppVersionNativeModule
    | undefined;
  const versionName = appVersion?.versionName;

  return typeof versionName === 'string' && versionName.trim().length > 0
    ? versionName.trim()
    : null;
};
