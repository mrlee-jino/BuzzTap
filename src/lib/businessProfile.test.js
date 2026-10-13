import assert from "node:assert/strict"
import { test } from "node:test"
import { savePublicBusinessProfile } from "./businessProfile.js"

test("save verifies the persisted theme using the reload RPC", async () => {
  const calls = []
  const client = { rpc: async (name, args) => {
    calls.push([name, args])
    return name === "save_public_business_profile"
      ? { data: { theme_color: "#F5C400" }, error: null }
      : { data: { display_name: "Example", theme_color: "#16a34a" }, error: null }
  } }
  const saved = await savePublicBusinessProfile(client, "business-id", { display_name: "Example", theme_color: "#16a34a" })
  assert.equal(saved.theme_color, "#16A34A")
  assert.deepEqual(calls, [
    ["save_public_business_profile", { p_business_id: "business-id", p_profile: { display_name: "Example", theme_color: "#16A34A" } }],
    ["get_public_business_profile", { p_business_id: "business-id" }],
  ])
})

test("legacy backend cannot report success when it drops or changes the color", async () => {
  for (const data of [null, {}, { theme_color: "#F5C400" }]) {
    const client = { rpc: async () => ({ data, error: null }) }
    await assert.rejects(savePublicBusinessProfile(client, "business-id", { theme_color: "#16A34A" }), /theme color was not saved/)
  }
})

test("save/read errors are surfaced without a success result", async () => {
  const calls = []
  const failedSave = { rpc: async name => { calls.push(name); return { error: new Error("Save denied") } } }
  await assert.rejects(savePublicBusinessProfile(failedSave, "business-id", {}), /Save denied/)
  assert.deepEqual(calls, ["save_public_business_profile"])
  const failedRead = { rpc: async name => name === "save_public_business_profile"
    ? { error: null } : { error: new Error("Read unavailable") } }
  await assert.rejects(savePublicBusinessProfile(failedRead, "business-id", {}), /Read unavailable/)
})
