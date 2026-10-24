<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { request, money } from "../api";
import { useLedger } from "../composables/useLedger";

type Totals = { expense: number; refund: number; net: number; count: number };
type Monthly = Totals & { month: string };
type CardYear = Totals & {
  id: number;
  bank: string;
  name: string;
  last4: string;
  color: string;
  months: Monthly[];
};
type CardReport = { year: number; months: string[]; cards: CardYear[] };
type Metric = keyof Totals;
const { month, report, showCardRecords } = useLedger();
const year = computed(() => month.value.slice(0, 4));
const data = ref<CardReport | null>(null),
  busy = ref(false),
  error = ref("");
const selectedId = ref<number>(),
  metric = ref<Metric>("expense");
const metrics: { value: Metric; label: string }[] = [
  { value: "expense", label: "消费" },
  { value: "refund", label: "退款" },
  { value: "net", label: "净支出" },
  { value: "count", label: "笔数" },
];
const selected = computed(() =>
  data.value?.cards.find((card) => card.id === selectedId.value),
);
const monthlyIndex = computed(() => Number(month.value.slice(5)) - 1);
const maximum = computed(() =>
  Math.max(
    1,
    ...(selected.value?.months.map((item) => Math.abs(item[metric.value])) ||
      []),
  ),
);
const format = (value: number) =>
  metric.value === "count" ? `${value} 笔` : money(value);
let version = 0;
async function load() {
  const current = ++version;
  busy.value = true;
  error.value = "";
  try {
    const result = await request<CardReport>(
      "/reports/cards?year=" + year.value,
    );
    if (version !== current) return;
    data.value = result;
    if (!result.cards.some((card) => card.id === selectedId.value))
      selectedId.value = result.cards[0]?.id;
  } catch (e) {
    if (version === current)
      error.value = e instanceof Error ? e.message : "加载失败";
  } finally {
    if (version === current) busy.value = false;
  }
}
watch([year, report], load, { immediate: true });
onUnmounted(() => {
  version++;
});
function viewRecords(cardId: number, targetMonth: string) {
  month.value = targetMonth;
  showCardRecords(cardId);
}
</script>

<template>
  <section class="panel card-statistics" v-loading="busy">
    <div class="section-heading">
      <div>
        <h2>{{ year }} 年 · 各卡月度统计</h2>
        <p>
          包含全部信用卡和 12 个月，无记录显示
          0；可切换消费、退款、净支出或笔数。
        </p>
      </div>
      <el-select
        v-model="metric"
        aria-label="统计指标"
        class="statistics-metric"
        ><el-option
          v-for="item in metrics"
          :key="item.value"
          :label="item.label"
          :value="item.value"
      /></el-select>
    </div>
    <el-alert
      v-if="error"
      :title="error"
      type="error"
      :closable="false"
      show-icon
      ><button class="text-button" @click="load">重新加载</button></el-alert
    >
    <el-empty
      v-else-if="!busy && !data?.cards.length"
      description="添加信用卡后，即可查看每张卡的月度统计"
    />
    <template v-if="data?.cards.length && !error">
      <div
        class="statistics-desktop table-scroll"
        tabindex="0"
        aria-label="各卡全年统计表，可横向滚动"
      >
        <table class="data-table annual-matrix">
          <thead>
            <tr>
              <th>信用卡</th>
              <th
                v-for="m in data.months"
                :key="m"
                :class="{ 'selected-month': m === month }"
              >
                {{ Number(m.slice(5)) }}月
              </th>
              <th>全年合计</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="card in data.cards" :key="card.id">
              <th>
                <button
                  class="text-button"
                  :aria-pressed="selectedId === card.id"
                  @click="selectedId = card.id"
                >
                  {{ card.bank }} · {{ card.last4 }}<br />{{ card.name }}
                </button>
              </th>
              <td
                v-for="entry in card.months"
                :key="entry.month"
                :class="{ 'selected-month': entry.month === month }"
              >
                <button
                  class="matrix-cell"
                  :aria-label="`${card.bank} 尾号${card.last4} ${entry.month} ${format(entry[metric])}，查看明细`"
                  @click="viewRecords(card.id, entry.month)"
                >
                  {{ format(entry[metric]) }}
                </button>
              </td>
              <td>
                <strong>{{ format(card[metric]) }}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="statistics-mobile">
        <p class="chart-note">
          {{ month }} ·
          {{
            metrics.find((item) => item.value === metric)?.label
          }}，点击卡片查看全年。
        </p>
        <button
          v-for="card in data.cards"
          :key="card.id"
          class="statistics-card-row"
          :class="{ chosen: selectedId === card.id }"
          :aria-pressed="selectedId === card.id"
          @click="selectedId = card.id"
        >
          <span
            ><strong>{{ card.bank }} · {{ card.last4 }}</strong
            ><small>{{ card.name }}</small></span
          ><strong>{{ format(card.months[monthlyIndex]![metric]) }}</strong>
        </button>
      </div>
      <div class="single-card-heading">
        <div>
          <h3>单卡全年明细</h3>
          <p>选择一张卡，逐月查看消费、退款和净支出。</p>
        </div>
        <el-select v-model="selectedId" aria-label="选择统计信用卡"
          ><el-option
            v-for="card in data.cards"
            :key="card.id"
            :label="`${card.bank} · ${card.name} (${card.last4})`"
            :value="card.id"
        /></el-select>
      </div>
      <template v-if="selected">
        <div class="single-card-totals">
          <div>
            <span>全年消费</span><strong>{{ money(selected.expense) }}</strong>
          </div>
          <div>
            <span>全年退款</span><strong>{{ money(selected.refund) }}</strong>
          </div>
          <div>
            <span>全年净支出</span><strong>{{ money(selected.net) }}</strong>
          </div>
          <div>
            <span>全年笔数</span><strong>{{ selected.count }} 笔</strong>
          </div>
        </div>
        <div class="single-card-months">
          <article
            v-for="entry in selected.months"
            :key="entry.month"
            :class="{ 'selected-month': entry.month === month }"
          >
            <div class="single-month-top">
              <strong>{{ Number(entry.month.slice(5)) }}月</strong
              ><span>{{ format(entry[metric]) }}</span
              ><button
                class="text-button"
                :aria-label="`查看${entry.month}明细`"
                @click="viewRecords(selected.id, entry.month)"
              >
                明细
              </button>
            </div>
            <div class="category-track">
              <span
                :style="{
                  width: `${(Math.abs(entry[metric]) / maximum) * 100}%`,
                  background: entry[metric] < 0 ? '#8aaeb4' : selected.color,
                }"
              ></span>
            </div>
            <dl>
              <div>
                <dt>消费</dt>
                <dd>{{ money(entry.expense) }}</dd>
              </div>
              <div>
                <dt>退款</dt>
                <dd>{{ money(entry.refund) }}</dd>
              </div>
              <div>
                <dt>净支出</dt>
                <dd>{{ money(entry.net) }}</dd>
              </div>
              <div>
                <dt>笔数</dt>
                <dd>{{ entry.count }}</dd>
              </div>
            </dl>
          </article>
        </div>
      </template>
      <p class="report-footnote">
        按自然月统计，净支出 = 消费 −
        退款；退款计入实际发生月。全年合计包含该年全部记录，柱长表示所选指标的绝对值。
      </p>
    </template>
  </section>
</template>
