/** 数字员工管理区块（ADR-0062/0063）。挂在设置页「数字员工」tab。
 *
 * 列表 = 名字 + 描述 + 模型/产物路径摘要 + 预设缺失警示 + 编辑/删除（有
 * 进行中派活时删除被后端 409）。编辑表单：基本（名字/描述/专属提示词）/
 * 能力（工具白黑名单按目录勾选、技能白名单）/ 模型（工作/评审预设、思考深度）/
 * 产物（产物路径、模板）/ 评审（标准、阈值、最大迭代数）。
 * 只管理不派活——派活入口在对话页空白欢迎页的发送键菜单。
 */
import { LitElement, html, css, nothing } from "lit";

function f0(n: number): string {
  return n ? n.toLocaleString() : "不限";
}

function errMsg(e: unknown, fallback: string): string {
  if (e instanceof ApiError) return e.message || fallback;
  return (e as Error)?.message || fallback;
}
import { customElement, state } from "lit/decorators.js";
import { settingsSectionStyles } from "../styles/settings-section-styles";
import { badgeStyles } from "../styles/badge-styles";
import { formStyles } from "../styles/form-styles";
import { emptyStateStyles } from "../styles/empty-state-styles";
import { ToastFlashMixin } from "../utils/section-mixins";
import { ApiError } from "../api/client";
import {
  createEmployee,
  deleteEmployee,
  getSkillCatalog,
  getToolCatalog,
  listEmployees,
  updateEmployee,
  type Employee,
  type EmployeeInput,
  type SkillCatalogItem,
  type ToolCatalogItem,
} from "../api/employees";
import { listPresets, type Preset } from "../api/presets";
import "../components/icon";

type FormState = EmployeeInput;

function emptyForm(): FormState {
  return {
    name: "",
    description: "",
    prompt: "",
    tools_allow: ["read_file", "grep", "glob", "write_file", "edit_file", "search_kb", "read_document", "file_info", "kb_grep"],
    tools_deny: [],
    skills_allow: [],
    review_skill: "",
    model_preset_id: "",
    review_model_presets: [],
    thinking_depth: "auto",
    artifact_root: "数字员工/产物",
    template_path: null,
    review_criteria: "产物完整、准确、符合任务要求；结构清晰、可直接使用。",
    score_threshold: 90,
    max_iterations: 5,
    token_budget: 2000000,
    max_tool_rounds: 40,
  };
}

function toForm(e: Employee): FormState {
  return {
    name: e.name,
    description: e.description,
    prompt: e.prompt,
    tools_allow: [...e.tools_allow],
    tools_deny: [...e.tools_deny],
    skills_allow: [...e.skills_allow],
    review_skill: e.review_skill,
    model_preset_id: e.model_preset_id,
    review_model_presets: [...e.review_model_presets],
    thinking_depth: e.thinking_depth,
    artifact_root: e.artifact_root,
    template_path: e.template_path,
    review_criteria: e.review_criteria,
    score_threshold: e.score_threshold,
    max_iterations: e.max_iterations,
    token_budget: e.token_budget,
    max_tool_rounds: e.max_tool_rounds,
  };
}

const GROUP_LABEL: Record<ToolCatalogItem["group"], string> = { builtin: "内置工具", kb: "知识库工具", mcp: "MCP 工具" };
const THINKING_OPTIONS: { value: FormState["thinking_depth"]; label: string }[] = [
  { value: "auto", label: "跟随全局（auto）" },
  { value: "off", label: "不思考（off）——简单任务省开销" },
  { value: "low", label: "低（low）" },
  { value: "medium", label: "中（medium）" },
  { value: "high", label: "高（high）——复杂任务" },
];

@customElement("employees-section")
export class EmployeesSection extends ToastFlashMixin(LitElement) {
  static styles = [settingsSectionStyles, badgeStyles, formStyles, emptyStateStyles, css`
    :host { display: block; font-family: var(--cortex-font); color: var(--cortex-text); }
    .toolbar { display: flex; justify-content: flex-end; margin-top: var(--cortex-space-3); }
    .emp-list { display: flex; flex-direction: column; gap: var(--cortex-space-2); margin-top: var(--cortex-space-3); }
    .emp-row {
      display: flex; align-items: center; gap: var(--cortex-space-3);
      padding: var(--cortex-space-3) var(--cortex-space-4);
      border: 1px solid var(--cortex-border-muted); border-radius: var(--cortex-radius-lg);
      background: var(--cortex-surface);
    }
    .emp-main { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .emp-name { font-size: var(--cortex-fs-sm); font-weight: 600; display: flex; align-items: center; gap: 8px; }
    .emp-desc { font-size: var(--cortex-fs-xs); color: var(--cortex-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .emp-meta { font-size: var(--cortex-fs-xs); color: var(--cortex-text-subtle); font-family: var(--cortex-font-mono); }
    .emp-warn { font-size: var(--cortex-fs-xs); color: var(--cortex-danger); }
    .row-actions { display: flex; gap: 6px; flex-shrink: 0; }
    /* 表单 */
    .form { display: flex; flex-direction: column; gap: var(--cortex-space-4); margin-top: var(--cortex-space-4);
            padding: var(--cortex-space-4); border: 1px solid var(--cortex-border-muted); border-radius: var(--cortex-radius-lg); background: var(--cortex-surface); }
    .section-title { font-size: var(--cortex-fs-sm); font-weight: 600; color: var(--cortex-text); margin-top: var(--cortex-space-2);
                     padding-bottom: 4px; border-bottom: 1px solid var(--cortex-border-muted); }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--cortex-space-3); }
    .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: var(--cortex-space-3); }
    .hint { font-size: var(--cortex-fs-xs); color: var(--cortex-text-subtle); margin-top: 2px; line-height: 1.5; }
    .warn { color: var(--cortex-warning); }
    .check-groups { display: flex; flex-direction: column; gap: var(--cortex-space-2); }
    .check-group { display: flex; flex-direction: column; gap: 4px; }
    .check-group-title { font-size: var(--cortex-fs-xs); font-weight: 600; color: var(--cortex-text-muted); }
    .checks { display: flex; flex-wrap: wrap; gap: 4px 12px; max-height: 160px; overflow-y: auto; padding: 4px 0; }
    .check { display: inline-flex; align-items: center; gap: 6px; font-size: var(--cortex-fs-xs); font-family: var(--cortex-font-mono); }
    .check.forbidden { opacity: 0.45; text-decoration: line-through; }
    .check .wr { color: var(--cortex-warning); }
    .form-error { color: var(--cortex-danger); font-size: var(--cortex-fs-sm); }
    .form-actions { display: flex; justify-content: flex-end; gap: 8px; }
    @media (max-width: 1023px) { .grid2, .grid3 { grid-template-columns: 1fr; } }
  `];

  @state() private _employees: Employee[] = [];
  @state() private _tools: ToolCatalogItem[] | null = null;
  @state() private _skills: SkillCatalogItem[] | null = null;
  @state() private _presets: Preset[] = [];
  @state() private _editing: { id: string | null; form: FormState } | null = null;
  @state() private _busy = false;
  @state() private _formError: string | null = null;
  @state() private _confirmDeleteId: string | null = null;
  @state() private _loadError: string | null = null;

  connectedCallback() {
    super.connectedCallback();
    void this._load();
  }

  private async _load() {
    try {
      const [emps, presets] = await Promise.all([listEmployees(), listPresets("llm")]);
      this._employees = emps;
      this._presets = presets;
      this._loadError = null;
    } catch (e) {
      this._loadError = errMsg(e, "加载失败");
    }
    if (this._tools === null || this._skills === null) {
      try {
        const [t, s] = await Promise.all([getToolCatalog(), getSkillCatalog()]);
        this._tools = t;
        this._skills = s;
      } catch {
        /* 目录失败只影响勾选面板；表单仍可用文本 */
      }
    }
  }

  private _openNew() {
    const f = emptyForm();
    if (this._presets.length && !f.model_preset_id) f.model_preset_id = this._presets[0].id;
    this._editing = { id: null, form: f };
    this._formError = null;
  }

  private _openEdit(e: Employee) {
    this._editing = { id: e.id, form: toForm(e) };
    this._formError = null;
  }

  private _cancelEdit() {
    this._editing = null;
    this._formError = null;
  }

  private _set<K extends keyof FormState>(k: K, v: FormState[K]) {
    if (!this._editing) return;
    this._editing = { ...this._editing, form: { ...this._editing.form, [k]: v } };
  }

  private _toggleIn(list: string[], name: string): string[] {
    return list.includes(name) ? list.filter((x) => x !== name) : [...list, name];
  }

  private async _submit() {
    const ed = this._editing;
    if (!ed) return;
    const f = ed.form;
    if (!f.name.trim()) { this._formError = "请填写员工名"; return; }
    if (!f.prompt.trim()) { this._formError = "请填写专属提示词"; return; }
    if (!f.model_preset_id) { this._formError = "请选择工作模型预设"; return; }
    if (!f.review_skill) { this._formError = "请选择评审技能"; return; }
    if (!f.artifact_root.trim()) { this._formError = "请填写产物路径"; return; }
    if (!f.review_criteria.trim()) { this._formError = "请填写评审标准"; return; }
    this._busy = true;
    try {
      if (ed.id) await updateEmployee(ed.id, f);
      else await createEmployee(f);
      this._editing = null;
      await this._load();
      this._setFlash("已保存");
    } catch (e) {
      this._formError = errMsg(e, "保存失败");
    } finally {
      this._busy = false;
    }
  }

  private async _delete(e: Employee) {
    if (this._confirmDeleteId !== e.id) {
      this._confirmDeleteId = e.id;
      return;
    }
    this._confirmDeleteId = null;
    this._busy = true;
    try {
      await deleteEmployee(e.id);
      await this._load();
      this._setFlash("已删除");
    } catch (err) {
      this._setFlash(errMsg(err, "删除失败"));
    } finally {
      this._busy = false;
    }
  }

  private _presetName(id: string | null): string {
    if (!id) return "（由工作模型自评）";
    const p = this._presets.find((x) => x.id === id);
    return p ? `${p.name} · ${p.model_id ?? ""}` : "（预设缺失）";
  }

  private _renderRow(e: Employee) {
    const confirming = this._confirmDeleteId === e.id;
    return html`
      <div class="emp-row">
        <doclens-icon name="user-round" title="数字员工"></doclens-icon>
        <div class="emp-main">
          <div class="emp-name">
            ${e.name}
            <span class="badge neutral">工作 ${this._presetName(e.model_preset_id)}</span>
            <span class="badge neutral">评审 ${e.review_model_presets.length ? e.review_model_presets.map((id) => this._presetName(id)).join(" › ") : "工作模型"}</span>
            ${e.skills_missing.length ? html`<span class="badge danger">内部技能缺失：${e.skills_missing.join(", ")}</span>` : nothing}
          </div>
          <div class="emp-desc">${e.description || "（无描述）"}</div>
          <div class="emp-meta">产物 ${e.artifact_root} · 阈值 ${e.score_threshold} · 最多 ${e.max_iterations} 轮 · 预算 ${f0(e.token_budget)} token · 评审技能 ${e.review_skill}</div>
          ${e.model_missing || e.review_model_missing
            ? html`<div class="emp-warn">模型预设缺失，暂不可派活——请编辑改配</div>`
            : nothing}
          ${e.skills_missing.length ? html`<div class="emp-warn">内部技能不存在：${e.skills_missing.join(", ")}——暂不可派活</div>` : nothing}
        </div>
        <div class="row-actions">
          <button class="icon-btn" ?disabled=${this._busy} @click=${() => this._openEdit(e)}>编辑</button>
          <button class="icon-btn danger" ?disabled=${this._busy} @click=${() => this._delete(e)}>
            ${confirming ? "确认删除" : "删除"}
          </button>
        </div>
      </div>`;
  }

  private _renderChecks(list: string[], onChange: (next: string[]) => void) {
    const tools = this._tools ?? [];
    if (tools.length === 0) return html`<div class="hint">工具目录加载中…</div>`;
    const groups: Record<string, ToolCatalogItem[]> = {};
    for (const t of tools) (groups[t.group] ??= []).push(t);
    const hasShell = list.some((n) => n === "bash" || n === "powershell");
    const hasMcp = list.some((n) => n.startsWith("mcp__"));
    return html`
      <div class="check-groups">
        ${(["builtin", "kb", "mcp"] as const).map((g) => (groups[g] ?? []).length ? html`
          <div class="check-group">
            <div class="check-group-title">${GROUP_LABEL[g]}</div>
            <div class="checks">
              ${groups[g]!.map((t) => html`
                <label class="check ${t.forbidden ? "forbidden" : ""}" title=${t.forbidden ? "禁用工具：对数字员工不可用" : t.name}>
                  <input type="checkbox" ?disabled=${t.forbidden} .checked=${list.includes(t.name)}
                         @change=${() => onChange(this._toggleIn(list, t.name))} />
                  ${t.name}${t.writable ? html`<span class="wr" title="有写入能力：产物目录边界对 shell / MCP 只是纵深防御">✎</span>` : nothing}
                </label>`)}
            </div>
          </div>` : nothing)}
      </div>
      ${hasShell || hasMcp
        ? html`<div class="hint warn">已授权 ${[hasShell && "shell", hasMcp && "MCP 写入"].filter(Boolean).join(" + ")}：写入边界对其只是纵深防御（脚本内拼接路径 / MCP 独立进程写入不受硬保证）。</div>`
        : nothing}
    `;
  }

  private _renderSkillChecks(list: string[], key: "skills_allow") {
    const skills = this._skills;
    if (skills === null) return html`<div class="hint">内部技能目录加载中…</div>`;
    if (skills.length === 0) {
      return html`<div class="hint">内部技能库为空。把 SKILL.md 放到 <code>~/.doclens/employee_skills/&lt;技能名&gt;/</code>（发行版；开发版 <code>~/.cortex/</code>）后刷新本页。</div>`;
    }
    return html`
      <div class="checks">
        ${skills.map((s) => html`
          <label class="check" title=${s.description || s.name}>
            <input type="checkbox" .checked=${list.includes(s.name)}
                   @change=${() => this._set(key, this._toggleIn(list, s.name))} />
            ${s.name}
          </label>`)}
      </div>`;
  }

  private _renderForm() {
    const ed = this._editing;
    if (!ed) return nothing;
    const f = ed.form;
    const set = <K extends keyof FormState>(k: K) => (e: Event) => {
      const t = e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      const num = (k: string) => k === "score_threshold" || k === "max_iterations" || k === "token_budget" || k === "max_tool_rounds";
      this._set(k, (num(k) ? Number(t.value) : t.value) as FormState[K]);
    };
    const presetOptions = html`
      ${this._presets.length === 0 ? html`<option value="">（无 LLM 预设——请先在「模型」tab 新建）</option>` : nothing}
      ${this._presets.map((p) => html`<option value=${p.id} ?selected=${p.id === f.model_preset_id}>${p.name} · ${p.model_id ?? ""}</option>`)}
    `;
    return html`
      <div class="form">
        <div class="section-title">基本</div>
        <div class="grid2">
          <div>
            <div class="field-label">名字（唯一，不含空白）</div>
            <input class="input" autocomplete="off" .value=${f.name} @input=${set("name")} placeholder="tom" />
          </div>
          <div>
            <div class="field-label">一句话描述（选择对话框展示）</div>
            <input class="input" autocomplete="off" .value=${f.description} @input=${set("description")} placeholder="调研员：联网查资料、写带来源的调研报告" />
          </div>
        </div>
        <div>
          <div class="field-label">专属提示词（是谁、怎么干活）</div>
          <textarea class="textarea" rows="6" .value=${f.prompt} @input=${set("prompt")}
                    placeholder="你是一名调研员。先列提纲，再逐项查证，最后写成带来源的报告……"></textarea>
          <div class="hint">追加在精简基础提示词之后；工具使用规则由系统提供。</div>
        </div>

        <div class="section-title">能力</div>
        <div>
          <div class="field-label">工作技能白名单（内部技能库；员工在回合里按需 load_skill；白名单外技能不可加载）</div>
          ${this._renderSkillChecks(f.skills_allow, "skills_allow")}
        </div>
        <div>
          <div class="field-label">工具白名单（空 = 全部可用，再减去黑名单与禁用工具）</div>
          ${this._renderChecks(f.tools_allow, (next) => this._set("tools_allow", next))}
        </div>
        <div>
          <div class="field-label">工具黑名单（永远不许；优先于白名单）</div>
          ${this._renderChecks(f.tools_deny, (next) => this._set("tools_deny", next))}
        </div>

        <div class="section-title">模型</div>
        <div class="grid3">
          <div>
            <div class="field-label">工作模型预设</div>
            <select class="select" .value=${f.model_preset_id} @change=${set("model_preset_id")}>${presetOptions}</select>
          </div>
          <div>
            <div class="field-label">评审技能（内部技能库，必填）</div>
            <select class="select" .value=${f.review_skill} @change=${set("review_skill")}>
              <option value="">（请选择）</option>
              ${(this._skills ?? []).map((sk) => html`<option value=${sk.name} ?selected=${sk.name === f.review_skill} title=${sk.description}>${sk.name}</option>`)}
            </select>
            <div class="hint">评审回合由员工加载该技能评审产物；引用的技能不存在则派活失败。</div>
          </div>
          <div>
            <div class="field-label">思考深度</div>
            <select class="select" .value=${f.thinking_depth} @change=${set("thinking_depth")}>
              ${THINKING_OPTIONS.map((o) => html`<option value=${o.value} ?selected=${o.value === f.thinking_depth}>${o.label}</option>`)}
            </select>
          </div>
        </div>
        <div>
          <div class="field-label">评审模型有序清单（按序尝试，首个不可用顺延；留空 = 用工作模型评审）</div>
          <div class="checks">
            ${this._presets.map((p) => html`
              <label class="check" title=${p.model_id ?? ""}>
                <input type="checkbox" .checked=${f.review_model_presets.includes(p.id)}
                       @change=${() => this._set("review_model_presets", this._toggleIn(f.review_model_presets, p.id))} />
                ${p.name}
              </label>`)}
          </div>
          ${f.review_model_presets.length
            ? html`<div class="hint">顺序：${f.review_model_presets.map((id) => this._presetName(id)).join(" › ")}</div>`
            : html`<div class="hint">当前：用工作模型评审</div>`}
        </div>

        <div class="section-title">产物</div>
        <div class="grid2">
          <div>
            <div class="field-label">产物路径（相对知识库工作目录；每次派活在其下新建子目录）</div>
            <input class="input mono" autocomplete="off" .value=${f.artifact_root} @input=${set("artifact_root")} placeholder="调研" />
          </div>
          <div>
            <div class="field-label">产物模板（相对工作目录的文件或目录；可空）</div>
            <input class="input mono" autocomplete="off" .value=${f.template_path ?? ""} @input=${(e: Event) => this._set("template_path", ((e.target as HTMLInputElement).value || null))} placeholder="模板/周报模板.docx" />
            <div class="hint">派活开始时整体拷入产物目录；模板拷贝不计入评审。</div>
          </div>
        </div>

        <div class="section-title">评审</div>
        <div>
          <div class="field-label">评审标准（什么是好产物；输出格式由系统提供）</div>
          <textarea class="textarea" rows="4" .value=${f.review_criteria} @input=${set("review_criteria")}></textarea>
        </div>
        <div class="grid2">
          <div>
            <div class="field-label">分数阈值（0–100）</div>
            <input class="input" type="number" min="0" max="100" .value=${String(f.score_threshold)} @input=${set("score_threshold")} />
          </div>
          <div>
            <div class="field-label">最大迭代数（工作回合 + 评审回合 = 1 轮）</div>
            <input class="input" type="number" min="1" max="50" .value=${String(f.max_iterations)} @input=${set("max_iterations")} />
          </div>
        </div>
        <div class="section-title">停止条件</div>
        <div class="grid2">
          <div>
            <div class="field-label">消耗预算（token；工作 + 评审回合全算；超出即终止；0 = 不限）</div>
            <input class="input" type="number" min="0" step="100000" .value=${String(f.token_budget)} @input=${set("token_budget")} />
            <div class="hint">默认 200 万；80% 时在返工指令里预警员工尽快收尾。</div>
          </div>
          <div>
            <div class="field-label">单回合工具调用上限（防一个回合内死循环；达到后强制终答；0 = 不限）</div>
            <input class="input" type="number" min="0" .value=${String(f.max_tool_rounds)} @input=${set("max_tool_rounds")} />
          </div>
        </div>

        ${this._formError ? html`<div class="form-error">${this._formError}</div>` : nothing}
        <div class="form-actions">
          <button class="icon-btn" ?disabled=${this._busy} @click=${() => this._cancelEdit()}>取消</button>
          <button class="icon-btn primary" ?disabled=${this._busy} @click=${() => this._submit()}>
            ${this._busy ? "保存中…" : "保存"}
          </button>
        </div>
      </div>`;
  }

  render() {
    return html`
      <div class="section-head">
        <div>
          <div class="section-title-main">数字员工</div>
          <div class="section-desc">
            自驱的工作单元：给一句话任务，它在独立会话里工作 → 评审产物打分 → 按意见返工，达标自动结束。
            派活入口在对话页空白欢迎页的发送键菜单「选择员工…」。
          </div>
        </div>
      </div>
      ${this._toast ? html`<div class="msg ok">${this._toast}</div>` : nothing}
      ${this._loadError ? html`<div class="form-error">${this._loadError}</div>` : nothing}
      ${this._editing ? this._renderForm() : nothing}
      <div class="toolbar">
        <button class="icon-btn primary" @click=${() => this._openNew()}>+ 新建员工</button>
      </div>
      <div class="emp-list">
        ${this._employees.length === 0 && !this._loadError
          ? html`<div class="empty">还没有数字员工。点「新建员工」开始——先配置提示词、模型与产物路径，再到对话页派活。</div>`
          : this._employees.map((e) => this._renderRow(e))}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { "employees-section": EmployeesSection; }
}
