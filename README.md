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
