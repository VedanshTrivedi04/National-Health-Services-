// src/components/Footer.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import "./footer.css"
function Footer() {
  return (
    <>
     {/* Footer */}
      <footer>
        <div className="container footer-content">
          <div className="footer-column">
            <h3>About Us</h3>
            <p>We are committed to providing the best healthcare services.</p>
          </div>
          <div className="footer-column">
            <h3>Quick Links</h3>
            <ul className="footer-links">
              <li><a href="/patient/dashboard">Home</a></li>
              <li><a href="/appointment">Book Appointment</a></li>
              <li><a href="/profile">Track Token</a></li>
              <li><a href="/departments">Departments</a></li>
              <li><a href="/contact">Contact Us</a></li>
            </ul>
          </div>
          <div className="footer-column">
            <h3>Contact</h3>
            <div className="contact-info"><i className="fas fa-phone"></i>+91 1234567890</div>
            <div className="contact-info"><i className="fas fa-envelope"></i>info@hospital.com</div>
          </div>
        </div>
        <div className="footer-bottom">
          &copy; 2025 Your Hospital. All rights reserved.
        </div>
      </footer>
      </>
  );
}

export default Footer;