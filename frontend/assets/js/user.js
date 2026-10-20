(() => {
  "use strict";

  const nameElement = document.querySelector(".reporter-user-name");
  const avatar = document.querySelector(".reporter-avatar");
  if (!nameElement || !avatar) return;

  fetch("../../backend/public/auth/me.php", {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  })
    .then(async (response) => {
      const result = await response.json();
      const role = String(result.role || "").toUpperCase();
      if (role === "ADMIN") {
        window.location.replace("admin.html");
        return;
      }
      if (["OFFICER", "OFFICERS", "SAFETY_OFFICER"].includes(role)) {
        window.location.replace("officer.html");
        return;
      }
      if (
        !response.ok ||
        !result.ok ||
        !["USER", "USERS", "REPORTER"].includes(role)
      ) {
        window.location.replace("login.html");
        return;
      }

      const titleCase = (value) =>
        value
          .toLocaleLowerCase()
          .replace(/(^|[\s'-])\p{L}/gu, (letter) => letter.toLocaleUpperCase());
      const firstName = titleCase(result.first_name || "");
      const lastName = titleCase(result.last_name || "");
      const fullName = [firstName, lastName].filter(Boolean).join(" ");
      if (fullName) nameElement.textContent = fullName;

      const initials = [firstName, lastName]
        .filter(Boolean)
        .map((name) => Array.from(name)[0])
        .join("");
      if (initials) avatar.textContent = initials;
    })
    .catch(() => window.location.replace("login.html"));

  const dashboardView = document.getElementById("dashboard-view");
  const newReportView = document.getElementById("new-report-view");
  const pageTitle = document.querySelector(".reporter-topbar h1");
  const navLinks = [...document.querySelectorAll(".reporter-nav-link")];
  const showReporterView = () => {
    const hash = window.location.hash || "#dashboard";
    const onNewReport = hash === "#new-report";
    if (dashboardView) dashboardView.hidden = onNewReport;
    if (newReportView) newReportView.hidden = !onNewReport;
    if (pageTitle) pageTitle.textContent = onNewReport ? "FILE NEW REPORT" : hash === "#guidelines" ? "SAFETY GUIDELINES" : hash === "#reports" ? "MY REPORTS" : "DASHBOARD";
    navLinks.forEach((link) => link.classList.toggle("is-active", link.hash === (onNewReport ? "#new-report" : hash === "#guidelines" || hash === "#reports" ? "#dashboard" : "#dashboard")));
    if (hash === "#guidelines") document.getElementById("guidelines")?.scrollIntoView({ block: "start" });
    if (hash === "#reports") document.getElementById("reports")?.scrollIntoView({ block: "start" });
  };
  window.addEventListener("hashchange", showReporterView);
  showReporterView();

  const reportForm = document.getElementById("incident-report-form");
  const sectorSelect = document.getElementById("report-plant-sector");
  const narrative = document.getElementById("report-narrative");
  const narrativeCount = document.getElementById("narrative-count");
  const fileInput = document.getElementById("report-evidence");
  const fileList = document.getElementById("evidence-file-list");
  const formMessage = document.getElementById("report-form-message");
  const reportsList = document.querySelector(".report-list");
  const reportsSearch = document.querySelector(".report-search input");
  let preserveResetMessage = false;
  narrative?.addEventListener("input", () => { narrativeCount.textContent = narrative.value.length; });
  fileInput?.addEventListener("change", () => {
    fileList.replaceChildren();
    [...fileInput.files].forEach((file) => {
      const item = document.createElement("li");
      item.textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB`;
      if (file.size > 50 * 1024 * 1024) item.textContent += " · Exceeds 50 MB limit";
      fileList.append(item);
    });
  });
  reportForm?.addEventListener("reset", () => {
    window.setTimeout(() => {
      narrativeCount.textContent = "0";
      fileList.replaceChildren();
      if (!preserveResetMessage) {
        formMessage.textContent = "";
        formMessage.classList.remove("is-error", "is-success");
      }
      preserveResetMessage = false;
    });
  });
  reportForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const oversized = [...(fileInput?.files || [])].some((file) => file.size > 50 * 1024 * 1024);
    if (oversized) {
      formMessage.textContent = "One or more files exceed the 50 MB limit. Remove them before continuing.";
      formMessage.classList.add("is-error");
      return;
    }
    const submitButton = reportForm.querySelector('[type="submit"]');
    submitButton.disabled = true;
    formMessage.classList.remove("is-error", "is-success");
    formMessage.textContent = "Submitting your report...";
    try {
      const response = await fetch("../../backend/public/auth/incidents.php", {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
        body: new FormData(reportForm),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message || "Unable to submit the incident report.");
      preserveResetMessage = true;
      reportForm.reset();
      formMessage.textContent = `${result.message} Reference: ${result.incident_code}.`;
      formMessage.classList.add("is-success");
      loadMyReports();
    } catch (error) {
      formMessage.textContent = error.message || "Unable to submit the incident report. Please try again.";
      formMessage.classList.add("is-error");
    } finally {
      submitButton.disabled = false;
    }
  });

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
  function renderMyReports(reports) {
    if (!reportsList) return;
    if (!reports.length) {
      reportsList.innerHTML = '<p class="report-list-empty">You have not submitted any reports yet.</p>';
      return;
    }
    reportsList.innerHTML = reports.map((report) => {
      const submitted = new Date(report.created_at).toLocaleString();
      const statusClass = report.status === "Resolved" ? "status-resolved" : report.status === "Pending" ? "status-pending" : "status-investigating";
      const filterStatus = report.status === "Resolved" ? "resolved" : report.status === "Pending" ? "pending" : "investigating";
      return `<article class="report-item" data-report-status="${filterStatus}">
        <div class="report-main">
          <div class="report-badges"><span class="ticket-id">#${escapeHtml(report.incident_code)}</span><span class="report-status ${statusClass}"><i></i>${escapeHtml(report.status)}</span></div>
          <h3>${escapeHtml(report.category)} <span class="category-tag">${escapeHtml(report.severity)}</span></h3>
          <p class="location">${escapeHtml(report.location)}</p>
        </div>
        <div class="report-detail"><time>Submitted ${escapeHtml(submitted)}</time><p>Reference<br /><strong>${escapeHtml(report.incident_code)}</strong></p></div>
      </article>`;
    }).join("");
  }
  async function loadMyReports() {
    if (!reportsList) return;
    try {
      const response = await fetch("../../backend/public/auth/incidents.php", {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message || "Unable to load your reports.");
      if (sectorSelect) {
        const selected = sectorSelect.value;
        sectorSelect.replaceChildren(new Option("Choose a plant sector", ""));
        (result.sectors || []).forEach((sector) => {
          sectorSelect.add(new Option(sector.sector_name, sector.id));
        });
        if ([...sectorSelect.options].some((option) => option.value === selected)) sectorSelect.value = selected;
        sectorSelect.disabled = (result.sectors || []).length === 0;
        if (!result.sectors?.length) sectorSelect.add(new Option("No active plant sectors available", ""));
      }
      renderMyReports(result.incidents || []);
      filterMyReports();
    } catch (error) {
      reportsList.innerHTML = `<p class="report-list-empty">${escapeHtml(error.message || "Unable to load your reports.")}</p>`;
    }
  }
  function filterMyReports() {
    const term = reportsSearch?.value.trim().toLocaleLowerCase() || "";
    const selectedFilter = document.querySelector(".report-filters .selected")?.dataset.reportFilter || "all";
    reportsList?.querySelectorAll(".report-item").forEach((item) => {
      item.hidden = !item.textContent.toLocaleLowerCase().includes(term) ||
        (selectedFilter !== "all" && item.dataset.reportStatus !== selectedFilter);
    });
  }
  reportsSearch?.addEventListener("input", filterMyReports);
  document.querySelectorAll(".report-filters [data-report-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".report-filters [data-report-filter]").forEach((item) => item.classList.toggle("selected", item === button));
      filterMyReports();
    });
  });
  loadMyReports();
})();
