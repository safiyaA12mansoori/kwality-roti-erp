export const COST_ITEMS = [
  { id: 'flour', name: 'Wheat flour', unit: 'kg', qtyLabel: 'Quantity in kilos' },
  { id: 'ghee', name: 'Ghee / oil', unit: 'liter', qtyLabel: 'Quantity in liters' },
  { id: 'gas', name: 'Gas cylinder', unit: 'cylinder', qtyLabel: 'How many cylinders' },
  { id: 'electric', name: 'Electric bill', unit: 'unit', qtyLabel: 'Quantity in units' },
  { id: 'pack', name: 'Packaging', unit: 'packet', qtyLabel: 'How many packets' },
  { id: 'transport', name: 'Transport', unit: 'trip', qtyLabel: 'How many trips' },
  { id: 'other', name: 'Other', unit: '', qtyLabel: 'Quantity' },
]

export const OTHER_UNITS = ['kg', 'liter', 'piece', 'packet', 'cylinder', 'unit', 'trip']

export function costItem(id) {
  return COST_ITEMS.find((item) => item.id === id) || COST_ITEMS[0]
}
