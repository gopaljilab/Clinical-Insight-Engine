# Production deployment

## Architecture

`vercel.json` builds `dist/public` only. It serves the Vite frontend and does not deploy the Express API or its Python inference daemon. Deploy the existing Docker application as a persistent Node/Python backend (for example, a container service), and configure Vercel to call that backend. The Docker image includes the existing training code, Python packages, and `diabetes_dataset.csv`; the established Python pipeline loads the signed model artifact if present and can train it from the bundled dataset when no compatible artifact is present.

## Vercel frontend settings

- Build command: `npm run build`
- Output directory: `dist/public`
- Build environment variable: `VITE_API_BASE=https://<your-api-host>` (origin only, no trailing slash)

The frontend uses relative `/api` URLs when `VITE_API_BASE` is unset. That only works when the API is served by the same origin, which the current Vercel configuration does not do.

## Backend image and hosting requirements

Run the Docker image on a persistent container service that supports Node.js 22 and Python, allows the process to write the generated signed model and manifest under `/app`, and routes public HTTP traffic to container port `5000`. Vercel's current static output does not host the Express process or persistent Python daemon. `docker-compose.yml` is development-only: it mounts the source tree and runs `drizzle-kit push` at startup; do not use it for production.

When Docker is available on a build machine, use:

```sh
docker build --pull -t clinical-insight-engine:<release-tag> .
docker run --rm --env-file backend.production.env -p 5000:5000 clinical-insight-engine:<release-tag>
```

Create `backend.production.env` locally or configure the same variables in the backend host's secret/environment settings. Do not commit that file or pass backend secrets as Vercel variables. For a registry-backed host, tag and push the image to that host's registry, then select the pushed release tag in its deployment settings. The container's first model initialization may train from the bundled dataset, so allow sufficient startup time and preserve `/app/diabetes_model.pkl`, its signature, and manifest on persistent storage if the host replaces containers between releases.

## Backend settings

Configure these on the backend service, never as Vite build variables:

- `NODE_ENV=production`
- `PORT` (provided by the container host)
- `DATABASE_URL` and the database provider's required TLS settings
- `SESSION_SECRET` (long random value)
- `CORS_ORIGINS=https://clinical-insight-engine.vercel.app` (plus any approved custom frontend origin)
- `PREDICTION_MODE=ml` (the default; only the exact value `rule-based` enables the separately labeled heuristic mode)
- `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS` (the server currently requires these in production at startup, even if email verification is not being exercised)
- Optional `MODEL_VERSION` override; otherwise Python returns a short SHA-256 digest of the loaded artifact
- `REDIS_URL` if asynchronous assessment queues are enabled
- Email sender credentials beyond the required SMTP connection and OAuth credentials only if those features are enabled

The `/health` endpoint returns service availability, whether Python reports a loaded model, the artifact version when known, backend process status, and the configured prediction method. A running API with an unloaded model is not ready to serve ML predictions; assessment inference returns HTTP 503 until it can produce an ML result.

Each newly trained artifact also writes `diabetes_model.pkl.manifest.json` beside the signed pickle. It records the dataset SHA-256, preprocessing and training configuration versions, ordered features, Python/scientific-library versions, and full artifact SHA-256. `/health` exposes this manifest as `training_manifest`; `model_version` is the first 16 characters of `model_artifact_sha256`. Record the full production manifest and verify that prefix relationship after deployment. Treat any changed dataset, configuration, runtime version, or artifact hash as a distinct deployed model; do not infer the production value from a local training run.

The local reproducibility check trained the bundled dataset twice with identical artifact bytes: dataset SHA-256 `c1a517da15e8b334af5716a5bfa6c97c6537daad08485e082bb6e9d861eaff70`, artifact SHA-256 `146f09587948dbc570800bb242baf4b7dd6a9a5e509c6d7bc84828ea12bc1264` (model version `146f09587948dbc5`). The manifest records Python 3.12.15, NumPy 2.5.4, pandas 3.0.6, and scikit-learn 1.9.1 for this run. This is a local reference, not an expected production value. The production value must be captured from the deployed backend's health response.

The current training artifact contains insulin and skin-thickness features in addition to the eight fields collected by the form. The inference pipeline supplies fixed defaults for those two uncollected features; the UI discloses this limitation. The artifact carries its own training feature order and the scaler is loaded from the same serialized artifact.

## Deployment checks

1. Build and deploy the Docker backend with the production secrets above.
2. Check `https://<your-api-host>/health`; confirm `api_available: true`, `model_loaded: true`, and `prediction_method: "ml_model"`.
   Record `training_manifest`; confirm its full artifact SHA-256 starts with `model_version`, and compare the dataset hash, training config, preprocessing config, and runtime versions with the intended release.
3. Set `VITE_API_BASE` in the Vercel project's Production environment and redeploy the frontend.
4. Confirm the browser's assessment request goes to the backend origin and that CORS permits the exact Vercel origin.
5. Run the synthetic patient through the API and verify the response includes `prediction_method`, `model_version`, and `fallback_used: false`.
6. Temporarily test an unavailable model in a non-production environment; the API must return 503 and the UI must offer retry without retaining an old score.

Before applying migration 0006, compare the configured database host/project reference and database name with the deployment owner's intended target. Once the target is confirmed and migration is authorized, inspect the connection identity and existing columns, then apply only this migration:

```sh
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atc "select current_database(), current_user, inet_server_addr();"
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atc "select column_name from information_schema.columns where table_schema='public' and table_name='assessments' and column_name in ('prediction_method','model_version','fallback_used') order by column_name;"
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f migrations/0006_prediction_provenance.sql
```

The migration is idempotent, but verify the identity before those commands. Never substitute `drizzle-kit push` against production. After deployment, set `VITE_API_BASE` to the actual public backend origin in Vercel's **Production** environment and rebuild/redeploy. To verify the built frontend bundle on a build machine, run `VITE_API_BASE=https://<actual-backend-origin> npm run build` and `rg -l --fixed-strings 'https://<actual-backend-origin>' dist/public/assets`; use the real origin in both commands, not the placeholder.

Vercel environment values and backend secrets must be set in their respective dashboards. This repository does not contain access to either dashboard, so those settings and production verification require the deployment owner.
