import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { loadWhop } from "@whop/elements";
import { WhopElements, useWhop } from "@whop/elements-react";
import { site } from "../site.config";
import { chargeDeposit, saveDepositCard } from "../server-fns";

type Search = { status?: string; kind?: string; payment?: string; setup?: string };
const str = (v: unknown) => (typeof v === "string" ? v : undefined);

export const Route = createFileRoute("/thanks")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    status: str(s.status),
    kind: str(s.kind),
    payment: str(s.payment),
    setup: str(s.setup),
  }),
  head: () => ({ meta: [{ title: `Payment status | ${site.company}` }] }),
  component: Thanks,
});

// This page mostly displays an outcome. Fulfilment should come from webhooks, never from this URL.
// Two exceptions finish the deposit, and both ask the server, which checks the real state with Whop:
//   deposit_setup  : the buyer returned from a 3D Secure / redirect step while saving the card. We charge the deposit.
//   deposit_wallet : the buyer paid the deposit with Apple Pay / Google Pay. We make sure the card is saved.

function Result({ title, body }: { title: string; body: string }) {
  return (
    <main className="mx-auto max-w-xl px-6 py-24">
      <h1 className="font-display text-5xl font-bold tracking-wide uppercase">{title}</h1>
      <p className="mt-4 text-lg text-muted">{body}</p>
      <a href="/" className="btn mt-8">
        Back to {site.company}
      </a>
    </main>
  );
}

function Thanks() {
  const { status, kind, payment, setup } = Route.useSearch();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (kind === "deposit_setup") {
    return mounted ? (
      <WhopElements elements={loadWhop()}>
        <DepositFinish setup={setup} status={status} />
      </WhopElements>
    ) : (
      <Result title="Finishing your deposit" body="One moment while we confirm your card and take the deposit." />
    );
  }
  if (kind === "deposit_wallet") return <WalletDeposit payment={payment} status={status} />;

  if (status === "succeeded") {
    return (
      <Result
        title="Thank you"
        body={`Your payment is complete and a receipt is on its way to your email. ${site.company} will be in touch shortly.`}
      />
    );
  }
  if (status === "failed" || status === "canceled") {
    return <Result title="Payment didn't go through" body="No money was taken. You can try again with another payment method." />;
  }
  return <Result title="Confirming your payment" body="Your payment is still processing. We'll email you as soon as it's confirmed." />;
}

// ---------- Card form deposit, returning from a 3D Secure / redirect step ----------

type Phase = "working" | "paid" | "processing" | "failed";

function DepositFinish({ setup, status }: { setup?: string; status?: string }) {
  const whop = useWhop();
  const [phase, setPhase] = useState<Phase>("working");
  const [detail, setDetail] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !whop) return;
    started.current = true;
    (async () => {
      if (!setup || status === "failed" || status === "canceled") {
        setDetail("The card wasn't saved, so nothing was charged.");
        return setPhase("failed");
      }
      try {
        // The setup may still be settling. The server reads its true state and charges at most once.
        for (let i = 0; i < 6; i++) {
          const r = await chargeDeposit({ data: { setupIntentId: setup } });
          if (r.state === "setup_pending") {
            await new Promise((res) => setTimeout(res, 2000));
            continue;
          }
          if (r.state === "paid") return setPhase("paid");
          const result = await whop.payments.handleNextAction({ clientSecret: r.client_secret ?? "" });
          if (result.redirected) return; // comes back to /thanks?kind=deposit with its own status
          if (result.status === "succeeded") return setPhase("paid");
          if (result.status === "processing") return setPhase("processing");
          setDetail(result.lastPaymentError?.message ?? "");
          return setPhase("failed");
        }
        setPhase("processing");
      } catch (e) {
        setDetail(e instanceof Error && e.message.length < 160 ? e.message : "");
        setPhase("failed");
      }
    })();
  }, [whop, setup, status]);

  if (phase === "paid") {
    return (
      <Result
        title="Deposit received"
        body={`Your deposit is paid and your card is saved securely. The final balance is billed to it after the job is done. ${site.company} will be in touch shortly.`}
      />
    );
  }
  if (phase === "processing") {
    return (
      <Result
        title="Deposit processing"
        body={`Your card is saved and the deposit is still being confirmed. We'll email you when it clears. Questions? Call ${site.phone}.`}
      />
    );
  }
  if (phase === "failed") {
    return (
      <Result
        title="Deposit didn't go through"
        body={`${detail ? detail + " " : ""}Your card may be saved but the deposit was not taken. Please try again or call ${site.phone}.`}
      />
    );
  }
  return <Result title="Finishing your deposit" body="One moment while we confirm your card and take the deposit." />;
}

// ---------- Wallet deposit: make sure the card is on file ----------

function WalletDeposit({ payment, status }: { payment?: string; status?: string }) {
  const [phase, setPhase] = useState<"working" | "saved" | "unsaved" | "failed" | "processing">("working");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (status === "failed" || status === "canceled") return setPhase("failed");
    if (status !== "succeeded" || !payment) return setPhase("processing");
    saveDepositCard({ data: { paymentId: payment } })
      .then((r) => setPhase(r.saved ? "saved" : r.reason === "not_paid" ? "processing" : "unsaved"))
      .catch(() => setPhase("unsaved"));
  }, [payment, status]);

  if (phase === "saved") {
    return (
      <Result
        title="Deposit received"
        body={`Your deposit is paid and your card is saved securely. The final balance is billed to it after the job is done. ${site.company} will be in touch shortly.`}
      />
    );
  }
  if (phase === "unsaved") {
    return (
      <Result
        title="Deposit received"
        body={`Your deposit is paid. We couldn't save your card automatically, so we'll send you an invoice for the final balance after the job. ${site.company} will be in touch shortly.`}
      />
    );
  }
  if (phase === "failed") {
    return <Result title="Payment didn't go through" body="No deposit was taken. You can try again with another payment method." />;
  }
  if (phase === "processing") {
    return <Result title="Confirming your deposit" body="Your payment is still processing. We'll email you as soon as it's confirmed." />;
  }
  return <Result title="Finishing your deposit" body="One moment while we confirm your payment." />;
}
