interface SaleItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export const saleItems: SaleItem[] = [
  { id: "1", name: "Wireless Mouse", price: 29.99, quantity: 1 },
  { id: "2", name: "USB-C Hub", price: 49.99, quantity: 2 },
  { id: "3", name: "Mechanical Keyboard", price: 89.99, quantity: 1 },
  { id: "4", name: "Monitor Stand", price: 34.99, quantity: 1 },
  { id: "5", name: "Webcam HD", price: 59.99, quantity: 1 },
];
