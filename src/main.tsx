import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { DeviceProvider } from "./context/DeviceContext";
import { FileNavigationProvider } from "./context/FileNavigationContext";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <DeviceProvider>
      <FileNavigationProvider>
        <App />
      </FileNavigationProvider>
    </DeviceProvider>
  </React.StrictMode>,
);
