import assert from "node:assert/strict"
import { test } from "node:test"
import { canAccessPage, ROLE_PATHS } from "./businessAccess.js"

test("STAFF can access exactly the five requested pages", () => {
  const requested = ["/", "/staff-purchase", "/products-services", "/content", "/workstations"]
  assert.deepEqual(ROLE_PATHS.STAFF, requested)
  for (const path of requested) assert.equal(canAccessPage("STAFF", path), true)
  for (const path of ["/transactions", "/customers", "/wallet", "/reports", "/settings", "/rebates", "/system-logs"])
    assert.equal(canAccessPage("STAFF", path), false)
})

test("unknown roles fail closed and established manager/cashier restrictions hold", () => {
  assert.equal(canAccessPage("UNKNOWN", "/"), false)
  assert.equal(canAccessPage(undefined, "/content"), false)
  assert.equal(canAccessPage("MANAGER", "/settings"), false)
  assert.equal(canAccessPage("OWNER", "/settings"), true)
  assert.equal(canAccessPage("CASHIER", "/staff-purchase"), true)
  assert.equal(canAccessPage("CASHIER", "/workstations"), false)
})
