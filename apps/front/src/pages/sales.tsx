import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardPanel,
} from "@/components/ui/card";

const sales = [
  { amount: "$250.00", customer: "Alice", date: "2024-01-15", id: "S-001" },
  { amount: "$180.00", customer: "Bob", date: "2024-01-14", id: "S-002" },
  { amount: "$320.00", customer: "Charlie", date: "2024-01-13", id: "S-003" },
  { amount: "$95.00", customer: "Diana", date: "2024-01-12", id: "S-004" },
  { amount: "$410.00", customer: "Eve", date: "2024-01-11", id: "S-005" },
  { amount: "$275.00", customer: "Frank", date: "2024-01-10", id: "S-006" },
  { amount: "$150.00", customer: "Grace", date: "2024-01-09", id: "S-007" },
  { amount: "$600.00", customer: "Hank", date: "2024-01-08", id: "S-008" },
];

export default function SalesPage() {
  return (
    <div>
      <h1 className="mb-4 font-semibold text-lg">Sales</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {sales.map((sale) => (
          <Card key={sale.id}>
            <CardHeader>
              <CardTitle>{sale.id}</CardTitle>
              <CardDescription>{sale.customer}</CardDescription>
            </CardHeader>
            <CardPanel>
              <span className="font-semibold text-lg">{sale.amount}</span>
            </CardPanel>
          </Card>
        ))}
      </div>
    </div>
  );
}
