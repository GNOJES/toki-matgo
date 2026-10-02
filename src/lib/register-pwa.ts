export function registerPwa() {
  if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return () => {};
  let registration: ServiceWorkerRegistration | undefined;
  let disposed = false;
  const cacheApp = () => {
    const worker = navigator.serviceWorker.controller ?? registration?.active;
    const urls = Array.from(
      document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>(
        'script[src], link[rel="stylesheet"][href]',
      ),
    ).map((el) => ('src' in el ? el.src : el.href));
    worker?.postMessage({ type: 'CACHE_APP', urls });
    worker?.postMessage({ type: 'GET_CARD_ASSETS' });
  };
  const update = () => {
    if (navigator.onLine && document.visibilityState === 'visible')
      void registration?.update().catch(() => {});
  };
  navigator.serviceWorker.addEventListener('controllerchange', cacheApp);
  document.addEventListener('visibilitychange', update);
  window.addEventListener('online', update);
  const timer = window.setInterval(update, 5 * 60 * 1000);
  void navigator.serviceWorker
    .register('/sw.js', { updateViaCache: 'none' })
    .then(async (reg) => {
      if (disposed) return;
      registration = reg;
      await navigator.serviceWorker.ready;
      if (disposed) return;
      cacheApp();
      update();
    })
    .catch(() => {});
  return () => {
    disposed = true;
    clearInterval(timer);
    navigator.serviceWorker.removeEventListener('controllerchange', cacheApp);
    document.removeEventListener('visibilitychange', update);
    window.removeEventListener('online', update);
  };
}
