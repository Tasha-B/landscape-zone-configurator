
import type { ReactNode } from "react";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import type { Translations } from "../../lib/i18n/translations";
import Button from "../Button/Button";

// Portal target (document.body) only exists client-side. Reads true once
// mounted in the browser, false during SSR/the first hydration pass —
// useSyncExternalStore (not a plain useEffect+setState) is what avoids the
// react-hooks/set-state-in-effect lint here, same trick already used for the
// same "client-only value" problem elsewhere in this codebase (see F.2 in
// docs/phase-5-redesign.md, the old date-input min-date guard).
const subscribeToNothing = () => () => {};
function getIsMounted() {
  return true;
}
function getIsMountedServer() {
  return false;
}

interface SpaceMapperSheetProps {
  open: boolean;
  onClose: () => void;
  reducedMotion: boolean;
  t: Translations;
  // Rendered edge-to-edge (no horizontal padding) — the plan needs every
  // spare pixel of a 390px screen; SpaceMapperPlan's own `padding` prop is
  // what insets it instead. `children` (the results panel + Done) gets the
  // sheet's normal horizontal padding since it's just text/cards.
  plan: ReactNode;
  children: ReactNode;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

// Full-screen mobile bottom sheet shell (batch K, item 3, stage 3) — scrim +
// slide-up panel, focus trap, Escape/scrim/X/Done all close, background
// scroll locked while open. Content is a placeholder until stage 4 wires the
// real interactive plan in.
//
// Rendered through a portal to document.body: SpaceMapper's section sits
// inside page.tsx's scroll-reveal `motion.div` (animates `y`), and any
// non-`none` transform on an ancestor gives `position: fixed` descendants a
// new containing block instead of the real viewport — confirmed empirically
// (the panel landed at y≈-718px instead of ≈64px on a 800px-tall viewport
// before the portal). Portaling to body sidesteps that ancestor entirely.
export default function SpaceMapperSheet({ open, onClose, reducedMotion, t, plan, children }: SpaceMapperSheetProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const mounted = useSyncExternalStore(subscribeToNothing, getIsMounted, getIsMountedServer);

  useEffect(() => {
    if (!open) return;

    const dialog = dialogRef.current;
    const previouslyFocused = document.activeElement;
    dialog?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="scrim"
          className="fixed inset-0 z-50 bg-[#1B2E1F]/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.25 }}
          onClick={onClose}
        >
          <motion.div
            key="panel"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={t.map.mobileSheetLabel}
            tabIndex={-1}
            className="absolute inset-x-0 bottom-0 flex h-[92vh] flex-col overflow-y-auto rounded-t-2xl bg-paper pt-lg outline-none"
            initial={{ y: reducedMotion ? 0 : "100%" }}
            animate={{ y: 0 }}
            exit={{ y: reducedMotion ? 0 : "100%" }}
            transition={{ duration: reducedMotion ? 0 : 0.3, ease: "easeOut" }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label={t.map.mobileSheetClose}
              className="absolute right-4 top-4 font-body text-2xl leading-none text-forest-dark"
            >
              ×
            </button>

            <div>{plan}</div>

            <div className="mt-lg flex-1 px-md">{children}</div>

            <div className="px-md pb-md">
              <Button type="button" variant="primary" className="mt-md w-full" onClick={onClose}>
                {t.map.mobileSheetDone}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
