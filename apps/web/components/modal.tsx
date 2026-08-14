'use client';

/**
 * Accessible modal dialog built on the native `<dialog>` element.
 *
 * Using `<dialog>` (rather than an absolutely-positioned div) gives us the
 * browser's top-layer rendering, so the modal escapes any `overflow: hidden`
 * ancestor and never clips — plus focus trapping and Escape-to-close for free.
 * We drive it with `showModal()`/`close()` from the `open` prop and route the
 * native `cancel`/`close` events back to `onClose`, so the parent stays the
 * single source of truth.
 *
 * The default backdrop transition is respected; `prefers-reduced-motion` users
 * get an instant open via the global stylesheet.
 */
import { useEffect, useRef, type ReactNode } from 'react';

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  // Mirror the `open` prop onto the dialog's imperative state. showModal()
  // renders into the top layer and traps focus; close() releases it.
  useEffect(() => {
    const dialog = ref.current;
    if (dialog === null) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClose={onClose}
      // Clicking the backdrop (the dialog element itself, outside the panel)
      // dismisses. Clicks inside the panel stop here and don't bubble up.
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby="modal-title"
      aria-describedby={description ? 'modal-description' : undefined}
      className="z-modal m-auto w-[calc(100%-2rem)] max-w-md rounded-card border-2 border-ink bg-paper-raised p-0 text-ink shadow-brutal backdrop:bg-ink/55"
    >
      <div className="p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 id="modal-title" className="font-display text-xl text-ink">
              {title}
            </h2>
            {description && (
              <p id="modal-description" className="text-sm text-ink-muted">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-badge border-2 border-ink bg-paper-raised text-ink shadow-[2px_2px_0_#14171F] transition-[background-color,box-shadow,transform] duration-150 hover:bg-ledger-gold/25 hover:text-ink hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden>
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
