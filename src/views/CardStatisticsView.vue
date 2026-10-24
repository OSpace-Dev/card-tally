<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { money } from "../api";
import { useLedger } from "../composables/useLedger";
import {
  useCardReport,
  metrics,
  type Metric,
} from "../composables/useCardReport";
import CardYearChart from "../components/CardYearChart.vue";
const { month, monthLabel, showCardRecords } = useLedger();
const router = useRouter();
const year = computed(() => month.value.slice(0, 4));
const { data, busy, error, load } = useCardReport(year);
const selectedId = ref<number>(),
  metric = ref<Metric>("expense");
const index = computed(() => Number(month.value.slice(5)) - 1);
const selected = computed(() =>
  data.value?.cards.find((card) => card.id === selectedId.value),
);
const monthlyCards = computed(() =>
  (data.value?.cards || [])
    .map((card) => ({ card, current: card.months[index.value]! }))
    .sort((a, b) => b.current[metric.value] - a.current[metric.value]),
);
const max = computed(() =>
  Math.max(
    1,
    ...monthlyCards.value.map((item) => Math.abs(item.current[metric.value])),
  ),
);
const totals = computed(() =>
  monthlyCards.value.reduce(
    (sum, { current }) => ({
      expense: sum.expense + current.expense,
      refund: sum.refund + current.refund,
      net: sum.net + current.net,
      count: sum.count + current.count,
    }),
    { expense: 0, refund: 0, net: 0, count: 0 },
  ),
);
const format = (n: number) => (metric.value === "count" ? `${n} 笔` : money(n));
watch(data, (result) => {
  if (result && !result.cards.some((card) => card.id === selectedId.value))
    selectedId.value = result.cards[0]?.id;
});
function details(targetMonth = month.value) {
  if (!selected.value) return;
  void router.push({
    name: "card-month-details",
    params: { cardId: selected.value.id },
    query: { year: year.value, month: targetMonth },
  });
}
</script>
<template>
  <section class="panel card-statistics" v-loading="busy">
    <div class="section-heading">
      <div>
        <h2>{{ monthLabel }} · 各卡当月情况</h2>
        <p>先看这个月各张卡的消费，点击卡片查看全年趋势。</p>
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
      <div class="month-summary">
        <span
          >本月消费 <strong>{{ money(totals.expense) }}</strong></span
        ><span
          >退款 <strong>{{ money(totals.refund) }}</strong></span
        ><span
          >净支出 <strong>{{ money(totals.net) }}</strong></span
        >
      </div>
      <div class="monthly-card-grid">
        <article
          v-for="{ card, current } in monthlyCards"
          :key="card.id"
          class="monthly-card"
          :class="{ selected: selectedId === card.id }"
        >
          <button
            class="monthly-card-select"
            :aria-label="`选择${card.bank}尾号${card.last4}查看全年趋势`"
            :aria-pressed="selectedId === card.id"
            @click="selectedId = card.id"
          >
            <span class="monthly-card-title"
              ><i :style="{ background: card.color }"></i
              ><span
                ><strong>{{ card.bank }} · {{ card.last4 }}</strong
                ><small>{{ card.name }}</small></span
              ></span
            ><strong>{{ format(current[metric]) }}</strong>
          </button>
          <div class="category-track">
            <span
              :style="{
                width: `${(Math.abs(current[metric]) / max) * 100}%`,
                background: card.color,
              }"
            ></span>
          </div>
          <dl class="month-card-values">
            <div>
              <dt>消费</dt>
              <dd>{{ money(current.expense) }}</dd>
            </div>
            <div>
              <dt>退款</dt>
              <dd>{{ money(current.refund) }}</dd>
            </div>
            <div>
              <dt>净支出</dt>
              <dd>{{ money(current.net) }}</dd>
            </div>
          </dl>
          <div class="monthly-card-footer">
            <span
              >{{ current.count }} 笔{{
                current.count ? "" : " · 本月无记录"
              }}</span
            ><button
              class="text-button"
              :aria-label="`查看${card.bank}尾号${card.last4}当月消费明细`"
              @click="showCardRecords(card.id)"
            >
              当月明细
            </button>
          </div>
        </article>
      </div>
      <template v-if="selected"
        ><div class="single-card-heading">
          <div>
            <h3>
              {{ selected.bank }} · {{ selected.last4 }} · {{ year }}年趋势
            </h3>
            <p>
              {{ selected.name }} · 全年{{
                metrics.find((m) => m.value === metric)?.label
              }}
              {{ format(selected[metric]) }}
            </p>
          </div>
          <button class="text-button" @click="details()">查看逐月明细 →</button>
        </div>
        <CardYearChart
          :months="selected.months"
          :metric="metric"
          :selected="month"
          :color="selected.color"
          @select="details"
      /></template>
      <p class="report-footnote">
        按自然月统计，净支出 = 消费 −
        退款，退款计入实际发生月份。顶部可切换月份，全年数字明细在二级页面查看。
      </p>
    </template>
  </section>
</template>
