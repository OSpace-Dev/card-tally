<script setup lang="ts">
import { provide } from "vue";
import { createLedger, ledgerKey } from "./composables/useLedger";
import LoginView from "./views/LoginView.vue";
import TransactionDialog from "./components/TransactionDialog.vue";
import CardDialog from "./components/CardDialog.vue";
import BudgetDialog from "./components/BudgetDialog.vue";
const ledger = createLedger();
provide(ledgerKey, ledger);
const { booting, authenticated } = ledger;
</script>

<template>
  <div v-if="booting" class="boot-screen" aria-live="polite">
    正在打开你的账本…
  </div>
  <LoginView v-else-if="!authenticated" />
  <template v-else>
    <router-view />
    <TransactionDialog />
    <CardDialog />
    <BudgetDialog />
  </template>
</template>
