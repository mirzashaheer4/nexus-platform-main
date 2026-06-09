import { useEffect, useState, useRef } from 'react';
import API from '../api';

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [toggling2FA, setToggling2FA] = useState(false);
  const fileInputRef = useRef();

  const handleToggle2FA = async () => {
    setToggling2FA(true);
    setError('');
    try {
      const endpoint = profile.twoFactorEnabled ? '/auth/disable-2fa' : '/auth/enable-2fa';
      const res = await API.post(endpoint);
      setProfile(prev => ({ ...prev, twoFactorEnabled: res.data.twoFactorEnabled }));
      setForm(prev => ({ ...prev, twoFactorEnabled: res.data.twoFactorEnabled }));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update 2FA status.');
    } finally {
      setToggling2FA(false);
    }
  };

  useEffect(() => {
    API.get('/profile/me')
      .then(res => {
        setProfile(res.data);
        setForm(res.data);
      })
      .catch(() => setError('Failed to load profile.'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await API.put('/profile/me', form);
      setProfile(res.data);
      setEditing(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const handlePictureUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('picture', file);
      const res = await API.post('/profile/picture', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setProfile(prev => ({ ...prev, profilePicture: res.data.profilePicture }));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload picture.');
    } finally {
      setUploading(false);
    }
  };

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  if (loading) return <div className="p-6">Loading profile...</div>;
  if (!profile) return <div className="p-6 text-red-600">{error || 'Profile not found.'}</div>;

  const isInvestor = profile.role === 'investor';

  return (
    <div className="p-6 max-w-3xl mx-auto bg-white border border-gray-200 rounded shadow-sm text-gray-900 dark:bg-slate-900 dark:border-slate-800 dark:text-white transition-colors">
      <h1 className="text-2xl font-bold mb-6">My Profile</h1>
      {error && <p className="mb-4 text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-950/40 p-2 rounded border border-red-200 dark:border-red-900/50">{error}</p>}

      {/* Profile Picture */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-20 h-20 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center">
          {profile.profilePicture ? (() => {
            const rawBase = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api').replace('/api', '');
            const cleanBase = rawBase.endsWith('/') ? rawBase.slice(0, -1) : rawBase;
            return (
              <img src={`${cleanBase}${profile.profilePicture}`} alt="Profile" className="w-full h-full object-cover" />
            );
          })() : (
            <span className="text-3xl text-gray-400">👤</span>
          )}
        </div>
        <div>
          <button
            id="upload-picture-btn"
            onClick={() => fileInputRef.current.click()}
            disabled={uploading}
            className="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Change Photo'}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePictureUpload} className="hidden" />
        </div>
      </div>

      {/* Profile Form */}
      {editing ? (
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bio</label>
            <textarea
              value={form.bio || ''}
              onChange={e => handleChange('bio', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-950 dark:border-slate-800 dark:text-white"
              rows={3}
              placeholder="Tell us about yourself..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</label>
            <input type="text" value={form.location || ''} onChange={e => handleChange('location', e.target.value)} className="w-full p-2 border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-950 dark:border-slate-800 dark:text-white" placeholder="City, Country" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Website</label>
            <input type="url" value={form.website || ''} onChange={e => handleChange('website', e.target.value)} className="w-full p-2 border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-950 dark:border-slate-800 dark:text-white" placeholder="https://..." />
          </div>

          {/* Investor-specific fields */}
          {isInvestor && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Min Investment ($)</label>
                  <input type="number" value={form.investmentRange?.min || ''} onChange={e => handleChange('investmentRange', { ...form.investmentRange, min: Number(e.target.value) })} className="w-full p-2 border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-950 dark:border-slate-800 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Investment ($)</label>
                  <input type="number" value={form.investmentRange?.max || ''} onChange={e => handleChange('investmentRange', { ...form.investmentRange, max: Number(e.target.value) })} className="w-full p-2 border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-950 dark:border-slate-800 dark:text-white" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Industries of Interest (comma-separated)</label>
                <input type="text" value={(form.industriesOfInterest || []).join(', ')} onChange={e => handleChange('industriesOfInterest', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} className="w-full p-2 border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-950 dark:border-slate-800 dark:text-white" placeholder="FinTech, HealthTech, EdTech" />
              </div>
            </>
          )}

          {/* Entrepreneur-specific fields */}
          {!isInvestor && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Startup Name</label>
                <input type="text" value={form.startupName || ''} onChange={e => handleChange('startupName', e.target.value)} className="w-full p-2 border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-950 dark:border-slate-800 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Startup Stage</label>
                <select value={form.startupStage || ''} onChange={e => handleChange('startupStage', e.target.value)} className="w-full p-2 border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-950 dark:border-slate-800 dark:text-white">
                  <option value="">Select stage</option>
                  <option value="idea">Idea</option>
                  <option value="mvp">MVP</option>
                  <option value="early">Early Stage</option>
                  <option value="growth">Growth</option>
                  <option value="scale">Scale</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Funding Required ($)</label>
                <input type="number" value={form.fundingRequired || ''} onChange={e => handleChange('fundingRequired', Number(e.target.value))} className="w-full p-2 border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-950 dark:border-slate-800 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pitch Deck URL</label>
                <input type="url" value={form.pitchDeckUrl || ''} onChange={e => handleChange('pitchDeckUrl', e.target.value)} className="w-full p-2 border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-950 dark:border-slate-800 dark:text-white" placeholder="https://..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Team Size</label>
                <input type="number" value={form.teamSize || ''} onChange={e => handleChange('teamSize', Number(e.target.value))} className="w-full p-2 border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-950 dark:border-slate-800 dark:text-white" />
              </div>
            </>
          )}

          <div className="flex gap-3 pt-2">
            <button id="save-profile-btn" type="submit" disabled={saving} className="bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700 transition disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button type="button" onClick={() => { setEditing(false); setForm(profile); }} className="bg-gray-200 text-gray-700 px-6 py-2 rounded hover:bg-gray-300 transition dark:bg-slate-800 dark:text-gray-300 dark:hover:bg-slate-700">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <div><span className="font-medium">Bio:</span> <span className="text-gray-700">{profile.bio || '—'}</span></div>
          <div><span className="font-medium">Location:</span> <span className="text-gray-700">{profile.location || '—'}</span></div>
          <div><span className="font-medium">Website:</span> {profile.website ? <a href={profile.website} target="_blank" rel="noreferrer" className="text-indigo-600">{profile.website}</a> : '—'}</div>

          {isInvestor && (
            <>
              <div><span className="font-medium">Investment Range:</span> <span className="text-gray-700">${profile.investmentRange?.min ?? 0} – ${profile.investmentRange?.max ?? 0}</span></div>
              <div><span className="font-medium">Industries:</span> <span className="text-gray-700">{(profile.industriesOfInterest || []).join(', ') || '—'}</span></div>
              <div><span className="font-medium">Portfolio Companies:</span> <span className="text-gray-700">{(profile.portfolioCompanies || []).join(', ') || '—'}</span></div>
            </>
          )}

          {!isInvestor && (
            <>
              <div><span className="font-medium">Startup:</span> <span className="text-gray-700">{profile.startupName || '—'}</span></div>
              <div><span className="font-medium">Stage:</span> <span className="text-gray-700">{profile.startupStage || '—'}</span></div>
              <div><span className="font-medium">Funding Required:</span> <span className="text-gray-700">${profile.fundingRequired ?? 0}</span></div>
              <div><span className="font-medium">Pitch Deck:</span> {profile.pitchDeckUrl ? <a href={profile.pitchDeckUrl} target="_blank" rel="noreferrer" className="text-indigo-600">View Deck</a> : '—'}</div>
              <div><span className="font-medium">Team Size:</span> <span className="text-gray-700">{profile.teamSize ?? '—'}</span></div>
            </>
          )}

          <button id="edit-profile-btn" onClick={() => setEditing(true)} className="mt-4 bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700 transition">
            Edit Profile
          </button>
        </div>
      )}

      {/* 2FA Security Section */}
      <hr className="my-6 border-gray-200 dark:border-slate-800" />
      
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-3 text-slate-900 dark:text-white">Security Settings</h3>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl gap-4">
          <div>
            <p className="font-semibold text-sm text-slate-900 dark:text-white">Two-Factor Authentication (2FA)</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Secure your account by requiring an email verification code (OTP) at login.
            </p>
          </div>
          <div className="flex items-center gap-3 self-end sm:self-auto">
            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
              profile.twoFactorEnabled 
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50' 
                : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
            }`}>
              {profile.twoFactorEnabled ? 'Enabled' : 'Disabled'}
            </span>
            <button
              id="toggle-2fa-btn"
              type="button"
              onClick={handleToggle2FA}
              disabled={toggling2FA}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
                profile.twoFactorEnabled
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
              }`}
            >
              {toggling2FA ? 'Processing...' : profile.twoFactorEnabled ? 'Disable' : 'Enable'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
