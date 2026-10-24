export const ACCESS_KEY_STORAGE = "card-tally.access-key";
function readStoredKey() {
  try {
    const value = localStorage.getItem(ACCESS_KEY_STORAGE);
    if (value) return value;
  } catch {
    /* Storage may be unavailable in restricted browsing. */
  }
  try {
    return sessionStorage.getItem(ACCESS_KEY_STORAGE) || "";
  } catch {
    return "";
  }
}
let key = readStoredKey();
export const getKey = () => key;
export const hasKey = () => !!key;

// Returns true only when the requested persistence was successfully written.
export function setKey(value: string, remember = false) {
  key = value;
  try {
    localStorage.removeItem(ACCESS_KEY_STORAGE);
  } catch {
    /* Keep in-memory authentication usable. */
  }
  try {
    sessionStorage.removeItem(ACCESS_KEY_STORAGE);
  } catch {
    /* Keep in-memory authentication usable. */
  }
  if (!value) return true;
  try {
    (remember ? localStorage : sessionStorage).setItem(
      ACCESS_KEY_STORAGE,
      value,
    );
    return true;
  } catch {
    // A storage denial must not prevent login; fall back to this tab when possible.
    if (remember) {
      try {
        sessionStorage.setItem(ACCESS_KEY_STORAGE, value);
      } catch {
        /* Memory only. */
      }
    }
    return false;
  }
}

// Locking another tab also locks this one. Do not erase a new key saved by another tab.
window.addEventListener("storage", (event) => {
  if (event.key === ACCESS_KEY_STORAGE || event.key === null) {
    const stored = readStoredKey();
    if (stored === key) return;
    key = stored;
    window.dispatchEvent(new Event("ledger-unauthorized"));
  }
});
