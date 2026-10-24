export interface Card {
  id: number;
  bank: string;
  name: string;
  last4: string;
  color: string;
}
export interface Transaction {
  id: number;
  card_id: number;
  type: "expense" | "refund";
  amount_cents: number;
  date: string;
  category: string;
  merchant: string;
  note: string;
  bank: string;
  card_name: string;
  last4: string;
  color: string;
}
export interface CardTotal {
  id: number;
  bank: string;
  name: string;
  last4: string;
  color: string;
  expense: number;
  refund: number;
  net: number;
  count: number;
}
export interface Report {
  month: string;
  expense: number;
  refund: number;
  net: number;
  count: number;
  budget: number;
  previousNet: number;
  byCard: CardTotal[];
  byCategory: { name: string; expense: number; refund: number; net: number }[];
  daily: { date: string; net: number }[];
  trends: { month: string; expense: number; refund: number; net: number }[];
}
let key = sessionStorage.getItem("ledger-key") || "";
export function setKey(value: string) {
  key = value;
  if (value) sessionStorage.setItem("ledger-key", value);
  else sessionStorage.removeItem("ledger-key");
}
export function hasKey() {
  return !!key;
}
export async function request<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch("/api" + url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      ...options.headers,
    },
  });
  if (!response.ok) {
    if (response.status === 401) {
      setKey("");
      window.dispatchEvent(new Event("ledger-unauthorized"));
    }
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `请求失败（${response.status}）`);
  }
  return response.json();
}
export async function exportCsv(query: string) {
  const response = await fetch("/api/export?" + query, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!response.ok) {
    if (response.status === 401) {
      setKey("");
      window.dispatchEvent(new Event("ledger-unauthorized"));
    }
    throw new Error("导出失败，请检查登录状态与网络");
  }
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = `信用卡明细-${new URLSearchParams(query).get("month")}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const money = (cents: number) =>
  new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
  }).format(cents / 100);
export function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
