import { useEffect, useState } from "react";
import { toast, Toast as ToastType } from "../lib/toast";

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastType[]>([]);

  useEffect(() => {
    const unsubscribe = toast.subscribe(setToasts);
    return unsubscribe;
  }, []);

  return (
    <div
      className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full sm:w-auto"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

function ToastItem({ toast: toastItem }: { toast: ToastType }) {
  const [isExiting, setIsExiting] = useState(false);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      toast.dismiss(toastItem.id);
    }, 300);
  };

  useEffect(() => {
    if (toastItem.duration && toastItem.duration > 0) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, toastItem.duration);
      return () => clearTimeout(timer);
    }
  }, [toastItem.duration, toastItem.id]);

  const typeStyles = {
    success: "bg-green-50 border-green-200 text-green-800",
    error: "bg-red-50 border-red-200 text-red-800",
    info: "bg-blue-50 border-blue-200 text-blue-800",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
  };

  const iconStyles = {
    success: "text-green-600",
    error: "text-red-600",
    info: "text-blue-600",
    warning: "text-yellow-600",
  };

  const icons = {
    success: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    info: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    warning: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  };

  return (
    <div
      className={`
        ${typeStyles[toastItem.type]}
        border rounded-lg shadow-lg p-4 flex items-start gap-3
        transition-all duration-300 ease-in-out
        ${isExiting ? "opacity-0 translate-x-full" : "opacity-100 translate-x-0"}
        min-w-[300px] max-w-md
      `}
      role="alert"
    >
      <div className={`flex-shrink-0 ${iconStyles[toastItem.type]}`}>
        {icons[toastItem.type]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium break-words">{toastItem.message}</p>
      </div>
      <button
        onClick={handleDismiss}
        className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Dismiss notification"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
