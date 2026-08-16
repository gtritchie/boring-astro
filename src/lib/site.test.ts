import { test } from "node:test";
import assert from "node:assert/strict";
import { site, internalHosts, isExternalHttp } from "./site.mjs";

test("internalHosts derives the bare and www hosts from the site origin", () => {
  const host = new URL(site).host;
  assert.deepEqual(internalHosts, [host, `www.${host}`]);
});

test("isExternalHttp accepts http(s) URLs on foreign hosts", () => {
  assert.equal(isExternalHttp("https://example.com/page"), true);
  assert.equal(isExternalHttp("http://example.com"), true);
});

test("isExternalHttp rejects the site's own hosts", () => {
  assert.equal(isExternalHttp("https://boringbydesign.ca/writing/"), false);
  assert.equal(isExternalHttp("https://www.boringbydesign.ca/"), false);
});

test("isExternalHttp rejects non-http schemes and relative paths", () => {
  assert.equal(isExternalHttp("mailto:x@example.com"), false);
  assert.equal(isExternalHttp("/writing/"), false);
  assert.equal(isExternalHttp("#section"), false);
});

test("isExternalHttp rejects non-strings and unparsable URLs", () => {
  assert.equal(isExternalHttp(undefined), false);
  assert.equal(isExternalHttp("http://"), false);
});
