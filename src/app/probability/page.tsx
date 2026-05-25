import { TrackStub } from "@/components/common/TrackStub";
import { TRACK_META } from "@/lib/routes";

const meta = TRACK_META.probability;

export default function ProbabilityPage() {
  return (
    <TrackStub
      title={meta.title}
      blurb="The #1 thing quant interviews drill. Expected value, conditional, Bayes, Markov chains, gambler's ruin, urn puzzles."
      color={meta.color}
      topics={[
        "Counting & combinatorics",
        "Conditional probability",
        "Bayes' theorem",
        "Expected value",
        "Variance & covariance",
        "Distributions (Bernoulli, Binomial, Poisson, Normal)",
        "Random walks",
        "Markov chains",
        "Gambler's ruin",
        "Optional stopping",
        "Martingales (intro)",
        "Classic brainteasers (100 prisoners, Monty Hall, balls-in-urns)",
      ]}
      plannedFeatures={[
        { name: "Puzzle deck — 50 brainteasers, tap to reveal solution + intuition", status: "now" },
        { name: "Distribution playground — interactive PDFs/CDFs with sliders", status: "next" },
        { name: "Markov chain visualizer — transition matrix → steady state", status: "next" },
        { name: "Random walk simulator — see paths, hitting times", status: "later" },
        { name: "Bayes calculator — diagnostic test problems", status: "later" },
      ]}
    />
  );
}
