// Registers the service worker and shows its cache version in Settings.
// Moved out of index.html so the Content-Security-Policy can forbid all inline scripts.
function setVersionBadge(text) {
  const badge = document.getElementById("swVersionBadge");
  if (badge) {
    badge.textContent = text;
  }
}

function requestSwVersion() {
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: "GET_VERSION" });
  } else {
    // No service worker controlling this load yet (e.g. very first
    // visit before install finishes) — nothing to report.
    setVersionBadge("no SW");
  }
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data && event.data.type === "VERSION") {
      setVersionBadge(event.data.version);
    }
  });

  // If a new service worker takes over while the page is open
  // (e.g. right after an update finishes installing), refresh the badge.
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    requestSwVersion();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("sw.js")
      .then(() => {
        requestSwVersion();
      })
      .catch((error) => {
        console.warn("Service worker registration failed:", error);
        setVersionBadge("error");
      });
  });
} else {
  setVersionBadge("unsupported");
}
