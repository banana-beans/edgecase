import { TrackStub } from "@/components/common/TrackStub";
import { TRACK_META } from "@/lib/routes";

const meta = TRACK_META.stats;

export default function StatsPage() {
  return (
    <TrackStub
      title={meta.title}
      blurb="The QR (quant research) track. Hypothesis testing, regression, time series. Bring your linear algebra."
      color={meta.color}
      topics={[
        "Descriptive stats (mean, variance, skew, kurtosis)",
        "Sampling distributions",
        "Confidence intervals",
        "Hypothesis tests (t, chi-sq, F)",
        "Type I/II error, power",
        "OLS regression (assumptions, geometry, derivation)",
        "Multiple regression & multicollinearity",
        "Heteroskedasticity & autocorrelation",
        "Time series basics (stationarity, ACF, PACF)",
        "AR, MA, ARMA, ARIMA",
        "Cointegration & pairs trading",
        "GARCH volatility models",
      ]}
      plannedFeatures={[
        { name: "Regression playground — scatter + fit line + residuals", status: "now" },
        { name: "Distribution explorer — sample, plot, fit", status: "next" },
        { name: "ACF/PACF visualizer for synthetic time series", status: "next" },
        { name: "Hypothesis test walker — p-value intuition by simulation", status: "later" },
        { name: "Cointegration demo — generate I(1) pairs, run ADF test", status: "later" },
      ]}
    />
  );
}
