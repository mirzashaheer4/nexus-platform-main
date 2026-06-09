import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function VerifyOTP() {
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const { verifyOTP } = useAuth();
  const navigate = useNavigate();

  const userId = searchParams.get('userId');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userId) {
      setError('User ID is missing. Please try logging in again.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const role = await verifyOTP(userId, otp);
      if (role === 'investor') {
        navigate('/investor/dashboard');
      } else {
        navigate('/entrepreneur/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'OTP verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-16 p-8 bg-white border border-gray-200 rounded-2xl shadow-xl text-gray-900 dark:bg-slate-900 dark:border-slate-800 dark:text-white">
      <h2 className="text-2xl font-bold mb-2 bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">
        Two-Factor Authentication
      </h2>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
        Please enter the 6-digit verification code sent to your email address.
      </p>

      {error && (
        <div className="mb-4 text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-950/40 p-3 rounded-lg border border-red-200 dark:border-red-900/50">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Verification Code</label>
          <input
            id="otp-input"
            type="text"
            maxLength="6"
            placeholder="000000"
            value={otp}
            onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
            className="w-full text-center tracking-[1em] text-2xl font-bold py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition dark:bg-slate-950 dark:border-slate-800 dark:text-white"
            required
            autoFocus
          />
        </div>

        <button
          id="otp-submit-btn"
          type="submit"
          disabled={loading || otp.length !== 6}
          className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition disabled:opacity-50 shadow-lg hover:shadow-indigo-500/10"
        >
          {loading ? 'Verifying...' : 'Verify & Log In'}
        </button>
      </form>
    </div>
  );
}
