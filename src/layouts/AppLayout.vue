<script setup lang="ts">
import {
  Plus,
  ArrowLeft,
  ArrowRight,
  SwitchButton,
  Wallet,
  Refresh,
  Lock,
} from "@element-plus/icons-vue";
import InstallGuide from "../components/InstallGuide.vue";
import { useLedger } from "../composables/useLedger";
const {
  nav,
  active,
  cards,
  month,
  title,
  report,
  rows,
  loading,
  error,
  page,
  loadData,
  changeMonth,
  openTransaction,
  openCard,
  logout,
  localDate,
} = useLedger();
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-symbol"
          ><el-icon><Wallet /></el-icon></span
        ><span>卡有数<span class="brand-en">CARD TALLY</span></span>
      </div>
      <div class="nav-caption">我的账本</div>
      <nav aria-label="主导航">
        <button
          v-for="item in nav"
          :key="item.key"
          :class="['nav-item', { active: active === item.key }]"
          :aria-current="active === item.key ? 'page' : undefined"
          @click="active = item.key"
        >
          <el-icon><component :is="item.icon" /></el-icon
          ><span>{{ item.name }}</span
          ><span v-if="item.key === 'cards'" class="nav-count">{{
            cards.length
          }}</span>
        </button>
      </nav>
      <div class="sidebar-bottom">
        <div class="private-note">
          <span class="status-dot"></span>
          <div>数据保存在你的服务端<small>多设备访问，同一本账</small></div>
        </div>
        <button class="logout-button" @click="logout">
          <el-icon><SwitchButton /></el-icon>锁定账本
        </button>
      </div>
    </aside>
    <div class="workspace">
      <header class="topbar">
        <span class="breadcrumb"
          >我的账本 <span>/</span> <strong>{{ title }}</strong></span
        ><span class="topbar-note"
          ><span class="status-dot"></span> 私人信用卡账本</span
        ><button
          class="mobile-lock icon-button"
          aria-label="锁定账本"
          @click="logout"
        >
          <el-icon><Lock /></el-icon>
        </button>
      </header>
      <main class="main-content" :aria-busy="loading">
        <section class="page-heading">
          <div>
            <span class="eyebrow">{{
              active === "overview"
                ? "MONTHLY OVERVIEW"
                : active === "card-statistics"
                  ? "CARD MONTHLY STATISTICS"
                  : active === "records"
                    ? "TRANSACTIONS"
                    : "MY CREDIT CARDS"
            }}</span>
            <h1>{{ title }}<span class="heading-dot">.</span></h1>
            <p>
              {{
                active === "overview"
                  ? "把零散的消费，变成清晰的每月生活。"
                  : active === "card-statistics"
                    ? "每张卡、每个月，消费与退款都看清。"
                    : active === "records"
                      ? "每一笔消费和退款，都有迹可循。"
                      : "管理不同银行的卡片，让消费各归其位。"
              }}
            </p>
          </div>
          <el-button
            type="primary"
            size="large"
            :icon="Plus"
            @click="active === 'cards' ? openCard() : openTransaction()"
            >{{ active === "cards" ? "添加信用卡" : "记一笔" }}</el-button
          >
        </section>
        <section v-if="active !== 'cards'" class="month-toolbar">
          <div class="month-controls">
            <button
              class="icon-button"
              aria-label="上个月"
              @click="changeMonth(-1)"
            >
              <el-icon><ArrowLeft /></el-icon></button
            ><el-date-picker
              v-model="month"
              type="month"
              value-format="YYYY-MM"
              format="YYYY年MM月"
              :clearable="false"
              :editable="false"
              :disabled-date="
                (date: Date) =>
                  date.getFullYear() < 1900 || date.getFullYear() > 9998
              "
              aria-label="选择统计月份"
            /><button
              class="icon-button"
              aria-label="下个月"
              @click="changeMonth(1)"
            >
              <el-icon><ArrowRight /></el-icon></button
            ><button
              class="text-button current-month"
              @click="month = localDate().slice(0, 7)"
            >
              回到本月
            </button>
          </div>
          <span class="month-explanation">按自然月统计 · 人民币 CNY</span
          ><button
            class="icon-button"
            aria-label="刷新账本"
            :disabled="loading"
            @click="loadData"
          >
            <el-icon><Refresh /></el-icon>
          </button>
        </section>
        <el-alert
          v-if="error"
          :title="error"
          type="error"
          show-icon
          :closable="false"
          class="error-alert"
          ><template #default
            >未能取得最新数据，请检查网络后
            <button class="text-button" @click="loadData">重新加载</button
            >。</template
          ></el-alert
        >
        <div v-if="loading && !report" class="panel">
          <el-skeleton :rows="8" animated />
        </div>
        <router-view />
        <footer class="page-footer">
          <span
            >卡有数
            <span class="footer-divider">/</span> 让每一笔，都有数。</span
          ><InstallGuide /><span>私人账本 · 数据由你保管</span>
        </footer>
      </main>
    </div>
    <nav class="mobile-nav" aria-label="手机主导航">
      <button
        v-for="item in nav"
        :key="item.key"
        :class="{ active: active === item.key }"
        :aria-current="active === item.key ? 'page' : undefined"
        @click="active = item.key"
      >
        <el-icon><component :is="item.icon" /></el-icon
        ><span>{{ item.name }}</span>
      </button>
    </nav>
  </div>
</template>
