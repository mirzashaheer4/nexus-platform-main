import { createContext, useState, useContext, useEffect } from 'react';
import API from '../api';

const AuthContext = createContext();

/**
 * Read and decode the non-httpOnly jwtPayload cookie set by the server.
 * This cookie contains base64-encoded JSON: { id, name, role }
 * It is NOT the access token — it only carries non-sensitive display data.
 */
function readJwtPayloadCookie() {
  try {
    const match = document.cookie
      .split('; ')
      .find(row => row.startsWith('jwtPayload='));
    if (!match) return null;
    const encoded = match.split('=')[1];
    return JSON.parse(atob(decodeURIComponent(encoded)));
  } catch {
    return null;
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // On mount: check jwtPayload cookie to restore user state without a network call.
    // Then verify with the server by fetching the profile.
    const payload = readJwtPayloadCookie();
    if (payload) {
      setUser(payload); // Optimistic restore
      API.get('/profile/me')
        .then(res => {
          // Merge profile data with JWT payload (profile may have extra fields)
          setUser({ ...payload, ...res.data });
        })
        .catch(() => {
          // Cookie is stale or invalid — clear user state
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  /**
   * Login: POST credentials, server sets all three cookies.
   * Returns a 2FA status and/or user role.
   */
  const login = async (email, password) => {
    const { data } = await API.post('/auth/login', { email, password });
    if (data.requires2FA) {
      return { requires2FA: true, userId: data.userId };
    }
    setUser(data.user);
    return { requires2FA: false, role: data.user.role };
  };

  /**
   * Verify 2FA OTP and set user context.
   */
  const verifyOTP = async (userId, otp) => {
    const { data } = await API.post('/auth/verify-otp', { userId, otp });
    setUser(data.user);
    return data.user.role;
  };

  /**
   * Register: POST new user data, server creates user + profile and sets cookies.
   * Returns the user's role so the caller can redirect.
   */
  const register = async (name, email, password, role) => {
    const { data } = await API.post('/auth/register', { name, email, password, role });
    setUser(data.user);
    return data.user.role;
  };

  /**
   * Logout: POST to server to clear httpOnly cookies server-side,
   * then clear local user state.
   */
  const logout = async () => {
    try {
      await API.post('/auth/logout');
    } catch {
      // Proceed with local logout even if request fails
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, verifyOTP, setUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
