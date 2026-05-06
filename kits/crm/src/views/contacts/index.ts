import { defineView } from "@kitstackco/sdk";
import { loader } from "./loader";
import { ContactsView } from "./View";

export default defineView({
  slug: "contacts",
  name: "Contacts",
  description: "to browse and search all contacts with company, role, and relationship status",
  loader,
  component: ContactsView,
  height: 500,
  placeholder: [
    { id: "con_001", firstName: "Anna", lastName: "Müller", email: "anna@deloitte.com", role: "Partner", relationship: "warm", tags: "consulting,berlin", companyName: "Deloitte", lastInteraction: "2026-05-04" },
    { id: "con_002", firstName: "Jonas", lastName: "Fischer", email: "jonas@cloudsync.de", role: "CTO", relationship: "warm", tags: "tech,saas", companyName: "CloudSync GmbH", lastInteraction: "2026-05-01" },
    { id: "con_003", firstName: "Lisa", lastName: "Chen", email: "lisa@finledger.io", role: "Head of Product", relationship: "neutral", tags: "fintech", companyName: "FinLedger", lastInteraction: "2026-04-22" },
    { id: "con_004", firstName: "Marc", lastName: "Bauer", email: "marc@retailos.com", role: "CEO", relationship: "cold", tags: "retail,enterprise", companyName: "RetailOS", lastInteraction: "2026-03-15" },
    { id: "con_005", firstName: "Sophie", lastName: "Müller", email: "sophie@mueller-gmbh.de", role: "Managing Director", relationship: "warm", tags: "branding,munich", companyName: "Müller GmbH", lastInteraction: "2026-05-05" },
    { id: "con_006", firstName: "Tom", lastName: "Richter", email: "tom@datavault.de", role: "VP Engineering", relationship: "neutral", tags: "data,infrastructure", companyName: "DataVault AG", lastInteraction: "2026-04-28" },
    { id: "con_007", firstName: "Eva", lastName: "Schmidt", email: "eva@greentech.eu", role: "Founder", relationship: "warm", tags: "sustainability,startup", companyName: "GreenTech", lastInteraction: "2026-05-03" },
  ],
});
