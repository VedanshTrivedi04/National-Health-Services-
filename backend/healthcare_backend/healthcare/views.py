from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.utils import timezone
from django.db.models import Count
from datetime import datetime, timedelta, date, time

from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from rest_framework.permissions import IsAuthenticated
from .models import (
    User, Doctor, Department, Appointment, MedicalRecord, DoctorReview,
    FamilyMember, DoctorAvailability, QueueStatus
)
from .serializers import *
from .permissions import IsPatient, IsDoctor, IsAdmin
from .models import QueueStatus
from .serializers import QueueStatusSerializer
from rest_framework import viewsets

# ============================================================
#                       AUTHENTICATION
# ============================================================

class AuthViewSet(viewsets.ViewSet):
    permission_classes = [permissions.AllowAny]

    @action(detail=False, methods=['post'])
    def register(self, request):
        serializer = UserRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            refresh = RefreshToken.for_user(user)
            return Response({
                'user': UserProfileSerializer(user).data,
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'message': 'Registration successful'
            }, status=201)
        return Response(serializer.errors, status=400)

    @action(detail=False, methods=['post'])
    def login(self, request):
        serializer = LoginSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            user = serializer.validated_data['user']
            refresh = RefreshToken.for_user(user)

            dashboard_urls = {
                'patient': '/patient/dashboard',
                'doctor': '/doctor/dashboard',
                'admin': '/admin/dashboard',
            }

            return Response({
                'user': UserProfileSerializer(user).data,
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'role': user.role,
                'dashboard_url': dashboard_urls.get(user.role),
                'message': f"Welcome {user.full_name}!"
            })

        return Response(serializer.errors, status=401)


# ============================================================
#                        PATIENT
# ============================================================

class PatientViewSet(viewsets.GenericViewSet):
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsPatient]

    def get_queryset(self):
        return User.objects.filter(id=self.request.user.id)

    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        user = request.user
        today = timezone.now().date()

        upcoming = Appointment.objects.filter(
            patient=user,
            appointment_date__gte=today,
            status__in=['scheduled', 'confirmed']
        ).order_by('appointment_date', 'time_slot')[:5]

        recent_records = MedicalRecord.objects.filter(
            patient=user
        ).order_by('-visit_date')[:3]

        return Response({
            "profile": UserProfileSerializer(user).data,
            "upcoming_appointments": AppointmentSerializer(upcoming, many=True).data,
            "recent_records": MedicalRecordSerializer(recent_records, many=True).data,
            "total_appointments": Appointment.objects.filter(patient=user).count(),
            "pending_appointments": upcoming.count(),
        })

    @action(detail=False, methods=['get'])
    def profile(self, request):
        return Response(UserProfileSerializer(request.user).data)

    @action(detail=False, methods=['patch', 'put'])
    def update_profile(self, request):
        serializer = UserProfileSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)


# ============================================================
#                        DOCTOR
# ============================================================

class DoctorViewSet(viewsets.ModelViewSet):
    serializer_class = DoctorSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == "doctor":
            return Doctor.objects.filter(user=user)
        if user.role == "admin":
            return Doctor.objects.all()
        return Doctor.objects.filter(is_verified=True, is_available=True)

    @action(detail=False, methods=['get'], permission_classes=[IsDoctor])
    def dashboard(self, request):
        doctor = request.user.doctor_profile
        today = timezone.now().date()

        today_appointments = Appointment.objects.filter(
            doctor=doctor, appointment_date=today
        ).order_by('queue_position')

        queue_status = QueueStatus.objects.filter(
            doctor=doctor, appointment_date=today
        ).first()

        return Response({
            "profile": DoctorSerializer(doctor).data,
            "today_appointments": AppointmentSerializer(today_appointments, many=True).data,
            "total_patients": Appointment.objects.filter(doctor=doctor).values('patient').distinct().count(),
            "completed_today": today_appointments.filter(status="completed").count(),
            "current_queue": QueueStatusSerializer(queue_status).data if queue_status else None,
        })

    @action(detail=False, methods=['get'], permission_classes=[IsDoctor])
    def appointments(self, request):
        doctor = request.user.doctor_profile
        date_param = request.query_params.get("date", timezone.now().date())

        appointments = Appointment.objects.filter(
            doctor=doctor,
            appointment_date=date_param
        ).order_by("queue_position")

        return Response(AppointmentSerializer(appointments, many=True).data)

    @action(detail=False, methods=['get', 'post'], permission_classes=[IsDoctor])
    def availability(self, request):
        doctor = request.user.doctor_profile

        if request.method == "GET":
            return Response(
                DoctorAvailabilitySerializer(
                    DoctorAvailability.objects.filter(doctor=doctor), many=True
                ).data
            )

        data = request.data
        data["doctor"] = doctor.id

        slot = DoctorAvailability.objects.filter(
            doctor=doctor, day_of_week=data.get("day_of_week")
        ).first()

        serializer = (
            DoctorAvailabilitySerializer(slot, data=data)
            if slot else DoctorAvailabilitySerializer(data=data)
        )

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=201)

        return Response(serializer.errors, status=400)


# ============================================================
#                        ADMIN
# ============================================================

class AdminViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        today = timezone.now().date()

        return Response({
            "total_users": User.objects.count(),
            "total_patients": User.objects.filter(role="patient").count(),
            "total_doctors": Doctor.objects.count(),
            "total_departments": Department.objects.filter(is_active=True).count(),
            "total_appointments": Appointment.objects.count(),
            "today_appointments": Appointment.objects.filter(appointment_date=today).count(),
            "pending_verifications": Doctor.objects.filter(is_verified=False).count(),
            "recent_registrations": UserProfileSerializer(
                User.objects.order_by('-created_at')[:5], many=True
            ).data,
        })

    @action(detail=True, methods=['post'])
    def verify_doctor(self, request, pk=None):
        try:
            doctor = Doctor.objects.get(pk=pk)
            doctor.is_verified = True
            doctor.save()
            return Response({"message": "Doctor verified"})
        except Doctor.DoesNotExist:
            return Response({"error": "Doctor not found"}, status=404)


# ============================================================
#                     APPOINTMENTS  
# ============================================================

class AppointmentViewSet(viewsets.ModelViewSet):
    serializer_class = AppointmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'patient':
            return Appointment.objects.filter(patient=user)
        if user.role == 'doctor':
            return Appointment.objects.filter(doctor=user.doctor_profile)
        if user.role == 'admin':
            return Appointment.objects.all()
        return Appointment.objects.none()

    def get_serializer_class(self):
        return AppointmentCreateSerializer if self.action == "create" else AppointmentSerializer

    def perform_create(self, serializer):
        appointment = serializer.save(patient=self.request.user)
        self._update_queue(appointment.doctor, appointment.appointment_date)

    # ---------------- Start Consultation ----------------
    @action(detail=True, methods=['post'], permission_classes=[IsDoctor])
    def start_consultation(self, request, pk=None):
        appt = self.get_object()
        if appt.doctor.user != request.user:
            return Response({"error": "Not authorized"}, status=403)

        appt.status = "in_progress"
        appt.consultation_started_at = timezone.now()
        appt.save()
        return Response(AppointmentSerializer(appt).data)

    # ---------------- End Consultation ----------------
    @action(detail=True, methods=['post'], permission_classes=[IsDoctor])
    def end_consultation(self, request, pk=None):
        appt = self.get_object()
        if appt.doctor.user != request.user:
            return Response({"error": "Not authorized"}, status=403)

        appt.status = "completed"
        appt.consultation_ended_at = timezone.now()
        appt.notes = request.data.get("notes", "")
        appt.prescription = request.data.get("prescription", "")
        appt.save()

        # Save medical record if provided
        record = request.data.get("medical_record")
        if record:
            record["patient"] = appt.patient.id
            record["doctor"] = appt.doctor.id
            record["appointment"] = appt.id
            serializer = MedicalRecordSerializer(data=record)
            if serializer.is_valid():
                serializer.save()

        self._update_queue(appt.doctor, appt.appointment_date)
        return Response(AppointmentSerializer(appt).data)

    # ---------------- Available Slots ----------------
    @action(detail=False, methods=['get'], url_path='available_slots')
    def available_slots(self, request):
        doctor_id = request.query_params.get("doctor_id")
        date_str = request.query_params.get("date")

        if not doctor_id or not date_str:
            return Response({"error": "doctor_id and date required"}, status=400)

        try:
            doctor = Doctor.objects.get(id=doctor_id)
        except:
            return Response({"error": "Doctor not found"}, status=404)

        try:
            appt_date = date.fromisoformat(date_str)
        except:
            return Response({"error": "Invalid date"}, status=400)

        day = appt_date.strftime("%A").lower()
        availability = DoctorAvailability.objects.filter(
            doctor=doctor, day_of_week=day, is_available=True
        ).first()

        if not availability:
            start_t, end_t = time(9, 0), time(17, 0)
        else:
            start_t, end_t = availability.start_time, availability.end_time or time(23, 59)

        start_dt = datetime.combine(appt_date, start_t)
        end_dt = datetime.combine(appt_date, end_t)

        booked = set(
            a.strftime("%H:%M")
            for a in Appointment.objects.filter(
                doctor=doctor,
                appointment_date=appt_date,
                status__in=['scheduled', 'confirmed', 'in_progress']
            ).values_list("time_slot", flat=True)
        )

        slots = []
        cur = start_dt
        while cur < end_dt:
            v = cur.strftime("%H:%M")
            if v not in booked:
                slots.append({
                    "value": v,
                    "display": cur.strftime("%I:%M %p"),
                    "duration": "10 minutes"
                })
            cur += timedelta(minutes=10)

        return Response({
            "doctor_id": doctor_id,
            "date": date_str,
            "available_slots": slots,
            "total": len(slots)
        })

    # ---------------- Queue Logic ----------------
    def _update_queue(self, doctor, appt_date):
        qs, _ = QueueStatus.objects.get_or_create(
            doctor=doctor, appointment_date=appt_date
        )
        qs.total_tokens = Appointment.objects.filter(
            doctor=doctor,
            appointment_date=appt_date,
            status__in=['scheduled', 'confirmed', 'in_progress']
        ).count()
        qs.save()


# ============================================================
#                  LIVE QUEUE STATUS (GLOBAL)
# ============================================================

@api_view(["GET"])
def live_queue_status(request):
    today = date.today()
    appts = Appointment.objects.filter(appointment_date=today).order_by("token_number")

    current = ""
    pending = []

    for a in appts:
        s = (a.status or "").lower()

        if s in ["in_progress", "ongoing"]:
            current = a.token_number

        if s in ["waiting", "scheduled", "confirmed"]:
            pending.append({
                "token_number": a.token_number,
                "patient_name": a.patient.full_name,
                "eta_minutes": getattr(a, "eta_minutes", 15)
            })

    return Response({
        "current_token": current,
        "pending_tokens": pending,
        "total": len(appts)
    })


# ============================================================
#                  DEPARTMENTS
# ============================================================

class DepartmentViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Department.objects.filter(is_active=True)
    serializer_class = DepartmentSerializer


# ============================================================
#                MEDICAL RECORDS
# ============================================================

class MedicalRecordViewSet(viewsets.ModelViewSet):
    serializer_class = MedicalRecordSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        u = self.request.user
        if u.role == "patient":
            return MedicalRecord.objects.filter(patient=u)
        if u.role == "doctor":
            return MedicalRecord.objects.filter(doctor=u.doctor_profile)
        if u.role == "admin":
            return MedicalRecord.objects.all()
        return MedicalRecord.objects.none()

    def perform_create(self, serializer):
        if self.request.user.role == "doctor":
            serializer.save(doctor=self.request.user.doctor_profile)
        else:
            serializer.save()


# ============================================================
#               FAMILY MEMBERS
# ============================================================

class FamilyMemberViewSet(viewsets.ModelViewSet):
    serializer_class = FamilyMemberSerializer
    permission_classes = [permissions.IsAuthenticated, IsPatient]

    def get_queryset(self):
        return FamilyMember.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


# ============================================================
#               DOCTOR REVIEWS
# ============================================================

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def add_doctor_review(request, doctor_id):
    try:
        doctor = Doctor.objects.get(id=doctor_id)
    except Doctor.DoesNotExist:
        return Response({"error": "Doctor not found"}, status=404)

    appointment = Appointment.objects.filter(
        patient=request.user,
        doctor=doctor,
        status="completed"
    ).first()

    rating = request.data.get("rating")
    comment = request.data.get("comment", "")

    if not rating:
        return Response({"error": "Rating is required"}, status=400)

    review = DoctorReview.objects.create(
        doctor=doctor,
        patient=request.user,
        appointment=appointment,
        rating=rating,
        comment=comment
    )

    return Response(DoctorReviewSerializer(review).data, status=201)


@api_view(["GET"])
def get_doctor_reviews(request, doctor_id):
    try:
        doctor = Doctor.objects.get(id=doctor_id)
    except Doctor.DoesNotExist:
        return Response({"error": "Doctor not found"}, status=404)

    reviews = DoctorReview.objects.filter(doctor=doctor).order_by("-created_at")
    return Response(DoctorReviewSerializer(reviews, many=True).data)


from rest_framework.pagination import PageNumberPagination

class NoPagination(PageNumberPagination):
    page_size = None

class QueueStatusViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = QueueStatusSerializer
    pagination_class = NoPagination
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        doctor_id = self.request.query_params.get('doctor')
        date = self.request.query_params.get('date', timezone.now().date())

        qs = QueueStatus.objects.filter(appointment_date=date)
        if doctor_id:
            qs = qs.filter(doctor_id=doctor_id)
        return qs


