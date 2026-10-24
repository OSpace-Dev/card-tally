import { onUnmounted, ref } from "vue";

export function useMobile() {
  const query = window.matchMedia("(max-width: 767px)");
  const mobile = ref(query.matches);
  const update = () => {
    mobile.value = query.matches;
  };
  query.addEventListener("change", update);
  onUnmounted(() => query.removeEventListener("change", update));
  return mobile;
}
