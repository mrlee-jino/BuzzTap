import { useState } from "react"
import {
  ArrowRight,
  BarChart3,
  ChevronDown,
  CreditCard,
  LayoutDashboard,
  Monitor,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react"

const faqs = [
  {
    question: "What is BuzzTap?",
    answer:
      "BuzzTap is a modern business platform that connects workstations, customer experiences, NFC interactions, rewards, and operations in one system.",
  },
  {
    question: "Who is BuzzTap for?",
    answer:
      "It is designed for service businesses, gaming spaces, cafés, kiosks, and any operation that needs a smoother customer and staff experience.",
  },
  {
    question: "How does NFC work with BuzzTap?",
    answer:
      "Businesses can link customer actions, access points, and rewards to NFC-based experiences for faster check-ins, interactions, and recognition.",
  },
  {
    question: "What are BuzzPoints?",
    answer:
      "BuzzPoints are digital rewards that businesses can issue, track, and redeem through the platform to encourage repeat visits and engagement.",
  },
  {
    question: "Can my business use BuzzTap?",
    answer:
      "Yes. The platform is built to support product, service, operations, and customer engagement workflows for growing businesses.",
  },
  {
    question: "How do I get started?",
    answer:
      "Choose a plan, configure your business setup, connect your workflow, and start moving customers through a smarter experience.",
  },
]

const plans = [
  {
    name: "Starter",
    price: "Coming Soon",
    description: "For businesses beginning to modernize their customer journey.",
    features: ["Checkout and wallet basics", "Workstation visibility", "Business essentials"],
    accent: false,
  },
  {
    name: "Business",
    price: "Coming Soon",
    description: "For growing operations that need more visibility and control.",
    features: ["Advanced customer flows", "Product and service tracking", "Staff access and reporting"],
    accent: true,
  },
  {
    name: "Enterprise",
    price: "Coming Soon",
    description: "For multi-location or high-volume businesses with custom needs.",
    features: ["Custom workflows", "Expanded admin controls", "Priority onboarding support"],
    accent: false,
  },
]

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState(0)

  return (
    <main className="min-h-[100dvh] overflow-x-hidden bg-[#f4f1ea] text-[#111111]">
      <div className="mx-auto w-full max-w-[1500px] px-4 pb-16 pt-5 sm:px-6 lg:px-8">
        <header className="sticky top-0 z-40 mb-8 rounded-full border border-[#141414]/10 bg-[#f4f1ea]/85 px-4 py-3 backdrop-blur-xl sm:px-6">
          <nav className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFD400] font-black text-[#111111] shadow-[0_10px_30px_rgba(255,212,0,0.3)]">
                B
              </div>
              <div>
                <p className="text-base font-semibold tracking-[-0.04em] text-[#111111]">BuzzTap</p>
                <p className="text-[9px] uppercase tracking-[0.22em] text-[#5f5f5f]">Business Platform</p>
              </div>
            </div>

            <div className="hidden items-center gap-8 text-sm text-[#2b2b2b] md:flex">
              <a href="#about" className="transition hover:text-[#111111]">What is BuzzTap?</a>
              <a href="#solutions" className="transition hover:text-[#111111]">Solutions</a>
              <a href="#how-it-works" className="transition hover:text-[#111111]">How It Works</a>
              <a href="#businesses" className="transition hover:text-[#111111]">For Businesses</a>
              <a href="#pricing" className="transition hover:text-[#111111]">Pricing</a>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <a href="/login" className="rounded-full border border-[#222222]/15 px-3 py-2 text-sm font-medium text-[#111111] transition hover:border-[#222222] sm:px-4">
                Sign In
              </a>
              <a href="/subscribe" className="rounded-full bg-[#FFD400] px-3 py-2 text-sm font-semibold text-[#111111] shadow-[0_12px_30px_rgba(255,212,0,0.2)] transition hover:-translate-y-0.5 sm:px-4">
                Get Started
              </a>
            </div>
          </nav>
        </header>

        <section className="relative overflow-hidden rounded-[32px] border border-[#171717]/10 bg-[#f8f5f0] px-4 pb-10 pt-8 sm:px-6 lg:px-10 lg:pb-14 lg:pt-12">
          <div className="absolute left-1/2 top-16 h-72 w-72 -translate-x-1/2 rounded-full bg-[#FFD400]/20 blur-3xl" aria-hidden="true" />

          <div className="relative grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
            <div className="max-w-[760px]">
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.35em] text-[#6f6200]">BuzzTap ecosystem</p>
              <h1 className="text-[clamp(3.3rem,7vw,8rem)] font-semibold leading-[0.9] tracking-[-0.08em] text-[#111111]">
                One tap can move your business forward.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-[#4d4d4d] sm:text-xl">
                BuzzTap connects businesses and customers through smarter digital experiences, NFC technology, business tools, and the BuzzPoint ecosystem.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <a href="/subscribe" className="inline-flex items-center gap-2 rounded-full bg-[#FFD400] px-6 py-3 text-sm font-semibold text-[#111111] shadow-[0_18px_40px_rgba(255,212,0,0.28)] transition hover:-translate-y-0.5">
                  Get Started <ArrowRight size={16} />
                </a>
                <a href="/login" className="inline-flex items-center gap-2 rounded-full border border-[#111111]/15 bg-white px-6 py-3 text-sm font-semibold text-[#111111] transition hover:border-[#111111]">
                  Sign In
                </a>
              </div>

              <p className="mt-5 text-sm text-[#5f5f5f]">Built for businesses ready to move smarter.</p>
            </div>

            <div className="relative mx-auto w-full max-w-[560px]">
              <div className="rounded-[32px] border border-[#1a1a1a]/10 bg-[#f9f6f1] p-4 shadow-[0_30px_70px_rgba(0,0,0,0.08)] sm:p-6">
                <div className="rounded-[26px] border border-[#111111]/10 bg-[#111111] p-4 text-white sm:p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full bg-[#FFD400]" />
                      <div className="h-2.5 w-2.5 rounded-full bg-white/60" />
                      <div className="h-2.5 w-2.5 rounded-full bg-white/30" />
                    </div>
                    <div className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-[#ddd]">
                      BuzzTap Business
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.22em] text-[#b5b5b5]">
                          <span>Workstations</span>
                          <span className="text-[#FFD400]">Live</span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between rounded-xl bg-[#1a1a1a] px-2.5 py-2 text-sm">
                            <span>Station 01</span>
                            <span className="text-[#98f7ac]">Active</span>
                          </div>
                          <div className="flex items-center justify-between rounded-xl bg-[#1a1a1a] px-2.5 py-2 text-sm">
                            <span>Station 02</span>
                            <span className="text-[#FFD400]">Ready</span>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.22em] text-[#b5b5b5]">
                          <span>Transactions</span>
                          <span className="text-[#FFD400]">+420</span>
                        </div>
                        <div className="flex items-end justify-between gap-3">
                          <div className="flex-1 space-y-2">
                            <div className="h-8 rounded-md bg-[#FFD400]/25" />
                            <div className="h-12 rounded-md bg-[#FFD400]/45" />
                            <div className="h-10 rounded-md bg-[#FFD400]/30" />
                          </div>
                          <div className="text-right text-lg font-semibold">
                            <div className="text-[#FFD400]">₱18.2k</div>
                            <div className="text-xs uppercase text-[#b5b5b5]">Volume</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-2xl border border-white/10 bg-[#171717] p-3">
                        <div className="mb-2 text-[10px] uppercase tracking-[0.22em] text-[#b5b5b5]">BuzzPoints</div>
                        <p className="text-3xl font-semibold tracking-[-0.06em] text-[#FFD400]">12,480</p>
                        <p className="mt-2 text-sm text-[#d6d6d6]">Issued this month</p>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-[#171717] p-3">
                        <div className="mb-2 text-[10px] uppercase tracking-[0.22em] text-[#b5b5b5]">Customer</div>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">Jordan Reyes</p>
                            <p className="text-xs text-[#b5b5b5]">VIP Member</p>
                          </div>
                          <div className="rounded-full bg-[#FFD400] px-2 py-1 text-[10px] font-semibold uppercase text-[#111111]">+50</div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-[#FFD400]/40 bg-[#FFD400]/10 p-3 text-xs uppercase tracking-[0.2em] text-[#f3d855]">
                        NFC Ready
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="absolute -left-2 top-10 rounded-full border border-[#111111]/10 bg-white px-4 py-2 text-sm font-medium text-[#111111] shadow-lg shadow-[#000000]/5">
                Payment Complete
              </div>
              <div className="absolute -right-4 bottom-8 rounded-full border border-[#111111]/10 bg-white px-4 py-2 text-sm font-medium text-[#111111] shadow-lg shadow-[#000000]/5">
                Customer Connected
              </div>
            </div>
          </div>
        </section>

        <section id="about" className="mx-auto max-w-[1200px] py-24">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#6f6200]">Built for momentum</p>
              <h2 className="mt-4 text-[clamp(2.5rem,4vw,5rem)] font-semibold leading-[0.96] tracking-[-0.07em] text-[#111111]">
                Solutions built around the way your business moves.
              </h2>
            </div>
            <div className="max-w-[620px]">
              <p className="text-lg leading-8 text-[#3f3f3f]">
                From workstations and wallet activity to customer interactions and rewards, BuzzTap gives businesses a clearer view of what is happening in real time.
              </p>
              <a href="/subscribe" className="mt-6 inline-flex items-center gap-2 text-base font-semibold text-[#111111]">
                Explore BuzzTap <ArrowRight size={16} />
              </a>
            </div>
          </div>
        </section>

        <section id="solutions" className="space-y-24 py-8">
          <article className="grid items-center gap-8 border-t border-[#181818]/10 pt-12 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#6f6200]">Workstations</p>
              <h3 className="mt-5 text-[clamp(2.3rem,4vw,4.5rem)] font-semibold leading-[0.98] tracking-[-0.07em] text-[#111111]">
                Smarter workstations.<br />Less friction.
              </h3>
              <p className="mt-5 max-w-md text-lg leading-8 text-[#4d4d4d]">
                Manage workstation availability, customer sessions, and staff flow without creating extra friction for the team.
              </p>
              <a href="/login" className="mt-6 inline-flex items-center gap-2 text-base font-semibold text-[#111111]">
                Explore Workstations <ArrowRight size={16} />
              </a>
            </div>

            <div className="rounded-[30px] border border-[#171717]/10 bg-[#ffffff] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.06)] sm:p-6">
              <div className="rounded-[24px] bg-[#111111] p-4 text-white sm:p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-[#c6c6c6]">
                    <Monitor size={14} /> Station board
                  </div>
                  <span className="rounded-full bg-[#FFD400] px-2 py-1 text-[10px] font-semibold uppercase text-[#111111]">
                    Live
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    ["Station 01", "Open"],
                    ["Station 02", "Busy"],
                    ["Station 03", "Ready"],
                  ].map(([name, status], index) => (
                    <div key={name} className={`rounded-2xl border p-3 ${index === 2 ? "border-[#FFD400]/50 bg-[#FFD400]/10" : "border-white/10 bg-white/5"}`}>
                      <div className="mb-3 text-xs uppercase tracking-[0.2em] text-[#b9b9b9]">{name}</div>
                      <div className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${index === 0 ? "bg-[#98f7ac] text-[#12351d]" : index === 1 ? "bg-[#FFD400] text-[#111111]" : "bg-white text-[#111111]"}`}>
                        {status}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </article>

          <article className="grid items-center gap-8 border-t border-[#181818]/10 pt-12 lg:grid-cols-[1.08fr_0.92fr]">
            <div className="order-2 rounded-[30px] border border-[#171717]/10 bg-[#fffdf9] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.06)] sm:p-6 lg:order-1">
              <div className="rounded-[24px] bg-[#f1ead8] p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-[#555]">
                    <CreditCard size={14} /> NFC tap
                  </div>
                  <span className="rounded-full bg-[#111111] px-2 py-1 text-[10px] font-semibold uppercase text-[#f0f0f0]">
                    Ready
                  </span>
                </div>

                <div className="mx-auto flex h-52 w-36 items-center justify-center rounded-[2rem] border-[10px] border-[#111111] bg-[#f8f6ef] shadow-inner shadow-[#000000]/10">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#FFD400] text-2xl font-black text-[#111111]">
                    T
                  </div>
                </div>
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#6f6200]">NFC</p>
              <h3 className="mt-5 text-[clamp(2.3rem,4vw,4.5rem)] font-semibold leading-[0.98] tracking-[-0.07em] text-[#111111]">
                Tap into a faster<br />customer experience.
              </h3>
              <p className="mt-5 max-w-md text-lg leading-8 text-[#4d4d4d]">
                Connect NFC cards and digital interactions to your BuzzTap ecosystem for cleaner customer flows and stronger brand engagement.
              </p>
              <a href="/login" className="mt-6 inline-flex items-center gap-2 text-base font-semibold text-[#111111]">
                Explore NFC <ArrowRight size={16} />
              </a>
            </div>
          </article>

          <article className="grid items-center gap-8 border-t border-[#181818]/10 pt-12 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#6f6200]">BuzzPoints</p>
              <h3 className="mt-5 text-[clamp(2.3rem,4vw,4.5rem)] font-semibold leading-[0.98] tracking-[-0.07em] text-[#111111]">
                A digital rewards<br />ecosystem built to grow.
              </h3>
              <p className="mt-5 max-w-md text-lg leading-8 text-[#4d4d4d]">
                Manage points, wallet activity, and customer value through a controlled platform that rewards repeat engagement.
              </p>
              <a href="/login" className="mt-6 inline-flex items-center gap-2 text-base font-semibold text-[#111111]">
                Explore BuzzPoints <ArrowRight size={16} />
              </a>
            </div>

            <div className="rounded-[30px] border border-[#171717]/10 bg-[#111111] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.12)] sm:p-6">
              <div className="rounded-[24px] border border-white/10 bg-[#171717] p-4 text-white sm:p-5">
                <div className="mb-4 flex items-center justify-between text-[10px] uppercase tracking-[0.22em] text-[#b4b4b4]">
                  <span>Wallet</span>
                  <span className="text-[#FFD400]">+8.4%</span>
                </div>

                <div className="space-y-3">
                  <div className="rounded-2xl bg-white/5 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#dcdcdc]">Available balance</span>
                      <WalletCards size={16} className="text-[#FFD400]" />
                    </div>
                    <p className="mt-3 text-3xl font-semibold tracking-[-0.06em] text-[#FFD400]">₱12.4k</p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-white/5 p-3">
                      <div className="text-[10px] uppercase tracking-[0.22em] text-[#b4b4b4]">Redeemed</div>
                      <div className="mt-2 text-2xl font-semibold text-white">2,140</div>
                    </div>
                    <div className="rounded-2xl bg-white/5 p-3">
                      <div className="text-[10px] uppercase tracking-[0.22em] text-[#b4b4b4]">Issued</div>
                      <div className="mt-2 text-2xl font-semibold text-white">8,960</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </article>
        </section>

        <section id="businesses" className="py-24">
          <div className="mb-12 max-w-[720px]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#6f6200]">Designed for everyday business</p>
            <h2 className="mt-4 text-[clamp(2.3rem,4vw,5rem)] font-semibold leading-[0.96] tracking-[-0.07em] text-[#111111]">
              Built for the businesses that keep things moving.
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {[
              "Working Stations",
              "Cafés",
              "Computer Shops",
            ].map((category, index) => (
              <div
                key={category}
                className={`group rounded-[28px] border border-[#171717]/10 bg-[#f8f5f0] p-5 transition duration-300 hover:-translate-y-1 hover:border-[#111111]/25 hover:bg-white ${index === 1 ? "bg-[#111111] text-white" : ""}`}
              >
                <div className="mb-6 flex items-center justify-between">
                  <div className={`h-12 w-12 rounded-2xl ${index === 1 ? "bg-[#FFD400] text-[#111111]" : "bg-[#111111] text-[#f9f9f9]"} flex items-center justify-center font-black`}>
                    {category.charAt(0)}
                  </div>
                  <ArrowRight size={18} className={index === 1 ? "text-[#FFD400]" : "text-[#111111]"} />
                </div>
                <p className={`text-3xl font-semibold tracking-[-0.06em] ${index === 1 ? "text-white" : "text-[#111111]"}`}>
                  {category}
                </p>
                <p className={`mt-4 text-base ${index === 1 ? "text-[#d1d1d1]" : "text-[#4d4d4d]"}`}>
                  Smart operations for repeat customers, fast service, and cleaner revenue tracking.
                </p>
              </div>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="py-24">
          <div className="mb-14 max-w-[760px]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#6f6200]">How it works</p>
            <h2 className="mt-4 text-[clamp(2.3rem,4vw,5rem)] font-semibold leading-[0.96] tracking-[-0.07em] text-[#111111]">
              A simple flow built for real business movement.
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-4">
            {[
              ["01", "Connect", "Business joins BuzzTap."],
              ["02", "Configure", "Set up products, services, workstations and customers."],
              ["03", "Tap", "Customers interact through BuzzTap and NFC experiences."],
              ["04", "Grow", "Business gains visibility, engagement, and stronger operations."],
            ].map(([number, title, copy]) => (
              <div key={number} className="rounded-[28px] border border-[#171717]/10 bg-[#ffffff] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.04)]">
                <div className="mb-6 text-4xl font-semibold tracking-[-0.08em] text-[#FFD400]">{number}</div>
                <div className="mb-3 text-sm font-semibold uppercase tracking-[0.22em] text-[#4e4e4e]">{title}</div>
                <p className="text-base leading-7 text-[#4d4d4d]">{copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="py-24">
          <div className="rounded-[36px] border border-[#171717]/10 bg-[#111111] p-6 text-white shadow-[0_30px_80px_rgba(0,0,0,0.13)] sm:p-8 lg:p-10">
            <div className="mb-10 max-w-[720px]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#FFD400]">One ecosystem</p>
              <h2 className="mt-4 text-[clamp(2.3rem,4vw,5rem)] font-semibold leading-[0.95] tracking-[-0.07em] text-white">
                One ecosystem. Every side connected.
              </h2>
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              <div className="rounded-[26px] border border-white/10 bg-white/5 p-6">
                <div className="mb-3 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-[#e0d27d]">
                  <LayoutDashboard size={16} /> Business Web
                </div>
                <p className="text-lg text-[#ebebeb]">Operate your business with one complete operating view.</p>
              </div>
              <div className="rounded-[26px] border border-white/10 bg-[#FFD400] p-6 text-[#111111]">
                <div className="mb-3 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-[#111111]">
                  <Sparkles size={16} /> BuzzTap
                </div>
                <p className="text-lg font-medium">The platform where operations, rewards, engagement, and service align.</p>
              </div>
              <div className="rounded-[26px] border border-white/10 bg-white/5 p-6">
                <div className="mb-3 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-[#e0d27d]">
                  <BarChart3 size={16} /> Admin Web
                </div>
                <p className="text-lg text-[#ebebeb]">Control, monitor, and manage the systems behind the experience.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-24">
          <div className="rounded-[36px] border border-[#111111]/10 bg-[#f3eac8] p-6 text-center sm:p-10 lg:p-14">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#5e5700]">Move with purpose</p>
            <h2 className="mx-auto mt-4 max-w-[900px] text-[clamp(2.4rem,5vw,6rem)] font-semibold leading-[0.9] tracking-[-0.08em] text-[#111111]">
              Your business is moving. Your technology should move with it.
            </h2>
          </div>
        </section>

        <section id="pricing" className="py-24">
          <div className="mb-12 flex items-end justify-between gap-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#6f6200]">Pricing</p>
              <h2 className="mt-4 text-[clamp(2.3rem,4vw,5rem)] font-semibold leading-[0.96] tracking-[-0.07em] text-[#111111]">
                Choose the plan that moves with you.
              </h2>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-[30px] border p-6 ${plan.accent ? "border-[#111111] bg-[#111111] text-white shadow-[0_25px_50px_rgba(17,17,17,0.2)]" : "border-[#171717]/10 bg-[#fffdfb] text-[#111111]"}`}
              >
                <div className="mb-6 flex items-center justify-between">
                  <p className={`text-sm font-semibold uppercase tracking-[0.22em] ${plan.accent ? "text-[#FFD400]" : "text-[#4d4d4d]"}`}>
                    {plan.name}
                  </p>
                  {plan.accent && <span className="rounded-full bg-[#FFD400] px-2 py-1 text-[10px] font-bold uppercase text-[#111111]">Popular</span>}
                </div>

                <div className="mb-5 text-4xl font-semibold tracking-[-0.08em]">{plan.price}</div>
                <p className={`mb-6 text-base leading-7 ${plan.accent ? "text-[#d9d9d9]" : "text-[#4d4d4d]"}`}>
                  {plan.description}
                </p>

                <ul className={`space-y-3 border-t pt-6 text-sm ${plan.accent ? "border-white/10 text-[#efefef]" : "border-[#111111]/10 text-[#2b2b2b]"}`}>
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3">
                      <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ${plan.accent ? "bg-[#FFD400] text-[#111111]" : "bg-[#111111] text-white"}`}>
                        ✓
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>

                <a
                  href="/subscribe"
                  className={`mt-8 inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition ${plan.accent ? "bg-[#FFD400] text-[#111111] hover:brightness-110" : "border border-[#111111]/15 bg-white text-[#111111] hover:border-[#111111]"}`}
                >
                  Choose Plan
                </a>
              </div>
            ))}
          </div>
        </section>

        <section className="py-24">
          <div className="mx-auto max-w-[980px]">
            <p className="text-center text-[11px] font-semibold uppercase tracking-[0.28em] text-[#6f6200]">FAQ</p>
            <h2 className="mt-4 text-center text-[clamp(2.3rem,4vw,4.5rem)] font-semibold leading-[0.96] tracking-[-0.07em] text-[#111111]">
              Questions, answered simply.
            </h2>

            <div className="mt-12 space-y-4">
              {faqs.map((item, index) => (
                <div key={item.question} className="overflow-hidden rounded-[22px] border border-[#171717]/10 bg-[#ffffff]">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === index ? -1 : index)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left text-lg font-medium text-[#111111] sm:px-7"
                  >
                    <span>{item.question}</span>
                    <ChevronDown size={18} className={`transition-transform ${openFaq === index ? "rotate-180" : ""}`} />
                  </button>
                  {openFaq === index && <div className="px-5 pb-5 text-base leading-7 text-[#4d4d4d] sm:px-7">{item.answer}</div>}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="pb-20 pt-8">
          <div className="rounded-[36px] bg-[#111111] px-6 py-14 text-white shadow-[0_30px_90px_rgba(0,0,0,0.18)] sm:px-8 lg:px-12">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#FFD400]">Ready to begin</p>
                <h2 className="mt-4 max-w-[680px] text-[clamp(2.3rem,4vw,5rem)] font-semibold leading-[0.96] tracking-[-0.08em] text-white">
                  Ready to move your business?
                </h2>
              </div>

              <div className="flex flex-wrap gap-3">
                <a href="/subscribe" className="rounded-full bg-[#FFD400] px-6 py-3 text-sm font-semibold text-[#111111] shadow-[0_14px_30px_rgba(255,212,0,0.25)] transition hover:-translate-y-0.5">
                  Get Started
                </a>
                <a href="/login" className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white transition hover:border-white hover:bg-white hover:text-[#111111]">
                  Sign In
                </a>
              </div>
            </div>
          </div>
        </section>

        <footer className="border-t border-[#171717]/10 py-10 text-[#3d3d3d]">
          <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-[360px]">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFD400] font-black text-[#111111]">B</div>
                <div>
                  <p className="font-semibold text-[#111111]">BuzzTap</p>
                  <p className="text-[9px] uppercase tracking-[0.22em] text-[#5f5f5f]">Business Platform</p>
                </div>
              </div>
              <p className="text-sm leading-7">
                Smarter business experiences, stronger customer engagement, and better operational visibility.
              </p>
            </div>

            <div className="grid gap-8 sm:grid-cols-3">
              <div>
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-[#5f5f5f]">Product</p>
                <ul className="space-y-2 text-sm">
                  <li><a href="#about" className="hover:text-[#111111]">What is BuzzTap?</a></li>
                  <li><a href="#solutions" className="hover:text-[#111111]">Business</a></li>
                  <li><a href="/subscribe" className="hover:text-[#111111]">Pricing</a></li>
                </ul>
              </div>
              <div>
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-[#5f5f5f]">Solutions</p>
                <ul className="space-y-2 text-sm">
                  <li><a href="#solutions" className="hover:text-[#111111]">Workstations</a></li>
                  <li><a href="#solutions" className="hover:text-[#111111]">NFC</a></li>
                  <li><a href="#pricing" className="hover:text-[#111111]">BuzzPoints</a></li>
                </ul>
              </div>
              <div>
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-[#5f5f5f]">Company</p>
                <ul className="space-y-2 text-sm">
                  <li><a href="#faq" className="hover:text-[#111111]">FAQ</a></li>
                  <li><a href="/login" className="hover:text-[#111111]">Sign In</a></li>
                  <li><a href="/subscribe" className="hover:text-[#111111]">Get Started</a></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col justify-between gap-3 border-t border-[#171717]/10 pt-6 text-sm text-[#5d5d5d] sm:flex-row">
            <p>© 2026 BuzzTap. All rights reserved.</p>
            <div className="flex gap-5">
              <a href="/login" className="hover:text-[#111111]">Privacy Policy</a>
              <a href="/login" className="hover:text-[#111111]">Terms of Service</a>
            </div>
          </div>
        </footer>
      </div>
    </main>
  )
}
