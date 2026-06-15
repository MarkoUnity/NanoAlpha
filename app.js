(function () {
  "use strict";

  var sourceCanvas = document.getElementById("sourceCanvas");
  var leftResultCanvas = document.getElementById("leftResultCanvas");
  var resultCanvas = document.getElementById("resultCanvas");
  var alphaCanvas = document.getElementById("alphaCanvas");
  var maskCanvas = document.getElementById("maskCanvas");
  var edgeCanvas = document.getElementById("edgeCanvas");
  var sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
  var leftResultCtx = leftResultCanvas.getContext("2d");
  var resultCtx = resultCanvas.getContext("2d");
  var alphaCtx = alphaCanvas.getContext("2d");
  var maskCtx = maskCanvas.getContext("2d");
  var edgeCtx = edgeCanvas.getContext("2d");

  var controls = {
    file: document.getElementById("fileInput"),
    contrastFile: document.getElementById("contrastFileInput"),
    clearContrast: document.getElementById("clearContrastButton"),
    demo: document.getElementById("demoButton"),
    download: document.getElementById("downloadButton"),
    autoColor: document.getElementById("autoColorButton"),
    bgColor: document.getElementById("bgColorInput"),
    autoContrastColor: document.getElementById("autoContrastColorButton"),
    contrastBgColor: document.getElementById("contrastBgColorInput"),
    probe: document.getElementById("probeInput"),
    tolerance: document.getElementById("toleranceInput"),
    edge: document.getElementById("edgeInput"),
    softness: document.getElementById("softnessInput"),
    refine: document.getElementById("refineInput"),
    holes: document.getElementById("holesInput"),
    decontam: document.getElementById("decontamInput"),
    erode: document.getElementById("erodeInput"),
    clip: document.getElementById("clipInput"),
    simpleRemove: document.getElementById("simpleRemoveInput"),
    simpleCleanup: document.getElementById("simpleCleanupInput"),
    simpleSoftness: document.getElementById("simpleSoftnessInput"),
    simpleHoles: document.getElementById("simpleHolesInput"),
    dualAlphaCutoff: document.getElementById("dualAlphaCutoffInput"),
    dualAlphaCombine: document.getElementById("dualAlphaCombineInput"),
    dualRecovery: document.getElementById("dualRecoveryInput"),
    dualDiffGate: document.getElementById("dualDiffGateInput"),
    dualDiffGateSoft: document.getElementById("dualDiffGateSoftInput"),
    dualDiffMetric: document.getElementById("dualDiffMetricInput"),
    previewBgColor: document.getElementById("previewBgColorInput"),
    alphaBrushSize: document.getElementById("alphaBrushSizeInput"),
    alphaUndo: document.getElementById("alphaUndoButton"),
    alphaReset: document.getElementById("alphaResetButton")
  };

  var labels = {
    status: document.getElementById("statusText"),
    probe: document.getElementById("probeValue"),
    tolerance: document.getElementById("toleranceValue"),
    edge: document.getElementById("edgeValue"),
    softness: document.getElementById("softnessValue"),
    refine: document.getElementById("refineValue"),
    decontam: document.getElementById("decontamValue"),
    erode: document.getElementById("erodeValue"),
    clip: document.getElementById("clipValue"),
    simpleRemove: document.getElementById("simpleRemoveValue"),
    simpleCleanup: document.getElementById("simpleCleanupValue"),
    simpleSoftness: document.getElementById("simpleSoftnessValue"),
    dualAlphaCutoff: document.getElementById("dualAlphaCutoffValue"),
    dualDiffGate: document.getElementById("dualDiffGateValue"),
    dualDiffGateSoft: document.getElementById("dualDiffGateSoftValue"),
    alphaBrushSize: document.getElementById("alphaBrushSizeValue"),
    sourceStatus: document.getElementById("sourceStatusText"),
    contrastStatus: document.getElementById("contrastStatusText"),
    mode: document.getElementById("modeText"),
    detectedColor: document.getElementById("detectedColorText"),
    uniformity: document.getElementById("uniformityText"),
    background: document.getElementById("backgroundText"),
    erodeRadius: document.getElementById("erodeRadiusText"),
    time: document.getElementById("timeText")
  };

  var leftPreviewLabel = document.getElementById("leftPreviewLabel");
  var sourceDropZone = document.getElementById("sourceDropZone");
  var contrastDropZone = document.getElementById("contrastDropZone");
  var dropZone = document.getElementById("dropZone");
  var dropHint = document.getElementById("dropHint");
  var zoomHint = document.getElementById("zoomHint");
  var outputStage = document.getElementById("outputStage");
  var sourceStage = document.querySelector(".source-stage");
  var previewStages = [sourceStage, outputStage];
  var tabs = Array.prototype.slice.call(document.querySelectorAll(".tab"));
  var bgTabs = Array.prototype.slice.call(document.querySelectorAll(".bg-tab"));
  var outputPanelLabel = document.getElementById("outputPanelLabel");
  var alphaTools = document.getElementById("alphaTools");
  var alphaBrushCursor = document.getElementById("alphaBrushCursor");
  var alphaToolButtons = Array.prototype.slice.call(document.querySelectorAll(".alpha-tool"));
  var controlModeTabs = Array.prototype.slice.call(document.querySelectorAll(".control-mode-tab"));
  var simpleControlsPanel = document.getElementById("simpleControls");
  var advancedControlsPanel = document.getElementById("advancedControls");
  var canvases = {
    result: resultCanvas,
    alpha: alphaCanvas,
    edge: edgeCanvas
  };

  var SQRT2 = Math.SQRT2;
  var INF = 1e9;
  var CHANNEL_EPSILON = 8;
  var ALPHA_EPSILON = 1 / 255;
  var DEMO_IMAGE_SRC = "assets/test-image.png";
  var PREVIEW_MAX_BASE_WIDTH = 760;
  var PREVIEW_MIN_ZOOM = 1;
  var PREVIEW_MAX_ZOOM = 12;
  var PREVIEW_ZOOM_RATE = 0.0015;
  var ALPHA_OVERRIDE_AUTO = 0;
  var ALPHA_OVERRIDE_ADD = 1;
  var ALPHA_OVERRIDE_ERASE = 2;
  var ALPHA_UNDO_LIMIT = 5;
  var DEFAULT_ALPHA_BRUSH_RADIUS = 14;
  var isSyncingPreviewScroll = false;
  var previewScrollSyncFrame = 0;
  var zoomHintTimer = 0;
  var zoomHintHiddenTimer = 0;
  var state = {
    sourceImageData: null,
    contrastImageData: null,
    contrastFileName: "",
    resultImageData: null,
    detection: null,
    contrastDetection: null,
    currentView: "result",
    controlMode: "simple",
    outputBgMode: "checker",
    zoomHintDismissed: false,
    processTimer: 0,
    colorIsManual: false,
    contrastColorIsManual: false,
    isSyncingSimpleControls: false,
    previewZoom: PREVIEW_MIN_ZOOM,
    alphaTool: "brush",
    alphaBrushRadius: DEFAULT_ALPHA_BRUSH_RADIUS,
    alphaOverrides: null,
    alphaOverrideCount: 0,
    alphaUndoStack: [],
    alphaCurrentStroke: null,
    alphaStrokeMarks: null,
    alphaStrokeId: 0,
    alphaBrushSpanRadius: 0,
    alphaBrushSpans: [],
    isPaintingAlpha: false,
    alphaPaintLastPoint: null
  };

  var SRGB_TO_LINEAR = new Float32Array(256);
  for (var i = 0; i < 256; i += 1) {
    var c = i / 255;
    SRGB_TO_LINEAR[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function smoothstep(edge0, edge1, x) {
    if (edge0 === edge1) {
      return x < edge0 ? 0 : 1;
    }
    var t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function linearToSrgb8(value) {
    var c = clamp(value, 0, 1);
    var srgb = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return clamp(Math.round(srgb * 255), 0, 255);
  }

  function rgbToOklab(r8, g8, b8) {
    var r = SRGB_TO_LINEAR[r8];
    var g = SRGB_TO_LINEAR[g8];
    var b = SRGB_TO_LINEAR[b8];
    var l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
    var m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
    var s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
    var lRoot = Math.cbrt(l);
    var mRoot = Math.cbrt(m);
    var sRoot = Math.cbrt(s);
    return {
      l: 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot,
      a: 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot,
      b: 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot
    };
  }

  function oklabDistanceScaled(sample, bg) {
    var dl = (sample.l - bg.l) * 1.2;
    var da = (sample.a - bg.a) * 1.85;
    var db = (sample.b - bg.b) * 1.85;
    return Math.sqrt(dl * dl + da * da + db * db) * 255;
  }

  function hexToRgb(hex) {
    var clean = hex.replace("#", "");
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16)
    };
  }

  function rgbToHex(rgb) {
    return "#" + [rgb.r, rgb.g, rgb.b].map(function (value) {
      return value.toString(16).padStart(2, "0");
    }).join("");
  }

  function countBits(value) {
    var count = 0;
    var v = value;
    while (v) {
      count += v & 1;
      v >>= 1;
    }
    return count;
  }

  function setStatus(text) {
    labels.status.textContent = text;
  }

  function setCanvasSize(canvas, width, height) {
    canvas.width = width;
    canvas.height = height;
  }

  function setAllCanvasSizes(width, height) {
    [sourceCanvas, leftResultCanvas, resultCanvas, alphaCanvas, maskCanvas, edgeCanvas].forEach(function (canvas) {
      setCanvasSize(canvas, width, height);
    });
    state.previewZoom = PREVIEW_MIN_ZOOM;
    resetAlphaOverrides(width, height);
    updatePreviewGeometry(false);
  }

  function resetAlphaOverrides(width, height) {
    state.alphaOverrides = {
      width: width,
      height: height,
      values: new Uint8Array(width * height)
    };
    state.alphaUndoStack = [];
    state.alphaOverrideCount = 0;
    state.alphaCurrentStroke = null;
    state.alphaStrokeMarks = new Int32Array(width * height);
    state.alphaStrokeId = 0;
    updateAlphaHistoryButtons();
  }

  function ensureAlphaOverrides(width, height) {
    if (
      !state.alphaOverrides ||
      state.alphaOverrides.width !== width ||
      state.alphaOverrides.height !== height
    ) {
      resetAlphaOverrides(width, height);
    }
    return state.alphaOverrides;
  }

  function updateAlphaHistoryButtons() {
    controls.alphaUndo.disabled = state.alphaUndoStack.length === 0;
    controls.alphaReset.disabled = !state.alphaOverrides || state.alphaOverrideCount === 0;
  }

  function beginAlphaStroke() {
    if (!state.sourceImageData) return;
    ensureAlphaOverrides(state.sourceImageData.width, state.sourceImageData.height);
    state.alphaStrokeId += 1;
    if (state.alphaStrokeId > 2000000000) {
      state.alphaStrokeMarks.fill(0);
      state.alphaStrokeId = 1;
    }
    state.alphaCurrentStroke = {
      id: state.alphaStrokeId,
      changes: []
    };
  }

  function rememberAlphaChange(index, previousValue) {
    var stroke = state.alphaCurrentStroke;
    if (!stroke) return;
    if (state.alphaStrokeMarks[index] === stroke.id) {
      return;
    }
    state.alphaStrokeMarks[index] = stroke.id;
    stroke.changes.push(index, previousValue);
  }

  function commitAlphaStroke() {
    var stroke = state.alphaCurrentStroke;
    state.alphaCurrentStroke = null;
    if (!stroke || !stroke.changes.length) {
      updateAlphaHistoryButtons();
      return false;
    }
    state.alphaUndoStack.push(stroke);
    if (state.alphaUndoStack.length > ALPHA_UNDO_LIMIT) {
      state.alphaUndoStack.shift();
    }
    updateAlphaHistoryButtons();
    return true;
  }

  function getPreviewFrame(stage) {
    return stage ? stage.querySelector(".canvas-frame") : null;
  }

  function readStagePadding(stage) {
    var styles = window.getComputedStyle(stage);
    return {
      left: parseFloat(styles.paddingLeft) || 0,
      right: parseFloat(styles.paddingRight) || 0,
      top: parseFloat(styles.paddingTop) || 0,
      bottom: parseFloat(styles.paddingBottom) || 0
    };
  }

  function getStageInnerSize(stage) {
    var padding = readStagePadding(stage);
    return {
      width: Math.max(1, stage.clientWidth - padding.left - padding.right),
      height: Math.max(1, stage.clientHeight - padding.top - padding.bottom)
    };
  }

  function getPreviewHeightCap() {
    var isCompact = window.matchMedia && window.matchMedia("(max-width: 620px)").matches;
    var cap = isCompact ? 360 : window.innerHeight - 174;
    return Math.max(220, cap);
  }

  function computePreviewBaseSize() {
    var width = sourceCanvas.width || 300;
    var height = sourceCanvas.height || 150;
    var availableWidth = Infinity;
    var availableHeight = getPreviewHeightCap();
    previewStages.forEach(function (stage) {
      var size = getStageInnerSize(stage);
      availableWidth = Math.min(availableWidth, size.width);
      if (size.height > 220) {
        availableHeight = Math.min(availableHeight, size.height);
      }
    });
    if (!isFinite(availableWidth) || availableWidth <= 0) {
      availableWidth = Math.min(width, PREVIEW_MAX_BASE_WIDTH);
    }
    if (!isFinite(availableHeight) || availableHeight <= 0) {
      availableHeight = height;
    }
    var scale = Math.min(
      availableWidth / width,
      availableHeight / height,
      PREVIEW_MAX_BASE_WIDTH / width,
      1
    );
    if (!isFinite(scale) || scale <= 0) {
      scale = 1;
    }
    return {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale))
    };
  }

  function getStageCenterRatio(stage) {
    var frame = getPreviewFrame(stage);
    if (!frame) {
      return { x: 0.5, y: 0.5 };
    }
    if (!frame.offsetWidth || !frame.offsetHeight) {
      return { x: 0.5, y: 0.5 };
    }
    return {
      x: clamp((stage.scrollLeft + stage.clientWidth / 2 - frame.offsetLeft) / frame.offsetWidth, 0, 1),
      y: clamp((stage.scrollTop + stage.clientHeight / 2 - frame.offsetTop) / frame.offsetHeight, 0, 1)
    };
  }

  function getPointerImageRatio(stage, event) {
    var frame = getPreviewFrame(stage);
    if (!frame) {
      return getStageCenterRatio(stage);
    }
    var frameRect = frame.getBoundingClientRect();
    if (!frameRect.width || !frameRect.height) {
      return getStageCenterRatio(stage);
    }
    return {
      x: clamp((event.clientX - frameRect.left) / frameRect.width, 0, 1),
      y: clamp((event.clientY - frameRect.top) / frameRect.height, 0, 1)
    };
  }

  function scrollStageToCenter(stage, center) {
    var frame = getPreviewFrame(stage);
    if (!frame) return;
    var targetLeft = frame.offsetLeft + frame.offsetWidth * center.x - stage.clientWidth / 2;
    var targetTop = frame.offsetTop + frame.offsetHeight * center.y - stage.clientHeight / 2;
    stage.scrollLeft = clamp(Math.round(targetLeft), 0, Math.max(0, stage.scrollWidth - stage.clientWidth));
    stage.scrollTop = clamp(Math.round(targetTop), 0, Math.max(0, stage.scrollHeight - stage.clientHeight));
  }

  function scrollStageToPointer(stage, ratio, clientX, clientY) {
    var frame = getPreviewFrame(stage);
    if (!frame) return;
    var stageRect = stage.getBoundingClientRect();
    var targetLeft = frame.offsetLeft + frame.offsetWidth * ratio.x - (clientX - stageRect.left);
    var targetTop = frame.offsetTop + frame.offsetHeight * ratio.y - (clientY - stageRect.top);
    stage.scrollLeft = clamp(Math.round(targetLeft), 0, Math.max(0, stage.scrollWidth - stage.clientWidth));
    stage.scrollTop = clamp(Math.round(targetTop), 0, Math.max(0, stage.scrollHeight - stage.clientHeight));
  }

  function lockPreviewScrollSync() {
    isSyncingPreviewScroll = true;
    if (previewScrollSyncFrame) {
      window.cancelAnimationFrame(previewScrollSyncFrame);
    }
    previewScrollSyncFrame = window.requestAnimationFrame(function () {
      previewScrollSyncFrame = 0;
      isSyncingPreviewScroll = false;
    });
  }

  function hideZoomHint() {
    window.clearTimeout(zoomHintTimer);
    zoomHint.classList.remove("is-visible");
    window.clearTimeout(zoomHintHiddenTimer);
    zoomHintHiddenTimer = window.setTimeout(function () {
      if (!zoomHint.classList.contains("is-visible")) {
        zoomHint.hidden = true;
      }
    }, 180);
  }

  function showZoomHint() {
    if (state.zoomHintDismissed) return;
    window.clearTimeout(zoomHintTimer);
    window.clearTimeout(zoomHintHiddenTimer);
    zoomHint.hidden = false;
    window.requestAnimationFrame(function () {
      zoomHint.classList.add("is-visible");
    });
    zoomHintTimer = window.setTimeout(hideZoomHint, 4600);
  }

  function dismissZoomHint() {
    state.zoomHintDismissed = true;
    hideZoomHint();
  }

  function updatePreviewGeometry(keepCenter, center) {
    var savedCenter = center || (keepCenter ? getStageCenterRatio(sourceStage) : { x: 0.5, y: 0.5 });
    var base = computePreviewBaseSize();
    var displayWidth = Math.max(1, Math.round(base.width * state.previewZoom));
    var displayHeight = Math.max(1, Math.round(base.height * state.previewZoom));
    dropZone.style.setProperty("--preview-frame-width", displayWidth + "px");
    dropZone.style.setProperty("--preview-frame-height", displayHeight + "px");
    previewStages.forEach(function (stage) {
      stage.classList.toggle("is-zoomed", state.previewZoom > PREVIEW_MIN_ZOOM + 0.001);
    });
    if (keepCenter) {
      lockPreviewScrollSync();
      previewStages.forEach(function (stage) {
        scrollStageToCenter(stage, savedCenter);
      });
    }
  }

  function syncPreviewScrollFrom(stage) {
    if (isSyncingPreviewScroll) return;
    var center = getStageCenterRatio(stage);
    lockPreviewScrollSync();
    previewStages.forEach(function (targetStage) {
      if (targetStage !== stage) {
        scrollStageToCenter(targetStage, center);
      }
    });
  }

  function zoomPreviewAt(stage, event) {
    var pointerRatio = getPointerImageRatio(stage, event);
    var oldZoom = state.previewZoom;
    var factor = Math.pow(1 + PREVIEW_ZOOM_RATE, -event.deltaY);
    if (!isFinite(factor) || factor <= 0) {
      factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
    }
    state.previewZoom = clamp(oldZoom * factor, PREVIEW_MIN_ZOOM, PREVIEW_MAX_ZOOM);
    if (Math.abs(state.previewZoom - oldZoom) < 0.001) {
      return;
    }
    updatePreviewGeometry(false);
    scrollStageToPointer(stage, pointerRatio, event.clientX, event.clientY);
    syncPreviewScrollFrom(stage);
    dismissZoomHint();
  }

  function handlePreviewWheel(event) {
    if (!state.sourceImageData) return;
    var stage = event.currentTarget;
    if (event.ctrlKey) {
      event.preventDefault();
      zoomPreviewAt(stage, event);
      return;
    }
    if (state.previewZoom <= PREVIEW_MIN_ZOOM + 0.001) {
      return;
    }
    var deltaScale = event.deltaMode === 1 ? 16 : (event.deltaMode === 2 ? stage.clientHeight : 1);
    var deltaX = event.deltaX * deltaScale;
    var deltaY = event.deltaY * deltaScale;
    if (event.shiftKey && Math.abs(deltaY) > Math.abs(deltaX)) {
      deltaX = deltaY;
      deltaY = 0;
    }
    if (!deltaX && !deltaY) {
      return;
    }
    event.preventDefault();
    stage.scrollLeft = clamp(stage.scrollLeft + deltaX, 0, Math.max(0, stage.scrollWidth - stage.clientWidth));
    stage.scrollTop = clamp(stage.scrollTop + deltaY, 0, Math.max(0, stage.scrollHeight - stage.clientHeight));
    syncPreviewScrollFrom(stage);
  }

  function setAlphaTool(tool) {
    state.alphaTool = tool === "eraser" ? "eraser" : "brush";
    alphaToolButtons.forEach(function (button) {
      var active = button.dataset.alphaTool === state.alphaTool;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    alphaBrushCursor.classList.toggle("is-eraser", state.alphaTool === "eraser");
  }

  function setAlphaBrushRadius(value) {
    state.alphaBrushRadius = clamp(Math.round(Number(value) || DEFAULT_ALPHA_BRUSH_RADIUS), 1, 96);
    controls.alphaBrushSize.value = String(state.alphaBrushRadius);
    labels.alphaBrushSize.textContent = state.alphaBrushRadius + " px";
    state.alphaBrushSpanRadius = 0;
  }

  function getAlphaBrushSpans() {
    if (state.alphaBrushSpanRadius === state.alphaBrushRadius && state.alphaBrushSpans.length) {
      return state.alphaBrushSpans;
    }
    var radius = state.alphaBrushRadius;
    var radiusSq = radius * radius;
    var spans = [];
    for (var dy = -radius; dy <= radius; dy += 1) {
      var reach = Math.floor(Math.sqrt(Math.max(0, radiusSq - dy * dy)));
      spans.push({ dy: dy, x0: -reach, x1: reach });
    }
    state.alphaBrushSpanRadius = radius;
    state.alphaBrushSpans = spans;
    return spans;
  }

  function getOutputImagePoint(event) {
    if (!state.sourceImageData) return null;
    var frame = getPreviewFrame(outputStage);
    if (!frame) return null;
    var rect = frame.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    var xRatio = (event.clientX - rect.left) / rect.width;
    var yRatio = (event.clientY - rect.top) / rect.height;
    if (xRatio < 0 || xRatio > 1 || yRatio < 0 || yRatio > 1) {
      return null;
    }
    return {
      x: clamp(Math.floor(xRatio * state.sourceImageData.width), 0, state.sourceImageData.width - 1),
      y: clamp(Math.floor(yRatio * state.sourceImageData.height), 0, state.sourceImageData.height - 1)
    };
  }

  function updateAlphaBrushCursor(event) {
    if (!canPaintAlpha()) {
      alphaBrushCursor.hidden = true;
      return;
    }
    var frame = getPreviewFrame(outputStage);
    if (!frame || !state.sourceImageData) {
      alphaBrushCursor.hidden = true;
      return;
    }
    var rect = frame.getBoundingClientRect();
    var x = event.clientX - rect.left;
    var y = event.clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
      alphaBrushCursor.hidden = true;
      return;
    }
    var diameterX = state.alphaBrushRadius * 2 * rect.width / state.sourceImageData.width;
    var diameterY = state.alphaBrushRadius * 2 * rect.height / state.sourceImageData.height;
    alphaBrushCursor.style.left = x + "px";
    alphaBrushCursor.style.top = y + "px";
    alphaBrushCursor.style.width = Math.max(4, diameterX) + "px";
    alphaBrushCursor.style.height = Math.max(4, diameterY) + "px";
    alphaBrushCursor.hidden = false;
  }

  function hideAlphaBrushCursor() {
    if (!state.isPaintingAlpha) {
      alphaBrushCursor.hidden = true;
    }
  }

  function drawAlphaPreviewCircle(point) {
    var mode = state.alphaTool === "eraser" ? ALPHA_OVERRIDE_ERASE : ALPHA_OVERRIDE_ADD;
    alphaCtx.save();
    alphaCtx.fillStyle = mode === ALPHA_OVERRIDE_ADD ? "#ffffff" : "#000000";
    alphaCtx.beginPath();
    alphaCtx.arc(point.x + 0.5, point.y + 0.5, state.alphaBrushRadius, 0, Math.PI * 2);
    alphaCtx.fill();
    alphaCtx.restore();
  }

  function drawAlphaPreviewLine(fromPoint, toPoint) {
    if (!fromPoint) {
      drawAlphaPreviewCircle(toPoint);
      return;
    }
    var mode = state.alphaTool === "eraser" ? ALPHA_OVERRIDE_ERASE : ALPHA_OVERRIDE_ADD;
    alphaCtx.save();
    alphaCtx.strokeStyle = mode === ALPHA_OVERRIDE_ADD ? "#ffffff" : "#000000";
    alphaCtx.lineWidth = state.alphaBrushRadius * 2;
    alphaCtx.lineCap = "round";
    alphaCtx.lineJoin = "round";
    alphaCtx.beginPath();
    alphaCtx.moveTo(fromPoint.x + 0.5, fromPoint.y + 0.5);
    alphaCtx.lineTo(toPoint.x + 0.5, toPoint.y + 0.5);
    alphaCtx.stroke();
    alphaCtx.restore();
  }

  function paintAlphaOverrideCircle(point) {
    var imageData = state.sourceImageData;
    if (!imageData || !point) return false;
    var overrides = ensureAlphaOverrides(imageData.width, imageData.height);
    var mode = state.alphaTool === "eraser" ? ALPHA_OVERRIDE_ERASE : ALPHA_OVERRIDE_ADD;
    var spans = getAlphaBrushSpans();
    var changed = false;

    for (var si = 0; si < spans.length; si += 1) {
      var span = spans[si];
      var y = point.y + span.dy;
      if (y < 0 || y >= imageData.height) {
        continue;
      }
      var row = y * imageData.width;
      var minX = Math.max(0, point.x + span.x0);
      var maxX = Math.min(imageData.width - 1, point.x + span.x1);
      for (var x = minX; x <= maxX; x += 1) {
        var index = row + x;
        if (overrides.values[index] !== mode) {
          rememberAlphaChange(index, overrides.values[index]);
          if (overrides.values[index] === ALPHA_OVERRIDE_AUTO && mode !== ALPHA_OVERRIDE_AUTO) {
            state.alphaOverrideCount += 1;
          } else if (overrides.values[index] !== ALPHA_OVERRIDE_AUTO && mode === ALPHA_OVERRIDE_AUTO) {
            state.alphaOverrideCount -= 1;
          }
          overrides.values[index] = mode;
          changed = true;
        }
      }
    }
    return changed;
  }

  function paintAlphaOverrideLine(fromPoint, toPoint) {
    if (!toPoint) return false;
    if (!fromPoint) {
      return paintAlphaOverrideCircle(toPoint);
    }
    var dx = toPoint.x - fromPoint.x;
    var dy = toPoint.y - fromPoint.y;
    var distance = Math.sqrt(dx * dx + dy * dy);
    var steps = Math.max(1, Math.ceil(distance / Math.max(1, state.alphaBrushRadius * 0.45)));
    var changed = false;
    for (var step = 1; step <= steps; step += 1) {
      var t = step / steps;
      changed = paintAlphaOverrideCircle({
        x: Math.round(lerp(fromPoint.x, toPoint.x, t)),
        y: Math.round(lerp(fromPoint.y, toPoint.y, t))
      }) || changed;
    }
    return changed;
  }

  function canPaintAlpha() {
    return state.currentView === "alpha" && Boolean(state.sourceImageData);
  }

  function handleAlphaPaintStart(event) {
    if (!canPaintAlpha() || event.button !== 0) {
      return;
    }
    updateAlphaBrushCursor(event);
    var point = getOutputImagePoint(event);
    if (!point) {
      return;
    }
    event.preventDefault();
    state.isPaintingAlpha = true;
    state.alphaPaintLastPoint = point;
    beginAlphaStroke();
    outputStage.setPointerCapture(event.pointerId);
    if (paintAlphaOverrideCircle(point)) {
      drawAlphaPreviewCircle(point);
    }
  }

  function handleAlphaPaintMove(event) {
    if (canPaintAlpha()) {
      updateAlphaBrushCursor(event);
    }
    if (!state.isPaintingAlpha || !canPaintAlpha()) {
      return;
    }
    var point = getOutputImagePoint(event);
    if (!point) {
      return;
    }
    event.preventDefault();
    if (paintAlphaOverrideLine(state.alphaPaintLastPoint, point)) {
      drawAlphaPreviewLine(state.alphaPaintLastPoint, point);
    }
    state.alphaPaintLastPoint = point;
  }

  function handleAlphaPaintEnd(event) {
    if (!state.isPaintingAlpha) {
      return;
    }
    state.isPaintingAlpha = false;
    state.alphaPaintLastPoint = null;
    if (event.pointerId !== undefined && outputStage.hasPointerCapture(event.pointerId)) {
      outputStage.releasePointerCapture(event.pointerId);
    }
    if (commitAlphaStroke()) {
      processNow();
    }
    if (event.clientX !== undefined) {
      updateAlphaBrushCursor(event);
    }
  }

  function restoreAlphaOverride(index, previousValue) {
    var overrides = state.alphaOverrides;
    if (!overrides || !overrides.values) return;
    var currentValue = overrides.values[index];
    if (currentValue === previousValue) return;
    if (currentValue !== ALPHA_OVERRIDE_AUTO && previousValue === ALPHA_OVERRIDE_AUTO) {
      state.alphaOverrideCount -= 1;
    } else if (currentValue === ALPHA_OVERRIDE_AUTO && previousValue !== ALPHA_OVERRIDE_AUTO) {
      state.alphaOverrideCount += 1;
    }
    overrides.values[index] = previousValue;
  }

  function undoAlphaStroke() {
    if (!state.alphaUndoStack.length) {
      return;
    }
    var stroke = state.alphaUndoStack.pop();
    for (var i = stroke.changes.length - 2; i >= 0; i -= 2) {
      restoreAlphaOverride(stroke.changes[i], stroke.changes[i + 1]);
    }
    state.alphaOverrideCount = Math.max(0, state.alphaOverrideCount);
    updateAlphaHistoryButtons();
    processNow();
  }

  function isEditableShortcutTarget(target) {
    if (!target) return false;
    if (target.isContentEditable) return true;
    if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA") return false;
    return ["text", "search", "url", "tel", "email", "password", "number"].indexOf(target.type) !== -1;
  }

  function handleKeyboardShortcuts(event) {
    var isUndo = (event.ctrlKey || event.metaKey) && !event.shiftKey && event.key && event.key.toLowerCase() === "z";
    if (!isUndo || isEditableShortcutTarget(event.target) || !state.alphaUndoStack.length) {
      return;
    }
    event.preventDefault();
    undoAlphaStroke();
  }

  function resetManualAlphaOverrides() {
    if (!state.sourceImageData || !state.alphaOverrides || state.alphaOverrideCount === 0) {
      return;
    }
    state.alphaOverrides.values.fill(ALPHA_OVERRIDE_AUTO);
    state.alphaOverrideCount = 0;
    state.alphaUndoStack = [];
    state.alphaCurrentStroke = null;
    updateAlphaHistoryButtons();
    processNow();
  }

  function updateLabels() {
    labels.probe.textContent = Number(controls.probe.value).toFixed(1) + "%";
    labels.tolerance.textContent = controls.tolerance.value;
    labels.edge.textContent = controls.edge.value + " px";
    labels.softness.textContent = controls.softness.value;
    labels.refine.textContent = controls.refine.value;
    labels.decontam.textContent = controls.decontam.value + "%";
    labels.erode.textContent = controls.erode.value + "%";
    labels.clip.textContent = controls.clip.value;
    updateSimpleLabels();
    labels.dualAlphaCutoff.textContent = controls.dualAlphaCutoff.value;
    labels.dualDiffGate.textContent = controls.dualDiffGate.value + "%";
    labels.dualDiffGateSoft.textContent = controls.dualDiffGateSoft.value + "%";
    labels.alphaBrushSize.textContent = state.alphaBrushRadius + " px";
    if (state.sourceImageData) {
      var maxRadius = computeErodeMaxRadius(state.sourceImageData.width, state.sourceImageData.height);
      var radius = computeErodeRadius(state.sourceImageData.width, state.sourceImageData.height, Number(controls.erode.value));
      labels.erodeRadius.textContent = radius + " px / " + maxRadius + " max";
    } else {
      labels.erodeRadius.textContent = "-";
    }
  }

  function computeErodeMaxRadius(width, height) {
    return Math.max(1, Math.round(Math.max(width, height) * 0.005));
  }

  function computeErodeRadius(width, height, erodePercent) {
    if (erodePercent <= 0) {
      return 0;
    }
    var maxRadius = computeErodeMaxRadius(width, height);
    return Math.max(1, Math.round((clamp(Number(erodePercent), 0, 100) / 100) * maxRadius));
  }

  function setControlMode(mode) {
    state.controlMode = mode === "advanced" ? "advanced" : "simple";
    controlModeTabs.forEach(function (tab) {
      tab.classList.toggle("is-active", tab.dataset.controlMode === state.controlMode);
    });
    simpleControlsPanel.hidden = state.controlMode !== "simple";
    advancedControlsPanel.hidden = state.controlMode !== "advanced";
  }

  function updateSimpleLabels() {
    labels.simpleRemove.textContent = controls.simpleRemove.value + "%";
    labels.simpleCleanup.textContent = controls.simpleCleanup.value + "%";
    labels.simpleSoftness.textContent = controls.simpleSoftness.value + "%";
  }

  function syncSimpleControlsFromAdvanced() {
    if (state.isSyncingSimpleControls) return;
    state.isSyncingSimpleControls = true;
    controls.simpleRemove.value = String(Math.round(Math.cbrt(clamp((Number(controls.tolerance.value) - 8) / 77, 0, 1)) * 100));
    controls.simpleCleanup.value = String(Math.round(clamp(Number(controls.decontam.value) / 100, 0, 1) * 100));
    controls.simpleSoftness.value = String(Math.round(clamp((Number(controls.softness.value) - 4) / 66, 0, 1) * 100));
    controls.simpleHoles.checked = controls.holes.checked;
    updateSimpleLabels();
    state.isSyncingSimpleControls = false;
  }

  function applySimpleControlsToAdvanced() {
    if (state.isSyncingSimpleControls) return;
    state.isSyncingSimpleControls = true;
    var remove = Number(controls.simpleRemove.value) / 100;
    var cleanup = Number(controls.simpleCleanup.value) / 100;
    var softness = Number(controls.simpleSoftness.value) / 100;
    controls.tolerance.value = String(Math.round(lerp(8, 85, remove * remove * remove)));
    controls.edge.value = String(Math.round(lerp(2, 18, softness)));
    controls.softness.value = String(Math.round(lerp(4, 70, softness)));
    controls.refine.value = String(Math.round(lerp(0, 4, cleanup)));
    controls.decontam.value = String(Math.round(lerp(0, 100, cleanup)));
    controls.erode.value = String(Math.round(lerp(0, 55, cleanup)));
    controls.clip.value = String(Math.round(lerp(0, 10, cleanup)));
    controls.dualAlphaCutoff.value = String(Math.round(lerp(0, 22, remove * 0.55 + cleanup * 0.45)));
    controls.dualDiffGate.value = String(Math.round(lerp(45, 8, remove)));
    controls.dualDiffGateSoft.value = String(Math.round(lerp(18, 6, cleanup)));
    controls.holes.checked = controls.simpleHoles.checked;
    updateSimpleLabels();
    state.isSyncingSimpleControls = false;
  }

  function switchView(view) {
    if (!canvases[view]) {
      view = "result";
    }
    state.currentView = view;
    tabs.forEach(function (tab) {
      tab.classList.toggle("is-active", tab.dataset.view === view);
    });
    Object.keys(canvases).forEach(function (key) {
      canvases[key].hidden = key !== view;
    });
    maskCanvas.hidden = true;
    var showLeftResult = view === "alpha" || view === "edge";
    sourceCanvas.hidden = showLeftResult;
    leftResultCanvas.hidden = !showLeftResult;
    leftPreviewLabel.textContent = showLeftResult ? "Result Preview" : "Source";
    var isAlphaView = view === "alpha";
    alphaTools.hidden = !isAlphaView;
    outputPanelLabel.hidden = isAlphaView;
    outputPanelLabel.textContent = view === "edge" ? "Edge Preview" : "Result Preview";
    outputStage.classList.toggle("is-alpha-editing", isAlphaView);
    if (view !== "alpha") {
      alphaBrushCursor.hidden = true;
    }
    updatePreviewBackgroundTargets();
  }

  function updatePreviewBackgroundTargets() {
    var showLeftResult = state.currentView === "alpha" || state.currentView === "edge";
    var resultStage = showLeftResult ? sourceStage : outputStage;
    previewStages.forEach(function (stage) {
      stage.classList.remove("checkerboard", "solid-background");
      stage.style.setProperty("--preview-solid-bg", controls.previewBgColor.value);
    });
    resultStage.classList.toggle("checkerboard", state.outputBgMode === "checker");
    resultStage.classList.toggle("solid-background", state.outputBgMode === "solid");
  }

  function switchOutputBackground(mode) {
    state.outputBgMode = mode === "solid" ? "solid" : "checker";
    bgTabs.forEach(function (tab) {
      tab.classList.toggle("is-active", tab.dataset.bgMode === state.outputBgMode);
    });
    updatePreviewBackgroundTargets();
  }

  function loadImageFromUrl(url, revokeWhenLoaded, sourceLabel) {
    var img = new Image();
    img.onload = function () {
      if (revokeWhenLoaded) {
        URL.revokeObjectURL(url);
      }
      setAllCanvasSizes(img.naturalWidth, img.naturalHeight);
      sourceCtx.clearRect(0, 0, img.naturalWidth, img.naturalHeight);
      sourceCtx.drawImage(img, 0, 0);
      try {
        state.sourceImageData = sourceCtx.getImageData(0, 0, img.naturalWidth, img.naturalHeight);
      } catch (error) {
        state.sourceImageData = null;
        leftResultCtx.clearRect(0, 0, leftResultCanvas.width, leftResultCanvas.height);
        resultCtx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);
        alphaCtx.clearRect(0, 0, alphaCanvas.width, alphaCanvas.height);
        maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
        edgeCtx.clearRect(0, 0, edgeCanvas.width, edgeCanvas.height);
        setStatus("Browser blocked canvas processing. Open via localhost or upload the image.");
        return;
      }
      if (state.contrastImageData && !hasCompatibleContrast()) {
        clearContrastImage(false);
        setStatus("Source loaded. Second image cleared because dimensions changed.");
      }
      runAutoDetection(false);
      if (state.contrastImageData && !state.contrastColorIsManual) {
        runContrastAutoDetection();
      }
      if (labels.sourceStatus) {
        labels.sourceStatus.textContent = sourceLabel || (img.naturalWidth + " x " + img.naturalHeight);
      }
      updateDualControlsState();
      processNow();
    };
    img.onerror = function () {
      if (revokeWhenLoaded) {
        URL.revokeObjectURL(url);
      }
      setStatus("Could not load image");
    };
    img.src = url;
  }

  function resetControlToDefault(control) {
    if (!control) {
      return;
    }
    if (control.type === "checkbox") {
      control.checked = control.defaultChecked;
      return;
    }
    control.value = control.defaultValue;
  }

  function resetProcessingSettings() {
    [
      controls.bgColor,
      controls.contrastBgColor,
      controls.probe,
      controls.simpleRemove,
      controls.simpleCleanup,
      controls.simpleSoftness,
      controls.simpleHoles,
      controls.dualAlphaCombine,
      controls.dualRecovery,
      controls.dualDiffMetric
    ].forEach(resetControlToDefault);
    state.colorIsManual = false;
    state.contrastColorIsManual = false;
    setControlMode("simple");
    applySimpleControlsToAdvanced();
    updateLabels();
  }

  function loadDemo() {
    resetProcessingSettings();
    if (state.contrastImageData) {
      clearContrastImage(false);
    }
    loadImageFromUrl(DEMO_IMAGE_SRC, false, "Demo image loaded");
  }

  function loadFile(file) {
    if (!file || !file.type || file.type.indexOf("image/") !== 0) {
      return;
    }
    loadImageFromUrl(URL.createObjectURL(file), true, file.name || "Source image loaded");
  }

  function detectBackground(imageData, probePct) {
    var data = imageData.data;
    var width = imageData.width;
    var height = imageData.height;
    var thickness = Math.max(1, Math.round(Math.min(width, height) * probePct / 100));
    var edgeEstimate = Math.max(1, 2 * thickness * width + 2 * thickness * height);
    var stride = Math.max(1, Math.ceil(Math.sqrt(edgeEstimate / 60000)));
    var samples = [];

    for (var y = 0; y < height; y += stride) {
      var top = y < thickness;
      var bottom = y >= height - thickness;
      for (var x = 0; x < width; x += stride) {
        var left = x < thickness;
        var right = x >= width - thickness;
        if (!top && !bottom && !left && !right) {
          continue;
        }
        var offset = (y * width + x) * 4;
        if (data[offset + 3] <= 1) {
          continue;
        }
        var r = data[offset];
        var g = data[offset + 1];
        var b = data[offset + 2];
        var lab = rgbToOklab(r, g, b);
        var side = 0;
        if (top) side |= 1;
        if (right) side |= 2;
        if (bottom) side |= 4;
        if (left) side |= 8;
        samples.push({ r: r, g: g, b: b, l: lab.l, a: lab.a, bb: lab.b, side: side });
      }
    }

    if (!samples.length) {
      return {
        rgb: { r: 240, g: 240, b: 244 },
        hex: "#f0f0f4",
        uniformity: 0,
        std: 0,
        tolerance: 28
      };
    }

    var k = Math.min(5, samples.length);
    var centers = [samples[0]];
    while (centers.length < k) {
      var bestIndex = 0;
      var bestDist = -1;
      for (var si = 0; si < samples.length; si += 1) {
        var minDist = INF;
        for (var ci = 0; ci < centers.length; ci += 1) {
          var dl = samples[si].l - centers[ci].l;
          var da = samples[si].a - centers[ci].a;
          var db = samples[si].bb - centers[ci].bb;
          var d = dl * dl + da * da + db * db;
          if (d < minDist) minDist = d;
        }
        if (minDist > bestDist) {
          bestDist = minDist;
          bestIndex = si;
        }
      }
      centers.push(samples[bestIndex]);
    }

    var assignments = new Int8Array(samples.length);
    var sums;
    for (var iter = 0; iter < 8; iter += 1) {
      sums = [];
      for (var init = 0; init < k; init += 1) {
        sums.push({ count: 0, l: 0, a: 0, bb: 0, r: 0, g: 0, b: 0, side: 0 });
      }
      for (var s = 0; s < samples.length; s += 1) {
        var best = 0;
        var bestD = INF;
        for (var c = 0; c < k; c += 1) {
          var lDiff = samples[s].l - centers[c].l;
          var aDiff = samples[s].a - centers[c].a;
          var bDiff = samples[s].bb - centers[c].bb;
          var cd = lDiff * lDiff + aDiff * aDiff + bDiff * bDiff;
          if (cd < bestD) {
            bestD = cd;
            best = c;
          }
        }
        assignments[s] = best;
        sums[best].count += 1;
        sums[best].l += samples[s].l;
        sums[best].a += samples[s].a;
        sums[best].bb += samples[s].bb;
        sums[best].r += samples[s].r;
        sums[best].g += samples[s].g;
        sums[best].b += samples[s].b;
        sums[best].side |= samples[s].side;
      }
      for (var u = 0; u < k; u += 1) {
        if (sums[u].count) {
          centers[u] = {
            l: sums[u].l / sums[u].count,
            a: sums[u].a / sums[u].count,
            bb: sums[u].bb / sums[u].count,
            r: sums[u].r / sums[u].count,
            g: sums[u].g / sums[u].count,
            b: sums[u].b / sums[u].count
          };
        }
      }
    }

    var clusterStats = [];
    for (var cs = 0; cs < k; cs += 1) {
      clusterStats.push({ count: 0, dist: 0, r: 0, g: 0, b: 0, side: 0 });
    }
    for (var js = 0; js < samples.length; js += 1) {
      var id = assignments[js];
      var center = centers[id];
      var dls = samples[js].l - center.l;
      var das = samples[js].a - center.a;
      var dbs = samples[js].bb - center.bb;
      clusterStats[id].count += 1;
      clusterStats[id].dist += dls * dls + das * das + dbs * dbs;
      clusterStats[id].r += samples[js].r;
      clusterStats[id].g += samples[js].g;
      clusterStats[id].b += samples[js].b;
      clusterStats[id].side |= samples[js].side;
    }

    var bestCluster = 0;
    var bestScore = -Infinity;
    for (var bc = 0; bc < k; bc += 1) {
      if (!clusterStats[bc].count) continue;
      var sides = countBits(clusterStats[bc].side);
      var std = Math.sqrt(clusterStats[bc].dist / clusterStats[bc].count) * 255;
      var sideBoost = sides >= 3 ? 1.35 : 0.88 + sides * 0.08;
      var score = clusterStats[bc].count * sideBoost / (1 + std * 0.035);
      if (score > bestScore) {
        bestScore = score;
        bestCluster = bc;
      }
    }

    var chosen = clusterStats[bestCluster];
    var rgb = {
      r: Math.round(chosen.r / chosen.count),
      g: Math.round(chosen.g / chosen.count),
      b: Math.round(chosen.b / chosen.count)
    };
    var chosenStd = Math.sqrt(chosen.dist / chosen.count) * 255;
    var uniformity = clamp(100 - chosenStd * 2.1, 0, 100);
    var recommendedTolerance = clamp(Math.round(chosenStd * 2.8 + 14), 8, 85);

    return {
      rgb: rgb,
      hex: rgbToHex(rgb),
      uniformity: uniformity,
      std: chosenStd,
      tolerance: recommendedTolerance,
      sampleCount: samples.length,
      sideCount: countBits(chosen.side)
    };
  }

  function runAutoDetection(applyTolerance) {
    if (!state.sourceImageData) return;
    var detection = detectBackground(state.sourceImageData, Number(controls.probe.value));
    state.detection = detection;
    controls.bgColor.value = detection.hex;
    if (applyTolerance) {
      controls.tolerance.value = detection.tolerance;
      syncSimpleControlsFromAdvanced();
    }
    state.colorIsManual = false;
    updateLabels();
    labels.detectedColor.textContent = detection.hex.toUpperCase();
    labels.uniformity.textContent = Math.round(detection.uniformity) + "%";
  }

  function runContrastAutoDetection() {
    if (!state.contrastImageData) return;
    var detection = detectBackground(state.contrastImageData, Number(controls.probe.value));
    state.contrastDetection = detection;
    controls.contrastBgColor.value = detection.hex;
    state.contrastColorIsManual = false;
    updateDualControlsState();
  }

  function hasCompatibleContrast() {
    return Boolean(
      state.sourceImageData &&
      state.contrastImageData &&
      state.sourceImageData.width === state.contrastImageData.width &&
      state.sourceImageData.height === state.contrastImageData.height
    );
  }

  function setDualControlAvailability(enabled) {
    [
      controls.autoContrastColor,
      controls.contrastBgColor,
      controls.dualAlphaCutoff,
      controls.dualAlphaCombine,
      controls.dualRecovery,
      controls.dualDiffGate,
      controls.dualDiffGateSoft,
      controls.dualDiffMetric
    ].forEach(function (control) {
      control.disabled = !enabled;
    });
    controls.clearContrast.disabled = !state.contrastImageData;
  }

  function updateDualControlsState() {
    var enabled = hasCompatibleContrast();
    setDualControlAvailability(enabled);
    if (!state.contrastImageData) {
      labels.contrastStatus.textContent = "Not added";
      labels.mode.textContent = "Single image";
      return;
    }
    if (!state.sourceImageData) {
      labels.contrastStatus.textContent = "Waiting for source";
      labels.mode.textContent = "Single image";
      return;
    }
    if (!enabled) {
      labels.contrastStatus.textContent = "Size mismatch";
      labels.mode.textContent = "Single image";
      return;
    }
    labels.contrastStatus.textContent = state.contrastFileName || "Ready";
  }

  function imageToImageData(img) {
    var canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    var ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, img.naturalWidth, img.naturalHeight);
  }

  function loadImageElementFromUrl(url, revokeWhenLoaded) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        if (revokeWhenLoaded) {
          URL.revokeObjectURL(url);
        }
        resolve(img);
      };
      img.onerror = function () {
        if (revokeWhenLoaded) {
          URL.revokeObjectURL(url);
        }
        reject(new Error("Could not load image"));
      };
      img.src = url;
    });
  }

  function clearContrastImage(shouldProcess) {
    state.contrastImageData = null;
    state.contrastFileName = "";
    state.contrastDetection = null;
    state.contrastColorIsManual = false;
    if (controls.contrastFile) {
      controls.contrastFile.value = "";
    }
    updateDualControlsState();
    if (shouldProcess && state.sourceImageData) {
      processNow();
    }
  }

  function loadContrastFile(file) {
    if (!file || !file.type || file.type.indexOf("image/") !== 0) {
      return;
    }
    if (!state.sourceImageData) {
      setStatus("Upload source image first");
      labels.contrastStatus.textContent = "Waiting for source";
      controls.contrastFile.value = "";
      return;
    }
    loadImageElementFromUrl(URL.createObjectURL(file), true).then(function (img) {
      if (img.naturalWidth !== state.sourceImageData.width || img.naturalHeight !== state.sourceImageData.height) {
        clearContrastImage(false);
        labels.contrastStatus.textContent = img.naturalWidth + " x " + img.naturalHeight;
        setStatus("Second image must match source dimensions");
        return;
      }
      try {
        state.contrastImageData = imageToImageData(img);
      } catch (error) {
        clearContrastImage(false);
        setStatus("Browser blocked second image processing");
        return;
      }
      state.contrastFileName = file.name || "Contrast image";
      runContrastAutoDetection();
      updateDualControlsState();
      processNow();
    }).catch(function () {
      clearContrastImage(false);
      setStatus("Could not load second image");
    });
  }

  function buildSourceEmptyMask(imageData) {
    var data = imageData.data;
    var pixelCount = imageData.width * imageData.height;
    var empty = new Uint8Array(pixelCount);
    var count = 0;
    for (var i = 0, p = 0; i < pixelCount; i += 1, p += 4) {
      if (data[p + 3] <= 1) {
        empty[i] = 1;
        count += 1;
      }
    }
    return { mask: empty, count: count };
  }

  function buildDistanceMap(imageData, bgRgb, sourceEmpty) {
    var data = imageData.data;
    var pixelCount = imageData.width * imageData.height;
    var distances = new Float32Array(pixelCount);
    var bgLab = rgbToOklab(bgRgb.r, bgRgb.g, bgRgb.b);
    for (var i = 0, p = 0; i < pixelCount; i += 1, p += 4) {
      if (sourceEmpty && sourceEmpty[i]) {
        distances[i] = 0;
        continue;
      }
      distances[i] = oklabDistanceScaled(rgbToOklab(data[p], data[p + 1], data[p + 2]), bgLab);
    }
    return distances;
  }

  function floodBackground(distances, width, height, tolerance, fillInternal, sourceEmpty) {
    var pixelCount = width * height;
    var bgMask = new Uint8Array(pixelCount);
    var queue = new Int32Array(pixelCount);
    var head = 0;
    var tail = 0;

    function enqueue(index) {
      if (!bgMask[index] && ((sourceEmpty && sourceEmpty[index]) || distances[index] <= tolerance)) {
        bgMask[index] = 1;
        queue[tail] = index;
        tail += 1;
      }
    }

    for (var x = 0; x < width; x += 1) {
      enqueue(x);
      enqueue((height - 1) * width + x);
    }
    for (var y = 0; y < height; y += 1) {
      enqueue(y * width);
      enqueue(y * width + width - 1);
    }

    while (head < tail) {
      var idx = queue[head];
      head += 1;
      var px = idx % width;
      if (px > 0) enqueue(idx - 1);
      if (px < width - 1) enqueue(idx + 1);
      if (idx >= width) enqueue(idx - width);
      if (idx < pixelCount - width) enqueue(idx + width);
    }

    var borderCount = tail;
    var outerMask = bgMask.slice();
    var holeCount = 0;
    if (sourceEmpty) {
      for (var known = 0; known < pixelCount; known += 1) {
        if (sourceEmpty[known] && !bgMask[known]) {
          bgMask[known] = 1;
          holeCount += 1;
        }
      }
    }
    if (fillInternal) {
      var visited = new Uint8Array(pixelCount);
      var component = new Int32Array(pixelCount);
      var growLimit = tolerance * 0.98;
      var seedLimit = tolerance * 0.7;
      for (var start = 0; start < pixelCount; start += 1) {
        if (visited[start] || bgMask[start] || distances[start] > seedLimit) {
          continue;
        }
        var componentCount = 0;
        var sum = 0;
        var touchesEdge = false;
        head = 0;
        tail = 0;
        visited[start] = 1;
        queue[tail] = start;
        tail += 1;
        while (head < tail) {
          var current = queue[head];
          head += 1;
          component[componentCount] = current;
          componentCount += 1;
          sum += distances[current];
          var cx = current % width;
          var cy = (current - cx) / width;
          if (cx === 0 || cy === 0 || cx === width - 1 || cy === height - 1) {
            touchesEdge = true;
          }
          var neighbors = [
            current - 1,
            current + 1,
            current - width,
            current + width
          ];
          for (var ni = 0; ni < neighbors.length; ni += 1) {
            var next = neighbors[ni];
            if (next < 0 || next >= pixelCount || visited[next] || bgMask[next]) {
              continue;
            }
            if ((ni === 0 && cx === 0) || (ni === 1 && cx === width - 1)) {
              continue;
            }
            if (distances[next] <= growLimit) {
              visited[next] = 1;
              queue[tail] = next;
              tail += 1;
            }
          }
        }
        if (!touchesEdge && componentCount > 4 && sum / componentCount <= tolerance * 0.62) {
          for (var ci = 0; ci < componentCount; ci += 1) {
            if (!bgMask[component[ci]]) {
              bgMask[component[ci]] = 1;
              holeCount += 1;
            }
          }
        }
      }
    }

    var totalBackground = 0;
    for (var bg = 0; bg < pixelCount; bg += 1) {
      totalBackground += bgMask[bg];
    }

    return {
      mask: bgMask,
      outerMask: outerMask,
      borderCount: borderCount,
      holeCount: holeCount,
      totalCount: totalBackground
    };
  }

  function chamferDistance(mask, width, height, targetValue) {
    var pixelCount = width * height;
    var dist = new Float32Array(pixelCount);
    for (var i = 0; i < pixelCount; i += 1) {
      dist[i] = mask[i] === targetValue ? 0 : INF;
    }

    for (var y = 0; y < height; y += 1) {
      var row = y * width;
      for (var x = 0; x < width; x += 1) {
        var idx = row + x;
        var best = dist[idx];
        if (x > 0) best = Math.min(best, dist[idx - 1] + 1);
        if (y > 0) best = Math.min(best, dist[idx - width] + 1);
        if (x > 0 && y > 0) best = Math.min(best, dist[idx - width - 1] + SQRT2);
        if (x < width - 1 && y > 0) best = Math.min(best, dist[idx - width + 1] + SQRT2);
        dist[idx] = best;
      }
    }

    for (var by = height - 1; by >= 0; by -= 1) {
      var brow = by * width;
      for (var bx = width - 1; bx >= 0; bx -= 1) {
        var bidx = brow + bx;
        var bbest = dist[bidx];
        if (bx < width - 1) bbest = Math.min(bbest, dist[bidx + 1] + 1);
        if (by < height - 1) bbest = Math.min(bbest, dist[bidx + width] + 1);
        if (bx < width - 1 && by < height - 1) bbest = Math.min(bbest, dist[bidx + width + 1] + SQRT2);
        if (bx > 0 && by < height - 1) bbest = Math.min(bbest, dist[bidx + width - 1] + SQRT2);
        dist[bidx] = bbest;
      }
    }

    return dist;
  }

  function erodeAlpha(alpha, width, height, radius) {
    var pixelCount = width * height;
    var eroded = new Float32Array(pixelCount);
    var r = Math.max(1, Math.round(radius));
    var rSq = r * r + r * 0.5;
    for (var y = 0; y < height; y += 1) {
      var row = y * width;
      for (var x = 0; x < width; x += 1) {
        var idx = row + x;
        var minA = alpha[idx];
        for (var dy = -r; dy <= r; dy += 1) {
          var ny = y + dy;
          if (ny < 0 || ny >= height) {
            continue;
          }
          var nrow = ny * width;
          for (var dx = -r; dx <= r; dx += 1) {
            if (dx * dx + dy * dy > rSq) {
              continue;
            }
            var nx = x + dx;
            if (nx < 0 || nx >= width) {
              continue;
            }
            var sample = alpha[nrow + nx];
            if (sample < minA) {
              minA = sample;
            }
          }
        }
        eroded[idx] = minA;
      }
    }
    return eroded;
  }

  function buildAlphaCoreMask(alpha, sourceEmpty, clip, erodedAlpha, erodeRadius) {
    var pixelCount = alpha.length;
    var core = new Uint8Array(pixelCount);
    var thresholds = [0.82, 0.68, 0.52, 0.36];
    var minDist = Math.max(1, erodeRadius * 0.2);

    function markCore(threshold) {
      var count = 0;
      for (var i = 0; i < pixelCount; i += 1) {
        core[i] = 0;
        if (sourceEmpty && sourceEmpty[i]) {
          continue;
        }
        if (alpha[i] * 255 <= clip) {
          continue;
        }
        if (erodedAlpha[i] >= threshold && alpha[i] - erodedAlpha[i] <= 0.08) {
          core[i] = 1;
          count += 1;
        }
      }
      return count;
    }

    var coreCount = 0;
    for (var ti = 0; ti < thresholds.length; ti += 1) {
      coreCount = markCore(thresholds[ti]);
      if (coreCount >= minDist) {
        break;
      }
    }
    return core;
  }

  function buildAlphaExtendMask(alpha, sourceEmpty, clip, erodedAlpha, distToCore, erodeRadius) {
    var pixelCount = alpha.length;
    var extend = new Uint8Array(pixelCount);
    if (erodeRadius <= 0) {
      return extend;
    }
    var shellThreshold = Math.max(0.006, 1 / Math.max(8, erodeRadius * 10));
    for (var i = 0; i < pixelCount; i += 1) {
      if (sourceEmpty && sourceEmpty[i]) {
        continue;
      }
      if (alpha[i] * 255 <= clip) {
        continue;
      }
      if (alpha[i] <= 0.01) {
        continue;
      }
      var shell = alpha[i] - erodedAlpha[i] > shellThreshold;
      var nearCore = distToCore[i] > 0 && distToCore[i] <= erodeRadius;
      if (shell || nearCore) {
        extend[i] = 1;
      }
    }
    return extend;
  }

  function readAlphaGradient(alpha, width, height, index) {
    var x = index % width;
    var y = (index - x) / width;
    var left = x > 0 ? index - 1 : index;
    var right = x < width - 1 ? index + 1 : index;
    var up = y > 0 ? index - width : index;
    var down = y < height - 1 ? index + width : index;
    return {
      gx: alpha[right] - alpha[left],
      gy: alpha[down] - alpha[up]
    };
  }

  function fillFromValidNeighbors(index, x, y, width, height, valid, rr, gg, bb, dist, alpha, searchRadius) {
    var grad = readAlphaGradient(alpha, width, height, index);
    var glen = Math.sqrt(grad.gx * grad.gx + grad.gy * grad.gy);
    var bestDist = INF;
    var bestR = 0;
    var bestG = 0;
    var bestB = 0;
    var found = false;
    var tangentReach = Math.max(4, Math.min(searchRadius, 24));

    if (glen > 0.0008) {
      var tx = -grad.gy / glen;
      var ty = grad.gx / glen;
      for (var sign = -1; sign <= 1; sign += 2) {
        for (var step = 1; step <= tangentReach; step += 1) {
          var sx = Math.round(x + tx * step * sign);
          var sy = Math.round(y + ty * step * sign);
          if (sx < 0 || sx >= width || sy < 0 || sy >= height) {
            continue;
          }
          var sidx = sy * width + sx;
          if (!valid[sidx]) {
            continue;
          }
          var candidateDist = dist[sidx] + step * 0.85;
          if (candidateDist < bestDist) {
            bestDist = candidateDist;
            bestR = rr[sidx];
            bestG = gg[sidx];
            bestB = bb[sidx];
            found = true;
          }
        }
      }
    }

    for (var dy = -1; dy <= 1; dy += 1) {
      var ny = y + dy;
      if (ny < 0 || ny >= height) {
        continue;
      }
      for (var dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) {
          continue;
        }
        var nx = x + dx;
        if (nx < 0 || nx >= width) {
          continue;
        }
        var nidx = ny * width + nx;
        if (!valid[nidx]) {
          continue;
        }
        var neighLen = Math.sqrt(dx * dx + dy * dy);
        var tangential = 1;
        if (glen > 0.0008) {
          var alignment = Math.abs(dx * grad.gx + dy * grad.gy) / (neighLen * glen);
          tangential = clamp(1.15 - alignment, 0.12, 1);
        }
        var candidateDist = dist[nidx] + neighLen / Math.max(0.2, tangential);
        if (candidateDist < bestDist) {
          bestDist = candidateDist;
          bestR = rr[nidx];
          bestG = gg[nidx];
          bestB = bb[nidx];
          found = true;
        }
      }
    }

    if (!found) {
      return false;
    }
    rr[index] = bestR;
    gg[index] = bestG;
    bb[index] = bestB;
    dist[index] = bestDist;
    valid[index] = 1;
    return true;
  }

  function propagateAlongEdgeColor(srcR, srcG, srcB, alpha, erodedAlpha, coreMask, extendMask, width, height, searchRadius, passes) {
    var pixelCount = width * height;
    var rr = new Float32Array(pixelCount);
    var gg = new Float32Array(pixelCount);
    var bb = new Float32Array(pixelCount);
    var dist = new Float32Array(pixelCount);
    var valid = new Uint8Array(pixelCount);
    var passCount = Math.max(3, passes || 3);

    for (var i = 0; i < pixelCount; i += 1) {
      if (coreMask[i]) {
        rr[i] = srcR[i];
        gg[i] = srcG[i];
        bb[i] = srcB[i];
        dist[i] = 0;
        valid[i] = 1;
      } else if (extendMask[i] && alpha[i] - erodedAlpha[i] <= 0.01) {
        rr[i] = srcR[i];
        gg[i] = srcG[i];
        bb[i] = srcB[i];
        dist[i] = 0.5;
        valid[i] = 1;
      } else {
        dist[i] = INF;
      }
    }

    for (var pass = 0; pass < passCount; pass += 1) {
      var filled = false;
      for (var y = 0; y < height; y += 1) {
        for (var x = 0; x < width; x += 1) {
          var idx = y * width + x;
          if (!extendMask[idx] || valid[idx]) {
            continue;
          }
          if (fillFromValidNeighbors(idx, x, y, width, height, valid, rr, gg, bb, dist, alpha, searchRadius)) {
            filled = true;
          }
        }
      }
      if (!filled) {
        break;
      }
    }

    for (var px = 0; px < pixelCount; px += 1) {
      if (!valid[px]) {
        rr[px] = srcR[px];
        gg[px] = srcG[px];
        bb[px] = srcB[px];
      }
    }

    return { r: rr, g: gg, b: bb, valid: valid };
  }

  function cleanSampleColor(r, g, b, a, bR, bG, bB) {
    if (a >= 0.995) {
      return { r: r, g: g, b: b };
    }
    var safeA = Math.max(a, 0.04);
    return {
      r: clamp((r - (1 - safeA) * bR) / safeA, 0, 1),
      g: clamp((g - (1 - safeA) * bG) / safeA, 0, 1),
      b: clamp((b - (1 - safeA) * bB) / safeA, 0, 1)
    };
  }

  function buildExtendedEdgeColors(imageData, alpha, bgRgb, erodeRadius, clip, sourceEmpty) {
    if (erodeRadius <= 0) {
      return null;
    }
    var width = imageData.width;
    var height = imageData.height;
    var pixelCount = width * height;
    var data = imageData.data;
    var bR = SRGB_TO_LINEAR[bgRgb.r];
    var bG = SRGB_TO_LINEAR[bgRgb.g];
    var bB = SRGB_TO_LINEAR[bgRgb.b];
    var erodedAlpha = erodeAlpha(alpha, width, height, erodeRadius);
    var coreMask = buildAlphaCoreMask(alpha, sourceEmpty, clip, erodedAlpha, erodeRadius);
    var distToCore = chamferDistance(coreMask, width, height, 1);
    var extendMask = buildAlphaExtendMask(alpha, sourceEmpty, clip, erodedAlpha, distToCore, erodeRadius);
    var srcR = new Float32Array(pixelCount);
    var srcG = new Float32Array(pixelCount);
    var srcB = new Float32Array(pixelCount);

    for (var i = 0, p = 0; i < pixelCount; i += 1, p += 4) {
      var a = clamp(alpha[i], 0, 1);
      var r = SRGB_TO_LINEAR[data[p]];
      var g = SRGB_TO_LINEAR[data[p + 1]];
      var b = SRGB_TO_LINEAR[data[p + 2]];
      if (a < 0.995 && a > 0.02) {
        var clean = cleanSampleColor(r, g, b, a, bR, bG, bB);
        r = clean.r;
        g = clean.g;
        b = clean.b;
      }
      srcR[i] = r;
      srcG[i] = g;
      srcB[i] = b;
    }

    var propagatePasses = erodeRadius > 24 ? 8 : (erodeRadius > 12 ? 6 : 4);
    var extended = propagateAlongEdgeColor(srcR, srcG, srcB, alpha, erodedAlpha, coreMask, extendMask, width, height, erodeRadius, propagatePasses);
    extended.extendMask = extendMask;
    extended.erodedAlpha = erodedAlpha;
    extended.distToCore = distToCore;
    return extended;
  }

  function buildForegroundSeeds(bgMask, distToBg, distances, tolerance, softness, edgeWidth) {
    var pixelCount = bgMask.length;
    var seeds = new Uint8Array(pixelCount);
    var minDistance = Math.max(2, edgeWidth * 0.85);
    var minColor = tolerance + softness * 0.2;
    var seedCount = 0;
    for (var i = 0; i < pixelCount; i += 1) {
      if (!bgMask[i] && distToBg[i] >= minDistance && (distances[i] >= minColor || distToBg[i] > edgeWidth * 1.35)) {
        seeds[i] = 1;
        seedCount += 1;
      }
    }
    if (seedCount < 32) {
      seedCount = 0;
      for (var j = 0; j < pixelCount; j += 1) {
        if (!bgMask[j]) {
          seeds[j] = 1;
          seedCount += 1;
        }
      }
    }
    return seeds;
  }

  function propagateNearestForegroundColor(imageData, seedMask) {
    var data = imageData.data;
    var width = imageData.width;
    var height = imageData.height;
    var pixelCount = width * height;
    var dist = new Float32Array(pixelCount);
    var rr = new Uint8Array(pixelCount);
    var gg = new Uint8Array(pixelCount);
    var bb = new Uint8Array(pixelCount);

    for (var i = 0, p = 0; i < pixelCount; i += 1, p += 4) {
      if (seedMask[i]) {
        dist[i] = 0;
        rr[i] = data[p];
        gg[i] = data[p + 1];
        bb[i] = data[p + 2];
      } else {
        dist[i] = INF;
      }
    }

    function copyIfBetter(index, neighbor, cost) {
      var candidate = dist[neighbor] + cost;
      if (candidate < dist[index]) {
        dist[index] = candidate;
        rr[index] = rr[neighbor];
        gg[index] = gg[neighbor];
        bb[index] = bb[neighbor];
      }
    }

    for (var pass = 0; pass < 2; pass += 1) {
      for (var y = 0; y < height; y += 1) {
        var row = y * width;
        for (var x = 0; x < width; x += 1) {
          var idx = row + x;
          if (x > 0) copyIfBetter(idx, idx - 1, 1);
          if (y > 0) copyIfBetter(idx, idx - width, 1);
          if (x > 0 && y > 0) copyIfBetter(idx, idx - width - 1, SQRT2);
          if (x < width - 1 && y > 0) copyIfBetter(idx, idx - width + 1, SQRT2);
        }
      }
      for (var by = height - 1; by >= 0; by -= 1) {
        var brow = by * width;
        for (var bx = width - 1; bx >= 0; bx -= 1) {
          var bidx = brow + bx;
          if (bx < width - 1) copyIfBetter(bidx, bidx + 1, 1);
          if (by < height - 1) copyIfBetter(bidx, bidx + width, 1);
          if (bx < width - 1 && by < height - 1) copyIfBetter(bidx, bidx + width + 1, SQRT2);
          if (bx > 0 && by < height - 1) copyIfBetter(bidx, bidx + width - 1, SQRT2);
        }
      }
    }

    for (var px = 0, po = 0; px < pixelCount; px += 1, po += 4) {
      if (dist[px] >= INF / 2) {
        rr[px] = data[po];
        gg[px] = data[po + 1];
        bb[px] = data[po + 2];
      }
    }

    return { r: rr, g: gg, b: bb, distance: dist };
  }

  function estimateAlpha(options) {
    var imageData = options.imageData;
    var data = imageData.data;
    var width = imageData.width;
    var height = imageData.height;
    var pixelCount = width * height;
    var bgMask = options.bgMask;
    var distances = options.distances;
    var nearest = options.nearest;
    var distToBg = options.distToBg;
    var distToFg = options.distToFg;
    var tolerance = options.tolerance;
    var softness = Math.max(1, options.softness);
    var edgeWidth = options.edgeWidth;
    var bgRgb = options.bgRgb;
    var alpha = new Float32Array(pixelCount);
    var bR = SRGB_TO_LINEAR[bgRgb.r];
    var bG = SRGB_TO_LINEAR[bgRgb.g];
    var bB = SRGB_TO_LINEAR[bgRgb.b];

    for (var i = 0, p = 0; i < pixelCount; i += 1, p += 4) {
      var nearBoundary = bgMask[i] ? distToFg[i] <= edgeWidth : distToBg[i] <= edgeWidth;
      if (!nearBoundary) {
        alpha[i] = bgMask[i] ? 0 : 1;
        continue;
      }

      var cR = SRGB_TO_LINEAR[data[p]];
      var cG = SRGB_TO_LINEAR[data[p + 1]];
      var cB = SRGB_TO_LINEAR[data[p + 2]];
      var fR = SRGB_TO_LINEAR[nearest.r[i]];
      var fG = SRGB_TO_LINEAR[nearest.g[i]];
      var fB = SRGB_TO_LINEAR[nearest.b[i]];
      var vR = fR - bR;
      var vG = fG - bG;
      var vB = fB - bB;
      var denom = vR * vR + vG * vG + vB * vB;
      var colorAlpha = smoothstep(tolerance * 0.18, tolerance + softness, distances[i]);
      var projected = colorAlpha;
      if (denom > 0.00002) {
        projected = ((cR - bR) * vR + (cG - bG) * vG + (cB - bB) * vB) / denom;
      }
      projected = clamp(projected, 0, 1);

      if (bgMask[i]) {
        alpha[i] = Math.min(projected, colorAlpha);
      } else {
        var keepBias = clamp(distToBg[i] / Math.max(1, edgeWidth * 0.65), 0, 1) * 0.35;
        alpha[i] = clamp(Math.max(projected * 0.9 + colorAlpha * 0.1, keepBias), 0, 1);
      }
    }

    return alpha;
  }

  function refineAlpha(alpha, imageData, bgMask, distToBg, distToFg, edgeWidth, iterations) {
    if (!iterations) {
      return alpha;
    }
    var data = imageData.data;
    var width = imageData.width;
    var height = imageData.height;
    var pixelCount = width * height;
    var src = alpha;
    var dst = new Float32Array(pixelCount);
    var sigmaSq = 42 * 42 * 2;

    for (var iter = 0; iter < iterations; iter += 1) {
      dst.set(src);
      for (var y = 0; y < height; y += 1) {
        for (var x = 0; x < width; x += 1) {
          var idx = y * width + x;
          var nearBoundary = bgMask[idx] ? distToFg[idx] <= edgeWidth + 1 : distToBg[idx] <= edgeWidth + 1;
          if (!nearBoundary) {
            dst[idx] = bgMask[idx] ? 0 : 1;
            continue;
          }

          var p = idx * 4;
          var cr = data[p];
          var cg = data[p + 1];
          var cb = data[p + 2];
          var sum = 0;
          var weightSum = 0;

          for (var dy = -1; dy <= 1; dy += 1) {
            var ny = y + dy;
            if (ny < 0 || ny >= height) continue;
            for (var dx = -1; dx <= 1; dx += 1) {
              var nx = x + dx;
              if (nx < 0 || nx >= width) continue;
              var nidx = ny * width + nx;
              var np = nidx * 4;
              var dr = cr - data[np];
              var dg = cg - data[np + 1];
              var db = cb - data[np + 2];
              var colorWeight = Math.exp(-(dr * dr + dg * dg + db * db) / sigmaSq);
              var spatialWeight = dx === 0 && dy === 0 ? 1.4 : (dx !== 0 && dy !== 0 ? 0.72 : 1);
              var weight = colorWeight * spatialWeight;
              sum += src[nidx] * weight;
              weightSum += weight;
            }
          }
          dst[idx] = clamp(sum / Math.max(0.0001, weightSum), 0, 1);
        }
      }
      var tmp = src;
      src = dst;
      dst = tmp;
    }

    for (var i = 0; i < pixelCount; i += 1) {
      if (bgMask[i] && distToFg[i] > edgeWidth) src[i] = 0;
      if (!bgMask[i] && distToBg[i] > edgeWidth) src[i] = 1;
    }

    return src;
  }

  function hasValidBgDiff(bgA, bgB) {
    return Math.abs(bgA.r - bgB.r) >= CHANNEL_EPSILON ||
      Math.abs(bgA.g - bgB.g) >= CHANNEL_EPSILON ||
      Math.abs(bgA.b - bgB.b) >= CHANNEL_EPSILON;
  }

  function combineAggregate(min, max, sum, count, mode) {
    if (!count) return 0;
    if (mode === "min") return min;
    if (mode === "max") return max;
    return sum / count;
  }

  function sampleDualForeground(offset, sourceData, contrastData, recovery) {
    if (recovery === "source") {
      return [sourceData[offset], sourceData[offset + 1], sourceData[offset + 2]];
    }
    if (recovery === "contrast") {
      return [contrastData[offset], contrastData[offset + 1], contrastData[offset + 2]];
    }
    return [
      Math.round((sourceData[offset] + contrastData[offset]) * 0.5),
      Math.round((sourceData[offset + 1] + contrastData[offset + 1]) * 0.5),
      Math.round((sourceData[offset + 2] + contrastData[offset + 2]) * 0.5)
    ];
  }

  function recoverDualForeground(offset, alpha, sourceBg, contrastBg, sourceData, contrastData, recovery) {
    var invA = 1 - alpha;
    var sourceBgValues = [sourceBg.r, sourceBg.g, sourceBg.b];
    var contrastBgValues = [contrastBg.r, contrastBg.g, contrastBg.b];
    var out = [0, 0, 0];
    for (var c = 0; c < 3; c += 1) {
      var fromSource = (sourceData[offset + c] - invA * sourceBgValues[c]) / alpha;
      var fromContrast = (contrastData[offset + c] - invA * contrastBgValues[c]) / alpha;
      var value = recovery === "source" ? fromSource : (recovery === "contrast" ? fromContrast : (fromSource + fromContrast) * 0.5);
      out[c] = clamp(Math.round(value), 0, 255);
    }
    return out;
  }

  function processDualPlate(sourceImageData, contrastImageData, options) {
    var width = sourceImageData.width;
    var height = sourceImageData.height;
    var pixelCount = width * height;
    var output = resultCtx.createImageData(width, height);
    var alpha = new Float32Array(pixelCount);
    var mattingWeights = new Float32Array(pixelCount);
    var sourceData = sourceImageData.data;
    var contrastData = contrastImageData.data;
    var out = output.data;
    var sourceBg = options.sourceBg;
    var contrastBg = options.contrastBg;
    var bgDiff = [
      sourceBg.r - contrastBg.r,
      sourceBg.g - contrastBg.g,
      sourceBg.b - contrastBg.b
    ];
    var cutoff = options.cutoff;
    var gateLow = options.gateLow;
    var gateHigh = Math.min(1, gateLow + options.gateSoft);
    var combine = options.combine;
    var metric = options.metric;
    var recovery = options.recovery;

    for (var i = 0, p = 0; i < pixelCount; i += 1, p += 4) {
      if (sourceData[p + 3] <= 1) {
        out[p] = 0;
        out[p + 1] = 0;
        out[p + 2] = 0;
        out[p + 3] = 0;
        alpha[i] = 0;
        continue;
      }

      var alphaMin = 1;
      var alphaMax = 0;
      var alphaSum = 0;
      var alphaCount = 0;
      var ratioMin = 1;
      var ratioMax = 0;
      var ratioSum = 0;
      var ratioCount = 0;

      for (var c = 0; c < 3; c += 1) {
        var diffBg = bgDiff[c];
        if (Math.abs(diffBg) < CHANNEL_EPSILON) {
          continue;
        }
        var obsDiff = sourceData[p + c] - contrastData[p + c];
        var ratio = Math.abs(obsDiff) / Math.abs(diffBg);
        var channelAlpha = clamp(1 - obsDiff / diffBg, 0, 1);
        alphaMin = Math.min(alphaMin, channelAlpha);
        alphaMax = Math.max(alphaMax, channelAlpha);
        alphaSum += channelAlpha;
        alphaCount += 1;
        ratioMin = Math.min(ratioMin, ratio);
        ratioMax = Math.max(ratioMax, ratio);
        ratioSum += ratio;
        ratioCount += 1;
      }

      var diffScore = combineAggregate(ratioMin, ratioMax, ratioSum, ratioCount, metric);
      var matteAlpha = combineAggregate(alphaMin, alphaMax, alphaSum, alphaCount, combine);
      var mattingWeight = smoothstep(gateLow, gateHigh, diffScore);
      var a = matteAlpha + (1 - matteAlpha) * (1 - mattingWeight);
      if (a < cutoff) {
        a = 0;
      }
      alpha[i] = a;
      mattingWeights[i] = mattingWeight;

      if (a <= ALPHA_EPSILON) {
        out[p] = 0;
        out[p + 1] = 0;
        out[p + 2] = 0;
        out[p + 3] = 0;
        continue;
      }

      var rgb;
      if (mattingWeight < 0.01) {
        rgb = sampleDualForeground(p, sourceData, contrastData, recovery);
      } else if (mattingWeight > 0.99) {
        rgb = recoverDualForeground(p, a, sourceBg, contrastBg, sourceData, contrastData, recovery);
      } else {
        var opaque = sampleDualForeground(p, sourceData, contrastData, recovery);
        var matte = recoverDualForeground(p, a, sourceBg, contrastBg, sourceData, contrastData, recovery);
        rgb = [
          Math.round(lerp(opaque[0], matte[0], mattingWeight)),
          Math.round(lerp(opaque[1], matte[1], mattingWeight)),
          Math.round(lerp(opaque[2], matte[2], mattingWeight))
        ];
      }

      out[p] = rgb[0];
      out[p + 1] = rgb[1];
      out[p + 2] = rgb[2];
      out[p + 3] = Math.round(a * 255);
    }

    return {
      output: output,
      alpha: alpha,
      mattingWeights: mattingWeights
    };
  }

  function enforceManualAlphaOverrides(out, alphaData, imageData, alphaOverrides) {
    var overrides = alphaOverrides && alphaOverrides.values;
    if (!overrides) return;
    var data = imageData.data;
    for (var i = 0, p = 0; i < overrides.length; i += 1, p += 4) {
      if (overrides[i] === ALPHA_OVERRIDE_ADD) {
        out[p] = data[p];
        out[p + 1] = data[p + 1];
        out[p + 2] = data[p + 2];
        out[p + 3] = 255;
        alphaData[p] = 255;
        alphaData[p + 1] = 255;
        alphaData[p + 2] = 255;
        alphaData[p + 3] = 255;
      } else if (overrides[i] === ALPHA_OVERRIDE_ERASE) {
        out[p] = 0;
        out[p + 1] = 0;
        out[p + 2] = 0;
        out[p + 3] = 0;
        alphaData[p] = 0;
        alphaData[p + 1] = 0;
        alphaData[p + 2] = 0;
        alphaData[p + 3] = 255;
      }
    }
  }

  function renderDualOutputs(options) {
    var sourceImageData = options.sourceImageData;
    var dual = options.dual;
    var width = sourceImageData.width;
    var height = sourceImageData.height;
    var pixelCount = width * height;
    var output = dual.output;
    var alpha = dual.alpha;
    var mattingWeights = dual.mattingWeights;
    var alphaOverrides = options.alphaOverrides;
    var overrideValues = alphaOverrides && alphaOverrides.values;
    var sourceData = sourceImageData.data;
    var out = output.data;
    var alphaOutput = alphaCtx.createImageData(width, height);
    var maskOutput = maskCtx.createImageData(width, height);
    var edgeOutput = edgeCtx.createImageData(width, height);
    var alphaData = alphaOutput.data;
    var maskData = maskOutput.data;
    var edgeData = edgeOutput.data;
    var transparentCount = 0;

    for (var i = 0, p = 0; i < pixelCount; i += 1, p += 4) {
      var manualAlpha = overrideValues ? overrideValues[i] : ALPHA_OVERRIDE_AUTO;
      var a = clamp(alpha[i], 0, 1);
      var debugR = a <= ALPHA_EPSILON ? 18 : 42;
      var debugG = a <= ALPHA_EPSILON ? 24 : 42;
      var debugB = a <= ALPHA_EPSILON ? 34 : 42;

      if (manualAlpha === ALPHA_OVERRIDE_ADD) {
        a = 1;
        out[p] = sourceData[p];
        out[p + 1] = sourceData[p + 1];
        out[p + 2] = sourceData[p + 2];
        out[p + 3] = 255;
        debugR = 20;
        debugG = 132;
        debugB = 76;
      } else if (manualAlpha === ALPHA_OVERRIDE_ERASE) {
        a = 0;
        out[p] = 0;
        out[p + 1] = 0;
        out[p + 2] = 0;
        out[p + 3] = 0;
        debugR = 190;
        debugG = 45;
        debugB = 45;
      } else if (a > ALPHA_EPSILON && a < 0.985) {
        debugR = mattingWeights[i] > 0.2 ? 191 : 255;
        debugG = mattingWeights[i] > 0.2 ? 72 : 166;
        debugB = mattingWeights[i] > 0.2 ? 255 : 58;
      }

      var alphaByte = Math.round(a * 255);
      if (alphaByte <= 0) {
        transparentCount += 1;
      }
      alphaData[p] = alphaByte;
      alphaData[p + 1] = alphaByte;
      alphaData[p + 2] = alphaByte;
      alphaData[p + 3] = 255;

      var maskByte = alphaByte <= 0 ? 18 : (alphaByte >= 250 ? 238 : 150);
      maskData[p] = maskByte;
      maskData[p + 1] = maskByte;
      maskData[p + 2] = maskByte;
      maskData[p + 3] = 255;

      edgeData[p] = debugR;
      edgeData[p + 1] = debugG;
      edgeData[p + 2] = debugB;
      edgeData[p + 3] = 255;
    }

    resultCtx.putImageData(output, 0, 0);
    leftResultCtx.putImageData(output, 0, 0);
    alphaCtx.putImageData(alphaOutput, 0, 0);
    maskCtx.putImageData(maskOutput, 0, 0);
    edgeCtx.putImageData(edgeOutput, 0, 0);
    state.resultImageData = output;
    return transparentCount;
  }

  function renderOutputs(options) {
    var imageData = options.imageData;
    var data = imageData.data;
    var width = imageData.width;
    var height = imageData.height;
    var pixelCount = width * height;
    var alpha = options.alpha;
    var bgMask = options.bgMask;
    var outerBgMask = options.outerBgMask || bgMask;
    var distances = options.distances;
    var distToBg = options.distToBg;
    var distToOuterBg = options.distToOuterBg || distToBg;
    var distToFg = options.distToFg;
    var nearest = options.nearest;
    var bgRgb = options.bgRgb;
    var edgeWidth = options.edgeWidth;
    var tolerance = options.tolerance;
    var softness = Math.max(1, options.softness);
    var decontam = options.decontam;
    var erodeRadius = options.erodeRadius;
    var clip = options.clip;
    var sourceEmpty = options.sourceEmpty;
    var extendedColor = options.extendedColor;
    var alphaOverrides = options.alphaOverrides;
    var alphaOverrideValues = alphaOverrides && alphaOverrides.values;
    var extendMask = extendedColor && extendedColor.extendMask;
    var bR = SRGB_TO_LINEAR[bgRgb.r];
    var bG = SRGB_TO_LINEAR[bgRgb.g];
    var bB = SRGB_TO_LINEAR[bgRgb.b];
    var output = resultCtx.createImageData(width, height);
    var alphaOutput = alphaCtx.createImageData(width, height);
    var maskOutput = maskCtx.createImageData(width, height);
    var edgeOutput = edgeCtx.createImageData(width, height);
    var out = output.data;
    var alphaData = alphaOutput.data;
    var maskData = maskOutput.data;
    var edgeData = edgeOutput.data;
    var extendBand = erodeRadius > 0 ? erodeRadius : edgeWidth;
    var extendedCount = 0;

    for (var i = 0, p = 0; i < pixelCount; i += 1, p += 4) {
      var manualAlpha = alphaOverrideValues ? alphaOverrideValues[i] : ALPHA_OVERRIDE_AUTO;
      var isManualAlpha = manualAlpha !== ALPHA_OVERRIDE_AUTO;
      var a = clamp(alpha[i], 0, 1);
      var lockedEmpty = sourceEmpty && sourceEmpty[i] && manualAlpha !== ALPHA_OVERRIDE_ADD;
      if (lockedEmpty) {
        a = 0;
      }
      if (manualAlpha === ALPHA_OVERRIDE_ADD) {
        a = 1;
      } else if (manualAlpha === ALPHA_OVERRIDE_ERASE) {
        a = 0;
      } else if (a * 255 <= clip) {
        a = 0;
      }
      var isBackground = manualAlpha === ALPHA_OVERRIDE_ADD ? 0 : (manualAlpha === ALPHA_OVERRIDE_ERASE ? 1 : (bgMask[i] ? 1 : 0));
      var inAlphaExtend = extendMask && extendMask[i];
      var nearFgEdge = !isManualAlpha && !lockedEmpty && !isBackground && distToOuterBg[i] <= extendBand;
      var nearBgEdge = !isManualAlpha && !lockedEmpty && isBackground && distToFg[i] <= extendBand;
      var nearBoundary = !isManualAlpha && (inAlphaExtend || nearFgEdge || nearBgEdge);
      var outR = 0;
      var outG = 0;
      var outB = 0;
      var debugDidRepair = false;
      var debugR = lockedEmpty ? 24 : (isBackground ? 18 : 42);
      var debugG = lockedEmpty ? 24 : (isBackground ? 24 : 42);
      var debugB = lockedEmpty ? 24 : (isBackground ? 34 : 42);

      if (a > 0) {
        var cR = SRGB_TO_LINEAR[data[p]];
        var cG = SRGB_TO_LINEAR[data[p + 1]];
        var cB = SRGB_TO_LINEAR[data[p + 2]];
        outR = cR;
        outG = cG;
        outB = cB;

        if (!isManualAlpha && decontam > 0 && nearBoundary) {
          if (a < 0.995) {
            var safeA = Math.max(a, 0.001);
            var cleanR = clamp((cR - (1 - safeA) * bR) / safeA, 0, 1);
            var cleanG = clamp((cG - (1 - safeA) * bG) / safeA, 0, 1);
            var cleanB = clamp((cB - (1 - safeA) * bB) / safeA, 0, 1);
            var strength = decontam * clamp((1 - a) * 1.65 + 0.26, 0, 1);
            outR = lerp(outR, cleanR, strength);
            outG = lerp(outG, cleanG, strength);
            outB = lerp(outB, cleanB, strength);
          }

          var halo = clamp(1 - distances[i] / (tolerance + softness + 1), 0, 1);
          halo *= isBackground ? 0.35 : clamp(1 - distToOuterBg[i] / (Math.max(edgeWidth, extendBand) + 1), 0, 1);
          if (halo > 0) {
            var fR = SRGB_TO_LINEAR[nearest.r[i]];
            var fG = SRGB_TO_LINEAR[nearest.g[i]];
            var fB = SRGB_TO_LINEAR[nearest.b[i]];
            var spillStrength = decontam * halo * 0.58;
            outR = lerp(outR, fR, spillStrength);
            outG = lerp(outG, fG, spillStrength);
            outB = lerp(outB, fB, spillStrength);
            debugR = 191;
            debugG = 72;
            debugB = 255;
            debugDidRepair = true;
          }
        }

        if (!isManualAlpha && extendedColor && inAlphaExtend && extendedColor.valid[i]) {
          outR = extendedColor.r[i];
          outG = extendedColor.g[i];
          outB = extendedColor.b[i];
          extendedCount += 1;
          debugR = 255;
          debugG = 214;
          debugB = 58;
          debugDidRepair = true;
        }
      }

      if (manualAlpha === ALPHA_OVERRIDE_ADD) {
        debugR = 20;
        debugG = 132;
        debugB = 76;
      } else if (manualAlpha === ALPHA_OVERRIDE_ERASE) {
        debugR = 190;
        debugG = 45;
        debugB = 45;
      } else if (!lockedEmpty && inAlphaExtend && !debugDidRepair) {
        debugR = 255;
        debugG = 166;
        debugB = 58;
      } else if (!lockedEmpty && nearBoundary && !debugDidRepair) {
        debugR = 255;
        debugG = 166;
        debugB = 58;
      }

      out[p] = linearToSrgb8(outR);
      out[p + 1] = linearToSrgb8(outG);
      out[p + 2] = linearToSrgb8(outB);
      out[p + 3] = Math.round(a * 255);

      var alphaByte = Math.round(a * 255);
      alphaData[p] = alphaByte;
      alphaData[p + 1] = alphaByte;
      alphaData[p + 2] = alphaByte;
      alphaData[p + 3] = 255;

      var maskByte = isBackground ? 18 : 238;
      if (nearBoundary) {
        maskByte = isBackground ? 92 : 168;
      }
      maskData[p] = maskByte;
      maskData[p + 1] = maskByte;
      maskData[p + 2] = maskByte;
      maskData[p + 3] = 255;

      edgeData[p] = debugR;
      edgeData[p + 1] = debugG;
      edgeData[p + 2] = debugB;
      edgeData[p + 3] = 255;
    }

    enforceManualAlphaOverrides(out, alphaData, imageData, alphaOverrides);

    resultCtx.putImageData(output, 0, 0);
    leftResultCtx.putImageData(output, 0, 0);
    alphaCtx.putImageData(alphaOutput, 0, 0);
    maskCtx.putImageData(maskOutput, 0, 0);
    edgeCtx.putImageData(edgeOutput, 0, 0);
    labels.erodeRadius.textContent = erodeRadius + " px / " + computeErodeMaxRadius(width, height) + " max";
    if (extendedCount > 0) {
      labels.erodeRadius.textContent += " · " + Math.round(extendedCount / pixelCount * 1000) / 10 + "% extended";
    }
    state.resultImageData = output;
  }

  function processNow() {
    clearTimeout(state.processTimer);
    state.processTimer = 0;
    if (!state.sourceImageData) {
      return;
    }
    updateLabels();
    setStatus("Processing...");
    var started = performance.now();
    var imageData = state.sourceImageData;
    var width = imageData.width;
    var height = imageData.height;
    var bgRgb = hexToRgb(controls.bgColor.value);
    var tolerance = Number(controls.tolerance.value);
    var edgeWidth = Number(controls.edge.value);
    var softness = Number(controls.softness.value);
    var refine = Number(controls.refine.value);
    var decontam = Number(controls.decontam.value) / 100;
    var erodePercent = Number(controls.erode.value);
    var clip = Number(controls.clip.value);
    var erodeRadius = computeErodeRadius(width, height, erodePercent);
    var alphaOverrides = ensureAlphaOverrides(width, height);
    var contrastReady = hasCompatibleContrast();
    var contrastBgRgb = contrastReady ? hexToRgb(controls.contrastBgColor.value) : null;

    updateDualControlsState();
    if (contrastReady && hasValidBgDiff(bgRgb, contrastBgRgb)) {
      labels.mode.textContent = "Two images";
      labels.contrastStatus.textContent = state.contrastFileName || "Active";
      var dual = processDualPlate(imageData, state.contrastImageData, {
        sourceBg: bgRgb,
        contrastBg: contrastBgRgb,
        cutoff: Number(controls.dualAlphaCutoff.value) / 255,
        combine: controls.dualAlphaCombine.value,
        recovery: controls.dualRecovery.value,
        gateLow: Number(controls.dualDiffGate.value) / 100,
        gateSoft: Number(controls.dualDiffGateSoft.value) / 100,
        metric: controls.dualDiffMetric.value
      });
      var transparentCount = renderDualOutputs({
        sourceImageData: imageData,
        dual: dual,
        alphaOverrides: alphaOverrides
      });
      var dualElapsed = performance.now() - started;
      labels.background.textContent = Math.round(transparentCount / (width * height) * 100) + "%";
      labels.erodeRadius.textContent = "Dual matte";
      labels.time.textContent = Math.round(dualElapsed) + " ms";
      setStatus(width + " x " + height + " processed with second image");
      return;
    }

    labels.mode.textContent = "Single image";
    if (contrastReady) {
      labels.contrastStatus.textContent = "Backgrounds too close";
    }

    var sourceEmpty = buildSourceEmptyMask(imageData);
    var distances = buildDistanceMap(imageData, bgRgb, sourceEmpty.mask);
    var flood = floodBackground(distances, width, height, tolerance, controls.holes.checked, sourceEmpty.mask);
    var distToBg = chamferDistance(flood.mask, width, height, 1);
    var distToOuterBg = chamferDistance(flood.outerMask, width, height, 1);
    var distToFg = chamferDistance(flood.mask, width, height, 0);
    var seeds = buildForegroundSeeds(flood.mask, distToBg, distances, tolerance, softness, edgeWidth);
    var nearest = propagateNearestForegroundColor(imageData, seeds);
    var alpha = estimateAlpha({
      imageData: imageData,
      bgMask: flood.mask,
      distances: distances,
      nearest: nearest,
      distToBg: distToBg,
      distToFg: distToFg,
      tolerance: tolerance,
      softness: softness,
      edgeWidth: edgeWidth,
      bgRgb: bgRgb
    });
    alpha = refineAlpha(alpha, imageData, flood.mask, distToBg, distToFg, edgeWidth, refine);
    var extendedColor = buildExtendedEdgeColors(imageData, alpha, bgRgb, erodeRadius, clip, sourceEmpty.mask);
    renderOutputs({
      imageData: imageData,
      alpha: alpha,
      bgMask: flood.mask,
      outerBgMask: flood.outerMask,
      distances: distances,
      distToBg: distToBg,
      distToOuterBg: distToOuterBg,
      distToFg: distToFg,
      nearest: nearest,
      bgRgb: bgRgb,
      edgeWidth: edgeWidth,
      tolerance: tolerance,
      softness: softness,
      decontam: decontam,
      erodeRadius: erodeRadius,
      clip: clip,
      sourceEmpty: sourceEmpty.mask,
      extendedColor: extendedColor,
      alphaOverrides: alphaOverrides
    });

    var elapsed = performance.now() - started;
    labels.background.textContent = Math.round(flood.totalCount / (width * height) * 100) + "%";
    labels.time.textContent = Math.round(elapsed) + " ms";
    setStatus(width + " x " + height + " processed");
  }

  function scheduleProcess() {
    clearTimeout(state.processTimer);
    state.processTimer = window.setTimeout(processNow, 70);
  }

  function downloadResult() {
    if (!state.resultImageData) {
      return;
    }
    resultCanvas.toBlob(function (blob) {
      if (!blob) return;
      var link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "nanoalpha.png";
      document.body.appendChild(link);
      link.click();
      window.setTimeout(function () {
        URL.revokeObjectURL(link.href);
        link.remove();
      }, 1000);
    }, "image/png");
  }

  function initCharmoraCarousel() {
    var carousel = document.getElementById("phoneCarousel");
    var dotsEl = document.getElementById("carouselDots");
    var prev = document.getElementById("carouselPrev");
    var next = document.getElementById("carouselNext");
    if (!carousel || !dotsEl || !prev || !next) {
      return;
    }
    var slides = Array.prototype.slice.call(carousel.querySelectorAll(".carousel-slide"));
    if (!slides.length) {
      return;
    }
    var index = 0;
    var timer = null;

    slides.forEach(function (_slide, slideIndex) {
      var dot = document.createElement("button");
      dot.type = "button";
      dot.className = "carousel-dot" + (slideIndex === 0 ? " active" : "");
      dot.setAttribute("role", "tab");
      dot.setAttribute("aria-label", "Screenshot " + (slideIndex + 1));
      dot.addEventListener("click", function () {
        goTo(slideIndex, true);
      });
      dotsEl.appendChild(dot);
    });

    var dots = Array.prototype.slice.call(dotsEl.children);

    function goTo(nextIndex, userAction) {
      slides[index].classList.remove("active");
      dots[index].classList.remove("active");
      index = (nextIndex + slides.length) % slides.length;
      slides[index].classList.add("active");
      dots[index].classList.add("active");
      if (userAction) {
        restartAutoplay();
      }
    }

    function restartAutoplay() {
      window.clearInterval(timer);
      timer = window.setInterval(function () {
        goTo(index + 1, false);
      }, 4500);
    }

    prev.addEventListener("click", function () {
      goTo(index - 1, true);
    });
    next.addEventListener("click", function () {
      goTo(index + 1, true);
    });
    restartAutoplay();
  }

  function getDroppedImageFile(event) {
    var files = event.dataTransfer && event.dataTransfer.files;
    if (!files || !files.length) {
      return null;
    }
    for (var i = 0; i < files.length; i += 1) {
      if (files[i].type && files[i].type.indexOf("image/") === 0) {
        return files[i];
      }
    }
    return files[0];
  }

  function bindInputDropZone(zone, loadDroppedFile) {
    if (!zone) return;
    zone.addEventListener("dragenter", function (event) {
      event.preventDefault();
      event.stopPropagation();
      zone.classList.add("is-dragging");
    });
    zone.addEventListener("dragover", function (event) {
      event.preventDefault();
      event.stopPropagation();
    });
    ["dragleave", "drop"].forEach(function (type) {
      zone.addEventListener(type, function (event) {
        event.preventDefault();
        event.stopPropagation();
        zone.classList.remove("is-dragging");
      });
    });
    zone.addEventListener("drop", function (event) {
      var file = getDroppedImageFile(event);
      loadDroppedFile(file);
    });
  }

  bindInputDropZone(sourceDropZone, loadFile);
  bindInputDropZone(contrastDropZone, loadContrastFile);

  controls.file.addEventListener("change", function (event) {
    loadFile(event.target.files[0]);
    event.target.value = "";
  });

  controls.contrastFile.addEventListener("change", function (event) {
    loadContrastFile(event.target.files[0]);
    event.target.value = "";
  });

  controls.clearContrast.addEventListener("click", function () {
    clearContrastImage(true);
  });

  controls.demo.addEventListener("click", loadDemo);
  controls.download.addEventListener("click", downloadResult);

  controls.autoColor.addEventListener("click", function () {
    runAutoDetection(true);
    processNow();
  });

  controls.autoContrastColor.addEventListener("click", function () {
    runContrastAutoDetection();
    processNow();
  });

  controls.bgColor.addEventListener("input", function () {
    state.colorIsManual = true;
    labels.detectedColor.textContent = controls.bgColor.value.toUpperCase();
    scheduleProcess();
  });

  controls.contrastBgColor.addEventListener("input", function () {
    state.contrastColorIsManual = true;
    scheduleProcess();
  });

  controls.probe.addEventListener("input", function () {
    updateLabels();
  });

  controls.probe.addEventListener("change", function () {
    if (!state.colorIsManual) {
      runAutoDetection(true);
    }
    if (state.contrastImageData && !state.contrastColorIsManual) {
      runContrastAutoDetection();
    }
    syncSimpleControlsFromAdvanced();
    scheduleProcess();
  });

  controlModeTabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      setControlMode(tab.dataset.controlMode);
    });
  });

  [
    controls.simpleRemove,
    controls.simpleCleanup,
    controls.simpleSoftness,
    controls.simpleHoles
  ].forEach(function (control) {
    control.addEventListener("input", function () {
      applySimpleControlsToAdvanced();
      updateLabels();
      scheduleProcess();
    });
    control.addEventListener("change", function () {
      applySimpleControlsToAdvanced();
      scheduleProcess();
    });
  });

  [
    controls.tolerance,
    controls.edge,
    controls.softness,
    controls.refine,
    controls.decontam,
    controls.erode,
    controls.clip,
    controls.holes,
    controls.dualAlphaCutoff,
    controls.dualAlphaCombine,
    controls.dualRecovery,
    controls.dualDiffGate,
    controls.dualDiffGateSoft,
    controls.dualDiffMetric
  ].forEach(function (control) {
    control.addEventListener("input", function () {
      syncSimpleControlsFromAdvanced();
      updateLabels();
      scheduleProcess();
    });
    control.addEventListener("change", function () {
      syncSimpleControlsFromAdvanced();
      scheduleProcess();
    });
  });

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      switchView(tab.dataset.view);
      if (history.replaceState) {
        history.replaceState(null, "", "#" + tab.dataset.view);
      }
    });
  });

  bgTabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      switchOutputBackground(tab.dataset.bgMode);
    });
  });

  alphaToolButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      setAlphaTool(button.dataset.alphaTool);
    });
  });

  controls.alphaBrushSize.addEventListener("input", function () {
    setAlphaBrushRadius(controls.alphaBrushSize.value);
  });

  controls.alphaUndo.addEventListener("click", undoAlphaStroke);
  controls.alphaReset.addEventListener("click", resetManualAlphaOverrides);

  controls.previewBgColor.addEventListener("input", function () {
    updatePreviewBackgroundTargets();
  });

  outputStage.addEventListener("pointerdown", handleAlphaPaintStart);
  outputStage.addEventListener("pointermove", handleAlphaPaintMove);
  outputStage.addEventListener("pointerup", handleAlphaPaintEnd);
  outputStage.addEventListener("pointercancel", handleAlphaPaintEnd);
  outputStage.addEventListener("lostpointercapture", handleAlphaPaintEnd);
  outputStage.addEventListener("pointerleave", hideAlphaBrushCursor);
  window.addEventListener("keydown", handleKeyboardShortcuts);

  previewStages.forEach(function (stage) {
    stage.addEventListener("wheel", handlePreviewWheel, { passive: false });
    stage.addEventListener("scroll", function () {
      syncPreviewScrollFrom(stage);
    });
  });

  dropZone.addEventListener("pointerenter", showZoomHint);

  window.addEventListener("resize", function () {
    updatePreviewGeometry(true);
  });

  dropZone.addEventListener("dragenter", function (event) {
    event.preventDefault();
    dropZone.classList.add("is-dragging");
    dropHint.hidden = false;
  });

  dropZone.addEventListener("dragover", function (event) {
    event.preventDefault();
  });

  ["dragleave", "drop"].forEach(function (type) {
    dropZone.addEventListener(type, function (event) {
      event.preventDefault();
      dropZone.classList.remove("is-dragging");
      dropHint.hidden = true;
    });
  });

  dropZone.addEventListener("drop", function (event) {
    var file = getDroppedImageFile(event);
    loadFile(file);
  });

  setAlphaTool("brush");
  setAlphaBrushRadius(controls.alphaBrushSize.value);
  setControlMode("simple");
  applySimpleControlsToAdvanced();
  updateAlphaHistoryButtons();
  updateDualControlsState();
  updateLabels();
  switchView(window.location.hash ? window.location.hash.slice(1) : "result");
  switchOutputBackground("checker");
  loadDemo();
  initCharmoraCarousel();
  window.setTimeout(showZoomHint, 900);
}());
