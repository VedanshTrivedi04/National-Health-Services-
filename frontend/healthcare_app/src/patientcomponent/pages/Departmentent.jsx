import React, { useState, useEffect } from 'react';
import { useData } from '../../contexts/DataContext';
import { useNavigate } from 'react-router-dom';
import "./main.css"
import "./dasboard.css"
import { 
  FaStethoscope, 
  FaUserMd, 
  FaClock, 
  FaStar, 
  FaArrowRight,
  FaSearch,
  FaFilter,
  FaHospital,
  FaHeartbeat,
  FaBrain,
  FaBaby,
  FaEye,
  FaTooth,
  FaBone,
  FaAllergies,
  FaProcedures
} from 'react-icons/fa';

const Departmentent = () => {
  const {
    doctors,
    departments,
    fetchDoctors,
    fetchDepartments,
    isLoading,
    error,
  } = useData();

  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [filteredDoctors, setFilteredDoctors] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [queue, setQueue] = useState(null);
  const [highlightToken, setHighlightToken] = useState(null);

  const navigate = useNavigate();

  // Department icons mapping
  const departmentIcons = {
    'cardiology': <FaHeartbeat />,
    'neurology': <FaBrain />,
    'pediatrics': <FaBaby />,
    'ophthalmology': <FaEye />,
    'dentistry': <FaTooth />,
    'orthopedics': <FaBone />,
    'dermatology': <FaAllergies />,
    'surgery': <FaProcedures />,
    'default': <FaHospital />
  };

  // ✅ Fetch all departments and doctors once when component mounts
  useEffect(() => {
    fetchDepartments();
    fetchDoctors();
  }, [fetchDepartments, fetchDoctors]);

  // ✅ Handle department click
  const handleSelectDepartment = async (deptId) => {
    setSelectedDepartment(deptId);
    await fetchDoctors(deptId); // Fetch doctors by department
    setSearchTerm(''); // Clear search when selecting department
  };

  // ✅ Filter doctors for selected department and search
  useEffect(() => {
    let filtered = doctors;
    
    // Filter by selected department
    if (selectedDepartment) {
      filtered = filtered.filter(
        (doc) =>
          doc.department === selectedDepartment ||
          doc.department?.id === selectedDepartment
      );
    }
    
    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(doc =>
        doc.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.specialty?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.department_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    setFilteredDoctors(filtered);
  }, [selectedDepartment, doctors, searchTerm]);

  const getDepartmentIcon = (departmentName) => {
    if (!departmentName) return departmentIcons.default;
    
    const deptKey = departmentName.toLowerCase();
    return departmentIcons[deptKey] || departmentIcons.default;
  };

  const handleBookAppointment = (doctor) => {
    navigate('/appointment', { 
      state: { 
        selectedDoctor: doctor,
        selectedDepartment: selectedDepartment 
      } 
    });
  };

  const clearFilters = () => {
    setSelectedDepartment(null);
    setSearchTerm('');
  };

  return (
    <div className="departments-container">
      {/* Header Section */}
      <div className="departments-header">
        <div className="header-content">
          <h1>Medical Departments</h1>
          <p>Explore our specialized healthcare departments and find the right doctor for your needs</p>
        </div>
      </div>

      <div className="departments-content">
        {/* Search and Filter Section */}
        <div className="search-filter-section">
          <div className="search-box">
            <FaSearch className="search-icon" />
            <input
              type="text"
              placeholder="Search doctors by name, specialty, or department..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          
          {(selectedDepartment || searchTerm) && (
            <button className="clear-filters-btn" onClick={clearFilters}>
              Clear Filters
            </button>
          )}
        </div>

        {/* Main Content Grid */}
        <div className="departments-layout">
          {/* Departments Sidebar */}
          <div className="departments-sidebar">
            <div className="sidebar-header">
              <FaFilter className="sidebar-icon" />
              <h3>Specialties</h3>
            </div>
            
            {isLoading ? (
              <div className="loading-section">
                <div className="loading-spinner"></div>
                <p>Loading departments...</p>
              </div>
            ) : error ? (
              <div className="error-section">
                <p className="error-text">{error}</p>
              </div>
            ) : (
              <div className="departments-list">
                <div 
                  className={`department-item ${!selectedDepartment ? 'active' : ''}`}
                  onClick={() => setSelectedDepartment(null)}
                >
                  <div className="department-icon all-departments">
                    <FaHospital />
                  </div>
                  <div className="department-info">
                    <span className="department-name">All Departments</span>
                    <span className="doctor-count">{doctors.length} doctors</span>
                  </div>
                </div>

                {departments.map((dept) => (
                  <div
                    key={dept.id}
                    className={`department-item ${
                      selectedDepartment === dept.id ? 'active' : ''
                    }`}
                    onClick={() => handleSelectDepartment(dept.id)}
                  >
                    <div className="department-icon">
                      {getDepartmentIcon(dept.name)}
                    </div>
                    <div className="department-info">
                      <span className="department-name">{dept.name}</span>
                      <span className="department-description">
                        {dept.description || 'Specialized medical care'}
                      </span>
                      <span className="doctor-count">
                        {doctors.filter(doc => 
                          doc.department === dept.id || doc.department?.id === dept.id
                        ).length} doctors
                      </span>
                    </div>
                    <FaArrowRight className="arrow-icon" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Doctors Main Content */}
          <div className="doctors-main">
            <div className="doctors-header">
              <h2>
                {selectedDepartment 
                  ? departments.find(dept => dept.id === selectedDepartment)?.name + ' Department'
                  : 'All Doctors'
                }
              </h2>
              <p>
                {filteredDoctors.length} {filteredDoctors.length === 1 ? 'doctor' : 'doctors'} available
              </p>
            </div>

            {filteredDoctors.length === 0 ? (
              <div className="no-doctors-section">
                <FaUserMd className="no-doctors-icon" />
                <h3>No Doctors Found</h3>
                <p>
                  {searchTerm 
                    ? `No doctors found matching "${searchTerm}". Try a different search term.`
                    : 'No doctors available in this department at the moment.'
                  }
                </p>
                <button className="btn-primary" onClick={clearFilters}>
                  View All Doctors
                </button>
              </div>
            ) : (
              <div className="doctors-grid">
                {filteredDoctors.map((doc) => (
                  <div className="doctor-card" key={doc.id}>
                    <div className="doctor-header">
                      <div className="doctor-avatar">
                        {doc.profile_image ? (
                          <img src={doc.profile_image} alt={doc.full_name} />
                        ) : (
                          <FaUserMd className="avatar-icon" />
                        )}
                      </div>
                      <div className="doctor-basic-info">
                        <h3>{doc.full_name || doc.user?.full_name || 'Doctor'}</h3>
                        <p className="doctor-specialty">
                          {doc.specialty || doc.department_name || 'General Physician'}
                        </p>
                        <div className="doctor-rating">
                          <FaStar className="star-icon" />
                          <span>4.8 • 120 reviews</span>
                        </div>
                      </div>
                    </div>

                    <div className="doctor-details">
                      <div className="detail-item">
                        <FaStethoscope className="detail-icon" />
                        <span>{doc.department_name || doc.department?.name || 'General'}</span>
                      </div>
                      <div className="detail-item">
                        <FaClock className="detail-icon" />
                        <span>Mon - Fri • 10:00 AM - 6:00 PM</span>
                      </div>
                      <div className="detail-item">
                        <div className="availability-badge available">
                          Available Today
                        </div>
                      </div>
                    </div>

                    <div className="doctor-actions">
                      <button 
                        className="btn-outline"
                        onClick={() => navigate('/doctor/' + doc.id)}
                      >
                        View Profile
                      </button>
                      <button 
                        className="btn-primary"
                        onClick={() => handleBookAppointment(doc)}
                      >
                        Book Appointment
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats Section */}
        <div className="stats-section">
          <div className="stat-card">
            <div className="stat-icon">
              <FaUserMd />
            </div>
            <div className="stat-content">
              <h3>{doctors.length}+</h3>
              <p>Expert Doctors</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">
              <FaHospital />
            </div>
            <div className="stat-content">
              <h3>{departments.length}+</h3>
              <p>Medical Departments</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">
              <FaStethoscope />
            </div>
            <div className="stat-content">
              <h3>24/7</h3>
              <p>Emergency Care</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Departmentent;