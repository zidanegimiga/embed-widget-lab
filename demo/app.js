
"use strict";

// Display the current date in Nairobi time.
const dateElement = document.getElementById("current-date");

if (dateElement) {
  dateElement.textContent = new Intl.DateTimeFormat("en-KE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Nairobi",
  }).format(new Date());
}

// Patient table search.
const searchInput = document.getElementById("global-search");
const clearSearch = document.getElementById("clear-search");
const patientTableBody = document.getElementById("patient-table-body");
const tableCount = document.getElementById("table-count");

const patientRows = patientTableBody
  ? Array.from(patientTableBody.querySelectorAll("tr"))
  : [];

function filterPatients() {
  const query = searchInput.value.trim().toLowerCase();
  let visibleCount = 0;

  patientRows.forEach((row) => {
    const matches = row.textContent.toLowerCase().includes(query);

    row.hidden = !matches;

    if (matches) {
      visibleCount += 1;
    }
  });

  if (tableCount) {
    tableCount.textContent =
      `Showing ${visibleCount} of ${patientRows.length} demo patients`;
  }
}

if (searchInput) {
  searchInput.addEventListener("input", filterPatients);
}

if (clearSearch && searchInput) {
  clearSearch.addEventListener("click", () => {
    searchInput.value = "";
    filterPatients();
    searchInput.focus();
  });
}
