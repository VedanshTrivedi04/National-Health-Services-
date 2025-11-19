from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import (
    User, Doctor, Department, Appointment, MedicalRecord,
    FamilyMember, DoctorAvailability, Admin as AdminModel, QueueStatus,DoctorReview
)

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ['email', 'full_name', 'role', 'is_verified', 'is_active', 'created_at']
    list_filter = ['role', 'is_active', 'is_verified', 'gender']
    search_fields = ['email', 'full_name', 'phone', 'aadhaar_number']
    ordering = ['-created_at']
    
    # Fields to display in the admin form
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal Info', {
            'fields': ('full_name', 'phone', 'date_of_birth', 'gender', 'address', 'aadhaar_number', 'blood_group')
        }),
        ('Role & Status', {
            'fields': ('role', 'is_active', 'is_verified', 'is_staff', 'is_superuser')
        }),
        ('Permissions', {'fields': ('groups', 'user_permissions')}),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
    )
    
    # Fields for creating a new user
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        (None, {'fields': ('full_name', 'phone', 'role')}),
    )
    
    filter_horizontal = ('groups', 'user_permissions',)


@admin.register(Doctor)
class DoctorAdmin(admin.ModelAdmin):
    list_display = ['get_full_name', 'specialty', 'department', 'is_verified', 'is_available']
    list_filter = ['specialty', 'department', 'is_verified', 'is_available']
    search_fields = ['user__full_name', 'user__email', 'license_number']

    def get_full_name(self, obj):
        return obj.full_name
    get_full_name.short_description = 'Full Name'

    actions = ['verify_doctors']

    def verify_doctors(self, request, queryset):
        updated = queryset.update(is_verified=True)
        self.message_user(request, f'{updated} doctors verified.')


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'is_active', 'created_at']
    list_filter = ['is_active']
    search_fields = ['name', 'code']


@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = ['token_number', 'patient', 'doctor', 'appointment_date', 'status', 'created_at']
    list_filter = ['status', 'appointment_date', 'department']
    search_fields = ['token_number', 'patient__full_name', 'doctor__user__full_name']
    date_hierarchy = 'appointment_date'


@admin.register(MedicalRecord)
class MedicalRecordAdmin(admin.ModelAdmin):
    list_display = ['patient', 'doctor', 'visit_date', 'diagnosis']
    list_filter = ['visit_date', 'follow_up_required']
    search_fields = ['patient__full_name', 'doctor__user__full_name', 'diagnosis']


# Register remaining models
admin.site.register(DoctorAvailability)
admin.site.register(FamilyMember)
admin.site.register(AdminModel)
admin.site.register(QueueStatus)
admin.site.register(DoctorReview)