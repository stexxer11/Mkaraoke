import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

import { KaraokeProvider } from "./context/KaraokeContext";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <KaraokeProvider>
      <App />
    </KaraokeProvider>
  </React.StrictMode>
);