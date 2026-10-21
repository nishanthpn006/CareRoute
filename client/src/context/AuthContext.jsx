import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { apiRequest, setSessionToken } from '../api.js';
import { firebaseAuth, firebaseConfigured } from '../firebase.js';

const AuthContext = createContext(null);

const isFirebaseMode = import.meta.env.VITE_DATA_MODE === 'firebase';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('careroute_user_meta');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Firebase auth sync
  useEffect(() => {
    if (!firebaseAuth) return undefined;
    return onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
      if (firebaseUser) {
        const token = await firebaseUser.getIdToken();
        setSessionToken(token);
        const meta = {
          id: firebaseUser.uid,
          email: firebaseUser.email || 'Administrator',
          role: 'organization_admin',
        };
        setUser(meta);
        localStorage.setItem('careroute_user_meta', JSON.stringify(meta));
      } else if (isFirebaseMode) {
        setSessionToken('');
        setUser(null);
        localStorage.removeItem('careroute_user_meta');
      }
    });
  }, []);

  const login = useCallback(async (email, password) => {
    setBusy(true);
    setError('');
    try {
      if (isFirebaseMode) {
        if (!firebaseAuth || !firebaseConfigured) {
          throw new Error('Firebase web configuration is incomplete.');
        }
        const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
        const token = await credential.user.getIdToken();
        setSessionToken(token);
        const meta = {
          id: credential.user.uid,
          email: credential.user.email || email,
          role: 'organization_admin',
        };
        setUser(meta);
        localStorage.setItem('careroute_user_meta', JSON.stringify(meta));
        return meta;
      }

      const result = await apiRequest('/api/auth/demo-login', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ email, password }),
      });

      setSessionToken(result.token);
      const meta = result.user || {
        email: result.email,
        role: result.role,
        organizationId: result.organizationId,
      };
      setUser(meta);
      localStorage.setItem('careroute_user_meta', JSON.stringify(meta));
      return meta;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setBusy(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      if (firebaseAuth) await signOut(firebaseAuth).catch(() => {});
    } finally {
      setSessionToken('');
      setUser(null);
      setError('');
      localStorage.removeItem('careroute_user_meta');
    }
  }, []);

  const value = {
    user,
    isAuthenticated: Boolean(user),
    role: user?.role || '',
    email: user?.email || '',
    organizationId: user?.organizationId || '',
    assignedFacilityIds: user?.assignedFacilityIds || [],
    isFirebaseMode,
    busy,
    error,
    setError,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
