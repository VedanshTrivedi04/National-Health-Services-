// src/pages/SignUpPage.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './signup.css';
import { 
  FaEye, 
  FaEyeSlash, 
  FaUser, 
  FaPhone, 
  FaEnvelope, 
  FaVenusMars, 
  FaCalendarAlt,
  FaIdCard,
  FaTint,
  FaMapMarkerAlt,
  FaLock,
  FaArrowRight,
  FaArrowLeft,
  FaCheck,
  FaShieldAlt
} from 'react-icons/fa';

const SignUpPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    gender: '',
    date_of_birth: '',
    aadhaar_number: '',
    blood_group: '',
    address: '',
    password: '',
    password2: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(120);
  const [isResendDisabled, setIsResendDisabled] = useState(false);
  const [alert, setAlert] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState({});
  const [otp, setOtp] = useState(['', '', '', '', '', '']);

  // OTP timer
  useEffect(() => {
    let timer;
    if (otpSent && countdown > 0) {
      timer = setInterval(() => setCountdown((prev) => prev - 1), 1000);
    } else if (countdown === 0) {
      setIsResendDisabled(false);
      clearInterval(timer);
    }
    return () => clearInterval(timer);
  }, [otpSent, countdown]);

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
  };

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleFocus = (field) => {
    setIsFocused(prev => ({ ...prev, [field]: true }));
  };

  const handleBlur = (field) => {
    setIsFocused(prev => ({ ...prev, [field]: false }));
  };

  const handleSendOtp = () => {
    if (!formData.phone) {
      setAlert({ type: 'error', message: 'Please enter mobile number first' });
      return;
    }
    setOtpSent(true);
    setIsResendDisabled(true);
    setCountdown(120);
    setAlert({ type: 'success', message: 'OTP sent to your mobile number' });
    // TODO: Integrate real backend OTP API
  };

  const handleOtpChange = (value, index) => {
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    
    // Auto-focus next input
    if (value && index < 5) {
      document.getElementById(`otp-${index + 1}`).focus();
    }
  };

  const handleVerifyOtp = () => {
    // TODO: Integrate real OTP verification backend API
    setStep(2);
    setAlert({ type: 'success', message: 'OTP verified successfully' });
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.password2) {
      setAlert({ type: 'error', message: "Passwords don't match" });
      return;
    }

    // Payload exactly matches serializer and backend response format
    const payload = {
      full_name: formData.full_name,
      email: formData.email,
      phone: formData.phone,
      gender: formData.gender,
      date_of_birth: formData.date_of_birth || null,
      aadhaar_number: formData.aadhaar_number || '',
      blood_group: formData.blood_group || '',
      address: formData.address || '',
      password: formData.password,
      password2: formData.password2,
    };

    try {
      setLoading(true);
      const response = await fetch(
        'http://127.0.0.1:8000/api/auth/register/',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      const data = await response.json();

      if (response.ok) {
        setAlert({
          type: 'success',
          message: 'Account created successfully! Redirecting to login...',
        });
        setTimeout(() => navigate('/login'), 1500);
      } else {
        let errorMessage = data?.detail || '';
        if (!errorMessage && typeof data === 'object') {
          errorMessage = Object.values(data)
            .flat()
            .join(' ');
        }
        setAlert({ type: 'error', message: errorMessage || 'Registration failed' });
      }
    } catch (err) {
      setAlert({ type: 'error', message: 'Network error. Please try again.' });
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const progressPercentage = step === 1 ? 50 : 100;

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
            <h2>Join Our Healthcare Community</h2>
            <p>Create your account to access personalized healthcare services, book appointments, and manage your medical records securely.</p>
          </div>
          <div className="features-list">
            <div className="feature-item">
              <div className="feature-icon"><FaCheck /></div>
              <span>Secure Medical Records</span>
            </div>
            <div className="feature-item">
              <div className="feature-icon"><FaCheck /></div>
              <span>Easy Appointment Booking</span>
            </div>
            <div className="feature-item">
              <div className="feature-icon"><FaCheck /></div>
              <span>24/7 Doctor Access</span>
            </div>
            <div className="feature-item">
              <div className="feature-icon"><FaCheck /></div>
              <span>Digital Prescriptions</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Signup Form */}
      <div className="auth-form-section">
        <div className="form-container">
          {/* Header */}
          <div className="form-header">
            <h1>Create Your Account</h1>
            <p>Join thousands of patients managing their health with us</p>
          </div>

          {/* Progress Bar */}
          <div className="progress-container">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
            <div className="progress-steps">
              <div className={`progress-step ${step >= 1 ? 'active' : ''}`}>
                <div className="step-indicator">
                  {step > 1 ? <FaCheck /> : 1}
                </div>
                <span>Contact Info</span>
              </div>
              <div className={`progress-step ${step >= 2 ? 'active' : ''}`}>
                <div className="step-indicator">
                  {step > 2 ? <FaCheck /> : 2}
                </div>
                <span>Personal Details</span>
              </div>
            </div>
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

          <form onSubmit={handleCreateAccount} className="signup-form">
            {/* Step 1: Contact Verification */}
            {step === 1 && (
              <div className="form-step active">
                <div className="step-header">
                  <h2>Contact Information</h2>
                  <p>Let's start with your basic contact details</p>
                </div>

                <div className="input-grid">
                  <div className={`form-field ${isFocused.full_name || formData.full_name ? 'focused' : ''}`}>
                    <FaUser className="field-icon" />
                    <input
                      type="text"
                      name="full_name"
                      value={formData.full_name}
                      onChange={handleChange}
                      onFocus={() => handleFocus('full_name')}
                      onBlur={() => handleBlur('full_name')}
                      placeholder="Enter your full name"
                      className="form-input"
                      required
                    />
                    <label className="field-label">Full Name *</label>
                  </div>

                  <div className={`form-field ${isFocused.gender || formData.gender ? 'focused' : ''}`}>
                    <FaVenusMars className="field-icon" />
                    <select
                      name="gender"
                      value={formData.gender}
                      onChange={handleChange}
                      onFocus={() => handleFocus('gender')}
                      onBlur={() => handleBlur('gender')}
                      className="form-input"
                      required
                    >
                      <option value=""></option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                    <label className="field-label">Gender *</label>
                  </div>

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
                    <label className="field-label">Mobile Number *</label>
                  </div>

                  <div className={`form-field ${isFocused.email || formData.email ? 'focused' : ''}`}>
                    <FaEnvelope className="field-icon" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      onFocus={() => handleFocus('email')}
                      onBlur={() => handleBlur('email')}
                      placeholder="Enter your email address"
                      className="form-input"
                      required
                    />
                    <label className="field-label">Email Address *</label>
                  </div>
                </div>

                {/* OTP Section */}
                <div className="otp-section">
                  <button
                    type="button"
                    className="otp-btn"
                    onClick={handleSendOtp}
                    disabled={isResendDisabled}
                  >
                    {isResendDisabled
                      ? `Resend in ${formatTime(countdown)}`
                      : 'Send Verification Code'}
                  </button>

                  {otpSent && (
                    <div className="otp-input-group">
                      <label>Enter 6-digit verification code</label>
                      <div className="otp-container">
                        {otp.map((digit, index) => (
                          <input
                            key={index}
                            id={`otp-${index}`}
                            type="text"
                            maxLength="1"
                            value={digit}
                            onChange={(e) => handleOtpChange(e.target.value, index)}
                            className="otp-input"
                            onKeyDown={(e) => {
                              if (e.key === 'Backspace' && !digit && index > 0) {
                                document.getElementById(`otp-${index - 1}`).focus();
                              }
                            }}
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        className="verify-btn"
                        onClick={handleVerifyOtp}
                        disabled={otp.some(digit => !digit)}
                      >
                        Verify & Continue <FaArrowRight className="btn-icon" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Account Creation */}
            {step === 2 && (
              <div className="form-step active">
                <div className="step-header">
                  <h2>Personal Details</h2>
                  <p>Complete your profile for better healthcare experience</p>
                </div>

                <div className="input-grid">
                  <div className={`form-field ${isFocused.date_of_birth || formData.date_of_birth ? 'focused' : ''}`}>
                    <FaCalendarAlt className="field-icon" />
                    <input
                      type="date"
                      name="date_of_birth"
                      value={formData.date_of_birth}
                      onChange={handleChange}
                      onFocus={() => handleFocus('date_of_birth')}
                      onBlur={() => handleBlur('date_of_birth')}
                      className="form-input"
                    />
                    <label className="field-label">Date of Birth</label>
                  </div>

                  <div className={`form-field ${isFocused.aadhaar_number || formData.aadhaar_number ? 'focused' : ''}`}>
                    <FaIdCard className="field-icon" />
                    <input
                      type="text"
                      name="aadhaar_number"
                      value={formData.aadhaar_number}
                      onChange={handleChange}
                      onFocus={() => handleFocus('aadhaar_number')}
                      onBlur={() => handleBlur('aadhaar_number')}
                      placeholder="12-digit Aadhaar number"
                      className="form-input"
                      maxLength="12"
                    />
                    <label className="field-label">Aadhaar Number</label>
                  </div>

                  <div className={`form-field ${isFocused.blood_group || formData.blood_group ? 'focused' : ''}`}>
                    <FaTint className="field-icon" />
                    <input
                      type="text"
                      name="blood_group"
                      value={formData.blood_group}
                      onChange={handleChange}
                      onFocus={() => handleFocus('blood_group')}
                      onBlur={() => handleBlur('blood_group')}
                      placeholder="e.g., A+"
                      className="form-input"
                      maxLength="3"
                    />
                    <label className="field-label">Blood Group</label>
                  </div>

                  <div className={`form-field full-width ${isFocused.address || formData.address ? 'focused' : ''}`}>
                    <FaMapMarkerAlt className="field-icon" />
                    <textarea
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      onFocus={() => handleFocus('address')}
                      onBlur={() => handleBlur('address')}
                      placeholder="Enter your complete address"
                      className="form-input"
                      rows="3"
                    />
                    <label className="field-label">Address</label>
                  </div>

                  <div className={`form-field ${isFocused.password || formData.password ? 'focused' : ''}`}>
                    <FaLock className="field-icon" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      onFocus={() => handleFocus('password')}
                      onBlur={() => handleBlur('password')}
                      placeholder="Create a strong password"
                      className="form-input"
                      required
                    />
                    <label className="field-label">Password *</label>
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>

                  <div className={`form-field ${isFocused.password2 || formData.password2 ? 'focused' : ''}`}>
                    <FaLock className="field-icon" />
                    <input
                      type={showPassword2 ? 'text' : 'password'}
                      name="password2"
                      value={formData.password2}
                      onChange={handleChange}
                      onFocus={() => handleFocus('password2')}
                      onBlur={() => handleBlur('password2')}
                      placeholder="Confirm your password"
                      className="form-input"
                      required
                    />
                    <label className="field-label">Confirm Password *</label>
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword2(!showPassword2)}
                    >
                      {showPassword2 ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                </div>

                {/* Terms Agreement */}
                <div className="terms-agreement">
                  <label className="checkbox-container">
                    <input type="checkbox" required />
                    <span className="checkmark"></span>
                    I agree to the <a href="#" className="link">Terms of Service</a> and{' '}
                    <a href="#" className="link">Privacy Policy</a>
                  </label>
                </div>

                {/* Form Actions */}
                <div className="form-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setStep(1)}
                  >
                    <FaArrowLeft className="btn-icon" />
                    Back
                  </button>
                  <button
                    type="submit"
                    className={`submit-btn ${loading ? 'loading' : ''}`}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <div className="spinner"></div>
                        Creating Account...
                      </>
                    ) : (
                      <>
                        Create Account
                        <FaArrowRight className="btn-icon" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </form>

          {/* Login Redirect */}
          <div className="auth-redirect">
            <p>Already have an account?</p>
            <Link to="/login" className="redirect-link">
              Sign in to your account <FaArrowRight className="link-icon" />
            </Link>
          </div>

          {/* Security Notice */}
          <div className="security-notice">
            <FaShieldAlt className="shield-icon" />
            <span>Your personal and medical data is protected with bank-level security</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignUpPage;