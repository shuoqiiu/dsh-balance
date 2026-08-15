# dsh-balance

Realtime model-account balance HUD for the DSH Web GUI: a tech-styled floating widget
that polls the DeepSeek balance endpoint (`GET {baseUrl}/user/balance`), collapses to a
compact pill when you are not looking, and persists its position.

## Features

- Tech/HUD look: dark glass panel, neon cyan accents, HUD corner brackets, animated
  scanlines and a light sweep, monospace digits with a glow.
- Live data: the host polls the balance endpoint on a configurable cadence (default 60 s)
  and the widget refreshes its snapshot every 5 s; a client-side sparkline shows the
  recent trend, and a force-refresh button is always available.
- Collapse / hide: minimize to a compact pill showing just the amount, hide to a small
  summon dot; both states remember where you left them.
- Low-balance warning: below a configurable threshold the HUD switches to the amber
  warning look.
- Credentials reuse: the API key resolves through the official credential seam
  (`DEEPSEEK_API_KEY`, the same key the deepseek-official provider uses), so the key is
  never stored or displayed by this plugin.

## Install

```sh
# from npm (once published):
dsh plugin --profile web add @linxin666/dsh-balance

# or from a local checkout (development):
pnpm -r --filter @linxin666/dsh-balance build
node scripts/link-profile.mjs
dsh plugin --profile web add link:$(pwd)/packages/dsh-balance
```

Restart `dsh web` afterwards. The HUD appears at the bottom-right of the page.

## Configuration

- Settings namespace `balance` (visible in the Web UI plugin group settings card when
  the host exposes it): `enabled`, `visible`, `collapsed`, `right`, `bottom`,
  `lowThreshold`, `pollMs`.
- Composition layer (`plugins/balance.yml`): `apiKeyEnv`, `baseUrl`, `pollMs`,
  `timeoutMs`, `lowThreshold`, `enabled`, `persistDir`.
- Display layout (drag / collapse / hide) persists to `~/.dsh/balance.json` (or
  `$DSH_HOME/balance.json`).

## Development

```sh
pnpm --filter @linxin666/dsh-balance build     # tsc + tsdown (host lib + client bundle)
pnpm --filter @linxin666/dsh-balance test      # vitest unit tests
```

The browser half talks to the host through same-origin JSON endpoints
(`GET /api/balance/state`, `POST /api/balance/refresh`,
`POST /api/balance/set-display`) — the same route pattern as dsh-pet.

## Note

When this package ships inside the `dsh-web-ui-all` aggregate (future releases), remove
any standalone `balance` insert row from the profile's own `cordis.patch.yml` to avoid a
duplicate plugin id.
