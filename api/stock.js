function average(values) {
  if (!values.length) return 0;
  return values.reduce(
    (sum, value) => sum + value,
    0
  ) / values.length;
}
/* =========================
   SIMPLE MOVING AVERAGE
========================= */
function sma(values, period) {
  if (values.length < period) {
    return null;
  }
  return average(
    values.slice(-period)
  );
}
/* =========================
   EMA
========================= */
function emaSeries(values, period) {
  if (values.length < period) {
    return [];
  }
  const multiplier =
    2 / (period + 1);
  const result = [];
  let ema =
    average(
      values.slice(0, period)
    );
  result.push(ema);
  for (
    let i = period;
    i < values.length;
    i++
  ) {
    ema =
      (values[i] - ema) *
      multiplier +
      ema;
    result.push(ema);
  }
  return result;
}
/* =========================
   RSI
========================= */
function calculateRSI(
  values,
  period = 14
) {
  if (values.length < period + 1) {
    return 50;
  }
  let gains = 0;
  let losses = 0;
  for (
    let i = values.length - period;
    i < values.length;
    i++
  ) {
    const change =
      values[i] -
      values[i - 1];
    if (change > 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }
  if (losses === 0) {
    return 100;
  }
  const rs =
    gains / losses;
  return (
    100 -
    (100 / (1 + rs))
  );
}
/* =========================
   MACD
========================= */
function calculateMACD(values) {
  if (values.length < 35) {
    return {
      macd: 0,
      signal: 0,
      histogram: 0
    };
  }
  const ema12 =
    emaSeries(values, 12);
  const ema26 =
    emaSeries(values, 26);
  const macdValues = [];
  /*
    Align EMA12 and EMA26
  */
  const offset =
    ema12.length -
    ema26.length;
  for (
    let i = 0;
    i < ema26.length;
    i++
  ) {
    macdValues.push(
      ema12[i + offset] -
      ema26[i]
    );
  }
  const signalValues =
    emaSeries(
      macdValues,
      9
    );
  const macd =
    macdValues[
      macdValues.length - 1
    ];
  const signal =
    signalValues.length
      ? signalValues[
          signalValues.length - 1
        ]
      : 0;
  return {
    macd,
    signal,
    histogram:
      macd - signal
  };
}
/* =========================
   STOCK SYMBOL
========================= */
function normalizeSymbol(input) {
  let symbol =
    String(input || "")
      .trim()
      .toUpperCase();
  /*
    Remove spaces and unsafe
    characters.
  */
  symbol =
    symbol.replace(
      /[^A-Z0-9&.-]/g,
      ""
    );
  /*
    If user enters .NS,
    don't add another .NS.
  */
  if (symbol.endsWith(".NS")) {
    return symbol.slice(
      0,
      -3
    );
  }
  return symbol;
}
/* =========================
   MAIN API
========================= */
module.exports = async (
  req,
  res
) => {
  try {
    /*
      IMPORTANT:
      No default RELIANCE.
      User must enter a stock.
    */
    if (!req.query.symbol) {
      return res.status(400).json({
        error:
          "Please enter an NSE stock symbol."
      });
    }
    const symbol =
      normalizeSymbol(
        req.query.symbol
      );
    if (!symbol) {
      return res.status(400).json({
        error:
          "Invalid stock symbol."
      });
    }
    const range =
      [
        "6mo",
        "1y",
        "2y",
        "5y"
      ].includes(
        req.query.range
      )
        ? req.query.range
        : "1y";
    /*
      Yahoo Finance NSE symbol
    */
    const yahooSymbol =
      `${symbol}.NS`;
    const url =
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
        yahooSymbol
      )}?range=${range}&interval=1d&events=history`;
    const response =
      await fetch(
        url,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0"
          }
        }
      );
    if (!response.ok) {
      throw new Error(
        `Market data request failed (${response.status}).`
      );
    }
    const json =
      await response.json();
    const result =
      json &&
      json.chart &&
      json.chart.result &&
      json.chart.result[0];
    if (!result) {
      throw new Error(
        `${symbol} was not found on NSE. Check the symbol and try again.`
      );
    }
    const quote =
      result.indicators &&
      result.indicators.quote &&
      result.indicators.quote[0];
    if (
      !quote ||
      !result.timestamp
    ) {
      throw new Error(
        "Historical market data is unavailable for this stock."
      );
    }
    const history = [];
    /*
      Build OHLCV data
    */
    for (
      let i = 0;
      i < result.timestamp.length;
      i++
    ) {
      const open =
        quote.open &&
        quote.open[i];
      const high =
        quote.high &&
        quote.high[i];
      const low =
        quote.low &&
        quote.low[i];
      const close =
        quote.close &&
        quote.close[i];
      const volume =
        quote.volume &&
        quote.volume[i];
      if (
        open == null ||
        high == null ||
        low == null ||
        close == null
      ) {
        continue;
      }
      history.push({
        date:
          new Date(
            result.timestamp[i] *
            1000
          )
            .toISOString()
            .slice(0, 10),
        open:
          Number(open),
        high:
          Number(high),
        low:
          Number(low),
        close:
          Number(close),
        volume:
          Number(volume || 0)
      });
    }
    if (history.length < 60) {
      throw new Error(
        "Not enough historical data for technical analysis."
      );
    }
    const closes =
      history.map(
        item => item.close
      );
    const volumes =
      history.map(
        item => item.volume
      );
    const last =
      closes[
        closes.length - 1
      ];
    const previous =
      closes[
        closes.length - 2
      ];
    const change =
      previous !== 0
        ? (
            (last - previous) /
            previous
          ) * 100
        : 0;
    /* =========================
       INDICATORS
    ========================= */
    const ma20 =
      sma(
        closes,
        20
      );
    const ma50 =
      sma(
        closes,
        50
      );
    const ema20Series =
      emaSeries(
        closes,
        20
      );
    const ema50Series =
      emaSeries(
        closes,
        50
      );
    const ema20 =
      ema20Series[
        ema20Series.length - 1
      ];
    const ema50 =
      ema50Series[
        ema50Series.length - 1
      ];
    const rsi =
      calculateRSI(
        closes,
        14
      );
    const macd =
      calculateMACD(
        closes
      );
    /* =========================
       VOLUME CONFIRMATION
    ========================= */
    const recentVolumes =
      volumes.slice(-20);
    const averageVolume =
      average(
        recentVolumes
      );
    const currentVolume =
      volumes[
        volumes.length - 1
      ];
    const volumeConfirmed =
      currentVolume >=
      averageVolume * 1.05;
    /* =========================
       PRICE MOMENTUM
    ========================= */
    const momentumPeriod = 10;
    const oldPrice =
      closes[
        closes.length -
        1 -
        momentumPeriod
      ];
    const momentum =
      oldPrice !== 0
        ? (
            (last - oldPrice) /
            oldPrice
          ) * 100
        : 0;
    /* =========================
       TREND
    ========================= */
    const bullishTrend =
      last > ema20 &&
      ema20 > ema50;
    const bearishTrend =
      last < ema20 &&
      ema20 < ema50;
    /* =========================
       SCORE ENGINE
    ========================= */
    let buyScore = 0;
    let sellScore = 0;
    /*
      1. EMA trend
    */
    if (bullishTrend) {
      buyScore += 25;
    }
    if (bearishTrend) {
      sellScore += 25;
    }
    /*
      2. MA trend
    */
    if (
      ma20 !== null &&
      ma50 !== null
    ) {
      if (ma20 > ma50) {
        buyScore += 15;
      }
      if (ma20 < ma50) {
        sellScore += 15;
      }
    }
    /*
      3. RSI
      Avoid buying when extremely
      overbought.
      Avoid selling when extremely
      oversold.
    */
    if (
      rsi >= 52 &&
      rsi <= 68
    ) {
      buyScore += 15;
    }
    if (
      rsi >= 32 &&
      rsi <= 48
    ) {
      sellScore += 15;
    }
    /*
      4. MACD
    */
    if (
      macd.macd >
      macd.signal &&
      macd.histogram > 0
    ) {
      buyScore += 20;
    }
    if (
      macd.macd <
      macd.signal &&
      macd.histogram < 0
    ) {
      sellScore += 20;
    }
    /*
      5. Momentum
    */
    if (
      momentum > 1
    ) {
      buyScore += 10;
    }
    if (
      momentum < -1
    ) {
      sellScore += 10;
    }
    /*
      6. Volume confirmation
    */
    if (
      volumeConfirmed
    ) {
      if (
        change > 0
      ) {
        buyScore += 15;
      }
      if (
        change < 0
      ) {
        sellScore += 15;
      }
    }
    /* =========================
       FINAL SIGNAL
    ========================= */
    let signal =
      "NEUTRAL";
    let confidence = 0;
    /*
      Require stronger agreement
      before issuing BUY/SELL.
    */
    if (
      buyScore >= 65 &&
      buyScore > sellScore + 10
    ) {
      signal =
        "BUY";
      confidence =
        buyScore;
    }
    else if (
      sellScore >= 65 &&
      sellScore > buyScore + 10
    ) {
      signal =
        "SELL";
      confidence =
        sellScore;
    }
    else {
      signal =
        "HOLD";
      confidence =
        Math.max(
          buyScore,
          sellScore
        );
    }
    confidence =
      Math.max(
        0,
        Math.min(
          100,
          confidence
        )
      );
    /*
      General trend label
    */
    let trend =
      "SIDEWAYS";
    if (
      bullishTrend
    ) {
      trend =
        "BULLISH";
    }
    else if (
      bearishTrend
    ) {
      trend =
        "BEARISH";
    }
    /* =========================
       RESPONSE
    ========================= */
    res.status(200).json({
      symbol,
      exchange:
        "NSE",
      last,
      change,
      rsi,
      ma20,
      ma50,
      ema20,
      ema50,
      macd:
        macd.macd,
      macdSignal:
        macd.signal,
      macdHistogram:
        macd.histogram,
      momentum,
      averageVolume,
      currentVolume,
      trend,
      signal,
      confidence,
      buyScore,
      sellScore,
      history:
        history.slice(-250)
    });
  } catch (error) {
    console.error(
      "MarketPulse API error:",
      error
    );
    res.status(400).json({
      error:
        error.message ||
        "Unable to retrieve market data."
    });
  }
};
