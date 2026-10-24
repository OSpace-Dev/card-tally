<script setup lang="ts">
import "element-plus/es/components/message-box/style/css";
import {
  Plus,
  CreditCard,
  ArrowRight,
  EditPen,
  Delete,
  Lock,
} from "@element-plus/icons-vue";
import { useLedger } from "../composables/useLedger";
const {
  cards,
  card,
  openCard,
  showCardRecords,
  filters,
  loadCards,
  loadData,
  notifyError,
} = useLedger();
import { request, type Card } from "../api";
import { ElMessage, ElMessageBox } from "element-plus";
async function deleteCard(item: Card) {
  try {
    await ElMessageBox.confirm(
      `删除「${item.bank} · ${item.name}」？已有消费记录的卡片不能删除。`,
      "删除信用卡",
      {
        type: "warning",
        confirmButtonText: "确定删除",
        cancelButtonText: "取消",
      },
    );
  } catch {
    return;
  }
  try {
    await request(`/cards/${item.id}`, { method: "DELETE" });
    if (filters.card_id === String(item.id)) filters.card_id = "";
    await loadCards();
    await loadData();
    ElMessage.success("卡片已删除");
  } catch (e) {
    notifyError(e);
  }
}
</script>

<template>
  <section class="cards-intro">
    <div>
      <h2>{{ cards.length }} 张信用卡，一个清晰的账本</h2>
      <p>只记录卡号后四位，不需要完整卡号、有效期或安全码。</p>
    </div>
    <span class="subtle-tag">人民币记账</span>
  </section>
  <div class="credit-cards-grid">
    <article v-for="item in cards" :key="item.id" class="credit-card-wrap">
      <div class="credit-card" :style="{ background: item.color }">
        <div class="credit-card-top">
          <strong>{{ item.bank }}</strong
          ><el-icon><CreditCard /></el-icon>
        </div>
        <span class="card-chip" aria-hidden="true"></span>
        <div class="masked-number">
          •••• <span>••••</span> •••• {{ item.last4 }}
        </div>
        <div class="credit-card-bottom">
          <span>{{ item.name }}</span
          ><small>CREDIT CARD</small>
        </div>
      </div>
      <div class="credit-card-actions">
        <button class="text-button" @click="showCardRecords(item.id)">
          查看本月明细 <el-icon><ArrowRight /></el-icon>
        </button>
        <div>
          <button
            class="icon-button"
            aria-label="编辑信用卡"
            @click="openCard(item)"
          >
            <el-icon><EditPen /></el-icon></button
          ><button
            class="icon-button delete-button"
            aria-label="删除信用卡"
            @click="deleteCard(item)"
          >
            <el-icon><Delete /></el-icon>
          </button>
        </div>
      </div>
    </article>
    <button class="add-card-tile" @click="openCard()">
      <span
        ><el-icon><Plus /></el-icon></span
      ><strong>添加一张信用卡</strong><small>让不同银行的消费有序归档</small>
    </button>
  </div>
  <div class="info-note">
    <el-icon><Lock /></el-icon>
    <p>
      卡片已有消费或退款记录时不可删除，以保护历史统计。支持随时修改银行名称、卡片名称和颜色。
    </p>
  </div>
</template>
