import React, { useState, useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import "./Header.css";

function Header() {
  const [isMobileNavActive, setIsMobileNavActive] = useState(false);
  const { isAuthenticated, user, logout } = useAuth();

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      const menu = document.querySelector(".mobile-nav");
      const icon = document.querySelector(".mobile-menu");

      if (
        menu &&
        icon &&
        !menu.contains(e.target) &&
        !icon.contains(e.target)
      ) {
        setIsMobileNavActive(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const toggleMobileNav = () => setIsMobileNavActive((prev) => !prev);

  const handleLogout = async () => {
    try {
      await logout();
      setIsMobileNavActive(false);
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const closeMobileMenu = () => setIsMobileNavActive(false);

  return (
    <>
      {/* ---------- TOP BAR ---------- */}
      <div className="top-bar">
        <div className="top-bar-content">
          <div className="top-bar-contact">
            <i className="fas fa-phone-alt"></i> National Helpline: 1075 |
            <i className="fas fa-envelope"></i> support@nationalhealth.gov
          </div>

          <div className="top-bar-links">
            <a><i className="fas fa-globe"></i> English</a>
            <a><i className="fas fa-question-circle"></i> Help</a>
          </div>
        </div>
      </div>

      {/* ---------- MAIN HEADER ---------- */}
      <header>
        <div className="container">
          <nav className="navbar">

            {/* LOGO */}
            <Link to="/" className="logo">
              <div className="emblem"><i className="fas fa-plus-circle"></i></div>
              <div className="logo-text">
                <div className="logo-main">National Health Services</div>
                <div className="logo-sub">Government of India</div>
              </div>
            </Link>

            {/* DESKTOP LINKS */}
            <ul className="nav-links">
              <li><NavLink to="/patient/dashboard">Home</NavLink></li>
              <li><NavLink to="/appointment">Book Appointment</NavLink></li>
              <li><NavLink to="/profile">Profile</NavLink></li>
              <li><NavLink to="/department">Departments</NavLink></li>
              <li><NavLink to="/contact">Contact Us</NavLink></li>
            </ul>

            {/* DESKTOP AUTH */}
            <div className="auth-buttons">
              {isAuthenticated ? (
                <>
                  <div className="user-info">
                    <div className="user-avatar">
                      {user?.full_name?.charAt(0)?.toUpperCase() || "U"}
                    </div>
                    <span>{user?.full_name}</span>
                  </div>
                  <button className="btn btn-outline" onClick={handleLogout}>Logout</button>
                </>
              ) : (
                <>
                  <Link to="/login"><button className="btn btn-outline">Login</button></Link>
                  <Link to="/signup"><button className="btn btn-primary">Register</button></Link>
                </>
              )}
            </div>

            {/* MOBILE ICON */}
            <div className="mobile-menu" onClick={toggleMobileNav}>
              <i className="fas fa-bars"></i>
            </div>

          </nav>
        </div>

        {/* ---------- MOBILE NAV ---------- */}
        <div className={`mobile-nav ${isMobileNavActive ? "open" : ""}`}>
          <ul>
            <li><NavLink to="/patient/dashboard" onClick={closeMobileMenu}>Home</NavLink></li>
            <li><NavLink to="/appointment" onClick={closeMobileMenu}>Book Appointment</NavLink></li>
            <li><NavLink to="/profile" onClick={closeMobileMenu}>Profile</NavLink></li>
            <li><NavLink to="/department" onClick={closeMobileMenu}>Departments</NavLink></li>
            <li><NavLink to="/contact" onClick={closeMobileMenu}>Contact Us</NavLink></li>
          </ul>

          <div className="mobile-auth">
            {isAuthenticated ? (
              <>
                <div className="user-info">
                  <div className="user-avatar">
                    {user?.full_name?.charAt(0)?.toUpperCase() || "U"}
                  </div>
                  <span>{user?.full_name}</span>
                </div>

                <button className="btn btn-outline" onClick={handleLogout}>
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login"><button className="btn btn-outline">Login</button></Link>
                <Link to="/signup"><button className="btn btn-primary">Register</button></Link>
              </>
            )}
          </div>
        </div>
      </header>
    </>
  );
}

export default Header;
