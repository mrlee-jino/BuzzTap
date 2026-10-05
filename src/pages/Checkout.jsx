export default function Checkout() {
  return (
    <main className="min-h-screen bg-[#090909] px-6 py-12 text-white">
      <div className="mx-auto max-w-3xl rounded-3xl border border-[#242424] bg-[#111] p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#F5C400]">Checkout</p>
        <h1 className="mt-4 text-4xl font-bold">Complete your subscription</h1>

        <div className="mt-8 rounded-2xl border border-[#242424] bg-[#181818] p-5">
          <div className="flex items-center justify-between">
            <span>Growth Plan</span>
            <span className="font-semibold">₱3,499/mo</span>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-[#A3A3A3]">
            <span>Billing</span>
            <span>Monthly</span>
          </div>
        </div>

        <p role="status" className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          Online subscription payment is not connected yet. No charge will be made from this page.
        </p>

        <div className="mt-8 flex gap-3">
          <a href="/subscribe" className="rounded-xl border border-[#333] px-4 py-3 text-sm text-white">Back</a>
          <button type="button" disabled className="cursor-not-allowed rounded-xl bg-[#F5C400] px-6 py-3 font-semibold text-black opacity-50">Payments not configured</button>
        </div>
      </div>
    </main>
  )
}
