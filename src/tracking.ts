declare global {
  interface Window {
    whop?: { track: (name: string, data?: object) => void };
  }
}

// Only the three custom events (service_viewed, estimate_requested, deposit_started) are sent from here.
// Page views and checkout events are tracked automatically by the Whop pixel.
export const track = (name: string, data?: object) => {
  try {
    window.whop?.track(name, data);
  } catch {
    // tracking must never break the page
  }
};
