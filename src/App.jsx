import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom"
import { useMemo, useState } from "react"
import { Eye, EyeOff } from "lucide-react"

import Sidebar from "./components/Sidebar"
import { useAuth } from "./context/useAuth"

import Dashboard from "./pages/Dashboard"
import LandingPage from "./pages/LandingPage"
import Subscribe from "./pages/Subscribe"
import Checkout from "./pages/Checkout"
import Workstations from "./pages/Workstations"
import Transactions from "./pages/Transactions"
import Customers from "./pages/Customers"
import ProductsServices from "./pages/ProductsServices"
import Reports from "./pages/Reports"
import Settings from "./pages/Settings"
import Wallet from "./pages/Wallet"
import Content from "./pages/Content"
import StaffPurchase from "./pages/StaffPurchase"
import NFCCards from "./pages/NFCCards"
import { BusinessProvider } from "./businessData"

function App() {
  return (
    <BusinessProvider>
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </BusinessProvider>
  )
}

const ROLE_PATHS = {
  OWNER: [
    "/",
    "/workstations",
    "/transactions",
    "/customers",
    "/products-services",
      "/nfc-cards",
    "/reports",
    "/wallet",
    "/settings",
    "/content",
    "/staff-purchase",
  ],

  MANAGER: [
    "/",
    "/workstations",
    "/transactions",
    "/customers",
    "/products-services",
    "/nfc-cards",
    "/reports",
    "/wallet",
    "/content",
    "/staff-purchase",
  ],

  CASHIER: [
    "/transactions",
    "/customers",
    "/wallet",
    "/nfc-cards",
    "/staff-purchase",
  ],

  STAFF: [
    "/transactions",
    "/nfc-cards",
    "/staff-purchase",
  ],
}

function AppLayout() {
  const {
    user,
    profile,
    memberships,
    loading,
    isAuthenticated,
    signIn,
    registerBusiness,
    signOut,
    changePassword,
  } = useAuth()

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedMembership, setSelectedMembership] = useState(null)

  const location = useLocation()
  const navigate = useNavigate()

  const publicPaths = new Set([
    "/",
    "/welcome",
    "/login",
    "/subscribe",
    "/checkout",
  ])

  const activeMemberships = useMemo(
    () =>
      memberships.filter(
        (membership) =>
          membership.status === "ACTIVE" &&
          membership.businesses,
      ),
    [memberships],
  )

  const currentMembership =
    selectedMembership ||
    (activeMemberships.length === 1
      ? activeMemberships[0]
      : null)

  const currentUser = useMemo(() => {
    if (
      !isAuthenticated ||
      !user ||
      !profile ||
      !currentMembership
    ) {
      return null
    }

    return {
      id: user.id,

      name: profile.full_name || profile.email || user.email,

      email: profile.email || user.email,

      // IMPORTANT:
      // Business Web role comes from business_members.role
      role: currentMembership.role,

      business: currentMembership.businesses,
    }
  }, [
    currentMembership,
    isAuthenticated,
    profile,
    user,
  ])

  const userRolePaths = useMemo(
    () =>
      currentUser
        ? ROLE_PATHS[currentUser.role] || ["/"]
        : [],
    [currentUser],
  )

  /*
   * Wait for Supabase Auth to determine whether
   * there is an existing session.
   */
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080808] p-5 text-white">
        Loading BuzzTap...
      </main>
    )
  }

  /*
   * No authenticated business user.
   * Allow only public routes.
   */
  if (!currentUser) {
    if (publicPaths.has(location.pathname)) {
      return (
        <Routes>
          <Route
            path="/"
            element={<LandingPage />}
          />

          <Route
            path="/welcome"
            element={<LandingPage />}
          />

          <Route
            path="/login"
            element={
              <Login
                signIn={signIn}
                onLogin={(membership) => {
                  setSelectedMembership(membership)
                  navigate("/")
                }}
              />
            }
          />

          <Route
            path="/subscribe"
            element={<Subscribe registerBusiness={registerBusiness} />}
          />

          <Route
            path="/checkout"
            element={<Checkout />}
          />

          <Route
            path="*"
            element={<Navigate to="/" replace />}
          />
        </Routes>
      )
    }

    return (
      <Navigate
        to="/"
        replace
      />
    )
  }

  /*
   * Authenticated users should not return
   * to public authentication/subscription pages.
   */
  if (
    [
      "/login",
      "/welcome",
      "/subscribe",
      "/checkout",
    ].includes(location.pathname)
  ) {
    return (
      <Navigate
        to="/"
        replace
      />
    )
  }

  /*
   * Make sure the authenticated user's
   * business role can access the requested path.
   */
  if (
    userRolePaths.length &&
    !userRolePaths.includes(location.pathname)
  ) {
    return (
      <Navigate
        to={userRolePaths[0]}
        replace
      />
    )
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#080808] text-white">
      <Sidebar
        currentUser={currentUser}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        onLogout={async () => {
          const result = await signOut()

          if (result?.success !== false) {
            setSelectedMembership(null)
            navigate("/login")
          }
        }}
      />

      <main
        className={`min-h-screen transition-[margin] duration-300 ease-in-out ${
          sidebarOpen
            ? "ml-64"
            : "ml-[76px]"
        }`}
      >
        <div className="p-5 sm:p-8">
          <Routes>
            <Route
              path="/"
              element={<Dashboard />}
            />

            <Route
              path="/wallet"
              element={
                <ProtectedRoute
                  allowedRoles={[
                    "OWNER",
                    "MANAGER",
                    "CASHIER",
                    "STAFF",
                  ]}
                  currentUser={currentUser}
                >
                  <Wallet />
                </ProtectedRoute>
              }
            />

            <Route
              path="/workstations"
              element={
                <ProtectedRoute
                  allowedRoles={[
                    "OWNER",
                    "MANAGER",
                  ]}
                  currentUser={currentUser}
                >
                  <Workstations />
                </ProtectedRoute>
              }
            />

            <Route
              path="/transactions"
              element={
                <ProtectedRoute
                  allowedRoles={[
                    "OWNER",
                    "MANAGER",
                    "CASHIER",
                    "STAFF",
                  ]}
                  currentUser={currentUser}
                >
                  <Transactions />
                </ProtectedRoute>
              }
            />

            <Route
              path="/customers"
              element={
                <ProtectedRoute
                  allowedRoles={[
                    "OWNER",
                    "MANAGER",
                    "CASHIER",
                  ]}
                  currentUser={currentUser}
                >
                  <Customers />
                </ProtectedRoute>
              }
            />

            <Route
              path="/products-services"
              element={
                <ProtectedRoute
                  allowedRoles={[
                    "OWNER",
                    "MANAGER",
                  ]}
                  currentUser={currentUser}
                >
                  <ProductsServices />
                </ProtectedRoute>
              }
            />

              <Route
                path="/nfc-cards"
                element={
                  <ProtectedRoute
                    allowedRoles={["OWNER", "MANAGER", "CASHIER", "STAFF"]}
                    currentUser={currentUser}
                  >
                    <NFCCards />
                  </ProtectedRoute>
                }
              />

            <Route
              path="/reports"
              element={
                <ProtectedRoute
                  allowedRoles={[
                    "OWNER",
                    "MANAGER",
                  ]}
                  currentUser={currentUser}
                >
                  <Reports />
                </ProtectedRoute>
              }
            />

            <Route
              path="/settings"
              element={
                <ProtectedRoute
                  allowedRoles={["OWNER"]}
                  currentUser={currentUser}
                >
                  <Settings changePassword={changePassword} />
                </ProtectedRoute>
              }
            />

            <Route
              path="/content"
              element={
                <ProtectedRoute
                  allowedRoles={[
                    "OWNER",
                    "MANAGER",
                  ]}
                  currentUser={currentUser}
                >
                  <Content />
                </ProtectedRoute>
              }
            />

            <Route
              path="/staff-purchase"
              element={
                <ProtectedRoute
                  allowedRoles={[
                    "OWNER",
                    "MANAGER",
                    "CASHIER",
                    "STAFF",
                  ]}
                  currentUser={currentUser}
                >
                  <StaffPurchase />
                </ProtectedRoute>
              }
            />

            <Route
              path="*"
              element={<Navigate to="/" replace />}
            />
          </Routes>
        </div>
      </main>
    </div>
  )
}

function ProtectedRoute({
  allowedRoles,
  children,
  currentUser,
}) {
  const location = useLocation()

  if (!currentUser) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    )
  }

  if (!allowedRoles.includes(currentUser.role)) {
    return (
      <Navigate
        to="/"
        replace
      />
    )
  }

  return children
}

function Login({ signIn, onLogin }) {
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()

    const form = new FormData(event.currentTarget)

    const businessName = String(
      form.get("businessName") || "",
    ).trim()

    const email = String(
      form.get("user") || "",
    ).trim()

    const password = String(
      form.get("password") || "",
    )

    try {
      const result = await signIn(
        email,
        password,
      )

      if (!result.success) {
        const message =
          result.error?.message?.toLowerCase() || ""

        if (
          message.includes("invalid login") ||
          message.includes("invalid credentials")
        ) {
          setError("Invalid email or password.")
        } else if (message.includes("json object requested")) {
          setError(
            "This account is missing its BuzzTap profile. Run the backfill migration in Supabase, then try again.",
          )
        } else if (message.includes("row-level security")) {
          setError(
            "Supabase blocked access to your profile. Confirm the RLS read migration was run.",
          )
        } else if (!result.profile) {
          setError(
            "Your BuzzTap profile could not be loaded.",
          )
        } else if (
          !result.memberships ||
          result.memberships.length === 0
        ) {
          setError(
            "Your account is not associated with an active BuzzTap business.",
          )
        } else {
          setError(
            "Something went wrong while signing in. Please try again.",
          )
        }

        return
      }

      const freshMemberships =
        result.memberships || []

      if (!result.profile) {
        setError(
          "Your BuzzTap profile could not be loaded.",
        )
        return
      }

      if (freshMemberships.length === 0) {
        setError(
          "Your account is not associated with an active BuzzTap business.",
        )
        return
      }

      const membership =
        freshMemberships.find(
          (item) =>
            item.businesses?.name
              ?.trim()
              .toLowerCase() ===
            businessName
              .trim()
              .toLowerCase(),
        )

      if (!membership) {
        setError(
          "The selected business is not available for this account.",
        )
        return
      }

      setError("")
      onLogin(membership)
    } catch (error) {
      console.error(
        "Business login failed:",
        error,
      )

      setError(
        "Something went wrong while signing in. Please try again.",
      )
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080808] p-5 text-white">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-[#242424] bg-[#111] p-8 shadow-2xl"
      >
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F5C400] text-xl font-black text-black">
            B
          </div>

          <div>
            <p className="font-bold">
              BuzzTap
            </p>

            <p className="text-xs text-[#777]">
              Business Management
            </p>
          </div>
        </div>

        <p className="mb-2 text-sm font-medium text-[#F5C400]">
          BUSINESS PORTAL
        </p>

        <h1 className="text-3xl font-bold">
          Welcome back
        </h1>

        <p className="mt-2 text-sm text-[#777]">
          Sign in to your business dashboard.
        </p>

        <label className="mt-7 block text-sm text-[#888]">
          Business Name

          <input
            className="mt-2 w-full rounded-xl border border-[#292929] bg-[#0A0A0A] px-4 py-3 text-white outline-none focus:border-[#F5C400]"
            name="businessName"
            type="text"
            required
          />
        </label>

        <label className="mt-4 block text-sm text-[#888]">
          User

          <input
            className="mt-2 w-full rounded-xl border border-[#292929] bg-[#0A0A0A] px-4 py-3 text-white outline-none focus:border-[#F5C400]"
            name="user"
            type="email"
            required
            autoComplete="email"
          />
        </label>

        <label className="mt-4 block text-sm text-[#888]">
          Password

          <div className="relative mt-2">
            <input
              className="w-full rounded-xl border border-[#292929] bg-[#0A0A0A] px-4 py-3 pr-12 text-white outline-none focus:border-[#F5C400]"
              name="password"
              type={
                showPassword
                  ? "text"
                  : "password"
              }
              required
              autoComplete="current-password"
            />

            <button
              type="button"
              onClick={() =>
                setShowPassword(
                  (current) => !current,
                )
              }
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[#777] hover:bg-[#222] hover:text-white"
              aria-label={
                showPassword
                  ? "Hide password"
                  : "Show password"
              }
              title={
                showPassword
                  ? "Hide password"
                  : "Show password"
              }
            >
              {showPassword ? (
                <EyeOff size={17} />
              ) : (
                <Eye size={17} />
              )}
            </button>
          </div>
        </label>

        {error && (
          <p className="mt-3 text-sm text-red-400">
            {error}
          </p>
        )}

        <button
          className="mt-6 w-full rounded-xl bg-[#F5C400] px-4 py-3 font-semibold text-black hover:bg-[#FFD83D]"
          type="submit"
        >
          Log in
        </button>
      </form>
    </main>
  )
}

export default App