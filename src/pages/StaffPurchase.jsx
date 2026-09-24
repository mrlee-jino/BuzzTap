import { useState } from "react"
import { ShoppingCart, Package, Plus, Minus } from "lucide-react"
import { useBusiness } from "../businessContext"
import { Button, PageHeader, Status, cardClass, inputClass } from "../components/BusinessUI"

export default function StaffPurchase() {
  const { products, purchaseInventory } = useBusiness()
  const [selected, setSelected] = useState(products[0]?.id || "")
  const [quantity, setQuantity] = useState(1)
  const [notice, setNotice] = useState("")

  const selectedProduct = products.find((item) => item.id === selected) || products[0]

  const submit = async (event) => {
    event.preventDefault()
    if (!selectedProduct) {
      setNotice("Inventory is unavailable until the backend is connected.")
      return
    }
    const ok = await purchaseInventory(selectedProduct.id, Number(quantity), "Staff Account")
    setNotice(ok ? `Inventory updated for ${selectedProduct.name}.` : "Inventory purchases are unavailable until the backend is connected.")
  }

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        eyebrow="STAFF ACCESS"
        title="Product Purchase"
        description="Issue stock items for business operations and staff use."
        action={<Button secondary><ShoppingCart size={17} />Track Inventory</Button>}
      />

      {notice && <p className="mb-5 rounded-xl border border-[#F5C400]/30 bg-[#F5C400]/10 p-3 text-sm text-[#F5C400]">{notice}</p>}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className={cardClass}>
          <h2 className="mb-5 text-xl font-semibold text-white">Available stock</h2>
          <div className="space-y-4">
            {products.map((product) => (
              <button
                type="button"
                key={product.id}
                onClick={() => setSelected(product.id)}
                className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition ${selected === product.id ? "border-[#F5C400] bg-[#F5C400]/5" : "border-[#242424] bg-[#181818]"}`}
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
          </div>
        </section>

        <section className={cardClass}>
          <h2 className="mb-5 text-xl font-semibold text-white">Issue purchase</h2>
          {selectedProduct && (
            <form onSubmit={submit} className="space-y-5">
              <div>
                <label className="block text-xs uppercase tracking-wider text-[#666]">Selected item</label>
                <p className="mt-2 text-lg font-semibold text-white">{selectedProduct.name}</p>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-[#666]">Quantity</label>
                <div className="mt-2 flex items-center gap-3">
                  <button type="button" onClick={() => setQuantity((current) => Math.max(1, current - 1))} className="rounded-xl border border-[#333] p-2 text-white">
                    <Minus size={16} />
                  </button>
                  <input className={`${inputClass} text-center`} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} />
                  <button type="button" onClick={() => setQuantity((current) => current + 1)} className="rounded-xl border border-[#333] p-2 text-white">
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-[#242424] bg-[#181818] p-4">
                <div className="flex items-center justify-between text-sm text-[#AAA]">
                  <span>Total</span>
                  <span className="text-lg font-semibold text-[#F5C400]">₱{(selectedProduct.price * quantity).toLocaleString()}</span>
                </div>
              </div>

              <Button type="submit"><Plus size={17} />Confirm purchase</Button>
            </form>
          )}
        </section>
      </div>
    </div>
  )
}
