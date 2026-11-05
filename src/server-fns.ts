import { createServerFn } from "@tanstack/react-start";

// Thin RPC layer: the browser calls these, the handlers run on the server only.
// The browser never sends a price, an amount or a return URL. It names a plan key or an ID, and the server
// reads the plan, price and site address from site.config and the incoming request.

async function clientKey() {
  const { getRequestHeader } = await import("@tanstack/react-start/server");
  return getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for") ?? "unknown";
}

async function siteOrigin() {
  const { getRequestHost } = await import("@tanstack/react-start/server");
  const host = getRequestHost();
  return /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ? `http://${host}` : `https://${host}`;
}

export const submitLead = createServerFn({ method: "POST" })
  .validator((d: { name: string; email: string; phone: string; address: string; service: string; message: string }) => {
    for (const k of ["name", "email", "phone", "address"] as const) {
      if (!d[k] || typeof d[k] !== "string" || d[k].length > 300) throw new Error(`Invalid ${k}`);
    }
    return { ...d, service: String(d.service ?? "").slice(0, 100), message: String(d.message ?? "").slice(0, 2000) };
  })
  .handler(async ({ data }) => {
    const { createLead } = await import("./whop.server");
    return createLead(data);
  });

export const payPlan = createServerFn({ method: "POST" })
  .validator((d: { planKey: "inspection" | "flat"; confirmationToken: string }) => {
    if (d.planKey !== "inspection" && d.planKey !== "flat") throw new Error("Invalid plan");
    if (!/^ctok_[A-Za-z0-9_]+$/.test(d.confirmationToken)) throw new Error("Invalid confirmation token");
    return d;
  })
  .handler(async ({ data }) => {
    const { createPlanPayment } = await import("./whop.server");
    return createPlanPayment({ ...data, origin: await siteOrigin() });
  });

export const startDepositSetup = createServerFn({ method: "POST" })
  .validator((d: { confirmationToken: string }) => {
    if (!/^ctok_[A-Za-z0-9_]+$/.test(d.confirmationToken)) throw new Error("Invalid confirmation token");
    return d;
  })
  .handler(async ({ data }) => {
    const { startDepositSetup } = await import("./whop.server");
    return startDepositSetup({ ...data, origin: await siteOrigin() });
  });

export const chargeDeposit = createServerFn({ method: "POST" })
  .validator((d: { setupIntentId: string }) => {
    if (!/^sint_[A-Za-z0-9_]+$/.test(d.setupIntentId)) throw new Error("Invalid setup intent");
    return d;
  })
  .handler(async ({ data }) => {
    const { chargeDeposit } = await import("./whop.server");
    return chargeDeposit({ ...data, origin: await siteOrigin() });
  });

export const saveDepositCard = createServerFn({ method: "POST" })
  .validator((d: { paymentId: string }) => {
    if (!/^pay_[A-Za-z0-9_]+$/.test(d.paymentId)) throw new Error("Invalid payment");
    return d;
  })
  .handler(async ({ data }) => {
    const { saveDepositCard } = await import("./whop.server");
    return saveDepositCard(data);
  });

export const sendFinalInvoice = createServerFn({ method: "POST" })
  .validator((d: { email: string; name: string; amount: number; autoCharge: boolean; code: string }) => {
    if (!d.email || !d.name || typeof d.code !== "string") throw new Error("Missing fields");
    return { ...d, amount: Number(d.amount), autoCharge: !!d.autoCharge };
  })
  .handler(async ({ data }) => {
    const { createFinalInvoice } = await import("./whop.server");
    return createFinalInvoice({ ...data, clientKey: await clientKey() });
  });

// Lets the admin page check the code before showing the form.
export const checkAdmin = createServerFn({ method: "POST" })
  .validator((d: { code: string }) => ({ code: String(d.code ?? "") }))
  .handler(async ({ data }) => {
    const { checkAdminCode } = await import("./whop.server");
    await checkAdminCode(data.code, await clientKey());
    return { ok: true as const };
  });
