# dsh-balance

Realtime model-account balance HUD for the [DeepSeek Harness (DSH) Web GUI](https://github.com/deepseek-ai/deepseek-harness):
a tech-styled floating widget that polls the DeepSeek balance endpoint, collapses to a compact pill
when you are not looking, and persists its position.

## Features

- **Tech/HUD look**: dark glass panel, neon cyan accents, HUD corner brackets, animated scanlines and a
  light sweep, monospace digits with a glow.
- **Live data**: the host half polls `GET {baseUrl}/user/balance` on a configurable cadence (default 60 s)
  and the browser half refreshes its snapshot every 5 s; a client-side sparkline shows the recent trend,
  and a force-refresh button is always available.
- **Collapse / hide**: minimize to a compact pill showing just the amount, hide to a small summon dot;
  both states remember where you left them (persisted to `~/.dsh/balance.json`).
- **Low-balance warning**: below a configurable threshold the HUD switches to the amber warning look.
- **Credentials reuse**: the API key resolves through the official credential seam
  (`DEEPSEEK_API_KEY`, the same key the deepseek-official provider uses), so the key is never stored or
  displayed by this plugin.

## How it works

One cordis plugin row mounts both halves:

- **Host half** (`src/index.ts`, `src/service.ts`, `src/routes.ts`): a `BalanceService` that resolves the
  API key through `ctx.credentials`, polls the balance endpoint with in-flight dedup and TTL caching, and
  serves the same-origin JSON API the widget talks to:
  - `GET /api/balance/state`
  - `POST /api/balance/refresh`
  - `POST /api/balance/set-display`
- **Browser half** (`src/client/*`): a single global React root on `document.body` renders the floating
  HUD (`BalanceDock.tsx`) in three forms — full panel, collapsed pill, hidden summon dot — and registers a
  settings card in the Web UI plugin group.

## Repository layout

```
.
├── packages/dsh-balance/   # the plugin package (@linxin666/dsh-balance)
│   ├── src/                # host half + client half
│   ├── tests/              # vitest unit tests
│   └── cordis.patch.yml    # loader patch (insert id: balance)
├── shared/                 # the shared tsdown client-bundle preset
└── .github/workflows/ci.yml
```

The layout mirrors the dsh-web-ui monorepo, so the plugin's build config
(`packages/dsh-balance/tsdown.config.ts`) keeps resolving `../../shared/tsdown.client.ts` unchanged.

## Development

Requirements: Node.js >= 22.19 and pnpm.

```sh
pnpm install
pnpm test          # vitest unit tests
pnpm typecheck     # tsc
pnpm build         # host lib + browser client bundle into packages/dsh-balance/lib
```

## Install into a DSH profile

```sh
pnpm build
dsh plugin --profile web add link:$(pwd)/packages/dsh-balance
# restart `dsh web`
```

The HUD appears at the bottom-right of the page. Toggle/collapse/hide from the widget itself; tune
polling and the low-balance threshold from its settings card or the `balance` settings namespace.

## Configuration

- Settings namespace `balance`: `enabled`, `visible`, `collapsed`, `right`, `bottom`, `lowThreshold`,
  `pollMs`.
- Composition layer (`plugins/balance.yml`): `apiKeyEnv`, `baseUrl`, `pollMs`, `timeoutMs`,
  `lowThreshold`, `enabled`, `persistDir`.

## License

[Apache-2.0](LICENSE)
