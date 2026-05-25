import { TrackStub } from "@/components/common/TrackStub";
import { TRACK_META } from "@/lib/routes";

const meta = TRACK_META.sim;

export default function SimPage() {
  return (
    <TrackStub
      title={meta.title}
      blurb="The differentiator. A browser-native orderbook + market-making simulator. Reps don't teach microstructure — playing does."
      color={meta.color}
      topics={[
        "Limit order book mechanics",
        "Price-time priority matching",
        "Bid-ask spread & depth",
        "Market-making P&L attribution",
        "Inventory risk & skew",
        "Adverse selection",
        "Slippage & market impact",
        "Toxic flow detection",
        "Mean reversion vs trend",
        "Geometric Brownian motion",
        "Poisson order arrival",
        "Toxic flow / informed traders",
      ]}
      plannedFeatures={[
        { name: "Browser orderbook canvas — see bids/asks in real time", status: "next" },
        { name: "MM strategy editor — write a quoting function, watch it run", status: "next" },
        { name: "P&L + inventory chart", status: "next" },
        { name: "Scenario replay — recorded sessions you can re-run", status: "later" },
        { name: "Opponent bot — adverse selection / informed flow", status: "later" },
      ]}
    />
  );
}
