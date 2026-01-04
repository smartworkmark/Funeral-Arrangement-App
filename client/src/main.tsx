import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initializeServiceWorker } from "./lib/serviceWorker";

// Initialize service worker for offline functionality
initializeServiceWorker();

createRoot(document.getElementById("root")!).render(<App />);
