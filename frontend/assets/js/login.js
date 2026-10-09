(() => {
  "use strict";

  const loginSection = document.querySelector("#login");
  const usernameInput = document.querySelector('input[name="username"]');
  const passwordInput = document.querySelector("#password");
  const passwordToggle = document.querySelector(".password-toggle");
  const loginForm = document.querySelector(".login-form");
  const loginMessage = document.querySelector(".login-message");
  const submitButton = loginForm?.querySelector('[type="submit"]');

  // Route all actions that require an account to the login form.
  document.querySelectorAll('a[href="#login"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      if (!loginSection) return;
      event.preventDefault();
      history.replaceState(null, "", "#login");
      loginSection.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(
        () => usernameInput?.focus({ preventScroll: true }),
        250,
      );
    });
  });

  // Toggle password visibility and keep the control accessible to screen readers.
  passwordToggle?.addEventListener("click", () => {
    if (!passwordInput) return;
    const showPassword = passwordInput.type === "password";
    passwordInput.type = showPassword ? "text" : "password";
    passwordToggle.setAttribute("aria-pressed", String(showPassword));
    passwordToggle.setAttribute(
      "aria-label",
      showPassword ? "Hide password" : "Show password",
    );
  });

  // Send credentials to the PHP login endpoint and keep the response in the page.
  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!loginMessage || !submitButton) return;

    loginMessage.hidden = false;
    loginMessage.className = "login-message";
    loginMessage.textContent = "Signing in…";
    submitButton.disabled = true;

    try {
      const response = await fetch(loginForm.action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          username: loginForm.elements.username.value.trim(),
          password: loginForm.elements.password.value,
          remember: loginForm.elements.remember.checked,
        }),
      });
      const result = await response.json();
      loginMessage.textContent = result.message || "Unable to sign in.";
      loginMessage.classList.add(result.ok ? "is-success" : "is-error");
      if (result.ok) loginForm.elements.password.value = "";
    } catch (error) {
      loginMessage.textContent = "Cannot reach the login service. Make sure Apache and PHP are running in XAMPP.";
      loginMessage.classList.add("is-error");
    } finally {
      submitButton.disabled = false;
    }
  });
})();
