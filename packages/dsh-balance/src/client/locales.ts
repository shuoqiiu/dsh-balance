/**
 * dsh-balance locale dictionaries (zh/en).
 * @module @linxin666/dsh-balance/client/locales
 */

/** Dictionary namespace this package registers. */
export const NS = 'balance'

/** Chinese copy. */
export const zh = {
  'balance.title': '模型账户余额',
  'balance.engTitle': 'MODEL BALANCE MONITOR',
  'balance.total': '总余额',
  'balance.granted': '赠送余额',
  'balance.toppedUp': '充值余额',
  'balance.updated': '更新于 {time}',
  'balance.refresh': '刷新',
  'balance.collapse': '收起',
  'balance.expand': '展开',
  'balance.hide': '隐藏',
  'balance.summon': '余额',
  'balance.lowBadge': '余额不足',
  'balance.stale': '数据延迟',
  'balance.state.loading': '正在连接余额接口…',
  'balance.state.error': '获取失败：{error}',
  'balance.state.unconfigured': '未配置 API Key：{error}',
  'balance.neverUpdated': '尚未更新',
  // 插件设置卡片（web-ui.plugin.item 席位）。
  'settings.title': '余额悬浮窗',
  'settings.description': '悬浮窗的显示布局与轮询、告警参数。',
  'settings.enabled': '启用插件',
  'settings.enabledHint': '关闭后隐藏悬浮窗并停止轮询，可在设置里重新启用。',
  'settings.visible': '显示悬浮窗',
  'settings.visibleHint': '关闭后悬浮窗隐藏，仅留一个小的唤回圆点。',
  'settings.collapsed': '默认收起',
  'settings.collapsedHint': '开启后悬浮窗以紧凑胶囊形态显示，点击展开。',
  'settings.right': '距右侧（px）',
  'settings.rightHint': '距视口右边缘的水平内缩距离。',
  'settings.bottom': '距底部（px）',
  'settings.bottomHint': '距视口底边的垂直内缩距离。',
  'settings.lowThreshold': '低余额阈值',
  'settings.lowThresholdHint': '总余额低于该值时悬浮窗切换为告警配色。',
  'settings.pollMs': '轮询间隔（ms）',
  'settings.pollMsHint': '拉取余额接口的间隔，范围 10000–600000。',
  'settings.inherit': '继承',
  'settings.on': '开',
  'settings.off': '关',
  'settings.overridden': '已覆盖',
  'settings.reset': '恢复默认',
  'settings.notExposed': '当前 DSH 版本未向设置页暴露本插件的配置命名空间，表单不可用。可编辑 ~/.dsh/settings.yaml 直接配置，或为 dsh-host-apiproxy 的 WEB_SETTINGS_NAMESPACES 白名单补充本命名空间后重启。',
  'settings.readOnly': '当前部署的设置只读。',
  'settings.expand': '展开设置',
  'settings.collapse': '收起设置',
  'settings.save': '保存',
  'settings.saving': '保存中…',
  'settings.discard': '放弃',
  'settings.unsaved': '未保存',
  'settings.saveFailed': '部署未接受这些值，已保留供你修改。',
  'settings.invalidNumber': '请输入数字，留空则使用默认值。',
} as const

/** English copy. */
export const en = {
  'balance.title': 'Model Balance',
  'balance.engTitle': 'MODEL BALANCE MONITOR',
  'balance.total': 'Total',
  'balance.granted': 'Granted',
  'balance.toppedUp': 'Topped up',
  'balance.updated': 'Updated {time}',
  'balance.refresh': 'Refresh',
  'balance.collapse': 'Collapse',
  'balance.expand': 'Expand',
  'balance.hide': 'Hide',
  'balance.summon': 'Balance',
  'balance.lowBadge': 'Low balance',
  'balance.stale': 'Data delayed',
  'balance.state.loading': 'Connecting to the balance endpoint…',
  'balance.state.error': 'Fetch failed: {error}',
  'balance.state.unconfigured': 'No API key: {error}',
  'balance.neverUpdated': 'Not updated yet',
  // Plugin settings card (the `web-ui.plugin.item` seat).
  'settings.title': 'Balance HUD',
  'settings.description': 'The HUD\u2019s layout and its poll/warning tuning.',
  'settings.enabled': 'Enable the plugin',
  'settings.enabledHint': 'When off, the HUD hides and polling stops; re-enable it here.',
  'settings.visible': 'Show the HUD',
  'settings.visibleHint': 'When off, only a small summon dot remains.',
  'settings.collapsed': 'Collapsed by default',
  'settings.collapsedHint': 'When on, the HUD starts as the compact pill; click to expand.',
  'settings.right': 'Right inset (px)',
  'settings.rightHint': 'Horizontal inset from the viewport right edge.',
  'settings.bottom': 'Bottom inset (px)',
  'settings.bottomHint': 'Vertical inset from the viewport bottom edge.',
  'settings.lowThreshold': 'Low-balance threshold',
  'settings.lowThresholdHint': 'Below this total the HUD switches to the warning look.',
  'settings.pollMs': 'Poll interval (ms)',
  'settings.pollMsHint': 'How often the balance endpoint is polled, 10000\u2013600000.',
  'settings.inherit': 'Inherit',
  'settings.on': 'On',
  'settings.off': 'Off',
  'settings.overridden': 'Overridden',
  'settings.reset': 'Reset to default',
  'settings.notExposed': 'This DSH version does not expose this plugin\'s settings namespace to the configuration page, so the form is unavailable. Edit ~/.dsh/settings.yaml directly, or add the namespace to dsh-host-apiproxy\'s WEB_SETTINGS_NAMESPACES allowlist and restart.',
  'settings.readOnly': 'This deployment stores settings read-only.',
  'settings.expand': 'Show settings',
  'settings.collapse': 'Hide settings',
  'settings.save': 'Save',
  'settings.saving': 'Saving\u2026',
  'settings.discard': 'Discard',
  'settings.unsaved': 'Unsaved',
  'settings.saveFailed': 'The deployment did not accept these values; they were left for you to correct.',
  'settings.invalidNumber': 'Enter a number, or leave blank to use the default.',
} as const

/** Key union for this namespace. */
export type BalanceKey = keyof typeof zh

/** The settings-card slice of the balance dictionary. */
export type SettingsCardKey = BalanceKey

/**
 * Active dictionary, picked by the document language at call time. The HUD
 * mounts as a global floating surface (not a session-scoped slot), so it has
 * no framework locale seat and resolves its copy the same tiny way the
 * pet does.
 */
export function dictionary(): Record<BalanceKey, string> {
  const lang = typeof document !== 'undefined' ? document.documentElement.lang : 'zh'
  return lang.toLowerCase().startsWith('en') ? en : zh
}

/**
 * Translate a key with optional `{name}` template params. Mirrors the slot
 * `Translate` contract so it can be handed to the same components that used
 * to receive the framework-injected `t` seat.
 */
export function t(key: string, params?: Record<string, unknown>): string {
  let text: string = (dictionary() as Record<string, string>)[key] ?? key
  if (params !== undefined) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{${name}}`, String(value))
    }
  }
  return text
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** dsh-balance UI copy. */
    balance: BalanceKey
  }
}
