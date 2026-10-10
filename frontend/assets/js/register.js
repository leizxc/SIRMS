(() => {
  "use strict";
  const form = document.querySelector(".register-form");
  const message = document.querySelector(".register-message");
  const submit = form?.querySelector('[type="submit"]');
  if (!form || !message || !submit) return;

  form.querySelectorAll(".password-toggle").forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const input = document.getElementById(toggle.dataset.target);
      if (!input) return;
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      toggle.setAttribute("aria-pressed", String(show));
      toggle.setAttribute("aria-label", show ? "Hide password" : "Show password");
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.hidden = false;
    message.className = "register-message";
    message.textContent = "Creating your account…";
    submit.disabled = true;
    try {
      const response = await fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const result = await response.json();
      message.textContent = result.message || "Unable to register.";
      message.classList.add(result.ok ? "is-success" : "is-error");
      if (result.ok) {
        form.reset();
        window.setTimeout(() => { window.location.href = "login.html"; }, 1200);
      }
    } catch {
      message.textContent = "Cannot reach the registration service. Make sure Apache and PHP are running in XAMPP.";
      message.classList.add("is-error");
    } finally {
      submit.disabled = false;
    }
  });
})();
