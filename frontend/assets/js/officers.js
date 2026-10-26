(() => {
  "use strict";

  const endpoint = "../../backend/public/auth/officers.php";
  const form = document.getElementById("officer-form");
  const rows = document.getElementById("officer-rows");
  if (!form || !rows) return;

  const search = document.getElementById("officer-search");
  const count = document.getElementById("officer-count");
  const message = document.getElementById("officer-form-message");
  const submit = form.querySelector('[type="submit"]');
  const editDialog = document.getElementById("officer-edit-dialog");
  const editForm = document.getElementById("officer-edit-form");
  const editMessage = document.getElementById("officer-edit-message");
  const actionDialog = document.getElementById("officer-action-dialog");
  const actionTitle = document.getElementById("officer-action-title");
  const actionCopy = document.getElementById("officer-action-copy");
  const confirmAction = document.getElementById("confirm-officer-action");
  const catalog = { roles: [], specialties: [], sectors: [] };
  let officers = [];
  let pendingAction = null;

  const escapeHtml = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );
  const fullName = (officer) =>
    `${officer.first_name || ""} ${officer.last_name || ""}`.trim();

  const officerEmail = form.elements.email;
  const officerUsername = form.elements.username;
  function validateAccountField(input) {
    const error = form.querySelector(`[data-error-for="${input.name}"]`);
    const value = input.value.trim();
    let text = "";
    input.setCustomValidity("");
    if (value) {
      if (input.name === "email" && !input.validity.valid) {
        text = "Enter a valid email address, such as name@example.com.";
      } else if (input.name === "username" && value.length < 6) {
        text = "Username must be at least 6 characters.";
      } else if (
        input.name === "username" &&
        !/^[a-zA-Z0-9._-]+$/.test(value)
      ) {
        text = "Use only letters, numbers, dots, underscores, or hyphens.";
      }
    }
    input.setCustomValidity(text);
    input.classList.toggle("is-invalid", Boolean(text));
    input.setAttribute("aria-invalid", String(Boolean(text)));
    if (error) error.textContent = text;
    return !text;
  }
  [officerEmail, officerUsername].forEach((input) => {
    input.addEventListener("input", () => validateAccountField(input));
    input.addEventListener("blur", () => validateAccountField(input));
  });
  form.addEventListener("reset", () =>
    window.setTimeout(() => {
      [officerEmail, officerUsername].forEach((input) => {
        input.setCustomValidity("");
        input.classList.remove("is-invalid");
        input.removeAttribute("aria-invalid");
        const error = form.querySelector(`[data-error-for="${input.name}"]`);
        if (error) error.textContent = "";
      });
    }, 0),
  );

  function fillSelect(select, options, firstLabel) {
    select.replaceChildren();
    const first = document.createElement("option");
    first.value = "";
    first.textContent = firstLabel;
    select.append(first);
    options.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = item.role_name || item.sector_name;
      select.append(option);
    });
  }

  function renderSpecialties(container, selected = []) {
    const ids = new Set(selected.map(Number));
    container.innerHTML = catalog.specialties.length
      ? catalog.specialties
          .map(
            (item) =>
              `<label class="officer-specialty-option"><input type="checkbox" name="specialty_ids[]" value="${Number(item.id)}"${ids.has(Number(item.id)) ? " checked" : ""}><span>${escapeHtml(item.specialty_name)}</span></label>`,
          )
          .join("")
      : "<span>No active specialties configured.</span>";
  }

  function render() {
    const term = search.value.trim().toLocaleLowerCase();
    const visible = officers
      .filter((officer) => Number(officer.is_active) === 1)
      .filter((officer) =>
        [
          officer.id,
          `#${officer.id}`,
          fullName(officer),
          officer.username,
          officer.email,
          officer.role_name,
          officer.sector_name,
          ...(officer.specialties || []).map((skill) => skill.specialty_name),
        ].some((value) =>
          String(value ?? "")
            .toLocaleLowerCase()
            .includes(term),
        ),
      );

    document.querySelector('[data-officer-stat="total"]').textContent =
      officers.length;
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    document.querySelector('[data-officer-stat="new"]').textContent =
      officers.filter(
        (item) => String(item.created_at || "").slice(0, 7) === thisMonth,
      ).length;
    document.querySelector('[data-officer-stat="inactive"]').textContent =
      officers.filter((item) => Number(item.is_active) !== 1).length;
    rows.innerHTML = visible.length
      ? visible
          .map((officer) => {
            const active = Number(officer.is_active) === 1;
            const skills =
              (officer.specialties || [])
                .map((skill) => escapeHtml(skill.specialty_name))
                .join(", ") || "—";
            return `<tr><td data-label="Account ID">#${Number(officer.id)}</td><td data-label="Name"><strong>${escapeHtml(fullName(officer))}</strong></td><td data-label="Username">${escapeHtml(String(officer.username || "").toLocaleLowerCase())}</td><td data-label="Role">${escapeHtml(officer.role_name)}</td><td data-label="Sector">${escapeHtml(officer.sector_name || "—")}</td><td data-label="Specialties">${skills}</td><td data-label="Email">${escapeHtml(String(officer.email || "").toLocaleLowerCase())}</td><td data-label="Actions"><div class="reporter-actions"><button class="reporter-action" type="button" data-action="edit" data-id="${Number(officer.id)}">Edit</button><button class="reporter-action ${active ? "block" : "unblock"}" type="button" data-action="status" data-active="${active ? "0" : "1"}" data-id="${Number(officer.id)}">${active ? "Block" : "Unblock"}</button><button class="reporter-action delete" type="button" data-action="delete" data-id="${Number(officer.id)}">Delete</button></div></td></tr>`;
          })
          .join("")
      : '<tr><td colspan="8">No active officer accounts found. Check Blocked Accounts to review blocked records.</td></tr>';
    count.textContent = `Showing ${visible.length} of ${officers.length} officer accounts`;
  }

  async function loadOfficers() {
    rows.innerHTML = '<tr><td colspan="8">Loading officer accounts…</td></tr>';
    try {
      const response = await fetch(endpoint, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const result = await response.json();
      if (!response.ok || !result.ok)
        throw new Error(result.message || "Unable to load officer accounts.");
      officers = result.officers || [];
      catalog.roles = result.roles || [];
      catalog.specialties = result.specialties || [];
      catalog.sectors = result.sectors || [];
      fillSelect(
        document.getElementById("officer-role"),
        catalog.roles,
        "Choose officer role",
      );
      fillSelect(
        document.getElementById("officer-edit-role"),
        catalog.roles,
        "Choose officer role",
      );
      fillSelect(
        document.getElementById("officer-sector"),
        catalog.sectors,
        "No sector assigned",
      );
      fillSelect(
        document.getElementById("officer-edit-sector"),
        catalog.sectors,
        "No sector assigned",
      );
      renderSpecialties(document.getElementById("officer-specialty-options"));
      renderSpecialties(
        document.getElementById("officer-edit-specialty-options"),
      );
      render();
    } catch (error) {
      rows.innerHTML = `<tr><td colspan="8">${escapeHtml(error.message || "Unable to load officer accounts.")}</td></tr>`;
      count.textContent = "";
    }
  }

  function formPayload(targetForm) {
    const values = Object.fromEntries(new FormData(targetForm).entries());
    values.specialty_ids = [
      ...targetForm.querySelectorAll('input[name="specialty_ids[]"]:checked'),
    ].map((input) => input.value);
    return values;
  }

  async function sendJson(method, data) {
    const response = await fetch(endpoint, {
      method,
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok || !result.ok)
      throw new Error(result.message || "Unable to process officer account.");
    return result;
  }

  search.addEventListener("input", render);
  document
    .querySelectorAll('[data-account-view^="officer-"]')
    .forEach((button) => {
      button.addEventListener("click", () => {
        const blockedOnly = button.dataset.accountView === "officer-blocked";
        const accounts = blockedOnly
          ? officers.filter((officer) => Number(officer.is_active) !== 1)
          : officers;
        window.showAccountHistory({
          title: blockedOnly
            ? "Blocked Officer Accounts"
            : "Officer Account History",
          columns: [
            "Account ID",
            "Name",
            "Username",
            "Role",
            "Sector",
            "Email",
            "Registered",
            "Status",
          ],
          rows: accounts.map((officer) => [
            `#${officer.id}`,
            fullName(officer),
            String(officer.username || "").toLocaleLowerCase(),
            officer.role_name,
            officer.sector_name || "No sector assigned",
            String(officer.email || "").toLocaleLowerCase(),
            officer.created_at || "—",
            Number(officer.is_active) === 1 ? "Active" : "Blocked",
          ]),
          actionLabel: blockedOnly ? "Unblock" : "",
          actionIds: accounts.map((officer) => officer.id),
          onAction: blockedOnly
            ? async (id) => {
                const result = await sendJson("PATCH", {
                  action: "status",
                  id,
                  is_active: 1,
                });
                await loadOfficers();
                window.showAdminToast(result.message, "success");
              }
            : null,
          emptyText: blockedOnly
            ? "There are no blocked officer accounts."
            : "No officer account history is available.",
        });
      });
    });
  rows.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const officer = officers.find(
      (item) => String(item.id) === button.dataset.id,
    );
    if (!officer) return;
    if (button.dataset.action === "edit") {
      const fields = editForm.elements;
      fields.id.value = officer.id;
      fields.first_name.value = officer.first_name || "";
      fields.last_name.value = officer.last_name || "";
      fields.email.value = (officer.email || "").toLocaleLowerCase();
      fields.username.value = (officer.username || "").toLocaleLowerCase();
      fields.contact_number.value = officer.contact_number || "";
      fields.officer_role_id.value = officer.officer_role_id;
      fields.plant_sector_id.value = officer.plant_sector_id || "";
      renderSpecialties(
        document.getElementById("officer-edit-specialty-options"),
        (officer.specialties || []).map((skill) => skill.specialty_id),
      );
      editMessage.hidden = true;
      editDialog.showModal();
      return;
    }
    const active = Number(button.dataset.active);
    pendingAction =
      button.dataset.action === "delete"
        ? { type: "delete", officer }
        : { type: "status", officer, active };
    const name = fullName(officer);
    const deleting = pendingAction.type === "delete";
    actionTitle.textContent = deleting
      ? "Delete Officer Account?"
      : active
        ? "Unblock Officer Account?"
        : "Block Officer Account?";
    actionCopy.textContent = deleting
      ? `Delete the officer account for ${name}? Linked records may prevent deletion.`
      : active
        ? `Restore sign-in access for ${name}?`
        : `Block ${name} from signing in?`;
    confirmAction.textContent = deleting
      ? "Delete Account"
      : active
        ? "Unblock Account"
        : "Block Account";
    confirmAction.classList.toggle("is-unblock", !deleting && active === 1);
    confirmAction.disabled = false;
    actionDialog.showModal();
  });

  form.addEventListener("reset", () => {
    message.hidden = true;
    message.textContent = "";
    message.className = "reporter-form-message officer-form-message";
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = form.elements.password.value;
    if (password !== form.elements.confirm_password.value) {
      message.hidden = false;
      message.className = "reporter-form-message officer-form-message is-error";
      message.textContent = "Passwords do not match.";
      return;
    }
    message.hidden = false;
    message.className = "reporter-form-message officer-form-message";
    message.textContent = "Creating officer account…";
    submit.disabled = true;
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        body: new FormData(form),
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const result = await response.json();
      if (!response.ok || !result.ok)
        throw new Error(result.message || "Unable to create officer account.");
      form.reset();
      message.hidden = false;
      message.className =
        "reporter-form-message officer-form-message is-success";
      message.textContent = result.message;
      await loadOfficers();
    } catch (error) {
      message.classList.add("is-error");
      message.textContent =
        error.message || "Cannot reach the officer account service.";
    } finally {
      submit.disabled = false;
    }
  });

  editForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const save = editForm.querySelector('[type="submit"]');
    save.disabled = true;
    editMessage.hidden = true;
    try {
      const result = await sendJson("PATCH", {
        ...formPayload(editForm),
        action: "update",
      });
      editDialog.close();
      await loadOfficers();
      message.hidden = false;
      message.className =
        "reporter-form-message officer-form-message is-success";
      message.textContent = result.message;
    } catch (error) {
      editMessage.textContent =
        error.message || "Unable to update officer account.";
      editMessage.hidden = false;
    } finally {
      save.disabled = false;
    }
  });
  editForm
    .querySelector("[data-close-officer-edit]")
    .addEventListener("click", () => editDialog.close());

  confirmAction.addEventListener("click", async () => {
    if (!pendingAction) return;
    confirmAction.disabled = true;
    try {
      const { type, officer, active } = pendingAction;
      const result =
        type === "delete"
          ? await sendJson("DELETE", { id: officer.id })
          : await sendJson("PATCH", {
              action: "status",
              id: officer.id,
              is_active: active,
            });
      actionDialog.close();
      pendingAction = null;
      await loadOfficers();
      message.hidden = false;
      message.className =
        "reporter-form-message officer-form-message is-success";
      message.textContent = result.message;
    } catch (error) {
      actionDialog.close();
      pendingAction = null;
      window.showAdminToast(
        error.message || "Unable to process officer account.",
        "error",
      );
    } finally {
      confirmAction.disabled = false;
    }
  });

  loadOfficers();
})();
