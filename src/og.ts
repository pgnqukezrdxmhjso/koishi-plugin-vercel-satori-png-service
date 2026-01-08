import { loadEmoji, getIconCode, EmojiType } from "./emoji";
import { FontDetector, languageFontMap } from "./language";
import * as Resvg from "@resvg/resvg-wasm";
import type Satori from "satori";
import type { SatoriOptions } from "satori";
import type { ReactElement } from "react";
import type Vips from "wasm-vips";
import SkiaCanvas from "skia-canvas";
import { Canvg } from "canvg";
import { JSDOM } from "jsdom";

export type ImageOptions = {
  /**
   * The width of the image.
   *
   * @type {number}
   */
  width?: number;
  /**
   * The height of the image.
   *
   * @type {number}
   */
  height?: number;
  /**
   * Display debug information on the image.
   *
   * @type {boolean}
   * @default false
   */
  debug?: boolean;
  /**
   * A list of fonts to use.
   *
   * @type {{ data: ArrayBuffer; name: string; weight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900; style?: 'normal' | 'italic' }[]}
   * @default Noto Sans Latin Regular.
   */
  fonts?: SatoriOptions["fonts"];
  /**
   * Using a specific Emoji style. Defaults to `twemoji`.
   *
   * @type {EmojiType}
   * @default 'twemoji'
   */
  emoji?: EmojiType;
  /**
   * The converter to use.
   *
   * @default 'resvg'
   */
  converter?: "resvg" | "vips" | "skia-canvas" | "skia-canvas-canvg";
  showLog?: boolean;
};
export type Font = ImageOptions["fonts"][number];
export type Logger = (msg: string) => void;

async function loadGoogleFont(font: string, text: string) {
  if (!font || !text) return;

  const API = `https://fonts.googleapis.com/css2?family=${font}&text=${encodeURIComponent(
    text,
  )}`;

  const css = await (
    await fetch(API, {
      headers: {
        // Make sure it returns TTF.
        "User-Agent":
          "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1",
      },
    })
  ).text();

  const resource = css.match(
    /src: url\((.+)\) format\('(opentype|truetype)'\)/,
  );
  if (!resource) throw new Error("Failed to download dynamic font");

  const res = await fetch(resource[1]);
  if (!res.ok) {
    throw new Error("Failed to download dynamic font. Status: " + res.status);
  }

  return res.arrayBuffer();
}

const detector = new FontDetector();

const assetCache = new Map<string, any>();
const loadDynamicAsset = ({ emoji }: { emoji?: EmojiType }) => {
  const fn = async (code, text) => {
    if (code === "emoji") {
      // It's an emoji, load the image.
      return (
        `data:image/svg+xml;base64,` +
        btoa(await (await loadEmoji(getIconCode(text), emoji)).text())
      );
    }

    const codes = code.split("|");

    // Try to load from Google Fonts.
    const names = codes
      .map((code) => languageFontMap[code as keyof typeof languageFontMap])
      .filter(Boolean)
      .flat();

    if (names.length === 0) return [];

    try {
      const textByFont = await detector.detect(text, names);
      const fonts = Object.keys(textByFont);

      const fontData = await Promise.all(
        fonts.map((font) => loadGoogleFont(font, textByFont[font])),
      );
      return fontData.map((data, index) => ({
        name: `satori_${codes[index]}_fallback_${text}`,
        data,
        weight: 400,
        style: "normal",
        lang: codes[index] === "unknown" ? undefined : codes[index],
      }));
    } catch (e) {
      console.error("Failed to load dynamic font for", text, ". Error:", e);
    }
  };

  return async (...args: Parameters<typeof fn>) => {
    const key = emoji + "-" + JSON.stringify(args);
    const cache = assetCache.get(key);
    if (cache) return cache;

    const asset = await fn(...args);
    assetCache.set(key, asset);
    return asset;
  };
};

export async function renderSvg(
  satori: typeof Satori,
  logger: Logger,
  options: ImageOptions,
  defaultFonts: Font[],
  element: ReactElement<any, any>,
) {
  const startTime = options.showLog ? Date.now() : undefined;
  const svg = await satori(element, {
    width: options.width,
    height: options.height,
    debug: options.debug,
    fonts: options.fonts || defaultFonts,
    loadAdditionalAsset: loadDynamicAsset({
      emoji: options.emoji,
    }),
  });
  if (options.showLog) {
    logger(
      `renderSvg time: ${Date.now() - startTime}ms; svg size: ${svg.length}`,
    );
  }
  return svg;
}

export async function svgToPng(
  resvg: typeof Resvg,
  vips: typeof Vips,
  logger: Logger,
  options: ImageOptions,
  svg: string,
) {
  const startTime = options.showLog ? Date.now() : undefined;
  let pngBuffer: Uint8Array;
  switch (options.converter) {
    case "skia-canvas-canvg": {
      const canvas = new SkiaCanvas.Canvas(1, 1);
      const ctx = canvas.getContext("2d");
      const dom = new JSDOM();
      const v = Canvg.fromString(ctx as any, svg, {
        window: dom.window as any,
        DOMParser: dom.window.DOMParser as any,
        createCanvas: (w, h) => new SkiaCanvas.Canvas(w, h) as any,
        createImage: SkiaCanvas.Image as any,
        ignoreDimensions: false,
      });
      await v.render();
      pngBuffer = await canvas.toBuffer("png");
      break;
    }
    case "skia-canvas": {
      const img = await SkiaCanvas.loadImage(Buffer.from(svg));
      const canvas = new SkiaCanvas.Canvas(img.width, img.height);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      pngBuffer = await canvas.toBuffer("png");
      break;
    }
    case "vips": {
      const img = vips.Image.svgloadBuffer(Buffer.from(svg));
      pngBuffer = img.pngsaveBuffer();
      img.delete();
      break;
    }
    case "resvg":
    default: {
      const resvgJS = new resvg.Resvg(svg);
      const pngData = resvgJS.render();
      pngBuffer = pngData.asPng();
      pngData.free();
      resvgJS.free();
      break;
    }
  }
  if (options.showLog) {
    logger(
      `svgToPng time: ${Date.now() - startTime}ms; converter:${options.converter}; png size: ${pngBuffer.length}`,
    );
  }
  return pngBuffer;
}

export default async function render(
  satori: typeof Satori,
  resvg: typeof Resvg,
  vips: typeof Vips,
  logger: Logger,
  options: ImageOptions,
  defaultFonts: Font[],
  element: ReactElement<any, any>,
) {
  const svg = await renderSvg(satori, logger, options, defaultFonts, element);
  return svgToPng(resvg, vips, logger, options, svg);
}
