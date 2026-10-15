(() => {
  "use strict";

  const links = [...document.querySelectorAll("nav.links > a[href^='#']")];
  const sections = ["home", "how", "features", "compliance", "contact"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  function setActive(id) {
    links.forEach((link) => {
      const active = link.hash === `#${id}`;
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
    document.querySelector('[aria-controls="how-menu-panel"]')?.classList.toggle("active", id === "how");
    document.querySelector('[aria-controls="features-menu-panel"]')?.classList.toggle("active", id === "features");
    document.querySelector('[aria-controls="compliances-menu-panel"]')?.classList.toggle("active", id === "compliance");
    document.querySelector('[aria-controls="contact-menu-panel"]')?.classList.toggle("active", id === "contact");
  }

  let scheduled = false;
  function updateFromScroll() {
    scheduled = false;
    if (!sections.length) return;

    const headerHeight = document.querySelector("header.nav")?.offsetHeight ?? 0;
    const marker = window.scrollY + headerHeight + 24;
    let current = sections[0];
    for (const section of sections) {
      if (section.getBoundingClientRect().top + window.scrollY <= marker) current = section;
      else break;
    }
    setActive(current.id);
  }

  function scheduleUpdate() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(updateFromScroll);
  }

  window.addEventListener("scroll", scheduleUpdate, { passive: true });
  window.addEventListener("resize", scheduleUpdate);
  window.addEventListener("hashchange", scheduleUpdate);
  scheduleUpdate();

  const navMenus = [...document.querySelectorAll(".nav-menu")];
  let closeTimer;

  function setMenuOpen(menu, open) {
    const trigger = menu.querySelector(".menu-trigger");
    const panel = menu.querySelector(".mega-menu");
    if (!trigger || !panel) return;
    trigger.setAttribute("aria-expanded", String(open));
    panel.hidden = !open;
  }

  function closeMenus(except = null) {
    navMenus.forEach((menu) => {
      if (menu !== except) setMenuOpen(menu, false);
    });
  }

  navMenus.forEach((menu) => {
    const trigger = menu.querySelector(".menu-trigger");
    let timer;

    menu.addEventListener("mouseenter", () => {
      window.clearTimeout(timer);
      window.clearTimeout(closeTimer);
      closeMenus(menu);
      setMenuOpen(menu, true);
    });

    menu.addEventListener("mouseleave", () => {
      timer = window.setTimeout(() => setMenuOpen(menu, false), 180);
    });

    trigger?.addEventListener("click", () => {
      const open = trigger.getAttribute("aria-expanded") === "true";
      closeMenus(menu);
      setMenuOpen(menu, !open);
    });

    trigger?.addEventListener("focus", () => {
      closeMenus(menu);
      setMenuOpen(menu, true);
    });

    menu.addEventListener("focusout", (event) => {
      if (!menu.contains(event.relatedTarget)) {
        timer = window.setTimeout(() => setMenuOpen(menu, false), 180);
      }
    });

    menu.querySelectorAll(".mega-menu a").forEach((link) => {
      link.addEventListener("click", () => setMenuOpen(menu, false));
    });
  });

  document.addEventListener("pointerdown", (event) => {
    if (!navMenus.some((menu) => menu.contains(event.target))) closeMenus();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      const openMenu = navMenus.find((menu) => menu.querySelector('.menu-trigger[aria-expanded="true"]'));
      closeMenus();
      openMenu?.querySelector(".menu-trigger")?.focus();
    }
  });
})();
