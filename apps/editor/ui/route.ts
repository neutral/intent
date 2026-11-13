/* The Editor's view lives in the URL fragment, so back, forward and reload restore
   it. The query string stays the service's: a protected session keeps `?token=`. */

export type View = "meaning" | "relationships" | "implementation" | "source";
export type Place = "configuration" | "practices" | "comparison" | "export" | "agent" | "recovery" | "new";
export type Route =
  | { screen: "home" }
  | { screen: "record"; path: string; view: View }
  | { screen: Place };

export const views: View[] = ["meaning", "relationships", "implementation", "source"];
const places: Place[] = ["configuration", "practices", "comparison", "export", "agent", "recovery", "new"];

export function parseRoute(hash: string): Route {
  const value = hash.replace(/^#/, "");
  if (!value || value === "/") return { screen: "home" };
  if (value.startsWith("/record/")) {
    const [encoded = "", view] = value.slice("/record/".length).split("/");
    const path = safeDecode(encoded);
    return path ? { screen: "record", path, view: views.includes(view as View) ? view as View : "meaning" } : { screen: "home" };
  }
  const place = value.slice(1) as Place;
  if (value.startsWith("/") && places.includes(place)) return { screen: place };
  // An address from before views were kept in the URL names a record path alone.
  const path = safeDecode(value);
  return path && !value.startsWith("/") ? { screen: "record", path, view: "meaning" } : { screen: "home" };
}

export function href(route: Route): string {
  if (route.screen === "home") return "#/";
  if (route.screen === "record") return `#/record/${encodeURIComponent(route.path)}${route.view === "meaning" ? "" : `/${route.view}`}`;
  return `#/${route.screen}`;
}

export const sameRoute = (left: Route, right: Route) => href(left) === href(right);

function safeDecode(value: string): string {
  try { return decodeURIComponent(value); } catch { return ""; }
}
