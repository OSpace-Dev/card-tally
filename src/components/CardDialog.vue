<script setup lang="ts">
import { useLedger } from "../composables/useLedger";
import { useMobile } from "../composables/useMobile";
const mobile = useMobile();
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
  if (saving.value) return;
  saving.value = true;
  let committed = false;
  try {
    if (!(await cardForm.value?.validate().catch(() => false))) return;
    await request(
      editingCard.value ? `/cards/${editingCard.value}` : "/cards",
      {
        method: editingCard.value ? "PUT" : "POST",
        body: JSON.stringify(card),
      },
    );
    committed = true;
    await loadCards();
    await loadData();
    cardOpen.value = false;
    ElMessage.success("卡片已保存");
  } catch (e) {
    if (committed) {
      cardOpen.value = false;
      ElMessage.warning("卡片已保存，列表刷新失败，请刷新页面查看。");
    } else notifyError(e);
  } finally {
    saving.value = false;
  }
}
import { ref } from "vue";
import { type FormInstance, type FormRules } from "element-plus";
const cardForm = ref<FormInstance>();
const manualBank = ref(false);
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
      :disabled="saving"
      label-position="top"
      @submit.prevent="saveCard"
      ><el-form-item label="银行名称" prop="bank"
        ><el-input
          v-if="mobile && manualBank"
          v-model.trim="card.bank"
          maxlength="30"
          placeholder="输入银行名称"
          aria-label="银行名称"
        />
        <el-select
          v-else
          v-model="card.bank"
          :filterable="!mobile"
          :allow-create="!mobile"
          :popper-class="mobile ? 'mobile-bank-dropdown' : ''"
          default-first-option
          :placeholder="mobile ? '选择银行' : '选择银行，或输入其他银行名称'"
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
        ><button
          v-if="mobile"
          type="button"
          class="text-button bank-input-toggle"
          :disabled="saving"
          @click="manualBank = !manualBank"
        >
          {{ manualBank ? "返回银行列表" : "未找到？手动输入银行" }}</button
        ><span class="bank-select-hint">{{
          mobile
            ? manualBank
              ? "输入完整银行名称，最多 30 个字符。"
              : "点选银行即可，无需输入。"
            : "可搜索银行；未收录的银行可输入名称后选中。"
        }}</span></el-form-item
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
            :disabled="saving"
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
