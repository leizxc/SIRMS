(() => {
  "use strict";
  const form = document.querySelector(".register-form");
  const message = document.querySelector(".register-message");
  const submit = form?.querySelector('[type="submit"]');
  if (!form || !message || !submit) return;

  const email = form.querySelector('#email');
  const username = form.querySelector('#username');
  const validateField = (input) => {
    if (!input) return true;
    const error = document.getElementById(`${input.id}-error`);
    const wrap = input.closest('.input-wrap');
    let text = '';
    input.setCustomValidity('');
    if (input.value.trim()) {
      if (input.id === 'email' && !input.validity.valid) {
        text = 'Enter a valid email address (for example, name@example.com).';
      } else if (input.id === 'username' && input.value.trim().replace(/^@+/, '').length < 6) {
        text = 'Username must be at least 6 characters.';
      }
    }
    input.setCustomValidity(text);
    if (error) error.textContent = text;
    wrap?.classList.toggle('is-invalid', Boolean(text));
    input.setAttribute('aria-invalid', String(Boolean(text)));
    return !text;
  };

  [email, username].forEach((input) => {
    input?.addEventListener('input', () => validateField(input));
    input?.addEventListener('blur', () => validateField(input));
  });

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

  form.addEventListener("submit", async (event) => {
    const fieldsValid = [email, username].every(validateField);
    if (!fieldsValid || !form.checkValidity()) {
      event.preventDefault();
      form.reportValidity();
      return;
    }
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
