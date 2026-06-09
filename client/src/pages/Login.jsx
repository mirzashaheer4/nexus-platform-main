import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const result = await login(email, password);
      if (result.requires2FA) {
        navigate(`/verify-otp?userId=${result.userId}`);
      } else {
        // Redirect based on role from JWT payload cookie
        if (result.role === 'investor') {
          navigate('/investor/dashboard');
        } else {
          navigate('/entrepreneur/dashboard');
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 border rounded shadow-sm bg-white text-gray-900">
      <h2 className="text-2xl font-bold mb-4 text-center">Login</h2>
      {error && <p className="mb-3 text-red-600 text-sm">{error}</p>}
      <form onSubmit={handleSubmit}>
        <input
          id="login-email"
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded mb-2 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          required
        />
        <input
          id="login-password"
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded mb-4 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          required
        />
        <button id="login-submit" type="submit" className="w-full bg-indigo-600 text-white p-2 rounded hover:bg-indigo-700 transition">
          Login
        </button>
      </form>
      <div className="text-center mt-4 border-t pt-4">
        <Link to="/forgot-password" className="text-indigo-600 hover:text-indigo-500 text-sm">
          Forgot Password?
        </Link>
      </div>
    </div>
  );
}
