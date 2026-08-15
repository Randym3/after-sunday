"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

export type ToastTone = "success" | "error" | "info";
interface ToastItem { id: number; message: string; tone: ToastTone; }
interface ToastContextValue { toast: (message: string, tone?: ToastTone) => void; }
const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const toast = useCallback((message: string, tone: ToastTone = "info") => {
    const id = Date.now() + Math.random();
    setItems(current => [...current, { id, message, tone }]);
    window.setTimeout(() => setItems(current => current.filter(item => item.id !== id)), 4500);
  }, []);
  const value = useMemo(() => ({ toast }), [toast]);
  return <ToastContext.Provider value={value}>
    {children}
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-3 sm:left-auto sm:w-96" aria-live="polite">
      {items.map(item => <div key={item.id} role="status" className={`pointer-events-auto w-full rounded-xl border px-4 py-3 text-sm font-medium shadow-lg ${item.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : item.tone === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-blue-200 bg-blue-50 text-blue-800"}`}>
        {item.message}
        <button type="button" className="float-right ml-3 text-current opacity-60 hover:opacity-100" aria-label="Dismiss notification" onClick={() => setItems(current => current.filter(value => value.id !== item.id))}>×</button>
      </div>)}
    </div>
  </ToastContext.Provider>;
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
