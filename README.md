# FLAPPY COPILOT

A retro terminal-style Flappy Bird game — GitHub Copilot themed.

**Play:** https://filmgirl.github.io/flappy-copilot/

## Controls
- `SPACE` / click / tap — flap
- `M` — mute

Dodge the git branch lines, collect commits, avoid merge conflicts.

## Develop and test in the Commit Cabinet

The game remains a standalone `index.html`; Node.js 22+ is only development
tooling. There is no runtime framework. The build copies the game into `dist/`,
which is the only directory eligible for deployment.

```sh
npm ci
npx playwright install chromium webkit
npm run cabinet:setup
npm run build
npm run test:compat
```

On Linux, install browser OS dependencies with
`npx playwright install --with-deps chromium webkit`.
Rebuild after changing the game: tests deliberately serve **`dist/`, not the
source file or the already-published game**.

The harness mounts the real [Commit Cabinet](https://github.com/filmgirl/arcade)
at `/arcade/` and the candidate at `/flappy-copilot/` on the same origin, like
GitHub Pages. Only Flappy's URL in the served `games.json` is rewritten; no tracked
manifest is changed and no substitute cabinet is used. It checks exact candidate
HTML bytes, cabinet source bytes, and the iframe's candidate URL before testing
gameplay. No gameplay bridge or test hooks are needed: assertions read the
existing `state`, `bird`, `pipes`, and `muted` globals and actual canvas rendering.

The server defaults to `http://127.0.0.1:4262`. Override with
`CABINET_PORT=4265 npm run test:compat`. An occupied port fails instead of
silently testing an unrelated server. For manual inspection, after setup/build:

```sh
node scripts/serve-compat.mjs
# Open http://127.0.0.1:4262/arcade/
```

Coverage includes mouse and Enter launch, immediate and repeated Space input,
moving pipes, M audio toggling, reload focus, return-card focus, old-frame cleanup
on reload/switch/return, touch, 320/390px widths, landscape resizing, focus mode,
native desktop fullscreen, and unavailable-fullscreen fallback with accessible
exits. Desktop Chromium, mobile Chromium, and mobile WebKit run without retries;
native fullscreen is intentionally desktop-only. Uncaught errors, console
errors, failed requests, and HTTP asset errors fail tests. Only canceled
navigations belonging to detached iframes are excluded during teardown.

To prove a broken candidate cannot pass:

```sh
npm run test:negative
```

This temporarily injects a startup exception, then a missing required script,
into the ignored build output. Both must fail the desktop launch test for the
expected reason. The original build is restored in `finally`; tracked gameplay
and cabinet files are untouched. Logs are in `.cache/negative-controls/`.
Do not run this at the same time as another test/server using the same build.
Normal failures retain traces/screenshots in `test-results/` and the HTML report
in `playwright-report/`; inspect with `npx playwright show-report`.

### Cabinet pin maintenance

The disposable ignored checkout is `.cache/cabinet`, pinned to
`18b9d013a9591c9d97348f21023f875eb2a7630b`. Setup fetches exactly this commit;
the server rejects a different or dirty checkout. CI checks out the same full
SHA with credentials persistence disabled.

To update the contract, review the upstream cabinet diff, update the full SHA in
both `scripts/cabinet.mjs` and `.github/workflows/pages.yml`, remove only the
disposable `.cache/cabinet` directory, and run setup/build/compatibility plus
negative controls again. Keep the source-byte/catalog assertions and real
interaction assertions; do not patch the fixture to hide a regression.

## Deployment gate and live smoke

**One-time administrator migration is still required.** At implementation time,
Pages used legacy branch publishing from `main` `/`, and `main` had no branch
protection or rulesets. That publisher bypasses this workflow. Adding this code
alone does **not** enforce deployment or merge gating.

Coordinate this migration with the initial merge. **Do not merge first:** that
would let the legacy publisher deploy the initial change without the new gate.
The administrator, not the coding agent, must make the settings changes:

1. Open and review the PR, and run **Cabinet compatibility** successfully on its
   candidate before merging.
2. **Before merging**, change **Settings > Pages > Build and deployment > Source**
   to **GitHub Actions**. Confirm the `github-pages` environment permits deployments
   from `main` only; retain any desired reviewer approvals.
3. Before merging, add a main-branch rule requiring pull requests and the
   **Cabinet compatibility** status check (select it after the PR workflow runs).
   Require up-to-date branches and restrict bypasses as appropriate.
4. Merge only after those settings are in place, so the first new `main`
   deployment uses the gated workflow. Manually dispatch the workflow on `main`
   only if needed.
5. Confirm a failing compatibility run cannot reach deployment and that the
   successful workflow's public smoke finishes green.

`.github/workflows/pages.yml` builds/tests PR candidates (including forks) with
read-only repository permissions. Only canonical-repository `main` push/manual
runs can package/deploy, and `Deploy tested candidate` depends on the single
**Cabinet compatibility** job. It publishes the **exact tested `dist/` artifact**,
without rebuilding. Only the deployment job receives Pages-write and OIDC
permissions; no PR or fork run can deploy.

After deployment, **Published-site smoke** downloads that same artifact and
polls the public game HTML for byte equality for up to 90 seconds per attempt.
CI allows two retries (three attempts total) for propagation. Both direct and
iframe navigation responses must also match the candidate, preventing stale
HTML from proving a new deployment healthy. It then starts the real game through
the real cabinet, checks rendering/state, audio, reload focus, and exit cleanup.
This post-deploy signal cannot roll back a deployment; investigate failures
rather than treating iframe `load` as proof of success.

To check today's public sites without deploying anything:

```sh
npm run test:smoke
```

This baseline uses actual responses from
<https://filmgirl.github.io/arcade/#game/flappy-copilot> and
<https://filmgirl.github.io/flappy-copilot/>, with no mocks. To additionally require
the current `dist/index.html` to be the published version, run
`SMOKE_EXPECT_CANDIDATE=1 npm run test:smoke`. Local smoke runs do not retry whole
tests. The public baseline is intentionally separate from the deterministic
candidate gate; switching-frame coverage may briefly begin loading the unchanged
public sibling URL, but never asserts that sibling game's gameplay.
