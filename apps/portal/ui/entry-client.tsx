import { hydrateRoot } from "react-dom/client";
import type { PortalPage } from "../page-data";
import { Root } from "./pages";
import "./style.css";

// Export prerendered this page into #root; hydrate it from the same data. A record's
// rendered prose is read back from the page rather than shipped twice.
const container = document.getElementById("root");
const data = document.getElementById("portal-data");
if (container && data?.textContent) {
  const page = JSON.parse(data.textContent) as PortalPage;
  if (page.page === "record") {
    page.record.lead = document.getElementById("lead")?.innerHTML ?? "";
    page.record.prose = document.getElementById("prose")?.innerHTML ?? "";
  }
  hydrateRoot(container, <Root page={page} />);
}
