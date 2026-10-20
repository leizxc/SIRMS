(() => {
  "use strict";

  const endpoint = "../../backend/public/auth/reporters.php";
  const form = document.getElementById("reporter-form");
  const rows = document.getElementById("reporter-rows");
  const search = document.getElementById("reporter-search");
  const count = document.getElementById("reporter-count");
  const message = document.querySelector(".reporter-form-message");
  const overview = document.getElementById("dashboard-overview");
  const incidentManagement = document.getElementById("incidents");
  const management = document.getElementById("reporters");
  const officerManagement = document.getElementById("officers");
  const pageTitle = document.querySelector(".page-heading h1");
  const pageDescription = document.querySelector(".page-heading p");
  const submit = form?.querySelector('[type="submit"]');
  const editDialog = document.getElementById("reporter-edit-dialog");
  const editForm = document.getElementById("reporter-edit-form");
  const editMessage = document.querySelector(".reporter-edit-message");
  const deleteDialog = document.getElementById("reporter-delete-dialog");
  const deleteCopy = document.getElementById("delete-reporter-copy");
  const confirmDelete = document.getElementById("confirm-reporter-delete");
  const statusDialog = document.getElementById("reporter-status-dialog");
  const statusTitle = document.getElementById("reporter-status-title");
  const statusCopy = document.getElementById("reporter-status-copy");
  const confirmStatus = document.getElementById("confirm-reporter-status");
  if (!form || !rows || !search || !count || !message || !submit) return;

  const reporterEmail = form.elements.email;
  const reporterUsername = form.elements.username;
  function validateReporterAccountField(input) {
    const error = form.querySelector(`[data-error-for="${input.name}"]`);
    const value = input.value.trim();
    let text = "";
    input.setCustomValidity("");
    if (value) {
      if (input.name === "email" && !input.validity.valid) {
        text = "Enter a valid email address, such as name@example.com.";
      } else if (input.name === "username" && value.length < 6) {
        text = "Username must be at least 6 characters.";
      } else if (input.name === "username" && !/^[a-zA-Z0-9._-]+$/.test(value)) {
        text = "Use only letters, numbers, dots, underscores, or hyphens.";
      }
    }
    input.setCustomValidity(text);
    input.classList.toggle("is-invalid", Boolean(text));
    input.setAttribute("aria-invalid", String(Boolean(text)));
    if (error) error.textContent = text;
    return !text;
  }
  [reporterEmail, reporterUsername].forEach((input) => {
    input.addEventListener("input", () => validateReporterAccountField(input));
    input.addEventListener("blur", () => validateReporterAccountField(input));
  });
  form.addEventListener("reset", () => window.setTimeout(() => {
    [reporterEmail, reporterUsername].forEach((input) => {
      input.setCustomValidity("");
      input.classList.remove("is-invalid");
      input.removeAttribute("aria-invalid");
      const error = form.querySelector(`[data-error-for="${input.name}"]`);
      if (error) error.textContent = "";
    });
  }, 0));

  form.querySelectorAll(".password-toggle").forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const input = document.getElementById(toggle.dataset.target);
      if (!input) return;
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      const icon = toggle.querySelector("img");
      if (icon) icon.src = show ? "../assets/icons/eye-close-up.png" : "../assets/icons/closed-eyes.png";
      toggle.setAttribute("aria-pressed", String(show));
      toggle.setAttribute("aria-label", show ? "Hide password" : "Show password");
    });
  });

  form.addEventListener("reset", () => {
    window.setTimeout(() => {
      form.querySelectorAll(".password-toggle").forEach((toggle) => {
        toggle.setAttribute("aria-pressed", "false");
        toggle.setAttribute("aria-label", "Show password");
        const icon = toggle.querySelector("img");
        if (icon) icon.src = "../assets/icons/closed-eyes.png";
      });
    }, 0);
  });

  function syncPageView() {
    const onIncidents = window.location.hash === "#incidents";
    const onReporters = window.location.hash === "#reporters";
    const onOfficers = window.location.hash === "#officers";
    const onSectors = window.location.hash === "#sectors";
    overview.hidden = onIncidents || onReporters || onOfficers || onSectors;
    incidentManagement.hidden = !onIncidents;
    management.hidden = !onReporters;
    officerManagement.hidden = !onOfficers;
    document.getElementById("sectors").hidden = !onSectors;
    pageTitle.textContent = onIncidents ? "Incident Management" : onReporters ? "Reporter Account Management" : onOfficers ? "Officer Account Management" : onSectors ? "Plant Sector Management" : "Admin Dashboard";
    pageDescription.textContent = onReporters
      ? "Create reporter accounts and manage registered reporters."
      : onOfficers ? "Create officer accounts and manage roles, specialties, and access."
      : onIncidents ? "Review reported incidents and monitor response status."
      : onSectors ? "Manage plant locations, operating risks, and assigned safety leads." : "Overview of incidents and safety operations.";
    document.querySelectorAll(".side-nav .nav-item").forEach((link) => {
      link.classList.toggle("selected", onIncidents ? link.hash === "#incidents" : onReporters ? link.hash === "#reporters" : onOfficers ? link.hash === "#officers" : onSectors ? link.hash === "#sectors" : link.hash === "#dashboard");
    });
  }
  window.addEventListener("hashchange", syncPageView);
  syncPageView();

  incidentManagement.addEventListener("click", (event) => {
    const assignButton = event.target.closest("[data-assign-officer]");
    if (!assignButton) return;
    const row = assignButton.closest("tr");
    const officerSelect = row?.querySelector(".incident-assignee");
    if (!officerSelect?.value) {
      officerSelect?.focus();
      return;
    }
    assignButton.textContent = "Assigned";
    assignButton.disabled = true;
    officerSelect.disabled = true;
    row.dataset.assignedOfficer = officerSelect.value;
  });

  let reporters = [];
  let reporterPendingDelete = null;
  let reporterPendingStatus = null;
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);

  function render() {
    const term = search.value.trim().toLocaleLowerCase();
    const visible = reporters.filter((reporter) => Number(reporter.is_active) === 1).filter((reporter) => [reporter.id, `#${reporter.id}`, reporter.first_name, reporter.last_name, reporter.username, reporter.email]
      .some((value) => String(value ?? "").toLocaleLowerCase().includes(term)));
    const active = reporters.filter((reporter) => Number(reporter.is_active) === 1).length;
    document.querySelector('[data-stat="total"]').textContent = reporters.length;
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    document.querySelector('[data-stat="new"]').textContent = reporters.filter(
      (reporter) => String(reporter.created_at || "").slice(0, 7) === thisMonth,
    ).length;
    document.querySelector('[data-stat="inactive"]').textContent = reporters.length - active;
    rows.innerHTML = visible.length ? visible.map((reporter) => {
      const isActive = Number(reporter.is_active) === 1;
      return `<tr><td data-label="Account ID">#${escapeHtml(reporter.id)}</td><td data-label="Reporter Name"><strong>${escapeHtml(`${reporter.first_name} ${reporter.last_name}`.trim())}</strong></td><td data-label="Username">${escapeHtml(String(reporter.username || "").toLocaleLowerCase())}</td><td data-label="Work Email">${escapeHtml(String(reporter.email || "").toLocaleLowerCase())}</td><td data-label="Actions"><div class="reporter-actions"><button class="reporter-action" type="button" data-action="edit" data-id="${escapeHtml(reporter.id)}">Edit</button><button class="reporter-action ${isActive ? "block" : "unblock"}" type="button" data-action="status" data-id="${escapeHtml(reporter.id)}" data-active="${isActive ? "0" : "1"}">${isActive ? "Block" : "Unblock"}</button><button class="reporter-action delete" type="button" data-action="delete" data-id="${escapeHtml(reporter.id)}">Delete</button></div></td></tr>`;
    }).join("") : '<tr><td colspan="5">No active reporter accounts found. Check Blocked Accounts to review blocked records.</td></tr>';
    count.textContent = `Showing ${visible.length} of ${reporters.length} reporter accounts`;
  }

  async function loadReporters() {
    rows.innerHTML = '<tr><td colspan="5">Loading reporter accounts…</td></tr>';
    try {
      const response = await fetch(endpoint, { credentials: "same-origin", headers: { Accept: "application/json" } });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message || "Unable to load reporter accounts.");
      reporters = result.reporters || [];
      render();
    } catch (error) {
      rows.innerHTML = `<tr><td colspan="5">${escapeHtml(error.message || "Unable to load reporter accounts.")}</td></tr>`;
      count.textContent = "";
    }
  }

  search.addEventListener("input", render);
  document.querySelectorAll('[data-account-view^="reporter-"]').forEach((button) => {
    button.addEventListener("click", () => {
      const blockedOnly = button.dataset.accountView === "reporter-blocked";
      const accounts = blockedOnly
        ? reporters.filter((reporter) => Number(reporter.is_active) !== 1)
        : reporters;
      window.showAccountHistory({
        title: blockedOnly ? "Blocked Reporter Accounts" : "Reporter Account History",
        columns: ["Account ID", "Name", "Username", "Email", "Registered", "Status"],
        rows: accounts.map((reporter) => [
          `#${reporter.id}`,
          `${reporter.first_name} ${reporter.last_name}`.trim(),
          String(reporter.username || "").toLocaleLowerCase(),
          String(reporter.email || "").toLocaleLowerCase(),
          reporter.created_at || "—",
          Number(reporter.is_active) === 1 ? "Active" : "Blocked",
        ]),
        actionLabel: blockedOnly ? "Unblock" : "",
        actionIds: accounts.map((reporter) => reporter.id),
        onAction: blockedOnly ? async (id) => {
          const response = await fetch(endpoint, {
            method: "PATCH",
            credentials: "same-origin",
            headers: { Accept: "application/json", "Content-Type": "application/json" },
            body: JSON.stringify({ action: "status", id, is_active: 1 }),
          });
          const result = await response.json();
          if (!response.ok || !result.ok) throw new Error(result.message || "Unable to unblock reporter account.");
          await loadReporters();
          window.showAdminToast(result.message, "success");
        } : null,
        emptyText: blockedOnly ? "There are no blocked reporter accounts." : "No reporter account history is available.",
      });
    });
  });
  rows.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const reporter = reporters.find((item) => String(item.id) === button.dataset.id);
    if (!reporter) return;
    if (button.dataset.action === "delete") {
      const name = `${reporter.first_name} ${reporter.last_name}`.trim();
      reporterPendingDelete = reporter;
      deleteCopy.textContent = `Delete the reporter account for ${name}? This action cannot be undone.`;
      confirmDelete.disabled = false;
      deleteDialog.showModal();
      return;
    }
    if (button.dataset.action === "edit") {
      editForm.elements.id.value = reporter.id;
      editForm.elements.first_name.value = reporter.first_name || "";
      editForm.elements.last_name.value = reporter.last_name || "";
      editForm.elements.email.value = (reporter.email || "").toLocaleLowerCase();
      editForm.elements.username.value = (reporter.username || "").toLocaleLowerCase();
      editMessage.hidden = true;
      editDialog.showModal();
      return;
    }
    const active = Number(button.dataset.active);
    const name = `${reporter.first_name} ${reporter.last_name}`.trim();
    reporterPendingStatus = { reporter, active };
    const unblock = active === 1;
    statusTitle.textContent = unblock ? "Unblock Reporter Account?" : "Block Reporter Account?";
    statusCopy.textContent = unblock
      ? `Restore sign-in access for ${name}?`
      : `Block ${name} from signing in? They will lose access until unblocked.`;
    confirmStatus.textContent = unblock ? "Unblock Account" : "Block Account";
    confirmStatus.classList.toggle("is-unblock", unblock);
    confirmStatus.disabled = false;
    statusDialog.showModal();
  });

  editForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const save = editForm.querySelector('[type="submit"]');
    save.disabled = true;
    editMessage.hidden = true;
    try {
      const values = Object.fromEntries(new FormData(editForm).entries());
      values.action = "update";
      const response = await fetch(endpoint, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message || "Unable to update reporter account.");
      editDialog.close();
      await loadReporters();
      message.hidden = false;
      message.className = "reporter-form-message is-success";
      message.textContent = result.message;
    } catch (error) {
      editMessage.textContent = error.message || "Unable to update reporter account.";
      editMessage.hidden = false;
    } finally {
      save.disabled = false;
    }
  });
  editForm.querySelector("[data-close-edit]").addEventListener("click", () => editDialog.close());
  confirmDelete.addEventListener("click", async () => {
    if (!reporterPendingDelete) return;
    confirmDelete.disabled = true;
    const reporterId = reporterPendingDelete.id;
    try {
      const response = await fetch(endpoint, {
        method: "DELETE",
        credentials: "same-origin",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ id: reporterId }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message || "Unable to delete reporter account.");
      deleteDialog.close();
      reporterPendingDelete = null;
      await loadReporters();
      message.hidden = false;
      message.className = "reporter-form-message is-success";
      message.textContent = result.message;
    } catch (error) {
      deleteDialog.close();
      reporterPendingDelete = null;
      window.showAdminToast(error.message || "Unable to delete reporter account.", "error");
    } finally {
      confirmDelete.disabled = false;
    }
  });
  confirmStatus.addEventListener("click", async () => {
    if (!reporterPendingStatus) return;
    confirmStatus.disabled = true;
    const { reporter, active } = reporterPendingStatus;
    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status", id: reporter.id, is_active: active }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message || "Unable to update account status.");
      statusDialog.close();
      reporterPendingStatus = null;
      await loadReporters();
      message.hidden = false;
      message.className = "reporter-form-message is-success";
      message.textContent = result.message;
    } catch (error) {
      statusDialog.close();
      reporterPendingStatus = null;
      window.showAdminToast(error.message || "Unable to update account status.", "error");
    } finally {
      confirmStatus.disabled = false;
    }
  });
  form.addEventListener("reset", () => {
    message.hidden = true;
    message.textContent = "";
    message.className = "reporter-form-message";
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.hidden = false;
    message.className = "reporter-form-message";
    message.textContent = "Creating reporter account…";
    submit.disabled = true;
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        body: new FormData(form),
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const result = await response.json();
      message.textContent = result.message || "Unable to create reporter account.";
      message.classList.add(result.ok ? "is-success" : "is-error");
      if (result.ok) {
        form.reset();
        await loadReporters();
      }
    } catch {
      message.textContent = "Cannot reach the reporter account service. Check that Apache and PHP are running.";
      message.classList.add("is-error");
    } finally {
      submit.disabled = false;
    }
  });

  loadReporters();
})();
