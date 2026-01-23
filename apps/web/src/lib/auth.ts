import api from "./api";

export interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
}

export const auth = {
  async login(email: string, password: string) {
    const { data } = await api.post("/auth/login", { email, password });
    if (data.token) {
      localStorage.setItem("token", data.token);
    }
    return data;
  },

  async register(email: string, password: string, name?: string) {
    const { data } = await api.post("/auth/register", { email, password, name });
    if (data.token) {
      localStorage.setItem("token", data.token);
    }
    return data;
  },

  async getMe(): Promise<User> {
    const { data } = await api.get("/auth/me");
    return data;
  },

  logout() {
    localStorage.removeItem("token");
    window.location.href = "/login";
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem("token");
  },
};
