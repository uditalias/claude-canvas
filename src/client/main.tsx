import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { initGenerator } from "./lib/wobble";
import { initRoughLineGenerator } from "./lib/rough-line";
import "./styles/index.css";

// Initialize rough.js generators before rendering
Promise.all([initGenerator(), initRoughLineGenerator()]).then(() => {
  const root = createRoot(document.getElementById("root")!);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
