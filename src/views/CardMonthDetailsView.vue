<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { money } from "../api";
import { useLedger } from "../composables/useLedger";
import { useCardReport } from "../composables/useCardReport";
const route = useRoute(),
  router = useRouter();
const { month, showCardRecords } = useLedger();
const year = computed(() =>
  typeof route.query.year === "string" &&
  /^(19\d{2}|[2-9]\d{3})$/.test(route.query.year) &&
  Number(route.query.year) <= 9998
    ? route.query.year
    : month.value.slice(0, 4),
);
const { data, busy, error, load } = useCardReport(year);
const card = computed(() =>
  data.value?.cards.find((card) => card.id === Number(route.params.cardId)),
);
const selectedMonth = ref("");
watch(
  [year, () => route.query.month],
  () => {
    selectedMonth.value =
      typeof route.query.month === "string" &&
      route.query.month.startsWith(year.value + "-") &&
      /^\d{4}-(0[1-9]|1[0-2])$/.test(route.query.month)
        ? route.query.month
        : `${year.value}-01`;
  },
  { immediate: true },
);
function records(target: string) {
  if (!card.value) return;
  month.value = target;
  showCardRecords(card.value.id);
}
</script>
<template>
  <section class="panel card-month-details" v-loading="busy">
    <button
      class="text-button"
      @click="router.push({ name: 'card-statistics' })"
    >
      ← 返回各卡当月统计
    </button>
    <div class="section-heading">
      <div>
        <h2>
          {{ card ? `${card.bank} · ${card.last4}` : "单卡" }} ·
          {{ year }}年逐月明细
        </h2>
        <p>{{ card?.name }} · 消费、退款和净支出按月完整列出。</p>
      </div>
    </div>
    <el-alert v-if="error" :title="error" type="error" :closable="false"
      ><button class="text-button" @click="load">重新加载</button></el-alert
    >
    <el-empty v-else-if="!busy && !card" description="未找到这张信用卡" />
    <template v-if="card && !error"
      ><div class="single-card-totals">
        <div>
          <span>全年消费</span><strong>{{ money(card.expense) }}</strong>
        </div>
        <div>
          <span>全年退款</span><strong>{{ money(card.refund) }}</strong>
        </div>
        <div>
          <span>全年净支出</span><strong>{{ money(card.net) }}</strong>
        </div>
        <div>
          <span>全年笔数</span><strong>{{ card.count }} 笔</strong>
        </div>
      </div>
      <div class="monthly-detail-list">
        <article
          v-for="entry in card.months"
          :key="entry.month"
          :class="{ selected: entry.month === selectedMonth }"
        >
          <div class="single-month-top">
            <strong>{{ Number(entry.month.slice(5)) }}月</strong
            ><span>{{ entry.count }} 笔</span
            ><button
              class="text-button"
              :aria-label="`查看${entry.month}消费明细`"
              @click="records(entry.month)"
            >
              消费明细 →
            </button>
          </div>
          <dl class="month-card-values">
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
          </dl>
        </article>
      </div>
    </template>
  </section>
</template>
