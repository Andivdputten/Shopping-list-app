// Shared camera handling for both barcode scanners (Scanner tab and Pantry tab).
// Each scanner keeps its own messages and state; this module only talks to the scanner library.

// Why the camera can't be used at all, or "" when it can. Same wording for both scanners.
export function cameraUnavailableMessage() {
  if (!window.isSecureContext) {
    return "Scanner unavailable: page is not using HTTPS.";
  }
  if (typeof Html5Qrcode === "undefined") {
    return "Scanner unavailable: library failed to load.";
  }
  return "";
}

// Creates a scanner bound to the element with this id; start it with startCamera().
// Kept separate from starting so callers can store the instance before the (slow) camera start.
export function createCamera(elementId) {
  return new Html5Qrcode(elementId);
}

// Starts the back camera with a wide, short scan box suited to barcodes; rejects if the camera can't start.
export function startCamera(camera, onScan) {
  return camera.start(
    { facingMode: "environment" },
    {
      fps: 10,
      qrbox: { width: 280, height: 120 },
      aspectRatio: 1.7777778
    },
    onScan,
    () => {
      // Ignore per-frame scan misses.
    }
  );
}

// Stops the camera (only if it was running) and removes the video, ignoring errors from either step,
// because cleanup must always finish so the buttons and state can be reset.
export async function stopCamera(camera, wasRunning) {
  try {
    if (wasRunning) {
      await camera.stop();
    }
  } catch (error) {
    // Ignore stop errors and continue cleanup.
  }

  try {
    camera.clear();
  } catch (error) {
    // Ignore clear errors during cleanup.
  }
}

export function getScannerStartErrorMessage(error) {
  const name = error && typeof error.name === "string" ? error.name : "";
  const message = error && typeof error.message === "string" ? error.message : String(error || "");
  const combined = `${name} ${message}`;

  if (combined.includes("NotAllowedError") || combined.includes("Permission denied")) {
    return "Camera permission was denied. Check the site permission (tap the lock/info icon in the address bar) and your phone's app-level camera permission for this browser.";
  }

  if (combined.includes("NotFoundError") || combined.includes("Requested device not found")) {
    return "No usable camera was found on this device.";
  }

  if (combined.includes("NotReadableError") || combined.includes("Could not start video source")) {
    return "Camera is busy or blocked by another app. Close other apps/tabs using the camera and try again.";
  }

  if (combined.includes("OverconstrainedError")) {
    return "No camera matched the requested settings (back camera). Try a different device.";
  }

  if (combined.trim()) {
    return `Could not start the scanner: ${combined.trim()}`;
  }

  return "Could not start the scanner.";
}
