import {
  Bell,
  Building2,
  Eye,
  EyeOff,
  LockKeyhole,
  Plus,
  Save,
  Search,
  Trash2,
  UserCog,
} from "lucide-react"
import { useState } from "react"

import { useBusiness } from "../businessContext"
import {
  Button,
  Field,
  Modal,
  PageHeader,
  Status,
  cardClass,
  inputClass,
} from "../components/BusinessUI"

const requirementList = [
  ["At least 8 characters", (value) => value.length >= 8],
  ["One uppercase letter", (value) => /[A-Z]/.test(value)],
  ["One lowercase letter", (value) => /[a-z]/.test(value)],
  ["One number", (value) => /\d/.test(value)],
  ["One special character", (value) => /[^A-Za-z0-9]/.test(value)],
]

function Settings({ changePassword }) {
  const {
    business,
    profile,
    staff,
    accessLogs,
    addStaff,
    updateStaffStatus,
    deleteStaff,
  } = useBusiness()

  const [saved, setSaved] = useState(false)
  const [staffModal, setStaffModal] = useState(false)
  const [passwordModal, setPasswordModal] = useState(false)
  const [notice, setNotice] = useState("")
  const [accessQuery, setAccessQuery] = useState("")
  const [accessDay, setAccessDay] = useState("")
  const [passwords, setPasswords] = useState({
    current: "",
    next: "",
    confirm: "",
  })
  const [errors, setErrors] = useState({})
  const [visible, setVisible] = useState({
    current: false,
    next: false,
    confirm: false,
  })

  const invite = async (event) => {
    event.preventDefault()

    const result = await addStaff(
      Object.fromEntries(new FormData(event.currentTarget))
    )

    setNotice(
      result.success
        ? "Staff account created successfully."
        : result.error || "Staff invitation could not be saved."
    )

    if (result.success) {
      setStaffModal(false)
    }
  }

  const closePassword = () => {
    setPasswordModal(false)
    setPasswords({
      current: "",
      next: "",
      confirm: "",
    })
    setErrors({})
    setVisible({
      current: false,
      next: false,
      confirm: false,
    })
  }

  const validatePassword = () => {
    const nextErrors = {}

    if (!passwords.current) {
      nextErrors.current = "Current password is required."
    }

    if (!passwords.next) {
      nextErrors.next = "New password is required."
    } else if (
      !requirementList.every(([, test]) => test(passwords.next))
    ) {
      nextErrors.next = "Use all listed password requirements."
    }

    if (
      passwords.next === passwords.current &&
      passwords.next
    ) {
      nextErrors.next =
        "New password must be different from current password."
    }

    if (!passwords.confirm) {
      nextErrors.confirm = "Please confirm your new password."
    } else if (passwords.next !== passwords.confirm) {
      nextErrors.confirm = "Passwords do not match."
    }

    setErrors(nextErrors)

    return Object.keys(nextErrors).length === 0
  }

  const submitPasswordChange = async (event) => {
    event.preventDefault()

    if (!validatePassword()) {
      return
    }

    const result = await changePassword(passwords.next)
    setNotice(
      result.success
        ? "Password changed successfully."
        : result.error?.message || "Password change failed.",
    )
    if (result.success) closePassword()
  }

  const passwordField = (key, label, placeholder) => (
    <Field label={label}>
      <div className="relative">
        <input
          className={`${inputClass} pr-11`}
          name={key}
          type={visible[key] ? "text" : "password"}
          value={passwords[key]}
          onChange={(event) =>
            setPasswords((current) => ({
              ...current,
              [key]: event.target.value,
            }))
          }
          placeholder={placeholder}
          autoComplete={
            key === "current"
              ? "current-password"
              : "new-password"
          }
        />

        <button
          type="button"
          onClick={() =>
            setVisible((current) => ({
              ...current,
              [key]: !current[key],
            }))
          }
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[#777] hover:bg-[#222] hover:text-white"
          aria-label={`${
            visible[key] ? "Hide" : "Show"
          } ${label.toLowerCase()}`}
        >
          {visible[key] ? (
            <EyeOff size={17} />
          ) : (
            <Eye size={17} />
         )}
        </button>
      </div>

      {errors[key] && (
        <p className="mt-2 text-xs text-red-400">
          {errors[key]}
        </p>
     )}
    </Field>
  )

  const businessName = business?.name || ""
  const businessContact =
    business?.email ||
    business?.phone ||
    business?.address ||
    ""

  const ownerName = profile?.full_name || profile?.email || ""
  const visibleAccessLogs = accessLogs
    .filter((entry) =>
      `${entry.userEmail} ${entry.event}`
        .toLowerCase()
        .includes(accessQuery.toLowerCase()),
    )
    .filter((entry) => !accessDay || entry.occurred_at?.slice(0, 10) === accessDay)
    .sort((left, right) => new Date(right.occurred_at) - new Date(left.occurred_at))
    .slice(0, 20)

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        eyebrow="ADMINISTRATION"
        title="Settings"
        description="Manage your business profile, notifications, security, and staff access."
        action={
          <Button onClick={() => setSaved(true)}>
            <Save size={17} />
            Save Changes
          </Button>
        }
      />

      {(saved || notice) && (
        <p className="mb-5 rounded-xl border border-[#F5C400]/30 bg-[#F5C400]/10 p-3 text-sm text-[#F5C400]">
          {notice || "Business profile is currently read-only."}
        </p>
     )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* BUSINESS PROFILE */}
        <section className={cardClass}>
          <div className="mb-6 flex items-center gap-3">
            <Building2 className="text-[#F5C400]" />

            <div>
              <h2 className="font-semibold text-white">
                Business Profile
              </h2>

              <p className="text-sm text-[#666]">
                {business
                  ? `${business.business_code || "Business"} · ${
                      business.business_type || "Business"
                    }`
                  : "Business details unavailable"}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <Field label="Business Name">
              <input
                className={inputClass}
                value={businessName}
                readOnly
                placeholder="Business name unavailable"
              />
            </Field>

            <Field label="Owner">
              <input
                className={inputClass}
                value={ownerName}
                readOnly
                placeholder="Owner information unavailable"
              />
            </Field>

            <Field label="Contact Information">
              <input
                className={inputClass}
                value={businessContact}
                readOnly
                placeholder="Contact information unavailable"
              />
            </Field>
          </div>
        </section>

        {/* NOTIFICATIONS */}
        <section className={cardClass}>
          <div className="mb-6 flex items-center gap-3">
            <Bell className="text-[#F5C400]" />
            <h2 className="font-semibold text-white">
              Notifications
            </h2>
          </div>

          {[
            "Transaction alerts",
            "Settlement updates",
            "Content moderation",
            "Low BP inventory",
          ].map((label) => (
            <label
              className="flex items-center justify-between border-b border-[#242424] py-4 text-sm text-[#AAA]"
              key={label}
            >
              {label}

              <input
                type="checkbox"
                defaultChecked
                className="h-4 w-4 accent-[#F5C400]"
              />
            </label>
          ))}
        </section>

        {/* STAFF */}
        <section className={`${cardClass} lg:col-span-2`}>
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <UserCog className="text-[#F5C400]" />

              <div>
                <h2 className="font-semibold text-white">
                  Staff Accounts
                </h2>

                <p className="text-sm text-[#666]">
                  Roles control which business features each member
                  can access.
                </p>
              </div>
            </div>

            <Button onClick={() => setStaffModal(true)}>
              <Plus size={17} />
              Add Staff
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {staff.length ? (
              staff.map((member) => (
                <div
                  className="rounded-xl border border-[#242424] bg-[#0d0d0d] p-4"
                  key={member.id}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-white">
                        {member.name}
                      </p>

                      <p className="mt-1 text-xs text-[#666]">
                        {member.email}
                      </p>
                    </div>

                    <Status>{member.status}</Status>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#F5C400]">
                      {member.role}
                    </span>

                    {member.status === "ACTIVE" &&
                      member.role !== "OWNER" && (
                        <button
                          onClick={async () => await updateStaffStatus(
                              member.id,
                              "SUSPENDED"
                            )}
                          className="text-xs text-red-400"
                        >
                          Suspend
                        </button>
                     )}

                    {member.status === "SUSPENDED" && (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={async () => await updateStaffStatus(
                              member.id,
                              "ACTIVE"
                            )}
                          className="text-xs text-[#F5C400]"
                        >
                          Reactivate
                        </button>

                        <button
                          onClick={async () => {
                            if (!window.confirm(`Delete the account for ${member.email}?`)) return
                            await deleteStaff(member.id)
                          }}
                          className="inline-flex items-center gap-1 text-xs text-red-400"
                        >
                          <Trash2 size={14} />
                          Delete account
                        </button>
                      </div>
                   )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-[#666]">
                No staff accounts available.
              </p>
           )}
          </div>
        </section>

        {/* ACCESS HISTORY */}
        <section className={`${cardClass} lg:col-span-2`}>
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <UserCog className="text-[#F5C400]" />

              <div>
                <h2 className="font-semibold text-white">
                  Member Access History
                </h2>

                <p className="text-sm text-[#666]">
                  Showing up to 20 most recent events.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666]" />
                <input
                  className={`${inputClass} pl-9 sm:w-64`}
                  placeholder="Search email or event"
                  value={accessQuery}
                  onChange={(event) => setAccessQuery(event.target.value)}
                />
              </div>

              <input
                className={inputClass}
                type="date"
                value={accessDay}
                onChange={(event) => setAccessDay(event.target.value)}
                aria-label="Filter access history by day"
              />
            </div>
          </div>

          {visibleAccessLogs.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="border-b border-[#242424] text-xs uppercase tracking-wider text-[#666]">
                  <tr>
                    <th className="px-3 py-3">Email</th>
                    <th className="px-3 py-3">Event</th>
                    <th className="px-3 py-3">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleAccessLogs.map((entry) => (
                    <tr className="border-b border-[#1d1d1d] last:border-0" key={entry.id}>
                      <td className="px-3 py-3 text-white">{entry.userEmail}</td>
                      <td className="px-3 py-3">
                        <Status>{entry.event}</Status>
                      </td>
                      <td className="px-3 py-3 text-xs text-[#777]">{entry.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-[#666]">No member access history available.</p>
          )}
        </section>

        {/* SECURITY */}
        <section className={cardClass}>
          <div className="mb-4 flex items-center gap-3">
            <LockKeyhole className="text-[#F5C400]" />

            <div>
              <h2 className="font-semibold text-white">
                Security
              </h2>

              <p className="text-sm text-[#666]">
                Manage your account security.
              </p>
            </div>
          </div>

          <button
            onClick={() => setPasswordModal(true)}
            className="w-full rounded-xl border border-[#333] px-4 py-3 text-left text-sm text-[#AAA] transition hover:-translate-y-0.5 hover:border-[#F5C400]/50 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#F5C400]/40"
            aria-label="Change password"
          >
            Change password
          </button>

          <p className="mt-4 text-xs text-[#666]">
            Password changes are unavailable until backend
            security is connected.
          </p>
        </section>
      </div>

      {/* ADD STAFF MODAL */}
      {staffModal && (
        <Modal
          title="Add Staff"
          onClose={() => setStaffModal(false)}
        >
          <form
            onSubmit={invite}
            className="space-y-4"
          >
            <Field label="Full Name">
              <input
                className={inputClass}
                name="name"
                required
              />
            </Field>

            <Field label="Email">
              <input
                className={inputClass}
                name="email"
                type="email"
                required
                autoComplete="email"
              />
            </Field>

            <Field label="Phone Number">
              <input
                className={inputClass}
                name="phone"
                type="tel"
                required
                autoComplete="tel"
              />
            </Field>

            <Field label="Account Password">
              <input
                className={inputClass}
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="At least 8 characters"
              />
            </Field>

            <Field label="Role">
              <select
                className={inputClass}
                name="role"
                defaultValue="STAFF"
              >
                <option>MANAGER</option>
                <option>STAFF</option>
                <option>CASHIER</option>
              </select>
            </Field>

            <Button type="submit">
              Send Invitation
            </Button>
          </form>
        </Modal>
     )}

      {/* CHANGE PASSWORD MODAL */}
      {passwordModal && (
        <Modal
          title="Change Password"
          onClose={closePassword}
        >
          <p className="mb-6 text-sm text-[#888]">
            Update your password after backend authentication
            is connected.
          </p>

          <form
            onSubmit={submitPasswordChange}
            className="space-y-4"
          >
            {passwordField(
              "current",
              "Current Password",
              "Enter current password"
           )}

            {passwordField(
              "next",
              "New Password",
              "Enter a new password"
           )}

            <div className="rounded-xl border border-[#242424] bg-[#0d0d0d] p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#666]">
                Password requirements
              </p>

              {requirementList.map(([label, test]) => (
                <p
                  className={`text-xs ${
                    test(passwords.next)
                      ? "text-[#F5C400]"
                      : "text-[#666]"
                  }`}
                  key={label}
                >
                  {test(passwords.next) ? "✓" : "○"}{" "}
                  {label}
                </p>
              ))}
            </div>

            {passwordField(
              "confirm",
              "Confirm New Password",
              "Repeat your new password"
           )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={closePassword}
                className="rounded-xl border border-[#333] px-4 py-3 text-sm text-white"
              >
                Cancel
              </button>

              <Button type="submit">
                Change Password
              </Button>
            </div>
          </form>
        </Modal>
     )}
    </div>
  )
}

export default Settings