import {
  inject,
  type InjectionKey,
  computed,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  watch,
} from "vue";
import { ElMessage } from "element-plus";
import {
  DataAnalysis,
  List,
  CreditCard,
  Histogram,
} from "@element-plus/icons-vue";
import { BANK_GROUPS } from "../data/banks";
import {
  request,
  exportCsv,
  hasKey,
  setKey,
  money,
  localDate,
  type Card,
  type Transaction,
  type Report,
} from "../api";

import { useRoute, useRouter } from "vue-router";

type Page = "overview" | "records" | "cards" | "card-statistics";
export function createLedger() {
  const nav = [
    { key: "overview" as Page, name: "月度总览", icon: DataAnalysis },
    { key: "card-statistics" as Page, name: "各卡月度统计", icon: Histogram },
    { key: "records" as Page, name: "消费明细", icon: List },
    { key: "cards" as Page, name: "我的信用卡", icon: CreditCard },
  ];
  const router = useRouter(),
    route = useRoute();
  const active = computed<Page>({
    get: () => (route.name as Page) || "overview",
    set: (value) => {
      void router.push({ name: value });
    },
  });
  const authenticated = ref(false),
    booting = ref(true),
    loginKey = ref(""),
    loggingIn = ref(false);
  const rememberDevice = ref(true),
    reconnectError = ref("");
  const cards = ref<Card[]>([]),
    categories = ref<string[]>([]),
    report = ref<Report | null>(null),
    rows = ref<Transaction[]>([]),
    total = ref(0);
  const annualRevision = ref(0);
  const month = ref(localDate().slice(0, 7)),
    loading = ref(false),
    error = ref(""),
    page = ref(1);
  const filters = reactive({ card_id: "", type: "", category: "", q: "" });
  const saving = ref(false),
    exporting = ref(false);
  const transactionOpen = ref(false),
    cardOpen = ref(false),
    budgetOpen = ref(false),
    editingTransaction = ref<number | null>(null),
    editingCard = ref<number | null>(null);
  const transaction = reactive({
    card_id: undefined as number | undefined,
    type: "expense" as "expense" | "refund",
    amount: "",
    date: localDate(),
    category: "餐饮美食",
    merchant: "",
    note: "",
  });
  const card = reactive({ bank: "", name: "", last4: "", color: "#16665b" });
  const bankGroups = computed(() => {
    const builtIn = new Set(BANK_GROUPS.flatMap((group) => group.banks));
    const custom = [...new Set(cards.value.map((item) => item.bank))].filter(
      (bank) => !builtIn.has(bank),
    );
    return custom.length
      ? [...BANK_GROUPS, { label: "已使用的其他银行", banks: custom }]
      : BANK_GROUPS;
  });
  const budget = reactive({ amount: "" });
  const colors = [
    "#16665b",
    "#3459a3",
    "#9a443d",
    "#6b4e99",
    "#8b682e",
    "#36475d",
  ];
  const title = computed(
    () => nav.find((n) => n.key === active.value)?.name || "",
  );
  const monthLabel = computed(
    () => `${month.value.slice(0, 4)}年${Number(month.value.slice(5))}月`,
  );
  const budgetPercent = computed(() =>
    report.value?.budget
      ? Math.max(
          0,
          Math.min(
            100,
            Math.round((report.value.net / report.value.budget) * 100),
          ),
        )
      : 0,
  );
  const comparison = computed(() => {
    if (!report.value) return "";
    const previous = report.value.previousNet;
    if (previous <= 0) return "上月无正向净支出，不计算环比";
    const rate = ((report.value.net - previous) / previous) * 100;
    return `较上月${rate >= 0 ? "增加" : "减少"} ${Math.abs(rate).toFixed(1)}%`;
  });
  function notifyError(e: unknown) {
    ElMessage.error(e instanceof Error ? e.message : "操作失败");
  }
  function unauthorized() {
    reconnectError.value = "";
    loginKey.value = "";
    loadVersion++;
    loading.value = false;
    authenticated.value = false;
    report.value = null;
    cards.value = [];
    rows.value = [];
    total.value = 0;
    transactionOpen.value = false;
    cardOpen.value = false;
    budgetOpen.value = false;
  }
  async function login() {
    if (!loginKey.value.trim()) {
      ElMessage.warning("请输入访问密钥");
      return;
    }
    loggingIn.value = true;
    setKey(loginKey.value.trim());
    try {
      await initialize(rememberDevice.value);
      loginKey.value = "";
    } catch (e) {
      if (!authenticated.value) setKey("");
      notifyError(e);
    } finally {
      loggingIn.value = false;
    }
  }
  async function initialize(remember?: boolean) {
    const [session, initialCards] = await Promise.all([
      request<{ categories: string[] }>("/session"),
      request<Card[]>("/cards"),
    ]);
    if (remember !== undefined && !setKey(loginKey.value.trim(), remember)) {
      ElMessage.warning("浏览器未允许保存登录状态，本次仍可使用账本。");
    }
    categories.value = session.categories;
    cards.value = initialCards;
    authenticated.value = true;
    booting.value = false;
    await loadData();
  }
  async function loadCards() {
    cards.value = await request<Card[]>("/cards");
  }
  let loadVersion = 0;
  async function loadData() {
    if (!authenticated.value || !month.value) return;
    const version = ++loadVersion;
    error.value = "";
    loading.value = false;
    // Each page fetches only what it displays; the yearly page owns its request.
    if (active.value === "card-statistics") {
      annualRevision.value++;
      return;
    }
    if (active.value === "cards") return;
    loading.value = true;
    const isOverview = active.value === "overview";
    if (isOverview && report.value?.month !== month.value) report.value = null;
    try {
      if (isOverview) {
        const result = await request<Report>("/report?month=" + month.value);
        if (version !== loadVersion || !authenticated.value) return;
        report.value = result;
      } else {
        const result = await request<{ rows: Transaction[]; total: number }>(
          "/transactions?" + query(),
        );
        if (version !== loadVersion || !authenticated.value) return;
        rows.value = result.rows;
        total.value = result.total;
      }
    } catch (e) {
      if (version === loadVersion)
        error.value = e instanceof Error ? e.message : "加载失败";
    } finally {
      if (version === loadVersion) loading.value = false;
    }
  }
  function query() {
    const q = new URLSearchParams({
      month: month.value,
      page: String(page.value),
      page_size: "15",
    });
    Object.entries(filters).forEach(([key, value]) => {
      if (value) q.set(key, value);
    });
    return q.toString();
  }
  function changeMonth(delta: number) {
    const d = new Date(`${month.value}-01T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + delta);
    const next = d.toISOString().slice(0, 7);
    if (next >= "1900-01" && next <= "9998-12") month.value = next;
  }
  watch([month, active], ([currentMonth], [previousMonth]) => {
    if (currentMonth !== previousMonth) page.value = 1;
    void loadData();
  });
  function search() {
    page.value = 1;
    loadData();
  }
  function resetFilters() {
    Object.assign(filters, { card_id: "", type: "", category: "", q: "" });
    search();
  }
  function openTransaction(row?: Transaction) {
    if (!cards.value.length) {
      ElMessage.info("请先添加一张信用卡");
      active.value = "cards";
      openCard();
      return;
    }
    editingTransaction.value = row?.id ?? null;
    Object.assign(
      transaction,
      row
        ? {
            card_id: row.card_id,
            type: row.type,
            amount: (row.amount_cents / 100).toFixed(2),
            date: row.date,
            category: row.category,
            merchant: row.merchant,
            note: row.note,
          }
        : {
            card_id:
              transaction.card_id &&
              cards.value.some((c) => c.id === transaction.card_id)
                ? transaction.card_id
                : cards.value[0]?.id,
            type: "expense",
            amount: "",
            date: localDate(),
            category: "餐饮美食",
            merchant: "",
            note: "",
          },
    );
    transactionOpen.value = true;
  }
  function openCard(item?: Card) {
    editingCard.value = item?.id ?? null;
    Object.assign(
      card,
      item
        ? {
            bank: item.bank,
            name: item.name,
            last4: item.last4,
            color: item.color,
          }
        : {
            bank: "",
            name: "",
            last4: "",
            color: colors[cards.value.length % colors.length],
          },
    );
    cardOpen.value = true;
  }
  function openBudget() {
    budget.amount = report.value?.budget
      ? (report.value.budget / 100).toFixed(2)
      : "";
    budgetOpen.value = true;
  }
  async function download() {
    exporting.value = true;
    try {
      await exportCsv(query());
      ElMessage.success("已导出当前月份与筛选条件下的全部明细");
    } catch (e) {
      notifyError(e);
    } finally {
      exporting.value = false;
    }
  }
  function logout() {
    setKey("");
    unauthorized();
  }
  function showCardRecords(id: number) {
    Object.assign(filters, {
      card_id: String(id),
      type: "",
      category: "",
      q: "",
    });
    page.value = 1;
    if (active.value === "records") void loadData();
    else active.value = "records";
  }
  async function restoreSession() {
    booting.value = true;
    reconnectError.value = "";
    try {
      if (hasKey()) await initialize();
    } catch (e) {
      if (hasKey() && !authenticated.value)
        reconnectError.value =
          e instanceof Error ? e.message : "暂时无法连接账本";
      else notifyError(e);
    } finally {
      booting.value = false;
    }
  }
  onMounted(() => {
    window.addEventListener("ledger-unauthorized", unauthorized);
    void restoreSession();
  });
  onUnmounted(() =>
    window.removeEventListener("ledger-unauthorized", unauthorized),
  );

  return {
    nav,
    active,
    authenticated,
    cards,
    annualRevision,
    month,
    filters,
    saving,
    transactionOpen,
    transaction,
    card,
    bankGroups,
    budget,
    colors,
    title,
    monthLabel,
    budgetPercent,
    comparison,
    booting,
    loginKey,
    rememberDevice,
    reconnectError,
    restoreSession,
    loggingIn,
    categories,
    report,
    rows,
    total,
    loading,
    error,
    page,
    exporting,
    cardOpen,
    budgetOpen,
    editingTransaction,
    editingCard,
    notifyError,
    unauthorized,
    login,
    initialize,
    loadCards,
    loadData,
    query,
    changeMonth,
    search,
    resetFilters,
    openTransaction,
    openCard,
    openBudget,
    download,
    logout,
    showCardRecords,
    money,
    localDate,
  };
}

export type Ledger = ReturnType<typeof createLedger>;
export const ledgerKey: InjectionKey<Ledger> = Symbol("ledger");
export function useLedger() {
  const ledger = inject(ledgerKey);
  if (!ledger) throw new Error("Ledger provider is missing");
  return ledger;
}
