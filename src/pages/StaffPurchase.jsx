import { useState } from "react"
import { Package, Plus, Minus } from "lucide-react"
import { useBusiness } from "../businessContext"
import { Button, PageHeader, Status, cardClass, inputClass } from "../components/BusinessUI"

export default function StaffPurchase() {
  const { products, inventoryMovements, issueInventory, dataLoading, dataError } = useBusiness()
  const [selected, setSelected] = useState("")
  const [quantity, setQuantity] = useState(1)
  const [notice, setNotice] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const activeProducts = products.filter((item) => item.status === "ACTIVE")
  const selectedProduct = activeProducts.find((item) => item.id === selected) || activeProducts[0]

  const submit = async (event) => {
    event.preventDefault()
    if (!selectedProduct) {
      setNotice("No active products are available to issue.")
      return
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > selectedProduct.stock) {
      setNotice("Enter a whole-number quantity that does not exceed available stock.")
      return
    }
    setSubmitting(true)
    setNotice("")
    const result = await issueInventory(selectedProduct.id, quantity, "Staff inventory issue")
    setSubmitting(false)
    setNotice(result.success ? `${quantity} × ${selectedProduct.name} issued and recorded.` : result.error)
    if (result.success) setQuantity(1)
  }

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader eyebrow="STAFF ACCESS" title="Product Purchase" description="Issue stock items for business operations and staff use." />
      {(notice || dataError || dataLoading) && (
        <p role={dataError ? "alert" : "status"} className={`mb-5 rounded-xl border p-3 text-sm ${dataError ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-[#F5C400]/30 bg-[#F5C400]/10 text-[#F5C400]"}`}>
          {dataError ? `Database error: ${dataError}` : notice || "Loading inventory…"}
        </p>
      )}
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className={cardClass}>
          <h2 className="mb-5 text-xl font-semibold text-white">Available stock</h2>
          <div className="space-y-4">
            {activeProducts.map((product) => (
              <button
                type="button"
                key={product.id}
                onClick={() => setSelected(product.id)}
                className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition ${selectedProduct?.id === product.id ? "border-[#F5C400] bg-[#F5C400]/5" : "border-[#242424] bg-[#181818]"}`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F5C400]/10 text-[#F5C400]"><Package size={19} /></div>
                  <div>
                    <p className="font-semibold text-white">{product.name}</p>
                    <p className="text-xs text-[#666]">{product.id} · {product.category}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-white">{product.stock} in stock</p>
                  <Status>{product.status}</Status>
                </div>
              </button>
            ))}
            {!activeProducts.length && <p className="text-sm text-[#777]">{dataLoading ? "Loading catalog…" : "No active products are available."}</p>}
          </div>
        </section>

        <section className={cardClass}>
          <h2 className="mb-5 text-xl font-semibold text-white">Issue inventory</h2>
          {selectedProduct && (
            <form onSubmit={submit} className="space-y-5">
              <div>
                <label className="block text-xs uppercase tracking-wider text-[#666]">Selected item</label>
                <p className="mt-2 text-lg font-semibold text-white">{selectedProduct.name}</p>
                <p className="mt-1 text-sm text-[#777]">{selectedProduct.stock} currently available</p>
              </div>
              <div>
                <label htmlFor="issue-quantity" className="block text-xs uppercase tracking-wider text-[#666]">Quantity</label>
                <div className="mt-2 flex items-center gap-3">
                  <button type="button" aria-label="Decrease quantity" onClick={() => setQuantity((current) => Math.max(1, current - 1))} className="rounded-xl border border-[#333] p-2 text-white"><Minus size={16} /></button>
                  <input id="issue-quantity" className={`${inputClass} text-center`} type="number" min="1" max={selectedProduct.stock} step="1" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} />
                  <button type="button" aria-label="Increase quantity" disabled={quantity >= selectedProduct.stock} onClick={() => setQuantity((current) => Math.min(selectedProduct.stock, current + 1))} className="rounded-xl border border-[#333] p-2 text-white disabled:opacity-50"><Plus size={16} /></button>
                </div>
              </div>
              <p className="rounded-2xl border border-[#242424] bg-[#181818] p-4 text-sm text-[#AAA]">The stock adjustment and its audit record are saved together. Catalog price is not used for stock issuance.</p>
              <Button type="submit" disabled={submitting || !selectedProduct.stock}><Plus size={17} />{submitting ? "Recording…" : "Confirm issue"}</Button>
            </form>
          )}
        </section>
      </div>

      <section className={`${cardClass} mt-6`}>
        <h2 className="text-lg font-semibold text-white">Recent stock movements</h2>
        {inventoryMovements.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="border-b border-[#242424] text-xs uppercase text-[#666]"><tr><th className="px-3 py-3">Product</th><th className="px-3 py-3">Movement</th><th className="px-3 py-3">Quantity</th><th className="px-3 py-3">Operator</th><th className="px-3 py-3">Date</th></tr></thead>
              <tbody>{inventoryMovements.slice(0, 10).map((item) => (
                <tr className="border-b border-[#1d1d1d] last:border-0" key={item.id}>
                  <td className="px-3 py-3 text-white">{item.productName}</td>
                  <td className="px-3 py-3 text-[#AAA]">{item.movement_type}</td>
                  <td className="px-3 py-3 text-white">{item.movement_type === "ISSUE" ? "-" : "+"}{item.quantity}</td>
                  <td className="px-3 py-3 text-[#AAA]">{item.operatorName}</td>
                  <td className="px-3 py-3 text-[#777]">{new Date(item.created_at).toLocaleString()}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <p className="mt-3 text-sm text-[#777]">No stock issues recorded yet.</p>}
      </section>
    </div>
  )
}
