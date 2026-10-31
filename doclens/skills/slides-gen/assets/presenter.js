/* slides-gen 演示运行时 —— 零依赖，翻页 / 动画 / 备注 / 全屏 / 打印
   导航：→ ← 空格 PgUp PgDn Home End 点击 滚轮 滑动
   功能：N 备注  F 全屏  P 打印/导出PDF  H 隐藏提示
   QA 模式：URL 带 ?qa=1 —— 动画瞬时、元素常显，供视觉验收截图 */
(function () {
  "use strict";

  var params = new URLSearchParams(location.search);
  var QA = params.get("qa") === "1";

  var stage = document.getElementById("stage");
  var slides = Array.prototype.slice.call(document.querySelectorAll(".slide"));
  var progress = document.querySelector(".progress");
  var index = 0;
  var busy = false;
  var pendingSteps = [];   // 当前页待点击触发的动画元素

  if (!stage || !slides.length) return;
  if (QA) document.body.classList.add("qa-mode");

  // 画布尺寸由渲染器注入的 --slide-w/h 决定（16:9 / 4:3 / A4）
  var stageStyle = getComputedStyle(stage);
  var STAGE_W = parseFloat(stageStyle.width) || 1280;
  var STAGE_H = parseFloat(stageStyle.height) || 720;

  /* ---------------- 舞台缩放：任何窗口同构图 ---------------- */
  function fit() {
    var s = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
    stage.style.setProperty("--stage-scale", String(s));
  }
  window.addEventListener("resize", fit);
  fit();

  /* ---------------- 动画 ---------------- */

  function animClass(token) {
    // enter.fly-in -> anim-fly-in；emphasize.pulse -> anim-pulse；exit.fade -> anim-fade-out
    var parts = token.split(".");
    var kind = parts[0], name = parts[1] || "fade";
    if (kind === "exit") return "anim-" + name + (name.indexOf("out") < 0 ? "-out" : "");
    if (kind === "emphasize") return "anim-" + name;
    return "anim-" + name;      // enter.*
  }

  function play(el) {
    var token = el.getAttribute("data-anim") || "enter.fade";
    var dir = el.getAttribute("data-anim-dir") || "";
    if (token === "enter.appear") { el.classList.add("anim-done"); return; }
    // 字幕条特效：容器整体 fly-in，内部带 .sub-frag 的 span 逐片聚合（CSS 驱动，
    // 延迟由 style 内联 animation-delay 控制）
    if (el.classList && el.classList.contains("sub-banner")) {
      var frags = el.querySelectorAll(".sub-frag");
      frags.forEach(function (f, i) { setTimeout(function () { f.classList.add("f1"); }, 180 + i * 220); });
    }
    var cls = animClass(token);
    if (dir && cls === "anim-fly-in") cls += " dir-" + dir;
    if (dir && cls === "anim-fly-out") cls += " dir-" + dir;
    cls.split(/\s+/).filter(Boolean).forEach(function (c) { el.classList.add(c); });
    el.addEventListener("animationend", function () {
      cls.split(/\s+/).filter(Boolean).forEach(function (c) { el.classList.remove(c); });
      el.classList.add("anim-done");
    }, { once: true });
    // 安全网：animationend 丢失（如动画被中断/元素不可见）时兜底显示
    setTimeout(function () {
      if (!el.classList.contains("anim-done")) {
        cls.split(/\s+/).filter(Boolean).forEach(function (c) { el.classList.remove(c); });
        el.classList.add("anim-done");
      }
    }, 2000);
  }

  function collectSteps(slide) {
    var all = Array.prototype.slice.call(slide.querySelectorAll("[data-anim]"));
    var after = [], click = [], exits = [];
    all.forEach(function (el) {
      var token = el.getAttribute("data-anim") || "";
      if (token.indexOf("exit.") === 0) { exits.push(el); return; }
      if (el.getAttribute("data-anim-trigger") === "click") click.push(el);
      else after.push(el);
    });
    return { after: after, click: click, exits: exits };
  }

  function runAfter(slide) {
    var s = collectSteps(slide);
    if (QA) {
      s.after.concat(s.click).forEach(function (el) { el.classList.add("anim-done"); });
      pendingSteps = [];
      return;
    }
    // 等页面切换动画（is-entering, 420ms）播完再启动元素入场，
    // 否则元素动画在页面尚未可见时已播掉大半，观感是"闪一下"
    var base = slide.classList.contains("is-entering") ? 480 : 0;
    s.after.forEach(function (el, i) {
      var dl = parseFloat(el.getAttribute("data-anim-delay") || "0") * 1000 || 0;
      setTimeout(function () { play(el); }, base + i * 300 + dl);
    });
    pendingSteps = s.click.slice();
    // 无点击步骤时，页面所有元素在 after 序列后应可见
    if (!pendingSteps.length) return;
  }

  function resetSlide(slide) {
    Array.prototype.forEach.call(slide.querySelectorAll("[data-anim]"), function (el) {
      el.classList.remove("anim-done");
      el.className = el.className.replace(/\banim-[\w-]+(\s+dir-[\w-]+)?/g, "").trim();
    });
  }

  function runExits(slide, done) {
    var s = collectSteps(slide);
    if (QA || !s.exits.length) { done(); return; }
    s.exits.forEach(function (el) {
      var token = el.getAttribute("data-anim");
      var cls = animClass(token);
      var dir = el.getAttribute("data-anim-dir") || "";
      if (dir) cls += " dir-" + dir;
      cls.split(/\s+/).filter(Boolean).forEach(function (c) { el.classList.add(c); });
    });
    setTimeout(done, 440);
  }


  /* ---------------- 自适应缩放（字号阶梯）----------------
     不在连续区间二分，而是在设计好的阶梯上从大到小取档：
     body 22 → 20 → 17 → 15 → 13，对应 --fit 系数见 FIT_STEPS。
     这样同级元素跨页字号一致（全 deck 只有 5 种缩放态），且 body 永远落在档位上。
     缩到最小档仍溢出 → 打 data-fit-overflow，验收判「必须拆页」。 */
  var FIT_STEPS = [1, 0.909, 0.773, 0.682, 0.591];   // body: 22, 20, 17, 15, 13

  function overflowOf(slide) {
    var worst = 0;
    var boxes = slide.querySelectorAll(".slot-content,.col,.slide-inner,.slot-body-row");
    for (var i = 0; i < boxes.length; i++) {
      var el = boxes[i];
      if (getComputedStyle(el).display === "none") continue;
      var er = el.getBoundingClientRect();
      var kids = el.children;
      for (var j = 0; j < kids.length; j++) {
        var k = kids[j];
        if (getComputedStyle(k).display === "none") continue;
        var kr = k.getBoundingClientRect();
        if (kr.width < 1 && kr.height < 1) continue;
        worst = Math.max(worst, kr.bottom - er.bottom, er.top - kr.top);
      }
    }
    // 兜底：整页内容是否越过安全边距
    var inner = slide.querySelector(".slide-inner");
    if (inner) {
      var cs = getComputedStyle(slide);
      var sr = slide.getBoundingClientRect();
      var top = sr.top + (parseFloat(cs.paddingTop) || 0);
      var bottom = sr.bottom - (parseFloat(cs.paddingBottom) || 0);
      var ir = inner.getBoundingClientRect();
      if (ir.height > (bottom - top) + 2) worst = Math.max(worst, ir.height - (bottom - top));
    }
    return worst;
  }

  function autofit(slide) {
    var inner = slide.querySelector(".slide-inner");
    if (!inner) return 1;
    // 从最大档开始往下试，取第一个装得下的档位
    for (var i = 0; i < FIT_STEPS.length; i++) {
      var k = FIT_STEPS[i];
      slide.style.setProperty("--fit", String(k));
      if (overflowOf(slide) <= 2) {
        if (i === 0) {
          slide.removeAttribute("data-fit");
          slide.removeAttribute("data-fit-overflow");
        } else {
          slide.setAttribute("data-fit", String(k));
          slide.removeAttribute("data-fit-overflow");
        }
        return k;
      }
    }
    // 最小档仍溢出 → 保持最小档并标记，验收会判「必须拆页」
    slide.style.setProperty("--fit", String(FIT_STEPS[FIT_STEPS.length - 1]));
    slide.setAttribute("data-fit", String(FIT_STEPS[FIT_STEPS.length - 1]));
    slide.setAttribute("data-fit-overflow", "1");
    return FIT_STEPS[FIT_STEPS.length - 1];
  }
  window.__autofit = autofit;

  /* ---------------- 翻页 ---------------- */

  function renderProgress() {
    if (progress) progress.style.width = ((index + 1) / slides.length * 100) + "%";
    var pn = slides[index].querySelector(".pageno");
    if (pn) pn.textContent = (index + 1) + " / " + slides.length;
  }

  function go(target, dir) {
    if (busy || target === index || target < 0 || target >= slides.length) return;
    busy = true;
    var from = slides[index], to = slides[target];
    var finish = function () {
      from.classList.remove("is-active", "is-entering", "is-leaving");
      from.style.display = "none";
      index = target;
      to.style.display = "flex";
      to.classList.add("is-active");
      if (!QA) to.classList.add("is-entering");
      renderProgress();
      autofit(to);
      runAfter(to);
      location.hash = String(index + 1);
      busy = false;
    };
    if (QA) { finish(); return; }
    from.classList.add("is-leaving");
    setTimeout(finish, 260);
  }

  function next() {
    if (busy) return;
    if (pendingSteps.length) {          // 先消费本页点击动画
      var el = pendingSteps.shift();
      play(el);
      return;
    }
    var cur = slides[index];
    runExits(cur, function () { go(index + 1, 1); });
  }

  function prev() {
    if (busy) return;
    runExits(slides[index], function () { go(index - 1, -1); });
  }

  function jump(n) {
    // n: 1-based
    var to = Math.max(0, Math.min(slides.length - 1, n - 1));
    if (to !== index) {
      var from = slides[index];
      from.classList.remove("is-active", "is-entering", "is-leaving");
      from.style.display = "none";
      index = to;
    }
    var t = slides[index];
    t.style.display = "flex";
    t.classList.add("is-active");
    if (!QA) t.classList.add("is-entering");
    renderProgress();
    autofit(t);
    runAfter(t);
  }

  /* ---------------- 初始化 ---------------- */

  slides.forEach(function (s, i) {
    s.style.display = "none";
    s.classList.remove("is-active");
  });

  var start = parseInt((location.hash || "").replace("#", ""), 10);
  if (!isNaN(start)) index = Math.max(0, Math.min(slides.length - 1, start - 1));
  jump(index + 1);
  if (QA) {
    // 验收模式：等字体/图片就绪后打标记，供截图脚本等待
    var imgs = Array.prototype.slice.call(document.images);
    Promise.all(imgs.map(function (im) {
      return im.complete ? Promise.resolve() : new Promise(function (r) { im.onload = im.onerror = r; });
    })).then(function () {
      document.fonts && document.fonts.ready ? document.fonts.ready.then(markReady) : markReady();
    });
    function markReady() {
      autofit(slides[index]);          // 字体加载后重算（度量已变）
      document.body.setAttribute("data-qa-ready", "1");
    }
  }

  /* ---------------- 交互 ---------------- */

  document.addEventListener("keydown", function (e) {
    if (e.altKey || e.metaKey || e.ctrlKey) return;
    switch (e.key) {
      case "ArrowRight": case "ArrowDown": case " ": case "PageDown": case "Enter":
        e.preventDefault(); next(); break;
      case "ArrowLeft": case "ArrowUp": case "PageUp":
        e.preventDefault(); prev(); break;
      case "Home": e.preventDefault(); jump(1); break;
      case "End": e.preventDefault(); jump(slides.length); break;
      case "n": case "N": document.body.classList.toggle("show-notes"); break;
      case "f": case "F":
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
        break;
      case "p": case "P": window.print(); break;
      case "h": case "H": document.body.classList.toggle("hide-hint"); break;
      case "v": case "V":
        narration = !narration;
        document.body.classList.toggle("narration-on", narration);
        if (narration) playNarr(slides[index]); else stopNarr();
        break;
    }
  });

  stage.addEventListener("click", function (e) {
    if (e.target.closest("a")) return;         // 链接不翻页
    next();
  });
  stage.addEventListener("contextmenu", function (e) { e.preventDefault(); prev(); });

  var wheelLock = false;
  window.addEventListener("wheel", function (e) {
    if (wheelLock) return;
    if (Math.abs(e.deltaY) < 24) return;
    wheelLock = true;
    e.deltaY > 0 ? next() : prev();
    setTimeout(function () { wheelLock = false; }, 420);
  }, { passive: true });

  var tx = 0, ty = 0;
  window.addEventListener("touchstart", function (e) {
    tx = e.touches[0].clientX; ty = e.touches[0].clientY;
  }, { passive: true });
  window.addEventListener("touchend", function (e) {
    var dx = e.changedTouches[0].clientX - tx;
    var dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { dx < 0 ? next() : prev(); }
  }, { passive: true });

  window.addEventListener("hashchange", function () {
    var n = parseInt((location.hash || "").replace("#", ""), 10);
    if (!isNaN(n) && n - 1 !== index) jump(n);
  });

  // 字体/图片就绪后重算当前页（度量依赖字体，首屏可能偏大或偏小）
  function refitCurrent() { autofit(slides[index]); }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refitCurrent);
  window.addEventListener("load", refitCurrent);

  /* ---------------- 旁白模式（V 键）：每页自动播口播音频，读完自动翻页 ----------------
     音频由渲染器以 <audio class="narr" src=".../p01.mp3"> 注入每页。
     浏览器自动播放策略要求先有用户交互——所以必须按键开启，不能自动响。 */
  var narration = false;
  var narrAudio = null;   // 当前正在播的 <audio>

  function narrOf(slide) {
    return slide ? slide.querySelector("audio.narr") : null;
  }

  function stopNarr() {
    if (narrAudio) { try { narrAudio.pause(); } catch (e) {} narrAudio = null; }
  }

  function playNarr(slide) {
    stopNarr();
    if (!narration) return;
    var a = narrOf(slide);
    if (!a) { return; }             // 该页无音频：保持安静
    narrAudio = a;
    a.currentTime = 0;
    a.play().catch(function () { /* 被浏览器拦截：忽略，用户再按 V */ });
    a.onended = function () {
      narrAudio = null;
      // 读完自动翻下一页（最后一页不翻）
      if (index < slides.length - 1) next();
    };
  }

  // 翻页时接管音频：在 go() 的完成回调挂 playNarr——
  // next/prev/外部 jump 最终都走 go()，一处挂全链路生效
  var _origGo = go;
  go = function (target, dir) {
    _origGo(target, dir);
    // go 完成后当前页已切换；QA 模式同步完成，普通模式 260ms 过渡
    setTimeout(function () { playNarr(slides[index]); }, 300);
  };

  // 供外部（自动化/嵌入）调用
  window.deck = {
    next: next, prev: prev, go: jump,
    setNarration: function (on) { narration = !!on; document.body.classList.toggle("narration-on", narration); if (narration) playNarr(slides[index]); else stopNarr(); },
    get index() { return index; },
    get count() { return slides.length; }
  };
})();
