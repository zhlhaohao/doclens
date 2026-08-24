# NexBox JSBridge pickAndUploadFiles 接口文档（选文件并直传服务器）

> 本文档面向**人类开发者**和 **AI agent 自动化开发**双读者，风格与约定对齐 `docs/jsbridge-dev-guide.md`（先读该指南 §3 硬约束与 §3.1 零初始化）与 `docs/pickphotos_bridge.md`（姊妹接口 pickPhotos，选择器/截断/单次回调语义同源）。
>
> **本接口 Android 侧尚未实现**——本文档是先行的**实现规格**（H5 侧已按本文档契约接入，App 完成实现并装新构建后即通）。函数名、参数、回调结构、错误码为**冻结契约**，Android 实现不得偏离。
>
> 事实来源（实现落地后以代码为准，以下为 Android 仓库内路径）：
> - 插件实现（待新建）：`app/src/main/java/com/tencent/tbs/jsbridge/plugin/JsPickAndUploadFiles.java`
> - 直接范本：同目录 `JsPickPhotos.java`（状态重置 / collectUris / executor / sanitize 模式照搬）
> - JS 封装：`app/src/main/assets/webpage/jsbridge.js` 的 `pickAndUploadFiles`（镜像 `docs/web/jsbridge.js`）
> - 演示页：`app/src/main/assets/webpage/jsbridge_demo.html`
> - 注册点：`BaseWebViewActivity.registerJSApi()` 一行 `registerJSPlugin("pickAndUploadFiles", new JsPickAndUploadFiles())`

---

## 1. 功能概述与最小调用

H5 拉起系统文件选择器（`ACTION_GET_CONTENT + */*` 多选），原生用 OkHttp **直接 multipart POST 到服务器**（不经 H5 转手），聚合结果一次性 success 回调。解决两个问题：

- **X5 内核不弹 `<input type="file">` 选择器**——Files tab 上传在 App 内不可用（同 pickPhotos 的动机）；
- **大文件不能走 base64 回传**——服务端单文件上限 50MB，base64 后经 `evaluateJavascript` 必然超长失败（对比 pickPhotos 的 2MB 总预算），因此原生直传 HTTP。

最小调用：

```html
<script src='jsbridge.js?v=3'></script>
<script>
jsbridge.pickAndUploadFiles({
	uploadUrl: location.origin + "/api/files/upload",   // 必填：完整 URL
	destDir:   "notes/2026",                            // 目标目录（相对工作目录根）
	success:   function (res) { console.log(res.uploadedCount + " 上传成功"); },
	fail:      function (res) { alert("失败 code=" + res.code); },
	cancel:    function () { /* 用户在选择器按了返回 */ }
});
</script>
```

## 2. 接口契约

### 2.1 请求参数（H5 → 原生）

| 参数 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `uploadUrl` | string | **必填** | 完整 `http(s)://…/api/files/upload`；空或非 http(s) 前缀 → fail code 1 |
| `destDir` | string | `""` | 目标目录（相对服务端工作目录），透传服务端 `dest_dir` 表单字段；支持子目录如 `"notes/2026"` |
| `overwrite` | bool | `false` | 透传服务端 `overwrite` 表单字段 |
| `maxCount` | int | 9 | 最多选择文件数，上限 20；超选截断取前 N + `truncated:true`（语义同 pickPhotos） |
| `cookieName` | string | `"cortex_auth"` | 会话 cookie 名（逃生舱：服务端改名时 H5 可覆盖，勿动） |

### 2.2 success 回调（原生 → H5，单次聚合）

```json
{
	"code": 0,
	"pickedCount": 5,
	"truncated": false,
	"uploadedCount": 3,
	"skippedCount": 1,
	"failedCount": 1,
	"unauthorized": false,
	"results": [
		{"name": "a.pdf", "ok": true, "path": "notes/a.pdf", "bytes_written": 123456, "overwritten": false},
		{"name": "b.pdf", "ok": false, "code": "ALREADY_EXISTS", "detail": "已存在: b.pdf"},
		{"name": "c.exe", "ok": false, "code": "INVALID_TYPE", "detail": "不允许的文件类型: .exe"}
	]
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `pickedCount` | int | 截断前用户实选文件数 |
| `truncated` | bool | 选择超 maxCount 已截断 |
| `uploadedCount` | int | 服务端 200 成功数 |
| `skippedCount` | int | `ALREADY_EXISTS` 数（与 Web 端"跳过"语义对齐，**不算失败**） |
| `failedCount` | int | 其余失败数 |
| `unauthorized` | bool | 任一文件 401 → `true`，且剩余文件立即中止（不再发起 HTTP） |
| `results` | array | 逐文件结果，**顺序与上传顺序一致**（即截断后的选择顺序） |

results 成功项：

| 字段 | 说明 |
|---|---|
| `name` | 文件名（`OpenableColumns.DISPLAY_NAME`） |
| `ok` | `true` |
| `path` | 服务端返回的相对路径（POSIX 风格，如 `"notes/a.pdf"`） |
| `bytes_written` / `overwritten` | 服务端响应透传 |

results 失败项：`{name, ok:false, code, detail}`。`code` 为服务端错误码透传或原生合成码（§2.5）。

### 2.3 fail 错误码（插件级，整次调用失败——"根本没走到上传"）

| code | 场景 |
|---|---|
| 1 | 参数无法解析 / `uploadUrl` 缺失或非 http(s) |
| 3 | 无文件选择器 App（`ActivityNotFoundException`） |
| 4 | 选择器返回空 / 启动异常 |
| 5 | 聚合流程崩溃兜底（JSON 构建 / 未预期异常） |
| 7 | 旧请求被新请求取代（busy 时新 `jsCallNative` 进来，先给**旧** callbackId 回 fail 7） |

（2 空缺，对齐姊妹接口的"权限拒绝"编号——本接口零权限。6 空缺备用。）

### 2.4 cancel 回调

唯一触发：用户在选择器界面按返回键（`RESULT_CANCELED`），payload `{"reason":"user canceled"}`。**已选但未确认不会走到这里**（选择器返回即 CANCELED）。

`completion` 态不使用。

### 2.5 per-item code 对照表（服务端码透传 + 原生合成）

| code | 来源 | HTTP | 场景 |
|---|---|---|---|
| `ALREADY_EXISTS` | 服务端 | 409 | 目标已存在且 `overwrite=false` → H5 计入 skipped |
| `INVALID_TYPE` | 服务端 | 400 | 扩展名不在白名单（`.md .markdown .txt .pdf .docx .doc .docm .pptx .ppt .pps .pot .xlsx .xls .xlsm .csv .rtf .epub .html .htm .png .jpg .jpeg .webp .gif .bmp .tif .tiff`；**无后缀也拒**） |
| `INVALID_NAME` / `RESERVED_NAME` | 服务端 | 400 | 文件名非法 / Windows 保留名（CON、PRN…） |
| `FILE_NOT_FOUND` | 服务端 | 404 | `dest_dir` 不存在（打开页面后目录被删） |
| `CONTENT_TOO_LARGE` | 服务端 | 413 | >50MB |
| `CONTENT_TOO_LARGE` | **原生预检** | — | `OpenableColumns.SIZE > 50MB` 时不发起 HTTP，本地合成同码项（省 50MB 白传带宽） |
| `UNAUTHORIZED` | 服务端 | 401 | 会话过期；外层 `unauthorized:true` + 剩余项立即中止 |
| `NETWORK_ERROR` | **原生** | — | IOException / 超时（断网、服务器不可达） |
| `READ_FAILED` | **原生** | — | `ContentResolver` 读 Uri 失败（选择器授权回收、文件被删） |
| `WRITE_FAILED` / `INTERNAL_ERROR` | 服务端 | 500 | 服务端写盘失败 / 未预期异常 |

**关键语义（与 pickPhotos 的刻意偏离）**：即使**全部**文件失败也走 **success 聚合回调**（不学 pickPhotos 的"全败→整体 fail 5"）。理由：`unauthorized` 标志和逐文件 code 必须到达 H5——fail 通道没有 results 结构，H5 无法区分"全网络失败"与"全重名跳过"。插件级 fail 只用于"根本没走到上传"的场景（§2.3）。

### 2.6 会话 cookie（登录态）

- 服务端认证闸门：仅当「请求来源 IP **非环回** 且 服务端已设密码」时要求会话 cookie；cookie 名 **`cortex_auth`**（doclens 仓库 `doclens/web_v2/auth_gate.py:14` 的 `COOKIE_NAME`，httponly）。
- 原生上传前从 **X5 CookieManager** 读取（注意：X5 内核 cookie **不在** `android.webkit.CookieManager`）：

```java
String all = com.tencent.smtt.sdk.CookieManager.getInstance().getCookie(uploadUrl);
// 解析 "a=1; cortex_auth=xxx" 形式，提取目标 cookie → 组装 "cortex_auth=xxx" 请求头
```

- 未命中（无密码模式 / 环回访问）→ **不发送 Cookie 头**（服务端不要求，照常 200）。
- 命中 → 塞 OkHttp 请求头 `Cookie: cortex_auth=xxx`。
- 401 返回时：H5 收到 `unauthorized:true` 后自行跳登录页（等价于 Web 端 fetch 封装 401 统一钩子的行为），原生不做登录 UI。

## 3. 全链路时序

```
H5 JS                                Native (JsPickAndUploadFiles)
│ jsbridge.pickAndUploadFiles({uploadUrl, destDir})
│   Android.messageSend("pickAndUploadFiles", cbId, params)
│───────────────────────────────────▶ jsCallNative (UI 线程)：
│                                      ① 重置状态字段（singleTask 保活残留防护）
│                                      ② busy 检查：旧 callbackId 在途
│                                        → reportFail(旧 cbId, code 7)
│                                      ③ 解析参数；uploadUrl 非法 → fail 1
│                                      ④ X5 CookieManager.getCookie(uploadUrl)
│                                        解析 cortex_auth → Cookie 请求头
│                                      ⑤ ACTION_GET_CONTENT + */*
│                                        + EXTRA_ALLOW_MULTIPLE
│                                        + EXTRA_MIME_TYPES(尽力过滤,非硬约束)
│                                        registerResultCallback(0x030B)
│                                        startActivityForResult
│                                          (用户多选 N 个文件 / 返回键)
│                                      ◀── resultCallback (UI 线程)
│                                      CANCELED → reportCancel ──────────┐
│                                      OK → collectUris（ClipData 遍历
│                                        → getData 兜底）
│                                        → 超 maxCount 截断 + truncated
│                                        → mExecutor.execute(串行逐文件):
│                                            queryDisplayName/SIZE(Cursor)
│                                            SIZE > 50MB → 本地 CONTENT_TOO_LARGE 项
│                                            已遇 401 → 剩余项直接 UNAUTHORIZED 中止
│                                            OkHttp multipart POST(流式 body)
│                                            200 → ok 项；401 → unauthorized；
│                                            其他 → {code,detail} 透传
│                                      reportSuccess(聚合 JSON) ────────┤
│ ◀── evaluateJavascript("jsbridge.callBackFromNative('cb_…','success','{…}')")
│ 一次性消费字典（delete），聚合结果整体到达；H5 刷新目录列表
```

## 4. 实现要点（Android 开发者必读）

### 4.1 Java 插件骨架（新建 `JsPickAndUploadFiles.java`）

```java
package com.tencent.tbs.jsbridge.plugin;

import com.tencent.tbs.jsbridge.BaseJSPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import okhttp3.MediaType;
import okhttp3.MultipartBody;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okio.Okio;

/**
 * pickAndUploadFiles：拉起系统文件选择器（多选），OkHttp 直接 multipart
 * 上传到 uploadUrl，聚合结果单次 success 回调。
 * 契约与错误码见 doclens 仓库 docs/jsbridge/upload_bridge.md（冻结契约）。
 *
 * 框架限制：一个 callbackId 只能回调一次（jsbridge.js 字典一次性消费），
 * 多文件结果必须聚合进同一次 success 回调，无逐文件进度。
 */
public class JsPickAndUploadFiles extends BaseJSPlugin {

	private static final String TAG = "JsPickAndUploadFiles";

	/** Activity 结果码 0x030B（0x0309=takePhoto、0x030A=pickPhotos；避开 FILE_CHOOSER=100、zxing=49374） */
	private static final int REQUEST_PICK_UPLOAD = 0x030B;

	private static final int DEFAULT_MAX_COUNT = 9;
	private static final int LIMIT_MAX_COUNT = 20;
	/** 与服务端 _MAX_UPLOAD_BYTES 对齐（doclens web_v2/api/files.py 模块级常量） */
	private static final long MAX_FILE_BYTES = 50L * 1024 * 1024;
	/** 会话 cookie 名：doclens web_v2/auth_gate.py COOKIE_NAME（非 CORTEX_SESSION！） */
	private static final String DEFAULT_COOKIE_NAME = "cortex_auth";

	// 状态字段：宿主 singleTask 保活会跨"页面会话"残留 —— jsCallNative 入口必须重置
	private String mCallbackId;
	private String mUploadUrl;
	private String mDestDir;
	private String mCookieHeader;      // "cortex_auth=xxx" 或 null（无则不带头）
	private boolean mOverwrite;
	private boolean mBusy;
	private int mMaxCount;
	private final ExecutorService mExecutor = Executors.newSingleThreadExecutor();

	/** 串行上传专用 client：禁 retry 防重传（POST 非幂等） */
	private static final OkHttpClient CLIENT = new OkHttpClient.Builder()
			.connectTimeout(15, TimeUnit.SECONDS)
			.writeTimeout(180, TimeUnit.SECONDS)   // 50MB 慢 WiFi 余量
			.readTimeout(60, TimeUnit.SECONDS)
			.retryOnConnectionFailure(false)
			.build();

	@Override
	public void jsCallNative(String callbackId, String requestParams) {
		// ① busy 检查（在重置状态前：先给旧 callbackId 回 fail 7）
		// ② 重置状态字段、解析参数（uploadUrl/destDir/overwrite/maxCount/cookieName）
		//    uploadUrl 空/非 http(s) → reportFail(failJson(1, "missing uploadUrl"))
		// ④ readCookieHeader()（X5 CookieManager，§2.6）
		// ⑤ ACTION_GET_CONTENT */* + EXTRA_ALLOW_MULTIPLE + EXTRA_MIME_TYPES
		//    registerResultCallback(REQUEST_PICK_UPLOAD) + startActivityForResult
		//    ActivityNotFoundException → fail 3；其他异常 → fail 4
	}

	@Override
	public void resultCallback(int requestCode, int resultCode, Intent data) {
		// RESULT_CANCELED → reportCancel(mCallbackId, {"reason":"user canceled"})
		// collectUris（ClipData 优先 / getData 兜底，照抄 JsPickPhotos）
		// 空 → fail 4；超 maxCount 截断 + truncated
		// mExecutor.execute(() -> uploadAll(uris, pickedCount, truncated))
	}

	// ---- 后台线程（executor）----

	private void uploadAll(List<Uri> uris, int pickedCount, boolean truncated) {
		// 串行逐文件（与 Web 端 files-view 行为一致，避免并行竞争 ALREADY_EXISTS）：
		//   for uri: ① queryDisplayName/Size ② 401 已发生 → 直接中止项
		//            ③ SIZE>50MB → 本地 CONTENT_TOO_LARGE 项（不发 HTTP）
		//            ④ uploadOne() → JSONObject 项
		// 聚合 uploadedCount/skippedCount/failedCount/unauthorized → reportSuccess
		// 顶层 try-catch 兜底 → reportFail(5)；detail 一律过 PhotoCodecUtil.sanitize()
	}

	private JSONObject uploadOne(Uri uri, String name) {
		// MultipartBody.Builder setType(MULTIPART_FORM_DATA)
		//   .addFormDataPart("file", name, streamBody(uri))    ← 字段名必须是 "file"
		//   .addFormDataPart("dest_dir", mDestDir)
		//   .addFormDataPart("overwrite", mOverwrite ? "true" : "false")
		// Request.Builder().url(mUploadUrl)
		//   .header("Cookie", mCookieHeader)（仅非 null 时）
		//   .post(body).build();  CLIENT.newCall(...).execute()
		// 200 → 解析 {path, bytes_written, overwritten} → ok 项
		// 401 → {ok:false, code:"UNAUTHORIZED"} + 外层中止标志
		// 其他非 2xx → 解析 body {code, detail} 透传；解析失败 → code:"HTTP_" + status
		// IOException → NETWORK_ERROR 项；openInputStream 失败 → READ_FAILED 项
	}

	/** 流式 RequestBody：ContentResolver 直读，绝不把文件读进 byte[]（40MB 不 OOM） */
	private RequestBody streamBody(Uri uri, long sizeBytes) {
		// 匿名 RequestBody 子类：
		//   contentType() → application/octet-stream（服务端只看文件名后缀，不校验 MIME）
		//   contentLength() → sizeBytes（OpenableColumns.SIZE；未知 -1 时先落
		//     context.getCacheDir() 临时文件再传，传毕删除）
		//   writeTo(sink) → try (InputStream in = cr.openInputStream(uri)) {
		//                      sink.writeAll(Okio.source(in)); }
	}

	private String readCookieHeader(String url, String cookieName) {
		// com.tencent.smtt.sdk.CookieManager.getInstance().getCookie(url)
		// 按 "; " 分割找 name= 前缀；null/未命中 → null
	}
}
```

（完整可编译实现按上述骨架 + `JsPickPhotos.java` 的工具方法照搬即可；`failJson`/`cancelJson`/`close` 等私有工具直接复制该范本。）

### 4.2 服务端上传协议（复制目标的真相源）

`POST /api/files/upload`（FastAPI，`doclens/web_v2/api/files.py:378`），multipart 三字段：

| 字段 | 说明 |
|---|---|
| `file` | 文件本体（字段名必须 `file`） |
| `dest_dir` | 目标目录字符串，默认 `""` = 工作目录根 |
| `overwrite` | `"true"` / `"false"` 字符串 |

- 成功 200：`{"path":"notes/a.pdf","bytes_written":123,"overwritten":false,"reindex_triggered":true}`（服务端后台增量索引，不阻塞响应）
- 失败：`{"code":"...","detail":"..."}`，状态码见 §2.5 对照表
- **原生不预检扩展名白名单**——服务端 frozenset 是唯一真相源，原生复制必然漂移；服务端对每个文件返回精确 `INVALID_TYPE`，聚合回调里 H5 能按文件展示。原生唯一干预：picker 的 `EXTRA_MIME_TYPES` **尽力过滤**（很多选择器忽略它，仅 UI 提示，不作硬约束）
- **原生预检 50MB**（`OpenableColumns.SIZE`）：超限本地合成 `CONTENT_TOO_LARGE` 项，不发起 HTTP——阈值方向安全（原生=服务端阈值，服务端将来放宽只影响极端场景）

### 4.3 EXTRA_MIME_TYPES 尽力过滤数组

```java
new String[]{
	"text/*", "image/*",
	"application/pdf",
	"application/msword",
	"application/vnd.ms-powerpoint",
	"application/vnd.ms-excel",
	"application/vnd.ms-excel.sheet.macroenabled.12",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"application/vnd.openxmlformats-officedocument.presentationml.presentation",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	"application/rtf",
	"application/epub+zip"
}
```

（对应服务端白名单；选择器不识别时显示全部文件，由服务端最终裁决——非硬约束。）

### 4.4 框架硬约束清单（违反即静默失败）

1. **单次回调**：一个 callbackId 只能 reportXxx 一次（`jsbridge.js` 字典一次性 `delete`）。多文件必须聚合进同一次 success；**逐文件进度推送不可行**——`completion` 态也不行（首个任何类型回调到达即删字典，后续回调取到 undefined 闭包走 `Android.hybrid` 兜底静默丢弃）。进度感知的补偿：H5 侧 busy 状态禁用上传按钮。
2. **JSON 内禁止单引号**：原生回调是字符串拼接 `evaluateJavascript` 执行，`detail` 文案（含服务端中文错误）必须过 `PhotoCodecUtil.sanitize()`。
3. **线程模型**：`jsCallNative`/`resultCallback` 在 UI 线程——网络/IO 必须 `mExecutor`；`reportXxx` 内部自回 UI 线程，executor 里可直接调。
4. **状态字段入口重置**：`singleTask` 保活跨"页面会话"残留，`jsCallNative` 入口必须重置（同 takePhoto/pickPhotos）。
5. **busy 取代语义**：上一次调用在途（等选择器/上传中）时新调用进来 → 先给**旧** callbackId 回 fail 7（不能静默吞掉旧回调，否则 H5 的 Promise 永久挂起），再开始新流程。
6. **零权限**：系统选择器代选，content Uri 自带临时读授权；INTERNET 权限与 `usesCleartextTraffic="true"`（HTTP 明文）manifest 已有。

### 4.5 注册与修改点（Android 侧共 4 处）

1. 新建插件类（§4.1）
2. `BaseWebViewActivity.registerJSApi()` 末尾 +1 行：
   ```java
   this.jsBridge.registerJSPlugin("pickAndUploadFiles", new JsPickAndUploadFiles());
   ```
3. `assets/webpage/jsbridge.js` 导出对象 +`pickAndUploadFiles`（§5）
4. `assets/webpage/jsbridge_demo.html` +验证按钮（§7.3）

### 4.6 requestCode / 权限码占用表（续 pickphotos_bridge.md §4.9）

| 码 | 值 | 占用者 |
|---|---|---|
| Activity 结果 | 100 | FILE_CHOOSER |
| Activity 结果 | 49374 (0xC0DE) | zxing 扫码 |
| Activity 结果 | 0x0300–0x0308 | TBS demo 遗留 |
| Activity 结果 | 0x0309 | takePhoto |
| Activity 结果 | 0x030A | pickPhotos |
| Activity 结果 | **0x030B** | **pickAndUploadFiles（本接口）** |
| 权限 | 0x0010–0x0019 | 相机/电话/录音等 |
| 权限 | 0x001A | （空闲，未占用） |

## 5. jsbridge.js 封装（ES5，与 docs/web/jsbridge.js 同源）

```js
function pickAndUploadFiles(params) {
	params = params || {};
	sendToNative("pickAndUploadFiles", {
		uploadUrl:  params.uploadUrl  || "",
		destDir:    params.destDir    || "",
		overwrite:  !!params.overwrite,
		maxCount:   params.maxCount   || 9,
		cookieName: params.cookieName || ""
	}, {
		"success": params["success"],
		"fail":    params["fail"],
		"cancel":  params["cancel"]
	});
}
```

挂进 `window.jsbridge` 导出对象。注意：**uploadUrl 缺失即 fail 1**，封装层不兜底（调用方必须显式传，漏传是契约错误应当暴露）。

## 6. H5 侧集成现状（doclens 仓库，已实现）

- `doclens/web_v2/frontend/src/utils/jsbridge.ts`：类型定义（`PickAndUploadResult`）、`jsbridgeUploadAvailable()` 环境检测、`pickAndUploadFiles()` Promise 包装（cancel → `null`，超时守卫 10 分钟——用户在选择器停留远超 15s，不能复用拍照的 15s）
- `doclens/web_v2/frontend/src/views/files-view.ts`：`_openFilePicker()` 分流——App 内走 jsbridge，浏览器降级原 `<input type=file>` 路径（桌面拖拽不受影响）；`unauthorized:true` → `router.navigate("login")`；`ALREADY_EXISTS` 计入 skipped，与 Web 端 toast 语义一致
- 环境检测降级链：`!!window.Android && !!window.jsbridge && typeof jsbridge.pickAndUploadFiles === "function"`——App 版本过旧（未实现本接口）时自动降级回 input 方案，H5 先行上线无兼容风险

## 7. 验证

### 7.1 环境准备

```powershell
# 服务端（doclens 仓库根；端口看日志 7860/7861/7862…）
pwsh -File C:\Users\lianghao\github\0821-2\start-app.ps1 gui
# 前端构建（doclens 仓库，改 src 后必须）
cd C:\Users\lianghao\github\0821-2\doclens\web_v2\frontend; npm run build
# Android 构建（news 仓库；环境链细节见 jsbridge-dev-guide.md §5 Step 6）
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jre"
& $gradle :app:assembleDebug
adb install -r app\build\outputs\apk\debug\app-debug.apk
adb logcat -s JsPickAndUploadFiles:I BaseWebViewActivity:I
```

连通前提：手机与 PC 同 LAN，App 指向 doclens 地址（`uploadUrl` 由 H5 `location.origin` 自动继承，无需配置）。

### 7.2 测试用例

| # | 用例 | 预期 |
|---|---|---|
| 1 | 多选 3 个白名单文件 | success：uploaded=3，H5 列表刷新出新文件，toast「已上传 3」 |
| 2 | 重复上传同名文件 | ALREADY_EXISTS → skipped，toast「已上传 0，跳过 N」 |
| 3 | 选 >50MB 文件 | 原生预检 CONTENT_TOO_LARGE，不发起 HTTP（logcat 可证） |
| 4 | 选 .exe / 无后缀文件 | 服务端 INVALID_TYPE → failed + detail 文案 |
| 5 | 选择器返回键 | cancel → H5 静默（无 toast） |
| 6 | 401：服务端设密码 + 使会话失效 | `unauthorized:true`、剩余项中止、H5 跳登录页（⚠️ 须 LAN IP 直连；`adb reverse` 是环回 IP 闸门豁免，测不了 401） |
| 7 | 40MB 大 PDF | 流式上传不 OOM（logcat 无 OOM、期间 UI 不卡） |
| 8 | 上传中断网 / 停服 | per-item NETWORK_ERROR，全部失败仍 success 聚合 failed=N |
| 9 | dest_dir 已被删 | FILE_NOT_FOUND per-item |
| 10 | 选 >maxCount 个 | 截断 + `truncated:true` |
| 11 | 浏览器直接开 Files tab | 降级回 input 路径（回归） |
| 12 | 回归 | takePhoto/pickPhotos/日记拍照流/扫码/FILE_CHOOSER=100 不受 0x030B 干扰 |

### 7.3 演示页按钮（jsbridge_demo.html）

```html
<div>
	<input type="text" id="uploadUrl" placeholder="http://192.168.x.x:7860/api/files/upload"
	       style="width:260px;"/>
	<input type="button" value="选文件并上传" onclick="doUpload();"/>
</div>
<script>
function doUpload() {
	// ⚠️ 不要用 prompt() 让用户输入 URL——X5 webview 的 onJsPrompt 不一定有 override
	jsbridge.pickAndUploadFiles({
		uploadUrl: document.getElementById("uploadUrl").value,
		success: function (res) {
			alert("上传 " + res.uploadedCount + "，跳过 " + res.skippedCount
				+ "，失败 " + res.failedCount + (res.unauthorized ? "（登录过期）" : ""));
		},
		fail: function (res) { alert("失败 code=" + res.code); },
		cancel: function () {}
	});
}
</script>
```

## 8. 已知边界与演进

- **无逐文件进度**：框架 callbackId 一次性消费（jsbridge.js:29 `delete messageHandlers[...]` 无条件执行），completion 多次推送不可行；50MB 单文件只能"上传中"busy 态感知。演进方向：H5 轮询服务端目录 mtime，或框架支持多次反向 messageSend（本期不做）。
- **服务端白名单是唯一真相源**：原生不做扩展名预检，picker 的 MIME 过滤仅尽力（多数选择器忽略 `EXTRA_MIME_TYPES`）。
- **cookie 依赖 X5 CookieManager**：H5 页面与原生上传共享同一 WebView cookie 域；若 H5 经登录页拿到会话，原生自动继承——无需用户二次登录。App 与 PC 不同网络（如蜂窝）时上传失败落 NETWORK_ERROR。
- **与 WebView 自带 FILE_CHOOSER(100) 的关系**：那条链路 `filePathCallback` 回 Uri 后 H5 拿不到文件内容（X5 内核实际不弹）；本接口是完整"选择+传输"闭环的替代通道。
- **重名无自动改名**：服务端语义只有 409 或覆盖，无 `a(1).pdf` 式重命名；H5 调用固定 `overwrite:false`，重名即 skipped。

## 9. 变更记录

| 日期 | 内容 |
|---|---|
| 2026-08-24 | 契约冻结 + H5 侧接入（jsbridge.ts/files-view.ts）；Android 侧按本文档实现（插件 + 注册 + jsbridge.js + demo 按钮，news 仓库 4 处改动） |
