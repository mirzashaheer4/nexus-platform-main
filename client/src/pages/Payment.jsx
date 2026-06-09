import { useState, useEffect, useCallback } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import API from '../api';

// Initialize Stripe Promise
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLIC_KEY || 'pk_test_dummy_public_key');

// Format cents to dollars string
const formatCurrency = (cents) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(cents / 100);
};

// --- DEPOSIT MODAL COMPONENT ---
function DepositModal({ isOpen, onClose, onRefresh }) {
  const stripe = useStripe();
  const elements = useElements();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDeposit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setError('');
    setLoading(true);

    const amountCents = Math.round(parseFloat(amount) * 100);
    if (isNaN(amountCents) || amountCents < 50) {
      setError('Minimum deposit amount is $0.50.');
      setLoading(false);
      return;
    }

    try {
      // Step 1: Create PaymentIntent on the backend
      const response = await API.post('/payments/create-intent', { amount: amountCents });
      const { clientSecret } = response.data;

      // Step 2: Confirm payment with Stripe.js
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement),
          billing_details: {
            name: 'Nexus User',
          },
        },
      });

      if (result.error) {
        setError(result.error.message || 'Payment failed.');
      } else if (result.paymentIntent && result.paymentIntent.status === 'succeeded') {
        try {
          await API.post(`/payments/confirm/${result.paymentIntent.id}`);
        } catch (confirmErr) {
          console.error('Failed to reconcile payment status:', confirmErr);
        }
        alert('Payment confirmed! Your balance has been updated.');
        setAmount('');
        onRefresh();
        onClose();
      } else {
        setError('Payment processing. Please check transaction history.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Deposit initiation failed.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <div className="bg-white border border-gray-200 dark:bg-slate-900 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 relative text-gray-900 dark:text-white shadow-2xl transition-colors">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-white transition text-lg"
        >
          &times;
        </button>
        <h3 className="text-xl font-bold mb-4 bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">
          Add Funds via Stripe
        </h3>
        {error && <p className="mb-3 text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-950/40 p-2 rounded border border-red-200 dark:border-red-900/50">{error}</p>}
        <form onSubmit={handleDeposit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Amount (USD)</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-500 dark:text-gray-400 font-medium">$</span>
              <input
                id="deposit-amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full pl-8 pr-4 py-2 bg-gray-50 border border-gray-200 dark:bg-slate-955 dark:border-slate-800 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                required
              />
            </div>
            <span className="text-xs text-gray-500 mt-1 block">Minimum $0.50</span>
          </div>

          <div className="bg-gray-50 dark:bg-slate-950 p-4 border border-gray-200 dark:border-slate-800 rounded-lg transition-colors">
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Card Details</label>
            <div className="p-2 bg-white dark:bg-slate-950 rounded border border-gray-200 dark:border-slate-800">
              <CardElement
                options={{
                  style: {
                    base: {
                      fontSize: '16px',
                      color: document.documentElement.classList.contains('dark') ? '#ffffff' : '#0f172a',
                      '::placeholder': {
                        color: '#64748b',
                      },
                    },
                    invalid: {
                      color: '#ef4444',
                    },
                  },
                }}
              />
            </div>
          </div>

          <button
            id="confirm-deposit-btn"
            type="submit"
            disabled={loading || !stripe}
            className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg hover:from-emerald-600 hover:to-teal-600 font-semibold shadow-lg hover:shadow-emerald-500/20 transition disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Deposit Funds'}
          </button>
        </form>
      </div>
    </div>
  );
}

// --- MAIN WALLET & TRANSACTION HISTORY COMPONENT ---
export default function Payment() {
  const [balance, setBalance] = useState(0);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);

  // Modal Inputs
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchPaymentData = useCallback(async () => {
    try {
      const [balRes, histRes] = await Promise.all([
        API.get('/payments/balance'),
        API.get('/payments/history')
      ]);
      setBalance(balRes.data.balance);
      setHistory(histRes.data);
    } catch (err) {
      console.error('Failed to load wallet data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPaymentData();
  }, [fetchPaymentData]);

  const handleWithdraw = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setActionError('');
    const amtCents = Math.round(parseFloat(withdrawAmount) * 100);

    if (isNaN(amtCents) || amtCents <= 0) {
      setActionError('Valid amount is required.');
      setActionLoading(false);
      return;
    }

    try {
      await API.post('/payments/withdraw', { amount: amtCents });
      alert('Withdrawal completed successfully!');
      setWithdrawAmount('');
      setIsWithdrawOpen(false);
      fetchPaymentData();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Withdrawal failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setActionError('');
    const amtCents = Math.round(parseFloat(transferAmount) * 100);

    if (isNaN(amtCents) || amtCents <= 0) {
      setActionError('Valid amount is required.');
      setActionLoading(false);
      return;
    }

    try {
      await API.post('/payments/transfer', {
        recipientEmail,
        amount: amtCents
      });
      alert('Internal transfer completed successfully!');
      setTransferAmount('');
      setRecipientEmail('');
      setIsTransferOpen(false);
      fetchPaymentData();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Transfer failed.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50 text-gray-900 dark:bg-slate-955 dark:text-white">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-slate-950 dark:text-white p-6 font-sans transition-colors">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
            Secure Payments Wallet
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Manage deposits, withdrawals, and direct peer-to-peer transfers.</p>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card Display */}
          <div className="md:col-span-1 bg-gradient-to-br from-indigo-700 via-purple-700 to-pink-700 p-6 rounded-2xl shadow-xl flex flex-col justify-between aspect-[1.6/1] relative overflow-hidden group text-white">
            {/* Decors */}
            <div className="absolute -right-10 -top-10 w-36 h-36 bg-white/10 rounded-full blur-2xl group-hover:scale-110 transition duration-500"></div>
            <div className="flex justify-between items-start">
              <div>
                <span className="text-white/60 text-xs font-semibold uppercase tracking-widest">Available Balance</span>
                <h3 className="text-3xl font-black mt-1 tracking-tight">{formatCurrency(balance)}</h3>
              </div>
              <div className="bg-white/15 px-3 py-1 rounded-full text-xs font-semibold tracking-wider uppercase text-white/90">
                Sandbox Mode
              </div>
            </div>
            <div className="mt-8 flex justify-between items-end">
              <div>
                <p className="text-white/50 text-[10px] uppercase tracking-wider font-mono">Wallet Account ID</p>
                <p className="text-white/95 font-mono text-sm tracking-widest mt-0.5">•••• •••• •••• WALLET</p>
              </div>
              <span className="font-extrabold italic tracking-wide text-lg text-white/80">NEXUS</span>
            </div>
          </div>

          {/* Quick Actions Card */}
          <div className="md:col-span-2 bg-white border border-gray-200 dark:bg-slate-900 dark:border-slate-800 p-6 rounded-2xl flex flex-col justify-center space-y-4 transition-colors">
            <h4 className="text-lg font-bold text-gray-800 dark:text-gray-300">Quick Transactions</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">Add funds using Stripe Sandbox, withdraw directly to your account, or transfer instantly to another registered user using their email address.</p>
            <div className="flex flex-wrap gap-4 pt-2">
              <button
                id="open-deposit-btn"
                onClick={() => { setActionError(''); setIsDepositOpen(true); }}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 font-bold text-white rounded-xl shadow-lg hover:shadow-emerald-500/10 transition flex-1 text-center"
              >
                Deposit Funds
              </button>
              <button
                id="open-withdraw-btn"
                onClick={() => { setActionError(''); setIsWithdrawOpen(true); }}
                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white font-bold rounded-xl transition border border-gray-200 dark:border-slate-700 flex-1 text-center"
              >
                Withdraw Funds
              </button>
              <button
                id="open-transfer-btn"
                onClick={() => { setActionError(''); setIsTransferOpen(true); }}
                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white font-bold rounded-xl transition border border-gray-200 dark:border-slate-700 flex-1 text-center"
              >
                Peer Transfer
              </button>
            </div>
          </div>
        </div>

        {/* History Table */}
        <div className="bg-white border border-gray-200 dark:bg-slate-900 dark:border-slate-800 rounded-2xl overflow-hidden shadow-lg transition-colors">
          <div className="p-5 border-b border-gray-200 dark:border-slate-800 flex justify-between items-center bg-gray-50/50 dark:bg-slate-900/50 transition-colors">
            <h4 className="font-bold text-lg text-gray-800 dark:text-gray-200">Transaction History</h4>
            <span className="text-xs text-gray-500 dark:text-gray-400">Showing recent actions</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-slate-800 text-gray-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider bg-gray-50 dark:bg-slate-950/40 transition-colors">
                  <th className="p-4">Date</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Description</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-800/60 text-sm text-gray-700 dark:text-gray-300 transition-colors">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-gray-400 dark:text-gray-500">
                      No transactions logged. Complete a deposit, withdrawal, or transfer to get started.
                    </td>
                  </tr>
                ) : (
                  history.map((tx) => (
                    <tr key={tx._id} className="hover:bg-gray-55 dark:hover:bg-slate-950/20 transition">
                      <td className="p-4 font-mono text-xs text-gray-500 dark:text-gray-400">
                        {new Date(tx.createdAt).toLocaleDateString()} {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-4 uppercase font-bold text-xs">
                        <span className={`px-2 py-0.5 rounded ${
                          tx.type === 'deposit' ? 'text-emerald-500 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/30' :
                          tx.type === 'withdrawal' ? 'text-rose-500 bg-rose-50 dark:text-rose-400 dark:bg-rose-950/30' :
                          'text-indigo-500 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-950/30'
                        }`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="p-4 text-gray-700 dark:text-gray-300">{tx.description}</td>
                      <td className="p-4 font-semibold font-mono">
                        <span className={tx.type === 'deposit' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                          {tx.type === 'deposit' ? '+' : '-'} {formatCurrency(tx.amount)}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          tx.status === 'completed' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50' :
                          tx.status === 'failed' ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50' :
                          'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-900/50'
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Stripe Deposit Elements Modal */}
      <Elements stripe={stripePromise}>
        <DepositModal
          isOpen={isDepositOpen}
          onClose={() => setIsDepositOpen(false)}
          onRefresh={fetchPaymentData}
        />
      </Elements>

      {/* Direct Withdraw Modal */}
      {isWithdrawOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-white border border-gray-200 dark:bg-slate-900 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 relative text-gray-900 dark:text-white shadow-2xl transition-colors">
            <button
              onClick={() => setIsWithdrawOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-white transition text-lg"
            >
              &times;
            </button>
            <h3 className="text-xl font-bold mb-4 bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">
              Withdraw Funds
            </h3>
            {actionError && <p className="mb-3 text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-950/40 p-2 rounded border border-red-200 dark:border-red-900/50">{actionError}</p>}
            <form onSubmit={handleWithdraw} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Amount to Withdraw (USD)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500 dark:text-gray-400 font-medium">$</span>
                  <input
                    id="withdraw-amount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={withdrawAmount}
                    onChange={e => setWithdrawAmount(e.target.value)}
                    className="w-full pl-8 pr-4 py-2 bg-gray-50 border border-gray-200 dark:bg-slate-950 dark:border-slate-800 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                    required
                  />
                </div>
              </div>

              <button
                id="confirm-withdraw-btn"
                type="submit"
                disabled={actionLoading}
                className="w-full py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg hover:from-indigo-600 hover:to-purple-600 font-semibold shadow-lg hover:shadow-indigo-500/20 transition disabled:opacity-50"
              >
                {actionLoading ? 'Withdrawing...' : 'Confirm Withdrawal'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Peer Transfer Modal */}
      {isTransferOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-white border border-gray-200 dark:bg-slate-900 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 relative text-gray-900 dark:text-white shadow-2xl transition-colors">
            <button
              onClick={() => setIsTransferOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-white transition text-lg"
            >
              &times;
            </button>
            <h3 className="text-xl font-bold mb-4 bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
              Transfer to Partner
            </h3>
            {actionError && <p className="mb-3 text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-950/40 p-2 rounded border border-red-200 dark:border-red-900/50">{actionError}</p>}
            <form onSubmit={handleTransfer} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Recipient Email Address</label>
                <input
                  id="transfer-email"
                  type="email"
                  placeholder="partner@example.com"
                  value={recipientEmail}
                  onChange={e => setRecipientEmail(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 dark:bg-slate-950 dark:border-slate-800 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Amount to Send (USD)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500 dark:text-gray-400 font-medium">$</span>
                  <input
                    id="transfer-amount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={transferAmount}
                    onChange={e => setTransferAmount(e.target.value)}
                    className="w-full pl-8 pr-4 py-2 bg-gray-50 border border-gray-200 dark:bg-slate-950 dark:border-slate-800 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition"
                    required
                  />
                </div>
              </div>

              <button
                id="confirm-transfer-btn"
                type="submit"
                disabled={actionLoading}
                className="w-full py-2.5 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-lg hover:from-pink-600 hover:to-purple-600 font-semibold shadow-lg hover:shadow-pink-500/20 transition disabled:opacity-50"
              >
                {actionLoading ? 'Transferring...' : 'Send Funds'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
