'use client';
import { useEffect, useRef } from 'react';

/** Keep browser/Android Back inside the app, closing the foremost dialog first. */
export function useAppBack(onBack: () => void) {
  const callback = useRef(onBack);
  const url = useRef('');
  callback.current = onBack;
  if (typeof window !== 'undefined') url.current = window.location.href;
  useEffect(() => {
    const pushGuard = () => {
      // Preserve Next's history fields so its router can restore this same document.
      history.pushState({ ...history.state, __tokiBack: 'guard' }, '', url.current);
    };
    if (history.state?.__tokiBack !== 'guard') {
      history.replaceState({ ...history.state, __tokiBack: 'base' }, '', url.current);
      pushGuard();
    }
    let activated = false;
    const armFromGesture = () => {
      if (activated) return;
      activated = true;
      // Chrome can skip entries created without user activation. Arm once on a
      // real interaction too; do not add entries for every screen/modal render.
      history.replaceState({ ...history.state, __tokiBack: 'base' }, '', url.current);
      pushGuard();
    };
    const back = () => {
      pushGuard();
      const dialogs = document.querySelectorAll<HTMLDialogElement>('.app dialog[open]');
      const focused = document.activeElement?.closest<HTMLDialogElement>('dialog[open]');
      const foremost = focused ?? dialogs[dialogs.length - 1];
      if (foremost) {
        // Use the same close/cancel behavior as Escape and Android's dialog Back.
        // Required game decisions deliberately keep their no-op cancel handler.
        foremost.dispatchEvent(new Event('cancel', { cancelable: true }));
      } else callback.current();
    };
    // Native Android Back is a close request before it becomes history navigation.
    // Let modal dialogs own that request; watch the game itself when no dialog is open.
    type Watcher = EventTarget & { destroy: () => void };
    const NativeWatcher = (window as unknown as { CloseWatcher?: new () => Watcher }).CloseWatcher;
    let watcher: Watcher | undefined;
    let disposed = false;
    const armNative = () => {
      if (!NativeWatcher || disposed) return;
      if (document.querySelector('.app dialog[open]')) {
        watcher?.destroy();
        watcher = undefined;
        return;
      }
      if (watcher) return;
      watcher = new NativeWatcher();
      watcher.addEventListener('close', () => {
        watcher = undefined;
        callback.current();
        queueMicrotask(armNative);
      });
    };
    const observer = new MutationObserver(armNative);
    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['open'],
      childList: true,
    });
    armNative();
    window.addEventListener('pointerdown', armNative, true);
    window.addEventListener('popstate', back);
    window.addEventListener('pointerdown', armFromGesture, { once: true, capture: true });
    window.addEventListener('keydown', armFromGesture, { once: true, capture: true });
    return () => {
      disposed = true;
      observer.disconnect();
      watcher?.destroy();
      window.removeEventListener('pointerdown', armNative, true);
      window.removeEventListener('popstate', back);
      window.removeEventListener('pointerdown', armFromGesture, true);
      window.removeEventListener('keydown', armFromGesture, true);
    };
  }, []);
}
