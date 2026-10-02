import { useEffect, useRef, type ReactNode } from 'react';
export function Modal({
  title,
  onClose,
  children,
  className = '',
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const el = ref.current;
    const nativeClose = () => {
      // A queued close from React Strict Mode cleanup can arrive after re-opening.
      if (el?.open) return;
      close.current();
      // Required choices have a no-op close callback; re-open if the native
      // close request could not be canceled because Chrome had no activation.
      queueMicrotask(() => {
        if (el?.isConnected && !el.open) el.showModal();
      });
    };
    el?.addEventListener('close', nativeClose);
    el?.showModal();
    return () => {
      el?.removeEventListener('close', nativeClose);
      el?.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${className}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-label={title}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button className="icon-button" aria-label="닫기" onClick={onClose}>
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
