import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', newTheme);
    setTheme(newTheme);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const dashboardPath = user?.role === 'investor'
    ? '/investor/dashboard'
    : '/entrepreneur/dashboard';

  return (
    <nav className="bg-indigo-600 text-white p-4 flex justify-between items-center">
      <Link to="/" className="font-bold text-lg tracking-wide">Nexus</Link>
      <div className="flex items-center gap-4">
        {user ? (
          <>
            <Link to={dashboardPath} className="hover:text-indigo-200 transition">Dashboard</Link>
            <Link to="/meetings" className="hover:text-indigo-200 transition">Meetings</Link>
            <Link to="/documents" className="hover:text-indigo-200 transition">Documents</Link>
            <Link to="/payments" className="hover:text-indigo-200 transition">Payments</Link>
            <Link to="/profile" className="hover:text-indigo-200 transition">Profile</Link>
            <button
              id="logout-btn"
              onClick={handleLogout}
              className="bg-white text-indigo-600 px-3 py-1 rounded text-sm font-medium hover:bg-indigo-100 transition"
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="hover:text-indigo-200 transition">Login</Link>
            <Link to="/register" className="bg-white text-indigo-600 px-3 py-1 rounded text-sm font-medium hover:bg-indigo-100 transition">Register</Link>
          </>
        )}
        <button
          id="theme-toggle-btn"
          onClick={toggleTheme}
          className="p-1.5 bg-indigo-700 hover:bg-indigo-800 rounded-full transition flex items-center justify-center text-sm"
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
      </div>
    </nav>
  );
}
