import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import API from '../api';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

export default function Meetings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [participantEmail, setParticipantEmail] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    API.get('/meetings').then(res => setMeetings(res.data));
  }, []);

  const schedule = async (e) => {
    e.preventDefault();
    try {
      const { data: users } = await API.get(`/users?email=${participantEmail}`);
      if (!users.length) return alert('User not found');
      await API.post('/meetings', { title, description, participant: users[0]._id, startTime, endTime });
      alert('Meeting scheduled');
      window.location.reload();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed');
    }
  };

  const updateStatus = async (id, status) => {
    await API.put(`/meetings/${id}/status`, { status });
    window.location.reload();
  };

  const joinCall = (roomId) => {
    navigate(`/call/${roomId}`);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold">Meetings</h1>
      <div className="grid md:grid-cols-2 gap-6 mt-4">
        <Calendar onChange={setSelectedDate} value={selectedDate} />
        <form onSubmit={schedule} className="border p-4 rounded">
          <input type="text" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} className="w-full p-2 border rounded mb-2" required />
          <textarea placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} className="w-full p-2 border rounded mb-2" rows="2"></textarea>
          <input type="email" placeholder="Participant Email" value={participantEmail} onChange={e => setParticipantEmail(e.target.value)} className="w-full p-2 border rounded mb-2" required />
          <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full p-2 border rounded mb-2" required />
          <input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full p-2 border rounded mb-4" required />
          <button type="submit" className="w-full bg-indigo-600 text-white p-2 rounded">Schedule</button>
        </form>
      </div>
      <div className="mt-6">
        {meetings.map(m => (
          <div key={m._id} className="border p-3 rounded mt-2">
            <p><strong>{m.title}</strong> with {m.organizer?.name || m.participant?.name}</p>
            <p>{new Date(m.startTime).toLocaleString()} - {new Date(m.endTime).toLocaleString()}</p>
            <p>Status: {m.status}</p>
            {m.status === 'pending' && m.participant?._id === user?._id && (
              <div className="space-x-2 mt-2">
                <button onClick={() => updateStatus(m._id, 'accepted')} className="bg-green-500 text-white px-3 py-1 rounded">Accept</button>
                <button onClick={() => updateStatus(m._id, 'rejected')} className="bg-red-500 text-white px-3 py-1 rounded">Reject</button>
              </div>
            )}
            {m.status === 'accepted' && (
              <button onClick={() => joinCall(m.roomId)} className="mt-2 bg-blue-600 text-white px-3 py-1 rounded">Join Video Call</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
