import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider } from "react-aria-components";
import { App } from "./App";
import "./style.css";

// The service fills in the session token and, for a protected session, the home
// link's access URL; read the link before the app replaces the first paint.
const container = document.getElementById("root");
if (!container) throw new Error("index.html needs a #root element");
const home = container.querySelector("a.brand")?.getAttribute("href") ?? "/";
createRoot(container).render(
  <StrictMode>
    <I18nProvider locale="en-US">
      <App home={home} />
    </I18nProvider>
  </StrictMode>,
);
