import { useEffect, type RefObject } from "react";

type FocusableElement = HTMLInputElement | HTMLButtonElement | HTMLTextAreaElement | HTMLSelectElement | HTMLAnchorElement | HTMLElement;

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])';

function getFocusableElements(container: HTMLElement): FocusableElement[] {
  return Array.from(container.querySelectorAll<FocusableElement>(FOCUSABLE_SELECTOR));
}

export function useFocusTrap(
  modalRef: RefObject<HTMLElement | null>,
  isOpen: boolean,
  onClose?: () => void,
): void {
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const modal = modalRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusableElements = getFocusableElements(modal);
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    if (firstFocusable) {
      firstFocusable.focus();
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && onClose) {
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key === "Tab") {
        if (e.shiftKey) {
          if (document.activeElement === firstFocusable) {
            e.preventDefault();
            lastFocusable?.focus();
          }
        } else {
          if (document.activeElement === lastFocusable || !focusableElements.includes(document.activeElement as FocusableElement)) {
            e.preventDefault();
            firstFocusable?.focus();
          }
        }
      }
    }

    modal.addEventListener("keydown", handleKeyDown);

    return () => {
      modal.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus();
      }
    };
  }, [isOpen, modalRef, onClose]);
}
