import json
import uuid
from datetime import datetime

from werkzeug.security import check_password_hash, generate_password_hash

from app import db


def make_id():
    return uuid.uuid4().hex[:10]


class Event(db.Model):
    __tablename__ = "events"

    id = db.Column(db.String(10), primary_key=True, default=make_id)
    name = db.Column(db.String(200), nullable=False)

    # "dates"  -> specific calendar dates, e.g. planning a one-off meeting
    # "days"   -> generic days of week, e.g. a recurring weekly slot
    event_type = db.Column(db.String(10), nullable=False, default="dates")

    # JSON-encoded list of ISO date strings ("2026-09-05") for event_type="dates"
    # or list of weekday ints 0=Mon..6=Sun for event_type="days"
    slots_json = db.Column(db.Text, nullable=False, default="[]")

    start_time = db.Column(db.String(5), nullable=False, default="09:00")  # "HH:MM"
    end_time = db.Column(db.String(5), nullable=False, default="17:00")  # "HH:MM"
    slot_minutes = db.Column(db.Integer, nullable=False, default=30)
    timezone = db.Column(db.String(64), nullable=False, default="UTC")

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    participants = db.relationship(
        "Participant", backref="event", cascade="all, delete-orphan", lazy="dynamic"
    )

    @property
    def days(self):
        return json.loads(self.slots_json)

    @days.setter
    def days(self, value):
        self.slots_json = json.dumps(value)

    def time_slots(self):
        """Return list of 'HH:MM' strings between start_time and end_time."""
        h1, m1 = map(int, self.start_time.split(":"))
        h2, m2 = map(int, self.end_time.split(":"))
        start = h1 * 60 + m1
        end = h2 * 60 + m2
        step = self.slot_minutes
        out = []
        t = start
        while t < end:
            out.append(f"{t // 60:02d}:{t % 60:02d}")
            t += step
        return out

    def grid_columns(self):
        """Return ordered list of column labels (dates or weekday names)."""
        if self.event_type == "dates":
            return self.days
        weekday_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        return [weekday_names[d] for d in self.days]

    def all_slot_ids(self):
        """Every slot id in the grid, e.g. '2026-09-05|09:30' or '2|09:30'."""
        cols = self.days
        times = self.time_slots()
        return [f"{col}|{t}" for col in cols for t in times]


class Participant(db.Model):
    __tablename__ = "participants"
    __table_args__ = (db.UniqueConstraint("event_id", "name", name="uq_event_participant"),)

    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.String(10), db.ForeignKey("events.id"), nullable=False)
    name = db.Column(db.String(80), nullable=False)
    password_hash = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    availabilities = db.relationship(
        "Availability", backref="participant", cascade="all, delete-orphan", lazy="dynamic"
    )

    def set_password(self, raw_password):
        self.password_hash = generate_password_hash(raw_password) if raw_password else None

    def check_password(self, raw_password):
        if not self.password_hash:
            return True  # no password set, anyone may edit under this name
        return check_password_hash(self.password_hash, raw_password or "")


class Availability(db.Model):
    __tablename__ = "availabilities"
    __table_args__ = (
        db.UniqueConstraint("participant_id", "slot", name="uq_participant_slot"),
    )

    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.String(10), db.ForeignKey("events.id"), nullable=False)
    participant_id = db.Column(db.Integer, db.ForeignKey("participants.id"), nullable=False)
    slot = db.Column(db.String(40), nullable=False)  # "<col>|<HH:MM>"
