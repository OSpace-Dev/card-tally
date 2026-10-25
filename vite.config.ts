import { randomUUID } from "node:crypto";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import Components from "unplugin-vue-components/vite";
import { ElementPlusResolver } from "unplugin-vue-components/resolvers";

const buildId = randomUUID();
const builtAt = new Date().toISOString();

export default defineConfig({
  define: { __APP_BUILD_ID__: JSON.stringify(buildId) },
  plugins: [
    vue(),
    {
      name: "card-tally-version",
      apply: "build",
      transformIndexHtml: () => [
        {
          tag: "meta",
          attrs: { name: "card-tally-build", content: buildId },
          injectTo: "head",
        },
      ],
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "version.json",
          source: JSON.stringify({ buildId, builtAt }),
        });
      },
    },
    Components({
      dts: "src/components.d.ts",
      resolvers: [ElementPlusResolver({ importStyle: "css" })],
    }),
  ],
  server: { proxy: { "/api": "http://127.0.0.1:3001" } },
  build: { manifest: true },
});
