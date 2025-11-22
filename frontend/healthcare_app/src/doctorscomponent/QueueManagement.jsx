// src/components/QueueManagement.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import './QueueManagement.css';

// Helper Components (unchanged)
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

  // State (unchanged)
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

  // Fetch functions (unchanged)
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

  // Filters and stats (unchanged)
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

  // Action handlers (unchanged)
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

  const handleAddWalkin = async () => {
    alert("Walk-in flow is not available in this build. Please use the appointment booking flow.");
    closeModal();
  };

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
      {/* Medical Dashboard Style */}
      <div className="medical-dashboard">
        {/* Header with Medical Theme */}
        <div className="dashboard-header">
          <div className="header-left">
            <div className="clinic-brand">
              <i className="fas fa-hospital"></i>
              <div className="brand-text">
                <h1>Patient Queue</h1>
                <p>Medical Consultation Management</p>
              </div>
            </div>
          </div>
          <div className="header-right">
            <div className="queue-controls">
              {!isPaused ? (
                <button className="control-btn pause-btn" onClick={handlePauseQueue}>
                  <i className="fas fa-pause"></i>
                  Pause Queue
                </button>
              ) : (
                <button className="control-btn resume-btn" onClick={handleResumeQueue}>
                  <i className="fas fa-play"></i>
                  Resume Queue
                </button>
              )}
              <button className="control-btn walkin-btn" onClick={() => openModal('walkin')}>
                <i className="fas fa-user-plus"></i>
                Add Walk-in
              </button>
            </div>
          </div>
        </div>

        {/* Status Overview */}
        <div className="status-overview">
          <div className="status-card waiting">
            <div className="status-icon">
              <i className="fas fa-clock"></i>
            </div>
            <div className="status-info">
              <div className="status-count">{stats.waiting}</div>
              <div className="status-label">Waiting</div>
            </div>
          </div>
          <div className="status-card in-progress">
            <div className="status-icon">
              <i className="fas fa-user-md"></i>
            </div>
            <div className="status-info">
              <div className="status-count">{stats.inProgress}</div>
              <div className="status-label">In Consultation</div>
            </div>
          </div>
          <div className="status-card completed">
            <div className="status-icon">
              <i className="fas fa-check-circle"></i>
            </div>
            <div className="status-info">
              <div className="status-count">{stats.completed}</div>
              <div className="status-label">Completed</div>
            </div>
          </div>
          <div className="status-card total">
            <div className="status-icon">
              <i className="fas fa-list-alt"></i>
            </div>
            <div className="status-info">
              <div className="status-count">{stats.total}</div>
              <div className="status-label">Total Today</div>
            </div>
          </div>
        </div>

        {/* Pause Alert */}
        {isPaused && (
          <div className="medical-alert">
            <div className="alert-icon">
              <i className="fas fa-exclamation-triangle"></i>
            </div>
            <div className="alert-content">
              <h4>Queue Paused</h4>
              <p>New patient assignments are temporarily suspended</p>
            </div>
            <button className="alert-action" onClick={handleResumeQueue}>
              Resume Queue
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <div className="dashboard-content">
          {/* Left Sidebar - Quick Actions */}
          <div className="sidebar">
            <div className="sidebar-section">
              <h3>Quick Actions</h3>
              <div className="action-buttons">
                <button className="sidebar-btn primary">
                  <i className="fas fa-sync-alt"></i>
                  Refresh Data
                </button>
                <button className="sidebar-btn secondary">
                  <i className="fas fa-print"></i>
                  Print Queue
                </button>
              </div>
            </div>

            <div className="sidebar-section">
              <h3>Auto Assist</h3>
              <div className="toggle-section">
                <label className="medical-toggle">
                  <input
                    type="checkbox"
                    checked={autoAssistEnabled}
                    onChange={(e) => setAutoAssistEnabled(e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                  <span className="toggle-label">Enable Auto Reassign</span>
                </label>
                <p className="toggle-description">
                  Automatically reassign patients waiting longer than 30 minutes
                </p>
              </div>
            </div>

            <div className="sidebar-section">
              <h3>Queue Stats</h3>
              <div className="stats-list">
                <div className="stat-item">
                  <span className="stat-name">Average Wait Time</span>
                  <span className="stat-value">18 min</span>
                </div>
                <div className="stat-item">
                  <span className="stat-name">Consultation Time</span>
                  <span className="stat-value">12 min</span>
                </div>
                <div className="stat-item">
                  <span className="stat-name">Patient Satisfaction</span>
                  <span className="stat-value">94%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Main Queue Area */}
          <div className="main-content">
            {/* Search and Filters */}
            <div className="content-header">
              <div className="search-box">
                <i className="fas fa-search"></i>
                <input
                  type="text"
                  placeholder="Search patients by name or token number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="filter-options">
                <span className="results-count">
                  {filteredQueue.length} patients found
                </span>
                <div className="view-toggles">
                  <button className="view-toggle active">
                    <i className="fas fa-list"></i>
                  </button>
                  <button className="view-toggle">
                    <i className="fas fa-grid"></i>
                  </button>
                </div>
              </div>
            </div>

            {/* Patient Queue */}
            <div className="patient-queue">
              {filteredQueue.map((patient, index) => (
                <div key={patient.id} className="patient-card">
                  <div className="card-header">
                    <div className="patient-token">
                      <span className="token-number">#{patient.token_number}</span>
                      <span className="appointment-time">{patient.time_slot}</span>
                    </div>
                    <div className="patient-status">
                      <StatusBadge status={patient.status} />
                      <AppointmentType type={patient.booking_type || 'appointment'} />
                    </div>
                  </div>

                  <div className="card-body">
                    <div className="patient-info">
                      <div className="patient-avatar">
                        <i className="fas fa-user-injured"></i>
                      </div>
                      <div className="patient-details">
                        <h4 className="patient-name">{patient.patient_name}</h4>
                        <div className="patient-meta">
                          <span className="patient-age">
                            <i className="fas fa-birthday-cake"></i>
                            {patient.patient_age || 'N/A'} years
                          </span>
                          <span className="patient-gender">
                            <i className="fas fa-venus-mars"></i>
                            {patient.gender || 'Not specified'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {patient.priority && (
                      <div className="priority-indicator">
                        <PriorityTag priority={patient.priority} />
                      </div>
                    )}
                  </div>

                  <div className="card-footer">
                    <div className="action-buttons">
                      <button
                        className="action-btn consult-btn"
                        onClick={() => handleStartConsultation(patient)}
                        disabled={patient.status === 'inprogress' || patient.status === 'completed'}
                      >
                        <i className="fas fa-play-circle"></i>
                        Start Consult
                      </button>
                      <div className="secondary-actions">
                        <button 
                          className="icon-btn reassign"
                          onClick={() => openModal('reassign', patient)}
                          title="Reassign Doctor"
                        >
                          <i className="fas fa-exchange-alt"></i>
                        </button>
                        <button 
                          className="icon-btn noshow"
                          onClick={() => openModal('noshow', patient)}
                          title="Mark as No-Show"
                        >
                          <i className="fas fa-user-times"></i>
                        </button>
                        <div className="move-buttons">
                          <button 
                            className="move-btn" 
                            onClick={() => handleMove(patient.token_number, 'up')}
                            disabled={index === 0}
                            title="Move Up"
                          >
                            <i className="fas fa-arrow-up"></i>
                          </button>
                          <button 
                            className="move-btn"
                            onClick={() => handleMove(patient.token_number, 'down')}
                            disabled={index === filteredQueue.length - 1}
                            title="Move Down"
                          >
                            <i className="fas fa-arrow-down"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Medical Style Modals */}

      {/* Reassignment Modal */}
      {modalState.type === 'reassign' && (
        <div className="medical-modal show">
          <div className="modal-backdrop" onClick={closeModal}></div>
          <div className="modal-container">
            <div className="modal-header">
              <i className="fas fa-exchange-alt"></i>
              <h2>Reassign Patient</h2>
              <button className="modal-close" onClick={closeModal}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="modal-body">
              <div className="patient-info-card">
                <div className="patient-avatar large">
                  <i className="fas fa-user-injured"></i>
                </div>
                <div className="patient-details">
                  <h3>{modalState.data?.patient_name}</h3>
                  <p>Token #{modalState.data?.token_number}</p>
                </div>
              </div>

              <div className="doctor-selection">
                <h4>Select New Doctor</h4>
                <div className="doctors-list">
                  {availableDoctors.map(doc => (
                    <div
                      key={doc.id}
                      className={`doctor-card ${selectedDoctorId === doc.id ? 'selected' : ''}`}
                      onClick={() => setSelectedDoctorId(doc.id)}
                    >
                      <div className="doctor-avatar">
                        <i className="fas fa-user-md"></i>
                      </div>
                      <div className="doctor-info">
                        <h5>{doc.full_name}</h5>
                        <p>{doc.specialty}</p>
                        <span className="availability available">Available</span>
                      </div>
                      {selectedDoctorId === doc.id && (
                        <div className="selection-check">
                          <i className="fas fa-check"></i>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={closeModal}>Cancel</button>
              <button 
                className="btn btn-primary" 
                onClick={handleReassign} 
                disabled={!selectedDoctorId}
              >
                <i className="fas fa-check"></i>
                Confirm Reassignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* No-Show Modal */}
      {modalState.type === 'noshow' && (
        <div className="medical-modal show">
          <div className="modal-backdrop" onClick={closeModal}></div>
          <div className="modal-container">
            <div className="modal-header warning">
              <i className="fas fa-exclamation-triangle"></i>
              <h2>Mark as No-Show</h2>
              <button className="modal-close" onClick={closeModal}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="modal-body">
              <div className="warning-alert">
                <div className="warning-icon">
                  <i className="fas fa-exclamation-circle"></i>
                </div>
                <div className="warning-content">
                  <h4>Important Notice</h4>
                  <p>Marking a patient as no-show will be recorded in their medical history and may affect future appointment privileges.</p>
                </div>
              </div>

              <div className="patient-info-card">
                <div className="patient-avatar large warning">
                  <i className="fas fa-user-injured"></i>
                </div>
                <div className="patient-details">
                  <h3>{modalState.data?.patient_name}</h3>
                  <p>Token #{modalState.data?.token_number}</p>
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={closeModal}>Cancel</button>
              <button className="btn btn-danger" onClick={handleNoShow}>
                <i className="fas fa-user-times"></i>
                Confirm No-Show
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Walk-in Modal */}
      {modalState.type === 'walkin' && (
        <div className="medical-modal show">
          <div className="modal-backdrop" onClick={closeModal}></div>
          <div className="modal-container">
            <div className="modal-header">
              <i className="fas fa-user-plus"></i>
              <h2>Add Walk-in Patient</h2>
              <button className="modal-close" onClick={closeModal}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>
                    <i className="fas fa-user"></i>
                    Patient Name
                  </label>
                  <input 
                    type="text" 
                    placeholder="Enter full name"
                    value={walkinName}
                    onChange={e => setWalkinName(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>
                    <i className="fas fa-birthday-cake"></i>
                    Age
                  </label>
                  <input 
                    type="number" 
                    placeholder="Enter age"
                    value={walkinAge}
                    onChange={e => setWalkinAge(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>
                    <i className="fas fa-flag"></i>
                    Priority
                  </label>
                  <select 
                    value={walkinPriority}
                    onChange={e => setWalkinPriority(e.target.value)}
                  >
                    <option value="normal">Normal Priority</option>
                    <option value="emergency">Emergency</option>
                    <option value="vip">VIP</option>
                  </select>
                </div>
                <div className="form-group full-width">
                  <label>
                    <i className="fas fa-stethoscope"></i>
                    Reason for Visit
                  </label>
                  <textarea 
                    placeholder="Brief description of symptoms or reason for visit..."
                    rows="3"
                    value={walkinReason}
                    onChange={e => setWalkinReason(e.target.value)}
                  ></textarea>
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddWalkin}>
                <i className="fas fa-plus"></i>
                Add to Queue
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default QueueManagement;