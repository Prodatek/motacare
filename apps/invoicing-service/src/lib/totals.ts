export interface LineItemAmount {
  quantity: number;
  unitPrice: number;
}

export function computeTotals(lineItems: LineItemAmount[], taxRate: number, discountAmount: number) {
  const subtotal = lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = Math.max(0, subtotal + taxAmount - discountAmount);
  return { subtotal, taxAmount, total };
}
