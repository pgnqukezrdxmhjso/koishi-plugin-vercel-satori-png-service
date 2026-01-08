import { Context, Schema, Service } from "koishi";
import React, { ReactElement } from "react";
import { transform } from "sucrase";
import HtmlReactParser from "html-react-parser";
import SkiaCanvas from "skia-canvas";

import { Readable } from "stream";
import {
  initSatori,
  getResvg,
  getVips,
  createNodejsStream,
  svgToPng,
  renderSvg,
} from "./Satori";
import { Font, ImageOptions } from "./og";
export { Font, ImageOptions } from "./og";

const serviceName = "vercelSatoriPngService";

const AsyncFunction: FunctionConstructor = (async () => 0)
  .constructor as FunctionConstructor;

declare module "koishi" {
  interface Context {
    vercelSatoriPngService: VercelSatoriPngService;
  }
}

let initialized = false;

class VercelSatoriPngService extends Service {
  private _ctx: Context;
  private _config: VercelSatoriPngService.Config;
  private fonts: Font[] = [];

  constructor(ctx: Context, config: VercelSatoriPngService.Config) {
    super(ctx, serviceName);
    this._ctx = ctx;
    this._config = config;
  }

  async start() {
    if (initialized) {
      return;
    }
    await initSatori();
    initialized = true;
  }

  addFont(fonts: Font[]) {
    this.fonts.push(...fonts);
    this.ctx.on("dispose", () => {
      this.removeFont(fonts);
    });
  }

  removeFont(fonts: Font[]) {
    fonts.forEach((font) => {
      const index = this.fonts.indexOf(font);
      if (index === -1) {
        return;
      }
      this.fonts.splice(index, 1);
    });
  }

  getResvg() {
    return getResvg();
  }

  getVips() {
    return getVips();
  }

  getSkiaCanvas() {
    return SkiaCanvas;
  }

  async jsxToReactElement(
    jsxCode: string,
    data?: Record<any, any>,
  ): Promise<ReactElement<any, any>> {
    const hCode = transform(jsxCode, {
      transforms: ["jsx"],
      jsxRuntime: "classic",
      production: true,
    }).code;
    const fn = AsyncFunction(
      "React",
      "_args_623601",
      "with (_args_623601) {\nreturn " + hCode.replace(/^\s+/, "") + "\n}",
    );
    let res: ReactElement<any, any> | Function;
    try {
      res = await fn(React, data || {});
    } catch (e) {
      e.message = fn.toString() + "\n" + e.message;
      throw e;
    }
    let i = 0;
    while (typeof res === "function" && i++ < 999) {
      res = await res();
    }
    return res as ReactElement<any, any>;
  }

  htmlToReactElement(htmlCode: string): ReactElement<any, any> {
    return HtmlReactParser(htmlCode) as ReactElement;
  }

  async jsxToPng(
    jsxCode: string,
    options?: ImageOptions,
    data?: Record<any, any>,
  ): Promise<Readable> {
    return this.reactElementToPng(
      await this.jsxToReactElement(jsxCode, data),
      options,
    );
  }

  htmlToPng(htmlCode: string, options?: ImageOptions): Promise<Readable> {
    return this.reactElementToPng(this.htmlToReactElement(htmlCode), options);
  }

  private buildOptions(options?: ImageOptions): ImageOptions {
    options ||= {};
    if (this.fonts.length > 0) {
      options.fonts ||= [];
      options.fonts.push(...this.fonts);
    }
    return options;
  }

  async reactElementToPng(
    reactElement: ReactElement<any, any>,
    options?: ImageOptions,
  ): Promise<Readable> {
    return createNodejsStream(
      reactElement,
      this.buildOptions(options),
      this._ctx.logger.info.bind(this._ctx.logger),
    );
  }

  async svgToPng(svg: string, options?: ImageOptions) {
    return svgToPng(
      svg,
      this.buildOptions(options),
      this._ctx.logger.info.bind(this._ctx.logger),
    );
  }

  async reactElementToSvg(
    reactElement: ReactElement<any, any>,
    options?: ImageOptions,
  ): Promise<string> {
    return renderSvg(
      reactElement,
      this.buildOptions(options),
      this._ctx.logger.info.bind(this._ctx.logger),
    );
  }
}
namespace VercelSatoriPngService {
  export const usage =
    'html to ReactElement <a target="_blank" href="https://www.npmjs.com/package/html-react-parser">html-react-parser</a><br/>' +
    'jsx to ReactElement <a target="_blank" href="https://www.npmjs.com/package/sucrase">sucrase</a><br/>' +
    'ReactElement to svg <a target="_blank" href="https://github.com/vercel/satori#overview">vercel/satori</a> ' +
    '<a target="_blank" href="https://og-playground.vercel.app/">og-playground</a><br/>' +
    "<hr/>" +
    "svg to png<br/>" +
    '<a target="_blank" href="https://www.npmjs.com/package/@resvg/resvg-wasm">@resvg/resvg-wasm</a><br/>' +
    '<a target="_blank" href="https://www.npmjs.com/package/wasm-vips">wasm-vips</a><br/>' +
    '<a target="_blank" href="https://www.npmjs.com/package/skia-canvas">skia-canvas</a> ' +
    '<a target="_blank" href="https://www.npmjs.com/package/canvg">canvg</a> ' +
    '<a target="_blank" href="https://www.npmjs.com/package/jsdom">jsdom</a><br/>';

  export interface Config {}
  export const Config: Schema<Config> = Schema.object({});
}

export default VercelSatoriPngService;
