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
    const { data } = await api.post("/auth/login", { email, password });
    if (data.token) {
      localStorage.setItem("token", data.token);
      currentUser = data.user;
    }
    return data;
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
