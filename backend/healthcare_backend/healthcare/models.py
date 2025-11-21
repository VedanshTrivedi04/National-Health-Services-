from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.core.validators import RegexValidator
from django.utils import timezone
from decimal import Decimal
import uuid

class UserManager(BaseUserManager):
    """Custom user manager for the User model"""
    
    def create_user(self, email, password=None, **extra_fields):
        """Create and return a regular user with an email and password"""
        if not email:
            raise ValueError('The Email field must be set')
        
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user
    
    def create_superuser(self, email, password=None, **extra_fields):
        """Create and return a superuser with an email and password"""
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'admin')
        
        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')
        
        return self.create_user(email, password, **extra_fields)

class User(AbstractUser):
    """Custom User model with role-based authentication"""
    ROLE_CHOICES = [
        ('patient', 'Patient'),
        ('doctor', 'Doctor'),
        ('admin', 'Admin'),
    ]
    GENDER_CHOICES = [
        ('male', 'Male'),
        ('female', 'Female'),
        ('other', 'Other'),
    ]

    # Override default fields
    email = models.EmailField(unique=True)
    username = models.CharField(max_length=150, unique=True, blank=True)

    # Personal Information
    full_name = models.CharField(max_length=100)
    phone = models.CharField(
        max_length=15,
        unique=True,
        validators=[RegexValidator(
            regex=r'^\+?1?\d{9,15}$',
            message="Phone number must be entered in the format: '+999999999'. Up to 15 digits allowed."
        )]
    )
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, null=True, blank=True)
    address = models.TextField(null=True, blank=True)

    # Government ID
    aadhaar_number = models.CharField(
        max_length=12,
        unique=True,
        null=True, blank=True,
        validators=[RegexValidator(
            regex=r'^\d{12}$',
            message='Enter a valid 12-digit Aadhaar number'
        )]
    )

    # Medical Information
    blood_group = models.CharField(max_length=5, blank=True)

    # Role and Status
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='patient')
    is_verified = models.BooleanField(default=False)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_login_at = models.DateTimeField(null=True, blank=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['full_name', 'phone']
    
    objects = UserManager()

    class Meta:
        db_table = 'users'
        verbose_name = 'User'
        verbose_name_plural = 'Users'
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['role']),
            models.Index(fields=['is_active']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.full_name} ({self.email}) - {self.get_role_display()}"

    def save(self, *args, **kwargs):
        if not self.username:
            # Create a unique username if not provided
            self.username = self.email.split('@')[0] + str(uuid.uuid4())[:8]
        super().save(*args, **kwargs)

    def is_patient(self):
        return self.role == 'patient'

    def is_doctor(self):
        return self.role == 'doctor'

    def is_admin(self):
        return self.role == 'admin'


class Department(models.Model):
    """Medical departments/specialties"""
    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=10, unique=True)
    description = models.TextField()
    icon = models.CharField(max_length=50, help_text='Font Awesome icon class', blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'departments'
        verbose_name = 'Department'
        verbose_name_plural = 'Departments'
        ordering = ['name']

    def __str__(self):
        return self.name


class Doctor(models.Model):
    """Doctor profile linked to User model"""
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='doctor_profile',
        limit_choices_to={'role': 'doctor'}
    )
    # Professional Information
    specialty = models.CharField(max_length=100)
    department = models.ForeignKey(
        Department,
        on_delete=models.CASCADE,
        related_name='doctors'
    )
    qualification = models.CharField(max_length=200)
    experience = models.CharField(max_length=50)
    license_number = models.CharField(max_length=50, unique=True)

    # Financial
    consultation_fee = models.DecimalField(
        max_digits=8,
        decimal_places=2
    )
    # Status
    rating = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        default=Decimal('0.00')
    )
    is_available = models.BooleanField(default=True)
    is_verified = models.BooleanField(default=False)

    # Additional Information
    bio = models.TextField(blank=True)

    # Current Queue Status
    current_token = models.CharField(
        max_length=20,
        blank=True,
        help_text='Current patient token being served'
    )
    queue_status = models.CharField(
        max_length=20,
        choices=[
            ('available', 'Available'),
            ('busy', 'Busy'),
            ('break', 'On Break'),
            ('offline', 'Offline'),
        ],
        default='offline'
    )
    average_time_per_patient = models.FloatField(null=True, blank=True)
    waiting_time_estimate = models.FloatField(null=True, blank=True)

    # Admin who registered this doctor
    registered_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='registered_doctors',
        limit_choices_to={'role': 'admin'}
    )
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'doctors'
        verbose_name = 'Doctor'
        verbose_name_plural = 'Doctors'
        indexes = [
            models.Index(fields=['specialty']),
            models.Index(fields=['is_available']),
            models.Index(fields=['department']),
        ]
        ordering = ['-rating', 'user__full_name']

    def __str__(self):
        return f"Dr. {self.user.full_name} - {self.specialty}"

    @property
    def full_name(self):
        return f"Dr. {self.user.full_name}"

    @property
    def email(self):
        return self.user.email

    @property
    def phone(self):
        return self.user.phone
    @property
    def average_rating(self):
        """Return doctor’s average rating"""
        reviews = self.reviews.all()
        if reviews.count() == 0:
            return 0
        return round(sum(r.rating for r in reviews) / reviews.count(), 2)


class DoctorAvailability(models.Model):
    """Doctor's weekly availability schedule"""
    DAY_CHOICES = [
        ('monday', 'Monday'),
        ('tuesday', 'Tuesday'),
        ('wednesday', 'Wednesday'),
        ('thursday', 'Thursday'),
        ('friday', 'Friday'),
        ('saturday', 'Saturday'),
        ('sunday', 'Sunday'),
    ]
    doctor = models.ForeignKey(
        Doctor,
        on_delete=models.CASCADE,
        related_name='availabilities'
    )
    day_of_week = models.CharField(max_length=10, choices=DAY_CHOICES)
    start_time = models.TimeField()
    end_time = models.TimeField()
    max_appointments = models.IntegerField(default=20)
    is_available = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'doctor_availabilities'
        verbose_name = 'Doctor Availability'
        verbose_name_plural = 'Doctor Availabilities'
        unique_together = ['doctor', 'day_of_week']

    def __str__(self):
        return f"{self.doctor.full_name} - {self.get_day_of_week_display()}"


class Appointment(models.Model):
    """Appointment booking system with queue management"""
    STATUS_CHOICES = [
        ('scheduled', 'Scheduled'),
        ('confirmed', 'Confirmed'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
        ('no_show', 'No Show'),
    ]
    BOOKING_TYPE_CHOICES = [
        ('disease', 'By Disease/Department'),
        ('doctor', 'By Doctor'),
    ]

    # Core Information
    patient = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='patient_appointments',
        limit_choices_to={'role': 'patient'}
    )
    doctor = models.ForeignKey(
        Doctor,
        on_delete=models.CASCADE,
        related_name='doctor_appointments'
    )
    department = models.ForeignKey(Department, on_delete=models.CASCADE)

    # Scheduling
    appointment_date = models.DateField()
    time_slot = models.TimeField()
    status = models.CharField(
        max_length=15,
        choices=STATUS_CHOICES,
        default='scheduled'
    )

    # Token System
    token_number = models.CharField(max_length=20, unique=True, blank=True)
    queue_position = models.IntegerField(default=0)
    estimated_time = models.TimeField(null=True, blank=True)
    estimated_wait_minutes = models.PositiveIntegerField(default=0)

    # Booking Details
    reason = models.TextField()
    booking_type = models.CharField(max_length=10, choices=BOOKING_TYPE_CHOICES)
    is_for_self = models.BooleanField(default=True)
    patient_relation = models.CharField(max_length=50, blank=True)

    # Session Details
    consultation_started_at = models.DateTimeField(null=True, blank=True)
    consultation_ended_at = models.DateTimeField(null=True, blank=True)

    # Additional Information
    notes = models.TextField(blank=True)
    prescription = models.TextField(blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'appointments'
        verbose_name = 'Appointment'
        verbose_name_plural = 'Appointments'
        ordering = ['-appointment_date', 'queue_position']
        indexes = [
            models.Index(fields=['appointment_date', 'doctor']),
            models.Index(fields=['status']),
            models.Index(fields=['token_number']),
        ]
        # Note: Serializer validation ensures only one patient per time slot

    def save(self, *args, **kwargs):
        if not self.token_number:
            # Generate unique token: DEPT-YYYYMMDD-NNNN
            date_str = self.appointment_date.strftime('%Y%m%d')
            dept_prefix = self.department.code
            count = Appointment.objects.filter(
                doctor=self.doctor,
                appointment_date=self.appointment_date
            ).count() + 1
            self.token_number = f"{dept_prefix}-{date_str}-{count:04d}"
            # Set queue position
            self.queue_position = count
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.token_number}: {self.patient.full_name} with {self.doctor.full_name}"


class QueueStatus(models.Model):
    """Real-time queue status for doctors"""
    doctor = models.ForeignKey(Doctor, on_delete=models.CASCADE, related_name='queue_statuses')
    appointment_date = models.DateField()
    current_token = models.CharField(max_length=20, blank=True)
    total_tokens = models.IntegerField(default=0)
    completed_tokens = models.IntegerField(default=0)
    average_time_per_patient = models.DurationField(null=True, blank=True)
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'queue_status'
        unique_together = ['doctor', 'appointment_date']
        ordering = ['-appointment_date']

    def __str__(self):
        return f"{self.doctor.full_name} ({self.appointment_date}) - Token: {self.current_token}"


class MedicalRecord(models.Model):
    """Patient medical records from consultations"""
    patient = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='medical_records',
        limit_choices_to={'role': 'patient'}
    )
    doctor = models.ForeignKey(
        Doctor,
        on_delete=models.CASCADE,
        related_name='created_records'
    )
    appointment = models.OneToOneField(
        Appointment,
        on_delete=models.CASCADE,
        related_name='medical_record',
        null=True,
        blank=True
    )

    # Medical Information
    diagnosis = models.TextField()
    symptoms = models.TextField()
    treatment_plan = models.TextField()

    # Medications
    prescriptions = models.JSONField(default=list)
    procedures = models.TextField(blank=True)

    # Vital Signs
    vitals = models.JSONField(default=dict)

    # Follow-up
    follow_up_required = models.BooleanField(default=False)
    follow_up_date = models.DateField(null=True, blank=True)

    # Additional Notes
    notes = models.TextField(blank=True)

    # Timestamps
    visit_date = models.DateTimeField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'medical_records'
        verbose_name = 'Medical Record'
        verbose_name_plural = 'Medical Records'
        ordering = ['-visit_date']
        indexes = [
            models.Index(fields=['patient']),
            models.Index(fields=['doctor']),
            models.Index(fields=['visit_date']),
        ]

    def __str__(self):
        return f"Record for {self.patient.full_name} on {self.visit_date.strftime('%Y-%m-%d')}"


class FamilyMember(models.Model):
    """Family members linked to user account"""
    GENDER_CHOICES = [
        ('male', 'Male'),
        ('female', 'Female'),
        ('other', 'Other'),
    ]
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='family_members',
        limit_choices_to={'role': 'patient'}
    )
    full_name = models.CharField(max_length=100)
    age = models.IntegerField()
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES)
    aadhaar_number = models.CharField(
        max_length=12,
        unique=True,
        validators=[RegexValidator(
            regex=r'^\d{12}$',
            message='Enter a valid 12-digit Aadhaar number'
        )]
    )
    relation = models.CharField(max_length=50)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'family_members'
        verbose_name = 'Family Member'
        verbose_name_plural = 'Family Members'
        indexes = [
            models.Index(fields=['user']),
        ]

    def __str__(self):
        return f"{self.full_name} ({self.relation} of {self.user.full_name})"


class Admin(models.Model):
    """Admin profile for system administrators"""
    ROLE_CHOICES = [
        ('super_admin', 'Super Admin'),
        ('manager', 'Manager'),
        ('staff', 'Staff'),
    ]
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='admin_profile',
        limit_choices_to={'role': 'admin'}
    )
    admin_role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    permissions = models.JSONField(default=dict)
    accessible_departments = models.ManyToManyField(Department, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'admins'
        verbose_name = 'Admin'
        verbose_name_plural = 'Admins'

    def __str__(self):
        return f"Admin: {self.user.full_name} ({self.admin_role})"
    

class DoctorReview(models.Model):
    doctor = models.ForeignKey(
        Doctor,
        on_delete=models.CASCADE,
        related_name="reviews"
    )
    patient = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="doctor_reviews",
        limit_choices_to={'role': 'patient'}
    )
    appointment = models.ForeignKey(
        Appointment,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="appointment_review"
    )

    rating = models.IntegerField()  # 1–5 stars
    comment = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "doctor_reviews"
        ordering = ["-created_at"]

    def __str__(self):
        return f"⭐ {self.rating} by {self.patient.full_name} for {self.doctor.full_name}"


class Notification(models.Model):
    """Simple in-app notification for appointments/queues"""
    CATEGORY_CHOICES = [
        ('appointment', 'Appointment'),
        ('queue', 'Queue'),
        ('general', 'General'),
    ]

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    appointment = models.ForeignKey(
        Appointment,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='notifications'
    )
    title = models.CharField(max_length=150)
    message = models.TextField()
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='general')
    data = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'notifications'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} → {self.user.full_name}"

    def mark_read(self):
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=['is_read', 'read_at'])
