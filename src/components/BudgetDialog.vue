<script setup lang="ts">
import { useLedger } from "../composables/useLedger";
const {
  saving,
  budget,
  title,
  monthLabel,
  loading,
  budgetOpen,
  month,
  loadData,
  notifyError,
} = useLedger();
import { request } from "../api";
import { ElMessage } from "element-plus";
async function saveBudget() {
  if (saving.value) return;
  saving.value = true;
  try {
    if (
      budget.amount &&
      !(await budgetForm.value?.validate().catch(() => false))
    )
      return;
    await request("/budget", {
      method: "PUT",
      body: JSON.stringify({ month: month.value, amount: budget.amount }),
    });
    await loadData();
    budgetOpen.value = false;
    ElMessage.success("月度预算已更新");
  } catch (e) {
    notifyError(e);
  } finally {
    saving.value = false;
  }
}
import { ref } from "vue";
import { type FormInstance, type FormRules } from "element-plus";
const budgetForm = ref<FormInstance>();
const amountRule = {
  validator: (
    _rule: unknown,
    value: string,
    callback: (error?: Error) => void,
  ) => {
    if (!/^\d{1,8}(\.\d{1,2})?$/.test(value) || Number(value) <= 0)
      callback(new Error("请输入大于 0 的金额，最多两位小数"));
    else callback();
  },
  trigger: "blur",
};
</script>

<template>
  <el-dialog
    v-model="budgetOpen"
    :title="`${monthLabel}预算`"
    width="420px"
    class="responsive-dialog"
    :close-on-click-modal="false"
    :close-on-press-escape="!saving"
    :show-close="!saving"
    destroy-on-close
    @opened="budgetForm?.clearValidate()"
    ><el-form
      ref="budgetForm"
      :model="budget"
      :rules="{ amount: [amountRule] }"
      :disabled="saving"
      label-position="top"
      @submit.prevent="saveBudget"
      ><el-form-item label="本月预算金额（元）" prop="amount"
        ><el-input
          v-model.trim="budget.amount"
          inputmode="decimal"
          maxlength="11"
          placeholder="例如：8000.00"
      /></el-form-item>
      <p class="form-hint">
        预算仅作用于当前月份，按全部信用卡的净支出计算。留空保存可取消预算。
      </p>
      <div class="dialog-actions">
        <el-button :disabled="saving" @click="budgetOpen = false"
          >取消</el-button
        ><el-button type="primary" native-type="submit" :loading="saving"
          >保存预算</el-button
        >
      </div></el-form
    ></el-dialog
  >
</template>
