import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

// satteri-heading-anchors.mjs imports satteriCollectHastText from
// @astrojs/markdown-satteri, and astro renders through its own resolution of
// the same package. If the version ranges drift apart npm installs a second
// copy, and nothing else in the build or tests notices.

const PKG = "@astrojs/markdown-satteri";
const rootRequire = createRequire(import.meta.url);

for (const dependent of ["astro", "@astrojs/mdx"]) {
  test(`${dependent} resolves the same ${PKG} as the site's plugins`, () => {
    const dependentRequire = createRequire(rootRequire.resolve(`${dependent}/package.json`));
    assert.equal(
      dependentRequire.resolve(PKG),
      rootRequire.resolve(PKG),
      `${dependent} has its own copy of ${PKG}. Set package.json's range to match ` +
        `${dependent}'s dependencies["${PKG}"] and reinstall.`,
    );
  });
}
