// src/pages/HomePage.jsx
import React, { useEffect, useState, useCallback } from "react";
import { useData } from "../../contexts/DataContext";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import apiService from "../../services/api";
import "./HomePage.css";
import { 
  FaStethoscope, 
  FaSyringe, 
  FaAmbulance, 
  FaBell, 
  FaCheck, 
  FaStar, 
  FaClock,
  FaUserMd,
  FaArrowRight,
  FaTimes,
  FaCalendarAlt,
  FaHeartbeat
} from "react-icons/fa";

const HomePage = () => {
  const { user, isAuthenticated } = useAuth();
  const [showNotifPopup, setShowNotifPopup] = useState(false);

  const navigate = useNavigate();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [averageRating, setAverageRating] = useState(0);

  // Queue States
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [doctorReviews, setDoctorReviews] = useState([]);

  const [queue, setQueue] = useState(null);
  const [highlightToken, setHighlightToken] = useState(null);
  const [myTokenNumber, setMyTokenNumber] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  // Data Context
  const { departments, doctors, fetchDepartments, fetchDoctors, isLoading, error } = useData();

  // open review modal and fetch reviews
  const openReviewModal = async (doctor) => {
    setSelectedDoctor(doctor);
    setReviewModalOpen(true);

    try {
      const res = await apiService.getDoctorReviews(doctor.id);
      const reviews = Array.isArray(res) ? res : (res.results || []);
      setDoctorReviews(reviews);

      // ⭐ Calculate average rating
      if (reviews.length > 0) {
        const avg =
          reviews.reduce((sum, r) => sum + Number(r.rating), 0) / reviews.length;
        setAverageRating(avg.toFixed(1));
      } else {
        setAverageRating(0);
      }

    } catch (error) {
      console.error("Failed to load doctor reviews:", error);
      setDoctorReviews([]);
      setAverageRating(0);
    }
  };

  const closeReviewModal = () => {
    setReviewModalOpen(false);
    setSelectedDoctor(null);
    setDoctorReviews([]);
    setRating(0);
    setComment("");
  };

  const handleSubmitReview = async () => {
    if (!rating) {
      alert("Please select a star rating.");
      return;
    }
    if (!selectedDoctor?.id) {
      alert("No doctor selected.");
      return;
    }

    try {
      // call helper that posts to: POST /api/doctors/:id/reviews/add/
      await apiService.addDoctorReview(selectedDoctor.id, {
        rating,
        comment,
      });

      // Refresh list (handle paginated or plain array)
      const refreshed = await apiService.getDoctorReviews(selectedDoctor.id);
      const reviews = Array.isArray(refreshed) ? refreshed : (refreshed.results || []);
      setDoctorReviews(reviews);

      // Clear form
      setRating(0);
      setComment("");

      alert("Review submitted successfully!");
    } catch (error) {
      console.error("Review submission failed:", error);
      alert("Failed to submit review.");
    }
  };

  useEffect(() => {
    if (isAuthenticated && user?.dashboard_url) {
      navigate(user.dashboard_url, { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  // Load user token number from localStorage
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("user"));
      if (stored?.token_number) {
        setMyTokenNumber(stored.token_number);
      }
    } catch (e) {
      console.error("Invalid user data");
    }
  }, []);

  // Fetch departments & doctors
  useEffect(() => {
    fetchDepartments();
    fetchDoctors();
  }, [fetchDepartments, fetchDoctors]);

  const loadNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    setNotificationsLoading(true);
    try {
      const response = await apiService.getNotifications();
      const list = Array.isArray(response) ? response : (response?.results || []);
      setNotifications(list);
      setUnreadNotifications(list.filter((n) => !n.is_read).length);
    } catch (error) {
      console.error("Failed to load notifications:", error);
    } finally {
      setNotificationsLoading(false);
    }
  }, [isAuthenticated]);

  const handleMarkNotificationRead = async (id) => {
    try {
      await apiService.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((notif) =>
          notif.id === id ? { ...notif, is_read: true, read_at: new Date().toISOString() } : notif
        )
      );
      setUnreadNotifications((prev) => Math.max(prev - 1, 0));
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await apiService.markAllNotificationsRead();
      setNotifications((prev) =>
        prev.map((notif) => ({ ...notif, is_read: true, read_at: new Date().toISOString() }))
      );
      setUnreadNotifications(0);
    } catch (error) {
      console.error("Failed to mark notifications as read:", error);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    loadNotifications();
    const poll = setInterval(loadNotifications, 20000);
    return () => clearInterval(poll);
  }, [isAuthenticated, loadNotifications]);

  // Debug logs
  useEffect(() => {
    console.log("Departments:", departments);
    console.log("Doctors:", doctors);
  }, [departments, doctors]);

  // -------------------------------
  // 🔥 LIVE QUEUE AUTO-REFRESH
  // -------------------------------
  useEffect(() => {
    if (!isAuthenticated) return;

    const loadQueue = async () => {
      try {
        const data = await apiService.safeRequest("/queue/live/");
        console.log("Queue:", data);
        setQueue(data);

        // Highlight user's token
        const myEntry = data.pending_tokens?.find((t) => t.token_number === myTokenNumber);
        if (myEntry) setHighlightToken(myTokenNumber);

        // 30-minute alert
        if (myEntry && myEntry.eta_minutes <= 30 && !localStorage.getItem("notif_30min")) {
          alert(`🔔 Reminder: Your token (${myTokenNumber}) is expected in ${myEntry.eta_minutes} minutes.`);
          localStorage.setItem("notif_30min", "yes");
        }

        // Now serving alert
        if (data.current_token === myTokenNumber && !localStorage.getItem("notif_nowServing")) {
          alert(`🚨 Your token (${myTokenNumber}) is now being served! Please proceed to the cabin.`);
          localStorage.setItem("notif_nowServing", "yes");
        }
      } catch (err) {
        console.error("Queue fetch failed:", err);
      }
    };

    loadQueue();
    const interval = setInterval(loadQueue, 3000);
    return () => clearInterval(interval);
  }, [isAuthenticated, myTokenNumber]);

  return (
    
    <div className="homepage-container">
      


      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-background">
          <div className="hero-content">
            <div className="hero-text">
              <div className="hero-badge">
                <FaHeartbeat className="badge-icon" />
                <span>Trusted Healthcare</span>
              </div>
              <h1>Your Health is Our <span className="highlight">Priority</span></h1>
              <p>Experience world-class healthcare with our team of expert doctors, advanced facilities, and compassionate care. Your journey to better health starts here.</p>
              <div className="hero-actions">
                <button 
                  className="btn btn-primary hero-btn"
                  onClick={() => navigate("/appointment")}
                >
                  <FaCalendarAlt className="btn-icon" />
                  Book Appointment
                </button>
               
              </div>
              
              
            </div>
            
          </div>
        </div>
      </section>
      

      {/* Live Status Dashboard */}
      <section className="dashboard-section">
        <div className="container">
          <div className="dashboard-grid">
            {/* Queue Status Card */}
            

            {/* Notifications Card */}
            <div className="dashboard-card notifications-card">
              <div className="card-header">
                <h3>Notifications</h3>
                <div className="notifications-actions">
                  {unreadNotifications > 0 && (
                    <span className="unread-badge">{unreadNotifications}</span>
                  )}
                  <button
                    className="btn-icon mark-all-btn"
                    onClick={handleMarkAllNotificationsRead}
                    disabled={notificationsLoading || unreadNotifications === 0}
                    title="Mark all as read"
                  >
                    <FaCheck />
                  </button>
                </div>
              </div>

              <div className="notifications-list">
                {notificationsLoading ? (
                  <div className="loading-state">
                    <div className="loading-spinner"></div>
                    <span>Loading notifications...</span>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">🔔</div>
                    <p>No notifications yet</p>
                  </div>
                ) : (
                  notifications.slice(0, 5).map((notif) => (
                    <div
                      key={notif.id}
                      className={`notification-item ${notif.is_read ? "" : "unread"}`}
                      onClick={() => !notif.is_read && handleMarkNotificationRead(notif.id)}
                    >
                      <div className="notification-icon">
                        <FaBell />
                      </div>
                      <div className="notification-content">
                        <div className="notification-title">{notif.title}</div>
                        <div className="notification-message">{notif.message}</div>
                        <div className="notification-meta">
                          {new Date(notif.created_at).toLocaleString()}
                          {notif.appointment_token && ` • Token ${notif.appointment_token}`}
                        </div>
                      </div>
                      {!notif.is_read && <div className="unread-dot"></div>}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="services-section">
        <div className="container">
          <div className="section-header">
            <h2>Our Medical Services</h2>
            <p>Comprehensive healthcare services for you and your family</p>
          </div>

          <div className="services-grid">
            <div className="service-card">
              <div className="service-icon-wrapper">
                <FaStethoscope className="service-icon" />
              </div>
              <h3>General Consultation</h3>
              <p>Consult with our experienced specialists for comprehensive health assessments and personalized treatment plans.</p>
              <button className="service-link">
                Learn More <FaArrowRight />
              </button>
            </div>

            <div className="service-card">
              <div className="service-icon-wrapper">
                <FaSyringe className="service-icon" />
              </div>
              <h3>Vaccination</h3>
              <p>Stay protected with essential vaccines and immunization programs for all age groups.</p>
              <button className="service-link">
                Learn More <FaArrowRight />
              </button>
            </div>

            <div className="service-card">
              <div className="service-icon-wrapper">
                <FaAmbulance className="service-icon" />
              </div>
              <h3>Emergency Care</h3>
              <p>24/7 emergency medical services with rapid response teams and state-of-the-art facilities.</p>
              <button className="service-link">
                Learn More <FaArrowRight />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Announcement Banner */}
      <section className="announcement-banner">
        <div className="container">
          <div className="banner-content">
            <div className="banner-icon">📢</div>
            <div className="banner-text">
              <strong>COVID-19 Update:</strong> Vaccination drive ongoing. Book your slot now for safe and secure vaccination.
            </div>
            <button className="banner-btn">
              Book Now <FaArrowRight />
            </button>
          </div>
        </div>
      </section>

      {/* Doctors Section */}
      <section className="doctors-section">
        <div className="container">
          <div className="section-header">
            <h2>Meet Our Doctors</h2>
            <p>Highly qualified medical professionals dedicated to your health</p>
          </div>

          <div className="doctors-grid">
            {doctors.map((doc) => (
              <div 
                className="doctor-card" 
                key={doc.id} 
                onClick={() => openReviewModal(doc)}
              >
                <div className="doctor-image">
                  {doc.profile_image ? (
                    <img src={doc.profile_image} alt={doc.full_name} />
                  ) : (
                    <div className="doctor-avatar">
                      <FaUserMd />
                    </div>
                  )}
                  <div className="doctor-status online"></div>
                </div>
                
                <div className="doctor-info">
                  <h3>{doc.full_name}</h3>
                  <p className="doctor-specialty">
                    {doc.department_name || "General Physician"}
                  </p>
                  <div className="doctor-rating">
                    <FaStar className="star-icon" />
                    <span>{averageRating || "New"}</span>
                  </div>
                  <div className="doctor-availability">
                    <FaClock className="clock-icon" />
                    <span>Mon - Fri • 10:00 AM - 6:00 PM</span>
                  </div>
                </div>
                
                <button className="view-profile-btn">
                  View Profile <FaArrowRight />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Review Modal */}
      {reviewModalOpen && (
        <div className="modal-overlay" onClick={closeReviewModal}>
          <div className="review-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="doctor-modal-header">
                <div className="doctor-modal-image">
                  {selectedDoctor?.profile_image ? (
                    <img src={selectedDoctor.profile_image} alt={selectedDoctor.full_name} />
                  ) : (
                    <div className="doctor-modal-avatar">
                      <FaUserMd />
                    </div>
                  )}
                </div>
                <div className="doctor-modal-info">
                  <h2>{selectedDoctor?.full_name}</h2>
                  <p className="doctor-modal-specialty">
                    {selectedDoctor?.specialty || selectedDoctor?.department_name}
                  </p>
                  <div className="doctor-modal-rating">
                    <div className="rating-stars">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <FaStar 
                          key={star} 
                          className={`star ${star <= averageRating ? "filled" : ""}`}
                        />
                      ))}
                    </div>
                    <span className="rating-text">
                      {averageRating} • {doctorReviews.length} reviews
                    </span>
                  </div>
                </div>
              </div>
              <button className="close-modal-btn" onClick={closeReviewModal}>
                <FaTimes />
              </button>
            </div>

            <div className="modal-content">
              <div className="reviews-section">
                <h3>Patient Reviews</h3>
                <div className="reviews-list">
                  {doctorReviews.length > 0 ? (
                    doctorReviews.map((review, index) => (
                      <div className="review-item" key={index}>
                        <div className="review-header">
                          <div className="reviewer-info">
                            <strong>{review.patient_name}</strong>
                            <div className="review-rating">
                              {[...Array(5)].map((_, i) => (
                                <FaStar 
                                  key={i} 
                                  className={`star ${i < review.rating ? "filled" : ""}`}
                                />
                              ))}
                            </div>
                          </div>
                          <span className="review-date">
                            {new Date(review.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="review-text">{review.comment}</p>
                      </div>
                    ))
                  ) : (
                    <div className="no-reviews">
                      <FaStar className="no-reviews-icon" />
                      <p>No reviews yet. Be the first to review!</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="add-review-section">
                <h3>Write a Review</h3>
                <div className="review-form">
                  <div className="star-rating-input">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <FaStar 
                        key={star}
                        className={`star ${star <= rating ? "filled" : ""}`}
                        onClick={() => setRating(star)}
                      />
                    ))}
                    <span className="rating-text">({rating}/5)</span>
                  </div>
                  
                  <textarea 
                    className="review-textarea"
                    placeholder="Share your experience with this doctor..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows="4"
                  />
                  
                  <button 
                    className="submit-review-btn"
                    onClick={handleSubmitReview}
                    disabled={!rating}
                  >
                    Submit Review
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;