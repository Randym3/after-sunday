"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { marketingNavItems } from "@/lib/constants/marketing";
import { Button } from "@/components/ui/Button";

const CLOSE_ANIMATION_MS = 280;

export function MobileMarketingNav() {
  const [isOpen, setIsOpen] = useState(false);
  const [isPanelVisible, setIsPanelVisible] = useState(false);
  const menuId = useId();

  function openMenu() {
    setIsOpen(true);
    window.requestAnimationFrame(() => setIsPanelVisible(true));
  }

  function closeMenu() {
    setIsPanelVisible(false);
    window.setTimeout(() => setIsOpen(false), CLOSE_ANIMATION_MS);
  }

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenu();
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const menuOverlay = isOpen ? (
    <div
      className={`fixed inset-0 z-[100] transition-colors duration-300 ${isPanelVisible ? "bg-[#101716]/35 backdrop-blur-sm" : "bg-[#101716]/0"}`}
      role="dialog"
      aria-modal="true"
      id={menuId}
    >
      <button type="button" aria-label="Close navigation menu" onClick={closeMenu} className="absolute inset-0 h-full w-full cursor-default" />
      <aside className={`absolute right-0 top-0 h-dvh w-[84vw] max-w-[420px] overflow-y-auto border-l border-[#d9e0e7] bg-[#f7f8f6] text-[#141a19] shadow-[-32px_0_80px_rgba(15,23,42,0.24)] transition-transform duration-300 ease-out ${isPanelVisible ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex min-h-dvh flex-col">
          <div className="flex items-center justify-between border-b border-[#d9e0e7] px-6 py-5">
            <Link href="/" onClick={closeMenu} className="flex items-center gap-3">
              <span className="marketing-mark" aria-hidden="true">AS</span>
              <span>
                <span className="block text-sm font-bold">After Sunday</span>
                <span className="mt-0.5 block text-[10px] text-[#7b8581]">Sermon follow-up</span>
              </span>
            </Link>
            <button type="button" onClick={closeMenu} aria-label="Close navigation menu" className="flex h-10 w-10 items-center justify-center text-3xl font-light text-[#68716e] transition hover:text-[#141a19]">×</button>
          </div>

          <div className="flex-1 px-6 py-10">
            <p className="mb-8 font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-[#2161e8]">Menu</p>
            <nav className="space-y-1">
              {marketingNavItems.map((item, index) => (
                <a key={item.href} href={item.href} onClick={closeMenu} className="flex items-center justify-between border-b border-[#d9e0e7] py-5 text-2xl font-semibold tracking-[-0.04em] transition hover:text-[#2161e8]">
                  <span>{item.label}</span>
                  <span className="font-mono text-[10px] text-[#8b9690]">0{index + 1}</span>
                </a>
              ))}
            </nav>

            <div className="mt-12 border border-[#cbd5d2] bg-white p-5">
              <p className="text-sm font-semibold">Continue care after Sunday.</p>
              <p className="mt-2 text-sm leading-6 text-[#68716e]">Create a sermon follow-up, review the draft, and send with care.</p>
              <Link href="/app/dashboard" onClick={closeMenu} className="mt-5 block">
                <Button className="w-full rounded-lg bg-[#151b1a] text-white shadow-none hover:bg-[#28312f]">Open app ↗</Button>
              </Link>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-[#d9e0e7] px-6 py-5 font-mono text-[9px] uppercase tracking-[0.14em] text-[#8b9690]">
            <span>Built for care</span>
            <span className="h-2 w-2 rounded-full bg-[#57b992]" />
          </div>
        </div>
      </aside>
    </div>
  ) : null;

  const portalTarget = typeof document !== "undefined" ? document.body : null;

  return (
    <div className="md:hidden">
      <button type="button" onClick={openMenu} aria-label="Open navigation menu" aria-expanded={isOpen} aria-controls={menuId} className="inline-flex h-10 w-10 items-center justify-center border border-[#cbd5d2] bg-[#f7f8f6] text-[#141a19]">
        <span className="sr-only">Open menu</span>
        <span className="flex flex-col gap-1.5">
          <span className="block h-px w-5 bg-[#141a19]" />
          <span className="block h-px w-5 bg-[#141a19]" />
          <span className="block h-px w-5 bg-[#141a19]" />
        </span>
      </button>
      {portalTarget ? createPortal(menuOverlay, portalTarget) : null}
    </div>
  );
}