
const OpenAI = require("openai");
const { toFile } = require("openai");
const sharp = require("sharp");

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const TILE_P = { w: 1024, h: 1536 };
const TILE_L = { w: 1536, h: 1024 };

const OVERLAP = 512;
const MAX_STEPS = 4;

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

function parseDataUrl(dataUrl) {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl || "");
  if (!m) throw new Error("Invalid imageDataUrl");
  return Buffer.from(m[2], "base64");
}

async function makeInitialTile(inputBuf, tileW, tileH) {
  const meta = await sharp(inputBuf).metadata();
  const iw = meta.width || 1;
  const ih = meta.height || 1;

  const scale = Math.min(tileW / iw, tileH / ih);
  const rw = Math.max(1, Math.round(iw * scale));
  const rh = Math.max(1, Math.round(ih * scale));
  const ox = Math.floor((tileW - rw) / 2);
  const oy = Math.floor((tileH - rh) / 2);

  const resized = await sharp(inputBuf).resize(rw, rh, { fit: "fill" }).png().toBuffer();

  const tile = await sharp({
    create: { width: tileW, height: tileH, channels: 4, background: { r:0,g:0,b:0,alpha:0 } }
  }).composite([{ input: resized, left: ox, top: oy }]).png().toBuffer();

  const rect = await sharp({
    create: { width: rw, height: rh, channels: 4, background: { r:255,g:255,b:255,alpha:255 } }
  }).png().toBuffer();

  const mask = await sharp({
    create: { width: tileW, height: tileH, channels: 4, background: { r:0,g:0,b:0,alpha:0 } }
  }).composite([{ input: rect, left: ox, top: oy }]).png().toBuffer();

  return { tile, mask };
}

async function openaiOutpaint(tileBuf, maskBuf, tileW, tileH, quality) {
  const prompt =
    "Extend the photo naturally beyond its borders. Continue the existing scene realistically (photoreal). " +
    "Do NOT change the original content; only fill the transparent area. Match lighting, colors, and perspective.";

  const img = await client.images.edits({
    model: "gpt-image-1-mini",
    image: await toFile(tileBuf, "image.png"),
    mask: await toFile(maskBuf, "mask.png"),
    prompt,
    size: (tileW === 1024 && tileH === 1536) ? "1024x1536" : "1536x1024",
    quality: quality || "low",
    output_format: "png",
  });

  const b64 = img.data?.[0]?.b64_json;
  if (!b64) throw new Error("No image returned");
  return Buffer.from(b64, "base64");
}

async function extendVertical(initTile, initMask, needH, quality) {
  const tileW = TILE_P.w, tileH = TILE_P.h;
  let fullH = tileH;

  const first = await openaiOutpaint(initTile, initMask, tileW, tileH, quality);
  let comps = [{ input: first, left: 0, top: 0 }];
  let steps = 1;

  while (fullH < needH && steps < MAX_STEPS) {
    const remaining = needH - fullH;
    const take = Math.min(tileH - OVERLAP, remaining);

    const overlapStrip = await sharp(first)
      .extract({ left: 0, top: tileH - OVERLAP, width: tileW, height: OVERLAP })
      .png()
      .toBuffer();

    const seedTile = await sharp({
      create: { width: tileW, height: tileH, channels: 4, background: { r:0,g:0,b:0,alpha:0 } }
    }).composite([{ input: overlapStrip, left: 0, top: 0 }]).png().toBuffer();

    const protect = await sharp({
      create: { width: tileW, height: OVERLAP, channels: 4, background: { r:255,g:255,b:255,alpha:255 } }
    }).png().toBuffer();

    const seedMask = await sharp({
      create: { width: tileW, height: tileH, channels: 4, background: { r:0,g:0,b:0,alpha:0 } }
    }).composite([{ input: protect, left: 0, top: 0 }]).png().toBuffer();

    const gen = await openaiOutpaint(seedTile, seedMask, tileW, tileH, quality);
    steps++;

    const newArea = await sharp(gen)
      .extract({ left: 0, top: OVERLAP, width: tileW, height: take })
      .png()
      .toBuffer();

    comps.push({ input: newArea, left: 0, top: fullH });
    fullH += take;
  }

  const stitched = await sharp({
    create: { width: tileW, height: needH, channels: 4, background: { r:0,g:0,b:0,alpha:255 } }
  }).composite(comps).png().toBuffer();

  return { stitched, steps, tile: `${tileW}x${needH}` };
}

async function extendHorizontal(initTile, initMask, needW, quality) {
  const tileW = TILE_L.w, tileH = TILE_L.h;
  let fullW = tileW;

  const first = await openaiOutpaint(initTile, initMask, tileW, tileH, quality);
  let comps = [{ input: first, left: 0, top: 0 }];
  let steps = 1;

  while (fullW < needW && steps < MAX_STEPS) {
    const remaining = needW - fullW;
    const take = Math.min(tileW - OVERLAP, remaining);

    const overlapStrip = await sharp(first)
      .extract({ left: tileW - OVERLAP, top: 0, width: OVERLAP, height: tileH })
      .png()
      .toBuffer();

    const seedTile = await sharp({
      create: { width: tileW, height: tileH, channels: 4, background: { r:0,g:0,b:0,alpha:0 } }
    }).composite([{ input: overlapStrip, left: 0, top: 0 }]).png().toBuffer();

    const protect = await sharp({
      create: { width: OVERLAP, height: tileH, channels: 4, background: { r:255,g:255,b:255,alpha:255 } }
    }).png().toBuffer();

    const seedMask = await sharp({
      create: { width: tileW, height: tileH, channels: 4, background: { r:0,g:0,b:0,alpha:0 } }
    }).composite([{ input: protect, left: 0, top: 0 }]).png().toBuffer();

    const gen = await openaiOutpaint(seedTile, seedMask, tileW, tileH, quality);
    steps++;

    const newArea = await sharp(gen)
      .extract({ left: OVERLAP, top: 0, width: take, height: tileH })
      .png()
      .toBuffer();

    comps.push({ input: newArea, left: fullW, top: 0 });
    fullW += take;
  }

  const stitched = await sharp({
    create: { width: needW, height: tileH, channels: 4, background: { r:0,g:0,b:0,alpha:255 } }
  }).composite(comps).png().toBuffer();

  return { stitched, steps, tile: `${needW}x${tileH}` };
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") return res.status(405).send("Method not allowed");
    if (!process.env.OPENAI_API_KEY) return res.status(500).send("Missing OPENAI_API_KEY");

    const { imageDataUrl, targetW, targetH, quality } = req.body || {};
    const tw = parseInt(targetW, 10);
    const th = parseInt(targetH, 10);
    if (!imageDataUrl || !Number.isFinite(tw) || !Number.isFinite(th) || tw < 100 || th < 100) {
      return res.status(400).send("Bad request");
    }
    if (typeof imageDataUrl === "string" && imageDataUrl.length > 8_000_000) {
      return res.status(413).send("Payload too large");
    }

    const buf = parseDataUrl(imageDataUrl);
    const portrait = th >= tw;

    if (portrait) {
      const tileW = TILE_P.w, tileH = TILE_P.h;
      const needH = Math.ceil(tileW * th / tw);
      const needHClamped = clamp(needH, tileH, tileH * MAX_STEPS);

      const { tile, mask } = await makeInitialTile(buf, tileW, tileH);
      const out = await extendVertical(tile, mask, needHClamped, quality);

      const finalPng = await sharp(out.stitched).resize(tw, th, { fit: "fill" }).png().toBuffer();
      return res.json({ b64_png: finalPng.toString("base64"), steps: out.steps, tile: out.tile });
    } else {
      const tileW = TILE_L.w, tileH = TILE_L.h;
      const needW = Math.ceil(tileH * tw / th);
      const needWClamped = clamp(needW, tileW, tileW * MAX_STEPS);

      const { tile, mask } = await makeInitialTile(buf, tileW, tileH);
      const out = await extendHorizontal(tile, mask, needWClamped, quality);

      const finalPng = await sharp(out.stitched).resize(tw, th, { fit: "fill" }).png().toBuffer();
      return res.json({ b64_png: finalPng.toString("base64"), steps: out.steps, tile: out.tile });
    }
  } catch (e) {
    res.status(500).send(String(e?.message || e));
  }
};
