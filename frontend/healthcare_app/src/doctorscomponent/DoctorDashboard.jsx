// src/components/DoctorDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import './DoctorDashboard.css';
import { 
  FaUserMd, 
  FaUser, 
  FaClock, 
  FaCheckCircle, 
  FaTimesCircle, 
  FaBullhorn,
  FaPause,
  FaPlay,
  FaExclamationTriangle,
  FaWifi,
  FaStethoscope,
  FaList,
  FaChartBar,
  FaCalendarDay,
  FaStopwatch,
  FaCog,
  FaBell,
  FaArrowRight
} from 'react-icons/fa';

const DoctorDashboard = () => {
  const { user } = useAuth();

  const [doctorStatus, setDoctorStatus] = useState('online');
  const [queue, setQueue] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [doctor, setDoctor] = useState(null);
  const [queueStats, setQueueStats] = useState(null);
  const [timer, setTimer] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // ============================
  // FETCH DOCTOR DASHBOARD DATA
  // ============================
  const fetchDashboardData = async () => {
    console.log("📡 API CALL → GET /doctor/dashboard/");
    try {
      setLoading(true);

      const data = await apiService.safeRequest('/doctor/dashboard/');
      console.log("✅ API RESPONSE → /doctor/dashboard/", data);

      const todayAppointments = data.today_appointments || [];

      const queueData = todayAppointments.filter(a =>
        ['waiting', 'in_progress', 'scheduled', 'confirmed'].includes(a.status)
      );

      const upcomingList = todayAppointments.filter(a =>
        ['scheduled', 'confirmed'].includes(a.status)
      );

      setDoctor(data.profile);
      setQueue(queueData);
      setUpcoming(upcomingList);
      setQueueStats(data.current_queue);

    } catch (err) {
      console.error("❌ API ERROR → /doctor/dashboard/", err);
    } finally {
      setLoading(false);
    }
  };

  const getActiveAppointment = () => {
    if (!queueStats?.current_token) {
      return queue.find(a => ['in_progress', 'waiting'].includes(a.status));
    }
    return queue.find(a => a.token_number === queueStats.current_token);
  };

  // ============================
  // START CONSULTATION
  // ============================
  const handleCallNext = async () => {
    const next = queue.find(a =>
      ['scheduled', 'confirmed', 'waiting'].includes(a.status)
    );

    if (!next) return alert("No next patient.");

    console.log("📡 API CALL → START CONSULTATION for ID:", next.id);

    try {
      const res = await apiService.safeRequest(`/appointments/${next.id}/start_consultation/`, {
        method: "POST"
      });

      console.log("✅ API RESPONSE → start_consultation", res);

      alert(`Token #${next.token_number} now in consultation.`);
      fetchDashboardData();
      setTimer(0);
    } catch (err) {
      console.error("❌ API ERROR → start_consultation", err);
      alert("Failed to start consultation.");
    }
  };

  // ============================
  // END CONSULTATION + AUTO CALL NEXT
  // ============================
  const handleEndConsultation = async () => {
    const active = getActiveAppointment();
    if (!active) return alert("No active consultation.");

    console.log("📡 API CALL → END CONSULTATION for ID:", active.id);

    try {
      const res = await apiService.safeRequest(
        `/appointments/${active.id}/end_consultation/`,
        {
          method: "POST",
          body: JSON.stringify({
            notes: "Consultation completed successfully."
          })
        }
      );

      console.log("✅ API RESPONSE → end_consultation", res);

      // Reset timer and refresh dashboard
      setTimer(0);
      await fetchDashboardData();

      // 🚀 AUTO CALL NEXT PATIENT
      handleCallNext();

    } catch (err) {
      console.error("❌ API ERROR → end_consultation", err);
      alert("Could not end consultation.");
    }
  };

  // ============================
  // MARK NO-SHOW + AUTO CALL NEXT
  // ============================
  const handleMarkNoShow = async () => {
    const active = getActiveAppointment();
    if (!active) return alert("No active patient.");

    console.log("📡 API CALL → MARK NO-SHOW for ID:", active.id);

    try {
      const res = await apiService.endConsultation(active.id, {
        no_show: true,
        notes: "Patient marked as no-show."
      });

      console.log("✅ API RESPONSE → no-show", res);

      await fetchDashboardData();
      handleCallNext();
    } catch (err) {
      console.error("❌ API ERROR → no-show", err);
      alert("Cannot mark no-show.");
    }
  };

  // ============================
  // AVAILABILITY STATUS
  // ============================
  const handleStatusChange = async (status) => {
    setDoctorStatus(status);

    const payload = {
      day_of_week: new Date().toLocaleDateString("en-US", { weekday: "long" }).toLowerCase(),
      start_time: "09:00",
      end_time: "17:00",
      is_available: status === "online",
      is_active: status === "online",
    };

    console.log("📡 API CALL → UPDATE AVAILABILITY", payload);

    try {
      const res = await apiService.updateDoctorAvailability(payload);
      console.log("✅ API RESPONSE → updateDoctorAvailability", res);
    } catch (err) {
      console.error("❌ API ERROR → updateDoctorAvailability", err);
    }
  };

  const handlePauseTokens = async () => {
    console.log("📡 API CALL → PAUSE TOKENS");

    try {
      const res = await apiService.safeRequest('/doctor/availability/', {
        method: 'POST',
        body: JSON.stringify({ is_available: false, is_active: false })
      });

      console.log("✅ API RESPONSE → pause tokens", res);

      setDoctorStatus("paused");
      alert("Doctor paused accepting tokens.");
    } catch (err) {
      console.error("❌ API ERROR → pause tokens", err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setTimer((p) => p + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="doctor-dashboard-loading">
        <div className="loading-spinner-large"></div>
        <h2>Loading Your Dashboard...</h2>
        <p>Preparing your daily schedule and patient queue</p>
      </div>
    );
  }

  const activeAppointment = getActiveAppointment();
  const tooManyPatients = queue.length > 5;

  return (
    <div className="doctor-dashboard">
      {/* Header Section */}
      <div className="dashboard-header">
        <div className="container">
          <div className="header-content">
            <div className="doctor-profile">
              <div className="doctor-avatar-large">
                <FaUserMd />
              </div>
              <div className="doctor-info">
                <h1>Dr. {doctor?.full_name}</h1>
                <p className="specialty">{doctor?.specialty || "General Physician"}</p>
                <div className="doctor-meta">
                  <div className="meta-item">
                    <FaClock className="meta-icon" />
                    <span>Shift: 9:00 AM – 5:00 PM</span>
                  </div>
                  <div className="meta-item">
                    <FaCalendarDay className="meta-icon" />
                    <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="status-controls">
              <div className="status-indicator">
                <div className={`status-dot ${doctorStatus}`}></div>
                <span className="status-text">
                  {doctorStatus === 'online' ? 'Accepting Tokens' : 
                   doctorStatus === 'paused' ? 'Paused' : 'On Break'}
                </span>
              </div>
              
              <div className="status-buttons">
                <button 
                  className={`status-btn ${doctorStatus === 'online' ? 'active' : ''}`}
                  onClick={() => handleStatusChange('online')}
                >
                  <FaPlay className="btn-icon" />
                  Online
                </button>
                <button 
                  className={`status-btn ${doctorStatus === 'paused' ? 'active' : ''}`}
                  onClick={() => handleStatusChange('paused')}
                >
                  <FaPause className="btn-icon" />
                  Pause
                </button>
                <button 
                  className={`status-btn ${doctorStatus === 'break' ? 'active' : ''}`}
                  onClick={() => handleStatusChange('break')}
                >
                  <FaClock className="btn-icon" />
                  Break
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="dashboard-content">
          {/* Main Content - Left Side */}
          <div className="dashboard-main">
            {/* Current Consultation Card */}
            <div className="dashboard-card current-consultation">
              <div className="card-header">
                <h2>Now Serving</h2>
                <div className="consultation-timer">
                  <FaStopwatch className="timer-icon" />
                  {formatTime(timer)}
                </div>
              </div>

              <div className="current-patient-info">
                <div className="patient-avatar">
                  <FaUser />
                </div>
                <div className="patient-details">
                  <div className="token-display">
                    <span className="token-label">Token</span>
                    <span className="token-number">#{activeAppointment?.token_number || "—"}</span>
                  </div>
                  <h3 className="patient-name">{activeAppointment?.patient_name || "No Active Patient"}</h3>
                  
                  <div className="patient-meta">
                    <div className="meta-row">
                      <span className="meta-label">Reason:</span>
                      <span className="meta-value">{activeAppointment?.reason || "—"}</span>
                    </div>
                    <div className="meta-row">
                      <span className="meta-label">Time Slot:</span>
                      <span className="meta-value">{activeAppointment?.time_slot || "—"}</span>
                    </div>
                    <div className="meta-row">
                      <span className="meta-label">Status:</span>
                      <span className={`status-tag ${activeAppointment?.status || 'waiting'}`}>
                        {activeAppointment?.status || "—"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="consultation-actions">
                <button className="btn btn-success" onClick={handleEndConsultation}>
                  <FaCheckCircle className="btn-icon" />
                  End Consultation
                </button>
                <button className="btn btn-danger" onClick={handleMarkNoShow}>
                  <FaTimesCircle className="btn-icon" />
                  Mark No-Show
                </button>
              </div>
            </div>

            {/* Queue List */}
            <div className="dashboard-card queue-section">
              <div className="card-header">
                <h2>Today's Queue</h2>
                <div className="queue-count">{queue.length} Patients</div>
              </div>

              <div className="queue-list">
                {queue.map((appt, index) => (
                  <div className={`queue-item ${appt.status === 'in_progress' ? 'active' : ''}`} key={appt.id}>
                    <div className="queue-position">{index + 1}</div>
                    <div className="queue-patient-info">
                      <div className="patient-token">#{appt.token_number}</div>
                      <div className="patient-name">{appt.patient_name}</div>
                      <div className="appointment-reason">{appt.reason}</div>
                    </div>
                    <div className="queue-meta">
                      <div className="appointment-time">{appt.time_slot}</div>
                      <div className={`status-badge status-${appt.status}`}>
                        {appt.status.replace('_', ' ')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Workload Warning */}
            {tooManyPatients && (
              <div className="workload-warning">
                <div className="warning-header">
                  <FaExclamationTriangle className="warning-icon" />
                  <h3>High Queue Load</h3>
                </div>
                <p>Queue length is high. Consider pausing new tokens or requesting assistance.</p>
                <div className="warning-actions">
                  <button className="btn btn-warning" onClick={handlePauseTokens}>
                    <FaPause className="btn-icon" />
                    Pause New Tokens
                  </button>
                  <button className="btn btn-outline">
                    <FaUserMd className="btn-icon" />
                    Request Assistance
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - Right Side */}
          <div className="dashboard-sidebar">
            {/* Quick Stats */}
            <div className="dashboard-card stats-card">
              <div className="card-header">
                <h2>Today's Stats</h2>
                <FaChartBar className="card-icon" />
              </div>
              <div className="stats-grid">
                <div className="stat-item">
                  <div className="stat-value">{queue.length}</div>
                  <div className="stat-label">In Queue</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{queueStats?.completed_tokens || 0}</div>
                  <div className="stat-label">Completed</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">
                    {queueStats?.average_time_per_patient || "—"}
                  </div>
                  <div className="stat-label">Avg Time (min)</div>
                </div>
              </div>
            </div>

            {/* Upcoming Patients */}
            <div className="dashboard-card upcoming-card">
              <div className="card-header">
                <h2>Upcoming Patients</h2>
                <FaList className="card-icon" />
              </div>
              <div className="upcoming-list">
                {upcoming.map((patient) => (
                  <div className="upcoming-patient" key={patient.id}>
                    <div className="upcoming-avatar">
                      <FaUser />
                    </div>
                    <div className="upcoming-info">
                      <div className="upcoming-name">{patient.patient_name}</div>
                      <div className="upcoming-time">#{patient.token_number} • {patient.time_slot}</div>
                    </div>
                    <FaArrowRight className="arrow-icon" />
                  </div>
                ))}
              </div>
            </div>

            {/* Call Next Button */}
            <div className="call-next-section">
              <button className="call-next-btn" onClick={handleCallNext}>
                <FaBullhorn className="btn-icon" />
                Call Next Patient
              </button>
            </div>

            {/* Quick Actions */}
            <div className="dashboard-card quick-actions">
              <div className="card-header">
                <h2>Quick Actions</h2>
                <FaCog className="card-icon" />
              </div>
              <div className="actions-grid">
                <button className="action-btn">
                  <FaStethoscope className="action-icon" />
                  <span>Medical Records</span>
                </button>
                <button className="action-btn">
                  <FaBell className="action-icon" />
                  <span>Notifications</span>
                </button>
                <button className="action-btn">
                  <FaCalendarDay className="action-icon" />
                  <span>Schedule</span>
                </button>
                <button className="action-btn">
                  <FaChartBar className="action-icon" />
                  <span>Reports</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Network Status */}
      <div className={`network-status ${isOffline ? 'show' : ''}`}>
        <FaWifi className="status-icon" />
        <span>Offline mode — waiting for connection...</span>
      </div>
    </div>
  );
};

export default DoctorDashboard;