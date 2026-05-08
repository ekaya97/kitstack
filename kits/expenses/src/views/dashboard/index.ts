import { defineView } from "@kitstackco/sdk";
import { loader } from "./loader";
import { DashboardView } from "./View";

export default defineView({
  slug: "dashboard",
  name: "Monthly Dashboard",
  description: "for an overview of monthly expenses, income, spending trend, and category breakdown",
  loader,
  component: DashboardView,
  height: 620,
  placeholder: {
    monthExpenses: 234500,
    monthIncome: 850000,
    profit: 615500,
    trend: [
      { month: "Dec", total: 198000 },
      { month: "Jan", total: 215000 },
      { month: "Feb", total: 187000 },
      { month: "Mar", total: 245000 },
      { month: "Apr", total: 203000 },
      { month: "May", total: 234500 },
    ],
    categoryBreakdown: [
      { category: "software", total: 89900 },
      { category: "travel", total: 45000 },
      { category: "meals_business", total: 32500 },
      { category: "office_supplies", total: 28000 },
      { category: "phone_internet", total: 19900 },
      { category: "education", total: 19200 },
    ],
    recentExpenses: [
      { id: "e1", date: "2026-05-07", description: "Figma Pro subscription", amountCents: 1400, category: "software" },
      { id: "e2", date: "2026-05-06", description: "Lunch with client at Vapiano", amountCents: 4750, category: "meals_business" },
      { id: "e3", date: "2026-05-05", description: "ICE Berlin-Munich", amountCents: 8900, category: "travel" },
      { id: "e4", date: "2026-05-04", description: "USB-C hub", amountCents: 3499, category: "hardware" },
      { id: "e5", date: "2026-05-03", description: "AWS May bill", amountCents: 4200, category: "software" },
    ],
  },
});
