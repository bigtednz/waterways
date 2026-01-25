import api from "./api";

export interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
}

let currentUser: User | null = null;

export const auth = {
  async login(email: string, password: string) {
    try {
      const { data } = await api.post("/auth/login", { email, password });
      if (data.token) {
        localStorage.setItem("token", data.token);
        currentUser = data.user;
      }
      return data;
    } catch (error: any) {
      console.error("Login API error:", error);
      if (error.response) {
        // Server responded with error
        throw error;
      } else if (error.request) {
        // Request made but no response
        throw new Error("Unable to connect to server. Please check your connection.");
      } else {
        // Something else happened
        throw new Error("An unexpected error occurred during login.");
      }
    }
  },

  async register(email: string, password: string, name?: string) {
    const { data } = await api.post("/auth/register", { email, password, name });
    if (data.token) {
      localStorage.setItem("token", data.token);
      currentUser = data.user;
    }
    return data;
  },

  async getMe(): Promise<User> {
    const { data } = await api.get("/auth/me");
    currentUser = data;
    return data;
  },

  async getCurrentUser(): Promise<User | null> {
    if (!this.isAuthenticated()) {
      return null;
    }
    if (!currentUser) {
      try {
        currentUser = await this.getMe();
      } catch {
        return null;
      }
    }
    return currentUser;
  },

  getUserRole(): string | null {
    return currentUser?.role || null;
  },

  isAdmin(): boolean {
    return currentUser?.role === "ADMIN";
  },

  logout() {
    localStorage.removeItem("token");
    currentUser = null;
    window.location.href = "/";
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem("token");
  },
};
