import { useState } from "react";
import { site } from "./site.config";
import { track } from "./tracking";

type Fields = { name: string; email: string; phone: string; address: string; service: string; message: string };

export function EstimateForm({ submit }: { submit: (f: Fields) => Promise<{ id: string }> }) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [leadId, setLeadId] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as unknown as Fields;
    setState("sending");
    try {
      const lead = await submit(f); // server function -> createLead() -> Whop Leads API
      setLeadId(lead.id);
      track("estimate_requested", { name: f.name, email: f.email, phone: f.phone });
      setState("done");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <p role="status" className="rounded-card border border-line bg-white p-6 text-lg">
        {site.estimateThanks}
        {leadId && <span className="mt-2 block text-sm break-all text-muted">Reference: {leadId}</span>}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <input className="field" name="name" placeholder="Name" autoComplete="name" required />
      <div className="grid gap-3 sm:grid-cols-2">
        <input className="field" name="email" type="email" placeholder="Email" autoComplete="email" required />
        <input className="field" name="phone" type="tel" placeholder="Phone" autoComplete="tel" required />
      </div>
      <input className="field" name="address" placeholder="Property address" autoComplete="street-address" required />
      <select className="field" name="service" aria-label="Service">
        {site.services.map((s) => (
          <option key={s.key}>{s.title}</option>
        ))}
      </select>
      <textarea className="field min-h-28" name="message" placeholder="Tell us about the roof" />
      <button className="btn" disabled={state === "sending"}>
        {state === "sending" ? "Sending..." : site.hero.primaryCta}
      </button>
      {state === "error" && (
        <p role="alert" className="text-sm font-medium text-red-700">
          Something went wrong. Please call {site.phone}.
        </p>
      )}
    </form>
  );
}
