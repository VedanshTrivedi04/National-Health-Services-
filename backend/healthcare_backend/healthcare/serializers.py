from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth import authenticate
from django.utils import timezone
from .models import (
    User, Doctor, Department, Appointment, MedicalRecord,
    FamilyMember, DoctorAvailability, Admin, QueueStatus, DoctorReview
)

# ==================== Authentication Serializers ====================
class UserRegistrationSerializer(serializers.ModelSerializer):
    """Patient registration serializer (Public)"""
    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password],
        style={'input_type': 'password'}
    )
    password2 = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'}
    )

    class Meta:
        model = User
        fields = [
            'id', 'email', 'password', 'password2', 'full_name',
            'phone', 'date_of_birth', 'gender', 'address',
            'aadhaar_number', 'blood_group'
        ]

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({
                "password": "Password fields didn't match."
            })
        return attrs

    def create(self, validated_data):
        validated_data.pop('password2')
        validated_data['role'] = 'patient'  # Force patient role
        user = User.objects.create_user(**validated_data)
        return user


class LoginSerializer(serializers.Serializer):
    """Login serializer with role-based response"""
    email = serializers.EmailField()
    password = serializers.CharField(style={'input_type': 'password'})

    def validate(self, attrs):
        email = attrs.get('email')
        password = attrs.get('password')

        if email and password:
            user = authenticate(
                request=self.context.get('request'),
                username=email,
                password=password
            )
            if user:
                if not user.is_active:
                    raise serializers.ValidationError(
                        "User account is disabled."
                    )
                # Update last login
                user.last_login_at = timezone.now()
                user.save(update_fields=['last_login_at'])
                attrs['user'] = user
                return attrs
            else:
                raise serializers.ValidationError(
                    "Unable to log in with provided credentials."
                )
        else:
            raise serializers.ValidationError(
                "Must include email and password."
            )


class UserProfileSerializer(serializers.ModelSerializer):
    """User profile serializer"""
    class Meta:
        model = User
        fields = [
            'id', 'email', 'full_name', 'phone', 'date_of_birth',
            'gender', 'address', 'aadhaar_number', 'blood_group',
            'role', 'is_verified', 'created_at'
        ]
        read_only_fields = ['id', 'email', 'role', 'is_verified', 'created_at']


class DepartmentSerializer(serializers.ModelSerializer):
    """Department serializer"""
    doctor_count = serializers.SerializerMethodField()

    class Meta:
        model = Department
        fields = [
            'id', 'name', 'code', 'description', 'icon',
            'is_active', 'doctor_count', 'created_at'
        ]

    def get_doctor_count(self, obj):
        return obj.doctors.filter(is_available=True).count()


class DoctorAvailabilitySerializer(serializers.ModelSerializer):
    """Doctor availability serializer"""
    class Meta:
        model = DoctorAvailability
        fields = '__all__'


class DoctorSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='user.full_name', read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)
    phone = serializers.CharField(source='user.phone', read_only=True)

    # 🔥 Add nested department object
    department = DepartmentSerializer(read_only=True)

    # 🔥 Also include department_id separately (optional but useful)
    department_id = serializers.IntegerField(source='department.id', read_only=True)

    department_name = serializers.CharField(source='department.name', read_only=True)
    availabilities = DoctorAvailabilitySerializer(many=True, read_only=True)

    class Meta:
        model = Doctor
        fields = [
            'id', 'user', 'full_name', 'email', 'phone',
            'specialty', 
            'department',         # nested object
            'department_id',      # ID only
            'department_name',
            'qualification', 'experience', 'license_number',
            'rating', 'consultation_fee', 'bio',
            'is_available', 'is_verified', 'queue_status',
            'current_token', 'availabilities', 'created_at'
        ]
        read_only_fields = ['user', 'rating', 'is_verified', 'created_at']



class DoctorRegistrationSerializer(serializers.Serializer):
    """Doctor registration by Admin"""
    # User data
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, validators=[validate_password])
    full_name = serializers.CharField(max_length=100)
    phone = serializers.CharField(max_length=15)
    date_of_birth = serializers.DateField(required=False, allow_null=True)
    gender = serializers.ChoiceField(choices=User.GENDER_CHOICES)
    address = serializers.CharField()
    aadhaar_number = serializers.CharField(max_length=12)

    # Doctor data
    specialty = serializers.CharField(max_length=100)
    department = serializers.PrimaryKeyRelatedField(queryset=Department.objects.all())
    qualification = serializers.CharField(max_length=200)
    experience = serializers.CharField(max_length=50)
    license_number = serializers.CharField(max_length=50)
    consultation_fee = serializers.DecimalField(max_digits=8, decimal_places=2)
    bio = serializers.CharField(required=False, allow_blank=True)

    def create(self, validated_data):
        # Extract doctor-specific data
        doctor_data = {
            'specialty': validated_data.pop('specialty'),
            'department': validated_data.pop('department'),
            'qualification': validated_data.pop('qualification'),
            'experience': validated_data.pop('experience'),
            'license_number': validated_data.pop('license_number'),
            'consultation_fee': validated_data.pop('consultation_fee'),
            'bio': validated_data.pop('bio', ''),
        }
        
        # Create user with doctor role
        validated_data['role'] = 'doctor'
        user = User.objects.create_user(**validated_data)
        
        # Create doctor profile
        doctor = Doctor.objects.create(
            user=user,
            registered_by=self.context['request'].user,
            **doctor_data
        )
        return doctor


# ==================== Appointment Serializers ====================
class AppointmentSerializer(serializers.ModelSerializer):
    """Appointment serializer with detailed information"""
    patient_name = serializers.CharField(source='patient.full_name', read_only=True)
    patient_phone = serializers.CharField(source='patient.phone', read_only=True)
    doctor_name = serializers.CharField(source='doctor.full_name', read_only=True)
    doctor_specialty = serializers.CharField(source='doctor.specialty', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)

    class Meta:
        model = Appointment
        fields = [
            'id', 'patient', 'patient_name', 'patient_phone',
            'doctor', 'doctor_name', 'doctor_specialty',
            'department', 'department_name',
            'appointment_date', 'time_slot', 'status',
            'token_number', 'queue_position', 'estimated_time',
            'reason', 'booking_type', 'is_for_self', 'patient_relation',
            'notes', 'prescription',
            'consultation_started_at', 'consultation_ended_at',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'patient', 'token_number', 'queue_position', 'estimated_time',
            'consultation_started_at', 'consultation_ended_at',
            'created_at', 'updated_at'
        ]


class AppointmentCreateSerializer(serializers.ModelSerializer):
    """Serializer for booking appointments"""
    class Meta:
        model = Appointment
        fields = [
            'doctor', 'department', 'appointment_date', 'time_slot',
            'reason', 'booking_type', 'is_for_self', 'patient_relation'
        ]

    def validate(self, attrs):
        doctor = attrs['doctor']
        appointment_date = attrs['appointment_date']
        time_slot = attrs['time_slot']
        
        # CRITICAL: Check if EXACT time slot is already booked by another patient
        # This ensures only ONE person per time slot
        existing = Appointment.objects.filter(
            doctor=doctor,
            appointment_date=appointment_date,
            time_slot=time_slot,
            status__in=['scheduled', 'confirmed', 'in_progress']
        ).exclude(
            # Exclude current appointment if updating
            id=getattr(self.instance, 'id', None)
        ).first()
        
        if existing:
            raise serializers.ValidationError(
                f"This time slot ({time_slot}) is already booked by another patient. "
                "Please select a different time."
            )
        
        # Check doctor availability (optional - only if set up)
        day_name = appointment_date.strftime('%A').lower()
        availability = DoctorAvailability.objects.filter(
            doctor=doctor,
            day_of_week=day_name,
            is_available=True
        ).first()
        
        # Only check availability if it's been set up
        if availability and availability.start_time and availability.end_time:
            if not (availability.start_time <= time_slot <= availability.end_time):
                raise serializers.ValidationError(
                    f"Selected time is outside doctor's available hours ({availability.start_time} - {availability.end_time})."
                )
        
        return attrs
class QueueStatusSerializer(serializers.ModelSerializer):
    doctor_name = serializers.CharField(source='doctor.full_name', read_only=True)
    pending_tokens = serializers.SerializerMethodField()

    class Meta:
        model = QueueStatus
        fields = [
            'id', 'doctor', 'doctor_name', 'appointment_date',
            'current_token', 'total_tokens', 'completed_tokens',
            'average_time_per_patient', 'last_updated',
            'pending_tokens'
        ]

    def get_pending_tokens(self, obj):
        # all future tokens after completed ones
        appointments = Appointment.objects.filter(
            doctor=obj.doctor,
            appointment_date=obj.appointment_date,
            status='scheduled'
        ).order_by('queue_position')

        return [
            {
                "token_number": a.token_number,
                "patient_name": a.patient.full_name,
                "queue_position": a.queue_position,
            }
            for a in appointments
        ]

    def get_pending_tokens(self, obj):
        """Return all tokens that are NOT served yet"""

        # Fetch appointments for this doctor & date
        appointments = Appointment.objects.filter(
            doctor=obj.doctor,
            appointment_date=obj.appointment_date
        ).exclude(
            status__in=['completed', 'cancelled', 'no_show']
        ).order_by('queue_position')

        pending_list = []

        for ap in appointments:
            pending_list.append({
                "token_number": ap.token_number,
                "patient_name": ap.patient.full_name,
                "queue_position": ap.queue_position,
                "status": ap.status,
            })

        return pending_list



# ==================== Medical Record Serializers ====================
class MedicalRecordSerializer(serializers.ModelSerializer):
    """Medical record serializer"""
    patient_name = serializers.CharField(source='patient.full_name', read_only=True)
    doctor_name = serializers.CharField(source='doctor.full_name', read_only=True)
    appointment_token = serializers.CharField(source='appointment.token_number', read_only=True, allow_null=True)

    class Meta:
        model = MedicalRecord
        fields = [
            'id', 'patient', 'patient_name', 'doctor', 'doctor_name',
            'appointment', 'appointment_token',
            'diagnosis', 'symptoms', 'treatment_plan',
            'prescriptions', 'procedures', 'vitals',
            'follow_up_required', 'follow_up_date',
            'notes', 'visit_date', 'created_at'
        ]
        read_only_fields = ['visit_date', 'created_at']


# ==================== Family Member Serializers ====================
class FamilyMemberSerializer(serializers.ModelSerializer):
    """Family member serializer"""
    class Meta:
        model = FamilyMember
        fields = '__all__'
        read_only_fields = ['user', 'created_at']


# ==================== Dashboard Serializers ====================
class PatientDashboardSerializer(serializers.Serializer):
    """Patient dashboard data"""
    profile = UserProfileSerializer()
    upcoming_appointments = AppointmentSerializer(many=True)
    recent_records = MedicalRecordSerializer(many=True)
    total_appointments = serializers.IntegerField()
    pending_appointments = serializers.IntegerField()


class DoctorDashboardSerializer(serializers.Serializer):
    """Doctor dashboard data"""
    profile = DoctorSerializer()
    today_appointments = AppointmentSerializer(many=True)
    total_patients = serializers.IntegerField()
    completed_today = serializers.IntegerField()
    current_queue = QueueStatusSerializer(allow_null=True)


class AdminDashboardSerializer(serializers.Serializer):
    """Admin dashboard statistics"""
    total_users = serializers.IntegerField()
    total_patients = serializers.IntegerField()
    total_doctors = serializers.IntegerField()
    total_departments = serializers.IntegerField()
    total_appointments = serializers.IntegerField()
    today_appointments = serializers.IntegerField()
    pending_verifications = serializers.IntegerField()
    recent_registrations = UserProfileSerializer(many=True)

class DoctorReviewSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.full_name", read_only=True)
    doctor_name = serializers.CharField(source="doctor.full_name", read_only=True)

    class Meta:
        model = DoctorReview
        fields = [
            "id",
            "doctor",
            "doctor_name",
            "patient",
            "patient_name",
            "appointment",
            "rating",
            "comment",
            "created_at"
        ]
        read_only_fields = ["doctor", "patient", "created_at"]
