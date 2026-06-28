import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, getToken, setToken, type AuthUser } from './api';

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  cartCount: number;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, nombre?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshCart: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [cartCount, setCartCount] = useState(0);

  async function refreshCart() {
    if (!getToken()) {
      setCartCount(0);
      return;
    }
    try {
      const { items } = await api.getCart();
      setCartCount(items.reduce((n, i) => n + i.cantidad, 0));
    } catch {
      setCartCount(0);
    }
  }

  // Al cargar, si hay token, recuperar el usuario
  useEffect(() => {
    (async () => {
      if (getToken()) {
        try {
          const { user } = await api.me();
          setUser(user);
          await refreshCart();
        } catch {
          setToken(null);
        }
      }
      setLoading(false);
    })();
  }, []);

  async function login(email: string, password: string) {
    const { token, user } = await api.login({ email, password });
    setToken(token);
    setUser(user);
    await refreshCart();
  }

  async function register(email: string, password: string, nombre?: string) {
    const { token, user } = await api.register({ email, password, nombre });
    setToken(token);
    setUser(user);
    await refreshCart();
  }

  async function logout() {
    try {
      await api.logout();
    } catch {
      /* ignorar */
    }
    setToken(null);
    setUser(null);
    setCartCount(0);
  }

  return (
    <Ctx.Provider value={{ user, loading, cartCount, login, register, logout, refreshCart }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
