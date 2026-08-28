export const cardClass = "rounded-2xl border border-[#222] bg-[#111] p-5 shadow-[8px_8px_25px_rgba(0,0,0,0.3)]"

export function PageHeader({ eyebrow = "MANAGEMENT", title, description, action }) {
  return <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="mb-2 text-sm font-medium text-[#F5C400]">{eyebrow}</p><h1 className="text-4xl font-bold tracking-tight text-white">{title}</h1><p className="mt-2 text-[#777]">{description}</p></div>{action}</div>
}

export function Button({ children, onClick, secondary = false, type = "button" }) {
  return <button type={type} onClick={onClick} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all hover:-translate-y-0.5 ${secondary ? "border border-[#333] bg-[#191919] text-white hover:border-[#F5C400]/50" : "bg-[#F5C400] text-black hover:bg-[#FFD83D]"}`}>{children}</button>
}

export function Status({ children }) { return <span className="rounded-full bg-[#F5C400]/10 px-2.5 py-1 text-xs font-semibold text-[#F5C400]">{children}</span> }

export function Field({ label, children }) { return <label className="block text-sm text-[#888]"><span className="mb-2 block text-xs uppercase tracking-wider text-[#666]">{label}</span>{children}</label> }

export const inputClass = "w-full rounded-xl border border-[#292929] bg-[#0A0A0A] px-3 py-3 text-sm text-white outline-none placeholder:text-[#555] focus:border-[#F5C400]"

export function Modal({ title, children, onClose }) { return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4"><div className="w-full max-w-md rounded-2xl border border-[#333] bg-[#111] p-6 shadow-2xl"><div className="mb-6 flex items-center justify-between"><h2 className="text-xl font-semibold text-white">{title}</h2><button onClick={onClose} className="text-2xl text-[#777] hover:text-white" aria-label="Close">×</button></div>{children}</div></div> }