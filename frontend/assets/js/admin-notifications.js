(() => {
  "use strict";

  const region = document.createElement("div");
  region.className = "admin-toast-region";
  region.setAttribute("aria-live", "polite");
  region.setAttribute("aria-atomic", "false");
  document.body.append(region);

  const seen = new WeakMap();
  window.showAdminToast = (text, type = "success") => {
    const content = String(text || "").trim();
    if (!content) return;
    const toast = document.createElement("div");
    toast.className = `admin-toast${type === "error" ? " is-error" : type === "update" ? " is-update" : type === "warning" ? " is-warning" : ""}`;
    toast.setAttribute("role", type === "error" ? "alert" : "status");
    const icon = document.createElement("img");
    icon.className = "admin-toast-icon";
    icon.src = type === "error"
      ? "../assets/icons/exclamation.png"
      : type === "update"
        ? "../assets/icons/letter-i.png"
        : "../assets/icons/info.png";
    icon.alt = "";
    icon.setAttribute("aria-hidden", "true");
    toast.append(icon);
    const label = document.createElement("span");
    label.textContent = content;
    toast.append(label);
    region.append(toast);
    window.setTimeout(() => toast.remove(), 4200);
  };

  window.showAccountHistory = ({ title, columns, rows, emptyText, actionLabel, actionIds = [], onAction }) => {
    let dialog = document.getElementById("account-history-dialog");
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.id = "account-history-dialog";
      dialog.className = "reporter-edit-dialog account-history-dialog";
      dialog.innerHTML = '<div class="account-history-panel"><h2></h2><div class="account-history-table-wrap"><table class="reporter-table"><thead><tr></tr></thead><tbody></tbody></table></div><p class="account-history-empty" hidden></p><div class="reporter-edit-actions"><button class="reporter-reset" type="button" data-close-history>Close</button></div></div>';
      dialog.querySelector("[data-close-history]").addEventListener("click", () => dialog.close());
      dialog.addEventListener("click", async (event) => {
        const action = event.target.closest("[data-history-action]");
        if (!action || !dialog.accountAction) return;
        action.disabled = true;
        try {
          await dialog.accountAction(action.dataset.id);
          dialog.close();
        } catch (error) {
          window.showAdminToast(error.message || "Unable to update account.", "error");
        } finally {
          action.disabled = false;
        }
      });
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) dialog.close();
      });
      document.body.append(dialog);
    }
    dialog.querySelector("h2").textContent = title;
    const header = dialog.querySelector("thead tr");
    header.replaceChildren(...columns.map((column) => {
      const cell = document.createElement("th");
      cell.textContent = column;
      return cell;
    }));
    if (actionLabel) {
      const cell = document.createElement("th");
      cell.textContent = "Actions";
      header.append(cell);
    }
    const body = dialog.querySelector("tbody");
    body.replaceChildren(...rows.map((values, index) => {
      const row = document.createElement("tr");
      values.forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = String(value ?? "—");
        row.append(cell);
      });
      if (actionLabel) {
        const cell = document.createElement("td");
        const button = document.createElement("button");
        button.className = "reporter-action unblock";
        button.type = "button";
        button.dataset.historyAction = "unblock";
        button.dataset.id = String(actionIds[index] ?? "");
        button.textContent = actionLabel;
        cell.append(button);
        row.append(cell);
      }
      return row;
    }));
    dialog.accountAction = onAction || null;
    const empty = dialog.querySelector(".account-history-empty");
    empty.textContent = emptyText;
    empty.hidden = rows.length > 0;
    dialog.querySelector(".account-history-table-wrap").hidden = rows.length === 0;
    if (!dialog.open) dialog.showModal();
  };

  function showMessageToast(message) {
    if (!message || message.hidden) return;
    const text = message.textContent.trim();
    if (!text || /^(creating|saving|loading)\b/i.test(text)) return;
    const type = message.classList.contains("is-error") ||
      message.classList.contains("sector-delete-message") ||
      message.id.includes("edit-message")
      ? "error"
      : /\bupdated\b/i.test(text)
        ? "update"
        : "success";
    const key = `${type}:${text}`;
    const previous = seen.get(message);
    const now = Date.now();
    if (previous?.key === key && now - previous.at < 1000) return;
    seen.set(message, { key, at: now });
    window.showAdminToast(text, type);
  }

  function syncBusy(button) {
    if (!button) return;
    const loading = button.disabled && (
      button.type === "submit" ||
      button.matches("#confirm-sector-delete, #confirm-sector-status, #confirm-officer-action, #confirm-reporter-delete, #confirm-reporter-status")
    );
    button.classList.toggle("is-loading", loading);
    if (loading) button.setAttribute("aria-busy", "true");
    else button.removeAttribute("aria-busy");
  }

  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.method === "dialog") return;
    syncBusy(form.querySelector('button[type="submit"], input[type="submit"]'));
  }, true);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "attributes" && mutation.target instanceof HTMLButtonElement) {
        syncBusy(mutation.target);
      }
      const target = mutation.target.nodeType === Node.ELEMENT_NODE
        ? mutation.target
        : mutation.target.parentElement;
      const selector = ".reporter-form-message, .reporter-edit-message, .sector-delete-message, #sector-message";
      const message = target?.matches?.(selector) ? target : target?.closest?.(selector);
      if (message) showMessageToast(message);
      if (mutation.type === "childList") {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          if (node.matches(selector)) showMessageToast(node);
          node.querySelectorAll(selector).forEach(showMessageToast);
        });
      }
    }
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["class", "hidden", "disabled"] });
})();
