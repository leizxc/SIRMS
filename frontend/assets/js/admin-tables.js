(() => {
  "use strict";

  const pageSize = 10;
  document
    .querySelectorAll(".admin-data-table, .reporter-table")
    .forEach((table) => {
      const body = table.tBodies[0];
      const headers = Array.from(table.tHead?.rows[0]?.cells || []).map(
        (cell) => cell.textContent.trim(),
      );
      if (!body) return;

      const pagination = document.createElement("nav");
      pagination.className = "admin-table-pagination";
      pagination.setAttribute("aria-label", "Table pages");
      pagination.innerHTML =
        '<span class="admin-table-count" aria-live="polite"></span><div><button type="button" data-page="prev">Previous</button><span class="admin-table-page"></span><button type="button" data-page="next">Next</button></div>';
      if (table.classList.contains("reporter-table"))
        pagination.querySelector(".admin-table-count").hidden = true;
      table.closest(".reporter-table-wrap, .table-scroll")?.after(pagination);

      let currentPage = 1;
      function render() {
      const allRows = Array.from(body.rows);
      const rows = allRows.filter((row) => row.dataset.filteredOut !== "1");
        const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
        currentPage = Math.min(currentPage, totalPages);
        const start = (currentPage - 1) * pageSize;
      allRows.forEach((row) => { row.hidden = true; });
      rows.forEach((row, index) => {
          Array.from(row.cells).forEach((cell, cellIndex) => {
            if (!cell.hasAttribute("data-label") && headers[cellIndex])
              cell.dataset.label = headers[cellIndex];
          });
          row.hidden = index < start || index >= start + pageSize;
        });
        const end = Math.min(start + pageSize, rows.length);
        pagination.querySelector(".admin-table-count").textContent = rows.length
          ? `Showing ${start + 1}–${end} of ${rows.length}`
          : "No rows to show";
        if (table.classList.contains("reporter-table")) {
          const count = document.getElementById("reporter-count");
          if (count)
            count.textContent = rows.length
              ? `Showing ${start + 1}–${end} of ${rows.length} reporter accounts`
              : "No reporter accounts found.";
        }
        pagination.querySelector(".admin-table-page").textContent =
          `${currentPage} / ${totalPages}`;
        pagination.querySelector('[data-page="prev"]').disabled =
          currentPage <= 1;
        pagination.querySelector('[data-page="next"]').disabled =
          currentPage >= totalPages;
      }

      pagination.addEventListener("click", (event) => {
        const direction = event.target.closest("button")?.dataset.page;
        if (direction === "prev") currentPage--;
        if (direction === "next") currentPage++;
        render();
      });
      new MutationObserver(() => {
        currentPage = 1;
        render();
      }).observe(body, { childList: true });
      render();
    });
    body.addEventListener("admin-table-filter", () => {
      currentPage = 1;
      render();
    });
})();
