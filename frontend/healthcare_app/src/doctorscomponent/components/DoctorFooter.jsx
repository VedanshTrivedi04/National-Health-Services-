import React from "react";
import "./DoctorFooter.css";

function DoctorFooter() {
  return (
    <footer className="doctor-footer">
      <div className="footer-container">

        {/* Column 1 */}
        <div className="footer-col">
          <h3>National Health Services</h3>
          <p>
            Providing reliable, accessible and quality healthcare support for doctors
            and patients across India.
          </p>
        </div>

        {/* Column 2 */}
        <div className="footer-col">
          <h3>Quick Links</h3>
          <ul>
            <li><a href="/doctor/dashboard">Dashboard</a></li>
            <li><a href="/doctor/queue">Queue Management</a></li>
            <li><a href="/doctor/session">Live Session</a></li>
            <li><a href="/doctor/profile">Profile</a></li>
            <li><a href="/doctor/cabinet">Cabin Display</a></li>
          </ul>
        </div>

        {/* Column 3 */}
        <div className="footer-col">
          <h3>Contact</h3>
          <p><i className="fas fa-phone"></i> Helpline: 1075</p>
          <p><i className="fas fa-envelope"></i> support@health.gov</p>
          <p><i className="fas fa-map-marker-alt"></i> New Delhi, India</p>
        </div>
      </div>

      <div className="footer-bottom">
        © 2025 National Health Services • Government of India
      </div>
    </footer>
  );
}

export default DoctorFooter;
