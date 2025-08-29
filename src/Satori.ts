import path from "node:path";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { Readable } from "node:stream";

import * as resvg from "@resvg/resvg-wasm";
import type Satori from "satori";

import { ReactElement } from "react";
import render, { Font, ImageOptions, renderSvg as _renderSvg } from "./og";

let fontData: Buffer<ArrayBufferLike>;
let satori: typeof Satori;
export const initSatori = async () => {
  satori = (await import("satori")).default;
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
) => {
  const result = await render(
    satori,
    resvg,
    options,
    getDefaultFonts(),
    element,
  );
  return Readable.from(Buffer.from(result));
};

export const renderSvg = async (
  element: ReactElement<any, any>,
  options: ImageOptions,
) => {
  return _renderSvg(satori, options, getDefaultFonts(), element);
};

export const getResvg = () => {
  return resvg.Resvg;
};
