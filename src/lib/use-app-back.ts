'use client';
import { useEffect, useRef } from 'react';

/** Real gesture history anchors + native dialog close requests. */
export function useAppBack(onBack: () => void, protect = true) {
  const callback = useRef(onBack);
  const currentUrl = useRef('');
  if (typeof window !== 'undefined') currentUrl.current = window.location.href;
  const protectedRef = useRef(protect);
  callback.current = onBack;
  protectedRef.current = protect;
  useEffect(() => {
    const url = () => window.location.href;
    const pushGuard = () =>
      history.pushState({ ...history.state, __tokiBack: 'guard' }, '', currentUrl.current);
    // Keep a fallback for history.back(); browser toolbar Back may skip this
    // initial entry until real user activation. The gesture creates fresh anchors.
    if (history.state?.__tokiBack !== 'guard') {
      history.replaceState({ ...history.state, __tokiBack: 'base' }, '', url());
      pushGuard();
    }
    let activated = false;
    const arm = () => {
      if (activated) return;
      activated = true;
      // Do not merely relabel the pre-activation entry: create BOTH anchors
      // during a real gesture so Chrome's history intervention cannot skip them.
      history.pushState({ ...history.state, __tokiBack: 'base' }, '', url());
      pushGuard();
    };
    const back = () => {
      pushGuard();
      const dialogs = document.querySelectorAll<HTMLDialogElement>('.app dialog[open]');
      const foremost = dialogs[dialogs.length - 1];
      if (foremost) foremost.dispatchEvent(new Event('cancel', { cancelable: true }));
      else callback.current();
    };
    // Native <dialog> owns Android close requests. An extra app CloseWatcher
    // can share its activation group and close the game along with the popup.
    const unload = (event: BeforeUnloadEvent) => {
      if (!protectedRef.current && !document.querySelector('.app dialog[open]')) return;
      event.preventDefault();
      event.returnValue = '';
    };
    let bareEscape = false;
    const escapeDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      bareEscape = !document.querySelector('.app dialog[open]');
      if (bareEscape) e.preventDefault();
    };
    const escapeUp = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (bareEscape) callback.current();
      bareEscape = false;
    };
    window.addEventListener('keydown', escapeDown, true);
    window.addEventListener('keyup', escapeUp);
    window.addEventListener('popstate', back);
    window.addEventListener('pointerdown', arm, true);
    window.addEventListener('click', arm, true);
    window.addEventListener('keydown', arm, true);
    window.addEventListener('beforeunload', unload);
    return () => {
      window.removeEventListener('keydown', escapeDown, true);
      window.removeEventListener('keyup', escapeUp);
      window.removeEventListener('popstate', back);
      window.removeEventListener('pointerdown', arm, true);
      window.removeEventListener('click', arm, true);
      window.removeEventListener('keydown', arm, true);
      window.removeEventListener('beforeunload', unload);
    };
  }, []);
}
