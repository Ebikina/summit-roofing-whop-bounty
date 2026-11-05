// Server bindings. App secrets set with `whop apps secrets set` show up here by name.
declare module "cloudflare:workers" {
  export const env: {
    ADMIN_CODE?: string;
    WHOP_API_KEY?: string;
    WHOP_API_ORIGIN?: string;
    APP_ID?: string;
    [key: string]: string | undefined;
  };
}
