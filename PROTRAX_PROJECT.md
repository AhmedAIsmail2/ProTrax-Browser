# ProTraX project fork

This is a separate ProTraX-branded project based on the upstream [openGym](https://github.com/DuarteSantos8/openGym) v1.4.4 source. The upstream project and its existing copyright and license notices are preserved. This project remains under the GNU AGPL v3.0; see [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md).

## App identity

- Display name: **ProTraX**
- Android and iOS application identifier: `com.protrax.ahmed`
- Android debug application identifier: `com.protrax.ahmed.test`
- Deep link scheme: `protrax://`
- App icons and splash assets use the ProTraX brand assets copied from the companion project.

The unique application identifier allows the Android debug build to coexist with the companion app on one device. Android release signing and iOS signing still need keys and account configuration belonging to the publisher.

## Inherited features

This upstream version already includes configurable training rotations (including rest days) and exercise progress charts. Those features are retained in the new project. The project also retains the upstream application's other functionality and attribution.

## Publishing setup

This fork has no ProTraX release repository or signing key configured. Its in-app self-updater is disabled so it cannot offer an incompatible upstream APK. Links that require ownership of `opengym.ch` or its Android/iOS domain association are not configured for this app. Before publishing, configure a ProTraX release repository, signing credentials, and any domain/app-link infrastructure you own.

## Build

Follow the upstream development and build instructions in [README.md](README.md). For Android, use the `debug` variant to install alongside the companion app; it has the `.test` package suffix. A distributable release needs its own signing configuration.
