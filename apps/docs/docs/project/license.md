# License

Spellophone is free software, released under the
[GNU General Public License, version 3 or later](https://www.gnu.org/licenses/gpl-3.0.html)
(`GPL-3.0-or-later`), the same license as espeak-ng.

That covers everything in the repository: the C glue, the TypeScript, the
build scripts, the documentation and the examples. The compiled `wasm/` and
`espeak-ng-data/` artifacts are built from espeak-ng's sources and carry
espeak-ng's license.

## What this means for your project

The GPL is a copyleft license. An application that links Spellophone, which
includes bundling it into a web app or importing it in a Node.js program, is
a derivative work and has to be released under the GPL as well, with its
source available to its users. If that does not fit your project, Spellophone
is not the right choice; there is no other license available, because
espeak-ng itself is GPL.

## espeak-ng

espeak-ng is copyright its authors, principally Jonathan Duddington (eSpeak)
and Reece H. Dunn (eSpeak NG), and is distributed under the GPL version 3 or
later. Its bundled `ucd-tools` is Apache-2.0 and its Unicode data is under the
Unicode license; `speechPlayer` is GPL-3.0-or-later. See the `COPYING*` files
in the espeak-ng repository.

The 2017 `emscripten/` port that ships inside espeak-ng, by Eitan Isaacson and
Alberto Pettarin, was the starting point for understanding how to build
espeak-ng for the web. Spellophone's build and glue are a rewrite, not a copy.
