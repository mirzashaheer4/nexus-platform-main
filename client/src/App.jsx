import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Meetings from './pages/Meetings';
import Documents from './pages/Documents';
import VideoCall from './pages/VideoCall';
import Payment from './pages/Payment';
import VerifyOTP from './pages/VerifyOTP';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

function PrivateRoute({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-6">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  // If a specific role is required and doesn't match, redirect to their own dashboard
  if (role && user.role !== role) {
    return <Navigate to={`/${user.role}/dashboard`} />;
  }
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify-otp" element={<VerifyOTP />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />

      {/* Role-specific dashboard routes */}
      <Route
        path="/investor/dashboard"
        element={<PrivateRoute role="investor"><Dashboard /></PrivateRoute>}
      />
      <Route
        path="/entrepreneur/dashboard"
        element={<PrivateRoute role="entrepreneur"><Dashboard /></PrivateRoute>}
      />

      {/* Shared protected routes */}
      <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
      <Route path="/meetings" element={<PrivateRoute><Meetings /></PrivateRoute>} />
      <Route path="/documents" element={<PrivateRoute><Documents /></PrivateRoute>} />
      <Route path="/payments" element={<PrivateRoute><Payment /></PrivateRoute>} />
      <Route path="/call/:roomId" element={<PrivateRoute><VideoCall /></PrivateRoute>} />

      {/* Root redirect */}
      <Route
        path="/"
        element={
          user
            ? <Navigate to={`/${user.role}/dashboard`} />
            : <Navigate to="/login" />
        }
      />
      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen bg-gray-50 text-slate-900 dark:bg-slate-950 dark:text-white transition-colors duration-200">
          <Navbar />
          <AppRoutes />
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
