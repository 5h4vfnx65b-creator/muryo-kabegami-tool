import { PRESETS } from "./presets.js";

const els = {
  deviceSelect: document.getElementById("deviceSelect"),
  fileInput: document.getElementById("fileInput"),
  generateBtn: document.getElementById("generateBtn"),
  resetBtn: document.getElementById("resetBtn"),
  overlay: document.getElementById("overlay"),

  previewEmpty: document.getElementById("previewEmpty"),
  previewWrap: document.getElementById("previewWrap"),
  previewImg: document.getElementById("previewImg"),
  previewMeta: document.getElementById("previewMeta"),
  downloadBtn: document.getElementById("downloadBtn"),
  downloadLink: document.getElementById("downloadLink"),

  customW: document.getElementById("customW"),
  customH: document.getElementById("customH"),

  finishSelect: document.getElementById("finishSelect"),
  genSelect: document.getElementById("genSelect"),

  rewardModal: document.getElementById("rewardModal"),
  rewardStartBtn: document.getElementById("rewardStartBtn"),
  rewardCancelBtn: document.getElementById("rewardCancelBtn"),

  rewardModal: document.getElementById("rewardModal"),
  rewardContinueBtn: document.getElementById("rewardContinueBtn"),
  rewardCancelBtn: document.getElementById("rewardCancelBtn"),
  rewardCountdown: document.getElementById("rewardCountdown"),
};

let selectedFile = null;
let outputBlob = null;
let outputInfo = null;

// ---------- UI init ----------
function initDeviceSelect() {
  // Group options
  const groups = {};
  for (const p of PRESETS) {
    if (!groups[p.group]) groups[p.group] = [];
    groups[p.group].push(p);
  }
  els.deviceSelect.innerHTML = "";
  for (const [group, items] of Object.entries(groups)) {
    const og = document.createElement("optgroup");
    og.label = group;
    for (const p of items) {
      const opt = document.createElement("option");
      opt.value = JSON.stringify({ w: p.w, h: p.h });
      opt.textContent = p.name;
      og.appendChild(opt);
    }
    els.deviceSelect.appendChild(og);
  }
}

function setBusy(isBusy) {
  els.overlay.classList.toggle("hidden", !isBusy);
  els.generateBtn.disabled = isBusy || !selectedFile;
  els.resetBtn.disabled = isBusy || (!selectedFile && !outputBlob);
  els.downloadBtn.disabled = isBusy || !outputBlob;
}

function resetAll() {
  selectedFile = null;
  outputBlob = null;
  outputInfo = null;

  els.fileInput.value = "";
  els.customW.value = "";
  els.customH.value = "";

  els.previewWrap.classList.add("hidden");
  els.previewEmpty.classList.remove("hidden");
  els.previewImg.src = "";
  els.previewMeta.textContent = "";

  els.generateBtn.disabled = true;
  els.resetBtn.disabled = true;
  els.downloadBtn.disabled = true;
}

function clampInt(n, min, max) {
  if (!Number.isFinite(n)) return null;
  const x = Math.floor(n);
  if (x < min || x > max) return null;
  return x;
}

function getTargetSize() {
  const cw = clampInt(Number(els.customW.value), 200, 10000);
  const ch = clampInt(Number(els.customH.value), 200, 10000);
  if (cw && ch) return { w: cw, h: ch, label: `Custom ${cw}×${ch}` };

  const { w, h } = JSON.parse(els.deviceSelect.value);
  // detect iPhone portrait: if height > width keep; else as-is
  const isPortrait = h > w;
  const label = `${w}×${h}${isPortrait ? " (Portrait)" : " (Landscape)"}`;
  return { w, h, label };
}

// ---------- Image processing (client-side) ----------
async function fileToImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    // Keep URL until decode is done; caller will revoke later if needed
  }
}

function drawWallpaper(img, targetW, targetH) {
  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;

  const ctx = canvas.getContext("2d", { alpha: false });

  // Background: cover + blur (edge fill)
  const coverScale = Math.max(targetW / img.width, targetH / img.height);
  const coverW = img.width * coverScale;
  const coverH = img.height * coverScale;
  const coverX = (targetW - coverW) / 2;
  const coverY = (targetH - coverH) / 2;

  // Draw blurred background
  ctx.save();
  ctx.filter = `blur(${Math.round(Math.min(targetW, targetH) * 0.02)}px)`;
  ctx.drawImage(img, coverX, coverY, coverW, coverH);
  ctx.restore();

  // Slight dark overlay to improve foreground readability
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.fillRect(0, 0, targetW, targetH);
  ctx.restore();

  // Foreground: contain (no crop)
  const containScale = Math.min(targetW / img.width, targetH / img.height);
  const fgW = img.width * containScale;
  const fgH = img.height * containScale;
  const fgX = (targetW - fgW) / 2;
  const fgY = (targetH - fgH) / 2;

  // Subtle shadow
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = Math.round(Math.min(targetW, targetH) * 0.02);
  ctx.shadowOffsetY = Math.round(Math.min(targetW, targetH) * 0.01);
  ctx.drawImage(img, fgX, fgY, fgW, fgH);
  ctx.restore();

  return canvas;
}

async function canvasToBlob(canvas) {
  return await new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/png", 1.0);
  });
}

// ---------- Reward modal (placeholder) ----------
function openRewardModal() {
  return new Promise((resolve) => {
    els.rewardModal.classList.remove("hidden");

    let t = 3;
    els.rewardCountdown.textContent = String(t);
    els.rewardContinueBtn.disabled = true;

    const timer = setInterval(() => {
      t -= 1;
      els.rewardCountdown.textContent = String(t);
      if (t <= 0) {
        clearInterval(timer);
        els.rewardContinueBtn.disabled = false;
        els.rewardContinueBtn.textContent = "続ける";
      }
    }, 1000);

    const cleanup = () => {
      clearInterval(timer);
      els.rewardModal.classList.add("hidden");
      els.rewardContinueBtn.textContent = "続ける";
      els.rewardContinueBtn.disabled = true;
      els.rewardCancelBtn.onclick = null;
      els.rewardContinueBtn.onclick = null;
    };

    els.rewardCancelBtn.onclick = () => {
      cleanup();
      resolve(false);
    };
    els.rewardContinueBtn.onclick = () => {
      cleanup();
      resolve(true);
    };
  });
}

// ---------- Event handlers ----------
initDeviceSelect();
resetAll();

els.fileInput.addEventListener("change", () => {
  selectedFile = els.fileInput.files?.[0] ?? null;
  els.generateBtn.disabled = !selectedFile;
  els.resetBtn.disabled = !selectedFile && !outputBlob;
});

els.resetBtn.addEventListener("click", resetAll);

els.generateBtn.addEventListener("click", async () => {
  if (!selectedFile) return;
  setBusy(true);

  const { w, h, label } = getTargetSize();

  try {
    const img = await fileToImage(selectedFile);

    // Render
    const mode = els.finishSelect?.value || "sharp";
    const genMode = els.genSelect?.value || "local";

    if (genMode === "ai") {
      const ok = await showRewardModal();
      if (!ok) {
        // 広告が出ない/キャンセル → 生成しない（赤字ゼロ）
        alert("広告が再生できなかったため、生成はできません。無料版をご利用ください。");
        // 自動で無料モードに戻す
        if (els.genSelect) els.genSelect.value = "local";
        return;
      }

const uploadDataUrl = await downscaleForUpload(img);
      els.overlayText.textContent = "生成中…（サーバー側）";
      const out = await callOutpaintAPI(uploadDataUrl, w, h);

      els.resultImg.src = out.url;
      els.resultMeta.textContent = `生成OK（steps: ${out.steps} / tile: ${out.tile}）`;
      els.downloadBtn.disabled = false;
      if (window.__setDownloadCallback) {
        window.__setDownloadCallback(() => downloadBlob(out.blob, makeFilename(label, w, h, "outpaint")));
      }
      return;
    }

    const canvas = drawWallpaper(img, w, h, mode);
    outputBlob = await canvasToBlob(canvas);
    outputInfo = { w, h, label, input: `${img.width}×${img.height}` };

    // Preview
    const url = URL.createObjectURL(outputBlob);
    els.previewImg.src = url;
    const modeLabel = (mode === 'soft') ? '自然(ぼかし)' : (mode === 'cover') ? '背景拡大(くっきり)' : 'くっきり';
    els.previewMeta.textContent = `出力: ${w}×${h} / 入力: ${outputInfo.input} / ${label} / 仕上げ: ${modeLabel}`;

    els.previewEmpty.classList.add("hidden");
    els.previewWrap.classList.remove("hidden");
    els.downloadBtn.disabled = false;
    els.resetBtn.disabled = false;

  } catch (e) {
    console.error(e);
    alert("生成に失敗しました。別の画像で試してみてください。");
  } finally {
    setBusy(false);
  }
});

els.downloadBtn.addEventListener("click", async () => {
  if (!outputBlob) return;

  // Rewarded gate (placeholder). Replace with your real rewarded ad flow.
  const ok = await openRewardModal();
  if (!ok) return;

  const url = URL.createObjectURL(outputBlob);
  els.downloadLink.href = url;
  // filename hint
  const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,"-");
  els.downloadLink.download = `wallpaper-${outputInfo?.w ?? "x"}x${outputInfo?.h ?? "y"}-${stamp}.png`;
  els.downloadLink.click();

  // revoke later
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
});
