(() => {
  "use strict";

  const links = [...document.querySelectorAll("nav.links a[href^='#']")];
  const sections = links
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  function setActive(id) {
    links.forEach((link) => {
      const active = link.hash === `#${id}`;
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
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
})();
