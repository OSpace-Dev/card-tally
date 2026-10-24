<script setup lang="ts">
import {
  List,
  CreditCard,
  ArrowRight,
  Wallet,
  Setting,
} from "@element-plus/icons-vue";
import { useLedger } from "../composables/useLedger";
import TrendChart from "../components/TrendChart.vue";
const {
  active,
  cards,
  month,
  card,
  budget,
  colors,
  monthLabel,
  budgetPercent,
  comparison,
  report,
  total,
  openTransaction,
  openBudget,
  showCardRecords,
  money,
} = useLedger();
</script>

<template>
  <template v-if="report">
    <section class="metrics-grid" aria-label="本月统计">
      <article class="metric-card primary-metric">
        <div class="metric-label">本月净支出 <span>NET SPEND</span></div>
        <strong>{{ money(report.net) }}</strong>
        <div class="metric-foot">{{ comparison }}</div>
        <el-icon class="metric-watermark"><Wallet /></el-icon>
      </article>
      <article class="metric-card">
        <div class="metric-label">
          消费总额 <span class="metric-mark">支出</span>
        </div>
        <strong>{{ money(report.expense) }}</strong>
        <div class="metric-foot">记录本月发生的消费</div>
      </article>
      <article class="metric-card">
        <div class="metric-label">
          退款总额 <span class="metric-mark refund-mark">退回</span>
        </div>
        <strong>{{ money(report.refund) }}</strong>
        <div class="metric-foot">按退款实际发生日期统计</div>
      </article>
      <article class="metric-card">
        <div class="metric-label">
          记账笔数 <el-icon><List /></el-icon>
        </div>
        <strong>{{ report.count }}<small>笔</small></strong>
        <div class="metric-foot">涉及 {{ report.byCard.length }} 张信用卡</div>
      </article>
    </section>
    <section class="overview-grid">
      <article class="panel trend-panel">
        <div class="section-heading">
          <div>
            <h2>支出趋势</h2>
            <p>最近六个月，看看消费的节奏</p>
          </div>
          <span class="legend-dot">月度净支出</span>
        </div>
        <TrendChart
          :items="report.trends"
          :selected="month"
          @select="month = $event"
        />
      </article>
      <article class="panel budget-panel">
        <div class="section-heading">
          <div>
            <h2>月度预算</h2>
            <p>{{ monthLabel }} · 全部卡片</p>
          </div>
          <button
            class="icon-button"
            aria-label="设置月度预算"
            @click="openBudget"
          >
            <el-icon><Setting /></el-icon>
          </button>
        </div>
        <template v-if="report.budget"
          ><div class="budget-value">
            {{ money(report.budget) }}<span>本月预算</span>
          </div>
          <el-progress
            :percentage="budgetPercent"
            :stroke-width="10"
            :show-text="false"
            :color="report.net > report.budget ? '#b5473b' : '#16665b'"
          />
          <div class="budget-meta">
            <span>已使用 {{ budgetPercent }}%</span
            ><strong :class="{ danger: report.net > report.budget }"
              >{{ report.net > report.budget ? "已超支" : "剩余" }}
              {{ money(Math.abs(report.budget - report.net)) }}</strong
            >
          </div>
          <p class="budget-tip">
            预算按净支出计算，退款会返还预算额度。
          </p></template
        >
        <div v-else class="budget-empty">
          <span class="budget-illustration"
            ><el-icon><Wallet /></el-icon
          ></span>
          <h3>给消费一个小目标</h3>
          <p>设置本月预算，支出更有方向。</p>
          <el-button plain @click="openBudget">设置月度预算</el-button>
        </div>
      </article>
    </section>
    <section class="overview-grid lower-grid">
      <article class="panel">
        <div class="section-heading">
          <div>
            <h2>各卡消费汇总</h2>
            <p>哪张卡花了多少，一目了然</p>
          </div>
          <button class="text-button" @click="active = 'cards'">
            管理卡片 <el-icon><ArrowRight /></el-icon>
          </button>
        </div>
        <el-empty
          v-if="!report.byCard.length"
          description="这个月还没有消费记录"
          :image-size="70"
          ><el-button type="primary" @click="openTransaction()"
            >记下第一笔</el-button
          ></el-empty
        >
        <div v-else class="card-totals">
          <button
            v-for="item in report.byCard"
            :key="item.id"
            class="card-total-row"
            @click="showCardRecords(item.id)"
          >
            <span class="mini-card" :style="{ background: item.color }"
              ><el-icon><CreditCard /></el-icon></span
            ><span class="card-total-name"
              ><strong>{{ item.bank }} · {{ item.name }}</strong
              ><small>尾号 {{ item.last4 }} · {{ item.count }} 笔</small></span
            ><span class="card-total-amount"
              ><strong>{{ money(item.net) }}</strong
              ><small
                >消费 {{ money(item.expense) }} / 退款
                {{ money(item.refund) }}</small
              ></span
            ><el-icon><ArrowRight /></el-icon>
          </button>
        </div>
      </article>
      <article class="panel">
        <div class="section-heading">
          <div>
            <h2>消费分类</h2>
            <p>按消费总额查看分布，不扣退款</p>
          </div>
          <span class="subtle-tag">{{ report.byCategory.length }} 类</span>
        </div>
        <el-empty
          v-if="!report.byCategory.length"
          description="记录后显示分类统计"
          :image-size="70"
        />
        <div v-else class="category-list">
          <div
            v-for="(item, index) in report.byCategory"
            :key="item.name"
            class="category-row"
          >
            <div class="category-top">
              <span
                ><i :style="{ background: colors[index % colors.length] }"></i
                >{{ item.name }}</span
              ><strong
                >{{ money(item.expense) }}
                <small
                  >{{
                    report.expense
                      ? ((item.expense / report.expense) * 100).toFixed(0)
                      : 0
                  }}%</small
                ></strong
              >
            </div>
            <div class="category-track">
              <span
                :style="{
                  width: `${report.expense ? (item.expense / report.expense) * 100 : 0}%`,
                  background: colors[index % colors.length],
                }"
              ></span>
            </div>
          </div>
        </div>
        <p v-if="report.refund" class="chart-note">
          本月退款 {{ money(report.refund) }}，已计入净支出。
        </p>
      </article>
    </section>
    <section v-if="report.daily.length" class="panel daily-panel">
      <div class="section-heading">
        <div>
          <h2>每日净支出</h2>
          <p>有记账记录的日期 · 消费减退款</p>
        </div>
      </div>
      <div class="daily-list">
        <div v-for="day in report.daily" :key="day.date">
          <span>{{ day.date.slice(5).replace("-", "/") }}</span
          ><strong>{{ money(day.net) }}</strong>
        </div>
      </div>
    </section>
    <p class="report-footnote">
      统计口径：消费日期所在自然月；净支出 = 消费 −
      退款。不代表银行账单、待还款额或信用额度。
    </p>
  </template>
</template>
