import { useState } from 'react'
import { Routes } from 'react-router-dom'
import { Outlet } from 'react-router-dom'
import { BrowserRouter, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { DataProvider } from './contexts/DataContext'
import HomePage from './patientcomponent/pages/HomePage'
import LoginPage from './patientcomponent/pages/LoginPage'
import SignUpPage from './patientcomponent/pages/SignUpPage'
import AppointmentPage from './patientcomponent/pages/AppointmentPage'
import MyProfilePage from './patientcomponent/pages/MyProfilePage'
import Header from './patientcomponent/components/Header'
import Footer from './patientcomponent/components/Footer'
import DoctorDashboard from './doctorscomponent/DoctorDashboard'
import DoctorCabinet from './doctorscomponent/CabinDisplay'
import DoctorProfile from './doctorscomponent/DoctorProfile'
import DoctorHeader from './doctorscomponent/components/DoctorHeader'
import QueueManagement from './doctorscomponent/QueueManagement'
import LiveSession from './doctorscomponent/LiveSession'
import Departmentent from './patientcomponent/pages/Departmentent'
import DoctorQueue from './patientcomponent/pages/DoctorQueue'

function MainLayout() {
  return (
    <>
      <Header />
     
      <Outlet /> 
      <Footer />
    </>
  );
}
function DoctorMainLayout() {
  return (
    <>
      <DoctorHeader />
     
      <Outlet /> 
      <Footer />
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path='/patient/dashboard' element={<HomePage />} />
            <Route path="appointment" element={<AppointmentPage />} />
            <Route path="profile" element={<MyProfilePage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="signup" element={<SignUpPage/>} />
            <Route path="department" element={<Departmentent/>} />
            <Route path="/doctorqueue" element={<DoctorQueue/>} />

            

          </Route>
          <Route path="/" element={<DoctorMainLayout />}>

            <Route path="doctor/dashboard" element={<DoctorDashboard />} />
            <Route path="doctor/cabinet" element={<DoctorCabinet />} />
            <Route path="doctor/profile" element={<DoctorProfile />} />
            <Route path="doctor/queue" element={<QueueManagement />} />
            <Route path="doctor/session" element={<LiveSession/>} />
          </Route>
        </Routes>
      </DataProvider>
    </AuthProvider>
  );
}

export default App
