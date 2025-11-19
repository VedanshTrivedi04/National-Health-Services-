  // src/pages/MyProfilePage.jsx
  import React, { useState, useEffect } from 'react';
  import { useNavigate } from 'react-router-dom';
  import { useAuth } from '../../contexts/AuthContext';
  import apiService from '../../services/api';
  import './myprofile.css'; // Import page-specific styles

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

    if (!userData || isLoading) {
      return (
        <div className="container" style={{ padding: '50px', textAlign: 'center' }}>
          <h2>Loading Profile...</h2>
          {error && <div className="error" style={{color: 'red'}}>{error}</div>}
        </div>
      );
    }

    return (
      <>
        <section className="profile-section">
          <div className="container">
            <div className="section-title">
              <h1>My Profile</h1>
              <p>Manage your personal information, appointment history, and privacy settings</p>
            </div>
            
            <div className="profile-content">
              <div className="profile-card">
                <div className="profile-header">
                  <div className="profile-avatar"><i className="fas fa-user"></i></div>
                  <div className="profile-name">{userData.full_name}</div>
                  <div className="profile-id">Patient ID: {userData.id}</div>
                </div>
                
                <div className="profile-details">
                  <div className="detail-group">
                    <div className="detail-title">Personal Information</div>
                    <div className="detail-item">
                      <div className="detail-label">Full Name:</div>
                      <div className="detail-value">{userData.full_name}</div>
                    </div>
                    <div className="detail-item">
                      <div className="detail-label">Date of Birth:</div>
                      <div className="detail-value">{userData.date_of_birth || 'Not provided'}</div>
                    </div>
                    <div className="detail-item">
                      <div className="detail-label">Gender:</div>
                      <div className="detail-value">{userData.gender || 'Not provided'}</div>
                    </div>
                    <div className="detail-item">
                      <div className="detail-label">Blood Group:</div>
                      <div className="detail-value">{userData.blood_group || 'Not provided'}</div>
                    </div>
                  </div>
                  <div className="detail-group">
                    <div className="detail-title">Contact Information</div>
                    <div className="detail-item">
                      <div className="detail-label">Mobile:</div>
                      <div className="detail-value">{userData.phone}</div>
                    </div>
                    <div className="detail-item">
                      <div className="detail-label">Email:</div>
                      <div className="detail-value">{userData.email}</div>
                    </div>
                    <div className="detail-item">
                      <div className="detail-label">Address:</div>
                      <div className="detail-value">{userData.address || 'Not provided'}</div>
                    </div>
                  </div>
                </div>
                
                <div className="profile-actions">
                  <button className="btn btn-primary" onClick={() => setShowEditModal(true)}>Edit Profile</button>
                  <button className="btn btn-outline" onClick={handleLogout}>Logout</button>
                </div>
              </div>
              
              <div className="profile-tabs-container">
                <div className="profile-tabs">
                  <button 
                    className={`profile-tab ${activeTab === 'appointments' ? 'active' : ''}`}
                    onClick={() => setActiveTab('appointments')}
                  >
                    Appointment History
                  </button>
                  <button 
                    className={`profile-tab ${activeTab === 'medical' ? 'active' : ''}`}
                    onClick={() => setActiveTab('medical')}
                  >
                    Medical History
                  </button>
                  <button 
                    className={`profile-tab ${activeTab === 'privacy' ? 'active' : ''}`}
                    onClick={() => setActiveTab('privacy')}
                  >
                    Privacy Settings
                  </button>
                </div>
                
                {activeTab === 'appointments' && (
                  <div className="tab-content active" id="appointmentsTab">
                    <div className="appointment-list">
                      {isLoading ? (
                        <p>Loading appointments...</p>
                      ) : appointments.length > 0 ? (
                        appointments.map(appt => (
                          <div className="appointment-card" key={appt.id}>
                            <div className="appointment-header">
                              <div 
                                className="appointment-token clickable"
                                onClick={() => handleAppointmentClick(appt.id)}
                                title="Click to view details"
                              >
                                Token: {appt.token_number || 'N/A'}
                              </div>
                              <div className={`appointment-status ${appt.status?.toLowerCase() || ''}`}>
                                {appt.status || 'N/A'}
                              </div>
                            </div>
                            <div className="appointment-details">
                              <div className="appointment-doctor">
                                <strong>{appt.doctor_name || appt.doctor?.full_name || 'Dr. Unknown'}</strong>
                                {appt.doctor_specialty && ` - ${appt.doctor_specialty}`}
                              </div>
                              <div className="appointment-date">
                                {new Date(appt.appointment_date).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })} {appt.time_slot && `at ${appt.time_slot}`}
                              </div>
                              {appt.reason && (
                                <div className="appointment-reason">Reason: {appt.reason}</div>
                              )}
                            </div>
                            {/* Cancel button - only show for scheduled or confirmed appointments */}
                            {(appt.status === 'scheduled' || appt.status === 'confirmed') && (
                              <div className="appointment-actions">
                                <button 
                                  className="btn btn-outline btn-cancel" 
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
                        <p>No appointments found. Book your first appointment!</p>
                      )}
                    </div>
                  </div>
                )}
                
                {activeTab === 'medical' && (
                  <div className="tab-content active" id="medicalTab">
                    {isLoading ? (
                      <p>Loading medical history...</p>
                    ) : medicalHistory && medicalHistory.length > 0 ? (
                      medicalHistory.map(record => (
                        <div className="medical-record-card" key={record.id}>
                          <div className="record-header">
                            <div className="record-date">
                              {new Date(record.visit_date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </div>
                            <div className="record-doctor">
                              Dr. {record.doctor_name || record.doctor?.full_name || 'Unknown'}
                            </div>
                          </div>
                          <div className="record-details">
                            {record.diagnosis && (
                              <div className="record-diagnosis">
                                <strong>Diagnosis:</strong> {record.diagnosis}
                              </div>
                            )}
                            {record.symptoms && (
                              <div className="record-symptoms">
                                <strong>Symptoms:</strong> {record.symptoms}
                              </div>
                            )}
                            {record.treatment_plan && (
                              <div className="record-treatment">
                                <strong>Treatment:</strong> {record.treatment_plan}
                              </div>
                            )}
                            {record.prescriptions && Array.isArray(record.prescriptions) && record.prescriptions.length > 0 && (
                              <div className="record-prescriptions">
                                <strong>Prescriptions:</strong>
                                <ul>
                                  {record.prescriptions.map((prescription, index) => (
                                    <li key={index}>{prescription}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {record.notes && (
                              <div className="record-notes">
                                <strong>Notes:</strong> {record.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p>No medical records found. Your medical history will appear here after consultations.</p>
                    )}
                  </div>
                )}
                
                {activeTab === 'privacy' && (
                  <div className="tab-content active" id="privacyTab">
                    {/* Privacy settings content */}
                    <div className="privacy-settings">
                        <div className="privacy-group">
                          <h3 className="privacy-title">Profile Visibility</h3>
                          <div className="privacy-option">
                            {/* ... privacy options ... */}
                          </div>
                        </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {showEditModal && (
          <div className="modal-overlay active" id="editProfileModal">
            <div className="modal-content">
              <div className="modal-header">
                <h2 className="modal-title">Edit Profile</h2>
                <button className="modal-close" onClick={() => setShowEditModal(false)}>&times;</button>
              </div>
              
              <form id="editProfileForm" onSubmit={handleUpdateProfile}>
                <div className="form-group">
                  <label htmlFor="editName" className="form-label">Full Name</label>
                  <input 
                    type="text" 
                    id="editName" 
                    name="editName"
                    className="form-control" 
                    defaultValue={userData.full_name} 
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="editPhone" className="form-label">Phone</label>
                  <input 
                    type="text" 
                    id="editPhone" 
                    name="editPhone"
                    className="form-control" 
                    defaultValue={userData.phone} 
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="editAddress" className="form-label">Address</label>
                  <textarea 
                    id="editAddress" 
                    name="editAddress"
                    className="form-control" 
                    rows="3"
                    defaultValue={userData.address || ''} 
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="editBloodGroup" className="form-label">Blood Group</label>
                  <input 
                    type="text" 
                    id="editBloodGroup" 
                    name="editBloodGroup"
                    className="form-control" 
                    defaultValue={userData.blood_group || ''} 
                  />
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn btn-outline" onClick={() => setShowEditModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={isLoading}>
                    {isLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Appointment Details Modal */}
        {showAppointmentDetails && selectedAppointment && (
          <div className="modal-overlay active" onClick={closeAppointmentDetails}>
            <div className="modal-content appointment-details-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Appointment Details</h2>
                <button className="modal-close" onClick={closeAppointmentDetails}>&times;</button>
              </div>
              
              <div className="appointment-details-content">
                {/* Patient Information Section */}
                <div className="details-section">
                  <h3 className="section-title">Patient Information</h3>
                  <div className="details-grid">
                    <div className="detail-row">
                      <span className="detail-label">Patient Name:</span>
                      <span className="detail-value">{selectedAppointment.patient_name || userData?.full_name}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Patient Phone:</span>
                      <span className="detail-value">{selectedAppointment.patient_phone || userData?.phone || 'N/A'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Booking Type:</span>
                      <span className="detail-value">{selectedAppointment.booking_type === 'disease' ? 'By Disease/Department' : 'By Doctor'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">For:</span>
                      <span className="detail-value">{selectedAppointment.is_for_self ? 'Self' : selectedAppointment.patient_relation || 'Family Member'}</span>
                    </div>
                  </div>
                </div>

                {/* Disease/Reason Section */}
                <div className="details-section">
                  <h3 className="section-title">Medical Reason</h3>
                  <div className="reason-box">
                    <p>{selectedAppointment.reason || 'General consultation'}</p>
                  </div>
                </div>

                {/* Appointment Information Section */}
                <div className="details-section">
                  <h3 className="section-title">Appointment Information</h3>
                  <div className="details-grid">
                    <div className="detail-row">
                      <span className="detail-label">Token Number:</span>
                      <span className="detail-value">{selectedAppointment.token_number}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Doctor:</span>
                      <span className="detail-value">{selectedAppointment.doctor_name || selectedAppointment.doctor?.full_name || 'N/A'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Specialty:</span>
                      <span className="detail-value">{selectedAppointment.doctor_specialty || selectedAppointment.doctor?.specialty || 'N/A'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Department:</span>
                      <span className="detail-value">{selectedAppointment.department_name || selectedAppointment.department?.name || 'N/A'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Date:</span>
                      <span className="detail-value">
                        {new Date(selectedAppointment.appointment_date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Time Slot:</span>
                      <span className="detail-value">{selectedAppointment.time_slot || 'N/A'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Status:</span>
                      <span className={`detail-value status-badge ${selectedAppointment.status?.toLowerCase()}`}>
                        {selectedAppointment.status || 'N/A'}
                      </span>
                    </div>
                    {selectedAppointment.queue_position && (
                      <div className="detail-row">
                        <span className="detail-label">Queue Position:</span>
                        <span className="detail-value">{selectedAppointment.queue_position}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Prescription/Notes Section (if available) */}
                {(selectedAppointment.prescription || selectedAppointment.notes) && (
                  <div className="details-section">
                    <h3 className="section-title">Prescription & Notes</h3>
                    {selectedAppointment.prescription && (
                      <div className="reason-box">
                        <p><strong>Prescription:</strong> {selectedAppointment.prescription}</p>
                      </div>
                    )}
                    {selectedAppointment.notes && (
                      <div className="reason-box">
                        <p><strong>Notes:</strong> {selectedAppointment.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="modal-actions">
                {selectedAppointment && (selectedAppointment.status === 'scheduled' || selectedAppointment.status === 'confirmed') && (
                  <button 
                    type="button" 
                    className="btn btn-outline btn-cancel" 
                    onClick={() => {
                      closeAppointmentDetails();
                      handleCancelAppointment(selectedAppointment.id);
                    }}
                  >
                    Cancel Appointment
                  </button>
                )}
                <button type="button" className="btn btn-primary" onClick={closeAppointmentDetails}>Close</button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  export default MyProfilePage;