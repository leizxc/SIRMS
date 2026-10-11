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
})();
