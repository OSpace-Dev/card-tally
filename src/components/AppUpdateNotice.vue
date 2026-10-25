<script setup lang="ts">
import { computed } from "vue";
import { useLedger } from "../composables/useLedger";
import { useAppUpdate } from "../composables/useAppUpdate";
const { formBusy, booting, loginKey, loggingIn } = useLedger();
const blocked = computed(
  () => formBusy.value || booting.value || loggingIn.value || !!loginKey.value,
);
const { visible, updating, error, later, update } = useAppUpdate(blocked);
</script>
<template>
  <aside
    v-if="visible"
    class="app-update-banner"
    role="status"
    aria-live="polite"
    aria-label="应用版本更新"
  >
    <div>
      <strong>发现新版本</strong>
      <p>{{ error || "更新界面即可使用最新功能，登录状态会保留。" }}</p>
    </div>
    <div class="app-update-actions">
      <button class="text-button" :disabled="updating" @click="later">
        稍后</button
      ><el-button type="primary" :loading="updating" @click="update"
        >立即更新</el-button
      >
    </div>
  </aside>
</template>
