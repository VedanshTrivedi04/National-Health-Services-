// src/pages/DoctorQueue.jsx
import React, { useEffect, useState } from "react";
import "./DoctorQueue.css";
import { useData } from "../../contexts/DataContext";
import apiService from "../../services/api";

const DoctorQueue = () => {
  const { doctors, fetchDoctors } = useData();
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [queueData, setQueueData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load doctors on mount
  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  const fetchQueue = async (doctorId) => {
    if (!doctorId) return;

    setLoading(true);

    try {
      const today = new Date().toISOString().split("T")[0];

      const data = await apiService.safeRequest(
        `/queue/status/?doctor=${doctorId}&date=${today}`
      );

      console.log("🔥 RAW API:", data);

      // Your API returns array[] so take first element
      const queue = Array.isArray(data) ? data[0] : data;

      console.log("📌 Stored queueData:", queue);

      setQueueData(queue || null);
    } catch (error) {
      console.error("❌ Queue fetch error:", error);
      setQueueData(null);
    } finally {
      setLoading(false);
    }
  };

  // Auto refresh
  useEffect(() => {
    if (!selectedDoctor) return;

    fetchQueue(selectedDoctor.id);
    const interval = setInterval(
      () => fetchQueue(selectedDoctor.id),
      3000
    );

    return () => clearInterval(interval);
  }, [selectedDoctor]);

  return (
    <div className="queue-page">
      <h1 className="queue-title">Doctor Wise Live Queue</h1>

      {/* Doctor List */}
      <div className="doctor-list-box">
        {doctors.map((doc) => (
          <div
            key={doc.id}
            className={`doctor-card ${selectedDoctor?.id === doc.id ? "active" : ""}`}
            onClick={() => setSelectedDoctor(doc)}
          >
            <div className="doc-avatar">👨‍⚕️</div>
            <div className="doc-info">
              <h3>{doc.full_name}</h3>
              <p>{doc.department_name}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Queue Display */}
      <div className="queue-display">
        {!selectedDoctor && (
          <p className="empty-text">Select a doctor to view queue</p>
        )}

        {selectedDoctor && loading && <p className="loading">Loading queue...</p>}

        {selectedDoctor && queueData && (
          <>
            {/* Main Queue Card */}
            <div className="queue-card">
              <h2>{queueData.doctor_name}</h2>

              <div className="queue-stats">
                <div className="stat-item">
                  <label>Now Serving</label>
                  <span className="current-token">
                    {queueData.current_token || "—"}
                  </span>
                </div>

                <div className="stat-item">
                  <label>Total Booked</label>
                  <span>{queueData.total_tokens}</span>
                </div>

                <div className="stat-item">
                  <label>Completed</label>
                  <span>{queueData.completed_tokens}</span>
                </div>

                <div className="stat-item">
                  <label>Avg Time</label>
                  <span>{queueData.average_time_per_patient || 0} min</span>
                </div>
              </div>

              <p className="update-time">
                Last Updated:{" "}
                {new Date(queueData.last_updated).toLocaleTimeString()}
              </p>
            </div>

            {/* ⭐ PENDING TOKENS SECTION ⭐ */}
            <div className="pending-section">
              <h3>Pending Tokens</h3>

              {queueData.pending_tokens?.length > 0 ? (
                <div className="pending-list">
                  {queueData.pending_tokens.map((item, index) => (
                    <div key={index} className="pending-card">
                      <div className="token-number">
                        Token: <strong>{item.token_number}</strong>
                      </div>
                      <div className="patient-name">
                        Patient: {item.patient_name}
                      </div>
                      <div className="queue-pos">
                        Position: {item.queue_position}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-text">No pending patients</p>
              )}
            </div>
          </>
        )}

        {selectedDoctor && !queueData && !loading && (
          <p className="empty-text">No queue data found for this doctor.</p>
        )}
      </div>
    </div>
  );
};

export default DoctorQueue;
