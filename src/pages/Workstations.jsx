import {
  Monitor,
  Search,
  Plus,
  Clock3,
  User,
  Zap,
  MoreVertical,
} from "lucide-react"
import { useState } from "react"

const workstations = [
  {
    id: "WS-001",
    name: "Station 01",
    type: "Gaming PC",
    status: "available",
    rate: 25,
  },
  {
    id: "WS-002",
    name: "Station 02",
    type: "Gaming PC",
    status: "occupied",
    rate: 25,
    customer: "Juan Dela Cruz",
    timeUsed: "01:24:32",
  },
  {
    id: "WS-003",
    name: "Station 03",
    type: "Gaming PC",
    status: "available",
    rate: 30,
  },
  {
    id: "WS-004",
    name: "Station 04",
    type: "Standard PC",
    status: "occupied",
    rate: 20,
    customer: "Maria Santos",
    timeUsed: "00:48:17",
  },
  {
    id: "WS-005",
    name: "Station 05",
    type: "Gaming PC",
    status: "maintenance",
    rate: 25,
  },
  {
    id: "WS-006",
    name: "Station 06",
    type: "Gaming PC",
    status: "available",
    rate: 25,
  },
  {
    id: "WS-007",
    name: "Station 07",
    type: "Standard PC",
    status: "occupied",
    rate: 20,
    customer: "Alex Reyes",
    timeUsed: "02:15:09",
  },
  {
    id: "WS-008",
    name: "Station 08",
    type: "Gaming PC",
    status: "available",
    rate: 30,
  },
]

function Workstations() {
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("all")

  const filteredStations = workstations.filter((station) => {
    const matchesSearch =
      station.name.toLowerCase().includes(search.toLowerCase()) ||
      station.id.toLowerCase().includes(search.toLowerCase()) ||
      station.type.toLowerCase().includes(search.toLowerCase())

    const matchesFilter =
      filter === "all" || station.status === filter

    return matchesSearch && matchesFilter
  })

  const availableCount = workstations.filter(
    (station) => station.status === "available"
  ).length

  const occupiedCount = workstations.filter(
    (station) => station.status === "occupied"
  ).length

  const maintenanceCount = workstations.filter(
    (station) => station.status === "maintenance"
  ).length

  return (
    <div className="mx-auto max-w-[1600px]">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-sm font-medium text-[#F5C400]">
            MANAGEMENT
          </p>

          <h1 className="text-4xl font-bold tracking-tight text-white">
            Workstations
          </h1>

          <p className="mt-2 text-[#777]">
            Monitor and manage your connected workstations.
          </p>
        </div>

        <button
          className="
            flex items-center justify-center gap-2
            rounded-xl
            bg-[#F5C400]
            px-5 py-3
            font-semibold
            text-black
            shadow-[0_8px_25px_rgba(245,196,0,0.15)]
            transition-all duration-300
            hover:-translate-y-0.5
            hover:bg-[#FFD83D]
            hover:shadow-[0_10px_30px_rgba(245,196,0,0.25)]
          "
        >
          <Plus size={18} />
          Add Workstation
        </button>
      </div>

      {/* Summary */}
      <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          icon={<Zap size={19} />}
          label="Available"
          value={availableCount}
        />

        <SummaryCard
          icon={<Monitor size={19} />}
          label="In Use"
          value={occupiedCount}
        />

        <SummaryCard
          icon={<Clock3 size={19} />}
          label="Maintenance"
          value={maintenanceCount}
        />
      </div>

      {/* Search and filters */}
      <div
        className="
          mb-7
          flex flex-col gap-4
          rounded-2xl
          border border-[#222]
          bg-[#111]
          p-4
          shadow-[8px_8px_25px_rgba(0,0,0,0.3)]
          md:flex-row
          md:items-center
          md:justify-between
        "
      >
        {/* Search */}
        <div className="relative w-full md:max-w-md">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[#666]"
          />

          <input
            type="text"
            placeholder="Search workstation..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="
              w-full
              rounded-xl
              border border-[#292929]
              bg-[#0A0A0A]
              py-3 pl-11 pr-4
              text-sm text-white
              outline-none
              placeholder:text-[#555]
              transition-all duration-300
              focus:border-[#F5C400]
              focus:ring-1
              focus:ring-[#F5C400]/30
            "
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto">
          <FilterButton
            label="All"
            active={filter === "all"}
            onClick={() => setFilter("all")}
          />

          <FilterButton
            label="Available"
            active={filter === "available"}
            onClick={() => setFilter("available")}
          />

          <FilterButton
            label="In Use"
            active={filter === "occupied"}
            onClick={() => setFilter("occupied")}
          />

          <FilterButton
            label="Maintenance"
            active={filter === "maintenance"}
            onClick={() => setFilter("maintenance")}
          />
        </div>
      </div>

      {/* Workstation grid */}
      {filteredStations.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filteredStations.map((station) => (
            <WorkstationCard
              key={station.id}
              station={station}
            />
          ))}
        </div>
      ) : (
        <div
          className="
            rounded-2xl
            border border-[#222]
            bg-[#111]
            py-20
            text-center
          "
        >
          <Monitor
            size={40}
            className="mx-auto mb-4 text-[#444]"
          />

          <h3 className="text-lg font-semibold text-white">
            No workstations found
          </h3>

          <p className="mt-2 text-sm text-[#666]">
            Try changing your search or filter.
          </p>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ icon, label, value }) {
  return (
    <div
      className="
        group
        flex items-center gap-4
        rounded-2xl
        border border-[#222]
        bg-[#111]
        p-5
        shadow-[8px_8px_25px_rgba(0,0,0,0.3)]
        transition-all duration-300
        hover:-translate-y-1
        hover:border-[#F5C400]/30
      "
    >
      <div
        className="
          flex h-11 w-11 shrink-0
          items-center justify-center
          rounded-xl
          bg-[#F5C400]/10
          text-[#F5C400]
          transition-all duration-300
          group-hover:bg-[#F5C400]
          group-hover:text-black
        "
      >
        {icon}
      </div>

      <div>
        <p className="text-xs text-[#666]">
          {label}
        </p>

        <p className="mt-1 text-2xl font-bold text-white">
          {value}
        </p>
      </div>
    </div>
  )
}

function FilterButton({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`
        whitespace-nowrap
        rounded-lg
        px-4 py-2.5
        text-sm
        font-medium
        transition-all duration-300
        ${
          active
            ? "bg-[#F5C400] text-black shadow-[0_5px_15px_rgba(245,196,0,0.12)]"
            : "bg-[#191919] text-[#777] hover:bg-[#222] hover:text-white"
        }
      `}
    >
      {label}
    </button>
  )
}

function WorkstationCard({ station }) {
  const status = getStatusInfo(station.status)

  return (
    <div
      className="
        group
        relative overflow-hidden
        rounded-2xl
        border border-[#222]
        bg-[#111]
        p-5
        shadow-[8px_8px_25px_rgba(0,0,0,0.35),-5px_-5px_20px_rgba(255,255,255,0.015)]
        transition-all duration-300
        hover:-translate-y-1
        hover:border-[#F5C400]/30
        hover:shadow-[0_15px_35px_rgba(245,196,0,0.07)]
      "
    >
      {/* Yellow glow */}
      <div
        className="
          pointer-events-none
          absolute -right-16 -top-16
          h-32 w-32
          rounded-full
          bg-[#F5C400]/5
          blur-3xl
          transition-all duration-500
          group-hover:bg-[#F5C400]/10
        "
      />

      {/* Top */}
      <div className="relative flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="
              flex h-11 w-11
              items-center justify-center
              rounded-xl
              bg-[#1A1A1A]
              text-[#F5C400]
              transition-all duration-300
              group-hover:bg-[#F5C400]
              group-hover:text-black
            "
          >
            <Monitor size={21} />
          </div>

          <div>
            <h3 className="font-semibold text-white">
              {station.name}
            </h3>

            <p className="text-xs text-[#666]">
              {station.id}
            </p>
          </div>
        </div>

        <button
          className="
            rounded-lg
            p-2
            text-[#555]
            transition-all duration-200
            hover:bg-[#222]
            hover:text-white
          "
        >
          <MoreVertical size={18} />
        </button>
      </div>

      {/* Type */}
      <div className="mt-6">
        <p className="text-xs uppercase tracking-wider text-[#555]">
          Type
        </p>

        <p className="mt-1 text-sm text-[#CCC]">
          {station.type}
        </p>
      </div>

      {/* Status */}
      <div className="mt-5">
        <span
          className={`
            inline-flex items-center gap-2
            rounded-full
            px-3 py-1.5
            text-xs font-medium
            ${status.badge}
          `}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${status.dot}`}
          />

          {status.label}
        </span>
      </div>

      {/* Customer/session */}
      {station.status === "occupied" ? (
        <div className="mt-5 space-y-3 rounded-xl bg-[#0A0A0A] p-4">
          <div className="flex items-center gap-3">
            <User size={16} className="text-[#666]" />

            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#555]">
                Customer
              </p>

              <p className="mt-0.5 text-sm text-white">
                {station.customer}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Clock3 size={16} className="text-[#666]" />

            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#555]">
                Session
              </p>

              <p className="mt-0.5 font-mono text-sm text-[#F5C400]">
                {station.timeUsed}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-xl bg-[#0A0A0A] p-4">
          <p className="text-[10px] uppercase tracking-wider text-[#555]">
            Hourly Rate
          </p>

          <p className="mt-1 text-xl font-bold text-white">
            ₱{station.rate}
            <span className="ml-1 text-xs font-normal text-[#666]">
              / hour
            </span>
          </p>
        </div>
      )}

      {/* Action */}
      <button
        className="
          mt-5
          w-full
          rounded-xl
          border border-[#292929]
          bg-[#171717]
          py-3
          text-sm
          font-medium
          text-[#AAA]
          transition-all duration-300
          hover:border-[#F5C400]
          hover:bg-[#F5C400]
          hover:text-black
        "
      >
        Manage Station
      </button>
    </div>
  )
}

function getStatusInfo(status) {
  switch (status) {
    case "available":
      return {
        label: "Available",
        dot: "bg-[#F5C400]",
        badge: "bg-[#F5C400]/10 text-[#F5C400]",
      }

    case "occupied":
      return {
        label: "In Use",
        dot: "bg-red-400",
        badge: "bg-red-400/10 text-red-400",
      }

    case "maintenance":
      return {
        label: "Maintenance",
        dot: "bg-orange-400",
        badge: "bg-orange-400/10 text-orange-400",
      }

    default:
      return {
        label: "Unknown",
        dot: "bg-gray-400",
        badge: "bg-gray-400/10 text-gray-400",
      }
  }
}

export default Workstations