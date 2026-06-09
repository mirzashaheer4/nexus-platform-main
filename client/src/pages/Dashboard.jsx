import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import API from '../api';

export default function Dashboard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [profileRes, dashRes] = await Promise.all([
          API.get('/profile/me'),
          API.get(`/${user?.role}/dashboard`),
        ]);
        setProfile(profileRes.data);
        setDashboardData(dashRes.data);
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    if (user?.role) fetchData();
  }, [user]);

  if (loading) return <div className="p-6">Loading dashboard...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto bg-white text-gray-900 border rounded shadow-sm">
      <h1 className="text-2xl font-bold mb-2">
        {user?.role === 'investor' ? 'Investor Dashboard' : 'Entrepreneur Dashboard'}
      </h1>
      <p className="text-gray-600 mb-6">Welcome back, <strong>{user?.name}</strong></p>

      {/* Profile Summary */}
      {profile && (
        <div className="border border-gray-300 rounded p-4 mb-6 bg-white text-gray-900 shadow-sm">
          <h2 className="text-lg font-semibold mb-2">Your Profile</h2>
          <p className="text-sm text-gray-700">{profile.bio || 'No bio set yet.'}</p>
          {profile.location && <p className="text-sm text-gray-500 mt-1">📍 {profile.location}</p>}
          {profile.website && (
            <a href={profile.website} target="_blank" rel="noreferrer" className="text-indigo-600 text-sm mt-1 block">
              🔗 {profile.website}
            </a>
          )}
        </div>
      )}

      {/* Role-specific data */}
      {user?.role === 'investor' && dashboardData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-gray-300 rounded p-4 text-center bg-white text-gray-900 shadow-sm">
            <p className="text-3xl font-bold text-indigo-600">{dashboardData.totalInvestments ?? 0}</p>
            <p className="text-sm text-gray-600 mt-1 font-medium">Total Investments</p>
          </div>
          <div className="border border-gray-300 rounded p-4 text-center bg-white text-gray-900 shadow-sm">
            <p className="text-3xl font-bold text-indigo-600">{dashboardData.activeDeals ?? 0}</p>
            <p className="text-sm text-gray-600 mt-1 font-medium">Active Deals</p>
          </div>
          <div className="border border-gray-300 rounded p-4 text-center bg-white text-gray-900 shadow-sm">
            <p className="text-3xl font-bold text-indigo-600">{dashboardData.meetingsCount ?? 0}</p>
            <p className="text-sm text-gray-600 mt-1 font-medium">Meetings Scheduled</p>
          </div>
        </div>
      )}

      {user?.role === 'entrepreneur' && dashboardData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-gray-300 rounded p-4 text-center bg-white text-gray-900 shadow-sm">
            <p className="text-3xl font-bold text-indigo-600">{dashboardData.fundingRequired ?? 0}</p>
            <p className="text-sm text-gray-600 mt-1 font-medium">Funding Required ($)</p>
          </div>
          <div className="border border-gray-300 rounded p-4 text-center bg-white text-gray-900 shadow-sm">
            <p className="text-3xl font-bold text-indigo-600">{dashboardData.startupStage ?? 'N/A'}</p>
            <p className="text-sm text-gray-600 mt-1 font-medium">Startup Stage</p>
          </div>
          <div className="border border-gray-300 rounded p-4 text-center bg-white text-gray-900 shadow-sm">
            <p className="text-3xl font-bold text-indigo-600">{dashboardData.meetingsCount ?? 0}</p>
            <p className="text-sm text-gray-600 mt-1 font-medium">Meetings Scheduled</p>
          </div>
        </div>
      )}
    </div>
  );
}
