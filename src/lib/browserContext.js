/** Per-tab identity survives reconnects; claims only describe the environment. */
export function collectBrowserContext() {
  let id;
  try {
    id = sessionStorage.getItem("mio.browser.clientId");
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem("mio.browser.clientId", id);
    }
  } catch {
    id = null;
  }
  return {
    id,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale: navigator.language,
  };
}
