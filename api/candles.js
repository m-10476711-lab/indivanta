export default async function handler(req, res) {
  const intervals = {
    "5m": "5min",
    "15m": "15min",
    "30m": "30min",
    "1h": "1h",
    "4h": "4h",
    "1d": "1day"
  };

  const interval = intervals[req.query.interval || "15m"];

  if (!interval) {
    return res.status(400).json({
      error: "Unsupported timeframe"
    });
  }

  const apiKey = process.env.TWELVE_DATA_API_KEY;

  if (!apiKey) {
    return res.status(503).json({
      error: "Market data API key is not configured."
    });
  }

  try {
    const url = new URL("https://api.twelvedata.com/time_series");

    url.searchParams.set("symbol", "XAU/USD");
    url.searchParams.set("interval", interval);
    url.searchParams.set("outputsize", "300");
    url.searchParams.set("timezone", "UTC");
    url.searchParams.set("apikey", apiKey);

    const response = await fetch(url);
    const data = await response.json();

    if (
      !response.ok ||
      data.status === "error" ||
      !Array.isArray(data.values)
    ) {
      return res.status(502).json({
        error: data.message || "Unable to retrieve market data."
      });
    }

    const candles = data.values
      .slice()
      .reverse()
      .map(item => ({
        time: Math.floor(
          new Date(
            item.datetime.replace(" ", "T") + "Z"
          ).getTime() / 1000
        ),
        open: Number(item.open),
        high: Number(item.high),
        low: Number(item.low),
        close: Number(item.close)
      }))
      .filter(c =>
        Number.isFinite(c.time) &&
        [c.open, c.high, c.low, c.close].every(Number.isFinite)
      );

    res.setHeader(
      "Cache-Control",
      "s-maxage=30, stale-while-revalidate=15"
    );

    return res.status(200).json({
      candles,
      source: "Twelve Data",
      symbol: "XAU/USD",
      interval
    });

  } catch (error) {
    return res.status(500).json({
      error: "Market data service unavailable."
    });
  }
}
