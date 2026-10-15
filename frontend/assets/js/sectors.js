(() => {
  "use strict";

  const endpoint = "../../backend/public/auth/plant_sectors.php";
  const form = document.getElementById("sector-form");
  const rows = document.getElementById("sector-rows");
  if (!form || !rows) return;
  const search = document.getElementById("sector-search");
  const riskFilter = document.getElementById("sector-risk-filter");
  const statusFilter = document.getElementById("sector-status-filter");
  const message = document.getElementById("sector-message");
  const codeInput = document.getElementById("sector-code");
  const submit = form.querySelector('[type="submit"]');
  const deleteDialog = document.getElementById("sector-delete-dialog");
  const deleteCopy = document.getElementById("sector-delete-copy");
  const deleteMessage = document.getElementById("sector-delete-message");
  const confirmDelete = document.getElementById("confirm-sector-delete");
  const statusDialog = document.getElementById("sector-status-dialog");
  const statusTitle = document.getElementById("sector-status-title");
  const statusCopy = document.getElementById("sector-status-copy");
  const statusMessage = document.getElementById("sector-status-message");
  const confirmStatus = document.getElementById("confirm-sector-status");
  let sectors = [];
  let editingId = null;
  let pendingDelete = null;
  let pendingStatus = null;

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
  const sectorCode = (id) => `SEC-${String(id).padStart(2, "0")}`;

  function render() {
    const term = search.value.trim().toLocaleLowerCase();
    const risk = riskFilter.value;
    const status = statusFilter.value;
    const active = sectors.filter((sector) => Number(sector.is_active) === 1).length;
    document.getElementById("sector-total").textContent = sectors.length;
    document.getElementById("sector-active").textContent = active;
    document.getElementById("sector-inactive").textContent = sectors.length - active;
    document.getElementById("sector-high-risk").textContent = sectors.filter((sector) => String(sector.risk_tier).toUpperCase() === "TIER 1").length;
    const visible = sectors.filter((sector) => {
      const matchesText = [sector.sector_name, sector.address, sector.facility_lead, sector.description, sectorCode(sector.id)]
        .some((value) => String(value ?? "").toLocaleLowerCase().includes(term));
      return matchesText && (!risk || String(sector.risk_tier).toUpperCase() === risk) &&
        (!status || (status === "ACTIVE" ? Number(sector.is_active) === 1 : Number(sector.is_active) === 0));
    });
    rows.innerHTML = visible.length ? visible.map((sector) => {
      const isActive = Number(sector.is_active) === 1;
      const riskTier = String(sector.risk_tier || "TIER 2").toUpperCase();
      const riskClass = riskTier === "TIER 1" ? "caution" : "safe";
      return `<tr data-id="${escapeHtml(sector.id)}"><td>${escapeHtml(sectorCode(sector.id))}</td><td><strong>${escapeHtml(sector.sector_name)}</strong>${sector.description ? `<small>${escapeHtml(sector.description)}</small>` : ""}</td><td>${escapeHtml(sector.address)}</td><td>${escapeHtml(sector.facility_lead || "—")}</td><td><span class="sector-status ${isActive ? riskClass : "inactive"}">${isActive ? `${escapeHtml(riskTier)} · ${riskClass === "caution" ? "HIGH RISK" : "ACTIVE"}` : "INACTIVE"}</span></td><td><div class="sector-actions"><button class="reporter-action" data-sector-action="edit" type="button">Edit Info</button><button class="reporter-action ${isActive ? "block" : "unblock"}" data-sector-action="status" data-active="${isActive ? "0" : "1"}" type="button">${isActive ? "Deactivate" : "Activate"}</button><button class="reporter-action delete" data-sector-action="delete" type="button">Delete</button></div></td></tr>`;
    }).join("") : '<tr><td colspan="6">No plant sectors found.</td></tr>';
    rows.dispatchEvent(new Event("admin-table-filter"));
  }

  async function loadSectors() {
    rows.innerHTML = '<tr><td colspan="6">Loading plant sectors…</td></tr>';
    try {
      const response = await fetch(endpoint, { credentials: "same-origin", headers: { Accept: "application/json" } });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message || "Unable to load plant sectors.");
      sectors = result.sectors || [];
      render();
    } catch (error) {
      rows.innerHTML = `<tr><td colspan="6">${escapeHtml(error.message || "Unable to load plant sectors.")}</td></tr>`;
    }
  }

  [search, riskFilter, statusFilter].forEach((control) => control.addEventListener(control === search ? "input" : "change", render));
  form.addEventListener("reset", () => {
    window.setTimeout(() => {
      editingId = null;
      codeInput.value = "Assigned after saving";
      submit.textContent = "Confirm & Register Plant Sector";
      message.hidden = true;
      message.textContent = "";
    }, 0);
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submit.disabled = true;
    message.hidden = true;
    const values = Object.fromEntries(new FormData(form).entries());
    const isUpdate = editingId !== null;
    if (isUpdate) values.id = editingId;
    try {
      const response = await fetch(endpoint, {
        method: isUpdate ? "PATCH" : "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, action: isUpdate ? "update" : undefined }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message || "Unable to save plant sector.");
      editingId = null;
      form.reset();
      await loadSectors();
      message.classList.remove("is-error");
      message.hidden = false;
      message.textContent = result.message;
    } catch (error) {
      message.hidden = false;
      message.classList.add("is-error");
      message.textContent = error.message || "Unable to save plant sector.";
    } finally {
      submit.disabled = false;
    }
  });

  rows.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-sector-action]");
    if (!button) return;
    const row = button.closest("tr");
    const sector = sectors.find((item) => String(item.id) === row?.dataset.id);
    if (!sector) return;
    if (button.dataset.sectorAction === "delete") {
      pendingDelete = sector;
      deleteCopy.textContent = `Delete ${sector.sector_name}? This action cannot be undone.`;
      deleteMessage.hidden = true;
      confirmDelete.disabled = false;
      deleteDialog.showModal();
      return;
    }
    if (button.dataset.sectorAction === "edit") {
      editingId = sector.id;
      form.elements.sector_name.value = sector.sector_name || "";
      form.elements.address.value = sector.address || "";
      form.elements.facility_lead.value = sector.facility_lead || "";
      form.elements.risk_tier.value = sector.risk_tier || "Tier 2";
      form.elements.description.value = sector.description || "";
      codeInput.value = sectorCode(sector.id);
      submit.textContent = "Save Plant Sector Changes";
      document.getElementById("sectors").scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const active = Number(button.dataset.active);
    pendingStatus = { sector, active };
    const activate = active === 1;
    statusTitle.textContent = activate ? "Activate Plant Sector?" : "Deactivate Plant Sector?";
    statusCopy.textContent = activate
      ? `Make ${sector.sector_name} available for active operations?`
      : `${sector.sector_name} will no longer be available for active operations.`;
    confirmStatus.textContent = activate ? "Activate Sector" : "Deactivate Sector";
    confirmStatus.classList.toggle("is-unblock", activate);
    confirmStatus.disabled = false;
    statusMessage.hidden = true;
    statusDialog.showModal();
  });

  statusDialog.addEventListener("close", () => { pendingStatus = null; });
  confirmStatus.addEventListener("click", async () => {
    if (!pendingStatus) return;
    confirmStatus.disabled = true;
    const { sector, active } = pendingStatus;
    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status", id: sector.id, is_active: active }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message || "Unable to update plant sector.");
      statusDialog.close();
      await loadSectors();
      message.classList.remove("is-error");
      message.hidden = false;
      message.textContent = result.message;
    } catch (error) {
      statusMessage.textContent = error.message || "Unable to update plant sector.";
      statusMessage.hidden = false;
    } finally {
      confirmStatus.disabled = false;
    }
  });

  deleteDialog.addEventListener("close", () => { pendingDelete = null; });
  confirmDelete.addEventListener("click", async () => {
    if (!pendingDelete) return;
    confirmDelete.disabled = true;
    try {
      const response = await fetch(endpoint, {
        method: "DELETE",
        credentials: "same-origin",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ id: pendingDelete.id }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message || "Unable to delete plant sector.");
      deleteDialog.close();
      await loadSectors();
      message.classList.remove("is-error");
      message.hidden = false;
      message.textContent = result.message;
    } catch (error) {
      deleteMessage.textContent = error.message || "Unable to delete plant sector.";
      deleteMessage.hidden = false;
    } finally {
      confirmDelete.disabled = false;
    }
  });

  loadSectors();
})();
