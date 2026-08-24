(function() {
	if (window.jsbridge) {
		return;
	}

	var messageHandlers = {};
	var uniqueId = 1;

	//同步调用Native
	function syncSendToNative(methodName, params) {
		var returnValue = Android.syndMessageSend(methodName,JSON.stringify(params));
		return returnValue;
	}

	//异步调用Native
	function sendToNative(methodName, params, callBackClosureDict) {
		var callbackClosureId = 'cb_' + (uniqueId++) + '_' + new Date().getTime();
		if (callBackClosureDict) {
			messageHandlers[callbackClosureId] = callBackClosureDict;
		};
		Android.messageSend(methodName,callbackClosureId,JSON.stringify(params));
	}

	function callBackFromNative(callbackClosureId, type, paramsString) {

		if (callbackClosureId) {
			var callBackClosureDict = messageHandlers[callbackClosureId];
			var closure = callBackClosureDict[type];
			delete messageHandlers[callbackClosureId];
			if (closure) {
				var dict = JSON.parse(paramsString);
				closure(dict);
			}
			else{
				Android.hybrid(callbackClosureId);
			};
		};
	}


	function getLocation(params) {
		var gpsType = params["type"];
		var successClosure = params["success"];
		var cancelClosure = params["cancel"];
		var failerClosure = params["failer"];

		sendToNative("getLocation",gpsType,{
			"success":successClosure,
			"cancel":cancelClosure,
			"fail":failerClosure
		});
	}

	function getMemoryCache(cacheKey) {
		return syncSendToNative("getMemoryCache",
			{
				"key":cacheKey
			});
	}

	function rotateScreen(orientation) {
		return syncSendToNative("rotateScreen",
			{
				"orientation":orientation
			});
	}

	function scanQrCode(params) {
		sendToNative("scanQrCode",{}, {
			"success": params["success"],
			"fail": params["fail"]
		});
	}

	function takePhoto(params) {
		params = params || {};
		sendToNative("takePhoto", {
			"quality":   params.quality   || 70,
			"maxWidth":  params.maxWidth  || 1280,
			"maxHeight": params.maxHeight || 1280
		}, {
			"success": params["success"],
			"fail":    params["fail"],
			"cancel":  params["cancel"]
		});
	}

	function pickPhotos(params) {
		params = params || {};
		sendToNative("pickPhotos", {
			"quality":   params.quality   || 70,
			"maxWidth":  params.maxWidth  || 1080,
			"maxHeight": params.maxHeight || 1080,
			"maxCount":  params.maxCount  || 1
		}, {
			"success": params["success"],
			"fail":    params["fail"],
			"cancel":  params["cancel"]
		});
	}

	//选文件并直传服务器（契约见 doclens docs/jsbridge/upload_bridge.md）；
	//uploadUrl 缺失原生回 fail 1，封装层不兜底（漏传是契约错误应当暴露）
	function pickAndUploadFiles(params) {
		params = params || {};
		sendToNative("pickAndUploadFiles", {
			"uploadUrl": params.uploadUrl || "",
			"destDir":   params.destDir   || "",
			"overwrite": !!params.overwrite,
			"maxCount":  params.maxCount  || 9,
			"cookieName": params.cookieName || ""
		}, {
			"success": params["success"],
			"fail":    params["fail"],
			"cancel":  params["cancel"]
		});
	}
	window.jsbridge = {
		syncSendToNative		: syncSendToNative,
		sendToNative 			: sendToNative,
		callBackFromNative		: callBackFromNative,
		getLocation				: getLocation,
		getMemoryCache			: getMemoryCache,
		rotateScreen			: rotateScreen,
		scanQrCode			    : scanQrCode,
		takePhoto				: takePhoto,
		pickPhotos				: pickPhotos,
		pickAndUploadFiles		: pickAndUploadFiles,
	};

})();
