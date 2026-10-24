<script setup lang="ts">
import { useLedger } from "../composables/useLedger";
const {
  saving,
  card,
  bankGroups,
  colors,
  title,
  loading,
  cardOpen,
  editingCard,
  loadCards,
  loadData,
  notifyError,
} = useLedger();
import { request } from "../api";
import { ElMessage } from "element-plus";
async function saveCard() {
  if (!(await cardForm.value?.validate().catch(() => false))) return;
  saving.value = true;
  try {
    await request(
      editingCard.value ? `/cards/${editingCard.value}` : "/cards",
      {
        method: editingCard.value ? "PUT" : "POST",
        body: JSON.stringify(card),
      },
    );
    cardOpen.value = false;
    await loadCards();
    await loadData();
    ElMessage.success("卡片已保存");
  } catch (e) {
    notifyError(e);
  } finally {
    saving.value = false;
  }
}
import { ref } from "vue";
import { type FormInstance, type FormRules } from "element-plus";
const cardForm = ref<FormInstance>();
const cardRules: FormRules = {
  bank: [
    {
      required: true,
      whitespace: true,
      message: "请选择或输入银行名称",
      trigger: ["blur", "change"],
    },
    { max: 30, message: "银行名称最多 30 个字符", trigger: ["blur", "change"] },
  ],
  name: [
    {
      required: true,
      whitespace: true,
      message: "请输入卡片名称",
      trigger: "blur",
    },
  ],
  last4: [
    {
      pattern: /^\d{4}$/,
      required: true,
      message: "请输入卡号后四位数字",
      trigger: "blur",
    },
  ],
};
</script>

<template>
  <el-dialog
    v-model="cardOpen"
    :title="editingCard ? '编辑信用卡' : '添加信用卡'"
    width="460px"
    class="responsive-dialog"
    :close-on-click-modal="false"
    :close-on-press-escape="!saving"
    :show-close="!saving"
    destroy-on-close
    @opened="cardForm?.clearValidate()"
    ><el-form
      ref="cardForm"
      :model="card"
      :rules="cardRules"
      label-position="top"
      @submit.prevent="saveCard"
      ><el-form-item label="银行名称" prop="bank"
        ><el-select
          v-model="card.bank"
          filterable
          allow-create
          default-first-option
          placeholder="选择银行，或输入其他银行名称"
          aria-label="银行名称"
          ><el-option-group
            v-for="group in bankGroups"
            :key="group.label"
            :label="group.label"
            ><el-option
              v-for="bank in group.banks"
              :key="bank"
              :label="bank"
              :value="bank" /></el-option-group></el-select
        ><span class="bank-select-hint"
          >可搜索银行；未收录的银行可输入名称后选中。</span
        ></el-form-item
      ><el-form-item label="卡片名称" prop="name"
        ><el-input
          v-model.trim="card.name"
          maxlength="30"
          placeholder="例如：日常消费卡" /></el-form-item
      ><el-form-item label="卡号后四位" prop="last4"
        ><el-input
          v-model="card.last4"
          maxlength="4"
          inputmode="numeric"
          placeholder="仅需后四位，无需完整卡号" /></el-form-item
      ><el-form-item label="卡片颜色"
        ><div class="color-options">
          <button
            v-for="color in colors"
            :key="color"
            type="button"
            :style="{ background: color }"
            :class="{ chosen: card.color === color }"
            :aria-label="`选择颜色 ${color}`"
            :aria-pressed="card.color === color"
            @click="card.color = color"
          >
            <span v-if="card.color === color">✓</span>
          </button>
        </div></el-form-item
      >
      <div class="dialog-actions">
        <el-button :disabled="saving" @click="cardOpen = false">取消</el-button
        ><el-button type="primary" native-type="submit" :loading="saving"
          >保存卡片</el-button
        >
      </div></el-form
    ></el-dialog
  >
</template>
