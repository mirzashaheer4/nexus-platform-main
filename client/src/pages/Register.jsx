import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('entrepreneur');
  const [error, setError] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const userRole = await register(name, email, password, role);
      // Auto-logged-in after registration — redirect based on role
      if (userRole === 'investor') {
        navigate('/investor/dashboard');
      } else {
        navigate('/entrepreneur/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 border rounded shadow-sm bg-white text-gray-900">
      <h2 className="text-2xl font-bold mb-4">Create Account</h2>
      {error && <p className="mb-3 text-red-600 text-sm">{error}</p>}
      <form onSubmit={handleSubmit}>
        <input
          id="register-name"
          type="text"
          placeholder="Full Name"
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded mb-2 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          required
        />
        <input
          id="register-email"
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded mb-2 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          required
        />
        <input
          id="register-password"
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded mb-2 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          required
        />
        <select
          id="register-role"
          value={role}
          onChange={e => setRole(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded mb-4 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="entrepreneur">Entrepreneur</option>
          <option value="investor">Investor</option>
        </select>
        <button id="register-submit" type="submit" className="w-full bg-indigo-600 text-white p-2 rounded hover:bg-indigo-700 transition">
          Register
        </button>
      </form>
    </div>
  );
}
