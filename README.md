# summit-roofing-whop-bounty
Summit roofing whop temple 
# Summit Roofing: Whop Website Template

A reusable website template for US roofing companies, built on Whop Websites.
It covers services, service area, financing, reviews, trust badges, and
contact. Every company-specific detail (name, services, prices, plan IDs)
lives in one file, `src/site.config.ts`, so rebranding needs no structural
changes.

Checkout uses Whop Payment Elements with Apple Pay and Google Pay and the
required Whop branding, for a $149 inspection, a $500 deposit that saves the
customer's card, and a flat-rate service. An estimate form creates leads
through the Whop Leads API. A protected admin page bills the final balance
with the Whop Invoices API, by auto-charge or emailed invoice. Custom pixel
events: service_viewed, estimate_requested, deposit_started.

## Rebranding
1. Edit `src/site.config.ts`: company name, contact details, cities, reviews,
   badges, services.
2. Create your own plans in the Whop dashboard and put their IDs and prices
   in the `plans` section. Prices charged come from the Whop plans.
3. Create a hidden free plan for the admin lockout and put its ID in
   `adminLockoutPlanId`.
4. Set your Whop business ID in `accountId`.
5. Set the `ADMIN_CODE` app secret to a long random value.

## Whop features used
Whop Websites, Payment Elements (Checkout, Payments, PaymentElement,
ExpressCheckoutElement, EmailElement, BrandingElement), setup intents,
Leads API, Invoices API, and the Whop pixel (`whop.track`).

Live demo: summitroofs.whop.site

