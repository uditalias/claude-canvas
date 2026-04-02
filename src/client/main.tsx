import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { initGenerator } from "./lib/wobble";
import "./styles/index.css";

// Initialize rough.js generator before rendering
initGenerator().then(() => {
  const root = createRoot(document.getElementById("root")!);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
