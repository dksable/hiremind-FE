import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { api, clearToken, getToken, ManagedUser, Role, User } from "@/lib/api";

export type { ManagedUser, Role };
type AuthCtx = {
  user: User | null;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  users: ManagedUser[];
  addUser: (u: ManagedUser) => Promise<{ ok: boolean; error?: string }>;
  updateUser: (email: string, patch: Partial<ManagedUser>) => Promise<{ ok: boolean; error?: string }>;
  deleteUser: (email: string) => Promise<{ ok: boolean; error?: string }>;
  isAdmin: boolean;
};

const Ctx = createContext<AuthCtx | null>(null);
const KEY = "ats_demo_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<ManagedUser[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      try { setUser(JSON.parse(raw)); } catch { /* ignore */ }
    }
    const restoreSession = async () => {
      if (!getToken()) await api.auth.refresh();
      if (!getToken()) return;

      await api.auth.me()
        .then(({ user }) => {
          setUser(user);
          localStorage.setItem(KEY, JSON.stringify(user));
          if (user.role === "admin") refreshUsers();
        })
        .catch(logout);
    };

    restoreSession().catch(logout);
  }, []);

  async function refreshUsers() {
    const list = await api.users.list();
    setUsers(list);
  }

  async function login(email: string, password: string) {
    try {
      const { user } = await api.auth.login(email, password);
      localStorage.setItem(KEY, JSON.stringify(user));
      setUser(user);
      if (user.role === "admin") await refreshUsers();
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e.message || "Invalid email or password" };
    }
  }

  function logout() {
    api.auth.logout().catch(() => undefined);
    clearToken();
    localStorage.removeItem(KEY);
    setUser(null);
    setUsers([]);
  }

  async function addUser(u: ManagedUser) {
    try {
      await api.users.create(u);
      await refreshUsers();
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e.message || "Failed to add user" };
    }
  }

  async function updateUser(email: string, patch: Partial<ManagedUser>) {
    try {
      const updated = await api.users.update(email, patch);
      await refreshUsers();
      if (user && user.email.toLowerCase() === email.toLowerCase()) {
        setUser(updated);
        localStorage.setItem(KEY, JSON.stringify(updated));
      }
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e.message || "Failed to update user" };
    }
  }

  async function deleteUser(email: string) {
    try {
      await api.users.remove(email);
      await refreshUsers();
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e.message || "Failed to delete user" };
    }
  }

  const isAdmin = user?.role === "admin";

  return (
    <Ctx.Provider value={{ user, login, logout, users, addUser, updateUser, deleteUser, isAdmin }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, isAdmin } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}
