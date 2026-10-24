<script setup lang="ts">
import { provide } from "vue";
import { createLedger, ledgerKey } from "./composables/useLedger";
import LoginView from "./views/LoginView.vue";
import TransactionDialog from "./components/TransactionDialog.vue";
import CardDialog from "./components/CardDialog.vue";
import BudgetDialog from "./components/BudgetDialog.vue";
const ledger = createLedger();
provide(ledgerKey, ledger);
const { booting, authenticated, reconnectError, restoreSession, logout } =
  ledger;
</script>

<template>
  <div v-if="booting" class="boot-screen" aria-live="polite">
    正在打开你的账本…
  </div>
  <main v-else-if="reconnectError" class="connection-screen">
    <section class="panel">
      <h1>暂时无法连接账本</h1>
      <p>已保存的密钥会保留，恢复网络后可以直接重试。</p>
      <p role="alert">{{ reconnectError }}</p>
      <el-button type="primary" @click="restoreSession">重新连接</el-button
      ><el-button @click="logout">清除登录状态</el-button>
    </section>
  </main>
  <LoginView v-else-if="!authenticated" />
  <template v-else>
    <router-view />
    <TransactionDialog />
    <CardDialog />
    <BudgetDialog />
  </template>
</template>
