import { useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const response = await API.post('/auth/forgot-password', { email });
      setMessage(response.data.message || 'Password reset link sent to your email.');
      setEmail('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send reset link. User may not exist.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-16 p-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl text-white">
      <h2 className="text-2xl font-bold mb-2 bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
        Forgot Password
      </h2>
      <p className="text-gray-400 text-sm mb-6">
        Enter your email address and we'll send you a link to reset your password.
      </p>

      {error && (
        <div className="mb-4 text-red-400 text-sm bg-red-950/40 p-3 rounded-lg border border-red-900/50">
          {error}
        </div>
      )}

      {message && (
        <div className="mb-4 text-emerald-400 text-sm bg-emerald-950/40 p-3 rounded-lg border border-emerald-900/50">
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-2">Email Address</label>
          <input
            id="forgot-email"
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
            required
          />
        </div>

        <button
          id="forgot-submit-btn"
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 shadow-lg hover:shadow-indigo-500/10"
        >
          {loading ? 'Sending link...' : 'Send Reset Link'}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-gray-500">
        Remember your password?{' '}
        <Link to="/login" className="text-indigo-400 hover:text-indigo-300 transition">
          Log In
        </Link>
      </div>
    </div>
  );
}
