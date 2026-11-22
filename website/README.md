# Website assets

The deployed GitHub Pages artifact is built from `../frontend/dist-iphone` and serves the
local-first PWA from the repository Pages root. This source `website/` folder is not copied into
that deployment. The app URL is `https://ahmedaismail2.github.io/ProTrax-Browser/`.

Not in this folder (added at deploy time):

- `img/` — built by `build-images.sh <dist>/img`: the five screenshots from
  `../assets/screenshots/` as PNG plus WebP at 480/600/1170 px (served through `<picture>`),
  `banner.png`, and `social.jpg` (1200×630, the og:image on every page)
- `icon-180.png` / `icon-512.png` — copied from `../frontend/public/` (the same
  icons the PWA uses, so the browser tab, home screen and app all match)
- `app-store-badge.svg`: Apple's official "Download on the App Store" badge, shown once the
  download card's `data-appstore` says `live`. The APKs themselves are not here any more: the
  download buttons point at the GitHub release (`releases/latest/download/<name>`)
- The local-first PWA and its 180 px exercise media are built and staged by the Pages workflow at
  `../.github/workflows/pages.yml`.

Every page has the same top bar. Pages with a table of contents (home, docs, about, API)
also have a contents drawer (`.side`), opened by the green **Contents** pill in the
bottom-left corner. On the two reference pages (`<body class="dock">`: docs and API) a
screen 1200 px or wider shows the contents as a fixed column beside the text instead, so
there is nothing to find; a scrollspy lights the section under the reader.

`site.js` carries five independent pieces, each one failing soft so the page is
complete without any of them: the contents drawer (docked on wide docs/API pages), its scrollspy, the scroll
reveals, the demo iframe (injected only once the frame is on screen, and never
below 700 px, where the CSS swaps it for an "open it full-screen" card), and the
two things that come from the public api.github.com at view time — the star/issue
counts and the About page's release timeline. Both wait for `requestIdleCallback` so
they never compete with the hero image.

Every page starts with a "Skip to content" link (`.skip`, visible on focus) that
targets `<main id="main">`. Screenshots change under the same file name, and nginx
caches images for seven days — bump the name if a new one must show up at once.

`api.html` is the one **generated** file in here: `node scripts/build-api-docs.mjs`
rewrites it from `../api/openapi.yaml`. Edit the spec, re-run the script, commit both —
never hand-edit `api.html`, the next run overwrites it. The page is static HTML in this
site's own design (no Swagger UI, nothing rendered at view time); the only script of its
own it carries is the contents drawer and the card expand/collapse.

`styles.css` and `site.js` are cache-busted with `?v=N` — nginx serves the site
with `no-cache, must-revalidate`, but the query bump is what saves a Cloudflare
edge from handing out an old stylesheet with new markup. Bump it on every change.
