// src/pages/HomePage.jsx
import React, { useEffect, useState } from "react";
import { useData } from "../../contexts/DataContext";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import apiService from "../../services/api";
import "./HomePage.css";

const HomePage = () => {
  const { user, isAuthenticated } = useAuth();
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
    <>
      {/* Hero Section */}
      <section className="hero">
        <div className="container hero-content">
          <div className="hero-text">
            <h1>Welcome to Our Hospital</h1>
            <p>Book appointments, consult doctors, and manage your health easily.</p>
            <div className="hero-buttons">
              <button className="hero-btn btn-primary" onClick={() => navigate("/appointment")}>
                Book Appointment
              </button>
            </div>
          </div>
          <div className="hero-image">
            <div className="hero-img-placeholder">🏥</div>
          </div>
        </div>
      </section>

      {/* Services */}
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
              <p>Consult with top specialists.</p>
            </div>

            <div className="service-card">
              <div className="service-icon">💉</div>
              <h3>Vaccination</h3>
              <p>Stay protected with essential vaccines.</p>
            </div>

            <div className="service-card">
              <div className="service-icon">🏥</div>
              <h3>Emergency Care</h3>
              <p>24/7 emergency support.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Announcement */}
      <section className="announcements">
        <div className="container announcement-container">
          <span className="announcement-label">Notice</span>
          <div className="announcement-text">
            <marquee>COVID-19 vaccination drive ongoing. Book your slot now!</marquee>
          </div>
        </div>
      </section>

      {/* LIVE QUEUE STATUS */}
      <div className="queue-box">
        <h3>Live Queue Status</h3>

        <div className="current-token">
          <span>Now Serving:</span>
          <strong>{queue?.current_token || "—"}</strong>
        </div>

        <div className="pending-list">
          <h4>Pending Tokens</h4>

          {queue?.pending_tokens?.length > 0 ? (
            queue.pending_tokens.map((item) => (
              <div key={item.token_number} className={`token-item ${highlightToken === item.token_number ? "highlight" : ""}`}>
                <span className="token-num">Token {item.token_number}</span>
                <span className="token-name">{item.patient_name}</span>
                <span className="eta">ETA: {item.eta_minutes ?? "—"} min</span>
              </div>
            ))
          ) : (
            <p>No pending tokens</p>
          )}
        </div>
      </div>

      {/* Doctors Section */}
      <section className="doctors-section section">
        <div className="doctors-slider">
          {doctors.map((doc) => (
            <div className="doctor-card" key={doc.id} onClick={() => openReviewModal(doc)}>
              <div className="doctor-img">{doc.profile_image || "👨‍⚕️"}</div>

              <div className="doctor-info">
                <h3>{doc.full_name}</h3>
                <div className="doctor-specialty">{doc.department_name || "General"}</div>
                <div className="doctor-availability">
                  <span>Mon-Fri</span>
                  <span>10am - 6pm</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Review Modal */}
      {reviewModalOpen && (
        <div className="review-modal-backdrop" onClick={closeReviewModal}>
          <div className="review-modal" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={closeReviewModal}>×</button>

            <h2>{selectedDoctor?.full_name}</h2>
            <p className="modal-specialty">{selectedDoctor?.specialty || selectedDoctor?.department_name}</p>
            <div className="modal-rating">
              ⭐ {averageRating || "No rating yet"} | Patient Reviews
            </div>


            <div className="modal-review-list">
              {doctorReviews.length > 0 ? (
                doctorReviews.map((review, index) => (
                  <div className="review-item" key={index}>
                    <div className="review-header">
                      <strong>{review.patient_name}</strong>
                      <span className="review-stars">⭐ {review.rating}</span>
                    </div>
                    <p className="review-text">{review.comment}</p>
                  </div>
                ))
              ) : (
                <p className="no-reviews">No reviews yet.</p>
              )}
            </div>

            {/* Add review form */}
            <h3 className="add-review-title">Write a Review</h3>

            <div className="review-form">
              <div className="star-rating">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span key={star} className={`star ${star <= rating ? "filled" : ""}`} onClick={() => setRating(star)}>⭐</span>
                ))}
              </div>

              <textarea className="review-input" placeholder="Write your feedback..." value={comment} onChange={(e) => setComment(e.target.value)} />

              <button className="submit-review-btn" onClick={handleSubmitReview}>Submit Review</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default HomePage;
