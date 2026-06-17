import { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

// Create the context — this is the "shared storage" all components can access
const AuthContext = createContext();

// Custom hook so other components can easily access the context
export function useAuth() {
  return useContext(AuthContext);
}

// Provider component — wraps the whole app, holds the actual login state
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);       // Current logged-in user info
  const [token, setToken] = useState(null);      // JWT token
  const [loading, setLoading] = useState(true);  // True while checking existing login

  // On app startup, check if there's a saved token in memory
  useEffect(() => {
    const savedToken = sessionStorage.getItem('token');
    if (savedToken) {
      setToken(savedToken);
      fetchCurrentUser(savedToken);
    } else {
      setLoading(false);
    }
  }, []);

  // Fetch user info using a token — called after login or on page refresh
  const fetchCurrentUser = async (authToken) => {
    try {
      const res = await axios.get('http://localhost:3000/api/auth/me', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      setUser(res.data.data);
    } catch (error) {
      // Token invalid or expired — clear everything
      logout();
    } finally {
      setLoading(false);
    }
  };

  // Login function — called from Login.jsx
  const login = async (username, password) => {
    const res = await axios.post('http://localhost:3000/api/auth/login', {
      username,
      password
    });

    const { token: newToken, user: userData } = res.data;

    setToken(newToken);
    setUser(userData);
    sessionStorage.setItem('token', newToken);

    return userData;
  };

  // Logout function — clears everything
  const logout = () => {
    setToken(null);
    setUser(null);
    sessionStorage.removeItem('token');
  };

  // Everything inside value is accessible to any component using useAuth()
  const value = {
    user,
    token,
    loading,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}