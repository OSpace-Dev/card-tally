<script setup lang="ts">
import { useLedger } from "../composables/useLedger";
const {
  cards,
  saving,
  transactionOpen,
  transaction,
  title,
  categories,
  rows,
  loading,
  editingTransaction,
  month,
  page,
  loadData,
  notifyError,
} = useLedger();
import { request } from "../api";
import { ElMessage } from "element-plus";
async function saveTransaction() {
  if (transaction.amount.endsWith("."))
    transaction.amount = transaction.amount.slice(0, -1);
  if (!(await transactionForm.value?.validate().catch(() => false))) return;
  saving.value = true;
  try {
    await request(
      editingTransaction.value
        ? `/transactions/${editingTransaction.value}`
        : "/transactions",
      {
        method: editingTransaction.value ? "PUT" : "POST",
        body: JSON.stringify(transaction),
      },
    );
    transactionOpen.value = false;
    ElMessage.success(
      editingTransaction.value ? "记录已更新" : "记下了，又是一笔清晰的账",
    );
    if (month.value !== transaction.date.slice(0, 7))
      month.value = transaction.date.slice(0, 7);
    else {
      page.value = 1;
      await loadData();
    }
  } catch (e) {
    notifyError(e);
  } finally {
    saving.value = false;
  }
}
import { ref, watch } from "vue";
import NumericKeypad from "./NumericKeypad.vue";
const quick = ref(false);
watch(
  transactionOpen,
  (open) => {
    if (!open) return;
    quick.value =
      !editingTransaction.value &&
      window.matchMedia("(max-width: 767px)").matches;
    if (quick.value) transaction.category = "其他消费";
  },
  { immediate: true },
);
import { type FormInstance, type FormRules } from "element-plus";
const transactionForm = ref<FormInstance>();
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
const transactionRules: FormRules = {
  card_id: [{ required: true, message: "请选择信用卡", trigger: "change" }],
  amount: [amountRule],
  date: [{ required: true, message: "请选择日期", trigger: "change" }],
  category: [{ required: true, message: "请选择分类", trigger: "change" }],
};
</script>

<template>
  <el-dialog
    v-model="transactionOpen"
    :title="editingTransaction ? '编辑记账记录' : '记下新的一笔'"
    width="520px"
    :class="{ 'quick-entry-dialog': quick }"
    class="responsive-dialog"
    :close-on-click-modal="false"
    :close-on-press-escape="!saving"
    :show-close="!saving"
    destroy-on-close
    @opened="transactionForm?.clearValidate()"
  >
    <el-form
      ref="transactionForm"
      :model="transaction"
      :rules="transactionRules"
      label-position="top"
      @submit.prevent="saveTransaction"
      ><div class="entry-mode-bar">
        <span
          >{{ quick ? "快速记账" : "完整表单" }} · {{ transaction.date }} ·
          {{ transaction.category
          }}{{ transaction.type === "refund" ? " · 退款" : "" }}</span
        ><button
          type="button"
          class="text-button"
          :disabled="saving"
          @click="quick = !quick"
        >
          {{ quick ? "完整表单" : "极简记账" }}
        </button>
      </div>
      <el-form-item v-if="!quick" label="记录类型"
        ><el-radio-group v-model="transaction.type" class="type-selector"
          ><el-radio-button label="消费" value="expense" /><el-radio-button
            label="退款"
            value="refund" /></el-radio-group></el-form-item
      ><el-form-item label="金额（元）" prop="amount"
        ><el-input
          v-model.trim="transaction.amount"
          :readonly="quick"
          :inputmode="quick ? 'none' : 'decimal'"
          placeholder="0.00"
          size="large"
          maxlength="11"
          class="amount-input"
          ><template #prefix>¥</template></el-input
        ></el-form-item
      ><el-form-item label="信用卡" prop="card_id"
        ><div
          v-if="quick"
          class="quick-card-options"
          role="group"
          aria-label="选择记账信用卡"
        >
          <button
            v-for="item in cards"
            :key="item.id"
            type="button"
            :disabled="saving"
            :aria-pressed="transaction.card_id === item.id"
            :class="{ chosen: transaction.card_id === item.id }"
            @click="transaction.card_id = item.id"
          >
            <i :style="{ background: item.color }"></i
            ><span
              >{{ item.bank }} · {{ item.last4
              }}<small>{{ item.name }}</small></span
            >
          </button>
        </div>
        <el-select v-else v-model="transaction.card_id" placeholder="选择信用卡"
          ><el-option
            v-for="item in cards"
            :key="item.id"
            :label="`${item.bank} · ${item.name} (${item.last4})`"
            :value="item.id" /></el-select
      ></el-form-item>
      <NumericKeypad
        v-if="quick"
        v-model="transaction.amount"
        :disabled="saving"
      />
      <div v-show="!quick" class="form-two-columns">
        <el-form-item label="发生日期" prop="date"
          ><el-date-picker
            v-model="transaction.date"
            type="date"
            value-format="YYYY-MM-DD"
            :editable="false"
            :clearable="false"
            class="full-width" /></el-form-item
        ><el-form-item label="消费分类" prop="category"
          ><el-select v-model="transaction.category"
            ><el-option
              v-for="item in categories"
              :key="item"
              :label="item"
              :value="item" /></el-select
        ></el-form-item>
      </div>
      <el-form-item v-show="!quick" label="商户 / 消费内容"
        ><el-input
          v-model.trim="transaction.merchant"
          maxlength="80"
          placeholder="例如：午餐、超市采购（可选）" /></el-form-item
      ><el-form-item v-show="!quick" label="备注"
        ><el-input
          v-model="transaction.note"
          type="textarea"
          :rows="2"
          maxlength="300"
          show-word-limit
          placeholder="留下一点细节（可选）"
      /></el-form-item>
      <p v-if="transaction.type === 'refund'" class="form-hint">
        退款按实际退回日期记账，将抵扣该月份净支出；不会修改原消费记录。
      </p>
      <div class="dialog-actions">
        <el-button :disabled="saving" @click="transactionOpen = false"
          >取消</el-button
        ><el-button type="primary" native-type="submit" :loading="saving"
          >保存记录</el-button
        >
      </div></el-form
    >
  </el-dialog>
</template>
