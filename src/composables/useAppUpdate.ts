import { computed, onMounted, onUnmounted, ref, type ComputedRef } from "vue";

export function useAppUpdate(blocked: ComputedRef<boolean>) {
  const available = ref(""),
    dismissed = ref(""),
    updating = ref(false),
    error = ref("");
  const visible = computed(
    () =>
      !!available.value &&
      available.value !== dismissed.value &&
      !blocked.value,
  );
  let checking = false,
    disposed = false;
  let interval: ReturnType<typeof setInterval> | undefined;
  let controller: AbortController | undefined;
  async function check() {
    if (
      !import.meta.env.PROD ||
      checking ||
      disposed ||
      document.visibilityState === "hidden"
    )
      return;
    checking = true;
    controller = new AbortController();
    const timeout = setTimeout(() => controller?.abort(), 8000);
    try {
      const response = await fetch(`/version.json?t=${Date.now()}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) return;
      const version = await response.json();
      if (
        typeof version.buildId !== "string" ||
        !/^[a-zA-Z0-9-]{1,100}$/.test(version.buildId)
      )
        return;
      if (!disposed)
        available.value =
          version.buildId === __APP_BUILD_ID__ ? "" : version.buildId;
    } catch {
      /* A failed version check must never interrupt bookkeeping or clear credentials. */
    } finally {
      clearTimeout(timeout);
      checking = false;
    }
  }
  function resume() {
    if (document.visibilityState !== "hidden") void check();
  }
  function later() {
    dismissed.value = available.value;
    error.value = "";
  }
  async function update() {
    if (blocked.value || updating.value || !available.value) return;
    updating.value = true;
    error.value = "";
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 8000);
    try {
      // Confirm the HTML belongs to the announced build; files may still be uploading.
      const response = await fetch(
        `/index.html?update=${encodeURIComponent(available.value)}`,
        { cache: "no-store", signal: abort.signal },
      );
      if (!response.ok) throw new Error("入口页面尚未就绪");
      const html = new DOMParser().parseFromString(
        await response.text(),
        "text/html",
      );
      if (
        html
          .querySelector('meta[name="card-tally-build"]')
          ?.getAttribute("content") !== available.value
      )
        throw new Error("版本文件仍在同步");
      if (blocked.value || disposed) return;
      const url = new URL(location.href);
      url.searchParams.set("_app_version", available.value);
      location.replace(url.href);
    } catch {
      error.value = "暂时无法更新，请稍后重试。";
    } finally {
      clearTimeout(timeout);
      updating.value = false;
    }
  }
  onMounted(() => {
    void check();
    interval = setInterval(
      () => {
        void check();
      },
      5 * 60 * 1000,
    );
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    window.addEventListener("pageshow", resume);
    document.addEventListener("visibilitychange", resume);
  });
  onUnmounted(() => {
    disposed = true;
    controller?.abort();
    clearInterval(interval);
    window.removeEventListener("focus", resume);
    window.removeEventListener("online", resume);
    window.removeEventListener("pageshow", resume);
    document.removeEventListener("visibilitychange", resume);
  });
  return { visible, updating, error, later, update };
}
