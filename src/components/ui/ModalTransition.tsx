"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useBodyScrollLock } from "@/lib/body-scroll-lock";

const overlayTransition = { duration: 0.2 };
const panelTransition = {
  duration: 0.2,
  ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number],
};

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function getFocusables(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute("disabled") && el.offsetParent !== null
  );
}

interface ModalTransitionProps {
  open: boolean;
  onClose: () => void;
  overlayClassName?: string;
  overlayZ?: number;
  panelZ?: number;
  children: ReactNode;
  /** "center" | "bottom" | "left" - center: scale+opacity, bottom: slide from bottom, left: slide from left */
  variant?: "center" | "bottom" | "left";
  panelClassName?: string;
}

/** 모달/팝업 오버레이 + 패널 등장/퇴장 (Framer Motion) + 포커스 트랩 */
export function ModalTransition({
  open,
  onClose,
  overlayClassName = "fixed inset-0 bg-(--notion-fg)/30",
  overlayZ = 100,
  panelZ = 101,
  children,
  variant = "center",
  panelClassName,
}: ModalTransitionProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    previousActiveRef.current = document.activeElement as HTMLElement | null;

    const onKey = (e: KeyboardEvent) => {
      // IME 조합 중(한글 등) Esc는 조합 취소용 — 모달을 닫거나 포커스 트랩을 건드리지 않는다.
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      const panel = panelRef.current;
      if (e.key !== "Tab" || !panel) return;
      const focusables = getFocusables(panel);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const restore = previousActiveRef.current;
    return () => {
      requestAnimationFrame(() => {
        if (restore?.focus) restore.focus();
      });
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = getFocusables(panel);
      const first = focusables[0];
      if (first) first.focus();
      else panel.focus();
    }, 0);
    return () => clearTimeout(id);
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={overlayTransition}
            className={overlayClassName}
            style={{ zIndex: overlayZ }}
            aria-hidden
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            initial={
              variant === "bottom"
                ? { opacity: 0, y: "100%" }
                : variant === "left"
                  ? { opacity: 0, x: "-100%" }
                  : { opacity: 0, scale: 0.98 }
            }
            animate={
              variant === "bottom"
                ? { opacity: 1, y: 0 }
                : variant === "left"
                  ? { opacity: 1, x: 0 }
                  : { opacity: 1, scale: 1 }
            }
            exit={
              variant === "bottom"
                ? { opacity: 0, y: "100%" }
                : variant === "left"
                  ? { opacity: 0, x: "-100%" }
                  : { opacity: 0, scale: 0.98 }
            }
            transition={panelTransition}
            className={panelClassName}
            style={{ zIndex: panelZ }}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
