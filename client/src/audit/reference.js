// Display-only references from existing writer formats, not new database relationships.
const recordRules = {
  accounts: [/^account\.(?:created|deactivated):([1-9]\d{0,9})$/, 'User'],
  products: [/^product\.(?:created|updated):([1-9]\d{0,9})$/, 'Product'],
  inventory: [/^batch\.(?:created_zero_stock|metadata_updated):([1-9]\d{0,9})$/, 'Batch'],
  suppliers: [/^suppliers\.(?:created|updated):([1-9]\d{0,9})$/, 'Supplier'],
  purchase_orders: [/^orders\.(?:created|approved):([1-9]\d{0,9})$/, 'PO'],
  stock_in: [/^receiving\.(?:created|approved):([1-9]\d{0,9})$/, 'Stock-in'],
  POS: [/^sale\.paid:([1-9]\d{0,9})$/, 'Sale'],
  product_images: [/^product_image\.(?:upload_started|remove_started|saved|removed):([1-9]\d{0,9}):/, 'Product'],
};
export function auditReference(row) {
  const action = typeof row.action === 'string' ? row.action : ''
  const rule = Object.hasOwn(recordRules, row.module) ? recordRules[row.module] : null
  const match = rule?.[0].exec(action)
  if (match && Number(match[1]) <= 2147483647) return `${rule[1]} #${match[1]}`
  if (row.module === 'POS_checkout') {
    const checkout = /^checkout\.closed:([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})$/i.exec(action)
    if (checkout) return `Checkout ${checkout[1]}`
  }
  return null
}
