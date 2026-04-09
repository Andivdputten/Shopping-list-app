const statusEl = document.getElementById("status");
const button = document.getElementById("testButton");

statusEl.textContent = "App loaded successfully.";

button.addEventListener("click", () => {
  statusEl.textContent = "Button works. JavaScript is running.";
});