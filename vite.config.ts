import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import Components from "unplugin-vue-components/vite";
import { ElementPlusResolver } from "unplugin-vue-components/resolvers";

export default defineConfig({
  plugins: [
    vue(),
    Components({
      dts: "src/components.d.ts",
      resolvers: [ElementPlusResolver({ importStyle: "css" })],
    }),
  ],
  server: { proxy: { "/api": "http://127.0.0.1:3001" } },
  build: { manifest: true },
});
