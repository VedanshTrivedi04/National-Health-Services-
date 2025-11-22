// src/components/Appointment.jsx
import React, { useState, useEffect, useMemo } from 'react';
import './Appointment.css';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/api';

// Icons (you can replace with actual icon library)
const Icons = {
    user: '👤',
    users: '👥',
    disease: '🩺',
    doctor: '🥼',
    calendar: '📅',
    time: '⏰',
    check: '✅',
    arrowLeft: '←',
    arrowRight: '→',
    lock: '🔒'
};

const AppointmentPage = () => {
    const { doctors, departments, fetchDoctors, fetchDepartments, isLoading } = useData();
    const { user, isAuthenticated } = useAuth();

    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);

    const [currentStep, setCurrentStep] = useState(1);
    const [selectedPatient, setSelectedPatient] = useState('yourself');
    const [selectedMethod, setSelectedMethod] = useState('disease');
    const [selectedDepartment, setSelectedDepartment] = useState(null);
    const [selectedDoctor, setSelectedDoctor] = useState(null);
    const [selectedDate, setSelectedDate] = useState(null);

    const [assignedTime, setAssignedTime] = useState(null);
    const [token, setToken] = useState(null);

    const [showPopup, setShowPopup] = useState(false);
    const [isBooking, setIsBooking] = useState(false);

    const [availableSlots, setAvailableSlots] = useState([]);
    const [loadingSlots, setLoadingSlots] = useState(false);

    const [patientName, setPatientName] = useState('');
    const [patientAge, setPatientAge] = useState('');
    const [patientGender, setPatientGender] = useState('');
    const [patientAadhaar, setPatientAadhaar] = useState('');
    const [patientRelation, setPatientRelation] = useState('');

    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

    useEffect(() => {
        if (isAuthenticated && user) {
            setIsLoggedIn(true);
            setCurrentUser({
                id: user.id,
                name: user.full_name,
                email: user.email,
                phone: user.phone,
                aadhaar: user?.aadhaar_number || ''
            });
        }
        fetchDepartments();
        fetchDoctors();
    }, [isAuthenticated, user, fetchDepartments, fetchDoctors]);

    const handleSelectPatient = (patientType) => setSelectedPatient(patientType);

    const handleSelectBookingMethod = async (method) => {
        setSelectedMethod(method);
        setSelectedDepartment(null);
        setSelectedDoctor(null);

        if (method === 'doctor') {
            await fetchDoctors();
        }
    };

    const handleSelectDepartment = async (departmentId) => {
        setSelectedDepartment(departmentId);
        const filtered = await fetchDoctors(departmentId);
        if (filtered && filtered.length > 0) {
            setSelectedDoctor(filtered[0]);
        } else {
            setSelectedDoctor(null);
        }
    };

    const handleSelectDoctor = (doctorId) => {
        const doctor = doctors.find(d => Number(d.id) === Number(doctorId));
        setSelectedDoctor(doctor || null);
        const deptId = doctor?.department_id ?? doctor?.department?.id ?? null;
        if (deptId) {
            setSelectedDepartment(Number(deptId));
        } else {
            console.warn('Doctor has no department assigned', doctor);
            setSelectedDepartment(null);
        }
    };

    // Fetch available slots
    const fetchAvailableSlots = async (doctorId, date) => {
        if (!doctorId || !date) {
            setAvailableSlots([]);
            return;
        }
        setLoadingSlots(true);
        try {
            const dateStr = date.toISOString().split('T')[0];
            const response = await apiService.getAvailableSlots(doctorId, dateStr);
            const slots = response?.available_slots ?? response?.results ?? response?.slots ?? [];
            setAvailableSlots(Array.isArray(slots) ? slots : []);
        } catch (err) {
            console.error('Failed to fetch slots:', err);
            setAvailableSlots([]);
        } finally {
            setLoadingSlots(false);
        }
    };

    useEffect(() => {
        if (!selectedDate) return;

        const today = new Date().toISOString().split("T")[0];
        const selected = selectedDate.toISOString().split("T")[0];

        // 🔥 1. FOR TODAY — allow booking even after 12PM
        if (today === selected) {
            if (availableSlots.length > 0) {
                const first = availableSlots[0];
                setAssignedTime(first?.value ?? first?.time ?? null);
            } else {
                // 🔥 forced fallback time for same-day booking
                setAssignedTime("09:00");
            }
            return;
        }

        // 🔥 2. FOR FUTURE DATES — old logic
        if (availableSlots.length > 0) {
            const first = availableSlots[0];
            setAssignedTime(first?.value ?? first?.time ?? null);
        } else {
            // 🔥 if no slots for future date, still allow booking
            setAssignedTime("09:00");
        }
    }, [availableSlots, selectedDate]);


    useEffect(() => {
        if (selectedDate && selectedDoctor?.id) {
            fetchAvailableSlots(selectedDoctor.id, selectedDate);
        } else {
            setAvailableSlots([]);
        }
    }, [selectedDate, selectedDoctor]);

    const handleSelectDate = (date) => {
        setSelectedDate(date);
    };

    const handlePrevMonth = () => {
        const today = new Date();
        if (currentYear === today.getFullYear() && currentMonth === today.getMonth()) return;
        setCurrentMonth(prev => prev === 0 ? (setCurrentYear(y => y - 1), 11) : prev - 1);
    };

    const handleNextMonth = () => {
        setCurrentMonth(prev => prev === 11 ? (setCurrentYear(y => y + 1), 0) : prev + 1);
    };

    const nextToStep2 = () => {
        if (selectedPatient === 'someoneElse') {
            if (!patientName || !patientAge || !patientGender || !patientAadhaar) {
                alert('Please fill all patient details');
                return;
            }
        }
        setCurrentStep(2);
    };

    const nextToStep3 = () => setCurrentStep(3);
    const nextToStep4 = () => {
        if (!selectedDoctor) {
            alert('Please select a doctor');
            return;
        }
        setCurrentStep(4);
    };

   const confirmBooking = async () => {
    if (!selectedDoctor || !selectedDate) {
        alert('Please select a doctor and date');
        return;
    }

    const departmentId =
        selectedDoctor?.department_id ??
        selectedDoctor?.department?.id ??
        selectedDepartment;

    const timeSlotPayload =
        assignedTime
            ? (assignedTime.length === 5 ? `${assignedTime}:00` : assignedTime)
            : null;

    const bookingData = {
        doctor: selectedDoctor.id,
        department: departmentId,
        appointment_date: selectedDate.toISOString().split('T')[0],
        time_slot: timeSlotPayload ?? "09:00:00",
        reason: 'Consultation',
        booking_type: selectedMethod,
        is_for_self: selectedPatient === 'yourself',
        patient_relation: selectedPatient === 'someoneElse' ? patientRelation : '',
    };

    setIsBooking(true);

    try {
        console.log('Creating appointment payload ->', bookingData);

        const response = await apiService.createAppointment(bookingData);

        const payload = response?.data ?? response;
        console.log("🔥 FULL PAYLOAD:", payload);

        // ⭐⭐⭐ FIX: Fetch token from all possible backend formats ⭐⭐⭐
        const extractedToken =
            payload.token_number ||
            payload.token ||
            payload?.appointment?.token_number ||
            payload?.appointment?.token ||
            null;

        console.log("🔥 Extracted token:", extractedToken);

        setToken(extractedToken);
        setShowPopup(true);

    } catch (error) {
        const serverData = error?.response?.data ?? error?.message ?? error;
        console.error('Booking error:', serverData);
        alert('Failed to create appointment. Please try again.');
    } finally {
        setIsBooking(false);
    }
};


    // Calendar grid generation
    const calendarGrid = useMemo(() => {
        const firstDay = new Date(currentYear, currentMonth, 1).getDay();
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const grid = [];

        ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day =>
            grid.push(<div key={day} className="calendar-day-header">{day}</div>)
        );

        for (let i = 0; i < firstDay; i++)
            grid.push(<div key={`empty-${i}`} className="calendar-date empty"></div>);

        for (let i = 1; i <= daysInMonth; i++) {
            const dateObj = new Date(currentYear, currentMonth, i);
            const isPast = dateObj < today;
            const isToday = dateObj.toDateString() === today.toDateString();
            grid.push(
                <div
                    key={i}
                    className={`calendar-date ${isPast ? 'disabled' : ''} ${isToday ? 'today' : ''} ${selectedDate?.toDateString() === dateObj.toDateString() ? 'active' : ''}`}
                    onClick={() => !isPast && handleSelectDate(dateObj)}
                >
                    {i}
                    {isToday && <div className="today-indicator">Today</div>}
                </div>
            );
        }
        return grid;
    }, [currentMonth, currentYear, selectedDate]);

    const summaryDateTime = useMemo(() => {
        if (selectedDate && assignedTime) {
            const slot = availableSlots.find(s => (s.value ?? s.time) === assignedTime);
            return `${selectedDate.toDateString()} at ${slot?.display ?? slot?.label ?? assignedTime}`;
        }
        return '';
    }, [selectedDate, assignedTime, availableSlots]);

    // Step titles for progress indicator
    const steps = [
        { number: 1, title: 'Patient Info' },
        { number: 2, title: 'Booking Method' },
        { number: 3, title: 'Select Doctor' },
        { number: 4, title: 'Date & Time' }
    ];

    if (!isAuthenticated) {
        return (
            <div className="appointment-container">
                <div className="auth-required-card">
                    <div className="auth-icon">{Icons.lock}</div>
                    <h2>Authentication Required</h2>
                    <p>Please login to book an appointment with our healthcare providers.</p>
                    <a href="/login" className="btn btn-primary">Login to Continue</a>
                </div>
            </div>
        );
    }

    return (
        <div className="appointment-container">
            
            {/* Header with Progress Steps */}
            <div className="appointment-header">
                <h1>Book Your Appointment</h1>
                <div className="progress-steps">
                    {steps.map(step => (
                        <div key={step.number} className={`step ${currentStep === step.number ? 'active' : ''} ${currentStep > step.number ? 'completed' : ''}`}>
                            <div className="step-number">
                                {currentStep > step.number ? Icons.check : step.number}
                            </div>
                            <span className="step-title">{step.title}</span>
                        </div>
                    ))}
                </div>
                
            </div>

            {/* Main Content Area */}
            <div className="appointment-content">

                {/* Step 1: Patient Selection */}
                <div className={`step-content ${currentStep === 1 ? 'active' : ''}`}>
                    <div className="step-card">
                        <h2>Who is this appointment for?</h2>
                        <p className="step-description">Select the patient for this medical consultation</p>

                        <div className="selection-grid">
                            <div
                                className={`selection-card ${selectedPatient === 'yourself' ? 'selected' : ''}`}
                                onClick={() => handleSelectPatient('yourself')}
                            >
                                <div className="card-icon">{Icons.user}</div>
                                <h3>For Yourself</h3>
                                <p>Book appointment using your profile</p>
                                {selectedPatient === 'yourself' && <div className="selection-badge">Selected</div>}
                            </div>

                            <div
                                className={`selection-card ${selectedPatient === 'someoneElse' ? 'selected' : ''}`}
                                onClick={() => handleSelectPatient('someoneElse')}
                            >
                                <div className="card-icon">{Icons.users}</div>
                                <h3>For Someone Else</h3>
                                <p>Book for family member or dependent</p>
                                {selectedPatient === 'someoneElse' && <div className="selection-badge">Selected</div>}
                            </div>
                        </div>

                        {/* Additional Patient Details */}
                        {selectedPatient === 'someoneElse' && (
                            <div className="patient-details-card">
                                <h3>Patient Information</h3>
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label>Full Name</label>
                                        <input
                                            type="text"
                                            placeholder="Enter patient's full name"
                                            value={patientName}
                                            onChange={e => setPatientName(e.target.value)}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Age</label>
                                        <input
                                            type="number"
                                            placeholder="Age"
                                            value={patientAge}
                                            onChange={e => setPatientAge(e.target.value)}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Gender</label>
                                        <select
                                            value={patientGender}
                                            onChange={e => setPatientGender(e.target.value)}
                                        >
                                            <option value="">Select Gender</option>
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Aadhaar Number</label>
                                        <input
                                            type="text"
                                            placeholder="12-digit Aadhaar"
                                            value={patientAadhaar}
                                            onChange={e => setPatientAadhaar(e.target.value)}
                                        />
                                    </div>
                                    <div className="form-group full-width">
                                        <label>Relationship</label>
                                        <input
                                            type="text"
                                            placeholder="e.g., Son, Daughter, Father, etc."
                                            value={patientRelation}
                                            onChange={e => setPatientRelation(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="step-actions">
                            <button className="btn btn-next" onClick={nextToStep2}>
                                Continue {Icons.arrowRight}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Step 2: Booking Method */}
                <div className={`step-content ${currentStep === 2 ? 'active' : ''}`}>
                    <div className="step-card">
                        <h2>How would you like to book?</h2>
                        <p className="step-description">Choose your preferred booking method</p>

                        <div className="selection-grid">
                            <div
                                className={`selection-card ${selectedMethod === 'disease' ? 'selected' : ''}`}
                                onClick={() => handleSelectBookingMethod('disease')}
                            >
                                <div className="card-icon">{Icons.disease}</div>
                                <h3>By Medical Department</h3>
                                <p>Select based on your symptoms or condition</p>
                                {selectedMethod === 'disease' && <div className="selection-badge">Selected</div>}
                            </div>

                            <div
                                className={`selection-card ${selectedMethod === 'doctor' ? 'selected' : ''}`}
                                onClick={() => handleSelectBookingMethod('doctor')}
                            >
                                <div className="card-icon">{Icons.doctor}</div>
                                <h3>By Specific Doctor</h3>
                                <p>Choose a particular doctor you prefer</p>
                                {selectedMethod === 'doctor' && <div className="selection-badge">Selected</div>}
                            </div>
                        </div>

                        <div className="step-actions">
                            <button className="btn btn-back" onClick={() => setCurrentStep(1)}>
                                {Icons.arrowLeft} Back
                            </button>
                            <button className="btn btn-next" onClick={nextToStep3}>
                                Continue {Icons.arrowRight}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Step 3: Doctor/Department Selection */}
                <div className={`step-content ${currentStep === 3 ? 'active' : ''}`}>
                    <div className="step-card">
                        <h2>
                            {selectedMethod === 'disease' ? 'Select Medical Department' : 'Choose Your Doctor'}
                        </h2>
                        <p className="step-description">
                            {selectedMethod === 'disease'
                                ? 'Find the right department for your healthcare needs'
                                : 'Select from our qualified healthcare professionals'
                            }
                        </p>

                        {!isLoading ? (
                            <div className="selection-list">
                                {selectedMethod === 'disease' ? (
                                    departments.map(dept => (
                                        <div
                                            key={dept.id}
                                            className={`list-item ${selectedDepartment === dept.id ? 'selected' : ''}`}
                                            onClick={() => handleSelectDepartment(dept.id)}
                                        >
                                            <div className="item-content">
                                                <h3>{dept.name}</h3>
                                                <p>{dept.description || 'Specialized medical care'}</p>
                                            </div>
                                            {selectedDepartment === dept.id && <div className="checkmark">{Icons.check}</div>}
                                        </div>
                                    ))
                                ) : (
                                    doctors.map(doctor => (
                                        <div
                                            key={doctor.id}
                                            className={`list-item ${selectedDoctor?.id === doctor.id ? 'selected' : ''}`}
                                            onClick={() => handleSelectDoctor(doctor.id)}
                                        >
                                            <div className="doctor-avatar">
                                                {doctor.full_name.split(' ').map(n => n[0]).join('')}
                                            </div>
                                            <div className="item-content">
                                                <h3>{doctor.full_name}</h3>
                                                <p>{doctor.specialty || 'General Physician'}</p>
                                                <div className="doctor-meta">
                                                    <span className="department">{doctor.department?.name || 'General'}</span>
                                                    <span className="experience">{doctor.experience || '5+ years experience'}</span>
                                                </div>
                                            </div>
                                            {selectedDoctor?.id === doctor.id && <div className="checkmark">{Icons.check}</div>}
                                        </div>
                                    ))
                                )}
                            </div>
                        ) : (
                            <div className="loading-state">
                                <div className="loading-spinner"></div>
                                <p>Loading options...</p>
                            </div>
                        )}

                        <div className="step-actions">
                            <button className="btn btn-back" onClick={() => setCurrentStep(2)}>
                                {Icons.arrowLeft} Back
                            </button>
                            <button className="btn btn-next" onClick={nextToStep4} disabled={!selectedDoctor}>
                                Continue {Icons.arrowRight}
                            </button>
                        </div>
                    </div>
                </div>
                {selectedDate && (() => {
                    const todayStr = new Date().toISOString().split("T")[0];
                    const selStr = selectedDate.toISOString().split("T")[0];

                    if (todayStr === selStr) {
                        return (
                            <p style={{ marginTop: "10px", color: "#0a7" }}>
                                ✔ Same-day booking is allowed. Time will be auto-assigned.
                            </p>
                        );
                    }
                    return null;
                })()}


                {/* Step 4: Date & Time Selection */}
                <div className={`step-content ${currentStep === 4 ? 'active' : ''}`}>
                    <div className="step-card">
                        <h2>Select Date & Time</h2>
                        <p className="step-description">Choose your preferred appointment slot</p>

                        <div className="datetime-selection">
                            {/* Calendar Section */}
                            <div className="calendar-section">
                                <h3>Select Date</h3>
                                <div className="calendar-container">
                                    <div className="calendar-header">
                                        <button className="calendar-nav" onClick={handlePrevMonth}>
                                            {Icons.arrowLeft}
                                        </button>
                                        <div className="calendar-title">
                                            {new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long' })} {currentYear}
                                        </div>
                                        <button className="calendar-nav" onClick={handleNextMonth}>
                                            {Icons.arrowRight}
                                        </button>
                                    </div>
                                    <div className="calendar-grid">
                                        {calendarGrid}
                                    </div>
                                </div>
                            </div>

                            {/* Time Slots Section */}
                            {selectedDate && <p><strong>Selected Date:</strong> {selectedDate.toDateString()}</p>}
                            {loadingSlots && <p>Loading available slots…</p>}

                        </div>

                        {/* Selected Slot Summary */}
                        {assignedTime && (
                            <div className="selected-slot-summary">
                                <h3>Selected Appointment</h3>
                                <div className="appointment-details">
                                    <div className="detail-item">
                                        <span className="label">Doctor:</span>
                                        <span className="value">{selectedDoctor?.full_name}</span>
                                    </div>
                                    <div className="detail-item">
                                        <span className="label">Date:</span>
                                        <span className="value">{selectedDate?.toDateString()}</span>
                                    </div>
                                    <div className="detail-item">
                                        <span className="label">Time:</span>
                                        <span className="value">
                                            {availableSlots.find(s => (s.value ?? s.time) === assignedTime)?.display ?? assignedTime}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="step-actions">
                            <button className="btn btn-back" onClick={() => setCurrentStep(3)}>
                                {Icons.arrowLeft} Back
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={confirmBooking}
                                disabled={isBooking || !selectedDate || !assignedTime}
                            >
                                {isBooking ? (
                                    <>
                                        <div className="loading-spinner-small"></div>
                                        Booking...
                                    </>
                                ) : (
                                    `Confirm Appointment`
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Success Popup */}
            {showPopup && (
                <div className="success-modal">
                    <div className="success-modal-content">
                        <div className="success-icon">{Icons.check}</div>
                        <h2>Appointment Confirmed!</h2>

                        <div className="appointment-summary">
                            <div className="summary-item">
                                <strong>Doctor:</strong> {selectedDoctor?.full_name}
                            </div>
                            <div className="summary-item">
                                <strong>Date & Time:</strong> {summaryDateTime}
                            </div>
                            <div className="summary-item">
                                <strong>Patient:</strong> {selectedPatient === 'yourself' ? currentUser?.name : patientName}
                            </div>
                        </div>

                        <div className="token-container">
                            <div className="token-label">Your Token Number</div>
                            <div className="token-number">{confirmBooking.token_number}</div>
                            <p className="token-instruction">Please arrive 15 minutes before your scheduled time</p>
                        </div>

                        <button
                            className="btn btn-primary"
                            onClick={() => {
                                setShowPopup(false);
                                window.location.href = "/patient/dashboard";
                            }}
                        >
                            Go to Dashboard
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AppointmentPage;