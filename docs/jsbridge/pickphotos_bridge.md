# NexBox JSBridge pickPhotos 接口文档（相册选图）

> 本文档面向**人类开发者**和**AI agent 自动化开发**双读者，风格与约定对齐 `docs/jsbridge-dev-guide.md`（先读该指南 §3 硬约束与 §3.1 零初始化）与 `docs/camera_bridge.md`（姊妹接口 takePhoto）。
>
> 事实来源（修改代码后以代码为准）：
> - 插件实现：`app/src/main/java/com/tencent/tbs/jsbridge/plugin/JsPickPhotos.java`
> - 公共压缩工具：`.../jsbridge/plugin/PhotoCodecUtil.java`（与 takePhoto 共用）
> - JS 封装：`app/src/main/assets/webpage/jsbridge.js` 的 `pickPhotos`（镜像 `docs/web/jsbridge.js`）
> - 演示页：`app/src/main/assets/webpage/jsbridge_demo.html`（选照片按钮 + 多图预览）
> - 注册点：`BaseWebViewActivity.registerJSApi()` 一行 `registerJSPlugin("pickPhotos", new JsPickPhotos())`

---

## 1. 功能概述与最小调用

H5 拉起系统相册选择 **1..maxCount 张**照片（`ACTION_GET_CONTENT + image/*`，多选时 `EXTRA_ALLOW_MULTIPLE`），压缩后以 base64 数组**一次性**通过 success 回调回传。零初始化、零权限：

```html
<script src='jsbridge.js?v=3'></script>
<script>
jsbridge.pickPhotos({
	maxCount: 3,          // 默认 1 = 单选
	success: function (res) {
		res.photos.forEach(function (p) {
			if (p.error) { console.warn("一张失败:", p.error); return; }
			console.log(p.width + "x" + p.height + " " + p.size + "B");
			// 预览: "data:image/jpeg;base64," + p.base64
		});
	},
	fail:   function (res) { alert("失败 code=" + res.code); },
	cancel: function () { /* 用户在选择器按了返回 */ }
});
</script>
```

## 2. 接口契约

### 2.1 请求参数（H5 → 原生）

| 参数 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `maxCount` | int | 1 | 最多选择张数，上限 9；**1 = 单选 UI**（不放 EXTRA_ALLOW_MULTIPLE），>1 = 多选 UI |
| `quality` | int | 70 | JPEG 质量 10–100 |
| `maxWidth` | int | 1080 | 压缩后宽上限 px（等比适配框）；0 = 不缩放 |
| `maxHeight` | int | 1080 | 同上；上限 4096 |

参数缺失/非法回退默认值不报错。默认 1080 比 takePhoto 的 1280 更狠（多张叠加控总量）。

### 2.2 success 回调（原生 → H5）

| 字段 | 类型 | 说明 |
|---|---|---|
| `code` | int | 0 |
| `count` | int | 成功张数 |
| `pickedCount` | int | 用户实际选择张数（截断前） |
| `truncated` | bool | true = 选择超 maxCount 已截断取前 N 张 |
| `photos` | array | 每项二选一：成功项 `{base64, mimeType, width, height, size}` / 失败项 `{error}` |

photos 成功项字段（同 takePhoto，无 `path`——content Uri 无文件路径语义）：

| 字段 | 说明 |
|---|---|
| `base64` | 纯 base64（无前缀、无换行，`Base64.NO_WRAP`） |
| `mimeType` | 固定 `image/jpeg`（统一重编码） |
| `width` / `height` | **压缩后**尺寸 |
| `size` | JPEG 字节数 |

### 2.3 fail 错误码

| code | 场景 |
|---|---|
| 1 | 参数无法解析（默认值兜底下理论不触发） |
| 3 | 无相册 App（`ActivityNotFoundException`） |
| 4 | 选择器返回空 / 启动异常 |
| 5 | **全部**照片处理失败（部分失败走 photos 内 error 项，不整体 fail） |

（2 空缺，对齐 takePhoto 的"权限拒绝"编号——本接口零权限，用不到。）

### 2.4 cancel 回调

唯一触发：用户在选择器界面按返回键（`RESULT_CANCELED`），payload `{"reason":"user canceled"}`。

`completion` 态不使用。

### 2.5 单张失败容错语义

- 某张解码失败（HEIC 老设备 / 损坏文件 / 读取异常）→ 该位置放 `{error:"..."}` 项，**其余照常**；
- **≥1 张成功即整体 success**（用户已付出选择成本，部分成功好过全盘作废）；
- H5 侧按项检查 `p.error`；
- **全部失败才整体 fail code=5**。

## 3. 全链路时序

```
H5 JS                                Native (JsPickPhotos)
│ jsbridge.pickPhotos({maxCount:3})
│   Android.messageSend("pickPhotos", cbId, params)
│───────────────────────────────────▶ jsCallNative (UI)：① 重置状态 ② 解析参数(兜底)
│                                      （零权限，无权限门禁）
│                                      startPicker(): GET_CONTENT + image/*
│                                        maxCount>1 → EXTRA_ALLOW_MULTIPLE
│                                        （不包 createChooser，直接落默认相册）
│                                        registerResultCallback(0x030A)
│                                        startActivityForResult
│                                          (用户多选 N 张 / 返回键)
│                                      ◀── resultCallback
│                                      CANCELED → reportCancel ──────┐
│                                      OK → collectUris（ClipData 遍历
│                                        → getData 兜底）
│                                        → 超 maxCount 截断 + truncated
│                                        → executor 后台逐张：
│                                          openInputStream ×3（bounds 预读
│                                          → EXIF(InputStream) → 解码）
│                                          → inSampleSize 粗缩 → 转正
│                                          → 适配框精缩 → JPEG → base64(NO_WRAP)
│                                          单项失败 → {error} 项；预算守卫
│                                      reportSuccess(photos[]) ─────┤
│ ◀── evaluateJavascript("jsbridge.callBackFromNative('cb_…','success','{…}')")
│ 一次性消费字典（delete），photos 数组整体到达
```

## 4. 实现要点（AI agent 必读）

1. **一次性回调是框架硬约束**：`jsbridge.js` 的 `callBackFromNative` 取闭包后立即 `delete messageHandlers[id]`——**一个 callbackId 只能回调一次**，逐张推送不可行。多张照片必须拼进同一次 success 的 `photos` 数组。要"流式多图"需演进框架（多次 messageSend 反向调用），本期不做。
2. **总量预算守卫**：`evaluateJavascript` 超长字符串静默失败。累计 base64 > 2,000,000 字符即停止追加，后续项 `{error:"size budget exceeded"}`。默认参数（1080/q70）单张约 150–250KB，9 张 ≈ 1.8M 贴线但不超；只拦 quality:100 + 4096 + maxCount:9 的极端组合。
3. **超选截断策略**：选择器自身不限张数（EXTRA_ALLOW_MULTIPLE 只是允许），用户选了 5 张而 maxCount=3 → 截断取前 3 张（ClipData 顺序），payload 带 `truncated:true` + `pickedCount`——不静默丢弃也不整体 fail，H5 可提示。
4. **base64 必须 `Base64.NO_WRAP`**、error 文案必须 sanitize 单引号（铁律集中在 `PhotoCodecUtil`，见该类注释）。
5. **content Uri 三次开流**：① `openInputStream` + `decodeStream(inJustDecodeBounds)` 边界预读 → ② `ExifInterface(InputStream)` 读旋转（androidx 重载，content Uri 无文件路径）→ ③ `decodeStream` 粗缩解码。每个流 finally close。
6. **两段式缩放防 OOM**（同 takePhoto）：inSampleSize 粗缩（2 的幂）+ scaleToFit 精缩，禁止全尺寸解码。
7. **零权限**：系统选择器代选，返回 content Uri 自带临时读授权（targetSdk 29），无 EasyPermissions 门禁分支。Uri 读毕即弃（临时授权仅本次有效）。
8. **状态字段入口重置**（singleTask 保活残留防护，同 takePhoto）。
9. **requestCode / 权限码占用表**（续 camera_bridge.md）：

| 码 | 值 | 占用者 |
|---|---|---|
| Activity 结果 | 100 | FILE_CHOOSER |
| Activity 结果 | 49374 (0xC0DE) | zxing 扫码 |
| Activity 结果 | 0x0300–0x0308 | TBS demo 遗留 |
| Activity 结果 | 0x0309 | takePhoto |
| Activity 结果 | **0x030A** | **pickPhotos（本接口）** |
| 权限 | 0x0010–0x0018 | 相机/电话/录音等 |
| 权限 | 0x0019 | takePhoto |
| 权限 | 0x001A | （空闲，未占用） |

10. **GIF 取首帧转 JPEG**（有损，如需动图需另行演进）；**HEIC** 依赖平台解码器（API 28+），老设备解码失败落 per-item error。

## 5. 权限说明

**零权限**。`ACTION_GET_CONTENT` 由系统相册/选择器代选，返回的 content Uri 携带临时读授权，targetSdk 29 下无需 `READ_EXTERNAL_STORAGE`（manifest 里的存储权限声明是旧新闻客户端遗留）。对比 takePhoto 必须申请 CAMERA：相册路径连权限码都没占用。

## 6. H5 使用样例

### 6.1 多图预览（demo 页同款）

```js
jsbridge.pickPhotos({
	maxCount: 3,
	success: function (res) {
		if (res.truncated) {
			alert("仅取前 " + res.count + " 张（共选 " + res.pickedCount + " 张）");
		}
		var box = document.getElementById("gallery");
		box.innerHTML = "";
		res.photos.forEach(function (p) {
			if (p.error) { console.warn("跳过一张:", p.error); return; }
			var img = document.createElement("img");
			img.src = "data:image/jpeg;base64," + p.base64;
			box.appendChild(img);
		});
	},
	fail:   function (res) { alert("选图失败 code=" + res.code); },
	cancel: function () {}
});
```

### 6.2 批量上传（base64 → Blob → FormData）

```js
jsbridge.pickPhotos({
	maxCount: 9, quality: 70,
	success: function (res) {
		var fd = new FormData();
		var idx = 0;
		res.photos.forEach(function (p) {
			if (p.error) return;
			var bytes = Uint8Array.from(atob(p.base64), function (c) { return c.charCodeAt(0); });
			fd.append("files", new Blob([bytes], {type: p.mimeType}), "photo_" + (idx++) + ".jpg");
		});
		fetch("/api/upload/batch", {method: "POST", body: fd});
	},
	fail: function (res) { console.error("pickPhotos fail", res); }
});
```

### 6.3 浏览器降级

```js
if (window.Android || /NexBox\//.test(navigator.userAgent)) {
	jsbridge.pickPhotos({...});
} else {
	// 浏览器用 <input type="file" accept="image/*" multiple> 降级
}
```

## 7. 验证清单

模拟器备图：相机拍 3-4 张（顺带覆盖 EXIF），或 `adb push x.jpg /sdcard/Pictures/` + `adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///sdcard/Pictures/x.jpg`。logcat `-s JsPickPhotos:I`，CDP 注入调用（方法同 takePhoto 验证）：

- [ ] 构建 `BUILD SUCCESSFUL`
- [ ] 无参调用 → 单选 UI，photos.length=1
- [ ] maxCount=3 选 2 张 → count=2, truncated=false
- [ ] maxCount=3 选 5 张 → count=3, pickedCount=5, truncated=true
- [ ] 选择器返回键 → cancel
- [ ] 相机竖拍图（EXIF 旋转）→ 预览方向正确
- [ ] 回归 takePhoto（PhotoCodecUtil 抽取后行为不变）
- [ ] 回归扫码 / 文件选择器（onActivityResult 分发未被 0x030A 干扰）
- [ ] 极端参数（quality:100 + 4096 + maxCount:9）→ 预算守卫生效，多出项 error

真机注意：第三方相册 App 对 `EXTRA_ALLOW_MULTIPLE` 支持参差（不识别时退化为单选 UI，属降级非故障）；建议小米/华为/三星各一台。

## 8. 已知边界与演进

- **逐张推送不支持**（框架 callbackId 一次性消费）；大量图片场景的演进方向同 camera_bridge.md §8：`shouldInterceptRequest` 拦截虚拟 URL，H5 用普通 `<img>`/fetch 取图。
- **Uri 生命周期**：选择器返回的临时读授权仅本次有效，插件读毕即弃，不持久化（`takePersistableUriPermission` 无需）。
- **GIF**：解码取首帧转 JPEG（动图有损）；**HEIC**：API 28+ 平台可解，老设备落 per-item error。
- **与 `<input type=file multiple>` 的关系**：WebView 自带文件选择器（FILE_CHOOSER=100）仍可用，但走 `filePathCallback` 回 Uri 数组，H5 拿到的是 content Uri 字符串而非图片内容；pickPhotos 是"拿图内容"的 JSBridge 通道，两者并存。

## 9. 变更记录

| 日期 | 内容 |
|---|---|
| 2026-08-20 | 新增 pickPhotos 接口（插件 + jsbridge.js 封装 + demo 按钮）；抽取 PhotoCodecUtil 公共压缩工具（takePhoto 同步改用，纯重构） |
