import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardPanel,
} from "@/components/ui/card";

const products = [
  { category: "Electronics", name: "Product A", price: "$99.99" },
  { category: "Clothing", name: "Product B", price: "$49.99" },
  { category: "Home", name: "Product C", price: "$79.99" },
  { category: "Sports", name: "Product D", price: "$59.99" },
  { category: "Books", name: "Product E", price: "$19.99" },
  { category: "Toys", name: "Product F", price: "$29.99" },
  { category: "Food", name: "Product G", price: "$12.99" },
  { category: "Health", name: "Product H", price: "$34.99" },
];

export default function ProductsPage() {
  return (
    <div>
      <h1 className="mb-4 font-semibold text-lg">Products</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((product) => (
          <Card key={product.name}>
            <CardHeader>
              <CardTitle>{product.name}</CardTitle>
              <CardDescription>{product.category}</CardDescription>
            </CardHeader>
            <CardPanel>
              <span className="font-semibold text-lg">{product.price}</span>
            </CardPanel>
          </Card>
        ))}
      </div>
    </div>
  );
}
