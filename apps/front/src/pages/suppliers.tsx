import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardPanel,
} from "@/components/ui/card";

const suppliers = [
  { items: 45, location: "New York", name: "Supplier X" },
  { items: 32, location: "Los Angeles", name: "Supplier Y" },
  { items: 28, location: "Chicago", name: "Supplier Z" },
  { items: 51, location: "Houston", name: "Supplier W" },
  { items: 19, location: "Phoenix", name: "Supplier V" },
  { items: 37, location: "Philadelphia", name: "Supplier U" },
  { items: 24, location: "San Antonio", name: "Supplier T" },
  { items: 41, location: "San Diego", name: "Supplier S" },
];

export default function SuppliersPage() {
  return (
    <div>
      <h1 className="mb-4 font-semibold text-lg">Suppliers</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {suppliers.map((supplier) => (
          <Card key={supplier.name}>
            <CardHeader>
              <CardTitle>{supplier.name}</CardTitle>
              <CardDescription>{supplier.location}</CardDescription>
            </CardHeader>
            <CardPanel>
              <span className="font-semibold text-lg">
                {supplier.items} items
              </span>
            </CardPanel>
          </Card>
        ))}
      </div>
    </div>
  );
}
