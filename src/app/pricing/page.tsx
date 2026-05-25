import { TrackStub } from "@/components/common/TrackStub";
import { TRACK_META } from "@/lib/routes";

const meta = TRACK_META.pricing;

export default function PricingPage() {
  return (
    <TrackStub
      title={meta.title}
      blurb="Required for any derivatives/options shop. Pricing intuition first, formulas second."
      color={meta.color}
      topics={[
        "Time value of money",
        "Forwards & futures",
        "Put-call parity",
        "Binomial tree (one-step → n-step)",
        "Risk-neutral pricing",
        "Black-Scholes (assumptions, derivation, formula)",
        "Greeks (delta, gamma, vega, theta, rho)",
        "Implied volatility",
        "Vol surface / smile / skew",
        "American vs European",
        "Exotics (barrier, Asian, lookback — intro)",
        "Bond pricing & duration",
      ]}
      plannedFeatures={[
        { name: "Greeks playground — interactive BS pricer with delta/gamma/vega curves", status: "now" },
        { name: "Binomial tree visualizer — step through risk-neutral pricing", status: "next" },
        { name: "Payoff diagram builder — combine calls/puts/spreads", status: "next" },
        { name: "Vol smile explorer — ATM vs OTM IV", status: "later" },
        { name: "Pricing formula reference — searchable, with derivation links", status: "later" },
      ]}
    />
  );
}
