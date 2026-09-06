import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initAppDb } from "./db/appDb";
import "./styles.css";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement,
);

initAppDb().then(
  () => {
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  },
  (error: unknown) => {
    root.render(
      <main>
        <h1>Kompass</h1>
        <p>Veritabanı açılamadı: {String(error)}</p>
      </main>,
    );
  },
);
