<script setup lang="ts">
import { computed } from "vue";
import { money } from "../api";
import type { Monthly, Metric } from "../composables/useCardReport";
const props = defineProps<{
  months: Monthly[];
  metric: Metric;
  selected: string;
  color: string;
}>();
const emit = defineEmits<{ select: [month: string] }>();
const max = computed(() =>
  Math.max(1, ...props.months.map((m) => Math.abs(m[props.metric]))),
);
const format = (value: number) =>
  props.metric === "count" ? `${value} 笔` : money(value);
</script>
<template>
  <div
    class="year-chart"
    role="group"
    aria-label="单卡全年趋势，点击月份查看明细"
  >
    <button
      v-for="entry in months"
      :key="entry.month"
      class="year-chart-column"
      :class="{ selected: entry.month === selected }"
      :aria-label="`${entry.month} ${format(entry[metric])}，查看明细`"
      @click="emit('select', entry.month)"
    >
      <span class="year-chart-track"
        ><span
          :class="{ negative: entry[metric] < 0 }"
          :style="{
            height: `${Math.max(entry[metric] ? 3 : 0, (Math.abs(entry[metric]) / max) * 100)}%`,
            backgroundColor: color,
          }"
        ></span
      ></span>
      <span>{{ Number(entry.month.slice(5)) }}月</span>
    </button>
  </div>
  <p class="chart-note">
    柱高表示所选指标的绝对值，斜纹表示负值；点击月份查看数字与消费明细。
  </p>
</template>
