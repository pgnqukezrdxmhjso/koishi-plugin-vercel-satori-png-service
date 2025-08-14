import path from "node:path";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { Readable } from "node:stream";

import * as resvg from "@resvg/resvg-wasm";
import type Satori from "satori";

import { ReactElement } from "react";
import render, { Font, ImageOptions } from "./og";

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

export const createNodejsStream = async (
  element: ReactElement<any, any>,
  options: ImageOptions,
) => {
  const fonts = [
    {
      name: "sans serif",
      data: fontData,
      weight: 700,
      style: "normal",
    },
  ] as Font[];

  const result = await render(satori, resvg, options, fonts, element);

  return Readable.from(Buffer.from(result));
};
