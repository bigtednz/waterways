export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number; // Auto-dismiss after milliseconds (default: 5000)
}

let toastListeners: Array<(toasts: Toast[]) => void> = [];
let toasts: Toast[] = [];

const notify = () => {
  toastListeners.forEach((listener) => listener([...toasts]));
};

export const toast = {
  show(message: string, type: ToastType = "info", duration = 5000) {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const newToast: Toast = { id, message, type, duration };
    toasts = [...toasts, newToast];
    notify();

    if (duration > 0) {
      setTimeout(() => {
        toast.dismiss(id);
      }, duration);
    }

    return id;
  },

  success(message: string, duration = 5000) {
    return toast.show(message, "success", duration);
  },

  error(message: string, duration = 7000) {
    return toast.show(message, "error", duration);
  },

  info(message: string, duration = 5000) {
    return toast.show(message, "info", duration);
  },

  warning(message: string, duration = 6000) {
    return toast.show(message, "warning", duration);
  },

  dismiss(id: string) {
    toasts = toasts.filter((t) => t.id !== id);
    notify();
  },

  clear() {
    toasts = [];
    notify();
  },

  subscribe(listener: (toasts: Toast[]) => void) {
    toastListeners.push(listener);
    listener([...toasts]);
    return () => {
      toastListeners = toastListeners.filter((l) => l !== listener);
    };
  },
};
