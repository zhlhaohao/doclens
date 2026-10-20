/** 编辑器语言包懒加载映射（ADR-0046 编辑态分词）。
 *
 * 编辑态的语法解析在**前端本地**完成（CodeMirror 内置的 Lezer 解析器），
 * 后端不送 token 流——那条链路只服务预览态行号视图（ADR-0032）。
 *
 * 全部语言包**懒加载**（动态 import）：不进首屏 bundle，只在真正打开
 * 对应类型文件时才拉取。核心 CM6（105KB gzip）之外，各语言包独立成 chunk。
 *
 * 两类语言包，导出形态不同，加载器统一归一为 CM6 扩展：
 * - `@codemirror/lang-*`（主力包）：导出 `LanguageSupport` 或工厂函数；
 * - `@codemirror/legacy-modes`（旧语言包）：导出 `StreamParser`，需用
 *   `StreamLanguage.define()` 包一层才是扩展。
 *
 * ⚠ **本模块必须零静态依赖 CM6**：legacy-modes 的 `StreamParser` → 扩展
 * 的转换需要 `@codemirror/language` 的 `StreamLanguage`，而该包是单文件
 * 2517 行——静态 import 会把整个 language 包拖进主 bundle，抵消「懒加载」
 * 的意义。转换因此下沉到懒加载的 `cm-core.ts`（本模块只产出「加载器 +
 * 归一标记」，不接触 CM6 类型）。
 *
 * 语言包清单 = 主力包 + legacy-modes。后者覆盖 shell/sql/ruby/lua/perl/r/
 * swift/kotlin/scala/clojure/haskell/toml/powershell/c-family/vb/groovy/
 * dart/julia/erlang/xml/yaml/dockerfile 等；**不覆盖** PHP / Elixir / Nim /
 * Zig / Terraform / GraphQL——这些文件编辑态降级为无高亮纯文本（预览态
 * 不受影响，仍由后端 Pygments 高亮）。
 */

/**
 * 语言包加载结果。
 *
 * - `kind: "ext"`：已是 CM6 扩展（主力包）。
 * - `kind: "stream"`：legacy-modes 的 `StreamParser` 原始解析器，需由
 *   懒加载的 cm-core 用 `StreamLanguage.define()` 包装。
 */
export type LangResult =
  | { kind: "ext"; value: unknown }
  | { kind: "stream"; value: unknown };

/** 语言包加载器：返回该语言的原始导出（尚未归一为扩展）。 */
export type LangLoader = () => Promise<LangResult>;

/**
 * 主力包（`@codemirror/lang-*`）的导出形态是联合类型：可能是扩展本身、
 * 扩展数组，或是「返回扩展的工厂函数」（如 `javascript()` /
 * `markdown()`）。这里归一为「已是扩展」。
 */
function ext(value: unknown): LangResult {
  if (typeof value === "function") {
    return { kind: "ext", value: (value as () => unknown)() };
  }
  return { kind: "ext", value };
}

/**
 * legacy-modes 的加载器包装：标记为 stream，由 cm-core 用
 * `StreamLanguage.define()` 转换。
 */
function stream(
  load: () => Promise<Record<string, unknown>>,
  key: string,
): LangLoader {
  return async () => {
    const mod = await load();
    return { kind: "stream", value: mod[key] };
  };
}

/**
 * 后缀 → 语言包加载器。
 *
 * 键一律小写、带前导点。查表时若直接后缀未命中，会退到「去掉最后一段」
 * 的形式（.d.ts → .ts），让 TS 声明文件复用 ts 语言。
 */
const LANG_LOADERS: Record<string, LangLoader> = {
  // --- Markdown ---
  ".md": () => import("@codemirror/lang-markdown").then((m) => ext(m.markdown())),
  ".markdown": () => import("@codemirror/lang-markdown").then((m) => ext(m.markdown())),
  ".mdx": () => import("@codemirror/lang-markdown").then((m) => ext(m.markdown())),

  // --- 主力语言包 ---
  ".py": () => import("@codemirror/lang-python").then((m) => ext(m.python)),
  ".pyi": () => import("@codemirror/lang-python").then((m) => ext(m.python)),
  ".pyw": () => import("@codemirror/lang-python").then((m) => ext(m.python)),
  ".js": () => import("@codemirror/lang-javascript").then((m) => ext(m.javascript())),
  ".jsx": () => import("@codemirror/lang-javascript").then((m) => ext(m.javascript({ jsx: true }))),
  ".mjs": () => import("@codemirror/lang-javascript").then((m) => ext(m.javascript())),
  ".cjs": () => import("@codemirror/lang-javascript").then((m) => ext(m.javascript())),
  ".ts": () => import("@codemirror/lang-javascript").then((m) => ext(m.javascript({ typescript: true }))),
  ".mts": () => import("@codemirror/lang-javascript").then((m) => ext(m.javascript({ typescript: true }))),
  ".cts": () => import("@codemirror/lang-javascript").then((m) => ext(m.javascript({ typescript: true }))),
  ".tsx": () => import("@codemirror/lang-javascript").then((m) => ext(m.javascript({ typescript: true, jsx: true }))),
  ".json": () => import("@codemirror/lang-json").then((m) => ext(m.json())),
  ".jsonc": () => import("@codemirror/lang-json").then((m) => ext(m.json())),
  ".html": () => import("@codemirror/lang-html").then((m) => ext(m.html())),
  ".htm": () => import("@codemirror/lang-html").then((m) => ext(m.html())),
  ".vue": () => import("@codemirror/lang-html").then((m) => ext(m.html())),
  ".svelte": () => import("@codemirror/lang-html").then((m) => ext(m.html())),
  ".css": () => import("@codemirror/lang-css").then((m) => ext(m.css())),
  ".scss": () => import("@codemirror/lang-css").then((m) => ext(m.css())),
  ".less": () => import("@codemirror/lang-css").then((m) => ext(m.css())),
  ".rs": () => import("@codemirror/lang-rust").then((m) => ext(m.rust())),
  ".go": () => import("@codemirror/lang-go").then((m) => ext(m.go())),
  ".yaml": () => import("@codemirror/lang-yaml").then((m) => ext(m.yaml())),
  ".yml": () => import("@codemirror/lang-yaml").then((m) => ext(m.yaml())),

  // --- legacy-modes：旧语言包（StreamParser → StreamLanguage） ---
  ".sh": stream(() => import("@codemirror/legacy-modes/mode/shell"), "shell"),
  ".bash": stream(() => import("@codemirror/legacy-modes/mode/shell"), "shell"),
  ".zsh": stream(() => import("@codemirror/legacy-modes/mode/shell"), "shell"),
  ".fish": stream(() => import("@codemirror/legacy-modes/mode/shell"), "shell"),
  ".bat": stream(() => import("@codemirror/legacy-modes/mode/shell"), "shell"),
  ".cmd": stream(() => import("@codemirror/legacy-modes/mode/shell"), "shell"),
  ".sql": stream(() => import("@codemirror/legacy-modes/mode/sql"), "sql"),
  ".rb": stream(() => import("@codemirror/legacy-modes/mode/ruby"), "ruby"),
  ".lua": stream(() => import("@codemirror/legacy-modes/mode/lua"), "lua"),
  ".pl": stream(() => import("@codemirror/legacy-modes/mode/perl"), "perl"),
  ".pm": stream(() => import("@codemirror/legacy-modes/mode/perl"), "perl"),
  ".r": stream(() => import("@codemirror/legacy-modes/mode/r"), "r"),
  ".jl": stream(() => import("@codemirror/legacy-modes/mode/julia"), "julia"),
  ".swift": stream(() => import("@codemirror/legacy-modes/mode/swift"), "swift"),
  ".kt": stream(() => import("@codemirror/legacy-modes/mode/clike"), "kotlin"),
  ".kts": stream(() => import("@codemirror/legacy-modes/mode/clike"), "kotlin"),
  ".scala": stream(() => import("@codemirror/legacy-modes/mode/clike"), "scala"),
  ".clj": stream(() => import("@codemirror/legacy-modes/mode/clojure"), "clojure"),
  ".cljs": stream(() => import("@codemirror/legacy-modes/mode/clojure"), "clojure"),
  ".edn": stream(() => import("@codemirror/legacy-modes/mode/clojure"), "clojure"),
  ".hs": stream(() => import("@codemirror/legacy-modes/mode/haskell"), "haskell"),
  ".toml": stream(() => import("@codemirror/legacy-modes/mode/toml"), "toml"),
  ".ps1": stream(() => import("@codemirror/legacy-modes/mode/powershell"), "powerShell"),
  ".psm1": stream(() => import("@codemirror/legacy-modes/mode/powershell"), "powerShell"),
  ".c": stream(() => import("@codemirror/legacy-modes/mode/clike"), "c"),
  ".h": stream(() => import("@codemirror/legacy-modes/mode/clike"), "c"),
  ".cpp": stream(() => import("@codemirror/legacy-modes/mode/clike"), "cpp"),
  ".cc": stream(() => import("@codemirror/legacy-modes/mode/clike"), "cpp"),
  ".cxx": stream(() => import("@codemirror/legacy-modes/mode/clike"), "cpp"),
  ".hpp": stream(() => import("@codemirror/legacy-modes/mode/clike"), "cpp"),
  ".hh": stream(() => import("@codemirror/legacy-modes/mode/clike"), "cpp"),
  ".cs": stream(() => import("@codemirror/legacy-modes/mode/clike"), "csharp"),
  ".java": stream(() => import("@codemirror/legacy-modes/mode/clike"), "java"),
  ".dart": stream(() => import("@codemirror/legacy-modes/mode/clike"), "dart"),
  ".groovy": stream(() => import("@codemirror/legacy-modes/mode/groovy"), "groovy"),
  ".vb": stream(() => import("@codemirror/legacy-modes/mode/vb"), "vb"),
  ".m": stream(() => import("@codemirror/legacy-modes/mode/clike"), "objectiveC"),
  ".mm": stream(() => import("@codemirror/legacy-modes/mode/clike"), "objectiveCpp"),
  ".erl": stream(() => import("@codemirror/legacy-modes/mode/erlang"), "erlang"),
  ".hrl": stream(() => import("@codemirror/legacy-modes/mode/erlang"), "erlang"),
  ".elm": stream(() => import("@codemirror/legacy-modes/mode/elm"), "elm"),
  ".proto": stream(() => import("@codemirror/legacy-modes/mode/protobuf"), "protobuf"),
  ".cmake": stream(() => import("@codemirror/legacy-modes/mode/cmake"), "cmake"),
  ".dockerfile": stream(() => import("@codemirror/legacy-modes/mode/dockerfile"), "dockerFile"),
  ".ini": stream(() => import("@codemirror/legacy-modes/mode/properties"), "properties"),
  ".properties": stream(() => import("@codemirror/legacy-modes/mode/properties"), "properties"),
  ".conf": stream(() => import("@codemirror/legacy-modes/mode/properties"), "properties"),
  ".cfg": stream(() => import("@codemirror/legacy-modes/mode/properties"), "properties"),
  ".diff": stream(() => import("@codemirror/legacy-modes/mode/diff"), "diff"),
  ".patch": stream(() => import("@codemirror/legacy-modes/mode/diff"), "diff"),
  ".xml": stream(() => import("@codemirror/legacy-modes/mode/xml"), "xml"),
  ".svg": stream(() => import("@codemirror/legacy-modes/mode/xml"), "xml"),
  ".xsd": stream(() => import("@codemirror/legacy-modes/mode/xml"), "xml"),
  ".xsl": stream(() => import("@codemirror/legacy-modes/mode/xml"), "xml"),
  ".rkt": stream(() => import("@codemirror/legacy-modes/mode/scheme"), "scheme"),
  ".scm": stream(() => import("@codemirror/legacy-modes/mode/scheme"), "scheme"),
  ".sml": stream(() => import("@codemirror/legacy-modes/mode/scheme"), "scheme"),
  ".lisp": stream(() => import("@codemirror/legacy-modes/mode/commonlisp"), "commonLisp"),
  ".el": stream(() => import("@codemirror/legacy-modes/mode/commonlisp"), "commonLisp"),
  ".tex": stream(() => import("@codemirror/legacy-modes/mode/stex"), "stex"),
  ".bib": stream(() => import("@codemirror/legacy-modes/mode/stex"), "stex"),
  ".pas": stream(() => import("@codemirror/legacy-modes/mode/pascal"), "pascal"),
  ".f90": stream(() => import("@codemirror/legacy-modes/mode/fortran"), "fortran"),
  ".f95": stream(() => import("@codemirror/legacy-modes/mode/fortran"), "fortran"),
  ".f": stream(() => import("@codemirror/legacy-modes/mode/fortran"), "fortran"),
  ".cob": stream(() => import("@codemirror/legacy-modes/mode/cobol"), "cobol"),
  ".cbl": stream(() => import("@codemirror/legacy-modes/mode/cobol"), "cobol"),
  ".d": stream(() => import("@codemirror/legacy-modes/mode/d"), "d"),
  ".v": stream(() => import("@codemirror/legacy-modes/mode/verilog"), "verilog"),
  ".vhd": stream(() => import("@codemirror/legacy-modes/mode/vhdl"), "vhdl"),
  ".vhdl": stream(() => import("@codemirror/legacy-modes/mode/vhdl"), "vhdl"),
  ".coffee": stream(() => import("@codemirror/legacy-modes/mode/coffeescript"), "coffeeScript"),
  ".styl": stream(() => import("@codemirror/legacy-modes/mode/stylus"), "stylus"),
  ".sass": stream(() => import("@codemirror/legacy-modes/mode/sass"), "sass"),
  ".pug": stream(() => import("@codemirror/legacy-modes/mode/pug"), "pug"),
  ".jade": stream(() => import("@codemirror/legacy-modes/mode/pug"), "pug"),
  ".factor": stream(() => import("@codemirror/legacy-modes/mode/factor"), "factor"),
  ".smalltalk": stream(() => import("@codemirror/legacy-modes/mode/smalltalk"), "smalltalk"),
  ".tcl": stream(() => import("@codemirror/legacy-modes/mode/tcl"), "tcl"),
  ".awk": stream(() => import("@codemirror/legacy-modes/mode/tcl"), "tcl"),
};

/** 从文件名推出小写后缀（含点），无后缀返回空串。 */
function extOf(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? filename;
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return "";  // 点开头（.gitignore）不是后缀
  return base.slice(dot).toLowerCase();
}

/**
 * 按文件名取语言包加载器；无对应包返回 null（该文件类型无语法高亮）。
 *
 * `.d.ts` 这类复合后缀会退到上一段（`.ts`）再试一次。
 */
export function langLoaderFor(filename: string): LangLoader | null {
  const ext = extOf(filename);
  if (!ext) return null;
  const direct = LANG_LOADERS[ext];
  if (direct) return direct;
  // 复合后缀退化：.d.ts → .ts
  const dot = ext.lastIndexOf(".", 1);
  if (dot > 0) {
    const parent = LANG_LOADERS[ext.slice(dot)];
    if (parent) return parent;
  }
  return null;
}

/** 该文件名是否有可用的语法高亮（不触发加载）。 */
export function hasLangFor(filename: string): boolean {
  return langLoaderFor(filename) !== null;
}
