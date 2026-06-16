import { DollarSign, Package, TrendingUp } from "lucide-react";

import { EvilExamplePieChart } from "@/components/evilcharts/blocks/gradient.chart";
import { EvilHoverTraceBarChart } from "@/components/evilcharts/blocks/hover-trace-bar-chart";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardPanel,
} from "@/components/ui/card";

const stats = [
  {
    description: "+12% from last month",
    icon: DollarSign,
    title: "Total Sales",
    value: "$12,345",
  },
  {
    description: "8 new this week",
    icon: Package,
    title: "Products",
    value: "156",
  },
  {
    description: "+8% from last month",
    icon: TrendingUp,
    title: "Revenue",
    value: "$45,678",
  },
];

export function DashboardContent() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{stat.title}</CardTitle>
                <stat.icon className="size-4 text-muted-foreground" />
              </div>
              <CardDescription>{stat.description}</CardDescription>
            </CardHeader>
            <CardPanel>
              <span className="font-semibold text-2xl">{stat.value}</span>
            </CardPanel>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex h-[28rem] flex-col">
          <CardHeader>
            <CardTitle>Browser Usage</CardTitle>
            <CardDescription>Distribution by browser</CardDescription>
          </CardHeader>
          <CardPanel className="flex-1 overflow-hidden">
            <EvilExamplePieChart />
          </CardPanel>
        </Card>

        <Card className="flex h-[28rem] flex-col">
          <CardHeader>
            <CardTitle>Monthly Revenue</CardTitle>
            <CardDescription>Desktop sales trend</CardDescription>
          </CardHeader>
          <CardPanel className="flex-1 overflow-hidden">
            <EvilHoverTraceBarChart />
          </CardPanel>
        </Card>
      </div>
    </div>
  );
}
