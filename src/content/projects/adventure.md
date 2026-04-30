---
title: Colossal Cave Adventure Port
summary: Ported ESR's open-adventure C codebase to Typescript
status: active
startedAt: 2026-02-15
tags: [TypeScript, C, node.js, Personal]
featured: true
links:
  repo: https://github.com/gtritchie/open-adventure-ts
  site: https://boringbydesign.ca/adventure/
---

## Why?

My first exposure to text adventure games was [Pyramid 2000](https://en.wikipedia.org/wiki/Pyramid_2000)
on my TRS-80 Color Computer 1. I learned years later it was a variant of [Colossal Cave Adventure](https://en.wikipedia.org/wiki/Colossal_Cave_Adventure).

Something brought this back to mind a few months ago and I discovered Eric S. Raymond's [open-adventure](https://gitlab.com/esr/open-adventure). One thing led to another and I decided to create a TypeScript port,
just to see if I could. I strived to maintain exact character-for-character output in the port,
including the 70-column fixed width text. A bunch of test runs shook out a few bugs, and then I
declared it done. At that point it was a CLI application you could run via node.js.

## Then What?

As I was building this website, I decided it would be fun to host the game on the site, running it
entirely browser-side, using browser local storage to save games. I don't know why I thought the
world needed that, but who am I to question?

So I split the original TypeScript port into two packages.

### `@open-adventure/core`

This is a platform-agnostic game engine that can run directly in any modern browser. I have
[published this package to npm](https://www.npmjs.com/package/@open-adventure/core) and consume
it in my website project, as discussed below.

### `@open-adventure/cli`

This package implements the original CLI on top of the core package. I haven't published this to
npm; the only way to use it currently is to clone the repo and run it from there. Other than doing
so as a curiosity, you might as well use the actual C-based game if you want to play it in a
terminal.

## Website

With the core package in hand (during which I learned all about publishing npm packages), and the
"boring by design" philosophy, I created a hosted version of the game on this site.  It remains
faithful to the original and all text is for a fixed 70-column layout, but it should work on any
reasonably current device (I tested down to an iPhone SE in landscape mode dimensions).

The game can be reached via the Adventure link in the page footer, or directly at
https://boringbydesign.ca/adventure/.

## Next Steps

- screen-reader accessibility improvements
- actually play the game all the way through
