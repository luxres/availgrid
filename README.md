# When2meetClone

An open-source, no-login group-scheduling tool inspired by when2meet.com.
Flask + SQLite backend, server-rendered Bootstrap 5 templates, vanilla JS
for the drag-to-select availability grid.

## Quickstart

```bash
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

Visit http://localhost:5000

The SQLite database is created automatically at `instance/when2meet.db`
on first run.

## How it works

1. **Create an event** (`/`) — pick a name, either a specific date range
   or a set of weekdays, and a time window. This generates a short event
   ID and redirects to `/e/<event_id>`.
2. **Share the link** — anyone with the link can open the event, no
   account required.
3. **Mark availability** — type a name (optionally a password, so only
   you can edit your entry later), drag across the grid, click **Save**.
4. **See the heatmap** — switch to "Group heatmap" to see everyone's
   overlap; darker cells mean more people are free, and hovering a cell
   lists who.

## Project layout

```
when2meet/
├── run.py                  # entry point
├── requirements.txt
├── instance/                # SQLite DB lives here (gitignored)
└── app/
    ├── __init__.py          # app factory, db init
    ├── models.py             # Event, Participant, Availability
    ├── routes.py              # views + JSON API
    ├── templates/
    │   ├── base.html
    │   ├── index.html          # create-event form
    │   └── event.html           # grid page
    └── static/
        ├── css/style.css
        └── js/grid.js            # grid rendering, drag-select, heatmap

```

## Data model

- **Event** — name, type (`dates` or `days`), the JSON-encoded list of
  dates/weekdays, start/end time, slot size in minutes, timezone label.
- **Participant** — belongs to an event; unique `(event_id, name)`;
  optional password hash so a name can't be hijacked.
- **Availability** — one row per `(participant, slot)` the participant
  marked as free. `slot` is a string like `"2026-09-05|09:30"`.

## API endpoints

| Method | Path                         | Purpose                              |
|--------|------------------------------|---------------------------------------|
| GET    | `/e/<event_id>/api/data`     | All participants + their selected slots |
| POST   | `/e/<event_id>/api/save`     | Upsert a participant's availability   |

## Known limitations / good next steps

- Timezone is a display label only — no automatic conversion between
  participants in different zones yet.
- No event edit/delete UI.
- No rate limiting on the save endpoint.
- Password is optional and only protects against accidental overwrite,
  not a real auth system — don't rely on it for anything sensitive.
- The grid is rebuilt client-side from JSON on every load; for very
  large date ranges you may want pagination or virtualization.
