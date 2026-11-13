/** The data each static reader page is drawn from. `build.ts` assembles it from
 * the selected records; the React reader in `ui/` prerenders it into the page and
 * hydrates from the same data. HTML strings hold prose that `build.ts` has already
 * rendered inert. */
export interface PortalReference { relation: string; target: string; href: string | null; required: boolean }
export interface PortalSourceReference { reference: string; href: string | null; required: boolean; role: string; id: string }
export interface PortalCard { kind: string; title: string; summary: string; id: string; href: string }
export interface PortalRecordView {
  kind: string; title: string; id: string; path: string;
  /** Opening paragraph, rendered inline; the client reads it back from the page. */
  lead: string;
  /** Record body after its title and opening paragraph; read back from the page. */
  prose: string;
  note: string;
  relations: PortalReference[]; sources: PortalSourceReference[];
  source: string; context: string; sourceDigest: string; semanticDigest: string; structured: string;
}
export interface PortalSourceRow { id: string; href: string; path: string; source: string; context: string }
export type PortalPage =
  | { page: "index"; publication: string; records: PortalCard[]; files: number; search: string[] }
  | { page: "record"; publication: string; record: PortalRecordView }
  | { page: "sources"; publication: string; records: PortalSourceRow[]; identity: string };
