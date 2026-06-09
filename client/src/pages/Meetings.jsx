import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import API from '../api';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

export default function Meetings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Lists
  const [meetings, setMeetings] = useState([]);
  const [calendarMeetings, setCalendarMeetings] = useState([]);
  
  // Scheduling Form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [participantEmail, setParticipantEmail] = useState('');
  const [proposedTimes, setProposedTimes] = useState([{ startTime: '', endTime: '' }]);
  const [notes, setNotes] = useState('');
  
  // Interaction State
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [rejectingMeetingId, setRejectingMeetingId] = useState(null);
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [acceptingMeetingId, setAcceptingMeetingId] = useState(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);

  // Fetch all my meetings
  const fetchMyMeetings = async () => {
    try {
      const res = await API.get('/meetings/my');
      setMeetings(res.data);
    } catch (err) {
      console.error('Error fetching meetings:', err);
    }
  };

  useEffect(() => {
    fetchMyMeetings();
  }, []);

  // Range-based Calendar Fetching (Fix 12)
  useEffect(() => {
    if (!selectedDate) return;
    const start = new Date(selectedDate);
    start.setDate(start.getDate() - 15);
    const end = new Date(selectedDate);
    end.setDate(end.getDate() + 15);

    API.get(`/meetings/calendar?start=${start.toISOString()}&end=${end.toISOString()}`)
      .then(res => setCalendarMeetings(res.data))
      .catch(err => console.error('Error fetching calendar meetings:', err));
  }, [selectedDate]);

  // Handle scheduling form time additions
  const addTimeSlot = () => {
    setProposedTimes([...proposedTimes, { startTime: '', endTime: '' }]);
  };

  const removeTimeSlot = (index) => {
    if (proposedTimes.length === 1) return;
    const updated = proposedTimes.filter((_, i) => i !== index);
    setProposedTimes(updated);
  };

  const handleTimeChange = (index, field, value) => {
    const updated = [...proposedTimes];
    updated[index][field] = value;
    setProposedTimes(updated);
  };

  const schedule = async (e) => {
    e.preventDefault();
    try {
      // Find invitee by email
      const { data: users } = await API.get(`/users?email=${participantEmail}`);
      if (!users || users.length === 0) {
        return alert('No user found with that email.');
      }
      const inviteeId = users[0]._id;

      // Validate times
      for (const slot of proposedTimes) {
        if (!slot.startTime || !slot.endTime) {
          return alert('Please fill in all proposed time ranges.');
        }
        if (new Date(slot.startTime) >= new Date(slot.endTime)) {
          return alert('End time must be after start time.');
        }
      }

      await API.post('/meetings/schedule', {
        title,
        description,
        invitee: inviteeId,
        proposedTimes,
        notes
      });

      alert('Meeting request sent successfully!');
      // Reset form
      setTitle('');
      setDescription('');
      setParticipantEmail('');
      setProposedTimes([{ startTime: '', endTime: '' }]);
      setNotes('');
      fetchMyMeetings();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to schedule meeting.');
    }
  };

  // Accept meeting (Fix 7, Fix 8)
  const acceptMeeting = async (id) => {
    if (!selectedTimeSlot) {
      return alert('Please select one of the proposed times.');
    }
    try {
      await API.put(`/meetings/${id}/accept`, {
        confirmedTime: selectedTimeSlot
      });
      alert('Meeting accepted successfully!');
      setAcceptingMeetingId(null);
      setSelectedTimeSlot(null);
      fetchMyMeetings();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to accept meeting.');
    }
  };

  // Reject meeting (Fix 12)
  const rejectMeeting = async (id) => {
    try {
      await API.put(`/meetings/${id}/reject`, {
        notes: rejectionNotes
      });
      alert('Meeting request rejected.');
      setRejectingMeetingId(null);
      setRejectionNotes('');
      fetchMyMeetings();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reject meeting.');
    }
  };

  // Cancel meeting (Fix 12)
  const cancelMeeting = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this meeting?')) return;
    try {
      await API.put(`/meetings/${id}/cancel`);
      alert('Meeting request cancelled.');
      fetchMyMeetings();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel meeting.');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'accepted':
        return <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold uppercase tracking-wide">Accepted</span>;
      case 'rejected':
        return <span className="px-3 py-1 bg-rose-100 text-rose-800 rounded-full text-xs font-semibold uppercase tracking-wide">Rejected</span>;
      case 'cancelled':
        return <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-semibold uppercase tracking-wide">Cancelled</span>;
      case 'completed':
        return <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold uppercase tracking-wide">Completed</span>;
      default:
        return <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold uppercase tracking-wide">Pending</span>;
    }
  };

  const getTileContent = ({ date, view }) => {
    if (view !== 'month') return null;
    const formattedDate = date.toDateString();
    
    // Find any confirmed meetings on this day
    const dayMeetings = calendarMeetings.filter(m => {
      if (m.status === 'accepted' && m.confirmedTime) {
        return new Date(m.confirmedTime.startTime).toDateString() === formattedDate;
      }
      return false;
    });

    if (dayMeetings.length > 0) {
      return (
        <div className="flex justify-center mt-1">
          <span className="h-2 w-2 rounded-full bg-indigo-600 block"></span>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Meeting Scheduling</h1>
          <p className="mt-2 text-sm text-slate-600">Coordinate and schedule meeting times between investors and entrepreneurs.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left panel: Calendar & Scheduling Form */}
          <div className="lg:col-span-7 space-y-8">
            {/* Calendar */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Calendar Viewer</h2>
              <div className="flex justify-center">
                <Calendar
                  onChange={setSelectedDate}
                  value={selectedDate}
                  tileContent={getTileContent}
                  className="rounded-xl border-slate-200 p-2 shadow-sm font-sans w-full"
                />
              </div>
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-slate-800 mb-2">
                  Meetings for {selectedDate.toDateString()}:
                </h3>
                {calendarMeetings.filter(m => {
                  const day = selectedDate.toDateString();
                  if (m.status === 'accepted' && m.confirmedTime) {
                    return new Date(m.confirmedTime.startTime).toDateString() === day;
                  }
                  if (m.status === 'pending') {
                    return m.proposedTimes.some(t => new Date(t.startTime).toDateString() === day);
                  }
                  return false;
                }).length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No meetings scheduled or proposed for this date.</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {calendarMeetings.filter(m => {
                      const day = selectedDate.toDateString();
                      if (m.status === 'accepted' && m.confirmedTime) {
                        return new Date(m.confirmedTime.startTime).toDateString() === day;
                      }
                      if (m.status === 'pending') {
                        return m.proposedTimes.some(t => new Date(t.startTime).toDateString() === day);
                      }
                      return false;
                    }).map(m => (
                      <div key={m._id} className="text-xs p-2 bg-slate-50 border border-slate-200 rounded flex justify-between items-center">
                        <div>
                          <span className="font-semibold text-slate-900">{m.title}</span>
                          <span className="text-slate-500 ml-2">({m.status})</span>
                        </div>
                        <span className="text-slate-600">
                          {m.status === 'accepted'
                            ? new Date(m.confirmedTime.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : 'Proposed Slots'
                          }
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Schedule Form */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Request a New Meeting</h2>
              <form onSubmit={schedule} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Title</label>
                  <input
                    type="text"
                    placeholder="E.g., Pitch Presentation, Collaboration Call"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Description</label>
                  <textarea
                    placeholder="Outline details or agenda for the meeting..."
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    rows="2"
                  ></textarea>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Participant Email</label>
                  <input
                    type="email"
                    placeholder="email@example.com"
                    value={participantEmail}
                    onChange={e => setParticipantEmail(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Proposed Time Slots (Propose one or more)</label>
                  <div className="space-y-3">
                    {proposedTimes.map((slot, index) => (
                      <div key={index} className="flex flex-col sm:flex-row gap-2 items-center p-3 border border-slate-200 rounded-xl bg-slate-50">
                        <div className="w-full">
                          <label className="block text-[10px] text-slate-500 mb-1">Start Time</label>
                          <input
                            type="datetime-local"
                            value={slot.startTime}
                            onChange={e => handleTimeChange(index, 'startTime', e.target.value)}
                            className="w-full p-2 border border-slate-200 rounded-lg bg-white text-slate-900 text-xs focus:ring-2 focus:ring-indigo-500"
                            required
                          />
                        </div>
                        <div className="w-full">
                          <label className="block text-[10px] text-slate-500 mb-1">End Time</label>
                          <input
                            type="datetime-local"
                            value={slot.endTime}
                            onChange={e => handleTimeChange(index, 'endTime', e.target.value)}
                            className="w-full p-2 border border-slate-200 rounded-lg bg-white text-slate-900 text-xs focus:ring-2 focus:ring-indigo-500"
                            required
                          />
                        </div>
                        {proposedTimes.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeTimeSlot(index)}
                            className="mt-4 sm:mt-0 text-red-500 hover:text-red-700 p-2 text-xs font-medium"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={addTimeSlot}
                    className="mt-3 text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
                  >
                    + Add Alternative Time Slot
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Initial Notes</label>
                  <input
                    type="text"
                    placeholder="Any comments, link preferences, etc."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium p-2.5 rounded-xl transition duration-150 shadow-sm text-sm"
                >
                  Propose Meeting
                </button>
              </form>
            </div>
          </div>

          {/* Right panel: Meetings List */}
          <div className="lg:col-span-5">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm min-h-[500px]">
              <h2 className="text-lg font-bold text-slate-900 mb-4">My Meetings</h2>
              {meetings.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-slate-500 text-sm">No scheduled meetings found.</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[800px] overflow-y-auto pr-1">
                  {meetings.map(m => {
                    const isOrganizer = m.organizer?._id === user?._id;
                    const partner = isOrganizer ? m.invitee : m.organizer;

                    return (
                      <div
                        key={m._id}
                        className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition duration-150 space-y-3 bg-white shadow-sm"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold text-slate-900 text-sm">{m.title}</h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {isOrganizer ? 'Invited' : 'Organizer'}: {partner?.name} ({partner?.email})
                            </p>
                          </div>
                          {getStatusBadge(m.status)}
                        </div>

                        {m.description && (
                          <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                            {m.description}
                          </p>
                        )}

                        {m.notes && (
                          <div className="text-[11px] text-slate-500 italic">
                            <strong>Notes/Reason:</strong> {m.notes}
                          </div>
                        )}

                        {/* Confirmed Time Display */}
                        {m.status === 'accepted' && m.confirmedTime && (
                          <div className="text-xs bg-indigo-50 text-indigo-900 p-2.5 rounded-lg border border-indigo-100 space-y-1">
                            <p className="font-semibold">Confirmed Time Slot:</p>
                            <p>{new Date(m.confirmedTime.startTime).toLocaleString()} - {new Date(m.confirmedTime.endTime).toLocaleString()}</p>
                          </div>
                        )}

                        {/* Proposed Times List (Pending Accept) */}
                        {m.status === 'pending' && (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-slate-700">Proposed Times:</p>
                            <div className="space-y-1">
                              {m.proposedTimes.map((t, idx) => (
                                <div key={idx} className="text-[11px] p-2 bg-slate-50 rounded border border-slate-200">
                                  {new Date(t.startTime).toLocaleString()} - {new Date(t.endTime).toLocaleString()}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                          {/* Cancel button for Organizer */}
                          {isOrganizer && m.status === 'pending' && (
                            <button
                              onClick={() => cancelMeeting(m._id)}
                              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-medium transition"
                            >
                              Cancel Meeting
                            </button>
                          )}

                          {/* Accept / Reject actions for Invitee */}
                          {!isOrganizer && m.status === 'pending' && (
                            <div className="w-full space-y-2">
                              {acceptingMeetingId === m._id ? (
                                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                                  <p className="text-xs font-semibold text-slate-700 mb-1">Select confirmed slot:</p>
                                  {m.proposedTimes.map((slot, idx) => (
                                    <label key={idx} className="flex items-start gap-2 p-2 bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-indigo-50/20 text-xs">
                                      <input
                                        type="radio"
                                        name={`time-slot-${m._id}`}
                                        className="mt-0.5"
                                        onChange={() => setSelectedTimeSlot(slot)}
                                      />
                                      <span>
                                        {new Date(slot.startTime).toLocaleString()} - {new Date(slot.endTime).toLocaleString()}
                                      </span>
                                    </label>
                                  ))}
                                  <div className="flex gap-2 pt-2">
                                    <button
                                      onClick={() => acceptMeeting(m._id)}
                                      className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-medium"
                                    >
                                      Confirm Accept
                                    </button>
                                    <button
                                      onClick={() => {
                                        setAcceptingMeetingId(null);
                                        setSelectedTimeSlot(null);
                                      }}
                                      className="text-xs bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : rejectingMeetingId === m._id ? (
                                <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                                  <textarea
                                    placeholder="Optional reason for rejection..."
                                    value={rejectionNotes}
                                    onChange={e => setRejectionNotes(e.target.value)}
                                    className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                                    rows="2"
                                  ></textarea>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => rejectMeeting(m._id)}
                                      className="text-xs bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg font-medium"
                                    >
                                      Confirm Reject
                                    </button>
                                    <button
                                      onClick={() => {
                                        setRejectingMeetingId(null);
                                        setRejectionNotes('');
                                      }}
                                      className="text-xs bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => setAcceptingMeetingId(m._id)}
                                    className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-medium transition"
                                  >
                                    Accept...
                                  </button>
                                  <button
                                    onClick={() => setRejectingMeetingId(m._id)}
                                    className="text-xs bg-slate-100 hover:bg-slate-200 text-rose-600 px-3 py-1.5 rounded-lg font-medium transition"
                                  >
                                    Reject...
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Join Call button when Accepted */}
                          {m.status === 'accepted' && (
                            <button
                              onClick={() => navigate(`/call/${m.meetingLink}`)}
                              className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 shadow-sm"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              Join Video Call
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
