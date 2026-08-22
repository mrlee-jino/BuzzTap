function Dashboard() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900">
        Dashboard
      </h1>

      <p className="mt-2 text-slate-500">
        Here's what's happening with your business today.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mt-8">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm text-slate-500">Today's Sales</p>
          <h2 className="text-2xl font-bold mt-2">₱12,450</h2>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm text-slate-500">Transactions</p>
          <h2 className="text-2xl font-bold mt-2">128</h2>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm text-slate-500">Active NFC Cards</p>
          <h2 className="text-2xl font-bold mt-2">76</h2>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm text-slate-500">Active Stations</p>
          <h2 className="text-2xl font-bold mt-2">14 / 16</h2>
        </div>
      </div>
    </div>
  )
}

export default Dashboard