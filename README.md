# CircleSync Spotify Compatibility App

This project replaces the original weather dashboard with a Spotify-powered media compatibility prototype.


## How to run

1. Create an app at the Spotify Developer Dashboard.
2. Add your local page URL as a Redirect URI. Example:
   - `http://127.0.0.1:5500/index.html`
   - or whatever URL your local server uses
3. Open the project from a local server, not directly from the file system.
4. Paste your Spotify Client ID into the app and click **Save Client ID**.
5. Click **Connect Spotify**.

## DevSecOps tools included

- GitHub Actions CI workflow for automated security checks.
- GitHub CodeQL for JavaScript static analysis.
- Dependency Review for pull request dependency scanning.
- Secret scanning through Gitleaks.
- Dockerfile for repeatable containerized deployment.
- Nginx security headers for deployed static hosting.
- Content Security Policy in `index.html` to limit browser access to Spotify endpoints only.

## Important security note

This is a front-end prototype. It uses PKCE so no Spotify client secret is stored in the browser. Do not add a Spotify client secret to this project.


## Security automation added

This repository now includes GitHub Actions workflows under `.github/workflows/`:

- `codeql.yml` runs CodeQL JavaScript analysis on pushes and pull requests.
- `security.yml` runs Gitleaks secret scanning, Docker build validation, Dockerfile linting with Hadolint, and Dependency Review on pull requests.

The frontend no longer hardcodes a Spotify Client ID. Users paste their own public Spotify Client ID, which is saved in browser local storage. The app still uses OAuth 2.0 Authorization Code with PKCE and does not store or require a Spotify client secret.
