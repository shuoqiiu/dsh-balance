/**
 * The balance settings card: HUD layout plus poll/warning tuning, bound to
 * the `balance` settings namespace the host plugin registers. Registered
 * into the `web-ui.plugin.item` slot the Web UI plugin group renders.
 */

import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SettingsScope, SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import { PluginSettingsCard, ValueField, BooleanField } from './PluginSettingsCard.tsx'
import { CardForm, booleanField, numberField, type CardActions, type CardShell, type FieldState as CardFieldState } from './settings-form.ts'

/** The balance settings fields this card edits (the namespace's full schema). */
export interface BalanceSettings {
  /** Master switch for the plugin. */
  enabled?: boolean
  /** Master switch. */
  visible?: boolean
  /** Collapse to the compact pill. */
  collapsed?: boolean
  /** Horizontal inset from the viewport right edge, px. */
  right?: number
  /** Vertical inset from the viewport bottom edge, px. */
  bottom?: number
  /** Low-balance warning threshold. */
  lowThreshold?: number
  /** Upstream poll cadence, ms. */
  pollMs?: number
}

/** What the balance settings card renders. */
export interface BalanceSettingsCardState extends CardShell {
  /** Plugin master switch. */
  enabled: CardFieldState
  /** Master switch. */
  visible: CardFieldState
  /** Collapse to pill. */
  collapsed: CardFieldState
  /** Right inset. */
  right: CardFieldState
  /** Bottom inset. */
  bottom: CardFieldState
  /** Low-balance threshold. */
  lowThreshold: CardFieldState
  /** Poll cadence. */
  pollMs: CardFieldState
}

/** The registration-side face the card's slot entry injects. */
export interface BalanceSettingsCardFace extends CardActions {
  hooks: {
    /** Card snapshot bound by the renderer as useBalanceSettingsCard. */
    balanceSettingsCard: SnapshotStore<BalanceSettingsCardState>
  }
}

/** Bridges the `balance` scope onto the card's staged form. */
export class BalanceSettingsCardController {
  private readonly form: CardForm<BalanceSettings>
  private readonly store: SnapshotStore<BalanceSettingsCardState>

  /** @param scope - the bound settings scope for the `balance` namespace. */
  constructor(scope: SettingsScope<BalanceSettings>) {
    this.form = new CardForm(scope, [
      booleanField('enabled'),
      booleanField('visible'),
      booleanField('collapsed'),
      numberField('right'),
      numberField('bottom'),
      numberField('lowThreshold'),
      numberField('pollMs'),
    ])
    this.store = this.form.bind(() => this.projection())
  }

  private projection(): BalanceSettingsCardState {
    return {
      ...this.form.shell(),
      enabled: this.form.field('enabled'),
      visible: this.form.field('visible'),
      collapsed: this.form.field('collapsed'),
      right: this.form.field('right'),
      bottom: this.form.field('bottom'),
      lowThreshold: this.form.field('lowThreshold'),
      pollMs: this.form.field('pollMs'),
    }
  }

  /**
   * Build the face the card's slot registration injects.
   * @returns the card's snapshot and its form actions.
   */
  inject(): BalanceSettingsCardFace {
    return { hooks: { balanceSettingsCard: this.store }, ...this.form.actions() }
  }
}

/** Props the renderer binds for the balance settings card. */
export type BalanceSettingsCardProps =
  PropsRuntime<'web-ui.plugin.item'>
  & PropsLocale<'balance'>
  & InjectFace<BalanceSettingsCardFace>

/**
 * Render the balance settings card.
 * @param props - locale copy, the card snapshot, and its form actions.
 * @returns the card.
 */
export function BalanceSettingsCard(props: BalanceSettingsCardProps) {
  const { t } = props
  const state = props.useBalanceSettingsCard(snapshot => snapshot)
  const disabled = !state.writable
  const fieldProps = {
    overriddenLabel: t('settings.overridden'),
    resetLabel: t('settings.reset'),
    invalidLabel: t('settings.invalidNumber'),
    disabled,
  }
  return (
    <PluginSettingsCard
      t={t}
      titleKey="settings.title"
      descriptionKey="settings.description"
      state={state}
      onSave={props.save}
      onDiscard={props.discard}
    >
      <BooleanField
        id="settings-balance-enabled"
        label={t('settings.enabled')}
        hint={t('settings.enabledHint')}
        inheritLabel={t('settings.inherit')}
        onLabel={t('settings.on')}
        offLabel={t('settings.off')}
        {...fieldProps}
        {...state.enabled}
        onEdit={(text) => { props.edit('enabled', text) }}
        onReset={() => { props.resetField('enabled') }}
      />
      <BooleanField
        id="settings-balance-visible"
        label={t('settings.visible')}
        hint={t('settings.visibleHint')}
        inheritLabel={t('settings.inherit')}
        onLabel={t('settings.on')}
        offLabel={t('settings.off')}
        {...fieldProps}
        {...state.visible}
        onEdit={(text) => { props.edit('visible', text) }}
        onReset={() => { props.resetField('visible') }}
      />
      <BooleanField
        id="settings-balance-collapsed"
        label={t('settings.collapsed')}
        hint={t('settings.collapsedHint')}
        inheritLabel={t('settings.inherit')}
        onLabel={t('settings.on')}
        offLabel={t('settings.off')}
        {...fieldProps}
        {...state.collapsed}
        onEdit={(text) => { props.edit('collapsed', text) }}
        onReset={() => { props.resetField('collapsed') }}
      />
      <ValueField
        id="settings-balance-right"
        label={t('settings.right')}
        hint={t('settings.rightHint')}
        numeric
        {...fieldProps}
        {...state.right}
        onEdit={(text) => { props.edit('right', text) }}
        onReset={() => { props.resetField('right') }}
      />
      <ValueField
        id="settings-balance-bottom"
        label={t('settings.bottom')}
        hint={t('settings.bottomHint')}
        numeric
        {...fieldProps}
        {...state.bottom}
        onEdit={(text) => { props.edit('bottom', text) }}
        onReset={() => { props.resetField('bottom') }}
      />
      <ValueField
        id="settings-balance-lowThreshold"
        label={t('settings.lowThreshold')}
        hint={t('settings.lowThresholdHint')}
        numeric
        {...fieldProps}
        {...state.lowThreshold}
        onEdit={(text) => { props.edit('lowThreshold', text) }}
        onReset={() => { props.resetField('lowThreshold') }}
      />
      <ValueField
        id="settings-balance-pollMs"
        label={t('settings.pollMs')}
        hint={t('settings.pollMsHint')}
        numeric
        {...fieldProps}
        {...state.pollMs}
        onEdit={(text) => { props.edit('pollMs', text) }}
        onReset={() => { props.resetField('pollMs') }}
      />
    </PluginSettingsCard>
  )
}
