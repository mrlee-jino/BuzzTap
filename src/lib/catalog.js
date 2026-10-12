export function nextProductId(products) {
  const highest = products.reduce((maximum, product) => {
    const match = /^PROD-(\d+)$/i.exec(product.id || "")
    return match ? Math.max(maximum, Number(match[1])) : maximum
  }, 0)
  return `PROD-${String(highest + 1).padStart(3, "0")}`
}

export function catalogCategories(products) {
  const categories = new Map()
  for (const product of products) {
    const category = product.category?.trim()
    if (category && !categories.has(category.toLowerCase())) {
      categories.set(category.toLowerCase(), category)
    }
  }
  return [...categories.values()].sort((a, b) => a.localeCompare(b))
}
