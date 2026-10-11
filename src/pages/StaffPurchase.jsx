import { useState } from "react"
import { Package, Plus, Minus } from "lucide-react"
import { useBusiness } from "../businessContext"
import { Button, Field, Modal, PageHeader, Status, cardClass, inputClass } from "../components/BusinessUI"

export default function StaffPurchase() {
  const { products, customers, inventoryMovements, checkoutProduct, dataLoading, dataError } = useBusiness()
  const [selected, setSelected] = useState("")
  const [quantity, setQuantity] = useState(1)
  const [notice, setNotice] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [checkout, setCheckout] = useState(null)
  const [customerType, setCustomerType] = useState("ACCOUNT")
  const [paymentMethod, setPaymentMethod] = useState("CASH")
  const [checkoutError, setCheckoutError] = useState("")
  const [requestId, setRequestId] = useState(() => crypto.randomUUID())
  const changeRequest = () => setRequestId(crypto.randomUUID())

  const activeProducts = products.filter((item) => item.status === "ACTIVE" && (item.item_type || "PRODUCT") === "PRODUCT")
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
    setCheckout({ ...selectedProduct, quantity })
    setCustomerType("ACCOUNT")
    setPaymentMethod("CASH")
    setCheckoutError("")
    changeRequest()
  }

  const pay = async (event) => {
    event.preventDefault()
    if (submitting) return
    const form = new FormData(event.currentTarget)
    setSubmitting(true)
    setCheckoutError("")
    try {
      const result = await checkoutProduct({ productId: checkout.id, quantity: checkout.quantity,
        customerId: customerType === "ACCOUNT" ? form.get("customerId") : null,
        guestName: customerType === "LOCAL" ? form.get("guestName").trim() : null,
        paymentMethod, cashAmount: paymentMethod === "CASH" ? Number(form.get("cashAmount")) : null, requestId })
      if (result.success) {
        setNotice(`${checkout.quantity} × ${checkout.name} purchased by ${paymentMethod === "CASH" ? "cash" : "BuzzPoints"}.`)
        setCheckout(null)
        setQuantity(1)
      } else setCheckoutError(result.error)
    } catch { setCheckoutError("Purchase could not be confirmed. Retry with the same details.") }
    finally { setSubmitting(false) }
  }

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader eyebrow="STAFF ACCESS" title="Product Purchase" description="Sell products to BuzzTap account customers or local customers." />
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
          <h2 className="mb-5 text-xl font-semibold text-white">Purchase details</h2>
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
              <p className="rounded-2xl border border-[#242424] bg-[#181818] p-4 text-sm text-[#AAA]">BuzzPoints total: {selectedProduct.price * quantity} BP. Choose the customer and payment method at checkout.</p>
              <Button type="submit" disabled={submitting || !selectedProduct.stock}><Plus size={17} />Continue to checkout</Button>
            </form>
          )}
        </section>
      </div>

      {checkout && <Modal title={`Purchase · ${checkout.name}`} onClose={() => { if (!submitting) setCheckout(null) }}><form onSubmit={pay} className="space-y-4" onChange={changeRequest}>
        <p className="text-sm text-[#AAA]">{checkout.quantity} units · {checkout.price * checkout.quantity} BP</p>
        <Field label="Customer type"><select className={inputClass} value={customerType} disabled={submitting} onChange={(event) => { setCustomerType(event.target.value); setPaymentMethod("CASH") }}><option value="ACCOUNT">BuzzTap account customer</option><option value="LOCAL">Local customer (no BuzzTap account)</option></select></Field>
        {customerType === "ACCOUNT" ? <Field label="Customer account"><select className={inputClass} name="customerId" required defaultValue="" disabled={submitting}><option value="" disabled>Select customer</option>{customers.filter((item) => item.status === "ACTIVE" && item.profileStatus === "ACTIVE" && item.profile_id).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.email} · {item.wallet ?? 0} BP</option>)}</select><p className="mt-2 text-xs text-[#AAA]">Register the account on the Customers page if it is not listed.</p></Field> : <Field label="Customer name"><input className={inputClass} name="guestName" required maxLength={160} disabled={submitting} placeholder="Local customer name" /></Field>}
        <Field label="Payment method"><select className={inputClass} value={paymentMethod} disabled={submitting} onChange={(event) => setPaymentMethod(event.target.value)}><option value="CASH">Cash</option>{customerType === "ACCOUNT" && <option value="BUZZPOINTS">BuzzPoints</option>}</select></Field>
        {paymentMethod === "CASH" ? <Field label="Total cash sale amount"><input className={inputClass} name="cashAmount" type="number" min="0.01" step="0.01" required disabled={submitting} placeholder="Enter total cash amount" /><p className="mt-2 text-xs text-[#AAA]">Enter the cash price for all selected units. The catalog price is in BP.</p></Field> : <p className="text-sm text-[#AAA]">{checkout.price * checkout.quantity} BP will be deducted from the customer's shared wallet.</p>}
        {customerType === "LOCAL" && <p className="text-xs text-[#AAA]">Local customers can pay with cash only.</p>}
        {checkoutError && <p role="alert" className="text-sm text-red-300">{checkoutError}</p>}
        <div className="flex gap-3"><Button secondary disabled={submitting} onClick={() => setCheckout(null)}>Cancel</Button><Button type="submit" disabled={submitting}>{submitting ? "Processing…" : "Confirm Purchase"}</Button></div>
      </form></Modal>}
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
