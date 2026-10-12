import test from "node:test"
import assert from "node:assert/strict"
import { nextCustomerCode } from "./customerRegistration.js"

const today = new Date("2026-10-12T15:04:00Z")

test("customer codes use UTC+8 date and a padded daily sequence", () => {
  assert.equal(nextCustomerCode([], today), "20261012001")
  assert.equal(nextCustomerCode([
    { customer_code: "20261012001" },
    { customer_code: "20261012009", status: "DELETED" },
    { customer_code: "20261011999" },
    { customer_code: "CUS-ABC" },
    { customer_code: null },
  ], today), "20261012010")
})

test("sequence restarts at UTC+8 midnight regardless of host timezone", () => {
  assert.equal(nextCustomerCode([{ customer_code: "20261012009" }], new Date("2026-10-12T16:00:00Z")), "20261013001")
  assert.equal(nextCustomerCode([], new Date("2026-12-31T16:00:00Z")), "20270101001")
})

test("three-digit sequence cannot overflow into malformed codes", () => {
  assert.equal(nextCustomerCode([{ customer_code: "20261012999" }], today), null)
})
