"use client";

import { ReactNode, useEffect, useState } from "react";

const FADE_MS = 200;

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Tailwind max-width class for the panel, e.g. "max-w-sm". */
  widthClass?: string;
  /** id of an element inside the panel that names the dialog. */
  labelledBy?: string;
  /** Override the default panel surface classes (border/shadow). */
  panelClass?: string;
}

/**
 * Shared modal shell. Every modal in the app must use this (or wrap it) so
 * dialogs consistently fade in and out. See
 * docs/agent/05_IMPLEMENTATION_STANDARDS.md.
 *
 * Fade direction follows the `open` prop (`.modal-backdrop-fade-*` and
 * `.modal-panel-fade-*` keyframes in globals.css); the only state is
 * `dismissed`, which is set
 * inside async callbacks so the exit animation can finish before unmounting.
 */
export function Modal({
  open,
  onClose,
  children,
  widthClass = "max-w-lg",
  labelledBy,
  panelClass,
}: ModalProps) {
  const [dismissed, setDismissed] = useState(!open);

  useEffect(() => {
    if (open) {
      const frame = requestAnimationFrame(() => setDismissed(false));
      return () => cancelAnimationFrame(frame);
    }

    const timer = window.setTimeout(() => setDismissed(true), FADE_MS);
    return () => window.clearTimeout(timer);
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  // Nothing to show before the first open, and nothing after the exit
  // animation finishes.
  if (!open && dismissed) return null;

  const backdropPhase = open
    ? "modal-backdrop-fade-in"
    : "modal-backdrop-fade-out";
  const panelPhase = open
    ? "modal-panel-fade-in"
    : "modal-panel-fade-out";

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 ${backdropPhase}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`${panelClass ?? `w-full ${widthClass} max-h-[90vh] overflow-y-auto rounded-2xl border border-edge bg-panel p-6 shadow-xl`} ${panelPhase}`}
      >
        {children}
      </div>
    </div>
  );
}
