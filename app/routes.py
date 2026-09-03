from datetime import datetime

from flask import Blueprint, abort, jsonify, redirect, render_template, request, url_for

from app import db
from app.models import Availability, Event, Participant

bp = Blueprint("main", __name__)


@bp.route("/")
def index():
    return render_template("index.html")


@bp.route("/create", methods=["POST"])
def create_event():
    name = request.form.get("name", "").strip() or "Untitled event"
    event_type = request.form.get("event_type", "dates")
    start_time = request.form.get("start_time", "09:00")
    end_time = request.form.get("end_time", "17:00")
    slot_minutes = int(request.form.get("slot_minutes", 30))
    timezone = request.form.get("timezone", "UTC")

    event = Event(
        name=name,
        event_type=event_type,
        start_time=start_time,
        end_time=end_time,
        slot_minutes=slot_minutes,
        timezone=timezone,
    )

    if event_type == "dates":
        raw_dates = request.form.getlist("dates")
        dates = set()
        for raw in raw_dates:
            try:
                dates.add(datetime.strptime(raw, "%Y-%m-%d").date().isoformat())
            except ValueError:
                abort(400, description=f"Invalid date: {raw!r}")
        if not dates:
            abort(400, description="Select at least one date.")
        event.days = sorted(dates)
    else:
        selected_days = request.form.getlist("weekday")
        event.days = sorted(int(d) for d in selected_days) if selected_days else [0, 1, 2, 3, 4]

    db.session.add(event)
    db.session.commit()

    return redirect(url_for("main.view_event", event_id=event.id))


@bp.route("/e/<event_id>")
def view_event(event_id):
    event = Event.query.get_or_404(event_id)
    return render_template(
        "event.html",
        event=event,
        columns=event.grid_columns(),
        raw_columns=event.days,
        times=event.time_slots(),
    )


@bp.route("/e/<event_id>/api/data")
def event_data(event_id):
    event = Event.query.get_or_404(event_id)
    participants = event.participants.all()

    result = []
    for p in participants:
        slots = [a.slot for a in p.availabilities]
        result.append({"name": p.name, "slots": slots})

    return jsonify({"participants": result})


@bp.route("/e/<event_id>/api/save", methods=["POST"])
def save_availability(event_id):
    event = Event.query.get_or_404(event_id)
    payload = request.get_json(force=True) or {}

    name = (payload.get("name") or "").strip()
    password = payload.get("password") or ""
    slots = payload.get("slots") or []

    if not name:
        return jsonify({"error": "Name is required."}), 400

    participant = Participant.query.filter_by(event_id=event.id, name=name).first()

    if participant is None:
        participant = Participant(event_id=event.id, name=name)
        participant.set_password(password)
        db.session.add(participant)
        db.session.flush()  # assign participant.id before we use it below
    else:
        if not participant.check_password(password):
            return jsonify({"error": "Incorrect password for this name."}), 403

    Availability.query.filter_by(participant_id=participant.id).delete()
    db.session.flush()

    valid_slots = set(event.all_slot_ids())
    for slot in slots:
        if slot in valid_slots:
            db.session.add(
                Availability(event_id=event.id, participant_id=participant.id, slot=slot)
            )

    db.session.commit()
    return jsonify({"ok": True, "name": participant.name, "slot_count": len(slots)})
