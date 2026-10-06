import React, { useEffect, useState, useCallback } from 'react';
import Login from './components/Login';
import Dashboard from './Dashboard';
import { authApi } from './api/axiosClient';
import { getToken, clearSession } from './api/authStorage';

export default function App() {
  const [authState, setAuthState] = useState('checking'); // 'checking' | 'guest' | 'authed'
  const [user, setUser] = useState(null);

  // Kiểm tra JWT đã lưu (nếu có) còn hiệu lực bằng cách gọi GET /api/auth/me
  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      const token = getToken();
      if (!token) {
        if (!cancelled) setAuthState('guest');
        return;
      }
      try {
        const { data } = await authApi.me();
        if (!cancelled) {
          setUser(data.user);
          setAuthState('authed');
        }
      } catch {
        clearSession();
        if (!cancelled) setAuthState('guest');
      }
    };

    verify();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLoginSuccess = useCallback((loggedInUser) => {
    setUser(loggedInUser);
    setAuthState('authed');
  }, []);

  const handleLogout = useCallback(() => {
    clearSession();
    setUser(null);
    setAuthState('guest');
  }, []);

  if (authState === 'checking') {
    return (
      <div className="login-page">
        <div className="login-card login-loading">Đang kiểm tra phiên đăng nhập...</div>
      </div>
    );
  }

  if (authState !== 'authed' || !user) {
    return <Login onSuccess={handleLoginSuccess} />;
  }

  return <Dashboard user={user} onLogout={handleLogout} />;
}
