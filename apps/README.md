# Intent applications

One installation and the `intent` command provide the user interfaces:

- [Editor](editor/README.md): `intent open [PROJECT]` opens the local browser for
  reading, initialization, authoring, change review and recovery.
- [CLI](cli/README.md): `intent` provides inspection, explicit implementation
  reconciliation, reading, proposal preparation and application.
- [Portal](portal/README.md): **Export site** and `intent export` create a static
  reader from selected current Knowledge.
- [Agent](agent/README.md): **Connect an agent** supplies configuration for
  `intent mcp PROJECT`, a bounded MCP stdio adapter with a fixed project root.

Apps consume the shared Library. Compatibility commands use the same
implementations. The [installation guide](../docs/install.md) describes the npm
package for every interface and local installation for Library imports. The
[distribution guide](../distribution/README.md) describes source assembly.
