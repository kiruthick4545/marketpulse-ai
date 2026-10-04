function sma(data, period) {
  const values = data.slice(-period);

  return values.reduce(
    (sum, value) => sum + value,
    0
  ) / values.length;
}


function calculateRSI(data, period = 14) {

  if (data.length < period + 1) {
    return 50;
  }

  let gains = 0;
  let losses = 0;

  for (
    let i = data.length - period;
    i < data.length;
    i++
  ) {

    const difference =
      data[i] - data[i - 1];

    if (difference > 0) {
      gains += difference;
    } else {
      losses -= difference;
    }
  }

  if (losses === 0) {
    return 100;
  }

  const rs =
    gains / losses;

  return 100 - (100 / (1 + rs));
}


module.exports = async (req, res) => {

  try {

    const symbol =
      String(
        req.query.symbol || "RELIANCE"
      )
      .toUpperCase()
      .replace(/[^A-Z0-9&-]/g, "");


    const range =
      ["6mo", "1y", "2y"].includes(
        req.query.range
      )
        ? req.query.range
        : "1y";


    /*
      Yahoo Finance historical
      OHLCV data
    */

    const url =
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}.NS?range=${range}&interval=1d&events=history`;


    const response =
      await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0"
        }
      });


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
        "Stock not found. Try RELIANCE, TCS, INFY or SBIN."
      );

    }


    const quote =
      result.indicators.quote[0];


    const history = [];


    /*
      Build OHLCV dataset
    */

    for (
      let i = 0;
      i < result.timestamp.length;
      i++
    ) {

      if (
        quote.open[i] == null ||
        quote.high[i] == null ||
        quote.low[i] == null ||
        quote.close[i] == null
      ) {
        continue;
      }


      history.push({

        date:
          new Date(
            result.timestamp[i] * 1000
          )
          .toISOString()
          .slice(0, 10),

        open:
          quote.open[i],

        high:
          quote.high[i],

        low:
          quote.low[i],

        close:
          quote.close[i],

        volume:
          quote.volume &&
          quote.volume[i]
            ? quote.volume[i]
            : 0

      });

    }


    if (history.length < 50) {

      throw new Error(
        "Not enough historical data for MA20 and MA50."
      );

    }


    const closes =
      history.map(
        item => item.close
      );


    const last =
      closes[closes.length - 1];


    const previous =
      closes[closes.length - 2];


    const change =
      ((last - previous) /
      previous) * 100;


    const ma20 =
      sma(closes, 20);


    const ma50 =
      sma(closes, 50);


    const rsi =
      calculateRSI(closes);


    /*
      Simple prediction score
    */

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


    if (rsi > 55) {
      score += 12;
    }


    if (rsi < 45) {
      score -= 12;
    }


    score =
      Math.max(
        0,
        Math.min(100, score)
      );


    let signal;


    if (score >= 62) {

      signal = "BULLISH";

    } else if (score <= 38) {

      signal = "BEARISH";

    } else {

      signal = "NEUTRAL";

    }


    /*
      IMPORTANT:
      Send complete OHLCV history
      to index.html
    */

    res.status(200).json({

      symbol,

      last,

      change,

      rsi,

      score,

      signal,

      ma20,

      ma50,

      history:
        history.slice(-120)

    });


  } catch (error) {

    res.status(400).json({

      error:
        error.message ||
        "Unexpected error."

    });

  }

};
