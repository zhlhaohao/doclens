import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

import type { SettingsScope } from "../state/types";

@customElement("settings-scope-segment")
export class SettingsScopeSegment extends LitElement {
  @property() scope: SettingsScope = "local";
  @property({ type: Boolean }) exists = true;

  static styles = css`
    :host {
      display: flex;
      gap: var(--cortex-space-2);
      padding: var(--cortex-space-3) var(--cortex-space-4);
      background: var(--cortex-surface);
      border-bottom: 1px solid var(--cortex-border);
      flex-shrink: 0;
      font-family: var(--cortex-font);
    }
    .pill {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid var(--cortex-border);
      background: transparent;
      color: var(--cortex-text-muted);
      border-radius: var(--cortex-radius-md);
      font-family: inherit;
      font-size: var(--cortex-fs-sm);
      cursor: pointer;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
      min-height: var(--cortex-touch-target, 44px);
    }
    .pill:hover { background: var(--cortex-surface-muted); }
    .pill.active {
      background: var(--cortex-primary-soft);
      border-color: var(--cortex-primary);
      color: var(--cortex-primary);
      font-weight: 600;
    }
    .new-tag {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-warning);
      margin-left: 4px;
    }
    @media (max-width: 1023px) {
      :host {
        position: sticky;
        top: 0;
        z-index: 5;
        box-shadow: 0 1px 0 var(--cortex-border);
      }
    }
  `;

  render() {
    return html`
      <button class="pill active">🌍 全局</button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "settings-scope-segment": SettingsScopeSegment;
  }
}