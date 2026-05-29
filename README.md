# PHOTOZ / EYE Vault

This is a Cloudflare Workers Builds project, not a Pages-only project.

Use these Cloudflare Build settings:

Build command:
bun run build

Deploy command:
npx wrangler deploy

Non-production branch deploy command:
npx wrangler deploy

The project uses Wrangler static assets:

- Vite builds the React app into `dist`
- Wrangler deploys `src/worker.js`
- `[assets] directory = "./dist"` serves the built app
- R2 bucket binding is `photoz`

The Worker API routes:

- GET /api/index
- PUT /api/index
- POST /api/upload

R2 objects:

- `vault-index.json`
- uploaded original files, unmodified
- sidecar `*.metadata.json` files

Cloudflare docs used:
- Workers Vite projects use a package build script and Wrangler deploy.
- Workers static assets are configured with `[assets] directory = "./dist"`.
- R2 bindings are configured in `wrangler.toml`.


## Album home rules

Albums are the real home layer for files. Timeline is only a filtered view.

- Every memory must belong to at least one non-star album.
- `UNASSIGNED` is permanent and cannot be deleted.
- New photos go to `UNASSIGNED`.
- New videos go to `VIDEOS`.
- If a custom album is deleted, any orphaned files are automatically returned to `UNASSIGNED`.
- The index save/load path runs `ensureAlbumCoverage()` so old indexes cannot leave files outside albums.


## Albums + filter view update

Albums and Timeline are merged.

- Albums is the default/main archive page.
- The top filter switches between: FOLDERS, YEARS, MONTHS, ERAS.
- FOLDERS is the real home layer.
- YEARS/MONTHS/ERAS are filter views only.
- Every file must still belong to at least one album.


## Styling pass

Updated from generic default UI to a tighter custom archive style: condensed typography, custom dock labels, stronger glass depth, sharper card hierarchy, and no Tailwind dependency.


## Concrete background

The uploaded gray concrete texture is included at:

`public/bg-concrete.jpg`

The app shell floats above it through the `.app` and `.shell` styles in `src/styles.css`.


## Glass refinement pass

Updated the UI glass system:
- clearer glass with less fog
- stronger inner highlights
- darker contact shadows
- layered pseudo-element reflections
- sharper controls, cards, dock, modal, and shell separation from the concrete background
