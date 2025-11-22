# healthcare/utils/rescheduler.py
from django.utils import timezone
from datetime import timedelta
from django.db import transaction
from healthcare.models import Appointment, DoctorAvailability, Notification
from django.core.management.base import BaseCommand
from healthcare.utils.rescheduler import reschedule_yesterday_appointments
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = "Automatically reschedule past appointments."

    def handle(self, *args, **kwargs):
        logger.info("Running automatic appointment rescheduler...")
        result = reschedule_yesterday_appointments()
        logger.info(f"Rescheduling complete: {result}")
        self.stdout.write(self.style.SUCCESS("Rescheduling complete."))

def get_next_available_slot(doctor, start_date):
    """
    Returns the NEXT valid date & time_slot for the doctor
    based on availability and already booked appointments.
    """

    day_ptr = start_date
    max_days_ahead = 15  # Prevent infinite loops

    for _ in range(max_days_ahead):
        weekday = day_ptr.strftime("%A").lower()

        # Get doctor's availability for that weekday
        avail = DoctorAvailability.objects.filter(
            doctor=doctor,
            day_of_week=weekday,
            is_available=True
        ).first()

        if not avail:
            day_ptr += timedelta(days=1)
            continue

        # Generate all slots based on availability hour range
        start_hour = avail.start_time.hour
        end_hour = avail.end_time.hour

        possible_slots = [f"{h:02d}:00:00" for h in range(start_hour, end_hour)]

        # Get booked slots
        booked = set(
            Appointment.objects.filter(
                doctor=doctor,
                appointment_date=day_ptr
            ).values_list("time_slot", flat=True)
        )

        # Check each possible slot
        for slot in possible_slots:
            if slot not in booked:
                return day_ptr, slot

        # If full, go to next day
        day_ptr += timedelta(days=1)

    return None, None  # No available slot


def reschedule_yesterday_appointments(send_notification=True):
    """
    Moves ALL 'scheduled' appointments that are in the past
    (yesterday or earlier) to the next available slot.
    """
    today = timezone.localdate()
    yesterday = today - timedelta(days=1)

    to_reschedule = Appointment.objects.filter(
        status="scheduled",
        appointment_date__lte=yesterday
    )

    results = {"moved": [], "skipped": [], "errors": []}

    for appt in to_reschedule:
        try:
            new_date, new_slot = get_next_available_slot(appt.doctor, today)

            if not new_date or not new_slot:
                results["skipped"].append(appt.id)
                continue

            with transaction.atomic():
                old_date = appt.appointment_date
                old_slot = appt.time_slot

                appt.appointment_date = new_date
                appt.time_slot = new_slot
                appt.status = "scheduled"
                appt.save()

                results["moved"].append(appt.id)

                # Create Notification
                if send_notification:
                    Notification.objects.create(
                        user=appt.patient,
                        appointment=appt,
                        category="appointment",
                        title="Appointment Rescheduled",
                        message=(
                            f"Your appointment with {appt.doctor.full_name} "
                            f"has been automatically rescheduled "
                            f"from {old_date} at {old_slot} "
                            f"to {new_date} at {new_slot}."
                        ),
                        data={
                            "old_date": str(old_date),
                            "old_time": str(old_slot),
                            "new_date": str(new_date),
                            "new_time": str(new_slot),
                            "doctor": appt.doctor.full_name,
                        }
                    )

        except Exception as e:
            logger.error(f"Error rescheduling Appointment {appt.id}: {str(e)}")
            results["errors"].append(str(e))

    return results
