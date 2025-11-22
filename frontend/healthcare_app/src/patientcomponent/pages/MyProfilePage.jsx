// src/pages/MyProfilePage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/api';
import './myprofile.css';
import { 
  FaUser, 
  FaCalendarAlt, 
  FaFileMedical, 
  FaShieldAlt, 
  FaEdit, 
  FaSignOutAlt,
  FaTimes,
  FaClock,
  FaCheckCircle,
  FaTimesCircle,
  FaStethoscope,
  FaMapMarkerAlt,
  FaPhone,
  FaEnvelope,
  FaTint,
  FaVenusMars,
  FaBirthdayCake,
  FaIdCard,
  FaArrowLeft,
  FaPrescription,
  FaNotesMedical
} from 'react-icons/fa';

function MyProfilePage() {
  const [activeTab, setActiveTab] = useState('appointments');
  const [showEditModal, setShowEditModal] = useState(false);
  const [userData, setUserData] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [medicalHistory, setMedicalHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showAppointmentDetails, setShowAppointmentDetails] = useState(false);

  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // Fetch all user data on component mount
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      
      setIsLoading(true);
      setError('');
      try {
        // Set user data from auth context
        setUserData(user);
        
        // Fetch appointments
        try {
          const appointmentsData = await apiService.getAppointments();
          // Handle both array and wrapped responses
          const appointmentsList = Array.isArray(appointmentsData) 
            ? appointmentsData 
            : (appointmentsData.results || appointmentsData.data || []);
          setAppointments(appointmentsList);
          console.log('Fetched appointments:', appointmentsList);
        } catch (err) {
          console.error('Failed to fetch appointments:', err);
          setAppointments([]);
        }
        
        // Fetch medical records
        try {
          const medicalData = await apiService.getMedicalRecords();
          // Handle both array and wrapped responses
          const medicalList = Array.isArray(medicalData) 
            ? medicalData 
            : (medicalData.results || medicalData.data || []);
          setMedicalHistory(medicalList);
          console.log('Fetched medical records:', medicalList);
        } catch (err) {
          console.error('Failed to fetch medical records:', err);
          setMedicalHistory([]);
        }
      } catch (err) {
        console.error('Failed to fetch user data:', err);
        setError('Failed to load profile data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [user]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleAppointmentClick = async (appointmentId) => {
    try {
      setIsLoading(true);
      const appointment = await apiService.getAppointment(appointmentId);
      setSelectedAppointment(appointment);
      setShowAppointmentDetails(true);
    } catch (err) {
      console.error('Failed to fetch appointment details:', err);
      setError('Failed to load appointment details');
    } finally {
      setIsLoading(false);
    }
  };

  const closeAppointmentDetails = () => {
    setShowAppointmentDetails(false);
    setSelectedAppointment(null);
  };

  const handleCancelAppointment = async (appointmentId) => {
    // Confirm before canceling
    const confirmed = window.confirm(
      'Are you sure you want to cancel this appointment? This action cannot be undone.'
    );

    if (!confirmed) {
      return;
    }

    try {
      setIsLoading(true);
      await apiService.cancelAppointment(appointmentId);
      
      // Show success message
      alert('Appointment cancelled successfully!');
      
      // Refresh the appointments list
      const appointmentsData = await apiService.getAppointments();
      let appointmentsList = Array.isArray(appointmentsData) 
        ? appointmentsData 
        : (appointmentsData.results || appointmentsData.data || []);

      // Sorting by status AND appointment time
      appointmentsList.sort((a, b) => {
        const order = {
          "scheduled": 1,
          "confirmed": 2,
          "completed": 3,
          "cancelled": 4
        };

        const statusA = order[a.status?.toLowerCase()] || 999;
        const statusB = order[b.status?.toLowerCase()] || 999;

        if (statusA !== statusB) return statusA - statusB;

        // If same status → sort by time
        return new Date(a.appointment_date) - new Date(b.appointment_date);
      });

      setAppointments(appointmentsList);
      
      // Close details modal if open
      setShowAppointmentDetails(false);
      setSelectedAppointment(null);
    } catch (err) {
      console.error('Failed to cancel appointment:', err);
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to cancel appointment';
      alert(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    const formData = new FormData(e.target);
    const profileData = {
      full_name: formData.get('editName'),
      phone: formData.get('editPhone'),
      address: formData.get('editAddress'),
      blood_group: formData.get('editBloodGroup'),
    };
    
    try {
      const updatedUser = await apiService.updatePatientProfile(profileData);
      setUserData(updatedUser);
      setShowEditModal(false);
      alert('Profile updated successfully!');
      
      // Refresh the appointments and medical records
      try {
        const appointmentsData = await apiService.getAppointments();
        const appointmentsList = Array.isArray(appointmentsData) 
          ? appointmentsData 
          : (appointmentsData.results || appointmentsData.data || []);
        setAppointments(appointmentsList);
      } catch (err) {
        console.error('Failed to refresh appointments:', err);
      }
    } catch (err) {
      console.error('Update profile error:', err);
      setError(err.response?.data?.detail || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return <FaCheckCircle className="status-icon completed" />;
      case 'cancelled':
        return <FaTimesCircle className="status-icon cancelled" />;
      case 'in_progress':
        return <FaClock className="status-icon in-progress" />;
      default:
        return <FaClock className="status-icon scheduled" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return '#10b981';
      case 'cancelled':
        return '#ef4444';
      case 'in_progress':
        return '#f59e0b';
      default:
        return '#3b82f6';
    }
  };

  if (!userData || isLoading) {
    return (
      <div className="profile-loading">
        <div className="loading-spinner"></div>
        <h2>Loading Your Profile...</h2>
        {error && <div className="error-message">{error}</div>}
      </div>
    );
  }

  return (
    <div className="profile-container">
      {/* Header */}
      <div className="profile-header">
        <div className="container">
          <button className="back-btn" onClick={() => navigate('/')}>
            <FaArrowLeft />
            Back to Home
          </button>
          <div className="header-content">
            <h1>My Profile</h1>
            <p>Manage your personal information and healthcare journey</p>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="profile-layout">
          {/* Sidebar */}
          <div className="profile-sidebar">
            <div className="user-card">
              <div className="user-avatar">
                <FaUser />
              </div>
              <div className="user-info">
                <h2>{userData.full_name}</h2>
                <p className="user-role">Patient</p>
                <p className="user-id">ID: {userData.id}</p>
              </div>
            </div>

            <nav className="sidebar-nav">
              <button 
                className={`nav-item ${activeTab === 'appointments' ? 'active' : ''}`}
                onClick={() => setActiveTab('appointments')}
              >
                <FaCalendarAlt className="nav-icon" />
                <span>Appointments</span>
              </button>
              <button 
                className={`nav-item ${activeTab === 'medical' ? 'active' : ''}`}
                onClick={() => setActiveTab('medical')}
              >
                <FaFileMedical className="nav-icon" />
                <span>Medical History</span>
              </button>
              <button 
                className={`nav-item ${activeTab === 'privacy' ? 'active' : ''}`}
                onClick={() => setActiveTab('privacy')}
              >
                <FaShieldAlt className="nav-icon" />
                <span>Privacy & Security</span>
              </button>
            </nav>

            <div className="sidebar-actions">
              <button className="edit-profile-btn" onClick={() => setShowEditModal(true)}>
                <FaEdit />
                Edit Profile
              </button>
              <button className="logout-btn" onClick={handleLogout}>
                <FaSignOutAlt />
                Logout
              </button>
            </div>
          </div>

          {/* Main Content */}
          <div className="profile-main">
            {/* Personal Info Card */}
            <div className="info-card">
              <h3>Personal Information</h3>
              <div className="info-grid">
                <div className="info-item">
                  <FaUser className="info-icon" />
                  <div className="info-content">
                    <label>Full Name</label>
                    <span>{userData.full_name}</span>
                  </div>
                </div>
                <div className="info-item">
                  <FaBirthdayCake className="info-icon" />
                  <div className="info-content">
                    <label>Date of Birth</label>
                    <span>{userData.date_of_birth || 'Not provided'}</span>
                  </div>
                </div>
                <div className="info-item">
                  <FaVenusMars className="info-icon" />
                  <div className="info-content">
                    <label>Gender</label>
                    <span>{userData.gender || 'Not provided'}</span>
                  </div>
                </div>
                <div className="info-item">
                  <FaTint className="info-icon" />
                  <div className="info-content">
                    <label>Blood Group</label>
                    <span>{userData.blood_group || 'Not provided'}</span>
                  </div>
                </div>
                <div className="info-item">
                  <FaPhone className="info-icon" />
                  <div className="info-content">
                    <label>Phone</label>
                    <span>{userData.phone}</span>
                  </div>
                </div>
                <div className="info-item">
                  <FaEnvelope className="info-icon" />
                  <div className="info-content">
                    <label>Email</label>
                    <span>{userData.email}</span>
                  </div>
                </div>
                <div className="info-item full-width">
                  <FaMapMarkerAlt className="info-icon" />
                  <div className="info-content">
                    <label>Address</label>
                    <span>{userData.address || 'Not provided'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Tab Content */}
            <div className="tab-content">
              {/* Appointments Tab */}
              {activeTab === 'appointments' && (
                <div className="tab-panel active">
                  <div className="tab-header">
                    <h3>Appointment History</h3>
                    <p>Your scheduled and past appointments</p>
                  </div>
                  
                  <div className="appointments-grid">
                    {appointments.length > 0 ? (
                      appointments.map(appt => (
                        <div className="appointment-card" key={appt.id}>
                          <div className="appointment-header">
                            <div className="appointment-meta">
                              <span className="token-badge">Token #{appt.token_number || 'N/A'}</span>
                              <div 
                                className="appointment-status"
                                style={{ color: getStatusColor(appt.status) }}
                              >
                                {getStatusIcon(appt.status)}
                                {appt.status || 'N/A'}
                              </div>
                            </div>
                            <button 
                              className="view-details-btn"
                              onClick={() => handleAppointmentClick(appt.id)}
                            >
                              View Details
                            </button>
                          </div>
                          
                          <div className="appointment-body">
                            <div className="doctor-info">
                              <FaStethoscope className="doctor-icon" />
                              <div>
                                <h4>{appt.doctor_name || appt.doctor?.full_name || 'Dr. Unknown'}</h4>
                                <p>{appt.doctor_specialty || 'General Physician'}</p>
                              </div>
                            </div>
                            
                            <div className="appointment-details">
                              <div className="detail">
                                <FaCalendarAlt />
                                <span>
                                  {new Date(appt.appointment_date).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                  })}
                                </span>
                              </div>
                              {appt.time_slot && (
                                <div className="detail">
                                  <FaClock />
                                  <span>{appt.time_slot}</span>
                                </div>
                              )}
                              {appt.reason && (
                                <div className="detail">
                                  <FaNotesMedical />
                                  <span>{appt.reason}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {(appt.status === 'scheduled' || appt.status === 'confirmed') && (
                            <div className="appointment-actions">
                              <button 
                                className="cancel-btn"
                                onClick={() => handleCancelAppointment(appt.id)}
                                disabled={isLoading}
                              >
                                Cancel Appointment
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="empty-state">
                        <FaCalendarAlt className="empty-icon" />
                        <h4>No Appointments Yet</h4>
                        <p>Book your first appointment to get started with healthcare services</p>
                        <button 
                          className="btn-primary"
                          onClick={() => navigate('/appointment')}
                        >
                          Book Appointment
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Medical History Tab */}
              {activeTab === 'medical' && (
                <div className="tab-panel active">
                  <div className="tab-header">
                    <h3>Medical History</h3>
                    <p>Your medical records and consultation history</p>
                  </div>
                  
                  <div className="medical-records">
                    {medicalHistory && medicalHistory.length > 0 ? (
                      medicalHistory.map(record => (
                        <div className="medical-record-card" key={record.id}>
                          <div className="record-header">
                            <div className="record-date">
                              <FaCalendarAlt />
                              {new Date(record.visit_date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </div>
                            <div className="record-doctor">
                              <FaUser />
                              Dr. {record.doctor_name || record.doctor?.full_name || 'Unknown'}
                            </div>
                          </div>
                          
                          <div className="record-content">
                            {record.diagnosis && (
                              <div className="record-field">
                                <strong>Diagnosis:</strong>
                                <span>{record.diagnosis}</span>
                              </div>
                            )}
                            {record.symptoms && (
                              <div className="record-field">
                                <strong>Symptoms:</strong>
                                <span>{record.symptoms}</span>
                              </div>
                            )}
                            {record.treatment_plan && (
                              <div className="record-field">
                                <strong>Treatment Plan:</strong>
                                <span>{record.treatment_plan}</span>
                              </div>
                            )}
                            {record.prescriptions && Array.isArray(record.prescriptions) && record.prescriptions.length > 0 && (
                              <div className="record-field">
                                <strong>Prescriptions:</strong>
                                <div className="prescriptions-list">
                                  {record.prescriptions.map((prescription, index) => (
                                    <div key={index} className="prescription-item">
                                      <FaPrescription />
                                      {prescription}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {record.notes && (
                              <div className="record-field">
                                <strong>Notes:</strong>
                                <span>{record.notes}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="empty-state">
                        <FaFileMedical className="empty-icon" />
                        <h4>No Medical Records</h4>
                        <p>Your medical history will appear here after consultations with doctors</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Privacy Tab */}
              {activeTab === 'privacy' && (
                <div className="tab-panel active">
                  <div className="tab-header">
                    <h3>Privacy & Security</h3>
                    <p>Manage your account security and data privacy settings</p>
                  </div>
                  
                  <div className="privacy-settings">
                    <div className="privacy-card">
                      <FaShieldAlt className="privacy-icon" />
                      <div className="privacy-content">
                        <h4>Data Privacy</h4>
                        <p>Your medical data is encrypted and protected according to healthcare privacy standards</p>
                      </div>
                    </div>
                    
                    <div className="privacy-card">
                      <FaUser className="privacy-icon" />
                      <div className="privacy-content">
                        <h4>Profile Visibility</h4>
                        <p>Control who can see your profile information and medical history</p>
                      </div>
                    </div>
                    
                    <div className="privacy-card">
                      <FaIdCard className="privacy-icon" />
                      <div className="privacy-content">
                        <h4>Account Security</h4>
                        <p>Your account is secured with industry-standard encryption and security measures</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Edit Profile</h2>
              <button className="close-btn" onClick={() => setShowEditModal(false)}>
                <FaTimes />
              </button>
            </div>
            
            <form onSubmit={handleUpdateProfile} className="modal-form">
              <div className="form-grid">
                <div className="form-group">
                  <label>Full Name</label>
                  <input 
                    type="text" 
                    name="editName"
                    defaultValue={userData.full_name} 
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>Phone Number</label>
                  <input 
                    type="text" 
                    name="editPhone"
                    defaultValue={userData.phone} 
                    required
                  />
                </div>
                
                <div className="form-group full-width">
                  <label>Address</label>
                  <textarea 
                    name="editAddress"
                    defaultValue={userData.address || ''} 
                    rows="3"
                  />
                </div>
                
                <div className="form-group">
                  <label>Blood Group</label>
                  <input 
                    type="text" 
                    name="editBloodGroup"
                    defaultValue={userData.blood_group || ''} 
                    placeholder="e.g., A+"
                  />
                </div>
              </div>
              
              {error && <div className="error-message">{error}</div>}
              
              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn-outline"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={isLoading}
                >
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Appointment Details Modal */}
      {showAppointmentDetails && selectedAppointment && (
        <div className="modal-overlay" onClick={closeAppointmentDetails}>
          <div className="modal large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Appointment Details</h2>
              <button className="close-btn" onClick={closeAppointmentDetails}>
                <FaTimes />
              </button>
            </div>
            
            <div className="appointment-details">
              <div className="detail-section">
                <h3>Patient Information</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="label">Patient Name:</span>
                    <span className="value">{selectedAppointment.patient_name || userData?.full_name}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Phone:</span>
                    <span className="value">{selectedAppointment.patient_phone || userData?.phone || 'N/A'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Booking Type:</span>
                    <span className="value">{selectedAppointment.booking_type === 'disease' ? 'By Disease/Department' : 'By Doctor'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">For:</span>
                    <span className="value">{selectedAppointment.is_for_self ? 'Self' : selectedAppointment.patient_relation || 'Family Member'}</span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3>Medical Reason</h3>
                <div className="reason-box">
                  <p>{selectedAppointment.reason || 'General consultation'}</p>
                </div>
              </div>

              <div className="detail-section">
                <h3>Appointment Information</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="label">Token Number:</span>
                    <span className="value token-number">#{selectedAppointment.token_number}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Doctor:</span>
                    <span className="value">{selectedAppointment.doctor_name || selectedAppointment.doctor?.full_name || 'N/A'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Specialty:</span>
                    <span className="value">{selectedAppointment.doctor_specialty || selectedAppointment.doctor?.specialty || 'N/A'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Department:</span>
                    <span className="value">{selectedAppointment.department_name || selectedAppointment.department?.name || 'N/A'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Date:</span>
                    <span className="value">
                      {new Date(selectedAppointment.appointment_date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Time Slot:</span>
                    <span className="value">{selectedAppointment.time_slot || 'N/A'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Status:</span>
                    <span 
                      className="value status"
                      style={{ color: getStatusColor(selectedAppointment.status) }}
                    >
                      {getStatusIcon(selectedAppointment.status)}
                      {selectedAppointment.status || 'N/A'}
                    </span>
                  </div>
                  {selectedAppointment.queue_position && (
                    <div className="detail-item">
                      <span className="label">Queue Position:</span>
                      <span className="value">{selectedAppointment.queue_position}</span>
                    </div>
                  )}
                </div>
              </div>

              {(selectedAppointment.prescription || selectedAppointment.notes) && (
                <div className="detail-section">
                  <h3>Prescription & Notes</h3>
                  {selectedAppointment.prescription && (
                    <div className="prescription-box">
                      <strong>Prescription:</strong>
                      <p>{selectedAppointment.prescription}</p>
                    </div>
                  )}
                  {selectedAppointment.notes && (
                    <div className="notes-box">
                      <strong>Doctor's Notes:</strong>
                      <p>{selectedAppointment.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-actions">
              {selectedAppointment && (selectedAppointment.status === 'scheduled' || selectedAppointment.status === 'confirmed') && (
                <button 
                  className="btn-outline cancel-btn"
                  onClick={() => {
                    closeAppointmentDetails();
                    handleCancelAppointment(selectedAppointment.id);
                  }}
                >
                  Cancel Appointment
                </button>
              )}
              <button className="btn-primary" onClick={closeAppointmentDetails}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MyProfilePage;