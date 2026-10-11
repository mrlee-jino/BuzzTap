import { useState } from "react"
import { Package, Plus, Search, ToggleLeft } from "lucide-react"
import { useBusiness } from "../businessContext"
import { Button, Field, Modal, PageHeader, Status, cardClass, inputClass } from "../components/BusinessUI"

function ProductsServices() {
  const { products, customers, purchase, addProduct, updateProductStatus, updateProductType, restockInventory, dataLoading, dataError } = useBusiness()
  const [query, setQuery] = useState("")
  const [modal, setModal] = useState(false)
  const [itemType, setItemType] = useState("PRODUCT")
  const [restockProduct, setRestockProduct] = useState(null)
  const [notice, setNotice] = useState("")
  const [checkout, setCheckout] = useState(null)
  const [paying, setPaying] = useState(false)
  const [paymentError, setPaymentError] = useState("")
  const [purchaseRequestId, setPurchaseRequestId] = useState(() => crypto.randomUUID())
  const pay = async (event) => {
    event.preventDefault()
    if (paying) return
    const form = new FormData(event.currentTarget)
    setPaying(true)
    setPaymentError("")
    try {
      const result = await purchase({ customerId: form.get("customerId"), productId: checkout.id,
        quantity: Number(form.get("quantity")), requestId: purchaseRequestId })
      if (result.success) { setCheckout(null); setNotice("Purchase paid from the customer's shared BP wallet.") }
      else setPaymentError(result.error)
    } catch { setPaymentError("Payment could not be completed. Retry with the same details.") }
    finally { setPaying(false) }
  }
  const visible = products.filter((item) =>
    `${item.id} ${item.name} ${item.category}`.toLowerCase().includes(query.toLowerCase()),
  )

  const add = async (event) => {
    event.preventDefault()
    const data = Object.fromEntries(new FormData(event.currentTarget))
    const ok = await addProduct({ ...data, item_type: itemType, price: Number(data.price), stock: itemType === "PRODUCT" ? Number(data.stock) : 0 })
    setNotice(ok ? "Product added successfully." : "Product save failed.")
    if (ok) setModal(false)
  }

  const restock = async (event) => {
    event.preventDefault()
    const quantity = Number(new FormData(event.currentTarget).get("quantity"))
    const result = await restockInventory(restockProduct.id, quantity, "Manager stock replenishment")
    setNotice(result.success ? `${quantity} units added to ${restockProduct.name}.` : result.error)
    if (result.success) setRestockProduct(null)
  }

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHeader title="Products & Services" description="Manage your catalog, prices, availability, and product stock." action={<Button onClick={() => { setItemType("PRODUCT"); setModal(true) }}><Plus size={17} />Add Item</Button>} />
      {(notice || dataError || dataLoading) && <p role={dataError ? "alert" : "status"} className={`mb-5 rounded-xl border p-3 text-sm ${dataError ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-[#F5C400]/30 bg-[#F5C400]/10 text-[#F5C400]"}`}>{dataError ? `Database error: ${dataError}` : notice || "Loading catalog…"}</p>}
      <div className={`${cardClass} mb-6 flex items-center gap-3 p-4`}>
        <Search size={17} className="text-[#666]" />
        <input className={`${inputClass} border-0 p-0`} placeholder="Search product, category, or ID" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {visible.length ? visible.map((product) => (
          <div className={cardClass} key={product.id}>
            <div className="flex items-start justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F5C400]/10 text-[#F5C400]"><Package size={21} /></div>
              <Status>{product.status}</Status>
            </div>
            <p className="mt-6 text-xs text-[#666]">{product.id} · {product.category}</p>
            <h2 className="mt-2 text-xl font-semibold text-white">{product.name}</h2>
            <p className="mt-2 text-sm text-[#777]">{product.description}</p>
            <Field label="Item type"><select className={`${inputClass} mt-2 mb-3`} value={product.item_type || "PRODUCT"} onChange={async (event) => {
              const ok = await updateProductType(product.id, event.target.value)
              setNotice(ok ? `${product.name} item type updated.` : "Item type update failed.")
            }}><option value="PRODUCT">Product</option><option value="SERVICE">Service</option><option value="WORKSTATION">From Workstation</option></select></Field>
            {(product.item_type || "PRODUCT") === "PRODUCT" && product.status === "ACTIVE" && <Button secondary disabled={!product.stock} onClick={() => { setCheckout(product); setPurchaseRequestId(crypto.randomUUID()); setPaymentError("") }}>Customer BP Purchase</Button>}
            <div className="mt-6 flex items-center justify-between border-t border-[#242424] pt-4">
              <div>
                <span className="text-xl font-bold text-[#F5C400]">{product.price} BP</span>
                {(product.item_type || "PRODUCT") === "PRODUCT" && <p className="mt-1 text-xs text-[#777]">{product.stock} in stock</p>}
              </div>
              <div className="flex items-center gap-2">
                {(product.item_type || "PRODUCT") === "PRODUCT" && <button onClick={() => setRestockProduct(product)} disabled={product.status !== "ACTIVE"} className="rounded-lg bg-[#1d1d1d] px-3 py-2 text-xs text-[#AAA] disabled:opacity-50">Restock</button>}
                <button title="Toggle availability" onClick={async () => {
                  const ok = await updateProductStatus(product.id, product.status === "ACTIVE" ? "INACTIVE" : "ACTIVE")
                  setNotice(ok ? `${product.name} availability updated.` : "Product status update failed.")
                }} className="rounded-lg p-2 text-[#777] hover:bg-[#222] hover:text-white"><ToggleLeft size={20} /></button>
              </div>
            </div>
          </div>
        )) : <div className={`${cardClass} text-center text-sm text-[#666]`}>{dataLoading ? "Loading products…" : "No products found."}</div>}
      </div>
      {modal && <Modal title="Add Catalog Item" onClose={() => setModal(false)}><form onSubmit={add} className="space-y-4">
        <Field label="Item type"><select className={inputClass} value={itemType} onChange={(event) => setItemType(event.target.value)}><option value="PRODUCT">Product</option><option value="SERVICE">Service</option><option value="WORKSTATION">From Workstation</option></select></Field>
        <Field label="Product ID"><input className={inputClass} name="id" required placeholder="PROD-004" /></Field>
        <Field label="Product Name"><input className={inputClass} name="name" required placeholder="Gaming Session - 1 Hour" /></Field>
        <Field label="Description"><textarea className={inputClass} name="description" required rows="2" /></Field>
        <Field label="Category"><input className={inputClass} name="category" required placeholder="Gaming" /></Field>
        <Field label="Catalog Price (currently displayed in BP)"><input className={inputClass} name="price" type="number" min="0" required placeholder="50" /></Field>
        {itemType === "PRODUCT" && <Field label="Opening Stock Quantity"><input className={inputClass} name="stock" type="number" min="0" step="1" required defaultValue="0" /></Field>}
        <Button type="submit">Add Item</Button>
      </form></Modal>}
      {checkout && <Modal title={`Purchase · ${checkout.name}`} onClose={() => { if (!paying) setCheckout(null) }}><form onSubmit={pay} className="space-y-4">
        <Field label="Customer"><select className={inputClass} name="customerId" required disabled={paying} defaultValue="" onChange={() => setPurchaseRequestId(crypto.randomUUID())}><option value="" disabled>Select customer</option>{customers.filter((customer) => customer.status === "ACTIVE" && customer.profileStatus === "ACTIVE" && customer.profile_id).map((customer) => <option key={customer.id} value={customer.id}>{customer.name} · {customer.wallet ?? 0} BP</option>)}</select></Field>
        <Field label="Quantity"><input className={inputClass} name="quantity" type="number" required min="1" max={checkout.stock} step="1" defaultValue="1" disabled={paying} onChange={() => setPurchaseRequestId(crypto.randomUUID())} /></Field>
        <p className="text-sm text-[#AAA]">{checkout.price} BP per unit. Payment credits your business BP wallet.</p>
        {paymentError && <p role="alert" className="text-sm text-red-300">{paymentError}</p>}
        <Button type="submit" disabled={paying}>{paying ? "Paying…" : "Pay with Shared BuzzPoints"}</Button>
      </form></Modal>}
      {restockProduct && <Modal title={`Restock ${restockProduct.name}`} onClose={() => setRestockProduct(null)}><form onSubmit={restock} className="space-y-4">
        <p className="text-sm text-[#AAA]">Current stock: <strong className="text-white">{restockProduct.stock}</strong></p>
        <Field label="Quantity to add"><input className={inputClass} name="quantity" type="number" min="1" step="1" required autoFocus /></Field>
        <Button type="submit"><Plus size={17} />Record restock</Button>
      </form></Modal>}
    </div>
  )
}

export default ProductsServices
