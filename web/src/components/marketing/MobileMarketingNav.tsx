"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { marketingNavItems } from "@/lib/constants/marketing";
import { Button } from "@/components/ui/Button";

const CLOSE_ANIMATION_MS = 280;

interface MobileNavIconProps {
  index: number;
}

function MobileNavIcon({ index }: MobileNavIconProps) {
  const icons = ["01", "02", "03", "04"];

  return (
    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-400">
      {icons[index % icons.length]}
    </span>
  );
}

export function MobileMarketingNav() {
  const [isOpen, setIsOpen] = useState(false);
  const [isPanelVisible, setIsPanelVisible] = useState(false);
  const menuId = useId();

  function openMenu() {
    setIsOpen(true);

    window.requestAnimationFrame(() => {
      setIsPanelVisible(true);
    });
  }

  function closeMenu() {
    setIsPanelVisible(false);

    window.setTimeout(() => {
      setIsOpen(false);
    }, CLOSE_ANIMATION_MS);
  }


  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
      }
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
      className={`fixed inset-0 z-[100] transition-colors duration-300 ${
        isPanelVisible
          ? "bg-stone-950/35 backdrop-blur-sm"
          : "bg-stone-950/0"
      }`}
      role="dialog"
      aria-modal="true"
      id={menuId}
    >
      <button
        type="button"
        aria-label="Close navigation menu"
        onClick={closeMenu}
        className="absolute inset-0 h-full w-full cursor-default"
      />

      <aside
        className={`absolute right-0 top-0 h-dvh w-[82vw] max-w-[420px] overflow-y-auto border-l border-stone-200 bg-[#fffdf7] text-[#102015] shadow-[-32px_0_80px_rgba(15,23,42,0.28)] transition-transform duration-300 ease-out ${
          isPanelVisible ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex min-h-dvh flex-col">
          <div className="flex items-center justify-between border-b border-stone-200 px-7 py-7">
            <Link href="/" onClick={closeMenu} className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center bg-[#012f11] text-sm font-bold text-[#9cff00]">
                AS
              </span>

              <span>
                <span className="block text-sm font-semibold tracking-tight">
                  After Sunday
                </span>
                <span className="block text-xs text-stone-500">
                  Sermon follow-up
                </span>
              </span>
            </Link>

            <button
              type="button"
              onClick={closeMenu}
              aria-label="Close navigation menu"
              className="flex h-11 w-11 items-center justify-center text-4xl font-light leading-none text-stone-500 transition hover:text-[#102015]"
            >
              ×
            </button>
          </div>

          <div className="flex-1 px-7 py-12">
            <p className="mb-10 text-xs font-semibold uppercase tracking-[0.28em] text-stone-400">
              Menu
            </p>

            <nav className="space-y-9">
              {marketingNavItems.map((item, index) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={closeMenu}
                  className="group flex items-center justify-between border-b border-stone-200 pb-6 text-3xl font-semibold tracking-tight text-[#102015] transition hover:text-[#012f11]"
                >
                  <span>{item.label}</span>
                  <MobileNavIcon index={index} />
                </a>
              ))}
            </nav>

            <div className="mt-14 border border-stone-200 bg-stone-50 p-6">
              <p className="text-sm font-semibold text-[#102015]">
                Continue care after Sunday
              </p>

              <p className="mt-3 text-sm leading-6 text-stone-600">
                Create sermon follow-ups, review drafts, and send with care.
              </p>

              <div className="mt-6">
                <Link href="/app/dashboard" onClick={closeMenu}>
                  <Button className="w-full">Open app</Button>
                </Link>
              </div>
            </div>
          </div>

          <div className="border-t border-stone-200 px-7 py-6">
            <div className="flex items-center justify-between text-xs text-stone-500">
              <span>Built for churches</span>
              <span className="h-2 w-2 rounded-full bg-[#9cff00]" />
            </div>
          </div>
        </div>
      </aside>
    </div>
  ) : null;


const portalTarget =
    typeof document !== "undefined" ? document.body : null;

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={openMenu}
        aria-label="Open navigation menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#ddd8c8] bg-[#fffdf7] text-[#012f11] shadow-sm"
      >
        <span className="sr-only">Open menu</span>

        <span className="flex flex-col gap-1.5">
          <span className="block h-0.5 w-5 rounded-full bg-[#012f11]" />
          <span className="block h-0.5 w-5 rounded-full bg-[#012f11]" />
          <span className="block h-0.5 w-5 rounded-full bg-[#012f11]" />
        </span>
      </button>

        {portalTarget ? createPortal(menuOverlay, portalTarget) : null}
    </div>
  );
}