import { createRequire } from "node:module";
import path from "node:path";
import * as resvg from "@resvg/resvg-wasm";
import fs from "node:fs/promises";
import Vips from "wasm-vips";
import SkiaCanvas from "skia-canvas";
import { Canvg } from "canvg";
import { JSDOM } from "jsdom";

(async () => {
  const svg = await fs.readFile("./test.svg", "utf-8");
  const svgB = Buffer.from(svg, "utf-8");

  const require = createRequire("file:///" + __filename);
  const reSvgWasm = path.join(
    path.dirname(require.resolve("@resvg/resvg-wasm")),
    "index_bg.wasm",
  );
  await resvg.initWasm(await fs.readFile(reSvgWasm));
  console.time("resvg");
  const resvgJS = new resvg.Resvg(svg);
  const pngData = resvgJS.render();
  const resvgImg = pngData.asPng();
  pngData.free();
  resvgJS.free();

  console.timeEnd("resvg");
  await fs.writeFile("./svgToPng-resvg.png", resvgImg);

  const vips = await Vips({
    dynamicLibraries: ["vips-resvg.wasm"],
  });

  console.time("vips");
  const vipsImg = vips.Image.svgloadBuffer(svgB);
  vipsImg.writeToFile("./svgToPng-vips.png");
  vipsImg.delete();
  console.timeEnd("vips");

  console.time("skia");
  const img = await SkiaCanvas.loadImage(svgB);
  const canvas = new SkiaCanvas.Canvas(img.width, img.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  let skiaImg = await canvas.toBuffer("png");
  console.timeEnd("skia");
  await fs.writeFile("./svgToPng-skia.png", skiaImg);

  console.time("skia-canvg");
  const canvgCanvas = new SkiaCanvas.Canvas(1, 1);
  const canvgCtx = canvgCanvas.getContext("2d");
  const dom = new JSDOM();
  const v = Canvg.fromString(canvgCtx as any, svg, {
    window: dom.window as any,
    DOMParser: dom.window.DOMParser as any,
    createCanvas: (w, h) => new SkiaCanvas.Canvas(w, h) as any,
    createImage: SkiaCanvas.Image as any,
    ignoreDimensions: false,
  });
  await v.render();
  let skiaCanvgImg = await canvgCanvas.toBuffer("png");
  console.timeEnd("skia-canvg");
  await fs.writeFile("./svgToPng-skia-canvg.png", skiaCanvgImg);
})();
