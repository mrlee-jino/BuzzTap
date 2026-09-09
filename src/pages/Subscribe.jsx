export default function Subscribe() {
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
              ["Starter", "₱1,499/mo", "Wallet tracking, sales dashboard, up to 2 staff"],
              ["Growth", "₱3,499/mo", "Content tools, reports, workflow automation"],
              ["Scale", "₱6,999/mo", "Advanced controls, unlimited staff and audits"],
            ].map(([name, price, detail]) => (
              <div key={name} className="rounded-2xl border border-[#242424] bg-[#181818] p-5">
                <p className="text-xl font-semibold">{name}</p>
                <p className="mt-4 text-3xl font-bold text-[#F5C400]">{price}</p>
                <p className="mt-4 text-sm text-[#A3A3A3]">{detail}</p>
                <a href="/checkout" className="mt-6 inline-flex rounded-xl bg-[#F5C400] px-4 py-2 font-semibold text-black">Select plan</a>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
