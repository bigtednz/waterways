import { useEffect, useRef } from "react";

interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: "danger" | "warning" | "info";
}

export function ConfirmationDialog({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  type = "info",
}: ConfirmationDialogProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen && confirmButtonRef.current) {
      confirmButtonRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onCancel();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const typeStyles = {
    danger: {
      confirm: "bg-red-600 hover:bg-red-700 text-white",
      border: "border-red-200",
    },
    warning: {
      confirm: "bg-yellow-600 hover:bg-yellow-700 text-white",
      border: "border-yellow-200",
    },
    info: {
      confirm: "bg-blue-600 hover:bg-blue-700 text-white",
      border: "border-blue-200",
    },
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      aria-describedby="dialog-message"
    >
      <div
        className={`bg-white rounded-lg shadow-xl max-w-md w-full p-6 ${typeStyles[type].border} border-2`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="dialog-title" className="text-lg font-semibold text-gray-900 mb-2">
          {title}
        </h3>
        <p id="dialog-message" className="text-sm text-gray-600 mb-6">
          {message}
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium min-h-[44px]"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmButtonRef}
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg transition-colors font-medium min-h-[44px] ${typeStyles[type].confirm}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
