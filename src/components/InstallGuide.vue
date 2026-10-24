<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { Cellphone, Upload } from "@element-plus/icons-vue";
interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
const open = ref(false),
  installed = ref(false),
  ios = ref(false),
  prompt = ref<InstallPrompt | null>(null);
const standaloneQuery = window.matchMedia("(display-mode: standalone)");
function updateInstalled() {
  installed.value =
    standaloneQuery.matches ||
    !!(navigator as Navigator & { standalone?: boolean }).standalone;
}
function capturePrompt(event: Event) {
  event.preventDefault();
  prompt.value = event as InstallPrompt;
}
function installedEvent() {
  updateInstalled();
  prompt.value = null;
  open.value = false;
}
async function install() {
  const event = prompt.value;
  if (!event) return;
  prompt.value = null;
  await event.prompt();
  if ((await event.userChoice).outcome === "accepted") open.value = false;
}
onMounted(() => {
  ios.value =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  updateInstalled();
  standaloneQuery.addEventListener("change", updateInstalled);
  window.addEventListener("beforeinstallprompt", capturePrompt);
  window.addEventListener("appinstalled", installedEvent);
});
onUnmounted(() => {
  standaloneQuery.removeEventListener("change", updateInstalled);
  window.removeEventListener("beforeinstallprompt", capturePrompt);
  window.removeEventListener("appinstalled", installedEvent);
});
</script>

<template>
  <button
    v-if="!installed"
    class="text-button install-guide-button"
    @click="open = true"
  >
    <el-icon><Cellphone /></el-icon>添加到主屏幕
  </button>
  <el-dialog
    v-model="open"
    title="像 App 一样打开卡有数"
    width="440px"
    class="responsive-dialog install-guide-dialog"
  >
    <img
      src="/icons/apple-touch-icon.png"
      alt="卡有数图标"
      width="64"
      height="64"
      class="install-guide-icon"
    />
    <ol v-if="ios" class="install-steps">
      <li>在 Safari 中打开当前账本网址。</li>
      <li>
        点击浏览器的分享按钮 <el-icon><Upload /></el-icon>。
      </li>
      <li>
        选择“添加到主屏幕”；若出现“作为 Web App 打开”，保持开启，再点击“添加”。
      </li>
      <li>从主屏幕的“卡有数”图标进入，首次登录时勾选“记住此设备”。</li>
    </ol>
    <ol v-else class="install-steps">
      <li>打开浏览器菜单，选择“安装应用”或“添加到主屏幕”。</li>
      <li>从新图标进入，登录时保持勾选“记住此设备”。</li>
    </ol>
    <p class="form-hint">
      安装后使用独立窗口，隐藏浏览器地址栏。请使用 HTTPS
      网址；安装入口由浏览器提供。若主屏幕 App 未带入 Safari 的登录状态，只需在
      App 中登录一次。
    </p>
    <el-button v-if="prompt" type="primary" class="full-width" @click="install"
      >安装卡有数</el-button
    >
  </el-dialog>
</template>
