# Boondockecho static sample

Public browser sample. Simulated hosts only. Not authentication, not the private monitor, and not hosted until a GitHub repository is chosen.

```bash
npm ci
PAGES_BASE=/boomdock-watchdog/ npm run build
npm test
npm run test:e2e
```

`npm run preview` serves the last build using the base path baked into it. Hash routes look like `/boomdock-watchdog/#/`.

See `../../docs/github-pages.md`.
