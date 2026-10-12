import test from "node:test"
import assert from "node:assert/strict"
import { MAX_PROFILE_IMAGE_BYTES, validateProfileImage } from "./profileImages.js"

test("image uploads accept exactly 10 MB and reject larger files", () => {
  assert.equal(validateProfileImage({ type: "image/png", size: MAX_PROFILE_IMAGE_BYTES }), null)
  assert.match(validateProfileImage({ type: "image/png", size: MAX_PROFILE_IMAGE_BYTES + 1 }), /10 MB/)
})
test("image uploads reject empty and unsupported files", () => {
  assert.match(validateProfileImage({ type: "image/jpeg", size: 0 }), /non-empty/)
  assert.match(validateProfileImage({ type: "text/html", size: 20 }), /JPG/)
  assert.match(validateProfileImage({ type: "image/svg+xml", size: 20 }), /JPG/)
  for (const type of ["image/jpeg", "image/png", "image/webp", "image/gif"]) {
    assert.equal(validateProfileImage({ type, size: 100 }), null)
  }
})
