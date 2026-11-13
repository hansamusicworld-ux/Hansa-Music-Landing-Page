"use client";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icons";
const activeModals: symbol[] = [];
let originalOverflow = "";
export function Modal({ label, onClose, children, className = "" }: { label: string; onClose: () => void; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const accent = typeof document !== "undefined" ? getComputedStyle(document.querySelector(".website, .studio-app") || document.documentElement).getPropertyValue("--accent").trim() : "#f5d44b";
  useEffect(() => {
    const id = Symbol("hansa-dialog");
    const previous = document.activeElement as HTMLElement | null;
    if (!activeModals.length) originalOverflow = document.body.style.overflow;
    activeModals.push(id); document.body.style.overflow = "hidden"; ref.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (activeModals[activeModals.length - 1] !== id) return;
      if (event.key === "Escape") { event.stopImmediatePropagation(); onClose(); return; }
      if (event.key !== "Tab") return;
      const focusable = Array.from(ref.current?.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, iframe, video, audio, [tabindex="0"]') ?? []).filter(element => !element.hasAttribute("disabled"));
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      const index = activeModals.indexOf(id); if (index >= 0) activeModals.splice(index, 1);
      document.body.style.overflow = activeModals.length ? "hidden" : originalOverflow;
      if (previous?.isConnected) previous.focus();
    };
  }, [onClose]);
  return createPortal(<div className="modal-backdrop" style={{ "--accent": accent } as CSSProperties} onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><div role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} ref={ref} className={`modal-panel ${className}`}><button className="icon-button modal-close" aria-label="Close dialog" onClick={onClose}><Icon name="x" /></button>{children}</div></div>, document.body);
}
