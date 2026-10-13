(() => {
  "use strict";

  const form = document.getElementById("sector-form");
  const rows = document.getElementById("sector-rows");
  if (!form || !rows) return;
  const search = document.getElementById("sector-search");
  const riskFilter = document.getElementById("sector-risk-filter");
  const statusFilter = document.getElementById("sector-status-filter");
  const message = document.getElementById("sector-message");
  const codeInput = document.getElementById("sector-code");
  let editingRow = null;

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);

  function nextCode() {
    const codes = Array.from(rows.rows, (row) => Number(row.cells[0].textContent.match(/\d+/)?.[0] || 0));
    return `SEC-PLANT-${String(Math.max(0, ...codes) + 1).padStart(2, "0")}`;
  }
  function refreshCode() {
    if (!editingRow) codeInput.value = nextCode();
  }
  function filterRows() {
    const term = search.value.trim().toLocaleLowerCase();
    Array.from(rows.rows).forEach((row) => {
      const matchesText = row.textContent.toLocaleLowerCase().includes(term);
      const matchesRisk = !riskFilter.value || row.dataset.risk === riskFilter.value;
      const matchesStatus = !statusFilter.value || row.dataset.status === statusFilter.value;
      row.dataset.filteredOut = matchesText && matchesRisk && matchesStatus ? "0" : "1";
    });
    rows.dispatchEvent(new Event("admin-table-filter"));
  }
  search.addEventListener("input", filterRows);
  riskFilter.addEventListener("change", filterRows);
  statusFilter.addEventListener("change", filterRows);

  form.addEventListener("reset", () => {
    window.setTimeout(() => {
      editingRow = null;
      refreshCode();
      message.hidden = true;
      message.textContent = "";
      form.querySelector('[type="submit"]').textContent = "Confirm & Register Plant Sector";
    }, 0);
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const values = new FormData(form);
    const name = String(values.get("name")).trim();
    const address = String(values.get("address")).trim();
    const code = String(values.get("code")).trim();
    const lead = String(values.get("lead"));
    const risk = String(values.get("risk")).slice(0, 6);
    const codeLabel = code.replace("SEC-PLANT-", "SEC-");
    const cells = `<td>#${escapeHtml(codeLabel)}</td><td><strong>${escapeHtml(name)}</strong><small>${escapeHtml(lead)}</small></td><td>${escapeHtml(address)}</td><td>0 Staff · 0 Officers</td><td><span class="sector-status safe">ACTIVE · SAFE</span></td><td><button class="reporter-action" data-sector-action="edit" type="button">Edit Info</button> <button class="reporter-action" data-sector-action="view" type="button">View</button></td>`;
    if (editingRow) {
      editingRow.innerHTML = cells;
      editingRow.dataset.risk = risk;
      editingRow.dataset.status = "ACTIVE";
      editingRow = null;
      message.textContent = "Plant sector information updated in this page.";
    } else {
      const row = rows.insertRow(0);
      row.dataset.risk = risk;
      row.dataset.status = "ACTIVE";
      row.innerHTML = cells;
      message.textContent = "Plant sector added to this page.";
    }
    message.hidden = false;
    form.reset();
    refreshCode();
    filterRows();
    document.getElementById("sector-total").textContent = rows.rows.length;
  });

  rows.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-sector-action]");
    if (!button) return;
    const row = button.closest("tr");
    if (button.dataset.sectorAction === "edit") {
      editingRow = row;
      form.elements.name.value = row.cells[1].querySelector("strong")?.textContent || "";
      form.elements.address.value = row.cells[2].textContent.trim();
      codeInput.value = row.cells[0].textContent.replace(/^#SEC-/, "SEC-PLANT-");
      form.elements.risk.value = `${row.dataset.risk} - ${row.dataset.risk === "Tier 1" ? "High Risk (Chemical / Toxic Storage)" : row.dataset.risk === "Tier 2" ? "Moderate Risk" : "Low Risk"}`;
      form.querySelector('[type="submit"]').textContent = "Save Plant Sector Changes";
      document.getElementById("sectors").scrollIntoView({ behavior: "smooth" });
      return;
    }
    window.alert(`${row.cells[1].querySelector("strong")?.textContent || "Plant sector"}\n${row.cells[2].textContent}\nRisk: ${row.dataset.risk}\nStatus: ${row.dataset.status}`);
  });
  refreshCode();
})();
