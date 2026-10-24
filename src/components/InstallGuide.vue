<script setup lang="ts">
import { defineAsyncComponent, onMounted, onUnmounted, ref } from "vue";
import { Cellphone } from "@element-plus/icons-vue";
const InstallInstructions = defineAsyncComponent(
  () => import("./InstallInstructions.vue"),
);
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
  <InstallInstructions
    v-if="open"
    v-model="open"
    :ios="ios"
    :can-install="!!prompt"
    @install="install"
  />
</template>
