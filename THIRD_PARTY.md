# Third-party material

Intent's [CC0 1.0 Universal or Zero-Clause BSD license](LICENSE) covers its
original material. It relicenses nothing else: referenced sources, external
standards, names and marks keep their own terms.

The package `@neutral/intent` has no runtime dependency: it holds files of
this repository and no other package's. It runs on the host's Node.js, and
runs the host's `git` for the commands that read a change from git. Neither
is part of the package, and each keeps its own license.

Working on the source uses TypeScript 7.0.2 (Apache-2.0), with the build of
it for the host's platform that it brings, to check the Library's type
declarations. They are development dependencies, the only packages the
lockfile names, and never enter the package.

The paint-studio example holds a copy of the Pack `test-strategy` from
Neutral Disciplines, under the same choice of licenses. Its browser tests
name Playwright, which this repository neither holds nor installs.

A Pack that a project adopts is its authors' material, under their terms.
Intent copies a release into the project as released, and grants no right to
it.
