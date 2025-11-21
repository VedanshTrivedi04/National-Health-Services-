// src/services/api.js

const API_BASE_URL = 'http://127.0.0.1:8000/api';
// const API_BASE_URL = ' https://resolved-portable-floral-strategic.trycloudflare.com/api';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = localStorage.getItem('access_token');
  }

  // ======================
  // 🔐 TOKEN MANAGEMENT
  // ======================
  setToken(token) {
    this.token = token;
    localStorage.setItem('access_token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }

  // ======================
  // 🧾 HEADERS
  // ======================
  getHeaders() {
    const headers = { "Content-Type": "application/json" };
    if (this.token) headers["Authorization"] = `Bearer ${this.token}`;
    return headers;
  }

  // ======================
  // 🌐 REQUEST HANDLER
  // ======================
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;

    const config = {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);

      if (response.status === 401) {
        const refreshed = await this.refreshToken();
        if (refreshed) {
          config.headers["Authorization"] = `Bearer ${this.token}`;
          const retry = await fetch(url, config);
          if (!retry.ok) throw new Error(`HTTP ${retry.status}`);
          return retry.json();
        }
        this.clearToken();
        throw new Error("Unauthorized");
      }

      if (!response.ok) {
        const err = await response.json().catch(() => ({
          detail: `HTTP ${response.status}`
        }));
        const error = new Error(err.detail);
        error.response = { data: err, status: response.status };
        throw error;
      }

      return response.json();
    } catch (err) {
      console.error("API request failed:", err);
      throw err;
    }
  }

  // ======================
  // 🧩 SAFE REQUEST
  // ======================
  async safeRequest(endpoint, options = {}) {
    if (!this.token) {
      const refreshed = await this.refreshToken();
      if (!refreshed) throw new Error("Not authenticated");
    }
    return this.request(endpoint, options);
  }

  // ======================
  // 🔁 REFRESH TOKEN
  // ======================
  async refreshToken() {
    const refreshToken = localStorage.getItem("refresh_token");
    if (!refreshToken) return false;

    try {
      const response = await fetch(`${this.baseURL}/token/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        this.setToken(data.access);
        if (data.refresh) localStorage.setItem("refresh_token", data.refresh);
        return true;
      }

      this.clearToken();
      return false;
    } catch (err) {
      this.clearToken();
      return false;
    }
  }

  // ======================
  // 👤 AUTH
  // ======================
  async register(userData) {
    return this.request("/auth/register/", {
      method: "POST",
      body: JSON.stringify(userData),
    });
  }

  async login(credentials) {
    const response = await this.request("/auth/login/", {
      method: "POST",
      body: JSON.stringify(credentials),
    });

    if (response.access) {
      this.setToken(response.access);
      localStorage.setItem("refresh_token", response.refresh);
    }

    return response;
  }

  async logout() {
    const refresh = localStorage.getItem("refresh_token");
    if (refresh) {
      await fetch(`${this.baseURL}/token/blacklist/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });
    }
    this.clearToken();
  }

  // ======================
  // 🧍 PATIENT
  // ======================
  async getPatientProfile() {
    return this.safeRequest("/patient/profile/");
  }

  async updatePatientProfile(data) {
    return this.safeRequest("/patient/update_profile/", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async getPatientDashboard() {
    return this.safeRequest("/patient/dashboard/");
  }

  async getMedicalHistory() {
    return this.safeRequest("/patient/medical_history/");
  }

  async getPatientAppointments() {
    return this.safeRequest("/patient/appointments/");
  }

  // ======================
  // 🏥 DEPARTMENTS
  // ======================
  async getDepartments() {
    return this.request("/departments/");
  }

  // ======================
  // 🩺 DOCTORS
  // ======================
  async getDoctors() {
    return this.safeRequest("/doctor/");
  }

  async getDoctorsByDepartment(id) {
    return this.safeRequest(`/doctor/?department=${id}`);
  }

  async getDoctorDetail(id) {
    return this.safeRequest(`/doctor/${id}/`);
  }

  async updateDoctor(id, data) {
    return this.safeRequest(`/doctor/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async getDoctorDashboard() {
    return this.safeRequest("/doctor/dashboard/");
  }

  async getDoctorAppointments(date) {
    const query = date ? `?date=${date}` : "";
    return this.safeRequest(`/doctor/appointments/${query}`);
  }

  async startConsultation(appointmentId) {
    return this.safeRequest(`/appointments/${appointmentId}/start_consultation/`, {
      method: "POST",
    });
  }

  async endConsultation(appointmentId, body = {}) {
    return this.safeRequest(`/appointments/${appointmentId}/end_consultation/`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async finishConsultation(appointmentId) {
    return this.endConsultation(appointmentId);
  }

  async updateDoctorAvailability(data) {
    return this.safeRequest(`/doctor/availability/`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getQueueStatus({ doctorId, date } = {}) {
    const params = new URLSearchParams();
    if (doctorId) params.append("doctor", doctorId);
    if (date) params.append("date", date);
    const query = params.toString();
    return this.safeRequest(`/queue/status/${query ? `?${query}` : ""}`);
  }

  // ======================
  // 📅 APPOINTMENTS
  // ======================
  async getAppointments() {
    return this.safeRequest("/appointments/");
  }

  async createAppointment(data) {
    return this.safeRequest("/appointments/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getAppointment(id) {
    return this.safeRequest(`/appointments/${id}/`);
  }

  async cancelAppointment(id) {
    return this.safeRequest(`/appointments/${id}/cancel/`, {
      method: "POST",
    });
  }

  async completeAppointment(id, body = {}) {
    return this.endConsultation(id, body);
  }

  async updateAppointmentStatus(id, status) {
    return this.safeRequest(`/appointments/${id}/status/`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  }

  // ⭐ AVAILABLE SLOTS ⭐
  async getAvailableSlots(doctorId, date) {
    return this.request(
      `/appointments/available_slots/?doctor_id=${doctorId}&date=${date}`
    );
  }

  // ======================
  // 📚 MEDICAL RECORDS
  // ======================
  async getMedicalRecords() {
    return this.safeRequest("/medical-records/");
  }

  async getMedicalRecord(id) {
    return this.safeRequest(`/medical-records/${id}/`);
  }

  // ======================
  // 👨‍👩‍👧 FAMILY MEMBERS
  // ======================
  async getFamilyMembers() {
    return this.safeRequest("/family-members/");
  }
  async rescheduleAppointment(id, data) {
    return this.safeRequest(`/appointments/${id}/reschedule/`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getDoctorReviews(doctorId) {
    return this.safeRequest(`/doctors/${doctorId}/reviews/`);
  }

  async addDoctorReview(doctorId, data) {
    return this.safeRequest(`/doctor/${doctorId}/reviews/add/`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // ======================
  // 🔔 NOTIFICATIONS
  // ======================
  async getNotifications() {
    return this.safeRequest("/notifications/");
  }

  async markNotificationRead(id) {
    return this.safeRequest(`/notifications/${id}/mark_read/`, {
      method: "POST",
    });
  }

  async markAllNotificationsRead() {
    return this.safeRequest("/notifications/mark_all_read/", {
      method: "POST",
    });
  }

  // ======================
  // ⚙️ ADMIN
  // ======================
  async getAllPatients() {
    return this.safeRequest("/admin/users/");
  }

  async getAllAppointments() {
    return this.safeRequest("/admin/reports/?type=appointments");
  }

  async getAllDoctors() {
    return this.safeRequest("/admin/reports/?type=doctors");
  }
}

const apiService = new ApiService();
export default apiService;