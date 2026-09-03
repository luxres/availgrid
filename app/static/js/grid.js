(function () {
  "use strict";

  const { id: eventId, columns, rawColumns, times } = window.EVENT_DATA;

  const gridWrapper = document.getElementById("grid_wrapper");
  const nameInput = document.getElementById("participant_name");
  const passwordInput = document.getElementById("participant_password");
  const saveBtn = document.getElementById("save_btn");
  const saveStatus = document.getElementById("save_status");
  const modeEdit = document.getElementById("mode_edit");
  const modeGroup = document.getElementById("mode_group");
  const participantList = document.getElementById("participant_list");
  const participantCount = document.getElementById("participant_count");
  const hoverInfo = document.getElementById("hover_info");
  const copyLinkBtn = document.getElementById("copy_link_btn");

  const NAME_KEY = `when2meet:${eventId}:name`;

  let mySlots = new Set();          // slots the current user has selected (edit mode)
  let allParticipants = [];         // [{name, slots: [...]}] from server
  let mode = "edit";                // "edit" | "group"
  let dragging = false;
  let dragValue = true;             // true = selecting, false = deselecting

  const TAP_MOVE_THRESHOLD = 10;    // px; touch beyond this is a scroll, not a tap
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartCell = null;

  // ---------- grid construction ----------

  function slotId(col, time) {
    return `${col}|${time}`;
  }

  function buildGrid() {
    gridWrapper.innerHTML = "";
    gridWrapper.style.setProperty("--cols", rawColumns.length);

    const grid = document.createElement("div");
    grid.className = "w2m-grid";

    // corner cell
    grid.appendChild(el("div", "w2m-cell w2m-corner"));

    // column headers
    columns.forEach((label) => {
      const h = el("div", "w2m-cell w2m-col-header", label);
      grid.appendChild(h);
    });

    // rows
    times.forEach((time) => {
      const rowLabel = el("div", "w2m-cell w2m-row-header", time);
      grid.appendChild(rowLabel);

      rawColumns.forEach((col) => {
        const cell = el("div", "w2m-cell w2m-slot");
        cell.dataset.slot = slotId(col, time);
        grid.appendChild(cell);
      });
    });

    gridWrapper.appendChild(grid);
  }

  function el(tag, className, text) {
    const e = document.createElement("div");
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  // ---------- edit mode: drag to select ----------

  function cellIsSelected(cell) {
    return mySlots.has(cell.dataset.slot);
  }

  function setCellSelected(cell, selected) {
    if (selected) {
      mySlots.add(cell.dataset.slot);
    } else {
      mySlots.delete(cell.dataset.slot);
    }
    cell.classList.toggle("selected", selected);
  }

  function onDragStart(cell) {
    dragging = true;
    dragValue = !cellIsSelected(cell);
    setCellSelected(cell, dragValue);
  }

  function onDragMove(cell) {
    if (!dragging || !cell) return;
    setCellSelected(cell, dragValue);
  }

  function onDragEnd() {
    dragging = false;
  }

  function attachEditHandlers() {
    gridWrapper.querySelectorAll(".w2m-slot").forEach((cell) => {
      cell.addEventListener("mousedown", (e) => {
        if (mode !== "edit") return;
        e.preventDefault();
        onDragStart(cell);
      });
      cell.addEventListener("mouseenter", () => {
        if (mode !== "edit") return;
        onDragMove(cell);
      });
      // Touch is tap-to-toggle, not drag-select: a finger dragging across the
      // grid is scrolling it horizontally, so touchmove is left unhandled
      // (and these listeners are passive) to let native scrolling happen.
      cell.addEventListener("touchstart", (e) => {
        if (mode !== "edit") return;
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        touchStartCell = cell;
      }, { passive: true });
      cell.addEventListener("touchend", (e) => {
        if (mode !== "edit" || !touchStartCell) return;
        // Suppress the synthetic mousedown/click mobile browsers fire after a
        // touch tap for compatibility with non-touch-aware pages — otherwise
        // it re-runs onDragStart and immediately cancels this toggle.
        e.preventDefault();
        const touch = e.changedTouches[0];
        const movedDistance = Math.hypot(
          touch.clientX - touchStartX,
          touch.clientY - touchStartY
        );
        if (movedDistance < TAP_MOVE_THRESHOLD) {
          setCellSelected(touchStartCell, !cellIsSelected(touchStartCell));
        }
        touchStartCell = null;
      }, { passive: false });
    });

    document.addEventListener("mouseup", onDragEnd);
  }

  // ---------- group / heatmap mode ----------

  function renderHeatmap() {
    const total = allParticipants.length;
    const counts = {};
    const namesBySlot = {};

    allParticipants.forEach((p) => {
      p.slots.forEach((s) => {
        counts[s] = (counts[s] || 0) + 1;
        (namesBySlot[s] = namesBySlot[s] || []).push(p.name);
      });
    });

    gridWrapper.querySelectorAll(".w2m-slot").forEach((cell) => {
      const slot = cell.dataset.slot;
      const count = counts[slot] || 0;
      const ratio = total > 0 ? count / total : 0;
      cell.style.backgroundColor = ratio > 0
        ? `rgba(13, 110, 253, ${0.12 + ratio * 0.75})`
        : "";
      cell.classList.remove("selected");
      cell.onmouseenter = () => {
        if (mode !== "group") return;
        const names = namesBySlot[slot] || [];
        hoverInfo.textContent = names.length
          ? `${count}/${total} free — ${names.join(", ")}`
          : "No one free yet";
      };
    });
  }

  function clearHeatmapStyles() {
    gridWrapper.querySelectorAll(".w2m-slot").forEach((cell) => {
      cell.style.backgroundColor = "";
      cell.onmouseenter = null;
    });
  }

  function renderEditSelection() {
    gridWrapper.querySelectorAll(".w2m-slot").forEach((cell) => {
      cell.classList.toggle("selected", mySlots.has(cell.dataset.slot));
    });
  }

  function renderParticipantList() {
    participantList.innerHTML = "";
    participantCount.textContent = allParticipants.length;
    allParticipants.forEach((p) => {
      const li = document.createElement("li");
      li.textContent = p.name;
      li.className = "py-1";
      participantList.appendChild(li);
    });
  }

  // ---------- mode switching ----------

  const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;

  function applyMode() {
    hoverInfo.textContent = mode === "edit"
      ? (isTouchDevice ? "Tap cells to mark when you're free." : "Drag across the grid to mark when you're free.")
      : "Hover a cell to see who's free.";
    if (mode === "edit") {
      clearHeatmapStyles();
      renderEditSelection();
    } else {
      renderHeatmap();
    }
  }

  modeEdit.addEventListener("change", () => { mode = "edit"; applyMode(); });
  modeGroup.addEventListener("change", () => { mode = "group"; applyMode(); });

  // ---------- data loading / saving ----------

  async function loadData() {
    const res = await fetch(`/e/${eventId}/api/data`);
    const data = await res.json();
    allParticipants = data.participants || [];
    renderParticipantList();
    if (mode === "group") renderHeatmap();
    updateSaveButtonLabel();
  }

  function updateSaveEnabled() {
    saveBtn.disabled = nameInput.value.trim().length === 0;
  }

  function updateSaveButtonLabel() {
    const name = nameInput.value.trim();
    const exists = allParticipants.some((p) => p.name === name);
    saveBtn.textContent = exists ? "Update my availability" : "Save my availability";
  }

  nameInput.addEventListener("input", () => {
    updateSaveEnabled();
    updateSaveButtonLabel();
  });

  saveBtn.addEventListener("click", async () => {
    const name = nameInput.value.trim();
    if (!name) return;

    saveBtn.disabled = true;
    saveStatus.textContent = "Saving…";
    saveStatus.className = "form-text mt-2 text-muted";

    try {
      const res = await fetch(`/e/${eventId}/api/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          password: passwordInput.value,
          slots: Array.from(mySlots),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        saveStatus.textContent = data.error || "Something went wrong.";
        saveStatus.className = "form-text mt-2 text-danger";
      } else {
        saveStatus.textContent = "Saved!";
        saveStatus.className = "form-text mt-2 text-success";
        localStorage.setItem(NAME_KEY, name);
        await loadData();
      }
    } catch (err) {
      saveStatus.textContent = "Network error — please try again.";
      saveStatus.className = "form-text mt-2 text-danger";
    } finally {
      saveBtn.disabled = false;
    }
  });

  function legacyCopyToClipboard(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    if (!ok) throw new Error("execCommand('copy') failed");
  }

  copyLinkBtn.addEventListener("click", async () => {
    const url = window.location.href;
    try {
      // navigator.clipboard only exists in a secure context (HTTPS or
      // localhost) — e.g. it's undefined on mobile when the page is loaded
      // over plain http:// via a LAN IP, so fall back to the older
      // execCommand technique in that case.
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        legacyCopyToClipboard(url);
      }
      copyLinkBtn.textContent = "Link copied!";
    } catch (err) {
      copyLinkBtn.textContent = "Couldn't copy — copy manually";
    }
    setTimeout(() => { copyLinkBtn.textContent = "Copy link to share"; }, 1500);
  });

  // ---------- init ----------

  function init() {
    buildGrid();
    attachEditHandlers();
    updateSaveEnabled();

    const savedName = localStorage.getItem(NAME_KEY);
    if (savedName) nameInput.value = savedName;
    updateSaveEnabled();

    loadData();
  }

  init();
})();
