import { createFileRoute } from "@tanstack/react-router";
import App from "../App";
import { site, type PlanKey } from "../site.config";

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): { open?: PlanKey } => ({
    open: typeof s.open === "string" && s.open in site.plans ? (s.open as PlanKey) : undefined,
  }),
  component: App,
});
