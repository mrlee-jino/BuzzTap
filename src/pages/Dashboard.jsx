function Dashboard() {
  const stats = [
    {
      label: "Today's Sales",
      value: "₱12,450",
      description: "+12.5% from yesterday",
    },
    {
      label: "Transactions",
      value: "128",
      description: "+8.2% from yesterday",
    },
    {
      label: "Active NFC Cards",
      value: "76",
      description: "4 cards added today",
    },
    {
      label: "Active Stations",
      value: "14 / 16",
      description: "87.5% availability",
    },
  ]

  return (
    <div className="mx-auto max-w-[1600px]">
      {/* Header */}
      <div className="mb-8">
        <p className="mb-2 text-sm font-medium text-[#F5C400]">
          OVERVIEW
        </p>

        <h1 className="text-4xl font-bold tracking-tight text-white">
          Dashboard
        </h1>

        <p className="mt-2 text-[#777]">
          Here's what's happening with your business today.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="
              group rounded-2xl
              border border-[#222]
              bg-[#111]
              p-6
              shadow-[8px_8px_25px_rgba(0,0,0,0.35),-5px_-5px_20px_rgba(255,255,255,0.015)]
              transition-all duration-300
              hover:-translate-y-1
              hover:border-[#F5C400]/40
              hover:shadow-[0_12px_35px_rgba(245,196,0,0.08)]
            "
          >
            <p className="text-sm text-[#777]">
              {stat.label}
            </p>

            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white">
              {stat.value}
            </h2>

            <p className="mt-3 text-xs text-[#F5C400]">
              {stat.description}
            </p>
          </div>
        ))}
      </div>

      {/* Lower dashboard */}
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Revenue */}
        <div
          className="
            xl:col-span-2
            min-h-[320px]
            rounded-2xl
            border border-[#222]
            bg-[#111]
            p-6
            shadow-[8px_8px_25px_rgba(0,0,0,0.35),-5px_-5px_20px_rgba(255,255,255,0.015)]
          "
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Revenue Overview
              </h2>

              <p className="mt-1 text-sm text-[#666]">
                Monthly business performance
              </p>
            </div>

            <span className="rounded-lg bg-[#F5C400]/10 px-3 py-2 text-sm font-medium text-[#F5C400]">
              +18.4%
            </span>
          </div>

          {/* Placeholder chart */}
          <div className="mt-8 flex h-48 items-end gap-3">
            {[35, 48, 42, 65, 55, 72, 62, 82, 68, 90, 76, 96].map(
              (height, index) => (
                <div
                  key={index}
                  className="flex-1 rounded-t-lg bg-[#F5C400]/20 transition-all duration-300 hover:bg-[#F5C400]"
                  style={{ height: `${height}%` }}
                />
              )
            )}
          </div>
        </div>

        {/* System status */}
        <div
          className="
            rounded-2xl
            border border-[#222]
            bg-[#111]
            p-6
            shadow-[8px_8px_25px_rgba(0,0,0,0.35),-5px_-5px_20px_rgba(255,255,255,0.015)]
          "
        >
          <h2 className="text-lg font-semibold text-white">
            System Status
          </h2>

          <p className="mt-1 text-sm text-[#666]">
            Current BuzzTap infrastructure
          </p>

          <div className="mt-8 space-y-5">
            <StatusItem name="NFC System" />
            <StatusItem name="Workstations" />
            <StatusItem name="Payment System" />
            <StatusItem name="Database" />
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusItem({ name }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-[#AAA]">
        {name}
      </span>

      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-[#F5C400] shadow-[0_0_10px_#F5C400]" />

        <span className="text-xs text-[#F5C400]">
          Operational
        </span>
      </div>
    </div>
  )
}

export default Dashboard