import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Help & resources" };

const FAQ = [
  {
    q: "Where does the data come from?",
    a: "Every number is read from the Meta Marketing API using Blendfold's connected access. The dashboard is read-only and never changes campaigns, budgets or audiences.",
  },
  {
    q: "Why don't my numbers match Ads Manager exactly?",
    a: "Data is cached for a short time and conversions can arrive late. Results use each ad account's own attribution setting. Use “Fetch fresh data now” in Settings to clear the cache.",
  },
  {
    q: "What does “App-calculated” mean?",
    a: "Comparisons such as “ROAS improved 9.4%” are calculated by this dashboard from Meta totals for the selected period and the period of equal length before it.",
  },
  {
    q: "Purchases or leads?",
    a: "The dashboard leads with whichever result your accounts report more of. You can switch between purchase and lead metrics with “Add filter → Primary result”.",
  },
  {
    q: "Why are some leads missing?",
    a: "Lead form submissions need the leads_retrieval permission and access to the Facebook Page that owns the form. Insights lead counts also include pixel leads, so the two can differ.",
  },
  {
    q: "I forgot my password",
    a: "Passwords are set by your Blendfold admin. Ask them to reset it from the Users page.",
  },
];

export default function HelpPage() {
  return (
    <div className="space-y-6 lg:space-y-7">
      <PageHeader title="Help & resources" description="Answers to common questions about your media dashboard." />
      <section className="card divide-y divide-line">
        {FAQ.map((f) => (
          <details key={f.q} className="group px-5 py-4 sm:px-6">
            <summary className="cursor-pointer list-none text-[15px] font-medium text-ink marker:hidden">
              <span className="mr-2 inline-block text-muted transition-transform group-open:rotate-90">›</span>
              {f.q}
            </summary>
            <p className="mt-2 pl-5 text-sm text-ink-2">{f.a}</p>
          </details>
        ))}
      </section>
      <p className="text-[13px] text-muted">
        Meta reference:{" "}
        <a className="link" href="https://www.facebook.com/business/help" target="_blank" rel="noreferrer">
          Meta Business Help Center
        </a>
      </p>
    </div>
  );
}
