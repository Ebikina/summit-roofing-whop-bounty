// The ONLY file you edit to rebrand. Every word, price and ID on the site comes from here.
// Secrets (the admin code) are NOT stored here: set the ADMIN_CODE app secret instead.
// Everything marked SAMPLE is fictional demo content. Swap it for your real details.

export type PlanKey = "inspection" | "deposit" | "flat";

export const site = {
  company: "Summit Roofing",
  phone: "(720) 555-0142", // SAMPLE: 555 numbers are reserved for fiction
  email: "hello@summitroofing.example", // SAMPLE
  tagline: "Honest roofing. Built to last.",
  region: "Colorado Front Range", // SAMPLE
  cities: ["Denver", "Aurora", "Lakewood", "Arvada", "Centennial", "Littleton"], // SAMPLE
  financing: "Flexible financing options available at checkout.",

  // Your Whop business ID (biz_...). Public, safe to ship in the browser.
  accountId: "biz_eNSz7Xo0IPM6At",

  hero: {
    eyebrow: "Roof repair, replacement and inspection",
    headline: "A roof you never have to think about again",
    body: "Straight answers, written quotes and crews that show up on time. Book an inspection online or ask for a free estimate.",
    primaryCta: "Request an estimate",
    secondaryCta: "Book online",
  },

  // SAMPLE badges: worded as placeholders so no real license or certification is claimed.
  trustBadges: [
    { title: "License and insurance", body: "Sample text. Add your license number and coverage." },
    { title: "Written, itemized quotes", body: "Sample text. Describe how you quote jobs." },
    { title: "Photo inspection report", body: "Sample text. Say what the report includes." },
    { title: "Workmanship warranty", body: "Sample text. Add your real warranty terms." },
  ],

  services: [
    { key: "repair", title: "Roof Repair", blurb: "Leaks, storm damage, flashing." },
    { key: "replacement", title: "Roof Replacement", blurb: "Full tear-off and install." },
    { key: "inspection", title: "Roof Inspection", blurb: "Written report with photos." },
  ],

  // Largest final-balance invoice /admin will accept (checked on the server).
  maxInvoiceAmount: 50000,

  // Hidden free Whop plan whose metadata stores the /admin lockout counters. Create your own when you rebrand.
  adminLockoutPlanId: "plan_JA1XvZ3MTxyTP",

  // Real Whop plan (variant) IDs. Change a price in the Whop dashboard, then update `price` here to match.
  plans: {
    inspection: {
      id: "plan_RBmiLGz6BXGFA",
      label: "Roof Inspection",
      price: 149,
      blurb: "A full inspection with a written report and photos.",
    },
    deposit: {
      id: "plan_y9eOGZHf28jn2",
      productId: "prod_gx9X9AM2vHrBP",
      label: "Project Deposit",
      price: 500,
      blurb:
        "Reserve your install date. Your card is saved securely when you pay the deposit, and the final balance is billed after the job is done.",
    },
    flat: {
      id: "plan_5F7A63KH4u8Jv",
      label: "Gutter Cleaning",
      price: 350,
      blurb: "Flat-rate gutter cleaning, debris out and downspouts flushed.",
    },
  },

  depositNote:
    "Paying the deposit saves your card securely with Summit Roofing. The final balance is billed to that card after the job is done.",
  estimateThanks: "Thanks! We'll contact you within one business day.",

  // SAMPLE reviews: fictional people and quotes.
  reviews: [
    { name: "Dana R., Lakewood", text: "On time, tidy, fair price." },
    { name: "Marcus T., Aurora", text: "Fixed our leak the same week." },
    { name: "Priya S., Denver", text: "Clear quote, no surprises." },
  ],
} as const;

export const currency = "USD";
