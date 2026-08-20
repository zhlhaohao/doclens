# NexBox JSBridge takePhoto 接口文档（拍照）

> 本文档面向**人类开发者**和**AI agent 自动化开发**双读者，风格与约定对齐 `docs/jsbridge-dev-guide.md`（先读该指南的 §3 硬约束与 §3.1 零初始化，本文不重复）。
>
> 姊妹接口：相册选图 `pickPhotos`（多选、photos 数组一次性回传）见 `docs/pickphotos_bridge.md`。两接口共用 `PhotoCodecUtil` 压缩工具。
>
> 事实来源（修改代码后以代码为准）：
> - 插件实现：`app/src/main/java/com/tencent/tbs/jsbridge/plugin/JsTakePhoto.java`
> - FileProvider 声明：`app/src/main/AndroidManifest.xml`（authorities=`com.chaychan.news.fileprovider`）
> - Provider 路径：`app/src/main/res/x5/xml/file_paths.xml`（⚠️ res 目录被 sourceSets 重定向，xml 只能放 `res/x5/xml/`）
> - JS 封装：`app/src/main/assets/webpage/jsbridge.js` 的 `takePhoto`（镜像 `docs/web/jsbridge.js`）
> - 演示页：`app/src/main/assets/webpage/jsbridge_demo.html`（拍照按钮 + base64 预览）
> - 注册点：`BaseWebViewActivity.registerJSApi()` 一行 `registerJSPlugin("takePhoto", new JsTakePhoto())`

---

## 1. 功能概述与最小调用

H5 调用系统相机**仅拍照**（ACTION_IMAGE_CAPTURE，无录像），照片经压缩后以 **base64** 通过 success 回调回传。零初始化，引 `jsbridge.js` 即用：

```html
<script src='jsbridge.js?v=2'></script>
<script>
jsbridge.takePhoto({
	success: function (res) {
		// res.base64 = 纯 base64（无 dataURL 前缀）
		var img = document.createElement("img");
		img.src = "data:image/jpeg;base64," + res.base64;
		document.body.appendChild(img);
	},
	fail:   function (res) { alert("失败 code=" + res.code); },
	cancel: function (res) { /* 用户在相机界面按了返回 */ }
});
</script>
```

## 2. 接口契约

### 2.1 请求参数（H5 → 原生）

| 参数 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `quality` | int | 70 | JPEG 质量 10–100 |
| `maxWidth` | int | 1280 | 压缩后宽上限 px（与 maxHeight 构成等比适配框）；0 = 不缩放 |
| `maxHeight` | int | 1280 | 同上；上限 4096（防回调超长） |

参数缺失/非法**回退默认值不报错**——拍照本身可继续，不因参数笔误丢功能。

### 2.2 success 回调（原生 → H5）

| 字段 | 类型 | 说明 |
|---|---|---|
| `code` | int | 0 |
| `base64` | string | **纯 base64，无 `data:` 前缀、无换行**（`Base64.NO_WRAP`）。预览时自行拼前缀，上传/解码直接可用 |
| `mimeType` | string | 固定 `image/jpeg` |
| `path` | string | 原始文件绝对路径（逃生舱：原生侧/调试需要文件本体时用；https 页面无法直接加载） |
| `width` / `height` | int | **压缩后**尺寸（非原图） |
| `size` | int | JPEG 字节数（上传前校验用） |

默认参数产出：1280×960 @ q70 ≈ 150–350KB → base64 约 200–470KB。

### 2.3 fail 错误码

| code | 场景 |
|---|---|
| 1 | 参数完全无法解析（默认值兜底下理论不触发） |
| 2 | 相机权限被拒（含永久拒绝） |
| 3 | 无相机 App（`ActivityNotFoundException`） |
| 4 | 拍照失败（目录创建失败 / 输出为空且无缩略图兜底 / 启动异常） |
| 5 | 解码 / 压缩 / 编码异常 |

`error` 文案已剔除单引号（原生回调拼接约束，见指南 §3.1）。

### 2.4 cancel 回调

唯一触发：用户在相机界面按返回键（`RESULT_CANCELED`），payload `{"reason":"user canceled"}`。

`completion` 态本接口不使用（单次性事件）。

## 3. 全链路时序

```
H5 JS                                Native (JsTakePhoto)
│ jsbridge.takePhoto({quality,...})
│   Android.messageSend("takePhoto", cbId, params)
│───────────────────────────────────────▶ jsCallNative (UI 线程)
│                                        ① 重置状态字段  ② 解析参数(默认值兜底)
│                                        ③ EasyPermissions.hasPermissions(CAMERA)?
│                                          ├─ 已有 ──────────────┐
│                                          └─ 无 → registerPermissionCallback(0x0019)
│                                                  requestPermissions ──┐
│                              (用户点允许)                          │
│                                          ◀── permissionCallback(granted)
│                                          ◀────────────────────────┘
│                                        startCamera():
│                                          cache/jsbridge_photo/photo_<ts>.jpg
│                                          FileProvider.getUriForFile → content Uri
│                                          registerResultCallback(0x0309)
│                                          startActivityForResult(ACTION_IMAGE_CAPTURE)
│                                                            │
│                                              (用户拍照/按返回)│
│                                          ◀── resultCallback(RESULT_OK/CANCELED)
│                                          CANCELED → reportCancel ───────┐
│                                          OK → executor 后台:           │
│                                            缩略图兜底 → inSampleSize    │
│                                            粗缩 → EXIF 转正 → 适配框    │
│                                            精缩 → JPEG → base64(NO_WRAP)│
│                                          reportSuccess ────────────────┤
│ ◀── evaluateJavascript("jsbridge.callBackFromNative('cb_…','success','{…}')")
│ 按态取闭包执行, delete 字典项
```

权限拒绝链路：`onPermissionsDenied` → **插件转发**（`BaseWebViewActivity`，2026-08 修复的既有缺陷：此前 denied 不转发，H5 回调永久挂起）→ `permissionCallback(granted=false)` → `reportFail(code=2)`。

## 4. 实现要点（AI agent 必读）

1. **照片走 base64 的理由**：生产 H5 是 https 起源，加载 `file://` 子资源被 Web 安全模型拦截；`content://` 不支持 XHR/fetch。压缩后 base64 200–470KB 处于 `evaluateJavascript` 实测安全区（超大字符串会静默失败，无硬性文档限制）。若未来要传原图/大图，演进方向是 `shouldInterceptRequest` 拦截虚拟 URL（如 `https://jsbridge.local/photo/xxx.jpg`），本期不做。
2. **`Base64.encodeToString(..., Base64.NO_WRAP)` 不能改成默认**：默认 76 字符换行，`\n` 会破坏原生拼接出的单行 JS 字符串字面量（`JSBridge.callbackJS`），回调**静默丢失且无报错**。
3. **两段式缩放防 OOM**：先 `inJustDecodeBounds` + `inSampleSize` 粗缩（2 的幂），再 `createScaledBitmap` 精确到适配框。禁止直接 `decodeFile` 全尺寸（4000×3000 相机原图 ≈ 48MB 位图）。
4. **EXIF 旋转转正**：相机按拍摄方向写 EXIF 而非旋转像素；不转正则横竖照片方向错乱。`ORIENTATION_NORMAL` 直通。
5. **输出走 FileProvider + 应用私有 cache 目录**（`getCacheDir()/jsbridge_photo/`）：零存储权限（私有目录）、不污染相册、系统自动清理。跨进程传 `file://` Uri 在 targetSdk≥24 会抛 `FileUriExposedException`，故必须 content Uri。
6. **状态字段入口重置**：宿主 `PureX5WebViewActivity` singleTask 保活，插件实例跨"页面会话"残留；`jsCallNative` 必须先重置 `mCallbackId`/`mPhotoFile`/三参数，`permissionCallback`/`resultCallback` 入口判 `mCallbackId == null` 防残留误触发。
7. **requestCode / 权限码占用表**（后来者勿撞号）：

| 码 | 值 | 占用者 |
|---|---|---|
| Activity 结果 | 100 | FILE_CHOOSER（onShowFileChooser） |
| Activity 结果 | 49374 (0xC0DE) | zxing 扫码（JSScanQrCode） |
| Activity 结果 | 0x0300–0x0308 | TBS demo 遗留 |
| Activity 结果 | **0x0309** | **takePhoto（本接口）** |
| 权限 | 0x0010–0x0018 | 相机/电话/录音/通讯录/音视频/定位 |
| 权限 | **0x0019** | **takePhoto（本接口）** |

8. **解码压缩在单线程 executor**（IO 不占 UI 线程）；`reportXxx` 内部 `mWebView.post` 自回 UI 线程，后台线程直接调用安全。
9. **异常消息 sanitize**：`error` 字段统一 `replace("'", "")`——异常消息可能携带单引号，破坏拼接 JS。
10. **厂商兼容兜底**：个别相机 App 无视 `EXTRA_OUTPUT`，`resultCallback` 里检查输出文件为空时回退 `data.getExtras().get("data")` 缩略图。

## 5. 权限说明

- **必须运行时申请 `CAMERA`**：虽然官方 ACTION_IMAGE_CAPTURE 声明委托拍照不需要该权限，但 **manifest 已声明 CAMERA 的 App 若运行时未授予，相机 App 会拒绝把照片回传给调用方**（官方 Take Photos 文档规则），因此必须先申请。
- **存储权限零需求**：输出在应用私有 cache 目录经 FileProvider 暴露，`WRITE/READ_EXTERNAL_STORAGE` 均不需要（manifest 里的声明是旧新闻客户端遗留）。
- 权限被拒 → fail code=2，H5 可提示用户去设置开启。

## 6. H5 使用样例

### 6.1 预览（demo 页同款）

```js
jsbridge.takePhoto({
	quality: 70, maxWidth: 1280, maxHeight: 1280,
	success: function (res) {
		document.getElementById("preview").src = "data:image/jpeg;base64," + res.base64;
	},
	fail:   function (res) { alert("拍照失败 code=" + res.code); },
	cancel: function () { /* 静默或轻提示 */ }
});
```

### 6.2 上传服务器（base64 → Blob → FormData）

```js
jsbridge.takePhoto({
	success: function (res) {
		var byteChars = atob(res.base64);                 // 纯 base64 直接解码
		var byteArray = new Uint8Array(byteChars.length);
		for (var i = 0; i < byteChars.length; i++) {
			byteArray[i] = byteChars.charCodeAt(i);
		}
		var blob = new Blob([byteArray], {type: res.mimeType});
		var fd = new FormData();
		fd.append("file", blob, "photo.jpg");
		return fetch("/api/upload", {method: "POST", body: fd});
	},
	fail: function (res) { console.error("takePhoto fail", res); }
});
```

### 6.3 浏览器降级

```js
if (window.jsbridge && (window.Android || /NexBox\//.test(navigator.userAgent))) {
	jsbridge.takePhoto({...});
} else {
	// 浏览器可用 <input type="file" accept="image/*" capture="environment"> 降级
}
```
（环境检测详见 `jsbridge-dev-guide.md` §6.3。）

## 7. 验证清单

模拟器（AVD 虚拟相机 Camera=virtualscene）跑 `file:///android_asset/webpage/jsbridge_demo.html`，logcat `-s JsTakePhoto:I`：

- [ ] 构建 `BUILD SUCCESSFUL`（`file_paths.xml` 放错目录在此暴露）
- [ ] 首次拍照：权限弹窗允许 → 拍照 → success，img 预览方向正确（EXIF 验证），base64 长度 20–50 万
- [ ] 权限拒绝 → `fail {code:2}`（同时验证 onPermissionsDenied 转发修复）
- [ ] 相机界面返回 → `cancel`
- [ ] 二次拍照不再弹权限（hasPermissions 短路）
- [ ] `quality:100, maxWidth:4096` 极限参数 → 记录 base64 长度，>800KB 需调默认值
- [ ] 回归：扫码按钮正常（onActivityResult 分发未被 0x0309 干扰）
- [ ] 回归：`requestAudioVideoPermission` 拒绝路径也能回调（denied 转发修复的波及面）

真机注意：厂商相机 App 的 EXTRA_OUTPUT 合规性参差（缩略图兜底已覆盖）；EXIF 写法不一（`ORIENTATION_NORMAL` 直通已覆盖）；建议覆盖小米/华为/三星各一台。

## 8. 已知边界与演进

- **大图场景**：需要原图（无损）或多张连传时，base64 通道不合适 → 演进方向 `shouldInterceptRequest` 拦截虚拟 URL（H5 用普通 `<img src>`/fetch 访问 `https://jsbridge.local/photo/xxx.jpg`，原生从 cache 文件回流），可挂在现有 CacheWebView 拦截链上。
- **`path` 字段**：仅作逃生舱（原生侧/调试取文件），不提供 H5 读文件的新接口（https 页面读不到）。
- **多 WebView 页面并发拍照**：插件按 Activity 实例隔离，`PureX5WebViewActivity` 单实例 + X5WebViewActivity 多实例可并存，各自独立状态。
- **拍照产物清理**：cache 目录系统自动回收；如需即时清理可在 `startCamera` 前删 24h 前旧文件（当前未实现，按需加一行过滤）。

## 9. 变更记录

| 日期 | 内容 |
|---|---|
| 2026-08-20 | 新增 takePhoto 接口（插件 + FileProvider + jsbridge.js 封装 + demo 按钮）；顺带修复 `BaseWebViewActivity.onPermissionsDenied` 不转发插件的既有缺陷 |
| 2026-08-20 | 私有压缩工具抽取为 `PhotoCodecUtil` 公共类（纯重构，行为不变），与 pickPhotos 共用 |
