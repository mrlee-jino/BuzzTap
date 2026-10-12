import test from "node:test"
import assert from "node:assert/strict"
import { nextProductId, catalogCategories } from "./catalog.js"

test("product IDs advance past existing and deleted IDs and ignore custom codes", () => {
  assert.equal(nextProductId([]), "PROD-001")
  assert.equal(nextProductId([{ id: "PROD-001" }, { id: "1234" }, { id: "PROD-009", deleted_at: "2026-10-12" }]), "PROD-010")
  assert.equal(nextProductId([{ id: "PROD-999" }]), "PROD-1000")
})

test("category suggestions trim, deduplicate and sort previous categories", () => {
  assert.deepEqual(catalogCategories([{ category: " Drinks " }, { category: "drinks" }, { category: "Gaming" }, { category: null }]), ["Drinks", "Gaming"])
})
