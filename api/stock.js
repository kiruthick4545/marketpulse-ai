/* =========================================================
   MarketPulse AI
   Improved NSE Stock Analysis API
   Features:
   - 6M / 1Y / 2Y / 5Y / MAX history
   - OHLCV data
   - MA20 / MA50
   - RSI14
   - MACD
   - Volume confirmation
   - Momentum
   - Breakout detection
   - Stronger historical BUY / SELL signals
========================================================= */
/* =========================
   SIMPLE MOVING AVERAGE
========================= */
function sma(values, period) {
  if (values.length < period) {
    return null;
  }
  const slice =
    values.slice(-period);
  return (
    slice.reduce(
      (sum, value) => sum + value,
      0
    ) / period
  );
}
/* =========================
   EMA
========================= */
function calculateEMA(values, period) {
  if (values.length < period) {
    return [];
  }
  const multiplier =
    2 / (period + 1);
  const result = [];
  let ema =
    values
      .slice(0, period)
      .reduce(
        (sum, value) => sum + value,
        0
      ) / period;
  result.push(ema);
  for (
    let i = period;
    i < values.length;
    i++
  ) {
    ema =
      (
        (values[i] - ema) *
        multiplier
      ) + ema;
    result.push(ema);
  }
  return result;
}
/* =========================
   RSI
========================= */
function calculateRSI(values, period = 14) {
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
    const difference =
      values[i] - values[i - 1];
    if (difference > 0) {
      gains += difference;
    } else {
      losses += Math.abs(difference);
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
   RSI FOR EACH DAY
========================= */
function calculateHistoricalRSI(
  values,
  period = 14
) {
  const result =
    new Array(values.length)
      .fill(null);
  for (
    let i = period;
    i < values.length;
    i++
  ) {
    let gains = 0;
    let losses = 0;
    for (
      let j = i - period + 1;
      j <= i;
      j++
    ) {
      const difference =
        values[j] -
        values[j - 1];
      if (difference > 0) {
        gains += difference;
      } else {
        losses +=
          Math.abs(difference);
      }
    }
    if (losses === 0) {
      result[i] = 100;
    } else {
      const rs =
        gains / losses;
      result[i] =
        100 -
        (100 / (1 + rs));
    }
  }
  return result;
}
/* =========================
   MACD
========================= */
function calculateMACD(values) {
  const ema12 =
    calculateEMA(values, 12);
  const ema26 =
    calculateEMA(values, 26);
  const macd = [];
  /*
    Align EMA12 and EMA26.
    EMA26 begins at index 25.
  */
  for (
    let i = 0;
    i < ema26.length;
    i++
  ) {
    const ema12Index =
      i + 14;
    if (
      ema12[ema12Index] === undefined
    ) {
      continue;
    }
    macd.push(
      ema12[ema12Index] -
      ema26[i]
    );
  }
  const signal =
    calculateEMA(macd, 9);
  const latestMACD =
    macd.length
      ? macd[macd.length - 1]
      : 0;
  const latestSignal =
    signal.length
      ? signal[signal.length - 1]
      : 0;
  return {
    macd:
      latestMACD,
    signal:
      latestSignal,
    bullish:
      latestMACD > latestSignal
  };
}
/* =========================
   HISTORICAL MACD
========================= */
function calculateHistoricalMACD(
  values
) {
  const ema12 =
    calculateEMA(values, 12);
  const ema26 =
    calculateEMA(values, 26);
  const macd =
    new Array(values.length)
      .fill(null);
  for (
    let i = 25;
    i < values.length;
    i++
  ) {
    const ema12Index =
      i - 11;
    const ema26Index =
      i - 25;
    if (
      ema12[ema12Index] === undefined ||
      ema26[ema26Index] === undefined
    ) {
      continue;
    }
    macd[i] =
      ema12[ema12Index] -
      ema26[ema26Index];
  }
  return macd;
}
/* =========================
   VOLUME AVERAGE
========================= */
function averageVolume(
  volumes,
  index,
  period = 20
) {
  if (index < period) {
    return null;
  }
  let sum = 0;
  for (
    let i = index - period;
    i < index;
    i++
  ) {
    sum += volumes[i] || 0;
  }
  return sum / period;
}
/* =========================
   MOMENTUM
========================= */
function calculateMomentum(
  closes,
  index,
  period = 10
) {
  if (index < period) {
    return 0;
  }
  const previous =
    closes[index - period];
  if (!previous) {
    return 0;
  }
  return (
    (
      closes[index] -
      previous
    ) / previous
  ) * 100;
}
/* =========================
   HISTORICAL SIGNALS
========================= */
function generateSignals(history) {
  const closes =
    history.map(
      item => item.close
    );
  const volumes =
    history.map(
      item => item.volume || 0
    );
  const rsiValues =
    calculateHistoricalRSI(
      closes,
      14
    );
  const macdValues =
    calculateHistoricalMACD(
      closes
    );
  const signals = [];
  /*
    Only start after enough
    information exists.
  */
  for (
    let i = 60;
    i < history.length;
    i++
  ) {
    const close =
      closes[i];
    const ma20 =
      sma(
        closes.slice(0, i + 1),
        20
      );
    const ma50 =
      sma(
        closes.slice(0, i + 1),
        50
      );
    const previousMA20 =
      sma(
        closes.slice(0, i),
        20
      );
    const previousMA50 =
      sma(
        closes.slice(0, i),
        50
      );
    const rsi =
      rsiValues[i];
    const macd =
      macdValues[i];
    if (
      ma20 === null ||
      ma50 === null ||
      rsi === null ||
      macd === null
    ) {
      continue;
    }
    /* =====================
       SCORE
    ===================== */
    let buyScore = 0;
    let sellScore = 0;
    /* TREND */
    if (close > ma20) {
      buyScore += 15;
    } else {
      sellScore += 15;
    }
    if (close > ma50) {
      buyScore += 15;
    } else {
      sellScore += 15;
    }
    /* MA TREND */
    if (ma20 > ma50) {
      buyScore += 15;
    } else {
      sellScore += 15;
    }
    /* RSI */
    if (
      rsi >= 50 &&
      rsi <= 68
    ) {
      buyScore += 15;
    } else if (
      rsi > 68 &&
      rsi <= 75
    ) {
      buyScore += 6;
    } else if (
      rsi < 35
    ) {
      /*
        Oversold alone is NOT
        enough for BUY.
      */
      buyScore += 3;
    } else if (
      rsi > 75
    ) {
      sellScore += 12;
    } else if (
      rsi < 45
    ) {
      sellScore += 10;
    }
    /* MACD */
    if (macd > 0) {
      buyScore += 15;
    } else {
      sellScore += 15;
    }
    /* MACD TURNING POINT */
    const previousMACD =
      i > 0
        ? macdValues[i - 1]
        : null;
    if (
      previousMACD !== null
    ) {
      if (
        previousMACD <= 0 &&
        macd > 0
      ) {
        buyScore += 8;
      }
      if (
        previousMACD >= 0 &&
        macd < 0
      ) {
        sellScore += 8;
      }
    }
    /* VOLUME */
    const avgVol =
      averageVolume(
        volumes,
        i,
        20
      );
    const currentVol =
      volumes[i];
    if (
      avgVol &&
      currentVol > avgVol * 1.25
    ) {
      if (close > history[i].open) {
        buyScore += 10;
      } else {
        sellScore += 10;
      }
    }
    /* MOMENTUM */
    const momentum =
      calculateMomentum(
        closes,
        i,
        10
      );
    if (momentum > 2) {
      buyScore += 10;
    } else if (
      momentum < -2
    ) {
      sellScore += 10;
    }
    /* BREAKOUT */
    const lookbackStart =
      Math.max(
        0,
        i - 20
      );
    const previous20 =
      closes.slice(
        lookbackStart,
        i
      );
    const highestPrevious =
      Math.max(
        ...previous20
      );
    const lowestPrevious =
      Math.min(
        ...previous20
      );
    if (
      close >
      highestPrevious
    ) {
      buyScore += 10;
    }
    if (
      close <
      lowestPrevious
    ) {
      sellScore += 10;
    }
    /* =====================
       CROSSOVER CONFIRMATION
    ===================== */
    const bullishCross =
      previousMA20 !== null &&
      previousMA50 !== null &&
      previousMA20 <= previousMA50 &&
      ma20 > ma50;
    const bearishCross =
      previousMA20 !== null &&
      previousMA50 !== null &&
      previousMA20 >= previousMA50 &&
      ma20 < ma50;
    if (bullishCross) {
      buyScore += 10;
    }
    if (bearishCross) {
      sellScore += 10;
    }
    /* =====================
       FINAL DECISION
       Require stronger
       confirmation.
    ===================== */
    let signal =
      "HOLD";
    let score = 50;
    if (
      buyScore >= 65 &&
      buyScore > sellScore + 12
    ) {
      signal = "BUY";
      score =
        Math.min(
          95,
          buyScore
        );
    } else if (
      sellScore >= 65 &&
      sellScore > buyScore + 12
    ) {
      signal = "SELL";
      score =
        Math.max(
          5,
          100 - sellScore
        );
    } else {
      signal = "HOLD";
      score =
        Math.round(
          50 +
          (
            buyScore -
            sellScore
          ) * 0.35
        );
      score =
        Math.max(
          20,
          Math.min(
            80,
            score
          )
        );
    }
    /*
      Only record actual
      BUY / SELL markers.
    */
    if (
      signal === "BUY" ||
      signal === "SELL"
    ) {
      signals.push({
        date:
          history[i].date,
        signal,
        score,
        rsi:
          Number(
            rsi.toFixed(2)
          ),
        ma20:
          Number(
            ma20.toFixed(2)
          ),
        ma50:
          Number(
            ma50.toFixed(2)
          )
      });
    }
  }
  return signals;
}
/* =========================
   CURRENT SCORE
========================= */
function calculateCurrentScore(
  history
) {
  const closes =
    history.map(
      item => item.close
    );
  const last =
    closes[closes.length - 1];
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
  const rsi =
    calculateRSI(
      closes,
      14
    );
  const macd =
    calculateMACD(
      closes
    );
  let score = 50;
  if (last > ma20) {
    score += 12;
  } else {
    score -= 12;
  }
  if (last > ma50) {
    score += 12;
  } else {
    score -= 12;
  }
  if (ma20 > ma50) {
    score += 10;
  } else {
    score -= 10;
  }
  if (
    rsi >= 50 &&
    rsi <= 68
  ) {
    score += 12;
  } else if (
    rsi > 70
  ) {
    score -= 5;
  } else if (
    rsi < 40
  ) {
    score -= 8;
  }
  if (macd.bullish) {
    score += 10;
  } else {
    score -= 10;
  }
  score =
    Math.max(
      0,
      Math.min(
        100,
        score
      )
    );
  let signal =
    "NEUTRAL";
  if (score >= 68) {
    signal =
      "BULLISH";
  } else if (
    score <= 32
  ) {
    signal =
      "BEARISH";
  }
  return {
    score,
    signal,
    rsi,
    ma20,
    ma50
  };
}
/* =========================
   API
========================= */
module.exports =
async function(req, res) {
  try {
    const symbol =
      String(
        req.query.symbol ||
        "RELIANCE"
      )
      .toUpperCase()
      .replace(
        /[^A-Z0-9&-]/g,
        ""
      );
    /*
      IMPORTANT:
      Now supports more than
      1 year.
    */
    const allowedRanges = [
      "6mo",
      "1y",
      "2y",
      "5y",
      "max"
    ];
    const range =
      allowedRanges.includes(
        req.query.range
      )
        ? req.query.range
        : "1y";
    const url =
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}.NS?range=${range}&interval=1d&events=history`;
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
        "Unable to retrieve market data."
      );
    }
    const json =
      await response.json();
    const result =
      json.chart &&
      json.chart.result &&
      json.chart.result[0];
    if (!result) {
      throw new Error(
        "Stock not found. Try TCS, INFY, SBIN, HDFCBANK or RELIANCE."
      );
    }
    const timestamps =
      result.timestamp || [];
    const quote =
      result.indicators &&
      result.indicators.quote &&
      result.indicators.quote[0];
    if (
      !quote ||
      !timestamps.length
    ) {
      throw new Error(
        "No historical market data available for this stock."
      );
    }
    const history = [];
    for (
      let i = 0;
      i < timestamps.length;
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
            timestamps[i] * 1000
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
    if (
      history.length < 60
    ) {
      throw new Error(
        "Not enough historical data for technical analysis."
      );
    }
    const closes =
      history.map(
        item => item.close
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
      (
        (last - previous) /
        previous
      ) * 100;
    const current =
      calculateCurrentScore(
        history
      );
    const signals =
      generateSignals(
        history
      );
    res.status(200).json({
      symbol,
      last,
      change,
      rsi:
        current.rsi,
      score:
        current.score,
      signal:
        current.signal,
      ma20:
        current.ma20,
      ma50:
        current.ma50,
      /*
        IMPORTANT:
        Send ALL available history.
        Do NOT use slice(-120).
      */
      history,
      /*
        Backend-generated
        BUY / SELL markers.
      */
      signals
    });
  } catch (error) {
    res.status(400).json({
      error:
        error.message ||
        "Unexpected error."
    });
  }
};
