import test from "node:test"
import assert from "node:assert/strict"
import { communityPost, isRunningPost } from "./communityFeed.js"

test("running feed includes all owners and inclusive date boundaries", () => {
  for (const business_id of ["mine", "other", null]) {
    assert.equal(isRunningPost({ business_id, status: "PUBLISHED", start_date: "2026-10-11", end_date: "2026-10-11" }, "2026-10-11"), true)
    assert.equal(isRunningPost({ business_id, status: "PUBLISHED", start_date: null, end_date: null }, "2026-10-11"), true)
  }
})
test("future, expired and unpublished posts are excluded", () => {
  for (const status of ["ARCHIVED", "DRAFT", "SUBMITTED", "REJECTED"]) assert.equal(isRunningPost({ status }, "2026-10-11"), false)
  assert.equal(isRunningPost({ status: "PUBLISHED", start_date: "2026-10-12" }, "2026-10-11"), false)
  assert.equal(isRunningPost({ status: "PUBLISHED", end_date: "2026-10-10" }, "2026-10-11"), false)
  assert.equal(isRunningPost({ status: "PUBLISHED", end_date: "2026-10-11" }, "2026-10-12"), false)
})
test("saved post mapping preserves dates, content precedence and safe names", () => {
  const row = { id: "saved", business_id: null, content: "Body", description: "Fallback", start_date: "2026-10-11" }
  assert.equal(communityPost(row, new Map()).businessName, "BuzzTap Admin")
  assert.equal(communityPost(row, new Map()).description, "Body")
  assert.equal(communityPost(row, new Map()).startDate, "2026-10-11")
  assert.equal(communityPost({ ...row, business_id: "other", content: "" }, new Map()).description, "Fallback")
  assert.equal(communityPost({ ...row, business_id: "other" }, new Map()).businessName, "BuzzTap Business")
  assert.equal(communityPost({ ...row, business_id: "other" }, new Map([["other", "Shop"]])).businessName, "Shop")
})
