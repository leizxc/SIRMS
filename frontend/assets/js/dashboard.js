(() => {
  "use strict";

  const recentRows = document.getElementById("dashboard-recent-incident-rows");
  if (!recentRows) return;

  const base = "../../backend/public/auth/";
  const endpoints = {
    incidents: `${base}incidents.php`,
    officers: `${base}officers.php`,
    reporters: `${base}reporters.php`,
    sectors: `${base}plant_sectors.php`,
  };
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
  const statusClass = (status) => ({
    Pending: "gray-pill",
    "Under Review": "blue-pill",
    "In Progress": "blue-pill",
    Resolved: "green-pill",
  }[status] || "gray-pill");

  async function load(endpoint, key) {
    const response = await fetch(endpoint, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.message || `Unable to load ${key}.`);
    return Array.isArray(result[key]) ? result[key] : [];
  }

  function setCount(id, records, activeOnly = false) {
    const target = document.getElementById(id);
    if (!target) return;
    target.textContent = activeOnly
      ? records.filter((record) => Number(record.is_active) === 1).length
      : records.length;
  }

  function renderSeverity(incidents) {
    const counts = new Map(["Low", "Moderate", "High", "Critical"].map((severity) => [severity, 0]));
    incidents.forEach((incident) => {
      const severity = String(incident.severity || "").trim().toLowerCase();
      const key = [...counts.keys()].find((item) => item.toLowerCase() === severity);
      if (key) counts.set(key, counts.get(key) + 1);
    });
    const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
    document.getElementById("dashboard-severity-total").textContent = total;
    const colors = { Low: "#3b82f6", Moderate: "#0d9488", High: "#f59e0b", Critical: "#e5484d" };
    let angle = 0;
    const segments = [...counts].map(([severity, count]) => {
      const start = angle;
      angle += total ? (count / total) * 360 : 0;
      return `${colors[severity]} ${start}deg ${angle}deg`;
    });
    const donut = document.getElementById("dashboard-severity-donut");
    donut.style.background = total
      ? `conic-gradient(${segments.join(", ")})`
      : "conic-gradient(#e9eff6 0deg 360deg)";
    donut.setAttribute("aria-label", `${total} incident reports by severity`);
    document.querySelectorAll("#dashboard-severity-summary [data-severity]").forEach((row) => {
      const count = counts.get(row.dataset.severity) || 0;
      row.querySelector("strong").textContent = count;
    });
  }

  function renderStatusSummary(incidents) {
    const statuses = ["Pending", "Under Review", "In Progress", "Resolved"];
    const counts = new Map(statuses.map((status) => [status, 0]));
    incidents.forEach((incident) => {
      const status = String(incident.status || "").trim().toLowerCase();
      const key = statuses.find((item) => item.toLowerCase() === status);
      if (key) counts.set(key, counts.get(key) + 1);
    });
    const total = incidents.length;
    document.querySelectorAll("#dashboard-status-summary [data-status]").forEach((row) => {
      const count = counts.get(row.dataset.status) || 0;
      row.querySelector("strong").textContent = count;
      row.querySelector(".incident-status-track > i").style.width = `${total ? (count / total) * 100 : 0}%`;
    });
  }

  function renderRecentIncidents(incidents) {
    if (!incidents.length) {
      recentRows.innerHTML = '<tr><td colspan="6">No incident reports have been submitted yet.</td></tr>';
      return;
    }
    recentRows.innerHTML = incidents.slice(0, 5).map((incident) => {
      const reporter = [incident.first_name, incident.last_name].filter(Boolean).join(" ");
      return `<tr>
        <td><a href="#incidents">#${escapeHtml(incident.incident_code)}</a></td>
        <td>${escapeHtml(incident.category)}</td>
        <td class="muted-cell">${escapeHtml(incident.location)}</td>
        <td class="muted-cell">${escapeHtml(reporter)}</td>
        <td><span class="status-pill ${statusClass(incident.status)}">${escapeHtml(incident.status)}</span></td>
        <td><a class="view-button" href="#incidents">View</a></td>
      </tr>`;
    }).join("");
  }

  async function initializeDashboard() {
    const results = await Promise.allSettled([
      load(endpoints.incidents, "incidents"),
      load(endpoints.officers, "officers"),
      load(endpoints.reporters, "reporters"),
      load(endpoints.sectors, "sectors"),
    ]);
    const [incidentsResult, officersResult, reportersResult, sectorsResult] = results;

    if (incidentsResult.status === "fulfilled") {
      const incidents = incidentsResult.value;
      setCount("dashboard-stat-incidents", incidents);
      renderSeverity(incidents);
      renderStatusSummary(incidents);
      renderRecentIncidents(incidents);
    } else {
      recentRows.innerHTML = '<tr><td colspan="6">Unable to load recent incident reports.</td></tr>';
      window.showAdminToast?.(incidentsResult.reason?.message || "Unable to load dashboard incidents.", "error");
    }
    if (officersResult.status === "fulfilled") setCount("dashboard-stat-officers", officersResult.value, true);
    if (reportersResult.status === "fulfilled") setCount("dashboard-stat-reporters", reportersResult.value, true);
    if (sectorsResult.status === "fulfilled") setCount("dashboard-stat-sectors", sectorsResult.value, true);
  }

  initializeDashboard();
})();
