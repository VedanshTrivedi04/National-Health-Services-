// src/components/Appointment.jsx
import React, { useState, useEffect, useMemo } from 'react';
import './Appointment.css';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/api';

const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];

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

    const [assignedTime, setAssignedTime] = useState(null); // values like "09:00"
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
            // make sure doctors list is loaded
            await fetchDoctors();
        }
    };

    const handleSelectDepartment = async (departmentId) => {
        setSelectedDepartment(departmentId);
        // fetch doctors filtered (DataContext returns filtered but doesn't clobber cache)
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

        // Auto assign department using the available fields:
        const deptId = doctor?.department_id ?? doctor?.department?.id ?? null;
        if (deptId) {
            setSelectedDepartment(Number(deptId));
        } else {
            console.warn('Doctor has no department assigned', doctor);
            setSelectedDepartment(null);
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="appointment-section active">
                <div className="login-required active">
                    <div className="login-icon">🔒</div>
                    <h2>Login Required</h2>
                    <p>Please login to book an appointment.</p>
                    <a href="/login" className="btn btn-primary">Go to Login</a>
                </div>
            </div>
        );
    }

    // Fetch available slots from backend (should accept doctor id + date)
    const fetchAvailableSlots = async (doctorId, date) => {
        if (!doctorId || !date) {
            setAvailableSlots([]);
            return;
        }
        setLoadingSlots(true);
        try {
            const dateStr = date.toISOString().split('T')[0];
            const response = await apiService.getAvailableSlots(doctorId, dateStr);
            // Normalize response shape
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
        if (availableSlots.length > 0) {
            // ensure assignedTime exists in one of slot.value or slot.time
            const first = availableSlots[0];
            setAssignedTime(first?.value ?? first?.time ?? null);
        } else {
            setAssignedTime(null);
        }
    }, [availableSlots]);

    useEffect(() => {
        if (selectedDate && selectedDoctor?.id) {
            fetchAvailableSlots(selectedDoctor.id, selectedDate);
        } else {
            setAvailableSlots([]);
        }
    }, [selectedDate, selectedDoctor]);

    const handleSelectDate = (date) => {
        setSelectedDate(date);
        // fetching slots is handled by useEffect (depends on selectedDoctor too)
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
                alert('Fill all details');
                return;
            }
        }
        setCurrentStep(2);
    };

    const nextToStep3 = () => setCurrentStep(3);

    const nextToStep4 = () => {
        if (!selectedDoctor) return alert('Please select a doctor');
        setCurrentStep(4);
    };

    // Confirm booking
    const confirmBooking = async () => {
        if (!selectedDoctor || !selectedDate) {
            alert('Missing required fields');
            return;
        }

        // choose department id in this order: department_id field, nested department object, selectedDepartment fallback
        const departmentId = selectedDoctor?.department_id ?? selectedDoctor?.department?.id ?? selectedDepartment;
        if (!departmentId) {
            console.warn('No department id resolved for doctor; backend may reject booking');
        }

        // Backend expects time as HH:MM:SS or TimeField; assignedTime is "HH:MM" usually — append :00
        const timeSlotPayload = assignedTime ? (assignedTime.length === 5 ? `${assignedTime}:00` : assignedTime) : null;

        const bookingData = {
            doctor: selectedDoctor.id,
            department: departmentId,
            appointment_date: selectedDate.toISOString().split('T')[0],
            time_slot: timeSlotPayload,
            reason: 'Consultation',
            booking_type: selectedMethod,      // ensure not null
            is_for_self: selectedPatient === 'yourself',
            patient_relation: selectedPatient === 'someoneElse' ? patientRelation : '',
        };

        setIsBooking(true);
        try {
            // debug payload
            console.log('Creating appointment payload ->', bookingData);

            const response = await apiService.createAppointment(bookingData);

            // response may be object or wrapped; normalize
            const payload = response?.data ?? response;
            console.log('Appointment created response:', payload);

            setToken(payload.token_number ?? payload.token ?? null);
            setShowPopup(true);
        } catch (error) {
            // show server validation errors if any
            const serverData = error?.response?.data ?? error?.message ?? error;
            console.error('🔥 FULL BACKEND ERROR:', serverData);
            alert('Failed to create appointment. See console for details.');
        } finally {
            setIsBooking(false);
        }
    };

    // calendar grid
    const calendarGrid = useMemo(() => {
        const firstDay = new Date(currentYear, currentMonth, 1).getDay();
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const today = new Date(); today.setHours(0,0,0,0);
        const grid = [];

        ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(day => grid.push(<div key={day} className="calendar-day">{day}</div>));

        for (let i = 0; i < firstDay; i++) grid.push(<div key={`empty-${i}`} className="calendar-date"></div>);

        for (let i = 1; i <= daysInMonth; i++) {
            const dateObj = new Date(currentYear, currentMonth, i);
            const isPast = dateObj < today;
            grid.push(
                <div
                    key={i}
                    className={`calendar-date ${isPast ? 'disabled' : ''} ${selectedDate?.toDateString() === dateObj.toDateString() ? 'active' : ''}`}
                    onClick={() => !isPast && handleSelectDate(dateObj)}
                >
                    {i}
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

    return (
        <div className="appointment-section active">
            {/* STEP 1 */}
            <div className={`step-container ${currentStep === 1 ? 'active' : ''}`}>
                <h2>Select Patient</h2>
                <div className="patient-options">
                    <div className={`patient-option ${selectedPatient === 'yourself' ? 'active' : ''}`} onClick={() => handleSelectPatient('yourself')}>
                        <h3>Yourself</h3>
                    </div>
                    <div className={`patient-option ${selectedPatient === 'someoneElse' ? 'active' : ''}`} onClick={() => handleSelectPatient('someoneElse')}>
                        <h3>Someone Else</h3>
                    </div>
                </div>

                {selectedPatient === 'someoneElse' && (
                    <div className="patient-details-form active">
                        <input placeholder="Name" onChange={e => setPatientName(e.target.value)} />
                        <input placeholder="Age" onChange={e => setPatientAge(e.target.value)} />
                        <select onChange={e => setPatientGender(e.target.value)}>
                            <option value="">Gender</option>
                            <option>Male</option>
                            <option>Female</option>
                        </select>
                        <input placeholder="Aadhaar" onChange={e => setPatientAadhaar(e.target.value)} />
                    </div>
                )}

                <button className="btn btn-primary" onClick={nextToStep2}>Next</button>
            </div>

            {/* STEP 2 */}
            <div className={`step-container ${currentStep === 2 ? 'active' : ''}`}>
                <h2>Select Booking Method</h2>
                <div className="booking-methods">
                    <div className={`booking-method ${selectedMethod === 'disease' ? 'active' : ''}`} onClick={() => handleSelectBookingMethod('disease')}>
                        <h3>By Disease</h3>
                    </div>
                    <div className={`booking-method ${selectedMethod === 'doctor' ? 'active' : ''}`} onClick={() => handleSelectBookingMethod('doctor')}>
                        <h3>By Doctor</h3>
                    </div>
                </div>

                <button className="btn btn-secondary" onClick={() => setCurrentStep(1)}>Back</button>
                <button className="btn btn-primary" onClick={nextToStep3}>Next</button>
            </div>

            {/* STEP 3 */}
            <div className={`step-container ${currentStep === 3 ? 'active' : ''}`}>
                <h2>{selectedMethod === 'disease' ? 'Select Department' : 'Select Doctor'}</h2>

                {!isLoading && (
                    <>
                        {selectedMethod === 'disease' && (
                            <div className="doctor-list">
                                {departments.map(dept => (
                                    <div key={dept.id} className={`doctor-list-item ${selectedDepartment === dept.id ? 'active' : ''}`} onClick={() => handleSelectDepartment(dept.id)}>
                                        <h3>{dept.name}</h3>
                                    </div>
                                ))}
                            </div>
                        )}

                        {selectedMethod === 'doctor' && (
                            <div className="doctor-list">
                                {doctors.map(doc => (
                                    <div key={doc.id} className={`doctor-list-item ${selectedDoctor?.id === doc.id ? 'active' : ''}`} onClick={() => handleSelectDoctor(doc.id)}>
                                        <h3>{doc.full_name}</h3>
                                        <p>{doc.specialty}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}

                <button className="btn btn-secondary" onClick={() => setCurrentStep(2)}>Back</button>
                <button className="btn btn-primary" onClick={nextToStep4}>Next</button>
            </div>

            {/* STEP 4 */}
            <div className={`step-container ${currentStep === 4 ? 'active' : ''}`}>
                <h2>Select Date</h2>

                <div className="calendar">
                    <div className="calendar-header">
                        <button onClick={handlePrevMonth}>‹</button>
                        <div>{monthNames[currentMonth]} {currentYear}</div>
                        <button onClick={handleNextMonth}>›</button>
                    </div>
                    <div className="calendar-grid">{calendarGrid}</div>
                </div>

                {selectedDate && <p><strong>Selected Date:</strong> {selectedDate.toDateString()}</p>}
                {loadingSlots && <p>Loading available slots…</p>}

                {!loadingSlots && assignedTime && (
                    <div className="auto-slot-box">
                        <h3>Assigned Time Slot:</h3>
                        <p><strong>{availableSlots.find(s => (s.value ?? s.time) === assignedTime)?.display ?? assignedTime}</strong></p>
                    </div>
                )}

                {!loadingSlots && !assignedTime && selectedDate && <p>No slots available for this date. Choose another date.</p>}

                <button className="btn btn-secondary" onClick={() => setCurrentStep(3)}>Back</button>

                <button className="btn btn-primary" onClick={confirmBooking} disabled={isBooking || !selectedDate}>
                    {isBooking ? "Booking…" : "Confirm Booking"}
                </button>
            </div>

            {/* Confirmation */}
            {showPopup && (
                <div className="confirmation-popup active">
                    <div className="confirmation-content">
                        <div className="confirmation-title">Appointment Confirmed!</div>
                        <p><strong>Doctor:</strong> {selectedDoctor?.full_name}</p>
                        <p><strong>Date & Time:</strong> {summaryDateTime}</p>
                        <div className="token-number">{token}</div>

                        <button className="btn btn-primary" onClick={() => {
                            setShowPopup(false);
                            // redirect to patient dashboard
                            window.location.href = "/patient/dashboard";
                        }}>
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AppointmentPage;
