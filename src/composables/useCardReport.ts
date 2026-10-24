import { onUnmounted, ref, watch, type Ref } from "vue";
import { request } from "../api";
import { useLedger } from "./useLedger";

export type Totals = {
  expense: number;
  refund: number;
  net: number;
  count: number;
};
export type Monthly = Totals & { month: string };
export type CardYear = Totals & {
  id: number;
  bank: string;
  name: string;
  last4: string;
  color: string;
  months: Monthly[];
};
export type CardReport = { year: number; months: string[]; cards: CardYear[] };
export type Metric = keyof Totals;
export const metrics: { value: Metric; label: string }[] = [
  { value: "expense", label: "消费" },
  { value: "refund", label: "退款" },
  { value: "net", label: "净支出" },
  { value: "count", label: "笔数" },
];
export function useCardReport(year: Readonly<Ref<string>>) {
  const { annualRevision } = useLedger();
  const data = ref<CardReport | null>(null),
    busy = ref(false),
    error = ref("");
  let version = 0;
  async function load() {
    const current = ++version;
    busy.value = true;
    error.value = "";
    data.value = null;
    try {
      const result = await request<CardReport>(
        "/reports/cards?year=" + year.value,
      );
      if (current === version) data.value = result;
    } catch (e) {
      if (current === version)
        error.value = e instanceof Error ? e.message : "加载失败";
    } finally {
      if (current === version) busy.value = false;
    }
  }
  watch([year, annualRevision], load, { immediate: true });
  onUnmounted(() => {
    version++;
  });
  return { data, busy, error, load };
}
