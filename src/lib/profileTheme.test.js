import test from "node:test"
import assert from "node:assert/strict"
import { DEFAULT_PROFILE_COLOR, profileTheme } from "./profileTheme.js"

test("profile theme normalizes saved colors and falls back for invalid or missing values", () => {
  assert.equal(profileTheme("#16a34a").color, "#16A34A")
  for (const value of [undefined, "", "red", "#123", "url(fake)"]) assert.equal(profileTheme(value).color, DEFAULT_PROFILE_COLOR)
})

test("profile theme uses readable button text for bright and dark colors", () => {
  assert.equal(profileTheme("#FFFFFF").foreground, "#000000")
  assert.equal(profileTheme("#000000").foreground, "#FFFFFF")
  assert.equal(profileTheme("#FFFFFF").onWhite, "#737373")
})
