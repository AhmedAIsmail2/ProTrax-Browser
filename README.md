<div align="center">

<img src="frontend/public/logo-app.png" alt="ProTraX logo" width="180">

# ProTraX

**Your workouts. Your progress. Your data.**

[Open ProTraX](https://ahmedaismail2.github.io/ProTrax-Browser/) ·
[Source on GitHub](https://github.com/AhmedAIsmail2/ProTrax-Browser)

</div>

ProTraX is a personal workout and body-weight tracker based on [openGym](https://github.com/DuarteSantos8/openGym) 1.4.4. The upstream source notices and GNU AGPL v3.0 license are retained; exercise media has separate terms in [NOTICE.md](NOTICE.md).

## Use ProTraX on iPhone

1. Open the [ProTraX site](https://ahmedaismail2.github.io/ProTrax-Browser/) in Safari.
2. Tap **Share → Add to Home Screen**.

The site serves the ProTraX web app itself. Workouts and settings are saved locally in that browser on that device. They are not synchronized to another browser, phone, or cloud account. Export a backup before changing devices or clearing Safari website data.

## Features

- Weekly plans and routines, workout logging, warm-up sets, rest timers, and progress tracking.
- Exercise search and filters with demonstrations and targeted-muscle maps.
- Local browser storage, offline app shell, and backup import/export.
- ProTraX logo and name, with the accent-colored X and blue default theme.

## GitHub Pages deployment

The `main` branch publishes the local-first PWA to `/demo/`; the root page forwards to it. The Pages workflow builds the browser app without seeded example workouts, then stages the included 180 px exercise media next to the web app. On iPhone, Safari's **Add to Home Screen** opens this same deployed build.

For a local web build from PowerShell:

```powershell
cd frontend
$env:VITE_LOCAL_PWA = "1"
npm run build:iphone
Remove-Item Env:VITE_LOCAL_PWA
```

The output is `frontend/dist-iphone/`. Android debug builds use `com.protrax.ahmed.test` and can be installed beside the companion app; Android release signing and iOS native signing are separate from this GitHub Pages deployment. Project identity and build details are in [PROTRAX_PROJECT.md](PROTRAX_PROJECT.md).
