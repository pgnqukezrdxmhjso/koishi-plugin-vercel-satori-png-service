import path from "node:path";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { Readable } from "node:stream";

import * as resvg from "@resvg/resvg-wasm";
import type Satori from "satori";
import Vips from "wasm-vips";

import { ReactElement } from "react";
import render, {
  Font,
  ImageOptions,
  Logger,
  renderSvg as _renderSvg,
  svgToPng as _svgToPng,
} from "./og";

let fontData: Buffer<ArrayBufferLike>;
let satori: typeof Satori;
let vips: typeof Vips;
export const initSatori = async () => {
  satori = (await import("satori")).default;
  vips = await Vips({
    dynamicLibraries: ["vips-resvg.wasm"],
  });
  const require = createRequire("file:///" + __filename);
  const reSvgWasm = path.join(
    path.dirname(require.resolve("@resvg/resvg-wasm")),
    "index_bg.wasm",
  );
  await resvg.initWasm(await fs.readFile(reSvgWasm));
  fontData = await fs.readFile(
    require.resolve("../noto-sans-v27-latin-regular.ttf"),
  );
};

export const getResvg = () => {
  return resvg.Resvg;
};

export const getVips = () => {
  return vips;
};

const getDefaultFonts = () =>
  [
    {
      name: "sans serif",
      data: fontData,
      weight: 700,
      style: "normal",
    },
  ] as Font[];

export const createNodejsStream = async (
  element: ReactElement<any, any>,
  options: ImageOptions,
  logger: Logger,
) => {
  const result = await render(
    satori,
    resvg,
    vips,
    logger,
    options,
    getDefaultFonts(),
    element,
  );
  return Readable.from(Buffer.from(result));
};

export const svgToPng = async (
  svg: string,
  options: ImageOptions,
  logger: Logger,
) => {
  const result = await _svgToPng(resvg, vips, logger, options, svg);
  return Readable.from(Buffer.from(result));
};

export const renderSvg = async (
  element: ReactElement<any, any>,
  options: ImageOptions,
  logger: Logger,
) => {
  return _renderSvg(satori, logger, options, getDefaultFonts(), element);
};
