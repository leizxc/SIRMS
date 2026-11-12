(() => {
  "use strict";

  const nameElement = document.querySelector(".reporter-user-name");
  const avatar = document.querySelector(".reporter-avatar");
  const reportList = document.getElementById("officer-report-list");
  const endpoint = "../../backend/public/auth/incidents.php";
  if (!nameElement || !avatar || !reportList) return;

  reportList.replaceChildren(Object.assign(document.createElement("p"), { className: "officer-empty-state", textContent: "Loading reports assigned to you…" }));
  const escapeText = (element, value) => { element.textContent = value || ""; return element; };
  const formatDate = (value) => {
    if (!value) return "Date unavailable";
    const parsed = new Date(String(value).replace(" ", "T"));
    return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString();
  };
  const statusClass = (status) => status === "Resolved" ? "status-resolved" : status === "Pending" ? "status-pending" : "status-investigating";
  const setStat = (id, value) => {
    const target = document.getElementById(id);
    if (target) target.textContent = String(value);
  };

  async function loadIncidents() {
    reportList.replaceChildren(Object.assign(document.createElement("p"), { className: "officer-empty-state", textContent: "Loading your assigned reports…" }));
    try {
      const response = await fetch(endpoint, { credentials: "same-origin", headers: { Accept: "application/json" } });
      const result = await response.json();
      if (response.status === 401) { window.location.replace("login.html"); return; }
      if (!response.ok || !result.ok) throw new Error(result.message || "Unable to load assigned reports.");
      const incidents = result.incidents || [];
      const active = incidents.filter((incident) => incident.status !== "Resolved");
      setStat("officer-stat-assigned", active.length);
      setStat("officer-stat-critical", active.filter((incident) => incident.severity === "Critical").length);
      setStat("officer-stat-progress", incidents.filter((incident) => ["Under Review", "In Progress"].includes(incident.status)).length);
      setStat("officer-stat-resolved", incidents.filter((incident) => incident.status === "Resolved").length);
      setStat("officer-queue-count", `${active.length} Active`);
      if (!incidents.length) {
        reportList.replaceChildren(Object.assign(document.createElement("p"), { className: "officer-empty-state", textContent: "No reports have been assigned to you yet." }));
        return;
      }
      reportList.replaceChildren(...incidents.map(renderIncident));
    } catch (error) {
      reportList.replaceChildren(Object.assign(document.createElement("p"), { className: "officer-empty-state is-error", textContent: error.message || "Unable to load assigned reports." }));
    }
  }

  function renderIncident(incident) {
    const item = document.createElement("article");
    item.className = "report-item";
    const main = document.createElement("div");
    main.className = "report-main";
    const badges = document.createElement("div");
    badges.className = "report-badges";
    const code = document.createElement("span");
    code.className = "ticket-id";
    escapeText(code, `#${incident.incident_code || incident.id}`);
    const status = document.createElement("span");
    status.className = `report-status ${statusClass(incident.status)}`;
    const dot = document.createElement("i");
    status.append(dot, document.createTextNode(String(incident.status || "Pending").toUpperCase()));
    badges.append(code, status);
    const title = document.createElement("h3");
    escapeText(title, incident.category || "Incident report");
    const location = document.createElement("p");
    location.className = "location";
    escapeText(location, incident.location || "Location unavailable");
    main.append(badges, title, location);

    const detail = document.createElement("div");
    detail.className = "report-detail";
    const time = document.createElement("time");
    escapeText(time, `Reported ${formatDate(incident.created_at)}`);
    const reporter = document.createElement("p");
    reporter.append(document.createTextNode("Reporter"), document.createElement("br"));
    const reporterName = document.createElement("strong");
    escapeText(reporterName, [incident.first_name, incident.last_name].filter(Boolean).join(" ") || "Unknown");
    reporter.append(reporterName);
    detail.append(time, reporter);

    const button = document.createElement("button");
    button.className = `timeline-button${incident.status === "Resolved" ? " resolved-action" : ""}`;
    button.type = "button";
    button.textContent = "Review report ›";
    button.addEventListener("click", () => openIncident(incident));
    item.append(main, detail, button);
    return item;
  }

  let detailDialog;
  function openIncident(incident) {
    if (!detailDialog) {
      detailDialog = document.createElement("dialog");
      detailDialog.className = "officer-incident-dialog";
      detailDialog.innerHTML = '<div class="officer-dialog-content"><button class="officer-dialog-close" type="button" aria-label="Close">×</button><p class="eyebrow">ASSIGNED INCIDENT</p><h2></h2><dl></dl><div class="officer-evidence"></div><label for="officer-incident-status">Update status<select id="officer-incident-status"><option>Under Review</option><option>In Progress</option><option>Resolved</option></select></label><p class="officer-dialog-message" aria-live="polite"></p><button class="officer-status-save" type="button">Save status</button></div>';
      detailDialog.querySelector(".officer-dialog-close").addEventListener("click", () => detailDialog.close());
      detailDialog.addEventListener("click", (event) => { if (event.target === detailDialog) detailDialog.close(); });
      detailDialog.querySelector(".officer-status-save").addEventListener("click", saveStatus);
      document.body.append(detailDialog);
    }
    detailDialog.dataset.incidentId = String(incident.id);
    escapeText(detailDialog.querySelector("h2"), incident.incident_code || "Incident report");
    const fields = [
      ["Category", incident.category], ["Location", incident.location], ["Severity", incident.severity],
      ["Status", incident.status], ["Reported", formatDate(incident.occurred_at)],
      ["Reporter", [incident.first_name, incident.last_name].filter(Boolean).join(" ")],
      ["Description", incident.description], ["Witnesses", incident.witnesses || "None listed"],
    ];
    const list = detailDialog.querySelector("dl");
    list.replaceChildren(...fields.flatMap(([label, value]) => {
      const term = document.createElement("dt"); escapeText(term, label);
      const description = document.createElement("dd"); escapeText(description, value || "—");
      return [term, description];
    }));
    detailDialog.querySelector("#officer-incident-status").value = incident.status === "Resolved" ? "Resolved" : ["Under Review", "In Progress"].includes(incident.status) ? incident.status : "Under Review";
    const evidence = detailDialog.querySelector(".officer-evidence");
    evidence.replaceChildren();
    for (const file of incident.evidence || []) {
      const link = document.createElement("a");
      link.href = `${endpoint}?evidence=${encodeURIComponent(file.id)}`;
      link.textContent = file.name || "Download evidence";
      link.className = "officer-evidence-link";
      link.target = "_blank";
      link.rel = "noopener";
      evidence.append(link);
    }
    detailDialog.querySelector(".officer-dialog-message").textContent = "";
    detailDialog.showModal();
  }

  async function saveStatus(event) {
    const button = event.currentTarget;
    const message = detailDialog.querySelector(".officer-dialog-message");
    button.disabled = true;
    message.textContent = "Saving…";
    try {
      const response = await fetch(endpoint, {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ action: "update_status", incident_id: detailDialog.dataset.incidentId, status: detailDialog.querySelector("#officer-incident-status").value }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message || "Unable to update the report.");
      message.textContent = result.message || "Status updated.";
      await loadIncidents();
      window.setTimeout(() => detailDialog?.close(), 600);
    } catch (error) {
      message.textContent = error.message || "Unable to update the report.";
    } finally {
      button.disabled = false;
    }
  }

  async function start() {
    try {
      const response = await fetch("../../backend/public/auth/me.php", { credentials: "same-origin", headers: { Accept: "application/json" } });
      const result = await response.json();
      const role = String(result.role || "").toUpperCase();
      if (role === "ADMIN") { window.location.replace("admin.html"); return; }
      if (["USER", "USERS", "REPORTER"].includes(role)) { window.location.replace("user.html"); return; }
      if (!response.ok || !result.ok || !["OFFICER", "OFFICERS", "SAFETY_OFFICER"].includes(role)) { window.location.replace("login.html"); return; }
      const titleCase = (value) => value.toLocaleLowerCase().replace(/(^|[\s'-])\p{L}/gu, (letter) => letter.toLocaleUpperCase());
      const firstName = titleCase(result.first_name || "");
      const lastName = titleCase(result.last_name || "");
      const fullName = [firstName, lastName].filter(Boolean).join(" ");
      if (fullName) nameElement.textContent = fullName;
      const initials = [firstName, lastName].filter(Boolean).map((name) => Array.from(name)[0]).join("");
      if (initials) avatar.textContent = initials;
      await loadIncidents();
    } catch {
      window.location.replace("login.html");
    }
  }

  start();
})();
