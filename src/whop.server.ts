// SERVER ONLY. Never import this from browser code; only call it inside createServerFn handlers.
// The platform attaches the business API key to outgoing Whop API requests, so no key lives in this code.
import { WhopClient } from "@whop/sdk";
import { env } from "cloudflare:workers";
import { site, type PlanKey } from "./site.config";

function whop() {
  return new WhopClient({
    token: env.WHOP_API_KEY ?? "",
    baseUrl: `${env.WHOP_API_ORIGIN ?? "https://api.whop.com"}/api/v1`,
  });
}

// ---------- Leads ----------

export type LeadInput = {
  name: string;
  email: string;
  phone: string;
  address: string;
  service: string;
  message: string;
};

export async function createLead(f: LeadInput) {
  // Leads API (POST /leads): account_id, metadata, product_id, referrer, user_id.
  const lead = await whop().leads.create({
    account_id: site.accountId,
    metadata: { ...f, source: "website_estimate_form" },
  });
  return { id: lead.id };
}

// ---------- One-time plans (inspection, flat-rate): charge the confirmation token ----------

export async function createPlanPayment(a: { planKey: Exclude<PlanKey, "deposit">; confirmationToken: string; origin: string }) {
  // Plan and price come from site.config on the server. The browser only names which plan.
  const plan = site.plans[a.planKey];
  if (!plan) throw new Error("Unknown plan");
  const payment = await whop().payments.create({
    account_id: site.accountId,
    variant_id: plan.id,
    confirmation_token: a.confirmationToken,
    return_url: `${a.origin}/thanks?kind=${a.planKey}`,
    metadata: { kind: a.planKey },
  });
  return { id: payment.id, status: payment.status, client_secret: payment.client_secret };
}

// ---------- Deposit: setup intent (card on file) first, then charge the saved card ----------

export async function startDepositSetup(a: { confirmationToken: string; origin: string }) {
  const si = await whop().setupIntents.create({
    account_id: site.accountId,
    confirmation_token: a.confirmationToken,
    currency: "usd",
    return_url: `${a.origin}/thanks?kind=deposit_setup`,
    metadata: { kind: "deposit_setup" },
  });
  return { id: si.id, status: si.status, client_secret: si.client_secret };
}

export async function chargeDeposit(a: { setupIntentId: string; origin: string }) {
  const client = whop();
  const si = await client.setupIntents.retrieve({ id: a.setupIntentId });
  if (si.account_id !== site.accountId || si.metadata?.kind !== "deposit_setup") throw new Error("Unknown setup");
  if (si.status === "processing" || si.status === "requires_action") return { state: "setup_pending" as const };
  if (si.status !== "succeeded" || !si.payment_method_id) throw new Error("The card was not saved.");
  if (!si.member_id) throw new Error("Could not identify the customer for this card.");

  // The plan and the price come from site.config. The same setup intent always maps to the same
  // idempotency key, so a retry or a second tab can never charge the deposit twice.
  const payment = await client.payments.create(
    {
      account_id: site.accountId,
      variant_id: site.plans.deposit.id,
      member_id: si.member_id,
      payment_method_id: si.payment_method_id,
      off_session: false, // the buyer is on the page and can complete 3D Secure
      return_url: `${a.origin}/thanks?kind=deposit`,
      metadata: { kind: "project_deposit", setup_intent_id: si.id },
    },
    { idempotencyKey: `deposit-${si.id}` },
  );
  return {
    state: payment.status === "paid" ? ("paid" as const) : ("needs_action" as const),
    id: payment.id,
    status: payment.status,
    client_secret: payment.client_secret,
  };
}

// ---------- Deposit paid with a wallet: make sure the card is saved ----------

// The wallet button buys the deposit plan through a Checkout handle, which has no save-card option.
// Afterwards we check that the buyer has the payment method on file, and if not, save it with a setup intent.
export async function saveDepositCard(a: { paymentId: string }) {
  const client = whop();
  const payment = await client.payments.retrieve({ id: a.paymentId });
  if (payment.account_id !== site.accountId || payment.product_id !== site.plans.deposit.productId) {
    throw new Error("Unknown payment");
  }
  if (payment.status !== "paid") return { saved: false, reason: "not_paid" as const };
  if (!payment.member_id || !payment.payment_method_id) return { saved: false, reason: "no_method" as const };

  const methods = await client.paymentMethods.list({ member_id: payment.member_id, first: 50 });
  if (methods.data.some((m) => m.id === payment.payment_method_id)) return { saved: true, reason: "already_saved" as const };

  const si = await client.setupIntents.create(
    {
      account_id: site.accountId,
      payment_method_id: payment.payment_method_id,
      currency: "usd",
      metadata: { kind: "deposit_wallet_save", payment_id: payment.id },
    },
    { idempotencyKey: `save-${payment.id}` },
  );
  return { saved: si.status === "succeeded", reason: si.status === "succeeded" ? ("saved" as const) : ("setup_failed" as const) };
}

// ---------- Admin: access control with lockout ----------

function safeEqual(a: string, b: string) {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

// Lockout state lives in the metadata of a hidden Whop plan (site.adminLockoutPlanId), so it is shared by every
// server instance and survives restarts. Each client (hashed IP) has one key: "count|lockedUntil|lastFailure".
const MAX_FAILS = 5;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function hashKey(clientKey: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`admin:${clientKey}`));
  return "k_" + [...new Uint8Array(buf)].slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function parseRec(v: unknown) {
  const [c, l, t] = String(v ?? "0|0|0").split("|").map(Number);
  return { count: c || 0, lockedUntil: l || 0, last: t || 0 };
}

export async function checkAdminCode(code: string, clientKey: string) {
  const secret = env.ADMIN_CODE;
  if (!secret) throw new Error("The ADMIN_CODE app secret is not set.");

  const client = whop();
  const key = await hashKey(clientKey);
  let meta: Record<string, unknown>;
  try {
    meta = ((await client.variants.retrieve({ id: site.adminLockoutPlanId })).metadata ?? {}) as Record<string, unknown>;
  } catch {
    // Fail closed: without the lockout store we do not accept codes.
    throw new Error("Admin sign-in is temporarily unavailable. Try again shortly.");
  }
  const now = Date.now();
  const rec = parseRec(meta[key]);
  if (rec.lockedUntil > now) {
    const mins = Math.ceil((rec.lockedUntil - now) / 60000);
    throw new Error(`Too many wrong codes. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`);
  }

  const write = async (value: string) => {
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(meta)) {
      if (k.startsWith("k_") && parseRec(v).last > now - 864e5) next[k] = String(v);
    }
    next[key] = value;
    await client.variants.update({ id: site.adminLockoutPlanId, metadata: next });
  };

  if (code && safeEqual(code, secret)) {
    if (rec.count > 0) await write(`0|0|${now}`).catch(() => undefined);
    return;
  }

  const count = rec.count + 1;
  await sleep(Math.min(count, 5) * 1000); // every wrong code costs a growing delay
  const lockedUntil = count >= MAX_FAILS ? Date.now() + 15 * 60000 * 2 ** Math.min(count - MAX_FAILS, 4) : 0;
  await write(`${count}|${lockedUntil}|${Date.now()}`).catch(() => undefined);
  throw new Error("Wrong code.");
}

// ---------- Admin: final-balance invoice ----------

export async function createFinalInvoice(a: {
  email: string;
  name: string;
  amount: number;
  autoCharge: boolean;
  code: string;
  clientKey: string;
}) {
  await checkAdminCode(a.code, a.clientKey);
  // Validated here, on the server.
  if (!Number.isFinite(a.amount) || a.amount < 1) throw new Error("Amount must be at least 1.00");
  if (a.amount > site.maxInvoiceAmount) throw new Error(`Amount can't be more than ${site.maxInvoiceAmount.toLocaleString("en-US")}.`);
  a.amount = Math.round(a.amount * 100) / 100;

  const client = whop();
  const items = [
    {
      quantity: 1,
      variant: {
        currency: "usd",
        billing_type: "one_time",
        initial_price: a.amount,
        title: "Final Balance",
        visibility: "hidden",
        product: {
          external_identifier: "final-balance",
          title: `${site.company} - Final Balance`,
          visibility: "hidden",
        },
      },
    },
  ] as never;
  const email = a.email.trim().toLowerCase();

  if (!a.autoCharge) {
    const invoice = await client.invoices.create({
      account_id: site.accountId,
      email_address: email,
      customer_name: a.name,
      due_at: new Date(Date.now() + 7 * 864e5).toISOString(),
      items,
      metadata: { kind: "final_balance" },
    });
    // Send emails the invoice with a pay link; nothing is charged.
    const sent = await client.invoices.send({ id: invoice.id });
    return { id: sent.id, status: sent.status, mode: "send_invoice" as const };
  }

  // Auto-charge: find the customer, then the card saved when they paid the deposit.
  const noCard = "No saved card found for that email. The customer needs to pay the deposit first, or send an invoice instead.";
  const members = await client.members.list({ account_id: site.accountId, query: email, first: 5 });
  const member =
    members.data.find((m) => JSON.stringify(m).toLowerCase().includes(email)) ??
    (members.data.length === 1 ? members.data[0] : undefined);
  if (!member) throw new Error(noCard);

  const methods = await client.paymentMethods.list({ member_id: member.id, first: 20 });
  const card = methods.data.find((m) => {
    const x = m as { payment_method_type?: string; card?: { expired?: boolean } };
    // Wallet-saved cards (Apple Pay, Google Pay) are cards too.
    return ["card", "apple_pay", "google_pay"].includes(x.payment_method_type ?? "") && !x.card?.expired;
  });
  if (!card) throw new Error(noCard);

  // No due_at: issuing a draft that has a saved payment method charges it right away.
  const invoice = await client.invoices.create({
    account_id: site.accountId,
    member_id: member.id,
    items,
    payment_method_id: card.id,
    metadata: { kind: "final_balance" },
  });
  const issued = await client.invoices.issue({ id: invoice.id });
  return { id: issued.id, status: issued.status, mode: "auto_charge" as const };
}
