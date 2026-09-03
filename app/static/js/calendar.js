(function () {
  "use strict";

  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const calendarEl = document.getElementById("date_calendar");
  if (!calendarEl) return; // calendar not present on this page

  const monthLabel = document.getElementById("cal_month_label");
  const prevBtn = document.getElementById("cal_prev_btn");
  const nextBtn = document.getElementById("cal_next_btn");
  const warningEl = document.getElementById("cal_warning");
  const selectedList = document.getElementById("cal_selected_list");
  const selectedCount = document.getElementById("cal_selected_count");
  const hiddenInputsContainer = document.getElementById("cal_hidden_inputs");
  const form = document.getElementById("create_event_form");
  const typeDates = document.getElementById("type_dates");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let viewYear = today.getFullYear();
  let viewMonth = today.getMonth(); // 0-based
  const selectedDates = new Set();

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function toIso(year, month, day) {
    return `${year}-${pad(month + 1)}-${pad(day)}`;
  }

  function isPast(year, month, day) {
    const d = new Date(year, month, day);
    d.setHours(0, 0, 0, 0);
    return d < today;
  }

  function isToday(year, month, day) {
    return (
      year === today.getFullYear() &&
      month === today.getMonth() &&
      day === today.getDate()
    );
  }

  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function renderCalendar() {
    calendarEl.innerHTML = "";
    monthLabel.textContent = `${MONTH_NAMES[viewMonth]} ${viewYear}`;

    WEEKDAY_LABELS.forEach((label) => {
      calendarEl.appendChild(el("div", "cal-weekday", label));
    });

    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    // JS getDay(): 0=Sun..6=Sat; shift to Mon-first (0=Mon..6=Sun)
    const leadingBlanks = (firstOfMonth.getDay() + 6) % 7;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    for (let i = 0; i < leadingBlanks; i++) {
      calendarEl.appendChild(el("div", "cal-day cal-day-empty"));
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const iso = toIso(viewYear, viewMonth, day);
      const cell = el("div", "cal-day", String(day));
      cell.dataset.date = iso;

      if (isPast(viewYear, viewMonth, day)) {
        cell.classList.add("disabled");
      } else {
        cell.addEventListener("click", () => toggleDate(iso, cell));
      }
      if (isToday(viewYear, viewMonth, day)) cell.classList.add("today");
      if (selectedDates.has(iso)) cell.classList.add("selected");

      calendarEl.appendChild(cell);
    }
  }

  function toggleDate(iso, cell) {
    if (selectedDates.has(iso)) {
      selectedDates.delete(iso);
      cell.classList.remove("selected");
    } else {
      selectedDates.add(iso);
      cell.classList.add("selected");
    }
    renderSelectedSummary();
  }

  function removeDate(iso) {
    selectedDates.delete(iso);
    renderSelectedSummary();
    const cell = calendarEl.querySelector(`[data-date="${iso}"]`);
    if (cell) cell.classList.remove("selected");
  }

  function renderSelectedSummary() {
    selectedList.innerHTML = "";
    const sorted = Array.from(selectedDates).sort();
    selectedCount.textContent = sorted.length;

    sorted.forEach((iso) => {
      const chip = el("span", "badge rounded-pill text-bg-light border cal-chip");
      chip.textContent = iso;

      const remove = el("button", "btn-close ms-1");
      remove.type = "button";
      remove.style.fontSize = "0.55rem";
      remove.setAttribute("aria-label", `Remove ${iso}`);
      remove.addEventListener("click", () => removeDate(iso));

      chip.appendChild(remove);
      selectedList.appendChild(chip);
    });

    if (sorted.length > 0) {
      warningEl.classList.add("d-none");
    }
  }

  function syncHiddenInputs() {
    hiddenInputsContainer.innerHTML = "";
    selectedDates.forEach((iso) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = "dates";
      input.value = iso;
      hiddenInputsContainer.appendChild(input);
    });
  }

  prevBtn.addEventListener("click", () => {
    viewMonth -= 1;
    if (viewMonth < 0) {
      viewMonth = 11;
      viewYear -= 1;
    }
    renderCalendar();
  });

  nextBtn.addEventListener("click", () => {
    viewMonth += 1;
    if (viewMonth > 11) {
      viewMonth = 0;
      viewYear += 1;
    }
    renderCalendar();
  });

  if (form) {
    form.addEventListener("submit", (e) => {
      syncHiddenInputs();
      if (typeDates.checked && selectedDates.size === 0) {
        e.preventDefault();
        warningEl.classList.remove("d-none");
      }
    });
  }

  renderCalendar();
  renderSelectedSummary();
})();
