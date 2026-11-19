# Android Forced Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a server-controlled, mandatory Android update gate that sends outdated users to Google Play.

**Architecture:** Expose the native Android version name through a focused React Native module. Keep comparison logic pure and tested, then place an Android-only gate inside the existing app providers so it can query bootstrap data and replace navigation with a blocking screen.

**Tech Stack:** React Native 0.84, TypeScript, TanStack Query, Kotlin, Jest

**Spec:** `docs/superpowers/specs/2026-11-19-android-forced-update-design.md`

## Global Constraints

- Android application id is `app.dokan.android`.
- Bootstrap errors and malformed versions fail open.
- Only versions strictly below `min_app_version` are blocked.
- No new third-party dependency.

## Review Focus

- Missing patch segments compare as zero (`1.8` equals `1.8.0`).
- Malformed server/current versions never lock the user out.
- Network failures render the application rather than an infinite loader.
- Returning from Google Play triggers a fresh bootstrap check.
- iOS never invokes the Android update query or screen.

---

### Task 1: Version policy

**Files:**
- Create: `src/features/appUpdate/versionPolicy.ts`
- Test: `src/features/appUpdate/__tests__/versionPolicy.test.ts`

**Interfaces:**
- Produces: `requiresForcedUpdate(currentVersion: string, minimumVersion: string): boolean`

- [x] Write tests for older, equal, newer, shortened, prefixed, prerelease, empty, and malformed versions.
- [x] Run the focused test and confirm it fails because the module is missing.
- [x] Implement strict numeric semantic-version comparison with fail-open validation.
- [x] Run the focused test and confirm it passes.

### Task 2: Native version bridge

**Files:**
- Create: `android/app/src/main/java/com/dokanapp/AppVersionModule.kt`
- Create: `android/app/src/main/java/com/dokanapp/AppVersionPackage.kt`
- Create: `src/features/appUpdate/appVersion.ts`
- Modify: `android/app/src/main/java/com/dokanapp/MainApplication.kt`

**Interfaces:**
- Produces: `getInstalledAppVersion(): string | null`

- [x] Expose `BuildConfig.VERSION_NAME` as the `AppVersion.versionName` constant.
- [x] Register the manual React package.
- [x] Add a defensive typed JavaScript reader.
- [x] Compile Android Kotlin through the debug build.

### Task 3: Update gate and app integration

**Files:**
- Create: `src/features/appUpdate/AppUpdateGate.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `requiresForcedUpdate` and `getInstalledAppVersion`.
- Produces: `AppUpdateGate` wrapping the app navigator.

- [x] Query bootstrap on Android and show a startup loader while the initial check is pending.
- [x] Render children on iOS, request failure, missing native version, or valid version.
- [x] Render a non-dismissible Arabic update screen for outdated versions.
- [x] Open `market://details?id=app.dokan.android`, falling back to the HTTPS Play listing.
- [x] Refetch when the app becomes active.
- [x] Run Jest, ESLint, TypeScript, and an Android debug build.
