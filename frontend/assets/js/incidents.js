(() => {
  "use strict";

  const rows = document.getElementById("admin-incident-rows");
  if (!rows) return;
  const search = document.querySelector('#incidents .table-tools input[type="search"]');
  const dateMonth = document.getElementById("incident-date-month");
  const dateDay = document.getElementById("incident-date-day");
  const clearDates = document.getElementById("clear-incident-dates");
  const filterButtons = [...document.querySelectorAll('#incidents .filters button')];

  const endpoint = "../../backend/public/auth/incidents.php";
  const officerEndpoint = "../../backend/public/auth/officers.php";
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
  const statusClass = (status) => ({
    Pending: "gray-pill",
    "Under Review": "blue-pill",
    "In Progress": "blue-pill",
    Resolved: "green-pill",
  }[status] || "gray-pill");

  let incidentRecords = [];
  let officers = [];
  let activeIncident = null;

  async function loadOfficers() {
    try {
      const response = await fetch(officerEndpoint, { credentials: "same-origin", headers: { Accept: "application/json" } });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message || "Unable to load officers.");
      officers = (result.officers || []).filter((officer) => Number(officer.is_active) === 1);
    } catch (error) {
      window.showAdminToast?.(error.message || "Unable to load officers.", "error");
    }
  }
  function updateStats(incidents) {
    const open = incidents.filter((incident) => incident.status !== "Resolved").length;
    const resolved = incidents.filter((incident) => incident.status === "Resolved").length;
    const critical = incidents.filter((incident) => incident.severity === "Critical").length;
    document.getElementById("management-stat-open").textContent = open;
    document.getElementById("management-stat-resolved").textContent = resolved;
    document.getElementById("management-stat-critical").textContent = critical;
    const criticalLabel = document.getElementById("management-stat-critical-label");
    criticalLabel.textContent = critical ? "Needs attention" : "None reported";
    criticalLabel.classList.toggle("gray-pill", critical === 0);
    criticalLabel.classList.toggle("red-pill", critical > 0);
    document.getElementById("management-stat-dispatched").textContent = incidents.length;
  }

  function filterRows() {
    const term = search?.value.trim().toLocaleLowerCase() || "";
    const selected = document.querySelector('#incidents .filters .chosen')?.textContent.trim().toLocaleLowerCase() || "all";
    const month = dateMonth?.value || "";
    const day = dateDay?.value || "";
    const incidentRows = [...rows.querySelectorAll("tr[data-incident-id]")];
    let visibleCount = 0;
    incidentRows.forEach((row) => {
      const matchesSearch = row.textContent.toLocaleLowerCase().includes(term);
      const matchesFilter = selected === "all" ||
        (selected === "critical" && row.dataset.severity === "critical") ||
        (selected === "pending" && row.dataset.status === "pending") ||
        (selected === "resolved" && row.dataset.status === "resolved");
      const reportDate = row.dataset.createdAt;
      const matchesDate = (!month || reportDate.startsWith(month)) && (!day || reportDate.slice(8, 10) === day);
      row.hidden = !matchesSearch || !matchesFilter || !matchesDate;
      if (!row.hidden) visibleCount += 1;
    });
    const emptyRow = rows.querySelector("[data-filter-empty]");
    if (emptyRow) emptyRow.style.display = visibleCount === 0 ? "" : "none";
  }

  function render(incidents) {
    incidentRecords = incidents;
    updateStats(incidents);
    if (!incidents.length) {
      rows.innerHTML = '<tr><td colspan="6">No incident reports have been submitted yet.</td></tr>';
      return;
    }
    rows.innerHTML = incidents.map((incident) => {
      const reporter = [incident.first_name, incident.last_name].filter(Boolean).join(" ");
      return `<tr data-incident-id="${Number(incident.id)}" data-created-at="${escapeHtml(String(incident.created_at || "").slice(0, 10))}" data-status="${escapeHtml(String(incident.status).toLocaleLowerCase())}" data-severity="${escapeHtml(String(incident.severity).toLocaleLowerCase())}">
        <td><a href="#incident-${Number(incident.id)}">#${escapeHtml(incident.incident_code)}</a></td>
        <td>${escapeHtml(incident.category)}</td>
        <td class="muted-cell">${escapeHtml(incident.location)}</td>
        <td class="muted-cell">${escapeHtml(reporter)}</td>
        <td><span class="status-pill ${statusClass(incident.status)}">${escapeHtml(incident.status)}</span></td>
        <td><button class="view-button" type="button" data-view-incident="${Number(incident.id)}">View</button></td>
      </tr>`;
    }).join("");
    rows.insertAdjacentHTML("beforeend", '<tr data-filter-empty><td colspan="6">No reports match the selected filters.</td></tr>');
    filterRows();
  }

  async function loadIncidents() {
    rows.innerHTML = '<tr><td colspan="6">Loading incident reports...</td></tr>';
    try {
      const response = await fetch(endpoint, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message || "Unable to load incident reports.");
      render(result.incidents || []);
    } catch (error) {
      rows.innerHTML = `<tr><td colspan="6">${escapeHtml(error.message || "Unable to load incident reports.")}</td></tr>`;
    }
  }

  let detailDialog;
  function showDetails(incident) {
    if (!detailDialog) {
      detailDialog = document.createElement("dialog");
      detailDialog.className = "reporter-edit-dialog incident-detail-dialog";
      detailDialog.innerHTML = '<div class="reporter-edit-form"><h2>Incident Report</h2><dl></dl><label class="incident-assignment-field" for="incident-officer-select">Assign officer<select id="incident-officer-select"><option value="">Choose an officer</option></select></label><div class="reporter-edit-actions"><button class="reporter-reset" type="button" data-close-incident>Close</button><button class="reporter-save" type="button" data-save-assignment>Assign officer</button></div></div>';
      detailDialog.querySelector("[data-close-incident]").addEventListener("click", () => detailDialog.close());
      detailDialog.querySelector("[data-save-assignment]").addEventListener("click", saveAssignment);
      detailDialog.addEventListener("click", (event) => {
        if (event.target === detailDialog) detailDialog.close();
      });
      document.body.append(detailDialog);
    }
    const fields = [
      ["Incident ID", incident.incident_code],
      ["Category", incident.category],
      ["Plant Sector", incident.location],
      ["Occurred at", incident.occurred_at],
      ["Severity", incident.severity],
      ["Status", incident.status],
      ["Assigned officer", incident.assigned_officer || "Not assigned"],
      ["Reported by", [incident.first_name, incident.last_name].filter(Boolean).join(" ")],
      ["Description", incident.description],
      ["Witnesses", incident.witnesses || "None listed"],
    ];
    const list = detailDialog.querySelector("dl");
    list.replaceChildren(...fields.flatMap(([label, value]) => {
      const term = document.createElement("dt");
      term.textContent = label;
      const description = document.createElement("dd");
      description.textContent = value || "—";
      return [term, description];
    }));
    activeIncident = incident;
    const officerSelect = detailDialog.querySelector("#incident-officer-select");
    officerSelect.replaceChildren(new Option("Choose an officer", ""));
    officers.forEach((officer) => officerSelect.add(new Option(`${officer.first_name} ${officer.last_name}`.trim(), String(officer.id))));
    officerSelect.value = incident.officer_user_id ? String(incident.officer_user_id) : "";
    for (const file of incident.evidence || []) {
      const term = document.createElement("dt");
      term.textContent = "Evidence";
      const description = document.createElement("dd");
      const source = `${endpoint}?evidence=${encodeURIComponent(file.id)}&inline=1`;
      if (file.mime_type === "image/jpeg" || file.mime_type === "image/png") {
        const image = document.createElement("img");
        image.className = "incident-evidence-image";
        image.src = source;
        image.alt = file.name;
        description.append(image);
      } else if (file.mime_type === "video/mp4") {
        const video = document.createElement("video");
        video.className = "incident-evidence-player";
        video.src = source;
        video.controls = true;
        video.preload = "metadata";
        description.append(video);
      } else if (file.mime_type === "audio/mpeg") {
        const audio = document.createElement("audio");
        audio.className = "incident-evidence-player";
        audio.src = source;
        audio.controls = true;
        audio.preload = "metadata";
        description.append(audio);
      }
      const link = document.createElement("a");
      link.href = `${endpoint}?evidence=${encodeURIComponent(file.id)}`;
      link.textContent = file.name;
      link.className = "incident-evidence-download";
      link.download = file.name;
      description.append(link);
      list.append(term, description);
    }
    detailDialog.showModal();
  }

  async function saveAssignment(event) {
    const button = event.currentTarget;
    const officerId = detailDialog.querySelector("#incident-officer-select").value;
    if (!activeIncident || !officerId) {
      window.showAdminToast?.("Choose an officer to assign.", "error");
      return;
    }
    button.disabled = true;
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ action: "assign", incident_id: activeIncident.id, officer_id: officerId }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message || "Unable to assign officer.");
      window.showAdminToast?.(result.message || "Officer assigned.", "success");
      detailDialog.close();
      await loadIncidents();
    } catch (error) {
      window.showAdminToast?.(error.message || "Unable to assign officer.", "error");
    } finally {
      button.disabled = false;
    }
  }

  rows.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-view-incident]");
    if (!button) return;
    button.disabled = true;
    try {
      const response = await fetch(endpoint, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message || "Unable to open incident report.");
      const incident = incidentRecords.find((item) => Number(item.id) === Number(button.dataset.viewIncident)) ||
        (result.incidents || []).find((item) => Number(item.id) === Number(button.dataset.viewIncident));
      if (incident) showDetails(incident);
    } catch (error) {
      window.showAdminToast?.(error.message || "Unable to open incident report.", "error");
    } finally {
      button.disabled = false;
    }
  });

  search?.addEventListener("input", filterRows);
  dateMonth?.addEventListener("input", () => {
    const previousDay = dateDay?.value || "";
    if (dateDay) {
      dateDay.replaceChildren(new Option("All days", ""));
      if (dateMonth.value) {
        const [year, month] = dateMonth.value.split("-").map(Number);
        const daysInMonth = new Date(year, month, 0).getDate();
        for (let day = 1; day <= daysInMonth; day += 1) {
          const value = String(day).padStart(2, "0");
          dateDay.add(new Option(String(day), value));
        }
        dateDay.disabled = false;
        if (previousDay && Number(previousDay) <= daysInMonth) dateDay.value = previousDay;
      } else {
        dateDay.disabled = true;
      }
    }
    filterRows();
  });
  dateDay?.addEventListener("change", filterRows);
  clearDates?.addEventListener("click", () => {
    if (dateMonth) dateMonth.value = "";
    if (dateDay) {
      dateDay.replaceChildren(new Option("All days", ""));
      dateDay.disabled = true;
    }
    filterRows();
  });
  filterButtons.forEach((button) => button.addEventListener("click", () => {
    filterButtons.forEach((filter) => filter.classList.toggle("chosen", filter === button));
    filterRows();
  }));

  loadOfficers().then(loadIncidents);
  window.addEventListener("hashchange", () => {
    if (window.location.hash === "#incidents") loadIncidents();
  });
  window.setInterval(() => {
    if (window.location.hash === "#incidents") loadIncidents();
  }, 30000);
})();
