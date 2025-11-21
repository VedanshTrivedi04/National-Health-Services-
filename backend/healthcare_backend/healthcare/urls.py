from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    AuthViewSet,
    PatientViewSet,
    DoctorViewSet,
    AdminViewSet,
    AppointmentViewSet,
    DepartmentViewSet,
    MedicalRecordViewSet,
    FamilyMemberViewSet,
    live_queue_status,
    QueueStatusViewSet,
    get_doctor_reviews,
    add_doctor_review,
    NotificationViewSet,

)
router = DefaultRouter()

# ------------------------
# Register ALL ViewSets
# ------------------------
router.register(r'auth', AuthViewSet, basename='auth')
router.register(r'patient', PatientViewSet, basename='patient')
router.register(r'doctor', DoctorViewSet, basename='doctor')
router.register(r'admin', AdminViewSet, basename='admin')
router.register(r'appointments', AppointmentViewSet, basename='appointment')
router.register(r'departments', DepartmentViewSet, basename='department')
router.register(r'medical-records', MedicalRecordViewSet, basename='medical-record')
router.register(r'family-members', FamilyMemberViewSet, basename='family-member')
router.register(r'queue/status', QueueStatusViewSet, basename='queue-status')
router.register(r'notifications', NotificationViewSet, basename='notification')

urlpatterns = [
    path("queue/live/", live_queue_status),
      path("doctors/<int:doctor_id>/reviews/", get_doctor_reviews),
    path('doctor/<int:doctor_id>/reviews/add/', add_doctor_review, name='doctor-review-add'),
    path('', include(router.urls)),
]
