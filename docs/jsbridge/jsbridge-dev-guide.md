# NexBox JSBridge 接口开发指南（Android ↔ H5）

> 本文档面向**人类开发者**和**AI agent 自动化开发**双读者。AI agent 开发新接口时请严格按 §5 流程执行，并跑完 §7 验证清单。
>
> **本目录可整体拷贝到前端项目**（指南 + JS 库自包含）：
> - `jsbridge-dev-guide.md` — 本指南
> - `web/jsbridge.js` — JS 封装库（**前端项目直接引用此文件**，与 App 内置的 `app/src/main/assets/webpage/jsbridge.js` 同源；App 更新后从此处同步最新版）
> - `web/jsbridge_demo.html` — 调用示例页（含 4 个接口的完整调用写法，可作模板）
>
> 前端项目接入步骤：把 `web/jsbridge.js` 拷到项目的静态资源目录（Vue CLI 的 `public/`、Vite 的 `public/`、webpack 的 `static/`），页面 `<script src='/jsbridge.js?v=N'></script>` 引入即可（无需任何初始化，见 §3.1）。
>
> 事实来源（修改代码后以代码为准，以下为 Android 仓库内路径）：
> - JS 封装层：`app/src/main/assets/webpage/jsbridge.js`（84 行，注入 `window.jsbridge`）
> - 原生分发器：`app/src/main/java/com/tencent/tbs/jsbridge/JSBridge.java`
> - 插件基类：`.../jsbridge/BaseJSPlugin.java`（异步）、`.../jsbridge/BaseJSPluginSync.java`（同步）
> - 插件注册点：`.../tbs/feature/BaseWebViewActivity.java` 的 `registerJSApi()`（约 252-271 行）
> - 调用示例页：`app/src/main/assets/webpage/jsbridge_demo.html`
> - Android 侧操作手册：`.claude/skills/jsbridge-plugin/SKILL.md`（技能 `/jsbridge-plugin`）

---

## 1. 架构总览

```
H5 页面
  │  <script src='jsbridge.js'> 后可用 window.jsbridge（封装）或 window.Android（原生注入对象）
  ▼
window.Android  ←— WebView.addJavascriptInterface(JSBridge实例, "Android")
  │                （HybridConstant.HYBRID_BRIDGE_NAME = "Android"）
  ▼
JSBridge（Java 分发器）
  │  按 functionName 查 LinkedHashMap<String, BaseJSPlugin>
  ▼
XxxPlugin（继承 BaseJSPlugin / BaseJSPluginSync）
  │  可调用 getBaseWebViewActivity() / getWebView() / getContext() / getJSBridge()
  ▼
宿主能力（Activity 结果转发、权限转发、WebView、缓存…）
```

**两条调用通道：**

| 通道 | JS 入口 | 原生入口 | 线程 | 返回方式 |
|---|---|---|---|---|
| 异步（主用） | `Android.messageSend(funcName, callbackId, paramsJsonStr)` | `JSBridge.messageSend()` → `dispatchJSRequest()` → `post()` 到 **UI 线程** | UI 线程执行插件 | 原生回调 `jsbridge.callBackFromNative(callbackId, type, paramsJsonStr)` |
| 同步 | `Android.syndMessageSend(funcName, paramsJsonStr)` | `JSBridge.syndMessageSend()`（仅 `BaseJSPluginSync` 子类生效，否则返回 null） | **JS 线程**（非 UI！） | 直接 `return` JSON **字符串** |

**四态回调**（`JSCallbackType` 枚举，异步通道专用）：
`success` / `fail` / `cancel` / `completion` — JS 侧回调字典的四个键名，语义：成功 / 出错 / 用户取消 / 完成通知（可多次事件的场景，当前无使用方）。

## 2. 现有接口清单（截至 2026-08）

### 2.1 注册表接口（`registerJSApi()` 注册，走插件分发）

| 函数名 | 插件类 | 类型 | 参数（JS→原生） | 返回/回调（原生→JS） |
|---|---|---|---|---|
| `getLocation` | JSLocationPlugin | 异步 | `{type: gpsType}` | success `{latitude, longitude}` / cancel |
| `getMemoryCache` | JSGetCachePlugin | 同步 | `{key: string}` | return `{...缓存值}` |
| `lockOrientation` | JsLockOrientation | 异步 | 方向参数（详见类） | — |
| `scanQrCode` | JSScanQrCode | 异步 | `{}` | success `{code}`（扫出内容）/ fail |
| `requestAudioVideoPermission` | JsRequestAudioVideoPermission | 异步 | `{}` | 授权结果 |
| `requestLocationPermission` | JsRequestLocationPermission | 异步 | `{}` | 授权结果 |
| `fullScreen` | JsFullScreenPlugin | 异步 | 全屏参数 | — |
| `openHtmlPage` | JsOpenHtmlPage | **同步** | `{url: string}` | return `{code:"success"}`；启动 `PureX5WebViewActivity` |
| `getScreenInfo` | JsGetScreenInfo | **同步** | `{}` | return `{width, height, code:0}` |
| `closeHtmlPage` | JsCloseHtmlPage | 异步 | — | 关闭当前 WebView 页 |
| `showSoftInput` | JsShowSoftInput | 异步 | — | 唤起软键盘 |
| `canGoBack` | JsCanGoBack | 异步 | `{value: "true"/"false"}` | 配合 `pageGoBack()`：物理返回键时 success `{result:"true"}` |
| `getUserInfo` | JsGetUserInfo | 异步 | `{}` | success `{username, password, code:0}`（**写死的测试数据**） |
| `clearWebViewCache` | JsClearWebViewCache | **同步** | `{}` | return `{code:"success"}`；清 WebView 缓存 |
| `takePhoto` | JsTakePhoto | 异步 | `{quality=70, maxWidth=1280, maxHeight=1280}` | success `{code,base64,mimeType,path,width,height,size}`；仅拍照，详见 `docs/camera_bridge.md` |
| `pickPhotos` | JsPickPhotos | 异步 | `{maxCount=1, quality=70, maxWidth=1080, maxHeight=1080}` | success `{code,count,pickedCount,truncated,photos[]}`；相册多选，详见 `docs/pickphotos_bridge.md` |
| `pickAndUploadFiles` | JsPickAndUploadFiles | 异步 | `{uploadUrl(必填), destDir="", overwrite=false, maxCount=9, cookieName="cortex_auth"}` | success `{code,pickedCount,truncated,uploadedCount,skippedCount,failedCount,unauthorized,results[]}`；**Android 侧待实现**（契约已冻结），详见 `docs/upload_bridge.md` |

注意类型标注以插件实际继承为准（`extends BaseJSPluginSync` 即同步），与直觉无关：`openHtmlPage`、`getScreenInfo`、`clearWebViewCache`、`getMemoryCache` 都是同步。

### 2.2 JSBridge 直暴露接口（不走注册表，无回调）

| 方法 | 作用 |
|---|---|
| `Android.openQRCodeScan()` | 直接拉起 zxing 扫码 |
| `Android.openDebugX5()` | 加载 debugx5.qq.com 调试页 |
| `Android.openWebkit()` | 启动 SystemWebViewActivity |
| `Android.hybrid(callbackId)` | JS 侧回调字典无该态时通知原生的兜底（勿手动调） |

### 2.3 JS 封装层导出（`window.jsbridge.*`，jsbridge.js:74-82）

`syncSendToNative(method, params)` / `sendToNative(method, params, cbDict)` / `callBackFromNative(...)` 为通用通道；`getLocation(params)` / `getMemoryCache(key)` / `rotateScreen(orientation)` / `scanQrCode(params)` 为便捷封装（仅这 4 个）。

## 3. 接口契约（AI agent 必须遵守的硬约束）

1. **JSON 字符串内禁止出现单引号 `'`**。原生回调是把 `jsbridge.callBackFromNative('id','type','params')` 用**字符串拼接**成 JS 代码再 `evaluateJavascript` 执行（JSBridge.java:109-114），params 含单引号会破坏 JS 语法 → 回调静默丢失。原生侧应在返回前做转义或剔除。
2. **异步插件必须恰好回调一次**（四态选一）。不回调 → JS 闭包字典永久挂起（内存泄漏 + 业务无响应）；回调多次无意义（字典一次性消费，`callBackFromNative` 收到即 `delete`）。
3. **线程模型**：
   - 异步插件运行在 **UI 线程** → 不能做耗时/网络/IO 操作（会卡 UI；需要异步业务时插件内部自行开线程，完成后回到 UI 线程调 `reportXxx`）。
   - 同步插件运行在 **JS 线程** → **绝对不能碰 UI/WebView**（`getBaseWebViewActivity()` 返回值仅可读取数据），只做纯数据查询。
4. **同步返回值是 JSON 字符串**（不是对象）。JS 侧拿到的是 string，需要 `JSON.parse()`。原生侧必须 `return result.toString()`，不得 return null 之外的非序列化对象。
5. **无环境降级**：`jsbridge.js` 不检测 `window.Android` 是否存在。在浏览器直接打开会抛 `ReferenceError: Android is not defined`。新写的 H5 调用点若需兼容浏览器，须按 §6.3 的环境检测模式先行判断（原生 UA 已带 `NexBox/版本` 标识）。
6. **已知历史 bug**：`jsbridge.js:45` 的 `getLocation` 封装把失败回调写成键名 `failer`（原生回调 `fail` 时字典匹配不到 → 走 `Android.hybrid` 兜底 → 失败静默）。新封装勿模仿；修复此键名需同步检查既有调用方。
7. **插件实例生命周期**：插件在 `registerJSApi()` 每次 Activity 创建时 new 一份，但 `PureX5WebViewActivity` 是 `singleTask` 保活（`onNewIntent` 仅 URL 变化时重载页面），**插件实例和它的成员字段会跨"页面会话"残留**。插件若存 `callbackId` 等状态字段，须在 `jsCallNative` 入口重置，防止旧回调串扰。
8. **参数校验**：原生插件收到的是字符串，`new JSONObject(requestParams)` 可能抛异常 → 必须 try-catch 并 `reportFail` / `return ErrorJson(...)`，不得让异常逃逸（逃逸时 JSBridge 会兜底回调 fail，但错误信息丢失）。
9. **页面必须先加载 `jsbridge.js`**（`<script src='jsbridge.js'></script>`）才能用 `window.jsbridge`；直接用 `window.Android` 则不需要。

### 3.1 网页端零初始化（无握手、无 ready 事件）

本框架与 Cordova（`deviceready`）/ DSBridge（`init()`）/ WebViewJavascriptBridge（setup 握手）不同，**网页端不需要任何初始化步骤**，原因是原生侧就绪时序天然早于页面 JS：

```
BaseWebViewActivity 生命周期（BaseWebViewActivity.java:246-249）:
  initWebViewClient();
  registerJSApi();        // ① new JSBridge(mWebView) → addJavascriptInterface(this, "Android")
                          // ② 14 个插件全部注册进 map
  mWebView.loadUrl(url);  // ③ 页面这才开始加载 —— ①② 一定先于页面任何 JS 执行
```

- `window.Android` 注入先于页面脚本 → 页面任何时刻直接调 `Android.messageSend(...)` 都不会遇到"对象未注入"
- 插件注册表先于页面就绪 → 不存在"页面比原生先到"的竞态
- `jsbridge.js` 是纯工具 IIFE：定义函数 + 挂 `window.jsbridge`，无状态、无等待、无 `ready` 回调

网页端唯一要做的就是引入封装库，随后随处可调：

```html
<script src='jsbridge.js'></script>
<script> jsbridge.getScreenInfo ? … : … /* 直接用, 无需等待 */ </script>
```

**AI agent 注意**：不要在 H5 代码里模仿其他框架加 `deviceready` 等待、`init()` 调用或 ready 握手逻辑——本框架用不上，加了反而引入不存在的时序依赖。

**唯一的间接时序坑（缓存，非握手）**：原生 `shouldInterceptRequest` 挂了 CacheWebView 强缓存，`jsbridge.js` 若以远程 URL 引用且原生刚更新过该文件，页面可能拿到缓存旧版。规避：业务部署时对 `jsbridge.js` 做版本化引用（`jsbridge.js?v=2`），或页面加载后同步调 `clearWebViewCache` 接口清缓存。

## 4. 双端调用时序（异步接口标准流）

```
JS                                      Native
│ var cbId = 'cb_3_1692…'
│ messageHandlers[cbId] = {success,fail,cancel,completion}
│ Android.messageSend("scanQrCode", cbId, "{}")
│───────────────────────────────────────▶ post 到 UI 线程
│                                        查 map → JSScanQrCode
│                                        setCallbackId/setRequestParams/setJSBridge
│                                        jsCallNative(cbId, "{}") 执行业务
│                                        （如 registerResultCallback + 拉起扫码）
│                                        业务完成: reportSuccess(cbId, json)
│◀─────────────────────────────────────── evaluateJavascript(
│                                          "jsbridge.callBackFromNative('cb_3_…','success','{…}')")
│ callBackFromNative: 取 success 闭包(dict), delete 字典项
```

Activity 结果/权限转发：插件调 `getBaseWebViewActivity().registerResultCallback(requestCode, this)` / `registerPermissionCallback(...)` 把自己挂到 Activity 的 map；Activity 的 `onActivityResult`（约 904 行）/ `onRequestPermissionsResult`（约 617 行）查 map 调插件的 `resultCallback()` / `permissionCallback()`。

## 5. 新增接口标准流程（AI agent 执行手册）

**Step 1 — 选类型**：需要回调/多结果/UI 操作 → 异步 `BaseJSPlugin`；纯数据查询、一问一答 → 同步 `BaseJSPluginSync`。

**Step 2 — 写插件类** `app/src/main/java/com/tencent/tbs/jsbridge/plugin/JsXxx.java`：

```java
package com.tencent.tbs.jsbridge.plugin;

import android.util.Log;
import com.tencent.tbs.jsbridge.BaseJSPlugin;
import org.json.JSONObject;

/** 简述功能。@date 2026/xx/xx */
public class JsXxx extends BaseJSPlugin {          // 异步示例；同步则 extends BaseJSPluginSync
	private static final String TAG = JsXxx.class.getSimpleName();

	@Override
	public void jsCallNative(String callbackId, String requestParams) {
		try {
			JSONObject param = new JSONObject(requestParams);
			String foo = param.getString("foo");           // 参数校验, 缺参走 catch
			// TODO: 业务逻辑（UI 线程；耗时业务自行开线程, 完成后回 UI 线程再 report）
			JSONObject rsp = new JSONObject();
			rsp.put("code", 0);
			rsp.put("data", "…");                          // ⚠️ 值中不得含单引号
			reportSuccess(callbackId, rsp.toString());     // 四态恰好选一
		} catch (Exception e) {
			Log.e(TAG, "jsCallNative failed", e);
			reportFail(callbackId, ErrorJson(e.getMessage()));
		}
	}
}
```

同步版核心差异：

```java
public class JsXxxSync extends BaseJSPluginSync {
	@Override
	public String jsCallNative(String requestParams) {   // 注意签名不同（无 callbackId）
		try {
			// 只做数据读取, 禁止碰 UI / WebView
			JSONObject rsp = new JSONObject();
			rsp.put("code", 0);
			return rsp.toString();                        // 必须 return JSON 字符串
		} catch (Exception e) {
			return ErrorJson(e.getMessage());
		}
	}
}
```

**Step 3 — 注册**：`BaseWebViewActivity.registerJSApi()` 末尾加一行：

```java
this.jsBridge.registerJSPlugin("xxxFunctionName", new JsXxx());
```

函数名用小驼峰动词开头（与既有 14 个一致）。

**Step 4 —（推荐）JS 封装**：`assets/webpage/jsbridge.js` 的 `window.jsbridge` 导出对象里加便捷方法：

```js
function xxxFunctionName(params) {
	sendToNative("xxxFunctionName", params, {
		"success": params["success"],
		"fail":    params["fail"],
		"cancel":  params["cancel"]        // 按需, 键名必须是四态之一
	});
}
```

同步封装：`return syncSendToNative("xxxFunctionName", params);`（返回 string，调用方自行 `JSON.parse`）。

**Step 5 — 演示页验证按钮**：`jsbridge_demo.html` 加：

```html
<input type="button" value="Xxx功能" onclick="doXxx();"/>
<script>
function doXxx() {
	jsbridge.xxxFunctionName({
		success: function (res) { alert(JSON.stringify(res)); },
		fail:    function (res) { alert("fail: " + JSON.stringify(res)); }
	});
}
</script>
```

**Step 6 — 构建 + 装机验证**（环境链细节见 CLAUDE.md「构建 / 运行 / 测试」节或 `/run-on-device` 技能）：

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jre"
$gradle = "C:\Users\lianghao\.gradle\wrapper\dists\gradle-7.0.2-bin\d3wre95zg80kt78nlh0qdrd7f\gradle-7.0.2\bin\gradle.bat"
& $gradle :app:assembleDebug
adb install -r app\build\outputs\apk\debug\app-debug.apk
# 演示页路径: file:///android_asset/webpage/jsbridge_demo.html
# 宫格「JsBridge」图标即指向 bridge_test 页; 或 adb shell am start 直开演示页 URL
adb logcat -s JsXxx:I BaseWebViewActivity:I
```

**Step 7 — 验证清单（全部通过才算完成）**：
- [ ] `BUILD SUCCESSFUL`
- [ ] 演示页按钮可点，success 回调拿到预期 JSON
- [ ] 缺参/异常路径回调 fail（可用错误参数试）
- [ ] 返回 JSON 不含单引号（含中文场景重点检查）
- [ ] logcat 能看到插件 TAG 日志
- [ ] 若改了 `jsbridge.js`：确认 IIFE 防重入未破坏（`window.jsbridge` 仍存在）

## 6. H5 侧调用规范与样例

### 6.0 无需初始化（先读）

网页端**零初始化**：无握手、无 `deviceready`、无 `init()`。引入 `jsbridge.js` 后即可直接调用（机制详见 §3.1）。唯一前置动作：

```html
<script src='jsbridge.js'></script>   <!-- 远程引用时建议版本化: jsbridge.js?v=2 (避 CacheWebView 旧缓存) -->
```

### 6.1 异步调用（业务主用）

```html
<script src='jsbridge.js'></script>
<script>
jsbridge.scanQrCode({
	success: function (res) { console.log("扫码结果:", res.code); },
	fail:    function (res) { console.error("扫码失败:", res); }
	// cancel / completion 按需提供; 不提供的态原生回调时会走 Android.hybrid 兜底(无害但丢失事件)
});
</script>
```

### 6.2 同步调用（注意返回是字符串）

```js
var raw = jsbridge.syncSendToNative("getScreenInfo", {});
var info = JSON.parse(raw);        // ⚠️ 必须手动 parse
console.log(info.width + "x" + info.height);
// 便捷封装同理: jsbridge.getMemoryCache("key") / jsbridge.rotateScreen("landscape")
```

### 6.3 环境检测：感知是否运行在 NexBox WebView 中

H5 可能被三类环境打开：NexBox WebView（目标环境）、手机/桌面浏览器、其他 App 的 WebView。检测方式按可靠性排序：

#### 方法一（首选）：UA 标识检测

原生侧在 WebView 初始化时向 UserAgent 追加了容器标识（`BaseWebViewActivity` 中 `setUserAgentString(原UA + HybridConstant.HYBRID_UA_FLAG)`，标识定义在 `HybridConstant.java`，格式 `NexBox/主版本.次版本`，当前为 `NexBox/1.0`）：

```js
var ua = navigator.userAgent;
var m = ua.match(/NexBox\/(\d+(?:\.\d+)*)/);   // 提取标识与版本
var inNexBox = !!m;
var appVersion = m ? m[1] : null;               // "1.0" — 可做版本灰度/兼容分支
```

优点：任何时点可读（同步、无异常风险）；能拿到 App 版本做特性开关；对 iframe 内嵌页面同样生效（UA 继承）。
注意：UA 可被用户/浏览器扩展伪造——对安全性敏感的判断（如支付）不要只依赖 UA。

#### 方法二：注入对象存在性检测

`window.Android` 仅在 NexBox WebView 中存在（`addJavascriptInterface` 注入，浏览器没有）：

```js
var inNexBox = !!window.Android;
```

优点：不可伪造（除非宿主真是 WebView 且恰好注入同名对象）。局限：判不出 App 版本；若未来 iOS 复用同一套 H5，iOS WKWebView 无此对象（可改判 `window.webkit.messageHandlers`）。

#### 方法三（不推荐）：通用 WebView 特征猜测

如 UA 含 `wv`/`Mobile` 等。误报率高（其他 App 的 WebView 也命中），只可作为辅助信号，不要单独使用。

#### 推荐组合（生产代码模板）

```js
var NexBoxEnv = (function () {
	var m = navigator.userAgent.match(/NexBox\/(\d+(?:\.\d+)*)/);
	return {
		inApp:     !!m || !!window.Android,   // UA 或注入对象任一命中即认定在 App 内
		version:   m ? m[1] : null,
		bridgeOk:  !!window.Android           // true 才可直接调 jsbridge/Android, 不会 ReferenceError
	};
})();

// 使用:
if (NexBoxEnv.bridgeOk) {
	jsbridge.scanQrCode({success: function (r) { alert(r.code); }});
} else {
	alert("请在 NexBox App 内使用扫码功能");   // 浏览器降级
}

// 版本开关示例:
if (NexBoxEnv.inApp && NexBoxEnv.version && parseFloat(NexBoxEnv.version) >= 1.0) {
	// 1.0+ 才有的调用
}
```

> **原生版本升级注意**：修改 `HYBRID_UA_FLAG` 版本号后，H5 侧按版本分支的逻辑要同步评估。UA 标识从 NexBox 1.0（2026-08）起生效，之前的包 UA 里没有 `NexBox/` 标记，只能靠方法二检测。

现存代码（`jsbridge.js` 与全部 demo 页）**没有**任何环境检测，浏览器直接打开会抛 `ReferenceError: Android is not defined`——新代码务必按本节模式先判断再调用。

### 6.4 不经封装直调（仅 fire-and-forget 场景）

```js
Android.openQRCodeScan();   // 无参数无回调, 只适合"触发即忘"的动作
```

### 6.5 现存调用范本（真实代码）

| 场景 | 位置 | 样式 |
|---|---|---|
| 异步+success/cancel | `jsbridge_demo.html:45-55` getGps | `jsbridge.getLocation({success, cancel})` |
| 异步+success/fail | `jsbridge_demo.html:57-66` scanQrCode | `jsbridge.scanQrCode({success: r=>r.code, fail})` |
| 同步取返回值 | `jsbridge_demo.html:68-71` rotateScreen | `retval.result` |
| 同步缓存读取 | `jsbridge_demo.html:40-43` | `jsbridge.getMemoryCache("aaaa")` |
| 直调原生 | `homePage.html:57,61` | `Android.openQRCodeScan()` |

## 7. 常见错误对照表（调试用）

| 症状 | 根因 | 处理 |
|---|---|---|
| JS 调用无任何反应、无报错 | 原生忘调 report → 回调挂起；或回调 JSON 含单引号导致 evaluateJavascript 语法错误 | 检查插件四态回调路径；logcat 过滤 `JSBridge`；返回值剔除/转义单引号 |
| `ReferenceError: Android is not defined` | 页面在浏览器打开（无注入对象） | §6.3 降级判断 |
| 异步成功但拿到 `undefined` | JS 侧没 parse（同步通道返回 string） | `JSON.parse(retval)` |
| 原生崩溃在插件里 | 同步插件碰了 UI（JS 线程）或异步插件参数未 catch | 检查基类选型；try-catch 全包 |
| 回调串到旧请求 | `PureX5WebViewActivity` 保活，插件 `callbackId` 成员残留 | `jsCallNative` 入口重置状态字段 |
| 同步调用返回 null | 插件不是 `BaseJSPluginSync` 子类 | 换基类或改走异步通道 |
| 修改 jsbridge.js 不生效 | WebView 缓存（CacheWebView 强缓存静态资源） | 调 `clearWebViewCache` 接口或重装 App |

## 8. AI agent 专用备忘

- **前端项目 AI agent**（本目录拷入前端仓库后的视角）：只需关心 `web/jsbridge.js`、§3 硬约束、§6 调用规范、§7 调试表。§5 新增接口流程涉及 Android 侧，需 Android 仓库配合，前端侧仅提前约定函数名与参数/回调结构。
- Android 仓库：`C:\Users\lianghao\github\news`；H5 业务项目另存（如 `~/github/elk_vue`，当前**未接入** JSBridge，接入时把 `web/jsbridge.js` 拷入其 public/static 目录并按 §6 规范调用）。
- 修改点固定五处（Android 侧）：插件类（新建）、`registerJSApi()`（+1 行）、`jsbridge.js`（+1 导出，注意同步到本目录 `web/jsbridge.js`）、`jsbridge_demo.html`（+1 按钮）、（可选）业务 H5。
- `jsbridge.js` 是 ES5 IIFE，无模块系统、无 TS 类型；勿引入 import/export。
- 原生插件目录里 `com.chaychan.news` 包为废弃新闻客户端代码，**勿在其中实现** JSBridge 功能。
- 完成后提交规范遵循 CLAUDE.md「Git 约定」（中文 commit、直推 master、未经允许禁止 commit/push）。
