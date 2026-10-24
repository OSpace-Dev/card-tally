import { createApp } from "vue";
import "element-plus/es/components/message/style/css";
import "./style.css";
import App from "./App.vue";
import router from "./router";
createApp(App).use(router).mount("#app");

if (
  import.meta.env.PROD &&
  "serviceWorker" in navigator &&
  window.isSecureContext
) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .catch(() => {
        // Installation support is optional; a registration failure must not block bookkeeping.
      });
  });
}
