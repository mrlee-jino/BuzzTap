import assert from "node:assert/strict"
import { test } from "node:test"
import { matchingBusinessMemberships } from "./businessAccountRole.js"

const membership = (role, overrides = {}) => ({ id: role, role, status: "ACTIVE", businesses: { id: "example" }, ...overrides })
const profile = role => ({ role, status: "ACTIVE" })

test("staff, managers and cashiers must match their stored profile role", () => {
  for (const role of ["STAFF", "MANAGER", "CASHIER"]) {
    const row = membership(role)
    assert.deepEqual(matchingBusinessMemberships(profile(role), [row]), [row])
    assert.deepEqual(matchingBusinessMemberships(profile("BUSINESS_OWNER"), [row]), [])
  }
})

test("owner profile maps to OWNER without granting ownership to staff", () => {
  const row = membership("OWNER")
  assert.deepEqual(matchingBusinessMemberships(profile("BUSINESS_OWNER"), [row]), [row])
  assert.deepEqual(matchingBusinessMemberships(profile("STAFF"), [row]), [])
})

test("inactive accounts, invalid roles and inactive/unavailable memberships are denied", () => {
  for (const account of [null, { role: "STAFF", status: "SUSPENDED" }, profile("CUSTOMER"), profile("ADMIN")])
    assert.deepEqual(matchingBusinessMemberships(account, [membership("STAFF")]), [])
  for (const row of [membership("STAFF", { status: "SUSPENDED" }), membership("STAFF", { businesses: null }), membership("UNKNOWN")])
    assert.deepEqual(matchingBusinessMemberships(profile("STAFF"), [row]), [])
})

test("only matching memberships can be selected for accounts with multiple businesses", () => {
  const staff = membership("STAFF")
  assert.deepEqual(matchingBusinessMemberships(profile("STAFF"), [staff, membership("MANAGER")]), [staff])
})
