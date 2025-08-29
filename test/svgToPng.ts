import { createRequire } from "node:module";
import path from "node:path";
import * as resvg from "@resvg/resvg-wasm";
import fs from "node:fs/promises";

(async () => {
  const require = createRequire("file:///" + __filename);
  const reSvgWasm = path.join(
    path.dirname(require.resolve("@resvg/resvg-wasm")),
    "index_bg.wasm",
  );
  await resvg.initWasm(await fs.readFile(reSvgWasm));
  const svg = await fs.readFile("./test.svg", "utf-8");
  console.time();
  const resvgJS = new resvg.Resvg(svg, {
    fitTo: {
      mode: "width",
      value: 650,
    },
  });
  const pngData = resvgJS.render();
  const png = pngData.asPng();
  pngData.free();
  resvgJS.free();

  console.timeEnd();
  await fs.writeFile("./svgToPng.png", png);
})();
