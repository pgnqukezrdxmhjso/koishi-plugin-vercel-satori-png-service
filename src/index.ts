import { Context, Schema, Service } from "koishi";
import React, { ReactElement } from "react";
import { transform } from "sucrase";
import HtmlReactParser from "html-react-parser";
import { Readable } from "stream";
import type { unstable_createNodejsStream } from "@vercel/og";

export type ImageOptions = Parameters<typeof unstable_createNodejsStream>[1];

const serviceName = "vercelSatoriPngService";

const AsyncFunction: FunctionConstructor = (async () => 0)
  .constructor as FunctionConstructor;

declare module "koishi" {
  interface Context {
    vercelSatoriPngService: VercelSatoriPngService;
  }
}

class VercelSatoriPngService extends Service {
  private _ctx: Context;
  private _config: VercelSatoriPngService.Config;
  private createNodejsStream: typeof unstable_createNodejsStream;

  constructor(ctx: Context, config: VercelSatoriPngService.Config) {
    super(ctx, serviceName);
    this._ctx = ctx;
    this._config = config;
  }
  async start() {
    this.createNodejsStream = (
      await import("@vercel/og")
    ).unstable_createNodejsStream;
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
    let res = await fn(React, data || {});
    let i = 0;
    while (typeof res === "function" && i++ < 999) {
      res = await res();
    }
    return res;
  }

  async jsxToPng(
    jsxCode: string,
    options: ImageOptions,
    data?: Record<any, any>,
  ): Promise<Readable> {
    const reactElement = await this.jsxToReactElement(jsxCode, data);
    return this.createNodejsStream(reactElement, options);
  }

  htmlToReactElement(htmlCode: string): ReactElement<any, any> {
    return HtmlReactParser(htmlCode) as ReactElement;
  }
  htmlToPng(htmlCode: string, options: ImageOptions): Promise<Readable> {
    const reactElement = this.htmlToReactElement(htmlCode);
    return this.createNodejsStream(reactElement, options);
  }
}

namespace VercelSatoriPngService {
  export const usage =
    'html to ReactElement <a target="_blank" href="https://www.npmjs.com/package/html-react-parser">html-react-parser</a>  \n' +
    'jsx to ReactElement <a target="_blank" href="https://www.npmjs.com/package/sucrase">sucrase</a>  \n' +
    'ReactElement to png <a target="_blank" href="https://www.npmjs.com/package/@vercel/og">@vercel/og</a>  \n' +
    '<a target="_blank" href="https://og-playground.vercel.app/">og-playground</a>  \n' +
    '<a target="_blank" href="https://github.com/vercel/satori#overview">vercel/satori</a>  \n';

  export interface Config {}
  export const Config: Schema<Config> = Schema.object({});
}

export default VercelSatoriPngService;
