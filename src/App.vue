<script setup lang="ts">
import { defineAsyncComponent, provide } from "vue";
import zhCn from "element-plus/es/locale/lang/zh-cn";
import StartupScreen from "./components/StartupScreen.vue";
import { createLedger, ledgerKey } from "./composables/useLedger";
const LoginView = defineAsyncComponent({
  loader: () => import("./views/LoginView.vue"),
  loadingComponent: StartupScreen,
  delay: 0,
});
const TransactionDialog = defineAsyncComponent(
  () => import("./components/TransactionDialog.vue"),
);
const CardDialog = defineAsyncComponent(
  () => import("./components/CardDialog.vue"),
);
const BudgetDialog = defineAsyncComponent(
  () => import("./components/BudgetDialog.vue"),
);
const ledger = createLedger();
provide(ledgerKey, ledger);
const {
  booting,
  authenticated,
  reconnectError,
  restoreSession,
  logout,
  transactionOpen,
  cardOpen,
  budgetOpen,
} = ledger;
</script>

<template>
  <el-config-provider :locale="zhCn">
    <StartupScreen v-if="booting" />
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
      <TransactionDialog v-if="transactionOpen" />
      <CardDialog v-if="cardOpen" />
      <BudgetDialog v-if="budgetOpen" />
    </template>
  </el-config-provider>
</template>
