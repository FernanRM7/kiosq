export interface Product {
  id: string;
  nombre: string;
  precio: number;
  stock: number;
}

export const products: Product[] = [
  { id: "P-001", nombre: "Laptop Dell XPS 15", precio: 1299.99, stock: 15 },
  {
    id: "P-002",
    nombre: "Mouse Logitech MX Master",
    precio: 29.99,
    stock: 150,
  },
  { id: "P-003", nombre: "Teclado Mecánico RGB", precio: 89.99, stock: 75 },
  { id: "P-004", nombre: 'Monitor 27" 4K', precio: 449.99, stock: 30 },
  {
    id: "P-005",
    nombre: "Auriculares Sony WH-1000XM5",
    precio: 349.99,
    stock: 45,
  },
  { id: "P-006", nombre: "Webcam HD 1080p", precio: 59.99, stock: 200 },
  { id: "P-007", nombre: "Disco SSD 1TB", precio: 79.99, stock: 100 },
  { id: "P-008", nombre: "Cable USB-C 2m", precio: 12.99, stock: 500 },
];
