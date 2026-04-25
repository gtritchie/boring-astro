---
title: Boring-By-Design Website
summary: My personal website, built with Astro
status: active
startedAt: 2026-04-23
tech: [Astro, TypeScript, HTML, CSS, Markdown, Personal]
featured: true
---

## Why

I'm building this site to learn [Astro](https://astro.build/) in preparation for a bigger project
to reimplement a WordPress site in something less... painful.

## The Domain

I've had the domain "boringbydesign.ca" for a few years; originally intended to build a site
focused on accessibility, but never got around to it. The domain name reflects my personal
preference for simple, clean websites that are fast and as low-tech as possible to get the job done.

## Implementation

I used Claude Code's superpowers to brainstorm, design, and implement this site in an afternoon. I
had already worked through some Astro tutorials so wasn't flying blind, but deploying to
[Cloudflare Workers](https://workers.cloudflare.com/product/workers) was a new twist. If you are
reading this, I must have figured it out!

## First Tweak: external link affordance for Markdown and .astro

I showed my wife the initial deployment, she said, "Yup, it's boring!" Mission accomplished?

She clicked on a link to a different site and it navigated in place. I immediately thought, "Oh,
that should load in a new tab, and it should have accessibility affordances (an icon and additional
accessible text mentioning that it will open in a new tab)." So, another learning opportunity, where
I found out about the [rehype](https://github.com/rehypejs/rehype) pipeline and how Astro uses it.
