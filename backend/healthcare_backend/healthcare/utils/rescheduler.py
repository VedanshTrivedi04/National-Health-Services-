# appointments/utils/rescheduler.py
from datetime import timedelta, datetime, time
from django.db import transaction
from django.utils import timezone
from django.db.models import Q

from healthcare.models import (
    Appointment,
    DoctorAvailability,
    Doctor,
    QueueStatus,
    Notification
)

DEFAULT_SLOT_MINUTES = 10
MAX_SEARCH_DAYS = 30  # safety limit — don't search infinitely


def _doctor_avg_minutes(doctor: Doctor):
    """Return an integer minutes average for slot duration (fallback DEFAULT_SLOT_MINUTES)."""
    try:
        if doctor.average_time_per_patient:
            return max(5, int(round(doctor.average_time_per_patient)))
    except Exception:
        pass
    return DEFAULT_SLOT_MINUTES


def find_next_available_slot(doctor: Doctor, start_date):
    """
    Find the next date and time_slot where the doctor has capacity.
    Returns (date (datetime.date), time (datetime.time)) or (None, None) if not found within MAX_SEARCH_DAYS.
    Algorithm:
      - For each day from start_date -> start_date + MAX_SEARCH_DAYS:
        - check DoctorAvailability record matching weekday & is_available
        - build candidate time slots from start_time to end_time with duration = doctor's avg_minutes
        - compare with existing appointments on that date for that doctor and pick first free slot
    """
    avg_min = _doctor_avg_minutes(doctor)

    for day_offset in range(0, MAX_SEARCH_DAYS):
        candidate_date = start_date + timedelta(days=day_offset)
        weekday = candidate_date.strftime('%A').lower()

        avail_qs = DoctorAvailability.objects.filter(
            doctor=doctor,
            day_of_week=weekday,
            is_available=True
        )

        if not avail_qs.exists():
            continue

        # use first availability (you can choose to prefer one)
        avail = avail_qs.order_by('start_time').first()

        # build candidate times
        start_dt = datetime.combine(candidate_date, avail.start_time)
        end_dt = datetime.combine(candidate_date, avail.end_time)
        slots = []
        cur = start_dt
        while (cur + timedelta(minutes=avg_min)) <= end_dt and len(slots) < avail.max_appointments:
            slots.append(cur.time())
            cur = cur + timedelta(minutes=avg_min)

        # gather already-booked time_slots for doctor on this date (exclude cancelled/no_show)
        booked = set(
            Appointment.objects.filter(
                doctor=doctor,
                appointment_date=candidate_date
            ).exclude(status__in=['cancelled', 'no_show']).values_list('time_slot', flat=True)
        )

        # find first slot not in booked
        for s in slots:
            if s not in booked:
                return (candidate_date, s)

    return (None, None)


def reschedule_yesterday_appointments(send_notification=True):
    """
    Find appointments for yesterday (or appointments with appointment_date < today)
    with status in scheduled/confirmed/waiting and try to move them to the next available slot.
    Returns a dict with stats.
    """
    today = timezone.localdate()
    yesterday = today - timedelta(days=1)

    # Choose which appointments to move:
    # appointments whose appointment_date < today but are not completed/cancelled/no_show
    moving_qs = Appointment.objects.filter(
        appointment_date__lt=today
    ).exclude(status__in=['completed', 'cancelled', 'no_show']).order_by('appointment_date', 'queue_position', 'created_at')

    moved = []
    skipped = []
    errors = []

    for appt in moving_qs:
        try:
            doctor = appt.doctor
            # search start_date = today (or day after original date?), start from today to avoid moving back
            start_search = today

            new_date, new_time = find_next_available_slot(doctor, start_search)
            if not new_date:
                skipped.append({
                    "appointment_id": appt.id,
                    "reason": "no_slot_found"
                })
                continue

            with transaction.atomic():
                # reset token so model save() will generate new token using appointment_date
                appt.token_number = ''
                appt.appointment_date = new_date
                appt.time_slot = new_time
                appt.status = 'scheduled'  # keep scheduled
                appt.estimated_wait_minutes = 0
                appt.estimated_time = None
                appt.save()  # save generates new token and queue_position (per your save())

                # update queue status for that doctor/date — best to call your existing helper
                # If you have a global queue updater, call it. We'll try update QueueStatus quickly here.
                try:
                    # Recalculate or touch QueueStatus for both old and new dates.
                    QueueStatus.objects.filter(doctor=doctor, appointment_date=new_date).update(last_updated=timezone.now())
                except Exception:
                    # not fatal — the existing _update_queue() should be invoked elsewhere in your code
                    pass

                # create a Notification for patient
                if send_notification:
                    Notification.objects.create(
                        user=appt.patient,
                        appointment=appt,
                        title="Appointment rescheduled",
                        message=f"Your appointment with {doctor.full_name} has been moved to {new_date.strftime('%Y-%m-%d')} at {new_time.strftime('%H:%M')}.",
                        category='appointment',
                        data={
                            "appointment_id": appt.id,
                            "new_date": new_date.isoformat(),
                            "new_time": new_time.strftime('%H:%M')
                        }
                    )
                moved.append({
                    "appointment_id": appt.id,
                    "new_date": new_date.isoformat(),
                    "new_time": new_time.strftime('%H:%M')
                })
        except Exception as e:
            errors.append({"appointment_id": getattr(appt, 'id', None), "error": str(e)})

    return {"moved": moved, "skipped": skipped, "errors": errors}
