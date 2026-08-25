# NexBox JSBridge downloadFile 接口文档（下载服务器文件到本机）

> 本文档面向**人类开发者**和 **AI agent 自动化开发**双读者，风格与约定对齐 `docs/jsbridge-dev-guide.md`（先读该指南 §3 硬约束与 §3.1 零初始化）与 `docs/upload_bridge.md`（姊妹接口 pickAndUploadFiles，cookie/错误码/线程模型同源）。
>
> **本接口 Android 侧尚未实现**——本文档是先行的**实现规格**（H5 侧按本文档契约接入，App 完成实现并装新构建后即通）。函数名、参数、回调结构、错误码为**冻结契约**，Android 实现不得偏离。
>
> 事实来源（实现落地后以代码为准，以下为 Android 仓库内路径）：
> - 插件实现（待新建）：`app/src/main/java/com/tencent/tbs/jsbridge/plugin/JsDownloadFile.java`
> - 直接范本：同目录 `JsPickAndUploadFiles.java`（OkHttp client / cookie / 线程模型 / sanitize 模式照搬）
> - JS 封装：`app/src/main/assets/webpage/jsbridge.js` 的 `downloadFile`（镜像 `docs/web/jsbridge.js`）
> - 注册点：`BaseWebViewActivity.registerJSApi()` 一行 `registerJSPlugin("downloadFile", new JsDownloadFile())`

---

## 1. 功能概述与最小调用

H5 传服务器文件路径，原生用 OkHttp **GET 下载到手机 Downloads 目录**（流式写盘），完成后系统通知栏可见，结果一次性回调。解决：

- **X5 WebView 内 `<a>` 下载不可靠**——H5 的 `a.click()` 触发的下载在 X5 内核无下载 UI、保存路径不可见、大文件静默失败；
- **与 pickAndUploadFiles 对称**：上传走原生，下载同样走原生，H5 不碰文件字节。

最小调用：

```html
<script src='jsbridge.js?v=4'></script>
<script>
jsbridge.downloadFile({
	downloadUrl: location.origin + "/api/preview/download?path=" + encodeURIComponent("notes/a.pdf"),
	success: function (res) { console.log("已保存到 " + res.savedTo); },
	fail:      function (res) { alert("下载失败 code=" + res.code); }
	// 无 cancel：下载无用户交互环节
});
</script>
```

## 2. 接口契约

### 2.1 请求参数（H5 → 原生）

| 参数 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `downloadUrl` | string | **必填** | 完整 `http(s)://…` 下载 URL（H5 自行拼好 query）；空或非 http(s) 前缀 → fail code 1 |
| `fileName` | string | 服务端定 | 保存文件名。空则解析响应 `Content-Disposition: filename` 兜底，再兜底 URL 最后一段 |
| `cookieName` | string | `"cortex_auth"` | 会话 cookie 名（同 pickAndUploadFiles 逃生舱） |

**无 `cancel` 回调**——下载全程无用户交互（不弹任何选择器），只有 success/fail 两态。

### 2.2 success 回调（原生 → H5）

```json
{
	"code": 0,
	"name": "a_3f2c9d.pdf",
	"savedTo": "/storage/emulated/0/Download/a_3f2c9d.pdf",
	"bytes": 1234567,
	"notified": true
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `name` | string | 实际保存的文件名（重名自动去重后的） |
| `savedTo` | string | 绝对路径（展示/调试用；Android 10+ 该路径可能仅本次可见） |
| `bytes` | long | 写盘字节数 |
| `notified` | bool | 是否已发系统通知（通知权限未授予时 false，文件仍保存成功） |

### 2.3 fail 错误码

| code | 场景 |
|---|---|
| 1 | 参数无法解析 / `downloadUrl` 缺失或非 http(s) |
| 4 | URL 重名冲突无法落盘 / 未预期异常兜底 |
| 5 | 下载或写盘失败（HTTP 非 2xx / IOException / 磁盘满） |
| 7 | 旧请求被新请求取代（busy 时新 `jsCallNative` 进来，先给旧 callbackId 回 fail 7） |

fail payload 附 `httpStatus`（服务端有响应时）与 `detail`（sanitize 后文案）。

### 2.4 per-场景错误映射（fail code=5 的 detail 溯源）

| 场景 | detail 约定 |
|---|---|
| HTTP 401 | `UNAUTHORIZED`（会话过期——H5 应跳登录页，同上传的 401 语义） |
| HTTP 404 | 服务端 `{code:"FILE_NOT_FOUND"}` 透传（文件已被删） |
| HTTP 其他非 2xx | 服务端 `{code,detail}` 透传，解析失败合成 `HTTP_<status>` |
| IOException / 超时 | `NETWORK_ERROR: <message>` |
| 写盘失败 / 磁盘满 | `WRITE_FAILED: <message>` |

**401 特殊语义**：fail payload 附 `"unauthorized": true`（H5 据 this 跳登录，不靠解析 detail 字符串）。

### 2.5 会话 cookie（登录态）

同 pickAndUploadFiles §2.6：上传前从 X5 CookieManager 读 `cortex_auth`，未命中不发送 Cookie 头（无密码模式照常 200）。代码直接复用范本的 `readCookieHeader()`。

## 3. 全链路时序

```
H5 JS                                Native (JsDownloadFile)
│ jsbridge.downloadFile({downloadUrl, fileName})
│   Android.messageSend("downloadFile", cbId, params)
│───────────────────────────────────▶ jsCallNative (UI 线程)：
│                                      ① busy 检查：旧 callbackId 在途
│                                        → reportFail(旧 cbId, code 7)
│                                      ② 重置状态、解析参数
│                                        downloadUrl 非法 → fail 1
│                                      ③ readCookieHeader（X5 CookieManager）
│                                      ④ mExecutor.execute（后台线程）:
│                                           OkHttp GET + Cookie 头
│                                           200 → Content-Disposition 解析文件名
│                                           → Downloads 目录流式写盘
│                                             （8KB buffer 循环，绝不整读内存）
│                                           → 重名自动去重 name (1).ext
│                                           → MediaScanner 扫描 + 状态栏通知
│                                           → reportSuccess({name,savedTo,bytes,notified})
│                                           401 → fail {unauthorized:true}
│                                           其他 → fail（§2.4 映射）
│ ◀── evaluateJavascript("jsbridge.callBackFromNative('cb_…','success','{…}')")
```

## 4. 实现要点（Android 开发者必读）

### 4.1 Java 插件骨架（新建 `JsDownloadFile.java`）

```java
package com.tencent.tbs.jsbridge.plugin;

import com.tencent.tbs.jsbridge.BaseJSPlugin;

import android.app.DownloadManager;
import android.content.ContentValues;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import org.json.JSONObject;

import java.io.File;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okio.Okio;

/**
 * downloadFile：OkHttp 流式下载服务器文件到 Downloads 目录 + 系统通知。
 * 契约与错误码见 doclens 仓库 docs/jsbridge/download_bridge.md（冻结契约）。
 * 无 cancel 态（全程无用户交互）；一个 callbackId 只能回调一次。
 */
public class JsDownloadFile extends BaseJSPlugin {

	private static final String TAG = "JsDownloadFile";

	private static final String DEFAULT_COOKIE_NAME = "cortex_auth";   // 同 pickAndUploadFiles

	// 状态字段：singleTask 保活残留防护 —— jsCallNative 入口必须重置
	private String mCallbackId;
	private String mDownloadUrl;
	private String mFileName;        // 可空：Content-Disposition 兜底
	private String mCookieHeader;
	private boolean mBusy;
	private final ExecutorService mExecutor = Executors.newSingleThreadExecutor();

	/** 与 JsPickAndUploadFiles.CLIENT 同参（读侧超时可以更宽） */
	private static final OkHttpClient CLIENT = new OkHttpClient.Builder()
			.connectTimeout(15, TimeUnit.SECONDS)
			.writeTimeout(30, TimeUnit.SECONDS)
			.readTimeout(120, TimeUnit.SECONDS)   // 大文件慢网络读侧余量
			.retryOnConnectionFailure(false)
			.build();

	@Override
	public void jsCallNative(String callbackId, String requestParams) {
		// ① busy → 给旧 callbackId 回 fail 7（照抄 JsPickAndUploadFiles）
		// ② 重置状态 + 解析参数（downloadUrl/fileName/cookieName）
		//    downloadUrl 非法 → reportFail(failJson(1, "missing or invalid downloadUrl"))
		// ③ readCookieHeader（复用范本实现）
		// ④ mExecutor.execute(() -> doDownload())
	}

	// ---- 后台线程 ----

	private void doDownload() {
		// Request.Builder().url(mDownloadUrl).get()
		//   .header("Cookie", mCookieHeader)（仅非 null 时）
		// ① execute() → status
		//    401 → reportFail({code:5, unauthorized:true, detail:"UNAUTHORIZED"})
		//    非 2xx → 读 body {code,detail} 透传 → reportFail(code 5)
		// ② 解析保存名：mFileName 非空优先 → Content-Disposition filename
		//    → URL 最后段兜底；sanitize（去路径分隔符）
		// ③ 打开输出流（见 §4.2 分版本落盘）
		// ④ 循环 copy：byte[8192] 读 response.body().byteStream() 写出
		//    （绝不 body().bytes() 整读——50MB 文档不 OOM）
		// ⑤ 落库 MediaStore（API 29+）或通知 MediaScanner（API <29）
		// ⑥ 发状态栏通知（NotificationManager，渠道 "downloads"）
		//    权限未授予 → notified:false，不算失败
		// ⑦ reportSuccess({code:0, name, savedTo, bytes, notified})
		// 全程 try-catch：IOException → NETWORK_ERROR/WRITE_FAILED；兜底 fail 4
		// finally mBusy = false
	}
}
```

### 4.2 落盘位置与方式（分 Android 版本，重点）

- **API 29+（App targetSdk 29）**：禁直接写公共 Downloads。走 **MediaStore**：

```java
ContentValues cv = new ContentValues();
cv.put(MediaStore.Downloads.DISPLAY_NAME, finalName);
cv.put(MediaStore.MediaColumns.MIME_TYPE, "application/octet-stream");
cv.put(MediaStore.Downloads.IS_PENDING, 1);
Uri outUri = context.getContentResolver()
        .insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
// 写完 IS_PENDING=0 发布；重名由系统自动追加 " (1)" —— 查回真实 DISPLAY_NAME
```

- **API < 29**：`new File(Environment.getExternalStoragePublicDirectory(
  Environment.DIRECTORY_DOWNLOADS), finalName)`；重名手动去重 `name (1).ext`；
  写毕 `MediaScannerConnection.scanFile()` 让文件管理器可见。
- **savedTo 字段**：API 29+ 填 MediaStore 返回的 content Uri 字符串，API <29 填绝对路径——H5 仅作展示，不解析。
- 权限：API 29+ MediaStore 插入无需任何权限；API <29 需 `WRITE_EXTERNAL_STORAGE`
  （App manifest 已声明，运行时未授予时走 `MediaStore.Downloads` 仍可写自己 App 名下目录——
  简化处理：直接也用 MediaStore 路径可免权限，二选一由实现者定，文档不强制）。

### 4.3 Content-Disposition 文件名解析

服务端 FastAPI `FileResponse` 发 `Content-Disposition: attachment; filename*=utf-8''<name>`
（RFC 5987 编码，中文文件名百分号转义）。解析顺序：

1. `fileName` 参数非空 → 直接用（H5 显式指定时）
2. `filename*=utf-8''...` → URLDecoder.decode（优先，支持中文）
3. `filename="..."`（裸 filename 兜底）
4. URL path 最后段

解析结果仍要过一遍文件名清洗（去 `\/:*?"<>|` 与路径分隔符）。

### 4.4 框架硬约束（与上传同源）

1. **单次回调**：success 或 fail 恰好一次；无 cancel；通知发送不阻塞回调（notified 失败仅置 false）。
2. **JSON 禁单引号**：`detail`/`name` 过 `PhotoCodecUtil.sanitize()`。
3. **线程模型**：`jsCallNative` UI 线程只做参数解析 + 派发；网络/写盘全在 `mExecutor`。
4. **busy 取代语义**：同 pickAndUploadFiles（先回旧 fail 7 再开始新下载）。
5. **通知渠道**：`NotificationChannel("downloads", "文件下载", IMPORTANCE_LOW)`——低调不打扰；targetSdk 26+ 必须。

### 4.5 服务端下载协议（真相源）

`GET /api/preview/download?path=<rel>`（FastAPI，`doclens/web_v2/api/preview.py:123`）：

- Query `path`：文档相对路径（URL 编码；纯文件名也可——服务端 path_map 反查）
- 成功 200：`application/octet-stream` 字节流 + `Content-Disposition` 文件名
  `{stem}_{sha256(rel_path)[:6]}{suffix}`（防重名 + 供 preview/upload 反查回传）
- 失败 JSON `{code, detail}`：404 `FILE_NOT_FOUND`（不存在）/404 越权 /401 `UNAUTHORIZED`
- 与上传同受 auth 闸门：LAN 来源 + 设密码时要求 `cortex_auth` cookie

### 4.6 注册与修改点（Android 侧共 4 处）

1. 新建插件类（§4.1）
2. `BaseWebViewActivity.registerJSApi()` 末尾 +1 行：
   ```java
   this.jsBridge.registerJSPlugin("downloadFile", new JsDownloadFile());
   ```
3. `assets/webpage/jsbridge.js` 导出对象 +`downloadFile`（§5）
4. `assets/webpage/jsbridge_demo.html` +验证按钮（URL 输入框复用上传那个，或单独一个）

### 4.7 requestCode / 权限码占用表

**无新占用**——downloadFile 不拉起任何 Activity（无选择器、无权限对话框），不占 requestCode。
对比：takePhoto 0x0309、pickPhotos 0x030A、pickAndUploadFiles 0x030B。

## 5. jsbridge.js 封装（ES5，与 docs/web/jsbridge.js 同源）

```js
//下载服务器文件到本机 Downloads（契约见 doclens docs/jsbridge/download_bridge.md）；
//无 cancel 态（全程无用户交互）
function downloadFile(params) {
	params = params || {};
	sendToNative("downloadFile", {
		"downloadUrl": params.downloadUrl || "",
		"fileName":    params.fileName    || "",
		"cookieName":  params.cookieName  || ""
	}, {
		"success": params["success"],
		"fail":    params["fail"]
	});
}
```

挂进 `window.jsbridge` 导出对象。downloadUrl 缺失即 fail 1，封装层不兜底。

## 6. H5 侧集成（doclens 仓库，随本规格一并实现）

- `doclens/web_v2/frontend/src/utils/jsbridge.ts`：`jsbridgeDownloadAvailable()` 检测 + `downloadFile()` Promise 包装（成功 resolve 结果 / 失败 reject `JsbridgeDownloadError`；超时守卫 10 分钟——大文件慢网络）
- `doclens/web_v2/frontend/src/components/preview-pane.ts`：`_onDownloadClick` 分流——App 内走 jsbridge（toast「已保存到下载目录」），浏览器降级原 `<a>` 下载；401 → 跳登录页
- 降级链：`!!window.Android && typeof jsbridge.downloadFile === "function"`——App 未实现时自动回 `<a>` 方案，H5 先行上线无兼容风险

## 7. 验证

### 7.1 测试用例

| # | 用例 | 预期 |
|---|---|---|
| 1 | 预览 pane 下载按钮（App 内） | success：文件入 Downloads、通知栏可见、toast「已保存」 |
| 2 | 中文文件名 md | Content-Disposition RFC5987 解析正确，保存名无乱码 |
| 3 | 下载 40MB PDF | 流式写盘不 OOM，期间 UI 不卡 |
| 4 | 文件已被删（别处删除后点下载） | fail detail 含 FILE_NOT_FOUND，toast 报错 |
| 5 | 401（设密码 + 会话失效） | fail `unauthorized:true` → H5 跳登录页（LAN IP 直连模式） |
| 6 | 断网 / 停服 | fail NETWORK_ERROR |
| 7 | 同名连续下载两次 | 第二次自动 `name (1).ext`（或系统 IS_PENDING 去重），不覆盖 |
| 8 | 浏览器直接开预览 pane | 降级 `<a>` 下载（回归） |
| 9 | 快速连点两次下载 | 第一次回 fail 7，第二次正常（busy 语义） |
| 10 | 回归 | pickAndUploadFiles / takePhoto / pickPhotos 不受影响 |

### 7.2 环境

同 upload_bridge.md §7.1（服务端 7860+ 端口、`npm run build`、gradle assembleDebug + adb install）。
logcat 过滤 `-s JsDownloadFile:I`。

## 8. 已知边界与演进

- **无下载进度**：框架单次回调限制（同上传）；演进方向同 upload_bridge.md §8（H5 轮询或框架多次回调）。
- **Android 10+ 路径可见性**：MediaStore 写入的文件在文件管理器立即可见；`savedTo` 的 content Uri 仅本次会话可读，H5 不应缓存。
- **notification 权限（API 33+）**：未授予时 `notified:false` 但下载成功——H5 不把 notified 当成败依据。
- **并发下载**：插件 busy 语义是"一次一个"；多文件批量下载由 H5 串行调用（与上传一致）。
- **与 `<a download>` 的关系**：浏览器路径仍走 `<a>`（保留原实现做降级）；jsbridge 通道仅 App 内启用。

## 9. 变更记录

| 日期 | 内容 |
|---|---|
| 2026-08-24 | 契约冻结 + H5 侧接入（jsbridge.ts/preview-pane.ts）；Android 侧按本文档实现（插件 + 注册 + jsbridge.js + demo 按钮，news 仓库 4 处改动） |
