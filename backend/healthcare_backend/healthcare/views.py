from rest_framework import viewsets, status, permissions, mixins
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.utils import timezone
from django.db.models import Count, Avg, F, ExpressionWrapper, DurationField
from datetime import datetime, timedelta, date, time

from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from rest_framework.permissions import IsAuthenticated
from .models import (
    User, Doctor, Department, Appointment, MedicalRecord, DoctorReview,
    FamilyMember, DoctorAvailability, QueueStatus, Notification
)
from .serializers import *
from .permissions import IsPatient, IsDoctor, IsAdmin


def _send_notification(user, title, message, *, category='general', appointment=None, data=None):
    """Utility helper to create in-app notifications safely."""
    if not user:
        return
    Notification.objects.create(
        user=user,
        appointment=appointment,
        title=title,
        message=message,
        category=category,
        data=data or {}
    )

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
        _send_notification(
            appointment.patient,
            "Appointment Confirmed",
            f"Your appointment with {appointment.doctor.full_name} "
            f"on {appointment.appointment_date} at {appointment.time_slot} is booked. "
            f"Token: {appointment.token_number}",
            category='appointment',
            appointment=appointment,
            data={
                "token": appointment.token_number,
                "doctor": appointment.doctor.full_name,
                "time": str(appointment.time_slot)
            }
        )

    def perform_destroy(self, instance):
        doctor = instance.doctor
        appt_date = instance.appointment_date
        patient = instance.patient
        token = instance.token_number
        super().perform_destroy(instance)
        self._update_queue(doctor, appt_date)
        _send_notification(
            patient,
            "Appointment Removed",
            f"Your appointment (token {token}) was removed from the queue.",
            category='appointment'
        )

    # ---------------- Start Consultation ----------------
    @action(detail=True, methods=['post'], permission_classes=[IsDoctor])
    def start_consultation(self, request, pk=None):
        appt = self.get_object()
        if appt.doctor.user != request.user:
            return Response({"error": "Not authorized"}, status=403)

        appt.status = "in_progress"
        appt.consultation_started_at = timezone.now()
        appt.save()
        self._update_queue(appt.doctor, appt.appointment_date)

        _send_notification(
            appt.patient,
            "Consultation Started",
            f"Please proceed to the cabin. Token {appt.token_number} is now in progress.",
            category='queue',
            appointment=appt
        )
        return Response(AppointmentSerializer(appt).data)

    # ---------------- End Consultation ----------------
    @action(detail=True, methods=['post'], permission_classes=[IsDoctor])
    def end_consultation(self, request, pk=None):
        appt = self.get_object()
        if appt.doctor.user != request.user:
            return Response({"error": "Not authorized"}, status=403)

        mark_no_show = request.data.get("no_show")
        if mark_no_show:
            appt.status = "no_show"
        else:
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

        if mark_no_show:
            title = "Marked as No-Show"
            message = f"Token {appt.token_number} was marked as no-show. Please rebook if needed."
            category = 'queue'
        else:
            title = "Consultation Completed"
            message = f"Your consultation with {appt.doctor.full_name} is completed."
            category = 'appointment'

        _send_notification(
            appt.patient,
            title,
            message,
            category=category,
            appointment=appt
        )
        return Response(AppointmentSerializer(appt).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        appt = self.get_object()
        user = request.user
        if user != appt.patient and getattr(user, 'doctor_profile', None) != appt.doctor and user.role != 'admin':
            return Response({"error": "Not authorized"}, status=403)

        appt.status = 'cancelled'
        appt.save(update_fields=['status'])
        self._update_queue(appt.doctor, appt.appointment_date)

        _send_notification(
            appt.patient,
            "Appointment Cancelled",
            f"Your appointment with {appt.doctor.full_name} on {appt.appointment_date} has been cancelled.",
            category='appointment',
            appointment=appt
        )
        return Response({"status": "cancelled"})

    @action(detail=True, methods=['patch'])
    def status(self, request, pk=None):
        appt = self.get_object()
        status_value = request.data.get('status')
        if status_value not in dict(Appointment.STATUS_CHOICES):
            return Response({"error": "Invalid status"}, status=400)

        appt.status = status_value
        appt.save(update_fields=['status'])
        self._update_queue(appt.doctor, appt.appointment_date)
        return Response(AppointmentSerializer(appt).data)

    @action(detail=True, methods=['post'])
    def reschedule(self, request, pk=None):
        appt = self.get_object()
        user = request.user
        if user != appt.patient and getattr(user, 'doctor_profile', None) != appt.doctor and user.role != 'admin':
            return Response({"error": "Not authorized"}, status=403)

        payload = {
            'doctor': request.data.get('doctor', appt.doctor.id),
            'department': request.data.get('department', appt.department.id),
            'appointment_date': request.data.get('appointment_date', appt.appointment_date),
            'time_slot': request.data.get('time_slot', appt.time_slot),
            'reason': request.data.get('reason', appt.reason),
            'booking_type': request.data.get('booking_type', appt.booking_type),
            'is_for_self': request.data.get('is_for_self', appt.is_for_self),
            'patient_relation': request.data.get('patient_relation', appt.patient_relation),
        }

        old_doctor = appt.doctor
        old_date = appt.appointment_date

        serializer = AppointmentCreateSerializer(
            instance=appt,
            data=payload
        )
        serializer.is_valid(raise_exception=True)
        updated = serializer.save()

        self._update_queue(old_doctor, old_date)
        self._update_queue(updated.doctor, updated.appointment_date)

        _send_notification(
            updated.patient,
            "Appointment Rescheduled",
            f"New slot: {updated.appointment_date} at {updated.time_slot} with {updated.doctor.full_name}.",
            category='appointment',
            appointment=updated
        )

        return Response(AppointmentSerializer(updated).data)

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
        """Recalculate queue ordering, ETA and aggregate stats for a doctor."""
        if not doctor or not appt_date:
            return

        appointments = list(
            Appointment.objects.filter(
                doctor=doctor,
                appointment_date=appt_date
            ).order_by('queue_position', 'time_slot', 'created_at')
        )

        qs, _ = QueueStatus.objects.get_or_create(
            doctor=doctor,
            appointment_date=appt_date
        )

        # Determine consultation averages from historical data (fallback 10 mins)
        duration_qs = Appointment.objects.filter(
            doctor=doctor,
            status='completed',
            consultation_started_at__isnull=False,
            consultation_ended_at__isnull=False
        ).annotate(
            duration=ExpressionWrapper(
                F('consultation_ended_at') - F('consultation_started_at'),
                output_field=DurationField()
            )
        )

        avg_duration = duration_qs.aggregate(avg=Avg('duration'))['avg']
        if not avg_duration:
            fallback_minutes = doctor.average_time_per_patient or 10
            avg_duration = timedelta(minutes=fallback_minutes)
        else:
            # keep doctor profile aligned in minutes
            doctor.average_time_per_patient = round(avg_duration.total_seconds() / 60, 1)
            doctor.save(update_fields=['average_time_per_patient'])

        avg_minutes = max(int(avg_duration.total_seconds() // 60), 5)

        # Queue aggregates
        waiting_statuses = ['scheduled', 'confirmed', 'waiting']
        active_appt = next(
            (a for a in appointments if a.status == 'in_progress'),
            None
        )
        next_in_line = next(
            (a for a in appointments if a.status in waiting_statuses),
            None
        )

        qs.current_token = (
            active_appt.token_number if active_appt else
            (next_in_line.token_number if next_in_line else '')
        )
        qs.total_tokens = len([
            a for a in appointments
            if a.status not in ['cancelled', 'no_show']
        ])
        qs.completed_tokens = len([a for a in appointments if a.status == 'completed'])
        qs.average_time_per_patient = avg_duration
        qs.save()

        # Recalculate queue positions + ETA
        updates = []
        running_offset = 0
        now = timezone.localtime()

        for idx, appt in enumerate(appointments, start=1):
            fields_to_update = []

            if appt.queue_position != idx:
                appt.queue_position = idx
                fields_to_update.append('queue_position')

            status = (appt.status or '').lower()

            if status in ['completed', 'cancelled', 'no_show']:
                wait_minutes = 0
            elif appt == active_appt or status == 'in_progress':
                wait_minutes = 0
                running_offset = avg_minutes
            elif status in waiting_statuses:
                wait_minutes = max(running_offset, 0)
                running_offset += avg_minutes
            else:
                wait_minutes = 0

            if appt.estimated_wait_minutes != wait_minutes:
                appt.estimated_wait_minutes = wait_minutes
                fields_to_update.append('estimated_wait_minutes')

            estimated_dt = now + timedelta(minutes=wait_minutes)
            estimated_time = estimated_dt.time()
            if appt.estimated_time != estimated_time:
                appt.estimated_time = estimated_time
                fields_to_update.append('estimated_time')

            if fields_to_update:
                updates.append(appt)

        if updates:
            Appointment.objects.bulk_update(
                updates,
                ['queue_position', 'estimated_wait_minutes', 'estimated_time']
            )


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
                "eta_minutes": a.estimated_wait_minutes,
                "estimated_time": a.estimated_time.strftime("%H:%M") if a.estimated_time else None,
                "doctor": a.doctor.full_name,
                "status": a.status
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


class NotificationViewSet(mixins.ListModelMixin,
                          mixins.UpdateModelMixin,
                          viewsets.GenericViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user).order_by('-created_at')

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        notif = self.get_object()
        notif.mark_read()
        return Response({"status": "read"})

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        updated = self.get_queryset().filter(is_read=False)
        count = updated.count()
        updated.update(is_read=True, read_at=timezone.now())
        return Response({"updated": count})

