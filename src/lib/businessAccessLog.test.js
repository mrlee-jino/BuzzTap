import test from "node:test"
import assert from "node:assert/strict"
import { recordBusinessAccess, signOutWithBusinessAccess } from "./businessAccessLog.js"

const memberships = [
  { business_id: "business-a", status: "ACTIVE" },
  { business_id: "business-a", status: "ACTIVE" },
  { business_id: "business-b", status: "ACTIVE" },
  { business_id: "inactive", status: "SUSPENDED" },
]
const session = { user: { id: "user-a" }, access_token: "test-session-token" }
function clientWith({ signOutError = null, insertError = null } = {}) {
  const calls = []
  return {
    calls,
    auth: { signOut: async () => { calls.push({ action: "signOut" }); return { error: signOutError } } },
    from(table) {
      return { insert(rows) {
        const call = { action: "insert", table, rows }
        const query = {
          setHeader(name, value) { call.header = [name, value]; return query },
          then(resolve, reject) { calls.push(call); return Promise.resolve({ error: insertError }).then(resolve, reject) },
        }
        return query
      } }
    },
  }
}

test("a login records one event per active business, even with duplicate memberships", async () => {
  const client = clientWith()
  await recordBusinessAccess(client, session.user.id, memberships, "LOGIN")
  assert.deepEqual(client.calls, [{ action: "insert", table: "business_access_logs", rows: [
    { business_id: "business-a", user_id: "user-a", event: "LOGIN" },
    { business_id: "business-b", user_id: "user-a", event: "LOGIN" },
  ] }])
})

test("logout is recorded after successful sign-out using the departing user's identity", async () => {
  const client = clientWith()
  assert.deepEqual(await signOutWithBusinessAccess(client, session, memberships), { error: null })
  assert.equal(client.calls[0].action, "signOut")
  assert.deepEqual(client.calls[1].header, ["Authorization", "Bearer test-session-token"])
  assert.ok(client.calls[1].rows.every((row) => row.event === "LOGOUT" && row.user_id === "user-a"))
})

test("failed sign-out does not create a false logout", async () => {
  const error = new Error("Sign-out failed")
  const client = clientWith({ signOutError: error })
  assert.equal((await signOutWithBusinessAccess(client, session, memberships)).error, error)
  assert.deepEqual(client.calls, [{ action: "signOut" }])
})

test("already signed-out users and missing memberships do not create access events", async () => {
  const client = clientWith()
  await signOutWithBusinessAccess(client, null, memberships)
  await recordBusinessAccess(client, null, memberships, "LOGIN")
  await recordBusinessAccess(client, "user-a", [], "LOGIN")
  assert.deepEqual(client.calls, [{ action: "signOut" }])
})

test("an unavailable audit service does not prevent logout", async (t) => {
  t.mock.method(console, "warn", () => {})
  const client = clientWith({ insertError: { message: "Unavailable" } })
  assert.deepEqual(await signOutWithBusinessAccess(client, session, memberships), { error: null })
  assert.equal(console.warn.mock.callCount(), 1)
})
