"use strict";

// HMIS integration: sends raw observations (vitals, lab results) to the widget
// server. The server assesses them and streams the result to every widget.
//
// This runs in the browser only because the demo has no backend. A real HMIS
// makes this call from its own server, so the API key never reaches a browser.

const form = document.getElementById("observation-form");
const patientSelect = document.getElementById("obs-patient");
const kindSelect = document.getElementById("obs-kind");
const statusLine = document.getElementById("feed-status");
const fieldsets = form.querySelectorAll("fieldset[data-kind]");

const RECORDED_BY = document.querySelector(".profile-name")?.textContent.trim();

// Read patients from the table already on the page.
const patients = Array.from(
  document.querySelectorAll("#patient-table-body tr"),
).map((row) => {
  const cells = row.querySelectorAll("td");
  return {
    name: row.querySelector(".patient-name").textContent.trim(),
    mrn: cells[1].textContent.trim(),
    ward: cells[2].textContent.trim(),
  };
});

patientSelect.append(
  ...patients.map((p, i) => new Option(`${p.name} (MRN ${p.mrn})`, i)),
);

// Show only the fields for the chosen observation type. A disabled fieldset
// is skipped by validation and by FormData.
function showFieldsFor(kind) {
  fieldsets.forEach((fieldset) => {
    const active = fieldset.dataset.kind === kind;
    fieldset.hidden = !active;
    fieldset.disabled = !active;
  });
}

kindSelect.addEventListener("change", () => showFieldsFor(kindSelect.value));
showFieldsFor(kindSelect.value);

function readData(kind) {
  const values = new FormData(form);

  if (kind === "lab") {
    return { test: values.get("test"), value: Number(values.get("value")) };
  }

  const vitals = {};
  for (const name of ["spo2", "heartRate", "respiratoryRate", "temperature", "systolicBp"]) {
    const value = values.get(name);
    if (value !== "") vitals[name] = Number(value);
  }
  return vitals;
}

function showStatus(text, kind) {
  statusLine.textContent = text;
  statusLine.className = `feed-status ${kind}`;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const kind = kindSelect.value;
  const patient = patients[patientSelect.value];
  const data = readData(kind);

  if (kind === "vitals" && Object.keys(data).length === 0) {
    showStatus("Enter at least one vital sign.", "error");
    return;
  }

  const payload = {
    kind,
    patient,
    source: "CityCare HMIS",
    recordedBy: RECORDED_BY,
    data,
  };

  const button = form.querySelector("button");
  button.disabled = true;
  showStatus("Saving...", "");

  try {
    const response = await fetch(`${form.dataset.serverUrl}/observations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${form.dataset.apiKey}`,
      },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(body.error ?? `Server responded ${response.status}`);
    }

    showStatus(`Saved for ${patient.name}. The assessment will appear in the live feed.`, "ok");
    fieldsets.forEach((fieldset) =>
      fieldset.querySelectorAll("input").forEach((input) => (input.value = "")),
    );
  } catch (error) {
    showStatus(`Could not save: ${error.message}`, "error");
  } finally {
    button.disabled = false;
  }
});
