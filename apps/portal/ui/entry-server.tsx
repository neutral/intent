import { prerender } from "react-dom/static";
import type { PortalPage } from "../page-data";
import { Root } from "./pages";

/** One reader page as static HTML, for build.ts to place in the page's #root. */
export async function renderPage(page: PortalPage): Promise<string> {
  const { prelude } = await prerender(<Root page={page} />);
  return new Response(prelude).text();
}
