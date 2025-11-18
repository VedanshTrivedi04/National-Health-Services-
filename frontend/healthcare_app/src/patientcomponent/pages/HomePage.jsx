import React, { useEffect,useState } from 'react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const HomePage = () => {
  const { user, isAuthenticated } = useAuth();
  const { departments, doctors, fetchDepartments, fetchDoctors, isLoading, error } = useData();
  const navigate = useNavigate();
  useEffect(() => {
  const loadQueue = async () => {
    try {
      const doctorId = 1; // or dynamically load from patient appointment
      const result = await apiService.getQueueStatus(doctorId);

      setQueue(result);
      setHighlightToken(result.patient_token);
    } catch (err) {
      console.log("Queue fetch failed", err);
    }
  };

  loadQueue();
  const interval = setInterval(loadQueue, 3000);
  return () => clearInterval(interval);
}, []);


  // ✅ Redirect if user has dashboard
  useEffect(() => {
    if (isAuthenticated && user?.dashboard_url) {
      navigate(user.dashboard_url, { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  // ✅ Fetch departments & doctors on mount (both for public and logged-in users)
  useEffect(() => {
    fetchDepartments();
    fetchDoctors();
  }, [isAuthenticated, fetchDepartments, fetchDoctors]);

  // ✅ Debug logs (optional)
  useEffect(() => {
    console.log("Departments:", departments);
    console.log("Doctors:", doctors);
  }, [departments, doctors]);
  const [queue, setQueue] = useState(null);
const [highlightToken, setHighlightToken] = useState(null);



  return (
    <>
      {/* Hero Section */}
      <section className="hero">
        <div className="container hero-content">
          <div className="hero-text">
            <h1>Welcome to Our Hospital</h1>
            <p>Book appointments, consult doctors, and manage your health easily.</p>
            <div className="hero-buttons">
              <button
                className="hero-btn btn-primary"
                onClick={() => navigate('/appointment')}
              >
                Book Appointment
              </button>

            </div>
          </div>
          <div className="hero-image">
            <div className="hero-img-placeholder">🏥</div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="section">
        <div className="container">
          <div className="section-title">
            <h2>Our Services</h2>
            <p>We provide a wide range of medical services for all your health needs.</p>
          </div>
          <div className="services-grid">
            <div className="service-card">
              <div className="service-icon">🩺</div>
              <h3>General Consultation</h3>
              <p>Consult with top specialists for all your general health concerns.</p>
            </div>
            <div className="service-card">
              <div className="service-icon">💉</div>
              <h3>Vaccination</h3>
              <p>Stay protected with a wide range of vaccines for all age groups.</p>
            </div>
            <div className="service-card">
              <div className="service-icon">🏥</div>
              <h3>Emergency Care</h3>
              <p>24/7 emergency services available for urgent medical needs.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Announcements */}
      <section className="announcements">
        <div className="container announcement-container">
          <span className="announcement-label">Notice</span>
          <div className="announcement-text">
            <marquee>COVID-19 vaccination drive ongoing. Book your slot now!</marquee>
          </div>
        </div>
      </section>
      <div className="queue-box">
        <h3>Live Queue Status</h3>

        <div className="current-token">
          <span>Now Serving:</span>
          <strong>{queue?.current_token ?? "—"}</strong>
        </div>

        <div className="pending-list">
          <h4>Pending Tokens</h4>

          {queue?.pending_tokens?.length > 0 ? (
            queue.pending_tokens.map(item => (
              <div
                key={item.token_number}
                className={`token-item ${highlightToken === item.token_number ? "highlight" : ""
                  }`}
              >
                <span className="token-num">Token {item.token_number}</span>
                <span className="token-name">{item.patient_name}</span>
              </div>
            ))
          ) : (
            <p>No pending tokens</p>
          )}
        </div>
      </div>

      {/* ✅ Doctors Section */}
      <section className="doctors-section section">
        <div className="container">
          <div className="section-title">
            <h2>Our Doctors</h2>
            <p>Meet our experienced medical professionals.</p>
          </div>

          {isLoading ? (
            <div className="loading">
              <i className="fas fa-spinner fa-spin"></i>
              <p>Loading doctors...</p>
            </div>
          ) : error ? (
            <div className="error-message">{error}</div>
          ) : doctors && doctors.length > 0 ? (
            <div className="doctors-slider">
              {doctors.map((doc) => {
                // ✅ Safely extract fields depending on backend structure
                const name =
                  doc.full_name ||
                  doc.user?.full_name ||
                  `${doc.user?.first_name || ''} ${doc.user?.last_name || ''}`.trim() ||
                  'Doctor Name';

                const department =
                  doc.department_name ||
                  doc.department?.name ||
                  'General';

                const image = doc.profile_image || '👨‍⚕️';

                return (
                  <div className="doctor-card" key={doc.id || name}>
                    <div className="doctor-img">{image}</div>
                    <div className="doctor-info">
                      <h3>{name}</h3>
                      <div className="doctor-specialty">{department}</div>
                      <div className="doctor-rating">⭐ 4.5</div>
                      <div className="doctor-availability">
                        <span>Mon-Fri</span>
                        <span>10am - 6pm</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p>No doctors found.</p>
          )}
        </div>
      </section>

      {/* How It Works */}
      <section className="section">
        <div className="container">
          <div className="section-title">
            <h2>How It Works</h2>
          </div>
          <div className="steps">
            <div className="step">
              <div className="step-number">1</div>
              <h3>Register</h3>
              <p>Create an account to access all our services.</p>
            </div>
            <div className="step">
              <div className="step-number">2</div>
              <h3>Book Appointment</h3>
              <p>Choose your doctor and schedule an appointment easily.</p>
            </div>
            <div className="step">
              <div className="step-number">3</div>
              <h3>Consult</h3>
              <p>Meet the doctor online or in-person and get the treatment.</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};
// latestfile
export default HomePage;
