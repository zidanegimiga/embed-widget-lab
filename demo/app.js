
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

// Theme and sidebar preferences. The inline script in <head> applies the saved
// values before first paint; this keeps them updated (same storage keys).
const root = document.documentElement;
const themeToggle = document.getElementById("theme-toggle");
const sidebarToggle = document.getElementById("sidebar-toggle");
const navItems = document.querySelectorAll(".nav-item");
const prefersDark = matchMedia("(prefers-color-scheme: dark)");

function readPreference(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function savePreference(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked (private mode): the choice lasts until reload.
  }
}

function applyTheme(theme) {
  root.dataset.theme = theme;
  const label = `Switch to ${theme === "dark" ? "light" : "dark"} mode`;
  themeToggle.setAttribute("aria-label", label);
  themeToggle.title = label;
}

function applySidebar(collapsed) {
  if (collapsed) {
    root.dataset.sidebar = "collapsed";
  } else {
    delete root.dataset.sidebar;
  }

  const label = collapsed ? "Expand sidebar" : "Collapse sidebar";
  sidebarToggle.setAttribute("aria-expanded", String(!collapsed));
  sidebarToggle.setAttribute("aria-label", label);
  sidebarToggle.title = label;

  // Labels are hidden in the collapsed rail, so expose them as tooltips and names.
  navItems.forEach((item) => {
    const text = item.querySelector(".nav-text").textContent.trim();
    if (collapsed) {
      item.title = text;
      item.setAttribute("aria-label", text);
    } else {
      item.removeAttribute("title");
      item.removeAttribute("aria-label");
    }
  });
}

themeToggle.addEventListener("click", () => {
  const theme = root.dataset.theme === "dark" ? "light" : "dark";
  savePreference("citycare:theme", theme);
  applyTheme(theme);
});

// Follow the OS setting until the user picks a theme themselves.
prefersDark.addEventListener("change", (event) => {
  if (!readPreference("citycare:theme")) {
    applyTheme(event.matches ? "dark" : "light");
  }
});

sidebarToggle.addEventListener("click", () => {
  const collapsed = root.dataset.sidebar !== "collapsed";
  savePreference("citycare:sidebar", collapsed ? "collapsed" : "expanded");
  applySidebar(collapsed);
});

applyTheme(root.dataset.theme);
applySidebar(root.dataset.sidebar === "collapsed");
