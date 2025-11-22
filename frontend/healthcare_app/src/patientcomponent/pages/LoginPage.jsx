import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './login_signup.css';
import { FaEye, FaEyeSlash, FaUser, FaPhone, FaLock, FaArrowRight, FaCheck } from 'react-icons/fa';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [activeTab, setActiveTab] = useState('email');
  const [formData, setFormData] = useState({ email: '', password: '', phone: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ type: '', message: '' });
  const [rememberMe, setRememberMe] = useState(false);
  const [isFocused, setIsFocused] = useState({ email: false, phone: false, password: false });

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setAlert({ type: '', message: '' });
  };

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleFocus = (field) => {
    setIsFocused(prev => ({ ...prev, [field]: true }));
  };

  const handleBlur = (field) => {
    setIsFocused(prev => ({ ...prev, [field]: false }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAlert({ type: '', message: '' });

    const credentials =
      activeTab === 'email'
        ? { email: formData.email, password: formData.password }
        : { phone: formData.phone, password: formData.password };

    const result = await login(credentials);
    setLoading(false);

    if (result.success) {
      setAlert({ type: 'success', message: `Welcome ${result.user.full_name}! Redirecting...` });
      setTimeout(() => navigate(result.dashboard_url || '/'), 1200);
    } else {
      setAlert({ type: 'error', message: result.error || 'Invalid credentials' });
    }
  };

  return (
    <div className="auth-container">
      {/* Left Side - Branding */}
      <div className="auth-hero">
        <div className="hero-content">
          <div className="logo">
            <div className="logo-icon">🏥</div>
            <h1>MediCare</h1>
          </div>
          <div className="hero-text">
            <h2>Your Health, Our Priority</h2>
            <p>Access your medical records, book appointments, and connect with healthcare professionals seamlessly.</p>
          </div>
          <div className="features-list">
            <div className="feature-item">
              <div className="feature-icon"><FaCheck /></div>
              <span>Secure & Encrypted</span>
            </div>
            <div className="feature-item">
              <div className="feature-icon"><FaCheck /></div>
              <span>24/7 Access</span>
            </div>
            <div className="feature-item">
              <div className="feature-icon"><FaCheck /></div>
              <span>Multi-Device Sync</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="auth-form-section">
        <div className="form-container">
          {/* Header */}
          <div className="form-header">
            <h1>Welcome Back</h1>
            <p>Sign in to continue to your account</p>
          </div>

          {/* Login Method Tabs */}
          <div className="method-tabs">
            <button
              className={`method-tab ${activeTab === 'email' ? 'active' : ''}`}
              onClick={() => handleTabChange('email')}
            >
              <FaUser className="tab-icon" />
              <span>Email Login</span>
            </button>
            <button
              className={`method-tab ${activeTab === 'phone' ? 'active' : ''}`}
              onClick={() => handleTabChange('phone')}
            >
              <FaPhone className="tab-icon" />
              <span>Phone Login</span>
            </button>
          </div>

          {/* Alert Messages */}
          {alert.message && (
            <div className={`alert-banner ${alert.type === 'success' ? 'success' : 'error'}`}>
              <div className="alert-content">
                <div className="alert-icon">
                  {alert.type === 'success' ? '✓' : '⚠'}
                </div>
                <span>{alert.message}</span>
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="login-form">
            <div className="input-group">
              {activeTab === 'email' ? (
                <div className={`form-field ${isFocused.email || formData.email ? 'focused' : ''}`}>
                  <FaUser className="field-icon" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    onFocus={() => handleFocus('email')}
                    onBlur={() => handleBlur('email')}
                    placeholder="Enter your email"
                    className="form-input"
                    required
                  />
                  <label className="field-label">Email Address</label>
                </div>
              ) : (
                <div className={`form-field ${isFocused.phone || formData.phone ? 'focused' : ''}`}>
                  <FaPhone className="field-icon" />
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    onFocus={() => handleFocus('phone')}
                    onBlur={() => handleBlur('phone')}
                    placeholder="Enter your phone number"
                    className="form-input"
                    required
                  />
                  <label className="field-label">Phone Number</label>
                </div>
              )}

              <div className={`form-field ${isFocused.password || formData.password ? 'focused' : ''}`}>
                <FaLock className="field-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  onFocus={() => handleFocus('password')}
                  onBlur={() => handleBlur('password')}
                  placeholder="Enter your password"
                  className="form-input"
                  required
                />
                <label className="field-label">Password</label>
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle Password Visibility"
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            {/* Options Row */}
            <div className="form-options">
              <label className="checkbox-container">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={() => setRememberMe(!rememberMe)}
                />
                <span className="checkmark"></span>
                Remember me
              </label>
              <Link to="/forgot-password" className="forgot-link">
                Forgot Password?
              </Link>
            </div>

            {/* Submit Button */}
            <button 
              type="submit" 
              className={`submit-btn ${loading ? 'loading' : ''}`}
              disabled={loading}
            >
              <span className="btn-text">
                {loading ? 'Signing In...' : 'Sign In'}
              </span>
              {!loading && <FaArrowRight className="btn-icon" />}
              {loading && <div className="spinner"></div>}
            </button>

            {/* Divider */}
            <div className="divider">
              <span>or</span>
            </div>

            {/* Sign Up Link */}
            <div className="auth-redirect">
              <p>Don't have an account?</p>
              <Link to="/signup" className="redirect-link">
                Create an account <FaArrowRight className="link-icon" />
              </Link>
            </div>
          </form>

          {/* Security Notice */}
          <div className="security-notice">
            <FaLock className="lock-icon" />
            <span>Your data is securely encrypted and protected</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;