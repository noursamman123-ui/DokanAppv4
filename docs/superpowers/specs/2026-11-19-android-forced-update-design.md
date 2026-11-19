# Android Forced Update Design

## Intent

Prevent Android users on an unsupported Dokan version from entering the app, and direct them to the current Google Play release. The server remains the switch through the existing `bootstrap.config.min_app_version` field.

## Goals

- Check the minimum supported version at app startup.
- Fail open if the bootstrap request or version data is unavailable, so a server outage does not lock every customer out.
- Block an outdated Android build with a non-dismissible Arabic screen.
- Open the Google Play app first and fall back to the HTTPS listing.
- Re-check when the app returns to the foreground.

## Non-goals

- iOS update enforcement.
- Silent installation or Google Play Core in-app updates.
- Changing the server response or publishing a Play Store release.

## Approach

The selected approach is a server-controlled React Native gate. A tiny Android native module exposes `BuildConfig.VERSION_NAME`, avoiding a duplicated JavaScript version constant or a new third-party dependency. A pure TypeScript comparator determines whether the installed version is below `min_app_version`; an app-level component owns the bootstrap request and update screen.

The alternatives considered were a hard-coded JavaScript version (simpler but easy to forget during releases) and Play Core immediate updates (better installation UX but materially more native lifecycle work). The native version bridge plus store redirect is the smallest reliable enforcement mechanism for this round.

## Constraints

- Android application id is `app.dokan.android`.
- Unknown or malformed versions must not force an update.
- The server minimum version must only be raised after the corresponding Play release is available.
