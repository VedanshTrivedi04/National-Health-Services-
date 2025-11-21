// src/components/Header.jsx
import React, { useState, useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import "./DoctorHeader.css"
function DoctorHeader() {
  const [isMobileNavActive, setIsMobileNavActive] = useState(false);
  const { isAuthenticated, user, logout } = useAuth();

  useEffect(() => {
    const handleClickOutside = (event) => {
      const mobileNav = document.querySelector('.mobile-nav-panel');
      const mobileMenu = document.querySelector('.mobile-menu-btn');

      if (
        mobileNav &&
        mobileMenu &&
        !mobileNav.contains(event.target) &&
        !mobileMenu.contains(event.target)
      ) {
        setIsMobileNavActive(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const toggleMobileNav = () => {
    setIsMobileNavActive(!isMobileNavActive);
  };

  const handleLogout = async () => {
    try {
      await logout();
      setIsMobileNavActive(false);
      window.location.href = "/patient/dashboard"
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <>
      {/* Top Bar */}
      <div className="doctor-top-bar">
        <div className="doctor-top-bar-content">
          <div className="doctor-top-left">
            <i className="fas fa-phone-alt"></i> Helpline: 1075 &nbsp;|&nbsp;
            <i className="fas fa-envelope"></i> support@health.gov
          </div>
          <div className="doctor-top-right">
            <a href="#"><i className="fas fa-globe"></i> English</a>
            <a href="#"><i className="fas fa-question-circle"></i> Help</a>
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="doctor-header">
        <div className="doctor-container">
          <nav className="doctor-navbar">

            {/* Logo */}
            <Link to="/doctor/dashboard" className="doctor-logo">
              <div className="doctor-logo-emblem">
                <i className="fas fa-plus-circle"></i>
              </div>
              <div>
                <div className="doctor-logo-main">National Health Services</div>
                <div className="doctor-logo-sub">Government of India</div>
              </div>
            </Link>

            {/* Desktop Nav */}
            <ul className="doctor-nav-links">
              <li><NavLink to="/doctor/queue">Queue</NavLink></li>
              <li><NavLink to="/doctor/session">Live Session</NavLink></li>
              <li><NavLink to="/doctor/profile">Profile</NavLink></li>
              <li><NavLink to="/doctor/cabinet">Cabin Display</NavLink></li>
            </ul>

            {/* Auth Buttons */}
            <div className="doctor-auth">
              {isAuthenticated ? (
                <>
                  <div className="doctor-user-box">
                    <span>{user?.full_name}</span>
                  </div>
                  <button className="doctor-btn-outline" onClick={handleLogout}>
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login"><button className="doctor-btn-outline">Login</button></Link>
                  <Link to="/signup"><button className="doctor-btn-primary">Register</button></Link>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <div className="mobile-menu-btn" onClick={toggleMobileNav}>
              <i className="fas fa-bars"></i>
            </div>
          </nav>
        </div>

        {/* Mobile Navigation Panel */}
        <div className={`mobile-nav-panel ${isMobileNavActive ? 'active' : ''}`}>
          <ul>
            <li><Link to="/doctor/queue">Queue</Link></li>
            <li><Link to="/doctor/session">Live Session</Link></li>
            <li><Link to="/doctor/profile">Profile</Link></li>
            <li><Link to="/doctor/cabinet">Cabin Display</Link></li>
            {isAuthenticated && (
              <li className="mobile-logout" onClick={handleLogout} >Logout</li>
              
            )}
          </ul>
        </div>
      </header>
    </>
  );
}

export default DoctorHeader;
