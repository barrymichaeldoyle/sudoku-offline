# Universal Link / App Link verification

These files prove app ownership of the host so shared `/play/*` links open the
app instead of the browser. They are served verbatim from the web root by EAS
Hosting (`eas deploy`) at:

- `https://<host>/.well-known/apple-app-site-association`
- `https://<host>/.well-known/assetlinks.json`

The host is `LINK_HOST` in `src/domain/shareLink.ts` (and must match
`associatedDomains` / `intentFilters` in `app.json`).

## Before this works, replace the placeholders

- **`apple-app-site-association`** — swap `REPLACE_WITH_APPLE_TEAM_ID` for the
  Apple Developer Team ID (App Store Connect → Membership, e.g. `A1B2C3D4E5`).
  The AASA file must be served as `application/json` with **no** `.json`
  extension and over HTTPS with no redirects (EAS Hosting does this for files in
  `public/.well-known/`).
- **`assetlinks.json`** — swap `REPLACE_WITH_ANDROID_SHA256_FINGERPRINT` for the
  release signing key's SHA-256 fingerprint (`eas credentials` → Android, or the
  Play Console App signing page).

## Verify after deploy

```
curl https://<host>/.well-known/apple-app-site-association
curl https://<host>/.well-known/assetlinks.json
```
