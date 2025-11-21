// src/components/QueueManagement.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import './QueueManagement.css';

// Helper Components (PriorityTag, AppointmentType, StatusBadge)
const PriorityTag = ({ priority }) => {
  if (!priority) return null;
  const config = {
    emergency: { className: 'priority-emergency', text: 'Emergency' },
    vip: { className: 'priority-vip', text: 'VIP' },
  };
  const { className, text } = config[priority] || {};
  if (!text) return null;
  return <span className={`priority-tag ${className}`}>{text}</span>;
};

const AppointmentType = ({ type }) => {
  const config = {
    appointment: { className: 'type-appointment', text: 'Appointment' },
    walkin: { className: 'type-walkin', text: 'Walk-in' },
    followup: { className: 'type-followup', text: 'Follow-up' },
  };
  const { className, text } = config[type] || { className: '', text: type };
  return <span className={`appointment-type ${className}`}>{text}</span>;
};

const StatusBadge = ({ status }) => {
  const config = {
    waiting: { className: 'status-waiting', text: 'Waiting' },
    pending: { className: 'status-waiting', text: 'Pending' },
    arrived: { className: 'status-arrived', text: 'Arrived' },
    'in-progress': { className: 'status-in-progress', text: 'In Progress' },
    inprogress: { className: 'status-in-progress', text: 'In Progress' },
    completed: { className: 'status-completed', text: 'Completed' },
    'on-hold': { className: 'status-on-hold', text: 'On Hold' },
  };
  const { className, text } = config[status] || { className: 'status-waiting', text: status };
  return <span className={`status-badge ${className}`}>{text}</span>;
};

const QueueManagement = () => {
  const { user } = useAuth();

  // State
  const [queue, setQueue] = useState([]);
  const [availableDoctors, setAvailableDoctors] = useState([]);
  const [isPaused, setIsPaused] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [autoAssistEnabled, setAutoAssistEnabled] = useState(false);
  const [modalState, setModalState] = useState({ type: null, data: null });
  const [selectedDoctorId, setSelectedDoctorId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Walk-in state
  const [walkinName, setWalkinName] = useState('');
  const [walkinAge, setWalkinAge] = useState('');
  const [walkinPriority, setWalkinPriority] = useState('normal');
  const [walkinReason, setWalkinReason] = useState('');

  // Fetch queue data and doctors list
  const fetchQueueData = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      console.log('📡 API CALL → GET /doctor/appointments/?date=', today);
      const response = await apiService.getDoctorAppointments(today);
      console.log('✅ API RESPONSE → /doctor/appointments', response);
      setQueue(Array.isArray(response) ? response : (response?.results || []));
    } catch (err) {
      console.error('Error fetching queue:', err);
      setQueue([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchDoctors = async () => {
    try {
      console.log('📡 API CALL → GET /doctor/');
      // Public list of doctors
      const response = await apiService.getDepartments ? await apiService.getDoctors() : await apiService.request('/doctor/');
      console.log('✅ API RESPONSE → /doctor/', response);
      setAvailableDoctors(Array.isArray(response) ? response : (response?.results || []));
    } catch (err) {
      console.error('Error fetching doctors:', err);
      setAvailableDoctors([]);
    }
  };

  useEffect(() => {
    fetchQueueData();
    fetchDoctors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filters and stats
  const filteredQueue = useMemo(() => {
    if (!searchTerm) return queue;
    const lowerSearch = searchTerm.toLowerCase();
    return queue.filter(p =>
      p.token_number?.toString().toLowerCase().includes(lowerSearch) ||
      p.patient_name?.toLowerCase().includes(lowerSearch)
    );
  }, [queue, searchTerm]);

  const stats = useMemo(() => {
    const counts = { waiting: 0, 'in-progress': 0, completed: 0, arrived: 0 };
    queue.forEach(p => {
      const status = p.status?.toLowerCase();
      if (status === 'waiting' || status === 'pending') counts.waiting++;
      else if (status === 'in-progress' || status === 'inprogress') counts['in-progress']++;
      else if (status === 'completed') counts.completed++;
      else if (status === 'arrived') counts.arrived++;
    });
    return {
      waiting: counts.waiting + counts.arrived,
      inProgress: counts['in-progress'],
      completed: counts.completed,
      total: queue.length
    };
  }, [queue]);

  // Actions
  const handlePauseQueue = () => {
    setIsPaused(true);
    console.log('Queue paused (local state).');
  };

  const handleResumeQueue = () => {
    setIsPaused(false);
    console.log('Queue resumed (local state).');
  };

  const openModal = (type, data) => setModalState({ type, data });
  const closeModal = () => {
    setModalState({ type: null, data: null });
    setSelectedDoctorId(null);
    setWalkinName('');
    setWalkinAge('');
    setWalkinPriority('normal');
    setWalkinReason('');
  };

  // Start consultation
  const handleStartConsultation = async (appointment) => {
    try {
      console.log('📡 ACTION → POST /appointments/{id}/start_consultation/', appointment.id);
      await apiService.startConsultation(appointment.id);
      alert(`Consultation started for token ${appointment.token_number}`);
      await fetchQueueData();
    } catch (err) {
      console.error('Error starting consultation:', err);
      alert('Failed to start consultation.');
    }
  };

  // Reassign patient
  const handleReassign = async () => {
    if (!selectedDoctorId || !modalState.data) return;

    const appointment = modalState.data;
    const newDoctor = availableDoctors.find(
      (doc) => Number(doc.id) === Number(selectedDoctorId)
    );
    const departmentId =
      newDoctor?.department_id ??
      newDoctor?.department?.id ??
      appointment?.department;

    try {
      console.log("📡 ACTION → reschedule appointment");

      await apiService.rescheduleAppointment(appointment.id, {
        doctor: selectedDoctorId,
        department: departmentId,
        appointment_date: appointment.appointment_date,
        time_slot: appointment.time_slot,
        reason: appointment.reason,
        booking_type: appointment.booking_type,
        is_for_self: appointment.is_for_self,
        patient_relation: appointment.patient_relation,
      });

      alert(`Patient ${appointment.token_number} reassigned successfully.`);
      closeModal();
      await fetchQueueData();
    } catch (err) {
      console.error("Error reassigning:", err);
      alert("Failed to reassign patient.");
    }
  };



  // Mark no-show
  const handleNoShow = async () => {
    if (!modalState.data) return;
    const appointment = modalState.data;
    try {
      console.log('📡 ACTION → POST /appointments/{id}/end_consultation/ (no_show)', appointment.id);
      await apiService.endConsultation(appointment.id, {
        no_show: true,
        notes: 'Marked as no-show via queue UI'
      });
      alert(`Patient ${appointment.token_number} marked as no-show.`);
      closeModal();
      await fetchQueueData();
    } catch (err) {
      console.error('Error marking no-show:', err);
      alert('Failed to mark no-show.');
    }
  };

  // Add walk-in
  const handleAddWalkin = async () => {
    alert("Walk-in flow is not available in this build. Please use the appointment booking flow.");
    closeModal();
  };

  // Move patient in queue (local reorder only)
  const handleMove = (token, direction) => {
    setQueue(prevQueue => {
      const index = prevQueue.findIndex(p => p.token_number === token);
      if (index === -1) return prevQueue;
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= prevQueue.length) return prevQueue;
      const newQueue = [...prevQueue];
      [newQueue[index], newQueue[newIndex]] = [newQueue[newIndex], newQueue[index]];
      return newQueue;
    });
  };

  if (loading) return <div className="loading-screen">Loading queue...</div>;

  return (
    <>
      {/* Main Content */}
      <div className="container">
        <div className="queue-header">
          <h1 className="queue-title">Today's Appointments</h1>
          <div className="queue-actions">
            {!isPaused && (
              <button className="btn btn-primary" onClick={handlePauseQueue}>
                <i className="fas fa-pause"></i> Pause Queue
              </button>
            )}
            {isPaused && (
              <button className="btn btn-secondary" onClick={handleResumeQueue}>
                <i className="fas fa-play"></i> Resume Queue
              </button>
            )}
            <button className="btn btn-secondary" onClick={() => openModal('walkin')}>
              <i className="fas fa-user-plus"></i> Add Walk-in
            </button>
          </div>
        </div>

        <div className="queue-stats">
          <div className="stat-card">
            <div className="stat-value stat-waiting">{stats.waiting}</div>
            <div className="stat-label">Waiting</div>
          </div>
          <div className="stat-card">
            <div className="stat-value stat-in-progress">{stats.inProgress}</div>
            <div className="stat-label">In Progress</div>
          </div>
          <div className="stat-card">
            <div className="stat-value stat-completed">{stats.completed}</div>
            <div className="stat-label">Completed</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Today</div>
          </div>
        </div>

        {/* Pause Panel */}
        <div className={`pause-panel ${isPaused ? 'show' : ''}`}>
          <div className="pause-message">
            <i className="fas fa-exclamation-triangle"></i>
            <span>Queue is currently paused. New tokens will not be assigned until resumed.</span>
          </div>
          <button className="btn btn-secondary" onClick={handleResumeQueue}>
            <i className="fas fa-play"></i> Resume Queue
          </button>
        </div>

        <div className="queue-controls">
          <div className="search-filter">
            <div className="search-box">
              <i className="fas fa-search search-icon"></i>
              <input
                type="text"
                placeholder="Search by patient name or token..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button className="filter-btn">
              <i className="fas fa-filter"></i> Filter
            </button>
          </div>
        </div>

        <div className="queue-table-container">
          <table className="queue-table">
            <thead>
              <tr>
                <th>Token No.</th>
                <th>Time Slot</th>
                <th>Patient</th>
                <th>Appointment Type</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredQueue.map((patient, index) => (
                <tr key={patient.id}>
                  <td>
                    <div className="token-cell">
                      <div className="token-number">{patient.token_number}</div>
                      <div className="token-actions">
                        <button className="action-btn" title="Move Up" onClick={() => handleMove(patient.token_number, 'up')} disabled={index === 0}>
                          <i className="fas fa-arrow-up"></i>
                        </button>
                        <button className="action-btn" title="Move Down" onClick={() => handleMove(patient.token_number, 'down')} disabled={index === filteredQueue.length - 1}>
                          <i className="fas fa-arrow-down"></i>
                        </button>
                      </div>
                    </div>
                  </td>
                  <td>{patient.time_slot}</td>
                  <td>
                    <div className="patient-cell">
                      <div className="patient-name">{patient.patient_name}</div>
                      <div className="patient-age">{patient.patient_age || 'N/A'} years</div>
                    </div>
                  </td>
                  <td><AppointmentType type={patient.booking_type || 'appointment'} /></td>
                  <td><PriorityTag priority={patient.priority} /></td>
                  <td><StatusBadge status={patient.status} /></td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="row-action-btn start-btn"
                        onClick={() => handleStartConsultation(patient)}
                        disabled={patient.status === 'inprogress' || patient.status === 'completed'}
                      >
                        <i className="fas fa-play"></i> Start
                      </button>
                      <button className="row-action-btn reassign-btn" onClick={() => openModal('reassign', patient)}>
                        <i className="fas fa-exchange-alt"></i> Reassign
                      </button>
                      <button className="row-action-btn noshow-btn danger" onClick={() => openModal('noshow', patient)}>
                        <i className="fas fa-user-times"></i> No-Show
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Auto-assist Panel */}
        <div className="auto-assist">
          <div className="auto-assist-header">
            <h3 className="auto-assist-title">Auto-assign Backup Doctor</h3>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={autoAssistEnabled}
                onChange={(e) => setAutoAssistEnabled(e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
          <p>When enabled, patients will be automatically reassigned to available backup doctors if queue wait time exceeds 30 minutes.</p>
        </div>
      </div>

      {/* --- Modals --- */}

      {/* Reassignment Modal */}
      <div className={`modal ${modalState.type === 'reassign' ? 'show' : ''}`}>
        <div className="modal-content">
          <div className="modal-header">
            <h3 className="modal-title">Reassign Patient</h3>
            <button className="modal-close" onClick={closeModal}>&times;</button>
          </div>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Patient: <strong>{modalState.data?.patient_name} (Token {modalState.data?.token_number})</strong></label>
            </div>
            <div className="form-group">
              <label className="form-label">Select Doctor:</label>
              <div className="doctor-list">
                {availableDoctors.map(doc => (
                  <div
                    key={doc.id}
                    className={`doctor-item ${selectedDoctorId === doc.id ? 'selected' : ''}`}
                    onClick={() => setSelectedDoctorId(doc.id)}
                  >
                    <div className="doctor-name">{doc.full_name}</div>
                    <div className="doctor-specialty">{doc.specialty}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={closeModal}>Cancel</button>
            <button className="btn btn-primary" onClick={handleReassign} disabled={!selectedDoctorId}>Reassign</button>
          </div>
        </div>
      </div>

      {/* No-Show Modal */}
      <div className={`modal ${modalState.type === 'noshow' ? 'show' : ''}`}>
        <div className="modal-content">
          <div className="modal-header">
            <h3 className="modal-title">Mark Patient as No-Show</h3>
            <button className="modal-close" onClick={closeModal}>&times;</button>
          </div>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Patient: <strong>{modalState.data?.patient_name} (Token {modalState.data?.token_number})</strong></label>
            </div>
            <div className="form-group">
              <div style={{ background: 'rgba(217, 83, 79, 0.1)', padding: '10px', borderRadius: '4px', marginBottom: '15px' }}>
                <i className="fas fa-exclamation-triangle" style={{ color: 'var(--secondary)' }}></i>
                <strong> Policy Warning:</strong> Marking a patient as no-show will count against their appointment history.
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={closeModal}>Cancel</button>
            <button className="btn btn-danger" onClick={handleNoShow}>Mark as No-Show</button>
          </div>
        </div>
      </div>

      {/* Add Walk-in Modal */}
      <div className={`modal ${modalState.type === 'walkin' ? 'show' : ''}`}>
        <div className="modal-content">
          <div className="modal-header">
            <h3 className="modal-title">Add Walk-in Patient</h3>
            <button className="modal-close" onClick={closeModal}>&times;</button>
          </div>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Patient Name</label>
              <input type="text" className="form-control" placeholder="Enter patient name" value={walkinName} onChange={e => setWalkinName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Age</label>
              <input type="number" className="form-control" placeholder="Enter age" value={walkinAge} onChange={e => setWalkinAge(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Priority</label>
              <select className="form-control" value={walkinPriority} onChange={e => setWalkinPriority(e.target.value)}>
                <option value="normal">Normal</option>
                <option value="emergency">Emergency</option>
                <option value="vip">VIP</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Reason for Visit</label>
              <textarea className="form-control" rows="3" placeholder="Brief reason for visit..." value={walkinReason} onChange={e => setWalkinReason(e.target.value)}></textarea>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={closeModal}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAddWalkin}>Add to Queue</button>
          </div>
        </div>
      </div>
    </>
  );
};

export default QueueManagement;
