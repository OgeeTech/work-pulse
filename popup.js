// Convert raw seconds to "Xh Ym Zs"
function formatDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

document.addEventListener("DOMContentLoaded", async () => {
  const domainList = document.getElementById("domain-list");
  const totalTimeEl = document.getElementById("total-time");
  const exportBtn = document.getElementById("export-json");

  const today = new Date().toISOString().split("T")[0];
  const storageKey = `analytics_${today}`;

  const data = await chrome.storage.local.get({ [storageKey]: {} });
  const records = data[storageKey];

  const domains = Object.keys(records);

  if (domains.length === 0) {
    domainList.innerHTML = `<div class="loading">No activity logged yet today. Browse around!</div>`;
    return;
  }

  // Sort descending by highest time spent
  domains.sort((a, b) => records[b] - records[a]);

  let grandTotalSeconds = 0;
  domainList.innerHTML = "";

  domains.forEach((dom) => {
    const secs = records[dom];
    grandTotalSeconds += secs;

    const row = document.createElement("div");
    row.className = "domain-row";
    row.innerHTML = `
      <span class="domain-name" title="${dom}">${dom}</span>
      <span class="domain-duration">${formatDuration(secs)}</span>
    `;
    domainList.appendChild(row);
  });

  totalTimeEl.innerText = formatDuration(grandTotalSeconds);

  // Export for Backend/Founder inspection
  exportBtn.addEventListener("click", () => {
    const exportPayload = {
      employeeId: "emp_dev_test_01",
      date: today,
      totalActiveSeconds: grandTotalSeconds,
      breakdown: records,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `workpulse_${today}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
});
