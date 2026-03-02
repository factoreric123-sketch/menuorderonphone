import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Change marker: added to verify GitHub push flow.
createRoot(document.getElementById("root")!).render(<App />);
