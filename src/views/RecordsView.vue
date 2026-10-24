<script setup lang="ts">
import { Download, EditPen, Delete, Wallet } from "@element-plus/icons-vue";
import { useLedger } from "../composables/useLedger";
const {
  cards,
  filters,
  card,
  title,
  monthLabel,
  categories,
  rows,
  total,
  loading,
  page,
  exporting,
  loadData,
  search,
  resetFilters,
  openTransaction,
  download,
  money,
  notifyError,
} = useLedger();
import { request, type Transaction } from "../api";
import { ElMessage, ElMessageBox } from "element-plus";
async function deleteRecord(row: Transaction) {
  try {
    await ElMessageBox.confirm(
      `确定删除 ${row.date} 的 ${money(row.amount_cents)} ${row.type === "refund" ? "退款" : "消费"}？此操作不可撤销。`,
      "删除记录",
      {
        type: "warning",
        confirmButtonText: "确定删除",
        cancelButtonText: "取消",
      },
    );
  } catch {
    return;
  }
  try {
    await request(`/transactions/${row.id}`, { method: "DELETE" });
    if (rows.value.length === 1 && page.value > 1) page.value--;
    await loadData();
    ElMessage.success("记录已删除");
  } catch (e) {
    notifyError(e);
  }
}
</script>

<template>
  <section class="panel records-panel">
    <div class="section-heading">
      <div>
        <h2>
          {{ monthLabel }}明细 <span class="subtle-tag">{{ total }} 笔</span>
        </h2>
        <p>筛选仅影响明细与导出，不改变月度总览</p>
      </div>
      <el-button :icon="Download" :loading="exporting" @click="download"
        >导出 CSV</el-button
      >
    </div>
    <form class="filter-bar" @submit.prevent="search">
      <el-select
        v-model="filters.card_id"
        clearable
        placeholder="全部信用卡"
        aria-label="筛选信用卡"
        @change="search"
        ><el-option
          v-for="item in cards"
          :key="item.id"
          :value="String(item.id)"
          :label="`${item.bank} · ${item.last4}`" /></el-select
      ><el-select
        v-model="filters.type"
        clearable
        placeholder="全部类型"
        aria-label="筛选记录类型"
        @change="search"
        ><el-option label="消费" value="expense" /><el-option
          label="退款"
          value="refund" /></el-select
      ><el-select
        v-model="filters.category"
        clearable
        placeholder="全部分类"
        aria-label="筛选消费分类"
        @change="search"
        ><el-option
          v-for="item in categories"
          :key="item"
          :label="item"
          :value="item" /></el-select
      ><el-input
        v-model="filters.q"
        maxlength="80"
        clearable
        placeholder="搜索商户、备注"
        aria-label="搜索商户或备注"
        @clear="search"
      /><el-button native-type="submit" plain>查询</el-button
      ><button type="button" class="text-button" @click="resetFilters">
        重置
      </button>
    </form>
    <el-table
      v-loading="loading"
      :data="rows"
      class="desktop-table"
      empty-text="暂无记录，试试调整筛选条件或记一笔"
      row-key="id"
      ><el-table-column prop="date" label="日期" width="115" /><el-table-column
        label="商户 / 备注"
        min-width="170"
        ><template #default="{ row }"
          ><div class="merchant-cell">
            <strong>{{ row.merchant || row.category }}</strong
            ><small :title="row.note">{{ row.note || "无备注" }}</small>
          </div></template
        ></el-table-column
      ><el-table-column label="信用卡" min-width="170"
        ><template #default="{ row }"
          ><div class="table-card">
            <i :style="{ background: row.color }"></i
            ><span
              >{{ row.bank
              }}<small> {{ row.card_name }} · {{ row.last4 }}</small></span
            >
          </div></template
        ></el-table-column
      ><el-table-column
        prop="category"
        label="分类"
        width="110" /><el-table-column label="类型" width="80"
        ><template #default="{ row }"
          ><span :class="['type-pill', row.type]">{{
            row.type === "expense" ? "消费" : "退款"
          }}</span></template
        ></el-table-column
      ><el-table-column label="金额" align="right" width="140"
        ><template #default="{ row }"
          ><strong :class="{ 'refund-text': row.type === 'refund' }"
            >{{ row.type === "refund" ? "−" : ""
            }}{{ money(row.amount_cents) }}</strong
          ></template
        ></el-table-column
      ><el-table-column label="操作" align="right" width="100"
        ><template #default="{ row }"
          ><button
            class="icon-button small"
            aria-label="编辑记录"
            @click="openTransaction(row)"
          >
            <el-icon><EditPen /></el-icon></button
          ><button
            class="icon-button small delete-button"
            aria-label="删除记录"
            @click="deleteRecord(row)"
          >
            <el-icon><Delete /></el-icon></button></template></el-table-column
    ></el-table>
    <div v-loading="loading" class="mobile-records">
      <el-empty
        v-if="!rows.length"
        description="暂无记录，试试记一笔"
        :image-size="70"
      />
      <article v-for="row in rows" :key="row.id" class="mobile-record">
        <div class="mobile-record-main">
          <span class="record-category-icon"
            ><el-icon><Wallet /></el-icon
          ></span>
          <div>
            <strong>{{ row.merchant || row.category }}</strong
            ><small>{{ row.date }} · {{ row.category }}</small>
          </div>
          <strong
            :class="['mobile-amount', { 'refund-text': row.type === 'refund' }]"
            >{{ row.type === "refund" ? "退款 −" : ""
            }}{{ money(row.amount_cents) }}</strong
          >
        </div>
        <p v-if="row.note" class="mobile-note">{{ row.note }}</p>
        <div class="mobile-record-bottom">
          <span>{{ row.bank }} · {{ row.last4 }}</span>
          <div>
            <button class="text-button" @click="openTransaction(row)">
              编辑</button
            ><button
              class="text-button delete-button"
              @click="deleteRecord(row)"
            >
              删除
            </button>
          </div>
        </div>
      </article>
    </div>
    <div class="pagination">
      <span>共 {{ total }} 笔，每页 15 笔</span
      ><el-pagination
        v-model:current-page="page"
        :page-size="15"
        :total="total"
        layout="prev, pager, next"
        :pager-count="5"
        @current-change="loadData"
      />
    </div>
  </section>
</template>
