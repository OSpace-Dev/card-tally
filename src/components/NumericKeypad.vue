<script setup lang="ts">
import { Delete } from "@element-plus/icons-vue";
const model = defineModel<string>({ required: true });
const props = defineProps<{ disabled?: boolean }>();
function press(key: string) {
  if (props.disabled) return;
  if (key === "backspace") {
    model.value = model.value.slice(0, -1);
    return;
  }
  if (key === ".") {
    if (!model.value.includes(".")) model.value = (model.value || "0") + ".";
    return;
  }
  const next = model.value === "0" ? key : model.value + key;
  if (/^\d{1,8}(\.\d{0,2})?$/.test(next)) model.value = next;
}
</script>
<template>
  <div class="numeric-keypad" role="group" aria-label="金额数字键盘">
    <button
      v-for="key in [
        '1',
        '2',
        '3',
        '4',
        '5',
        '6',
        '7',
        '8',
        '9',
        '.',
        '0',
        'backspace',
      ]"
      :key="key"
      type="button"
      :disabled="disabled"
      :aria-label="
        key === 'backspace' ? '删除一位' : key === '.' ? '小数点' : `数字${key}`
      "
      @click="press(key)"
    >
      <el-icon v-if="key === 'backspace'"><Delete /></el-icon
      ><template v-else>{{ key }}</template>
    </button>
  </div>
</template>
