# dsh-balance

DSH Web GUI 的模型账户余额实时悬浮窗：科技感 HUD 风格，实时拉取 DeepSeek
余额接口（`GET {baseUrl}/user/balance`），不看时可以收成紧凑胶囊，位置持久保存。

## 功能

- 科技感 HUD 外观：深色玻璃面板、霓虹青色描边、四角 HUD 角标、扫描线与光带动画、
  等宽数字辉光。
- 实时数据：宿主按可配置周期轮询余额接口（默认 60 秒），悬浮窗每 5 秒刷新快照；
  客户端小窗趋势线展示近期变化，另有手动强制刷新按钮。
- 收起 / 隐藏：一键收成只显示金额的胶囊，再一键隐藏为小唤回圆点；两种形态都记住
  你拖到的位置。
- 低余额告警：总余额低于阈值时切换为琥珀色警示配色。
- 密钥复用：API Key 走官方凭证通道解析（`DEEPSEEK_API_KEY`，与
  deepseek-official 提供商共用同一把钥匙），本插件不存储、不展示密钥。

## 安装

```sh
# 从 npm 安装（发布后）：
dsh plugin --profile web add @linxin666/dsh-balance

# 从本地仓库安装（开发调试）：
pnpm -r --filter @linxin666/dsh-balance build
node scripts/link-profile.mjs
dsh plugin --profile web add link:$(pwd)/packages/dsh-balance
```

安装后重启 `dsh web`，悬浮窗出现在页面右下角。

## 配置

- 设置命名空间 `balance`（宿主暴露时，可在 Web UI 插件组设置卡中修改）：
  `enabled`、`visible`、`collapsed`、`right`、`bottom`、`lowThreshold`、`pollMs`。
- 组合层（`plugins/balance.yml`）：`apiKeyEnv`、`baseUrl`、`pollMs`、`timeoutMs`、
  `lowThreshold`、`enabled`、`persistDir`。
- 布局（拖拽 / 收起 / 隐藏）持久化到 `~/.dsh/balance.json`（或
  `$DSH_HOME/balance.json`）。

## 开发

```sh
pnpm --filter @linxin666/dsh-balance build     # tsc + tsdown（宿主 lib + 客户端 bundle）
pnpm --filter @linxin666/dsh-balance test      # vitest 单元测试
```

浏览器端通过同源 JSON 接口与宿主通信（`GET /api/balance/state`、
`POST /api/balance/refresh`、`POST /api/balance/set-display`），路由模式与 dsh-pet
一致。

## 注意

将来本包随 `dsh-web-ui-all` 聚合包发布后，请删除 profile 自身 `cordis.patch.yml`
里的独立 `balance` insert 行，避免插件 id 重复。
