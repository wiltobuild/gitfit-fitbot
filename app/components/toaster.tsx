"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type ToastKind = "success" | "error";
type Toast = { id: number; kind: ToastKind; message: string };
type ToastContextValue = { showSuccess: (message: string) => void; showError: (message: string) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error("useToast must be used within Toaster.");
  return toast;
}

export function Toaster({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Toast | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const activeToast = useRef<Toast | null>(null);
  const queue = useRef<Toast[]>([]);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAt = useRef(0);
  const remaining = useRef(5_000);

  const clearDismissTimer = useCallback(() => {
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = null;
  }, []);

  const dismiss = useCallback(() => {
    clearDismissTimer();
    if (activeToast.current) setIsLeaving(true);
  }, [clearDismissTimer]);

  const startDismissTimer = useCallback((delay: number) => {
    clearDismissTimer();
    remaining.current = delay;
    startedAt.current = Date.now();
    timeout.current = setTimeout(dismiss, delay);
  }, [clearDismissTimer, dismiss]);

  useEffect(() => {
    if (current?.kind === "success" && !isLeaving) startDismissTimer(5_000);
    return clearDismissTimer;
  }, [clearDismissTimer, current, isLeaving, startDismissTimer]);

  useEffect(() => () => clearDismissTimer(), [clearDismissTimer]);

  const show = useCallback((kind: ToastKind, message: string) => {
    const toast = { id: Date.now(), kind, message };
    if (activeToast.current) {
      queue.current.push(toast);
      return;
    }
    activeToast.current = toast;
    setCurrent(toast);
    setIsLeaving(false);
  }, []);

  const value = { showSuccess: (message: string) => show("success", message), showError: (message: string) => show("error", message) };
  const pauseSuccessDismiss = () => {
    if (activeToast.current?.kind !== "success" || !timeout.current) return;
    remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current));
    clearDismissTimer();
  };
  const resumeSuccessDismiss = () => {
    if (activeToast.current?.kind === "success" && !isLeaving && !timeout.current) startDismissTimer(remaining.current);
  };
  const advanceQueue = () => {
    if (!isLeaving) return;
    const next = queue.current.shift() ?? null;
    activeToast.current = next;
    setCurrent(next);
    setIsLeaving(false);
  };

  return <ToastContext.Provider value={value}>
    {children}
    <div className="toast-live-regions">
      <span aria-atomic="true" aria-live="polite">{current?.kind === "success" ? current.message : ""}</span>
      <span aria-atomic="true" aria-live="assertive">{current?.kind === "error" ? current.message : ""}</span>
    </div>
    {current ? <div className={`toast surface-card toast-${current.kind}${isLeaving ? " toast-leaving" : ""}`} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) resumeSuccessDismiss(); }} onFocusCapture={pauseSuccessDismiss} onMouseEnter={pauseSuccessDismiss} onMouseLeave={resumeSuccessDismiss} onTransitionEnd={(event) => { if (event.propertyName === "opacity") advanceQueue(); }}>
      <span aria-hidden="true" className="toast-icon">{current.kind === "success" ? "✓" : "!"}</span>
      <p aria-hidden="true" className="toast-message">{current.message}</p>
      <button aria-label="Dismiss notification" className="toast-dismiss" onClick={dismiss} type="button">×</button>
    </div> : null}
  </ToastContext.Provider>;
}
