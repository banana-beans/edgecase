import type { QRQuestion } from "./index";

// ============================================================
// Module 2 -- Calendars & Alignment
// exchange calendars, reindexing to a master calendar, business
// day arithmetic, timezones, holiday gaps, multi-asset alignment,
// resample vs asfreq, forward-fill limits.
// 13 questions: 3 warmup, 7 core, 3 hard.
// ============================================================

export const calendarsQuestions: QRQuestion[] = [
  {
    id: "qr-calendars-01-trading-calendar",
    module: "calendars",
    title: "What a trading calendar is",
    difficulty: "warmup",
    question: `You need the list of days the US stock market was open in 2024. A teammate suggests pd.date_range with freq="B". Is that right, and what is the correct mental model for a trading calendar?`,
    thinking: `Start by unpacking what freq="B" actually gives you: every Monday through Friday -- a weekday calendar, not a trading calendar. It happily includes Christmas, July 4th, and Thanksgiving, when no US exchange traded. A trading calendar is exchange-specific: the set of sessions that venue actually held, including half days and unscheduled closures like hurricanes or the days after 9/11. Ask yourself why the gap matters quantitatively: with about 9 US market holidays a year, a weekday calendar creates roughly 9 phantom sessions annually -- days your reindexed prices will show NaN or, worse, a forward-filled stale price that manufactures a fake zero return. Also internalize that calendars differ by exchange: NYSE closes on Good Friday, which is not a US federal holiday, so even the federal holiday calendar is subtly wrong for equities. Production answer: use a maintained exchange calendar library, or derive the calendar from the data itself -- days where prices actually exist.`,
    answer: `No -- freq="B" gives all weekdays, including market holidays like Christmas and Thanksgiving, so you get about nine phantom sessions a year. A trading calendar is the exchange-specific list of actual sessions, including half days and ad-hoc closures. In practice you use a maintained library like exchange_calendars for the venue, or derive sessions from the data itself: dates where real prices exist. And calendars differ per exchange -- NYSE closes Good Friday, which is not even a federal holiday.`,
    python: `import pandas as pd
from pandas.tseries.holiday import USFederalHolidayCalendar
from pandas.tseries.offsets import CustomBusinessDay

# the WRONG one: weekdays only, ignores every market holiday
weekdays = pd.bdate_range("2024-01-01", "2024-12-31")   # 262 days

# closer: weekdays minus US federal holidays
cbd = CustomBusinessDay(calendar=USFederalHolidayCalendar())
fed = pd.date_range("2024-01-01", "2024-12-31", freq=cbd)

# still not right for equities: NYSE also closes Good Friday,
# which is NOT a federal holiday, and federal holidays include
# Columbus Day and Veterans Day, when the NYSE trades!
# production: exchange_calendars / pandas_market_calendars, e.g.
#   import exchange_calendars as xcals
#   nyse = xcals.get_calendar("XNYS")
#   sessions = nyse.sessions_in_range("2024-01-01", "2024-12-31")

# pragmatic fallback: let the DATA define the calendar
observed = px.dropna(how="all").index   # days where anything actually traded`,
    trap: `Treating "business day" and "trading day" as synonyms. Every freq="B" or np.busday_count call embeds that error, and it compounds: annualization factors, day-count offsets, and forward-fill windows all drift by ~9 days a year.`,
    followUp: `Your dataset includes London and Tokyo listings too. How many calendars do you now need, and what single data structure would you build to answer "was market X open on day D"?`,
  },
  {
    id: "qr-calendars-02-reindex-master",
    module: "calendars",
    title: "Reindexing to a master calendar",
    difficulty: "warmup",
    question: `You have closes for 500 stocks in a wide DataFrame, but each column came from a separate query and some are missing random days. How do you get every series onto one common set of dates, and what does reindex actually do?`,
    thinking: `The tool is reindex, but first be clear about its mechanics, because they are absolute: reindex conforms data to the new index label by label -- rows whose labels are in both stay, labels only in the new index appear as NaN rows, and labels only in the old index are silently dropped. That last clause deserves fear: if your master calendar is missing a date the data has, reindex deletes that day's prices with no warning. So construction of the master calendar is the real decision. Build it from an exchange calendar, or as the union of observed dates across all series. Then ask what each NaN in the reindexed frame means: stock not yet listed, delisted, halted, or genuinely missing data -- they look identical after reindexing, and your fill policy (next question in any interview) must respect the difference.`,
    answer: `Build one master calendar -- from the exchange calendar or the union of all observed dates -- and call df.reindex(master). Reindex aligns by label: dates in the master but absent from the data become NaN rows, and, critically, dates in the data but absent from the master are silently dropped. So the master must be a superset of real sessions. Afterwards every NaN is an explicit "no observation here" that a deliberate fill policy can address -- not before.`,
    python: `import pandas as pd

# master calendar: union of every date any series observed
# (or better: the exchange calendar for the venue)
master = px.index                       # already the union in a wide frame
master = master.union(other_source.index)   # extend across sources

# conform every column to the master
aligned = px.reindex(master)

# what reindex did, precisely:
#  - master dates missing from px  -> new rows of NaN  (visible, good)
#  - px dates missing from master  -> DROPPED SILENTLY (dangerous)
# so verify nothing was thrown away:
lost = px.index.difference(master)
assert len(lost) == 0, "master calendar is missing real trading days"

# each column's NaN count now tells a story: late IPO, delisting, gaps
nan_profile = aligned.isna().sum().sort_values(ascending=False)`,
    trap: `Reindexing to a calendar that is not a superset of the data's dates -- e.g. a weekday calendar when the data contains a special Saturday session, or a date range that starts too late. Reindex drops those rows without any error, and the loss is invisible until a return series does not reconcile.`,
  },
  {
    id: "qr-calendars-03-resample-vs-asfreq",
    module: "calendars",
    title: "resample vs asfreq",
    difficulty: "warmup",
    question: `You want month-end prices from a daily series. Both px.resample("ME").last() and px.asfreq("ME") seem to work. What is the difference, and when does asfreq quietly give you the wrong answer?`,
    thinking: `Separate the two mental models. asfreq is pure selection: it builds the new date index and picks the value sitting at exactly each new label -- no aggregation, no looking inside the interval. resample is groupby-over-time: it buckets every observation into periods and applies a reducer -- last, mean, sum -- over each bucket's contents. Now find the divergence case: asfreq("ME") looks up the literal calendar month-end date. If October 31 is a Saturday or a holiday, there is no row at that label, so you get NaN -- even though a perfectly good price exists on October 29. resample("ME").last() takes the last observation within October, which is what "month-end price" means to a human. So asfreq silently NaNs out every month whose calendar end falls on a non-trading day -- roughly a third of months. Rule: asfreq for re-stamping onto a grid you know matches, resample whenever the target label may not coincide with an observation.`,
    answer: `resample is a time-based groupby: it buckets all observations in each month and applies an aggregator, so .last() returns the final traded price of the month. asfreq is a pure index lookup at the new labels: if the literal month-end date was a weekend or holiday, there is no row there and you get NaN -- no error, about a third of your months. Use resample("ME").last() for month-end prices; reserve asfreq for regridding when you know observations exist at every target label.`,
    python: `import pandas as pd

# resample = groupby over time buckets, then aggregate inside each
monthly = px.resample("ME").last()     # last OBSERVED price in each month
# ("ME" is the pandas >= 2.2 month-end alias; bare "M" is deprecated)

# asfreq = look up the value AT each new label, nothing more
monthly_bad = px.asfreq("ME")
# any month whose calendar end lands on Sat/Sun/holiday -> NaN

# see the damage:
gaps = monthly_bad.isna() & monthly.notna()
# gaps is True for every month asfreq silently lost

# resample handles other reducers the same way:
monthly_ret = px.pct_change().add(1).resample("ME").prod().sub(1)
monthly_vol = volume.resample("ME").sum()   # sums make sense for volume`,
    trap: `Trusting asfreq("ME") because it "ran fine" on a sample where the month-ends happened to be weekdays. It degrades data-dependently: December 31, 2023 is a Sunday, so that year-end price is NaN while other years look fine -- an intermittent bug that unit tests on friendly dates never catch.`,
    followUp: `Now produce weekly Friday prices. What does resample("W-FRI").last() do in a week where Friday is a holiday, and is that behavior right for you?`,
  },
  {
    id: "qr-calendars-04-tz-naive-vs-aware",
    module: "calendars",
    title: "tz-naive vs tz-aware",
    difficulty: "core",
    question: `Explain the difference between a tz-naive and tz-aware timestamp in pandas, and the difference between tz_localize and tz_convert. Your intraday file has timestamps like "2024-03-08 16:00:00" with no zone -- what do you do?`,
    thinking: `A tz-naive timestamp is just a wall-clock reading with no claim about where the clock hung: "16:00" could be New York, London, or UTC. A tz-aware timestamp pins the instant to the global timeline by carrying a zone. From that, the two operations follow logically: tz_localize attaches a zone to a naive timestamp -- it is a declaration of fact about what the naive numbers meant, and it changes no digits. tz_convert re-expresses an already-aware timestamp in another zone -- it changes the displayed digits but not the underlying instant. The dangerous step is localize, because pandas cannot check your claim: localize the file to the wrong zone and every timestamp is silently shifted hours off the truth. So for the file: find out from the vendor's documentation what zone those stamps are in -- never guess from plausibility -- localize to that zone, then convert everything to one canonical zone (usually UTC) for storage and cross-source work.`,
    answer: `Naive timestamps are wall-clock readings with no zone attached; aware ones identify an absolute instant. tz_localize attaches a zone to naive data -- a factual claim about what the numbers meant, digits unchanged. tz_convert re-expresses an aware timestamp in another zone -- digits change, instant does not. For the file: confirm from vendor docs which zone "16:00" is in, tz_localize to that zone, then tz_convert to UTC as the canonical storage zone. Mixing the two up raises; localizing to the wrong zone corrupts silently.`,
    python: `import pandas as pd

ts = pd.Timestamp("2024-03-08 16:00:00")     # naive: no zone, just wall time

# tz_localize: DECLARE what zone the wall time was read in
ny = ts.tz_localize("America/New_York")      # 16:00 New York, instant now pinned

# tz_convert: re-express the same instant elsewhere
utc = ny.tz_convert("UTC")                   # 21:00 UTC -- same moment

# the two error modes pandas protects you from:
#   ts.tz_convert("UTC")   -> raises: cannot convert what has no zone
#   ny.tz_localize("UTC")  -> raises: already has a zone
# the error it CANNOT protect you from: localizing to the wrong zone.
wrong = ts.tz_localize("UTC")                # claims 16:00 was UTC
# wrong is now 5 hours off the true instant -- and nothing will ever raise

# whole-index version for the intraday file:
df.index = df.index.tz_localize("America/New_York").tz_convert("UTC")

# store in UTC; render in local only at the display edge
df_local_view = df.tz_convert("America/New_York")`,
    trap: `Localizing to UTC because the stamps "look like UTC" or because it silences the naive-vs-aware mismatch error when joining against an aware series. The join then works and every timestamp is hours wrong -- the corruption is silent and permanent. The vendor spec, not convenience, decides the localize zone.`,
    followUp: `That file spans March 10, 2024 -- the US DST switch, when 2:00-3:00 AM never happened on the New York clock. What options does tz_localize give you for nonexistent and ambiguous times?`,
  },
  {
    id: "qr-calendars-05-union-calendar",
    module: "calendars",
    title: "Building a multi-asset master calendar",
    difficulty: "core",
    question: `You are building a daily dataset covering US equities, European equities, and a crypto series that trades every day. What master calendar do you put them on, and what are the options?`,
    thinking: `First accept there is no single "correct" calendar -- there are three defensible choices, each encoding a different analytical stance, and the interviewer wants to hear you weigh them. Union of all venues' sessions: no venue's data is ever dropped, but every asset now has NaNs on the other venues' holidays (and equities show nothing on crypto's weekends). Intersection: every asset has a genuine observation on every date -- cleanest for correlation and regression -- but you discard real data, and with crypto in the mix the intersection is just weekday-holidays-excluded anyway. Single reference venue (e.g. NYSE): natural when the strategy trades from a US book, other assets get aligned onto US days. Ask what the downstream computation needs: covariance estimation wants genuinely contemporaneous observations (intersection or reference), while a data warehouse wants to lose nothing (union). Whatever you pick, NaNs after reindexing become policy objects: fill, mask, or leave -- explicitly.`,
    answer: `Three options, chosen by downstream use. Union of all session sets preserves every observation -- right for storage -- but litters each asset with NaNs on other venues' off-days. Intersection guarantees contemporaneous data everywhere -- right for correlation and regression -- but discards real sessions. A reference venue's calendar (typically the venue you trade from) is right for a strategy book. I would store on the union and compute on intersection or reference, with the NaN-fill policy stated explicitly at each step.`,
    python: `import pandas as pd

# each asset's OBSERVED sessions (or use exchange calendars directly)
us_days = spx.dropna().index
eu_days = sx5e.dropna().index
cr_days = btc.dropna().index          # ~365 days/year

# storage layer: the union -- nothing is dropped
union = us_days.union(eu_days).union(cr_days)
panel = pd.DataFrame({
    "spx": spx, "sx5e": sx5e, "btc": btc,
}).reindex(union)
# each column now shows NaN on the other venues' holidays -- honest gaps

# analysis layer: the intersection -- fully contemporaneous rows only
common = us_days.intersection(eu_days).intersection(cr_days)
sync = panel.loc[common]
corr = sync.pct_change().corr()       # every pair uses truly shared days

# strategy layer: the venue you actually trade from
book = panel.reindex(us_days)         # US book: world seen at US sessions`,
    trap: `Computing correlations straight off the union calendar. Pandas' corr pairwise-drops NaNs, so each asset pair is correlated over a different, holiday-dependent set of days -- the correlation matrix is internally inconsistent and can even fail to be positive semi-definite.`,
    followUp: `On the union calendar you forward-fill the equity columns so crypto's weekends have equity values. What has that done to the measured equity-vs-crypto correlation on Mondays?`,
  },
  {
    id: "qr-calendars-06-ffill-limit",
    module: "calendars",
    title: "Forward-fill limits",
    difficulty: "core",
    question: `After reindexing single stocks to your master calendar you forward-fill gaps with ffill(). A colleague says always pass a limit. What is the argument, and how do you choose the number?`,
    thinking: `First articulate what unlimited ffill claims: that the last observed price remains a fair estimate forever. For a one-day exchange holiday that claim is reasonable. For a stock that gets delisted, unlimited ffill carries its final print to the end of your dataset -- a zombie price contributing zero returns and fake stability to every statistic that touches it. Same for a long trading halt: the frozen price hides exactly the period where the true value was moving violently. The limit parameter caps how many consecutive NaNs get filled, so it acts as a statute of limitations on the staleness claim. Choose it from the longest gap you consider legitimate on that calendar: on a single-venue trading calendar, legitimate gaps are 0 days (holidays are not even in the index); on a union calendar, the longest run of other-venue-only days -- typically 3-5. Anything longer stays NaN and demands investigation rather than silent papering-over.`,
    answer: `Unlimited ffill asserts the last price stays valid forever -- which turns delistings into zombie flat-lines and halts into invisible risk. Passing limit=n only bridges gaps up to n days, leaving longer gaps as NaN so they surface for investigation. Choose n as the longest legitimate gap on your calendar: near zero on a true single-exchange calendar, roughly a week on a union calendar spanning venues with different holidays. Delistings should ideally be truncated before any filling, not filled around.`,
    python: `import pandas as pd

# reindex to master, then fill -- but only across SHORT, legitimate gaps
aligned = px.reindex(master)
filled = aligned.ffill(limit=3)      # bridge up to 3 consecutive missing days

# what limit=3 protects you from:
#   - delisted stock: last print would otherwise repeat for years
#   - long halt: frozen price would hide the risk exactly when it spiked
# those now stay NaN and show up here:
gap_report = filled.isna().sum().sort_values(ascending=False)

# find each column's longest gap to sanity-check the limit choice
def longest_gap(s: pd.Series) -> int:
    isna = s.isna()
    # consecutive-run trick: group NaN runs by the cumsum of "not NaN"
    runs = isna.groupby((~isna).cumsum()).sum()
    return int(runs.max()) if len(runs) else 0

worst = aligned.apply(longest_gap)   # per-column worst-case gap length
# if worst >> your limit for a live stock, the feed has a real problem`,
    trap: `Running ffill() with no limit as a routine cleanup step. It always "works", and every delisted name in your history becomes an eternal flat price -- deflating portfolio volatility, faking zero-return days, and quietly resurrecting dead stocks into your tradable universe.`,
    followUp: `Why is forward-fill the only defensible direction for prices -- what look-ahead crime does bfill commit that ffill does not?`,
  },
  {
    id: "qr-calendars-07-bday-arithmetic",
    module: "calendars",
    title: "Business-day arithmetic",
    difficulty: "core",
    question: `A trade executes on Wednesday July 3, 2024, and settles T+1 (one business day later). July 4 is a market holiday. How do you compute settlement dates for a whole column of trades, correctly and vectorized?`,
    thinking: `First reject the tempting wrong answer: trade_date + pd.Timedelta(days=1) adds a calendar day, landing this trade on July 4 -- a holiday when nothing settles. Business-day arithmetic needs an offset object that knows both weekends and the holiday list: pandas' CustomBusinessDay wraps exactly that. Then ask which holiday list. Settlement follows the settlement venue's calendar (for US equities, effectively the Fed/DTC schedule), which is close to but not identical to the exchange trading calendar -- the interview point is knowing they can differ, not memorizing either. Also nail the edge semantics: rolling forward from a date that is itself a business day should not move it, and adding one business day from Wednesday July 3 must skip both Thursday the 4th and land on Friday the 5th. Finally, vectorize: adding an offset to a whole datetime column works directly and pandas handles it efficiently -- no row loop.`,
    answer: `Never add calendar Timedeltas for settlement -- build a CustomBusinessDay carrying the settlement calendar's holidays, and add it to the trade-date column: trades["settle"] = trades["trade_date"] + CustomBusinessDay(1, calendar=cal). July 3 plus one business day skips July 4 and lands Friday July 5. Two refinements: settlement follows the settlement system's calendar, which is not always the exchange's; and the operation vectorizes over the whole column directly.`,
    python: `import pandas as pd
from pandas.tseries.holiday import USFederalHolidayCalendar
from pandas.tseries.offsets import CustomBusinessDay

# offset that knows weekends AND holidays
# (illustrative calendar -- production uses the settlement venue's own list)
bd = CustomBusinessDay(calendar=USFederalHolidayCalendar())

t = pd.Timestamp("2024-07-03")     # Wednesday before July 4th
settle = t + 1 * bd                # -> Friday 2024-07-05 (skips the holiday)

# WRONG: calendar-day arithmetic lands on the holiday itself
wrong = t + pd.Timedelta(days=1)   # -> 2024-07-04, market closed

# vectorized over a whole trade blotter -- no loops
trades["settle_date"] = trades["trade_date"] + 1 * bd

# related idioms worth knowing:
n_days = pd.bdate_range("2024-07-01", "2024-07-31", freq=bd)  # sessions in July
roll = pd.offsets.CustomBusinessDay(0, calendar=USFederalHolidayCalendar())
# adding a 0-day offset "rolls" a weekend/holiday date to the next session`,
    trap: `Using pd.Timedelta(days=n) or np.busday functions with the default weekmask and no holiday list. Both are off exactly around holidays -- rare enough to pass casual testing, frequent enough to misdate thousands of settlements a year in production.`,
  },
  {
    id: "qr-calendars-08-cross-market-align",
    module: "calendars",
    title: "Aligning US and Japanese equities",
    difficulty: "core",
    question: `You are researching a US-listed stock against its Japanese parent company. Japan has Golden Week and other holidays the US does not, and vice versa. How do you align the two daily series for a spread analysis?`,
    thinking: `Enumerate what misalignment does before choosing a fix. On a Japanese holiday the US stock trades but the parent does not: naive positional pairing shifts one series against the other from that day on, and even index-aligned pairing gives you a NaN or -- worse, if pre-filled -- a stale Tokyo price masquerading as fresh. First decision: inner join (dates both markets traded) versus union-plus-fill. For measuring the spread's statistical behavior -- mean, variance, cointegration -- inner is cleaner: every pair is genuinely contemporaneous. For running a live signal you need a value every US day, so union with a limited forward-fill of the Japanese side, plus an explicit staleness flag so the signal knows when it is looking at old Tokyo information. Second, subtler point: even on shared dates, Tokyo closed hours before New York opened, so the "daily spread" always compares prices about 14 hours apart -- that is an asynchronicity fact to model, not a bug to fix with fills.`,
    answer: `Depends on the use. For statistics on the spread -- variance, cointegration tests -- align on the intersection of the two calendars so every pair is genuinely contemporaneous. For a live signal, reindex both to the US calendar, forward-fill the Japanese leg with a small limit, and carry a staleness indicator so holiday-week signals are discounted or suppressed. And state the caveat: even on common dates, Tokyo's close precedes New York's by many hours, so daily pairs are asynchronous by construction.`,
    python: `import pandas as pd
import numpy as np

us = adr_px.dropna()        # US-listed line, US calendar
jp = parent_px.dropna()     # Tokyo line, Japanese calendar

# --- research alignment: intersection = truly contemporaneous pairs ---
common = us.index.intersection(jp.index)
pair = pd.DataFrame({"us": us, "jp": jp}).loc[common]
spread = np.log(pair["us"]) - np.log(pair["jp"])   # log spread (fx aside)

# --- live-signal alignment: US calendar, JP leg filled with a limit ---
live = pd.DataFrame({
    "us": us,
    "jp": jp.reindex(us.index).ffill(limit=5),   # bridge Golden Week, no more
}, index=us.index)

# staleness flag: how many days old is the JP price we are using?
jp_seen = jp.reindex(us.index)
days_since = jp_seen.notna().astype(int)
# cumcount trick: age resets to 0 on each real JP observation
grp = jp_seen.notna().cumsum()
live["jp_age"] = jp_seen.groupby(grp).cumcount()
# signal logic can now fade or skip entries when jp_age > 0`,
    trap: `Forward-filling the Japanese series without a staleness flag and then computing the spread's z-score. Around Golden Week the spread moves entirely because one leg is frozen -- the model reads a fat "dislocation" and trades it, when the only dislocation is that Tokyo was on holiday.`,
    followUp: `The pair is quoted in USD and JPY. On a Japanese holiday, USDJPY still trades. Does the FX leg of your spread follow the Tokyo equity calendar or its own, and what does that do to your fill policy?`,
  },
  {
    id: "qr-calendars-09-midnight-utc-bars",
    module: "calendars",
    title: "The midnight-UTC daily bar",
    difficulty: "core",
    question: `A new vendor delivers "daily" bars for global equities, every row stamped 00:00:00 UTC. Before using this in research, what questions do you ask, and what can go wrong if you don't?`,
    thinking: `A daily bar's timestamp is a label, and 00:00 UTC tells you nothing about which trading session the bar summarizes -- so interrogate the convention. Ask: does the 2024-03-07 00:00 UTC row for a Tokyo stock contain Tokyo's session of March 7 (which ended 06:00 UTC on the 7th), or the session that ended before that instant, i.e. March 6? Vendors do both. Getting it wrong shifts every Japanese series one day against your US series -- and a one-day shift in returns is catastrophic for research: lead-lag studies invert, and any cross-market signal picks up phantom predictability that is really just mislabeled contemporaneity. That phantom edge is the classic way this bug is discovered: the backtest looks brilliant. Also ask: what happens on half days, does the close include the auction, and are all venues on the same convention or per-venue? Verify empirically -- take a known volatile event (a US CPI release) and check which dated bar moves in each market.`,
    answer: `The stamp is a label, so I need the vendor's convention: for each venue, does the row dated D contain venue-local session D, or the last session completed before D? I would verify empirically -- pick a sharp global event and confirm which dated bar reacts in each market. If I guess wrong, Asian series shift a day relative to US ones, and cross-market studies show spurious predictability -- a backtest that looks great precisely because the data is broken. Also confirm half-day handling and whether the close includes the auction.`,
    trap: `Accepting a suspiciously strong "US predicts Asia next day" result at face value. With mislabeled bars, Asia's dated-D bar can actually contain the session influenced by (or even following) the US dated-D session -- the signal is a timestamp artifact, and it will earn exactly nothing live.`,
    followUp: `You confirm the convention differs per venue. Design the normalization layer: what timestamp do you re-stamp every bar with, and why is "session close time in UTC" a better canonical label than the session date?`,
  },
  {
    id: "qr-calendars-10-weekly-resample",
    module: "calendars",
    title: "Daily to weekly returns",
    difficulty: "core",
    question: `You have daily simple returns and need weekly returns for a lower-frequency model. Someone writes r.resample("W-FRI").sum(). What is wrong, what is right, and what happens in weeks where Friday is a holiday?`,
    thinking: `Recall what simple returns are: price relatives minus one, and they chain multiplicatively -- the week's growth factor is the product of the days' growth factors. Summing daily simple returns is only a first-order approximation; the error is the cross-terms, which are small per week but systematic, and they compound in anything cumulative. So the correct aggregation is (1+r).prod() - 1 inside each weekly bucket. (If you had log returns, summing would be exactly right -- know which type you hold.) Then think through the label mechanics: resample("W-FRI") buckets days into weeks ending Friday and labels each bucket with its Friday. A holiday Friday does not break the bucket -- the week's trading days still compound -- but the label now names a date with no session, and a downstream join keyed on trading days will drop or misalign it. Also decide the prod-over-empty edge: an all-NaN week should be NaN, not the misleading 0 that a naive prod gives.`,
    answer: `Simple returns compound multiplicatively, so the weekly return is the product of (1 + daily) minus one -- summation drops the cross-terms and biases everything cumulative. Correct: (1 + r).resample("W-FRI").prod() - 1, with care that all-NaN weeks return NaN rather than zero. Log returns, by contrast, do sum exactly. Holiday Fridays don't break bucketing -- days still compound within the week -- but the bucket label is a non-trading Friday, which can misalign later joins against trading-day-indexed data.`,
    python: `import pandas as pd

# WRONG: arithmetic sum ignores compounding cross-terms
weekly_approx = r.resample("W-FRI").sum()

# RIGHT: compound the growth factors inside each week
weekly = (1 + r).resample("W-FRI").prod() - 1

# edge case: a week with no observations
# prod over an empty/all-NaN bucket returns 1.0 -> weekly return 0.0 (a lie!)
# use min_count to force NaN when nothing was observed:
weekly = (1 + r).resample("W-FRI").prod(min_count=1) - 1

# demonstrate the bias with a volatile week: +10% then -10%
demo = pd.Series([0.10, -0.10])
approx = demo.sum()                 #  0.0000  (sum says flat)
exact = (1 + demo).prod() - 1       # -0.0100  (truth: down 1%)

# log returns are the additive species -- if you hold those, sum away:
# weekly_log = log_r.resample("W-FRI").sum(min_count=1)`,
    trap: `Using .prod() without min_count=1. An entirely missing week (market closure, data gap) silently becomes a 0% return instead of NaN, because the empty product is 1 -- injecting fake flat weeks that dampen volatility estimates.`,
    followUp: `Your weekly model trades at Friday's close. The weekly return labeled Friday includes Friday itself -- can a signal computed from this series be traded at that same close, or have you just built in look-ahead?`,
  },
  {
    id: "qr-calendars-11-dst-intraday",
    module: "calendars",
    title: "DST and intraday alignment",
    difficulty: "hard",
    question: `You align minute bars from New York and London to study lead-lag around the US open. Twice a year your alignment breaks by an hour for a few weeks. What is happening, and what is the robust design?`,
    thinking: `Diagnose first: the US and UK do not switch daylight saving time on the same weekend. The US springs forward in early March; the UK in late March -- and the autumn switches differ too. So for a few weeks a year the NY-London offset is 4 hours instead of the usual 5. Any alignment done in local wall-clock time -- "London 14:30 pairs with NY 09:30" -- silently shifts by an hour in those windows, exactly the kind of intermittent bug that corrupts a lead-lag study without ever raising. The robust design principle: wall-clock time is a display format, not a coordinate system. Convert every venue's timestamps to UTC immediately at ingestion (localize to the venue zone the vendor documents, then convert), do every join and alignment in UTC, and only translate back to local time for human-facing outputs. One subtlety survives even in UTC: the market open moves in UTC when NY shifts, so event-time studies should be anchored to the session's open event, not to a fixed UTC clock time.`,
    answer: `The US and UK change DST on different dates, so for a few weeks each spring and autumn the NY-London gap is 4 hours, not 5 -- any wall-clock-based pairing slips an hour exactly then. Robust design: treat local time as display only. Localize each feed to its documented venue zone at ingestion, convert to UTC, and align exclusively in UTC. For event studies around the open, anchor to the session-open event rather than a UTC clock time, since the open itself moves in UTC across DST changes.`,
    python: `import pandas as pd

# ingestion: pin each feed to its venue zone, then move to UTC immediately
ny = ny_bars.copy()
ny.index = ny.index.tz_localize("America/New_York").tz_convert("UTC")

ldn = ldn_bars.copy()
ldn.index = ldn.index.tz_localize("Europe/London").tz_convert("UTC")

# all alignment happens in UTC -- DST differences are now handled for free
both = ny.join(ldn, how="inner", lsuffix="_ny", rsuffix="_ldn")

# event-time anchoring: the NY open is 13:30 or 14:30 UTC depending on
# season, so locate it per-day instead of hardcoding a UTC time
ny_dates = ny.index.tz_convert("America/New_York")
is_open_bar = (ny_dates.hour == 9) & (ny_dates.minute == 30)
open_stamps = ny.index[is_open_bar]          # each day's true open, in UTC

# note tz_localize handles the two DST edge cases explicitly if they occur:
#   nonexistent times (spring-forward hole): nonexistent="shift_forward"
#   ambiguous times (fall-back repeat):      ambiguous="infer"`,
    trap: `Aligning on wall-clock offsets ("London = NY + 5") or, equally bad, stripping timezones and joining naive timestamps. Both pass tests written in mid-summer and silently misalign for the ~5 weeks a year when the two DST regimes disagree -- long enough to poison a study, rare enough to evade review.`,
    followUp: `Your vendor's London feed turns out to be stamped in UTC already, but the NY feed is in local exchange time. What single ingestion-layer contract prevents this class of bug from ever reaching research code?`,
  },
  {
    id: "qr-calendars-12-asof-fx-join",
    module: "calendars",
    title: "As-of joins across feeds",
    difficulty: "hard",
    question: `You need each stock's 4pm New York close converted to euros using the FX rate prevailing at that moment. FX ticks arrive on their own irregular timestamps. An exact-timestamp join returns almost nothing. What is the right tool and what are its sharp edges?`,
    thinking: `Recognize the shape of the problem: two event streams with unrelated timestamps, and for each event in one you want the most recent event from the other. Exact joins fail because the probability of identical stamps is essentially zero. The tool is the as-of join -- pd.merge_asof -- which for each left row picks the last right row at or before it. Now enumerate the sharp edges, because they are the interview. Direction: backward is the only look-ahead-safe choice; forward or nearest would hand your 4pm valuation an FX print from the future. Sortedness: merge_asof requires both frames sorted by the join key and will raise otherwise -- do not "fix" that by sorting a copy and losing your row order silently. Tolerance: without one, a stale rate from hours ago silently fills in after an FX feed outage; with tolerance you get NaN and a visible problem. Timezones: both streams must be in the same aware zone -- convert both to UTC first, or the "most recent" tick is computed on incomparable clocks.`,
    answer: `Use pd.merge_asof with direction="backward": for each equity close it takes the latest FX tick at or before that instant -- the point-in-time-correct rate. Requirements and edges: both frames sorted by timestamp and in the same timezone (convert both to UTC first); direction backward only, since nearest or forward smuggles future information into the valuation; and set a tolerance so a feed outage produces an honest NaN instead of a silently stale rate. By="ticker" handles grouped joins if rates differ per instrument.`,
    python: `import pandas as pd

# both streams to UTC-aware timestamps FIRST -- asof compares clocks directly
eq = eq_closes.copy()     # one row per stock per day, ts_utc = 4pm NY in UTC
fx = fx_ticks.copy()      # irregular EURUSD ticks, ts_utc

eq = eq.sort_values("ts_utc")     # merge_asof REQUIRES sorted keys
fx = fx.sort_values("ts_utc")

joined = pd.merge_asof(
    eq, fx,
    on="ts_utc",
    direction="backward",              # latest tick AT OR BEFORE the close:
                                       # the only look-ahead-safe direction
    tolerance=pd.Timedelta("15min"),   # stale beyond 15min -> NaN, not a lie
)

# audit what the tolerance caught -- these are feed gaps, not noise
missing_fx = joined["eurusd"].isna().sum()

# convert: USD close over EURUSD -> EUR close
joined["close_eur"] = joined["close_usd"] / joined["eurusd"]

# if joining many FX pairs to many stocks, use by= for per-group asof:
# pd.merge_asof(eq, fx, on="ts_utc", by="ccy_pair", direction="backward")`,
    trap: `direction="nearest". It reads as harmless -- "just take the closest tick" -- but half the time the closest tick is after the close, so your valuation uses information from the future. In a backtest this is look-ahead; in production it is a rate that did not exist yet. Backward, always, for point-in-time work.`,
    followUp: `The FX desk says the honest rate for a 4pm NY equity close is the 4pm WM/Refinitiv fix, not the last tick. What is the difference between "last tick before T" and "the fixing at T", and when does it matter?`,
  },
  {
    id: "qr-calendars-13-alignment-leak",
    module: "calendars",
    title: "The stale-alignment leak",
    difficulty: "hard",
    question: `A researcher reindexes 40 global assets to the union of all their calendars, forward-fills everything, and reports a beautiful risk model: low volatilities, smooth correlations, great diversification. Why should you distrust every one of those numbers?`,
    thinking: `Trace what union-plus-unlimited-ffill manufactures. Every venue holiday inserts a filled row whose return is exactly zero. Zero-return days mechanically shrink measured volatility -- each asset's vol is now averaged over real days and fake flat days. They also spike lag-1 autocorrelation artificially and, crucially, they corrupt every off-diagonal: on Japan's holiday the Japanese asset shows 0 while the US asset moves, dragging the measured correlation toward zero and making "diversification" appear where none exists. So low vol, smooth correlations, and great diversification are precisely the signature of the bug -- the result looks better because it is wrong. Layer on the asynchronous-close effect (Tokyo closed 14 hours before New York even on shared days, which also biases daily correlations down -- the Epps-type effect) and the risk model systematically understates both individual and joint risk. The fixes: compute moments on the intersection calendar or with pairwise-complete real observations, mask filled values out of return calculations, and use weekly returns to soften asynchronicity.`,
    answer: `Forward-filling on the union calendar injects a zero return for every venue holiday. Zeros deflate each asset's measured volatility, and -- because the other market moves on those days -- drag cross-correlations toward zero, so the model reports diversification that is purely a data artifact. Asynchronous closes bias daily correlations down further. The portfolio's true risk is higher on both counts. Fix: estimate moments only on genuinely observed, contemporaneous returns -- intersection calendar or masked fills -- and check robustness at weekly frequency where asynchronicity fades.`,
    trap: `Auditing the pipeline by eyeballing the price matrix -- filled prices look perfectly plausible. The corruption only exists in return space (impossible exact zeros) and in the moments computed from it. The tell is statistical: count exact-zero returns per asset and compare with the venue's holiday count; a match convicts the fill.`,
    followUp: `You switch the risk model to weekly returns on the intersection calendar and correlations jump from 0.35 to 0.55. Which number does the portfolio's realized P&L variance actually obey, and how would you verify that out of sample?`,
  },
  {
    id: "qr-calendars-20260808-half-day-sessions",
    module: "calendars",
    title: "Half-day and early-close sessions",
    difficulty: "warmup",
    question: `Your trading calendar marks every weekday as either "open" or "holiday". December 24th is neither -- it is a half-volume session that closes at 1pm instead of 4pm. An intraday feature that normalizes by "fraction of the session elapsed" looks broken only on this one day, every single year. What is wrong, and how do you fix the calendar?`,
    thinking: `The bug is a modeling choice, not a data error: a calendar that stores open/closed as a boolean has thrown away information the feature actually needs, namely each day's session length. Half days -- the day after Thanksgiving, Christmas Eve, July 3rd in the US -- close around 1pm on roughly half the normal minutes. Any feature computed as "minutes since open divided by minutes in a full session", or any intraday z-score benchmarked against an average session, silently assumes every day has the same length and breaks exactly on these days. The fix is to store explicit open and close TIMESTAMPS per date, not a trading/non-trading flag, ideally sourced from a maintained exchange-calendar library rather than hand-rolled, so every normalization divides by that day's actual session length.`,
    answer: `The calendar is storing a boolean when the feature needs a session LENGTH. Half days have genuine 1pm closes, so "elapsed over full session" silently divides by the wrong denominator. Fix by storing explicit per-date open/close timestamps -- from a maintained exchange calendar, not a hand-rolled holiday list -- and computing elapsed fraction against that day's actual close, not a hardcoded 4pm.`,
    python: `import pandas as pd

# WRONG: a single hardcoded close time used for every date
SESSION_CLOSE = "16:00"   # breaks silently every Dec 24, day after Thanksgiving...

# RIGHT: per-date session close, half days included explicitly
EARLY_CLOSES = {          # dates -> actual close time, from the exchange calendar
    "2026-11-27": "13:00",
    "2026-12-24": "13:00",
}

def session_close(date: pd.Timestamp) -> pd.Timestamp:
    key = date.strftime("%Y-%m-%d")
    close_time = EARLY_CLOSES.get(key, "16:00")
    return pd.Timestamp(f"{key} {close_time}")

def frac_of_session_elapsed(ts: pd.Timestamp) -> float:
    day_open = pd.Timestamp(f"{ts.strftime('%Y-%m-%d')} 09:30")
    day_close = session_close(ts)
    total = (day_close - day_open).total_seconds()
    elapsed = (ts - day_open).total_seconds()
    return max(0.0, min(1.0, elapsed / total))   # correct on Dec 24 too`,
    trap: `Hardcoding "16:00" as the market close anywhere in feature code instead of reading it from the calendar per date. It works 250-odd days a year and quietly corrupts the same handful of half days every single year, which is exactly the kind of bug that survives code review because it "mostly works".`,
    followUp: `Half days also carry thin volume, not just short duration. Should that day's return get full weight in a volatility estimate that assumes i.i.d. daily variance, and how would you flag it?`,
  },
  {
    id: "qr-calendars-20260809-annualization-constant",
    module: "calendars",
    title: "The fixed 252 annualization constant",
    difficulty: "warmup",
    question: `You annualize a Sharpe ratio by multiplying the daily Sharpe by sqrt(252) in every script you write, and a colleague points out that 2024 actually had 252 trading days but 2023 had 250, and crypto data has 365. Does the constant matter, and how do you handle it correctly?`,
    thinking: `Trace where 252 actually comes from: it is the long-run average of US equity trading days per year, holidays included, not a universal constant -- individual years range roughly 250 to 253 depending on how holidays land on weekdays. For one strategy's own history, using sqrt(252) consistently is an internally-consistent, industry-standard convention, and swapping in the exact year's day count changes the annualized number by well under one percent -- not worth chasing. The real danger appears when you compare across DIFFERENT calendars: annualizing a crypto strategy's daily Sharpe with sqrt(252) when it actually trades all 365 days a year overstates its annualized Sharpe by roughly the square root of 365 over 252, about 20 percent -- large, systematic, and easy to miss when two tearsheets sit side by side.`,
    answer: `Within one calendar, sqrt(252) is a stable convention and swapping in the exact year's trading-day count changes results by well under 1% -- not worth the complexity. The real risk is cross-calendar comparison: annualizing a 365-day crypto strategy with sqrt(252) inflates its Sharpe by about 20% relative to using sqrt(365). Always annualize with the asset's own actual trading-day count, and state the convention explicitly when comparing Sharpes across asset classes.`,
    python: `import numpy as np

# same underlying daily Sharpe, two different assets
sr_daily = 0.08

equities_ann = sr_daily * np.sqrt(252)   # standard US equity convention
crypto_ann = sr_daily * np.sqrt(365)     # crypto trades every calendar day

# same daily skill, annualized Sharpe differs by sqrt(365/252) ~ 1.20 --
# a fair cross-asset comparison must annualize each on ITS OWN calendar
inflation_if_mislabeled = crypto_ann / equities_ann
print(round(inflation_if_mislabeled, 3))   # ~1.203

# within one equity calendar, the exact day count barely matters:
for actual_days in [250, 251, 252, 253]:
    print(actual_days, round(sr_daily * np.sqrt(actual_days), 4))
# spread across the whole range is under 0.6% of the Sharpe value`,
    trap: `Directly comparing a headline "Sharpe 2.4" from a crypto desk against a "Sharpe 2.0" from an equities strategy without checking which annualization each used. If the crypto number used sqrt(365) and the equities number used sqrt(252), part of the crypto strategy's apparent edge is pure annualization convention, not skill.`,
    followUp: `A futures strategy trades a market that is open about 260 days a year, but the underlying commodity has seasonal patterns tied to the calendar year, not the trading calendar. Does that change which day count you annualize with?`,
  },
  {
    id: "qr-calendars-20260810-settlement-date",
    module: "calendars",
    title: "T+1 settlement dates with a holiday calendar",
    difficulty: "core",
    question: `You need to compute each trade's settlement date under T+1 (one business day after trade date), and the trading calendar has US market holidays plus weekends to respect. A naive trade_date + pd.Timedelta(days=1) is wrong whenever the trade lands on a Friday or just before a holiday. How do you compute this correctly and vectorized across a whole trade blotter?`,
    thinking: `The core mistake is treating "one business day" as calendar-day arithmetic -- and only the two happen to coincide most of the time, which is exactly what makes the bug hide until a Friday or holiday trade slips through review. The right tool is pandas' offset machinery: an offset built from a supplied holiday list already knows to skip weekends and those specific dates, and adding it to a Series of dates vectorizes over the whole blotter in one call -- no explicit loop, no per-row branching for "was this a Friday". Also separate two holiday sets you might otherwise conflate: exchange trading holidays (when the market itself is closed) and settlement or bank holidays (when the clearing and banking system is closed) -- a day can be a bank holiday without being a market holiday, and settlement respects the latter.`,
    answer: `Do not add raw calendar days. Build a business-day offset from the relevant holiday calendar -- settlement or bank holidays, which can differ from the exchange's trading-holiday list -- and add that offset to the trade date column directly. That vectorizes over the whole blotter and correctly skips weekends and holidays, including consecutive ones, without any per-row special casing for Fridays.`,
    python: `import pandas as pd
from pandas.tseries.offsets import CustomBusinessDay

# holidays relevant to SETTLEMENT, not necessarily identical to the
# exchange's trading-holiday list -- banks can be closed when markets trade
settlement_holidays = pd.to_datetime([
    "2026-01-01", "2026-01-19", "2026-02-16", "2026-05-25",
])

t_plus_1 = CustomBusinessDay(n=1, holidays=settlement_holidays)

blotter = pd.DataFrame({
    "trade_id": [1, 2, 3],
    "trade_date": pd.to_datetime(["2026-05-22", "2026-05-25", "2026-05-15"]),
    # a Friday, a Monday holiday, and an ordinary Friday
})

# vectorized over the whole blotter -- no loop, no Friday special case
blotter["settle_date"] = blotter["trade_date"] + t_plus_1

# sanity: settle_date must always land on a real business day
zero_step = CustomBusinessDay(n=0, holidays=settlement_holidays)
assert (blotter["settle_date"] + zero_step == blotter["settle_date"]).all()`,
    trap: `Hardcoding "+3 calendar days" as a stand-in for T+1 "to be safe", or adding pd.Timedelta(days=1) and manually nudging Saturday and Sunday forward by hand. Both silently mis-settle around every US holiday that lands on a weekday, and the manual weekend nudge alone does not know about holidays at all.`,
    followUp: `The exchange's trading-holiday calendar and the bank settlement-holiday calendar disagree on Good Friday -- markets are closed, banks are open. Which calendar should govern settlement, and what breaks if you use the wrong one?`,
  },
  {
    id: "qr-calendars-20260811-day-count-conventions",
    module: "calendars",
    title: "Day-count conventions: Act/360 vs Act/365 vs 30/360",
    difficulty: "core",
    question: `You are computing the interest accrued on a repo funding leg between two dates and a colleague asks which day-count convention the calculation uses. What do Act/360, Act/365 (Fixed), and 30/360 each mean, why do they give different numbers for the identical two dates, and which corners of the market default to which?`,
    thinking: `A day-count convention answers one narrow question: what fraction of a year elapsed between two dates, for the purpose of scaling an annualized rate into a period's interest. Act/360 counts the actual number of calendar days between the dates but divides by an assumed 360-day year -- a market convention, not an error, and because 365 over 360 is bigger than one, it produces a slightly LARGER fraction (and so more accrued interest) than counting a true 365-day year would for the same actual days elapsed. Act/365 Fixed counts actual days over a flat 365, ignoring leap years entirely. 30/360 does not even count actual days -- it assumes every month has exactly 30 days and every year 360, so it can disagree with the other two even in SIGN of the day gap around month-end dates. None of these is universally right: Act/360 is standard for USD money markets, repo, and SOFR-linked funding; Act/365 Fixed shows up in GBP markets; 30/360 is the traditional US corporate bond coupon convention. The practical danger is not picking the wrong one in isolation -- it is using two different conventions on the two legs of the same trade (say, financing cost on Act/360 against a strategy return computed as a calendar-day simple return) and quietly biasing your net P&L by the gap between them, compounded over every rebalance.`,
    answer: `Act/360 divides actual calendar days elapsed by an assumed 360-day year and is standard for USD money-market and repo funding; Act/365 Fixed divides by a flat 365 and shows up in GBP markets; 30/360 assumes 30-day months and a 360-day year and is the traditional US corporate bond convention -- it does not even count real calendar days. They diverge because each rescales the same actual time gap by a different denominator, and 30/360 can disagree with the others in sign around month-end. The real risk is mixing conventions across the two legs of one trade, which silently biases financing cost or accrued interest every period.`,
    python: `import pandas as pd

start = pd.Timestamp("2026-01-15")
end = pd.Timestamp("2026-04-15")   # 90 actual calendar days apart
actual_days = (end - start).days

rate = 0.05   # annualized rate being accrued

# Act/360: actual days over an assumed 360-day year -- USD money markets, repo
frac_act360 = actual_days / 360.0
accr_act360 = rate * frac_act360

# Act/365 Fixed: actual days over a flat 365 -- common in GBP markets
frac_act365 = actual_days / 365.0
accr_act365 = rate * frac_act365

# 30/360: assumes 30-day months, 360-day year -- traditional US bond coupons.
# does NOT count real calendar days -- computed from the date components:
def days_30_360(d0, d1):
    d0d = min(d0.day, 30)
    d1d = min(d1.day, 30) if d0d == 30 else d1.day
    return (d1.year - d0.year) * 360 + (d1.month - d0.month) * 30 + (d1d - d0d)

frac_30360 = days_30_360(start, end) / 360.0
accr_30360 = rate * frac_30360

print(actual_days, round(accr_act360, 5), round(accr_act365, 5), round(accr_30360, 5))
# same two dates, three different accrued-interest numbers -- none is "wrong",
# each is answering a different market's contractual definition of a year`,
    trap: `Treating "365" as the universally safe, conservative default because it "counts real days". Act/365 is not conservative relative to Act/360 -- since 360 is the smaller denominator, Act/360 accrues MORE interest for the same actual days, so defaulting to 365 on a funding leg that is contractually Act/360 systematically UNDERSTATES your true financing cost, not overstates it.`,
    followUp: `A cross-currency financing trade pays USD Act/360 on one leg and receives GBP Act/365 on the other. Even if the quoted annualized rates look identical, does the trade break even over a year? (No -- Act/360's smaller denominator makes it accrue faster per actual day, so the USD leg's true cost exceeds the GBP leg's true income at the same quoted rate; you must convert both to a common basis before comparing.)`,
  },
  {
    id: "qr-calendars-20260812-trading-days-vs-calendar-days",
    module: "calendars",
    title: "Trading days vs calendar days for lookback windows",
    difficulty: "warmup",
    question: `Your spec says "60-day momentum" but doesn't say which kind of day. You write df["close"].pct_change(60) directly on a price series indexed only by trading days. What are you actually computing, and where would a naive calendar-day approach go wrong instead?`,
    thinking: `Since the index already contains only trading days -- weekends and holidays were never rows to begin with -- an integer window like pct_change(60) or rolling(60) counts 60 ROWS, which means 60 trading days, roughly 84 to 87 calendar days once you account for weekends and holidays. That is the standard meaning of "N-day momentum" in quant research. The trap is reindexing onto a calendar-day DatetimeIndex first (forward-filling weekends "to be safe") and then taking the same integer window: 60 rows on that index only spans about 60 times 5/7, roughly 43 trading days, a silently shorter and partly duplicated-value window than the spec intended.`,
    answer: `Because the index is trading-day-only, pct_change(60) counts 60 ROWS, i.e. 60 trading days, roughly 84-87 calendar days -- the standard meaning of "N-day momentum". If you instead reindexed onto a calendar-day DatetimeIndex (forward-filling weekends) before calling rolling(60), the same 60-row window would only span about 43 trading days, quietly shrinking your lookback. Always know whether an integer window is running on a trading-day or calendar-day index before trusting the number in the spec.`,
    python: `import pandas as pd

# trading-day-only index -- weekends/holidays are simply absent as ROWS
px = pd.Series(closes, index=trading_day_index)

# pct_change(60) / rolling(60) count 60 ROWS -- correct for "60 trading days"
mom_60td = px.pct_change(60)

# THE MISTAKE: reindex onto a calendar-day index first (weekends inserted,
# forward-filled), THEN take a 60-row window
calendar_idx = pd.date_range(px.index.min(), px.index.max(), freq="D")
px_calendar = px.reindex(calendar_idx).ffill()
mom_60_wrong = px_calendar.pct_change(60)
# 60 rows here span only ~60 * 5/7 ~= 43 trading days -- a shorter, diluted
# window than intended, padded with repeated (ffilled) weekend values

# to window by CALENDAR time regardless of index density, use an offset
# string instead of an integer -- rolling("90D") counts elapsed calendar days
mom_90cd = px.rolling("90D").apply(lambda w: w.iloc[-1] / w.iloc[0] - 1)`,
    trap: `Reindexing prices onto a calendar-day DatetimeIndex "to be safe" before computing an integer-window rolling stat. The window still counts rows, but now most of the extra rows are forward-filled duplicates of the last real price, so the effective trading-day lookback shrinks by roughly 2/7 with no error or warning.`,
  },
  {
    id: "qr-calendars-20260813-month-end-rebalance-dates",
    module: "calendars",
    title: "Generating month-end rebalance dates",
    difficulty: "warmup",
    question: `You need the list of actual trading dates your monthly-rebalanced strategy trades on -- the last trading day of each calendar month, not the calendar's last day of the month, which is frequently a weekend or holiday. How do you generate that list correctly from a price panel's trading calendar?`,
    thinking: `The wrong instinct is to build calendar month-end dates with a date offset like pd.tseries.offsets.MonthEnd and use those directly -- July 31st, 2026 might be a Saturday, and no trade happens on a day the exchange is closed. The right anchor is your trading calendar itself, not the generic Gregorian calendar: group your actual trading-day index by year and month, and take the LAST trading day observed in each group -- that is guaranteed to be a real session because it came from the trading calendar, not from an offset that knows nothing about holidays. This is the same "derive from what actually happened, don't compute from the abstract calendar" instinct as trading-day vs calendar-day lookback windows, just applied to picking specific dates instead of window lengths.`,
    answer: `Group the trading-day DatetimeIndex by year and month and take the max (last) date in each group -- that date is guaranteed to be an actual session since it came from the observed calendar, not from a generic offset. Do not use pd.tseries.offsets.MonthEnd or a plain date_range with freq="M" directly as trade dates: the calendar month's last day is frequently a weekend or holiday your exchange never traded on.`,
    python: `import pandas as pd

# trading_days: DatetimeIndex of every actual session in your price panel
trading_days = pd.DatetimeIndex(sorted(px["date"].unique()))

# group by (year, month) on the REAL trading calendar, take the last session
month_ends = (
    pd.Series(trading_days, index=trading_days)
    .groupby([trading_days.year, trading_days.month])
    .max()
    .sort_values()
)
month_ends = pd.DatetimeIndex(month_ends.values)

# WRONG comparison: generic calendar month-end, ignorant of holidays/weekends
naive = pd.date_range(trading_days.min(), trading_days.max(), freq="ME")
# naive dates land on weekends whenever the calendar month truly ends there --
# using them directly to slice the price panel produces empty/NaN rows

mismatch = (~naive.isin(trading_days)).sum()
print("naive month-ends that are not real sessions:", mismatch)`,
    trap: `Using freq="BM" (business month end) instead of freq="ME" and assuming that fixes it. "Business day" only means Monday-through-Friday -- it still has no idea about exchange holidays like Thanksgiving or Christmas, so a BM-generated date can land on a real holiday and still miss the actual last trading session of the month.`,
  },
  {
    id: "qr-calendars-20260814-busday-count",
    module: "calendars",
    title: "Counting trading days with np.busday_count",
    difficulty: "warmup",
    question: `You need the number of trading days between a signal date and its 5-trading-day-later evaluation date, skipping weekends and a holiday calendar. Someone on the team just does (end - start).days. What's wrong, and what's the fix?`,
    thinking: `(end - start).days counts every calendar day in between, weekends and holidays included, so it silently overstates how many actual trading sessions elapsed. If you're using that number to annualize a return, size a lookback window, or check that exactly 5 sessions passed before evaluating a signal, you'll be systematically off by however many weekend days (and holidays) fall in the range -- worse the longer the window. np.busday_count(start, end, holidays=...) is built for exactly this: pass a weekmask (defaults to Mon-Fri) and an explicit holiday list, and it counts business days in the half-open interval [start, end). The fix isn't just "divide by 5/7" -- holidays vary by exchange and year, so an explicit holiday list (or a real trading-calendar library) is the only robust answer.`,
    answer: `(end - start).days counts calendar days, so it overcounts trading days by however many weekends (and holidays) fall in the window -- worse for longer spans. Use np.busday_count(start, end, holidays=[...]) which counts business days in a half-open interval and lets you pass an explicit holiday list or custom weekmask. For real exchange calendars (half-days, exchange-specific holidays) reach for a maintained trading calendar library instead of hand-rolling the holiday list.`,
    python: `import numpy as np
import pandas as pd

start = np.datetime64("2024-06-03")
end = np.datetime64("2024-06-14")

# trading days between two dates, excluding weekends and any listed holidays
holidays = ["2024-06-19"]   # e.g. Juneteenth -- outside this range, shown for the pattern
n_trading_days = np.busday_count(start, end, holidays=holidays)
print("trading days:", n_trading_days)   # 9

# the naive bug: counts every calendar day, weekends included
naive = (pd.Timestamp(end) - pd.Timestamp(start)).days
print("naive calendar days:", naive)     # 11 -- overcounts by the two weekend days`,
    trap: `Approximating trading days as calendar_days * 5/7 -- close on average over a full year, but wrong for any specific short window, and it ignores holidays entirely.`,
  },
  {
    id: "qr-calendars-20260815-custom-business-day",
    module: "calendars",
    title: "CustomBusinessDay: encoding an exchange's own holiday calendar",
    difficulty: "core",
    question: `You start covering LSE-listed stocks and build your date index with pd.bdate_range(start, end) -- the same call you've always used for US names. The resulting dates include UK bank holidays like the late-May and August bank holidays, where your vendor has no data at all. What's wrong with the calendar, and how do you fix it per-exchange?`,
    thinking: `bdate_range and the plain BDay offset only know Monday-through-Friday -- they have zero notion of holidays, US or otherwise, so "business day" there just means "not a weekend." That happened to look right for US equities only because someone (maybe you) was separately dropping NYSE holidays elsewhere, or never noticed the gap. Every exchange has its own holiday set, so the fix is CustomBusinessDay, which takes an explicit holidays list or a full pandas.tseries.holiday.AbstractHolidayCalendar with the exchange's actual rules. The real risk of skipping this isn't cosmetic: reindexing your data onto a calendar that includes a day the exchange was closed manufactures a phantom trading day, which then either shows a stale forward-filled price mislabeled as fresh, or a NaN in a spot the pipeline doesn't expect and silently forward-fills anyway.`,
    answer: `bdate_range only excludes weekends, not holidays, so it's wrong for any exchange whose holidays differ from what you've implicitly assumed. Use pd.tseries.offsets.CustomBusinessDay with an explicit holidays list (or a full AbstractHolidayCalendar subclass encoding the exchange's rules) per market, and build a separate calendar object for each exchange you cover -- a US calendar reused for LSE or TSE names will misplace trading days on both sides: showing phantom sessions on their holidays and missing real half-days like Christmas Eve.`,
    python: `import pandas as pd
from pandas.tseries.offsets import CustomBusinessDay

# minimal: explicit holiday list per exchange
uk_holidays = pd.to_datetime([
    "2026-01-01", "2026-04-03", "2026-04-06",  # New Year, Good Fri, Easter Mon
    "2026-05-25", "2026-08-31", "2026-12-25", "2026-12-28",
])
lse_bday = CustomBusinessDay(holidays=uk_holidays)

lse_dates = pd.date_range("2026-05-20", "2026-06-01", freq=lse_bday)
# 2026-05-25 (bank holiday) is correctly excluded

# each exchange gets its OWN calendar object -- never reuse across markets
us_bday = pd.tseries.offsets.BDay()  # fine only if you separately drop NYSE holidays
nyse_dates = pd.bdate_range("2026-05-20", "2026-06-01")  # would wrongly include US Memorial Day too`,
    trap: `Using one global "business day" calendar (often implicitly the US one, since that's usually built first) across every market the desk trades. It silently misaligns non-US names on both their local holidays and yours, and the bug only surfaces as scattered stale-price or NaN incidents that look unrelated until someone maps them back to specific dates.`,
    followUp: `LSE also has occasional early closes (e.g., Christmas Eve) that aren't full holidays. Does CustomBusinessDay handle partial sessions, and if not, where does that logic have to live instead?`,
  },
  {
    id: "qr-calendars-20260816-time-based-rolling-window",
    module: "calendars",
    title: "Time-based rolling windows: rolling('30D') vs rolling(30)",
    difficulty: "warmup",
    question: `Your daily price panel has occasional missing trading days -- a holiday a vendor didn't flag, a listing that started mid-year. Should a 20-day momentum feature use df["close"].rolling(20) or df["close"].rolling("20D"), and what actually differs between them?`,
    thinking: `An integer window counts ROWS: rolling(20) always averages exactly the last 20 observations, no matter how many calendar days they happen to span. A string offset window counts elapsed TIME: rolling("20D") needs a sorted DatetimeIndex and averages whatever falls within the trailing 20 calendar days -- however many rows that is, shrinking right after a gap since fewer observations exist in that stretch. For ordinary equity momentum you almost always want the first behavior, because "20 trading days" is the economically meaningful lookback -- a fixed number of price observations -- not "20 calendar days" of a market that wasn't even open most of that span. The time-based window earns its keep in a different situation: aligning a sparse or irregularly-timed series (something that updates weekly, or a feed with real outages) onto elapsed time, where you genuinely want window membership to adapt to how much real time has passed rather than pretending sparse observations are adjacent trading-day bars.`,
    answer: `rolling(20) is a fixed-count window: exactly the last 20 rows, regardless of the calendar time they span. rolling("20D") is a time-based window: every row within the trailing 20 calendar days, whatever count that is -- it requires a sorted DatetimeIndex and shrinks around gaps. Use the integer window for trading-day momentum; reach for the offset string only when aligning sparse or irregular series onto elapsed real time.`,
    python: `import pandas as pd

idx = pd.to_datetime(
    ["2026-01-02", "2026-01-05", "2026-01-06",
     "2026-01-20", "2026-01-21", "2026-01-22"]
)
# a 2-week gap between Jan 6 and Jan 20 -- e.g. a trading halt
px = pd.Series([100, 101, 99, 102, 103, 104], index=idx)

# fixed-count window: always averages exactly 3 OBSERVATIONS, even
# though the 3rd window straddles a 2-week real-time gap
count_window = px.rolling(3).mean()

# time-based window: averages whatever falls in the trailing 3
# CALENDAR days -- right after the gap that's just 1 observation
time_window = px.rolling("3D").mean()

print(count_window.iloc[3])  # uses rows at Jan 5, 6, 20 -- always 3
print(time_window.iloc[3])   # only Jan 20 itself is within 3 days`,
    trap: `Using rolling("20D") on a MultiIndex panel (date, ticker) without first grouping by ticker. The time window slides across TICKERS too on a flat frame, silently blending unrelated names' observations near the boundary. Always groupby(level="ticker").rolling("20D"), never rolling("20D") on a mixed panel directly.`,
    followUp: `A field only updates weekly (e.g., short interest) but you need it on the daily grid. Would you reindex-then-ffill or use a time-based rolling on the raw irregular series -- and when does the difference actually matter?`,
  },
  {
    id: "qr-calendars-20260817-fiscal-year-anchored-offsets",
    module: "calendars",
    title: "Fiscal-year-anchored offsets: QS-JAN vs QS-APR for non-calendar fiscal years",
    difficulty: "warmup",
    question: `A company's fiscal year starts in April, not January (common for retailers and some Asian issuers). You need a series of that company's fiscal-quarter-start dates to align quarterly fundamentals data. What's wrong with just using pd.date_range(freq="QS"), and how do you fix it?`,
    thinking: `freq="QS" anchors quarter starts to the calendar year -- Jan, Apr, Jul, Oct -- which happens to be right for a calendar-year filer but silently wrong for anyone else. pandas' anchored offsets let you pick the anchor month directly: "QS-APR" means quarter starts anchored so the fiscal year begins in April, giving you Apr, Jul, Oct, Jan instead. This isn't cosmetic -- if you align a retailer's fundamentals using calendar quarter-starts, you'll bucket a print into the wrong fiscal quarter, and every fundamentals-driven feature computed off the wrong period boundary is a few weeks to a few months out of alignment relative to what actually happened. Always check the exchange/filing calendar for a name's actual fiscal year-end, not assume calendar-year.`,
    answer: `date_range(freq="QS") anchors to the calendar year, so it's silently wrong for fiscal years that don't start in January. Use the anchored variant, freq="QS-APR" (or the matching month), which shifts every quarter-start to align with the company's actual fiscal calendar -- getting this wrong misattributes fundamentals to the wrong fiscal quarter, offsetting every downstream feature by up to a quarter.`,
    python: `import pandas as pd

# WRONG for an April fiscal-year-start company: assumes calendar year
calendar_qtrs = pd.date_range("2025-01-01", periods=4, freq="QS")
# -> Jan, Apr, Jul, Oct 2025

# RIGHT: anchor the quarter-start offset to April
fiscal_qtrs = pd.date_range("2025-01-01", periods=4, freq="QS-APR")
# -> Apr, Jul, Oct 2025, Jan 2026 -- matches the company's actual FY

# same anchoring works for fiscal year-end too
fiscal_year_ends = pd.date_range("2025-01-01", periods=2, freq="A-MAR")
# -> fiscal years ending in March, e.g. many Japanese and UK filers`,
    trap: `Assuming every company in your universe shares one fiscal calendar. A US retailer, a Japanese conglomerate, and a UK bank in the same panel can each anchor differently -- you need the anchor month per issuer, not one global freq string for the whole universe.`,
    followUp: `How would you store this per-ticker instead of hardcoding one anchor? (Keep a fiscal_year_end_month column per ticker from the reference data vendor, and generate each name's own anchored date_range in a groupby rather than assuming one calendar for the universe.)`,
  },
  {
    id: "qr-calendars-20260818-weekmask-sun-thu",
    module: "calendars",
    title: "Custom weekmask: markets with a Sunday-Thursday trading week",
    difficulty: "warmup",
    question: `You're building a master calendar that includes Saudi Arabia's Tadawul exchange, which trades Sunday through Thursday, not Monday through Friday like US markets. If you reindex Tadawul prices onto a standard pd.bdate_range, what breaks, and how do you build a calendar that actually matches?`,
    thinking: `The default business-day frequency ("B") hardcodes Monday-Friday as the working week -- it's not derived from any actual exchange, it's just a US/Europe convention baked into the offset. Reindexing a Sunday-Thursday market onto a Monday-Friday grid means Friday and Saturday show up as spurious trading days (forward-filled with a stale Thursday close) while Sunday, an actual trading day with real new information, gets dropped from the index entirely -- exactly backwards. pandas' CustomBusinessDay offset takes a weekmask argument (a string like "Sun Mon Tue Wed Thu") that overrides which weekdays count as business days, so bdate_range with freq=CustomBusinessDay(weekmask=...) generates the correct grid. For a multi-region universe, this means the "master calendar" isn't one object -- each market segment needs its own weekmask, unioned together before you reindex anything cross-market.`,
    answer: `The default "B" frequency assumes a Monday-Friday week, which is wrong for Tadawul's Sunday-Thursday schedule -- reindexing onto it fabricates Friday/Saturday as stale trading days and silently drops real Sunday data. Use pandas.tseries.offsets.CustomBusinessDay with weekmask="Sun Mon Tue Wed Thu" to build a calendar that matches the actual exchange schedule, and for a multi-region universe, build each region's calendar separately with its own weekmask before unioning them.`,
    python: `import pandas as pd
from pandas.tseries.offsets import CustomBusinessDay

# Tadawul trades Sun-Thu; default 'B' freq assumes Mon-Fri and is wrong here
tadawul_week = CustomBusinessDay(weekmask="Sun Mon Tue Wed Thu")

tadawul_days = pd.bdate_range("2026-08-16", "2026-08-27", freq=tadawul_week)
print(tadawul_days.day_name().tolist())
# ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday',
#  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday']

# a desk's master calendar for a mixed US + Saudi universe: union, not intersect
us_days = pd.bdate_range("2026-08-16", "2026-08-27")   # default Mon-Fri
master = us_days.union(tadawul_days)`,
    trap: `Assuming weekmask alone is enough and forgetting the exchange's own holiday calendar on top of it -- CustomBusinessDay also takes a holidays= argument, and a Sunday-Thursday market still has its own Eid or National Day closures that a generic weekmask won't capture.`,
    followUp: `How would you handle a name that's cross-listed on both Tadawul and a US ADR line? (Build separate calendars per listing and align at the reconciliation step by explicit date mapping, not by assuming one shared trading calendar covers both.)`,
  },
  {
    id: "qr-calendars-20260819-rolling-closed",
    module: "calendars",
    title: "rolling(window, closed=...): the edge-inclusion trap",
    difficulty: "core",
    question: `You compute a trailing realized-volatility feature on irregular intraday timestamps with price.rolling("2D", closed="right").std() so it can run on ticks that don't land on a fixed grid. A colleague says closed="right" is dangerous here -- it might leak the current tick's own price into its own window, or worse, leak future ticks. Is that right, and what does closed actually control on a time-offset window?`,
    thinking: `For an offset-based rolling window (a string like "2D" instead of an integer row count), the two boundary timestamps are "now minus the offset" and "now," and closed decides which of those two get included. closed="right" -- the default -- includes the current row as the right boundary; closed="left" excludes it. Neither choice has anything to do with future leakage: offset windows are backward-looking by construction, full stop, regardless of closed -- a row after the current timestamp is never eligible under any setting. So the colleague's fear of future leakage is misplaced. The real design question is different: should this tick's own price be part of its own trailing stat (closed="right", correct when the current observation legitimately belongs in its own window) or should the window represent strictly-prior history (closed="left", useful when the current row is about to serve as a label in the same pipeline step and must not also sit inside its own feature)? Get that backwards and you've either double-used a data point across a feature/label pair, or needlessly starved the window of its most recent, most relevant observation while chasing a leakage risk that was never actually there.`,
    answer: `closed on a time-offset rolling window controls which of the two window-boundary timestamps -- the one an offset back and the current one -- are included, not whether future data leaks in; offset windows never include rows after the current timestamp regardless of closed. Default closed="right" includes the current row itself, correct when today's own observation legitimately belongs in its own trailing stat. Use closed="left" only when the current row is about to serve as a label in the same step and must not also appear inside its own feature window -- that's a feature/label overlap problem, not a look-ahead problem.`,
    python: `import pandas as pd

# irregular intraday ticks -- offset windows handle this; integer windows
# can't, since "last 20 rows" isn't "last 2 days" on uneven tick spacing
idx = pd.to_datetime([
    "2026-08-01 09:31", "2026-08-01 10:15", "2026-08-01 14:02",
    "2026-08-04 09:33", "2026-08-04 15:58",
])
px = pd.Series([101.0, 101.4, 100.9, 102.1, 101.8], index=idx)

# closed="right" (default): window [t - 2D, t] INCLUDES t itself --
# correct when this tick's own price belongs in its own trailing stat
vol_incl = px.rolling("2D", closed="right").std()

# closed="left": window [t - 2D, t) EXCLUDES t itself -- use only when t's
# price is about to be a LABEL and must not also sit inside its own feature
vol_excl = px.rolling("2D", closed="left").std()

# neither changes whether FUTURE rows leak in -- offset windows are always
# backward-looking from t; that protection is unconditional either way`,
    trap: `Reaching for closed="left" as a fix for "lookahead" when the real bug (or non-bug) was somewhere else. Offset rolling windows are backward-looking by construction -- future rows are never included under any closed setting -- so treating closed as a lookahead lever solves a problem that didn't exist, and can silently starve the window of its most recent, most informative observation for no benefit.`,
    followUp: `Your feature runs on daily bars on a clean calendar index instead of irregular intraday ticks. Does switching to an integer window, rolling(20), change any of this reasoning? (Mostly moot -- with a regular index there's no boundary-timestamp ambiguity for closed to resolve; the equivalent choice becomes simply whether to use rolling(20) as-is, which includes today, or shift the input by 1 first if the feature needs to represent "the prior 20 days" excluding today.)`,
  },
];
