<script setup lang="ts">
import { computed } from "vue";
import { money } from "../api";
const props = defineProps<{
  items: { month: string; expense: number; refund: number; net: number }[];
  selected: string;
}>();
const emit = defineEmits<{ select: [month: string] }>();
const maximum = computed(() =>
  Math.max(100, ...props.items.map((i) => Math.abs(i.net))),
);
</script>

<template>
  <div
    class="trend-bars"
    role="group"
    aria-label="近六个月净支出，点击月份查看统计"
  >
    <button
      v-for="item in items"
      :key="item.month"
      class="trend-column"
      :class="{ selected: item.month === selected }"
      :aria-label="`${item.month} 净支出 ${money(item.net)}，点击查看`"
      @click="emit('select', item.month)"
    >
      <span class="trend-amount">{{ money(item.net) }}</span>
      <span class="bar-track"
        ><span
          class="bar-fill"
          :class="{ negative: item.net < 0 }"
          :style="{
            height: `${Math.max(item.net ? 3 : 0, (Math.abs(item.net) / maximum) * 100)}%`,
          }"
        ></span
      ></span>
      <span class="trend-label">{{ item.month.slice(5) }}月</span>
    </button>
  </div>
  <p class="chart-note">柱高表示净支出绝对值；浅色柱及负号表示退款多于消费。</p>
  <details class="chart-details">
    <summary>查看图表数据</summary>
    <div class="table-scroll">
      <table class="data-table">
        <thead>
          <tr>
            <th>月份</th>
            <th>消费</th>
            <th>退款</th>
            <th>净支出</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.month">
            <td>{{ item.month }}</td>
            <td>{{ money(item.expense) }}</td>
            <td>{{ money(item.refund) }}</td>
            <td>{{ money(item.net) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </details>
</template>
