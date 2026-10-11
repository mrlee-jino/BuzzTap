import test from "node:test"
import assert from "node:assert/strict"
import { formatRemaining, sessionCustomerName, sessionRemaining } from "./sessionTiming.js"

test("countdown uses the saved deadline and catches up after browser suspension", () => {
  const end = Date.parse("2026-10-11T12:00:00Z")
  const session = { ends_at: new Date(end).toISOString() }
  assert.equal(sessionRemaining(session, end - 3600000), 3600)
  assert.equal(formatRemaining(sessionRemaining(session, end - 3600000)), "01:00:00")
  assert.equal(sessionRemaining(session, end - 500), 1)
  assert.equal(sessionRemaining(session, end + 60000), 0)
  assert.equal(formatRemaining(0), "Time expired")
  assert.equal(sessionRemaining({}, end), null)
  assert.equal(formatRemaining(null), "Time not recorded")
})
test("customer snapshot, guest and existing registered names resolve safely", () => {
  const customers = [{ id: "customer-1", name: "Registered customer" }]
  assert.equal(sessionCustomerName({ customer_name: "Saved name", customer_id: "customer-1" }, customers), "Saved name")
  assert.equal(sessionCustomerName({ guest_name: "Guest" }, customers), "Guest")
  assert.equal(sessionCustomerName({ customer_id: "customer-1" }, customers), "Registered customer")
  assert.equal(sessionCustomerName(undefined, customers), "Customer not recorded")
})
