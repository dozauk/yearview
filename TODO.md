# TODO

## Fly.io Deployment

- [ ] Install Fly CLI and login (`curl -L https://fly.io/install.sh | sh && fly auth login`)
- [ ] Run `fly launch` in project root to generate `fly.toml` (no Postgres, no Redis)
- [ ] Create persistent volume: `fly volumes create yearview_data --size 1`
- [ ] Add volume mount to `fly.toml`:
      ```toml
      [mounts]
        source = "yearview_data"
        destination = "/data"
      ```
- [ ] Update `server.js` to use `DB_PATH` env var for `sessions.db` location
- [ ] Set Fly secrets: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`,
      `SESSION_SECRET`, `NODE_ENV=production`, `DB_PATH=/data/sessions.db`
- [ ] Add production URL to Google Cloud Console (Authorized redirect URIs + JavaScript origins)
- [ ] Run `fly deploy` to deploy manually the first time
- [ ] (Optional) Add `.github/workflows/deploy.yml` for auto-deploy on push to master
- [ ] (Optional) Add Fly API token to GitHub secrets as `FLY_API_TOKEN`
