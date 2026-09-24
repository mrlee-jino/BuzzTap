import { useState } from "react"

const businessTypes = [
  "Cafe",
  "Computer Shop",
  "Workstations",
  "Gym",
  "Others",
]

export default function Subscribe({ registerBusiness }) {
  const [showRegistration, setShowRegistration] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError("")
    setSuccess("")
    setSubmitting(true)

    const form = new FormData(event.currentTarget)
    const result = await registerBusiness({
      businessName: String(form.get("businessName") || ""),
      email: String(form.get("user") || ""),
      password: String(form.get("password") || ""),
      businessType: String(form.get("businessType") || ""),
      phone: String(form.get("phone") || ""),
      address: String(form.get("address") || ""),
    })

    setSubmitting(false)

    if (!result.success) {
      setError(result.error?.message || "Unable to create your account.")
      return
    }

    setSuccess(
      result.requiresEmailConfirmation
        ? "Your account is ready. Check your email to confirm it, then log in."
        : "Your free account is ready. You can now log in.",
    )
    event.currentTarget.reset()
  }

  return (
    <main className="min-h-screen bg-[#090909] px-6 py-12 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F5C400] font-black text-black">B</div>
            <h1 className="text-2xl font-bold">BuzzTap Business</h1>
          </div>
          <a href="/login" className="rounded-xl border border-[#333] px-4 py-2 text-sm text-white">Back to login</a>
        </div>

        <div className="rounded-3xl border border-[#242424] bg-[#111] p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#F5C400]">Subscription</p>
          <h2 className="mt-4 text-4xl font-bold">Choose the right plan for your venue</h2>

          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {[
              ["Starter", "Free", "Get started with the essential BuzzTap business tools"],
              ["Growth", "₱3,499/mo", "Content tools, reports, workflow automation"],
              ["Scale", "₱6,999/mo", "Advanced controls, unlimited staff and audits"],
            ].map(([name, price, detail]) => (
              <div key={name} className="rounded-2xl border border-[#242424] bg-[#181818] p-5">
                <p className="text-xl font-semibold">{name}</p>
                <p className="mt-4 text-3xl font-bold text-[#F5C400]">{price}</p>
                <p className="mt-4 text-sm text-[#A3A3A3]">{detail}</p>
                {name === "Starter" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowRegistration(true)
                      setSuccess("")
                      setError("")
                    }}
                    className="mt-6 inline-flex rounded-xl bg-[#F5C400] px-4 py-2 font-semibold text-black"
                  >
                    Sign up free
                  </button>
                ) : (
                  <a href="/checkout" className="mt-6 inline-flex rounded-xl bg-[#F5C400] px-4 py-2 font-semibold text-black">Select plan</a>
                )}
              </div>
            ))}
          </div>

          {showRegistration && (
            <form onSubmit={handleSubmit} className="mt-8 rounded-2xl border border-[#242424] bg-[#181818] p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#F5C400]">Free Starter plan</p>
              <h3 className="mt-2 text-2xl font-bold">Create your business account</h3>
              <p className="mt-2 text-sm text-[#A3A3A3]">Enter your business information to get started.</p>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="text-sm text-[#A3A3A3]">
                  Business Name
                  <input name="businessName" required className="mt-2 w-full rounded-xl border border-[#292929] bg-[#0A0A0A] px-3 py-3 text-white outline-none focus:border-[#F5C400]" />
                </label>
                <label className="text-sm text-[#A3A3A3]">
                  User
                  <input name="user" type="email" required autoComplete="email" placeholder="you@example.com" className="mt-2 w-full rounded-xl border border-[#292929] bg-[#0A0A0A] px-3 py-3 text-white outline-none focus:border-[#F5C400]" />
                </label>
                <label className="text-sm text-[#A3A3A3]">
                  Password
                  <input name="password" type="password" required minLength="6" autoComplete="new-password" className="mt-2 w-full rounded-xl border border-[#292929] bg-[#0A0A0A] px-3 py-3 text-white outline-none focus:border-[#F5C400]" />
                </label>
                <label className="text-sm text-[#A3A3A3]">
                  Business Type
                  <select name="businessType" required defaultValue="" className="mt-2 w-full rounded-xl border border-[#292929] bg-[#0A0A0A] px-3 py-3 text-white outline-none focus:border-[#F5C400]">
                    <option value="" disabled>Select a type</option>
                    {businessTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>
                <label className="text-sm text-[#A3A3A3]">
                  Phone
                  <input name="phone" type="tel" required autoComplete="tel" className="mt-2 w-full rounded-xl border border-[#292929] bg-[#0A0A0A] px-3 py-3 text-white outline-none focus:border-[#F5C400]" />
                </label>
                <label className="text-sm text-[#A3A3A3] md:col-span-2">
                  Address
                  <textarea name="address" required rows="3" className="mt-2 w-full rounded-xl border border-[#292929] bg-[#0A0A0A] px-3 py-3 text-white outline-none focus:border-[#F5C400]" />
                </label>
              </div>

              {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
              {success && <p className="mt-4 text-sm text-green-400">{success} <a href="/login" className="font-semibold underline">Go to login</a></p>}

              <button disabled={submitting} type="submit" className="mt-6 rounded-xl bg-[#F5C400] px-5 py-3 font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60">
                {submitting ? "Creating account..." : "Create free account"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}
