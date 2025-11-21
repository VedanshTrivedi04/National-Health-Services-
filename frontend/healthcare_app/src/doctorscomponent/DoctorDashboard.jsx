// src/components/DoctorDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import './DoctorDashboard.css';


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
  // END CONSULTATION
  // ============================
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
  // MARK NO-SHOW
  // ============================
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


  if (loading) return <div className="loading-screen">Loading dashboard...</div>;

  const statusMap = {
    online: { cls: 'status-online', text: 'Accepting Tokens', icon: 'fas fa-circle' },
    paused: { cls: 'status-offline', text: 'Paused', icon: 'fas fa-circle' },
    break: { cls: 'status-break', text: 'On Break', icon: 'fas fa-circle' }
  };

  const s = statusMap[doctorStatus];
  const tooManyPatients = queue.length > 5;
  return (
    <>
      {/* HEADER */}
      <div className="container">
        <div className="doctor-header">
          <div className="doctor-info">
            <div className="doctor-avatar"><i className="fas fa-user-md"></i></div>
            <div className="doctor-details">
              <h1>{doctor?.full_name}</h1>
              <p>{doctor?.specialty}</p>
              <p><i className="far fa-clock"></i> Shift: 9:00 AM – 5:00 PM</p>
              <div className={`status-badge ${s.cls}`}>
                <i className={s.icon}></i> {s.text}
              </div>
            </div>
          </div>

          <div className="status-toggle">
            {["online", "paused", "break"].map((state) => (
              <button
                key={state}
                onClick={() => handleStatusChange(state)}
                className={`toggle-btn ${doctorStatus === state ? "active" : ""}`}
              >
                {state.charAt(0).toUpperCase() + state.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* MAIN DASHBOARD */}
      <div className="container">
        <div className="dashboard">

          {/* LEFT — NOW SERVING + QUEUE */}
          <div className="dashboard-main">

            {/* NOW SERVING */}
            <div className="dashboard-card now-serving">
              <div className="card-header">
                <h2 className="card-title" style={{ color: 'white' }}>Now Serving</h2>
                <div className="consultation-timer">{formatTime(timer)}</div>
              </div>

              <div className="current-patient">
                <div className="patient-avatar"><i className="fas fa-user"></i></div>

                <div className="patient-details">
                  <h3>Token N0   {getActiveAppointment()?.
                    token_number
                    || "—"}</h3>

                  {/* Patient Name */}
                  <p><strong>Patient:</strong> {getActiveAppointment()?.patient_name || "—"}</p>

                  {/* Reason for visit */}
                  <p><strong>Reason:</strong> {getActiveAppointment()?.reason || "—"}</p>

                  {/* Appointment Time */}
                  <p><strong>Time:</strong> {getActiveAppointment()?.time_slot || "—"}</p>

                  {/* Status */}
                  <p><strong>Status:</strong> {getActiveAppointment()?.status || "—"}</p>

                  {/* Completed count */}
                  <p><strong>Patients Served:</strong> {queueStats?.completed_tokens || 0}</p>
                </div>
              </div>

              <div className="consultation-actions">
                <button className="btn btn-secondary" onClick={handleEndConsultation}>
                  <i className="fas fa-check-circle"></i> End Consultation
                </button>
                <button className="btn btn-danger" onClick={handleMarkNoShow}>
                  <i className="fas fa-times-circle"></i> No-Show
                </button>
              </div>
            </div>

            {/* QUEUE LIST */}
            <div className="dashboard-card">
              <div className="card-header">
                <h2>Today's Queue</h2>
                <div className="queue-count">{queue.length} Patients</div>
              </div>

              <div className="queue-list">
                {queue.map((appt) => (
                  <div className="queue-item" key={appt.id}>
                    <div className="token-info">
                      <div className="token-number">{appt.token_number}</div>
                      <div className="patient-brief">
                        <div className="patient-name">{appt.patient_name}</div>
                        <div className="appointment-type">{appt.reason}</div>
                      </div>
                    </div>
                    <div className="queue-status">
                      <div className="eta">{appt.time_slot}</div>
                      <div className={`status-label status-${appt.status}`}>{appt.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {tooManyPatients && (
              <div className="workload-warning show">
                <div className="warning-header">
                  <i className="fas fa-exclamation-triangle"></i>
                  <h3>High Queue Load</h3>
                </div>
                <p>Queue is too long. You may pause or request assistance.</p>

                <div className="warning-actions">
                  <button className="btn btn-warning" onClick={handlePauseTokens}>
                    <i className="fas fa-pause"></i> Pause Tokens
                  </button>
                  <button className="btn btn-outline">
                    <i className="fas fa-user-md"></i> Request Help
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* RIGHT — UPCOMING + STATS */}
          <div className="dashboard-sidebar">

            {/* UPCOMING PATIENTS */}
            <div className="dashboard-card">
              <div className="card-header"><h2>Upcoming Patients</h2></div>

              <div className="upcoming-patients">
                {upcoming.map((p) => (
                  <div className="upcoming-patient" key={p.id}>
                    <div className="upcoming-patient-info">
                      <div className="upcoming-patient-avatar"><i className="fas fa-user"></i></div>
                      <div>
                        <div className="patient-name">{p.patient_name}</div>
                        <div className="appointment-type">
                          {p.token_number} • {p.time_slot}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* QUICK STATS */}
            <div className="dashboard-card">
              <div className="card-header"><h2>Quick Stats</h2></div>

              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-value">{queue.length}</div>
                  <div className="stat-label">Waiting</div>
                </div>

                <div className="stat-card">
                  <div className="stat-value">{queueStats?.completed_tokens || 0}</div>
                  <div className="stat-label">Completed</div>
                </div>

                <div className="stat-card">
                  <div className="stat-value">
                    {queueStats?.average_time_per_patient || "N/A"} min
                  </div>
                  <div className="stat-label">Avg Time</div>
                </div>
              </div>
            </div>

            {/* CALL NEXT BUTTON */}
            <div className="call-next-container">
              <button className="call-next-btn" onClick={handleCallNext}>
                <i className="fas fa-bullhorn"></i> Call Next Patient
              </button>
            </div>

          </div>

        </div>
      </div>

      <div className={`network-status ${isOffline ? 'show' : ''}`}>
        <i className="fas fa-wifi"></i>
        <span>Offline mode — waiting for connection...</span>
      </div>
    </>
  );
};

export default DoctorDashboard;
