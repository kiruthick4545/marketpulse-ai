/* =========================================
   MarketPulse AI
   Stock API
   ========================================= */
/* =========================================
   SIMPLE MOVING AVERAGE
   ========================================= */
function sma(data, period) {
  if (!data || data.length < period) {
    return null;
  }
  const values = data.slice(-period);
  return (
    values.reduce(
      (sum, value) => sum + value,
      0
    ) / values.length
  );
}
/* =========================================
   RSI
   ========================================= */
function calculateRSI(
  data,
  period = 14
) {
  if (
    !data ||
    data.length < period + 1
  ) {
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
      data[i] -
      data[i - 1];
    if (difference > 0) {
      gains += difference;
    } else {
      losses +=
        Math.abs(difference);
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
/* =========================================
   COMPANY NAME → NSE SYMBOL
   ========================================= */
const aliases = {
  /* IT */
  "TATA CONSULTANCY SERVICES":
    "TCS",
  "TCS":
    "TCS",
  "INFOSYS":
    "INFY",
  "INFY":
    "INFY",
  "WIPRO":
    "WIPRO",
  "HCL TECHNOLOGIES":
    "HCLTECH",
  "HCL TECH":
    "HCLTECH",
  "TECH MAHINDRA":
    "TECHM",
  /* BANKS */
  "STATE BANK OF INDIA":
    "SBIN",
  "SBI":
    "SBIN",
  "HDFC BANK":
    "HDFCBANK",
  "ICICI BANK":
    "ICICIBANK",
  "AXIS BANK":
    "AXISBANK",
  "KOTAK MAHINDRA BANK":
    "KOTAKBANK",
  "KOTAK BANK":
    "KOTAKBANK",
  "INDUSIND BANK":
    "INDUSINDBK",
  /* AUTOMOBILE */
  "HERO MOTOCORP":
    "HEROMOTOCO",
  "HERO MOTOCORP LTD":
    "HEROMOTOCO",
  "HERO MOTORS":
    "HEROMOTOCO",
  "HEROMOTOCO":
    "HEROMOTOCO",
  "MARUTI SUZUKI":
    "MARUTI",
  "MARUTI":
    "MARUTI",
  "TATA MOTORS":
    "TATAMOTORS",
  "M&M":
    "M&M",
  "MAHINDRA":
    "M&M",
  "BAJAJ AUTO":
    "BAJAJ-AUTO",
  "EICHER MOTORS":
    "EICHERMOT",
  /* ENERGY */
  "RELIANCE":
    "RELIANCE",
  "RELIANCE INDUSTRIES":
    "RELIANCE",
  "ONGC":
    "ONGC",
  "NTPC":
    "NTPC",
  "POWER GRID":
    "POWERGRID",
  "POWER GRID CORPORATION":
    "POWERGRID",
  /* FMCG */
  "HINDUSTAN UNILEVER":
    "HINDUNILVR",
  "HUL":
    "HINDUNILVR",
  "ITC":
    "ITC",
  "NESTLE INDIA":
    "NESTLEIND",
  "BRITANNIA":
    "BRITANNIA",
  /* PHARMA */
  "SUN PHARMA":
    "SUNPHARMA",
  "SUN PHARMACEUTICAL":
    "SUNPHARMA",
  "DR REDDYS":
    "DRREDDY",
  "DR REDDY":
    "DRREDDY",
  "CIPLA":
    "CIPLA",
  "DIVIS LAB":
    "DIVISLAB",
  "DIVIS LABORATORIES":
    "DIVISLAB",
  /* TELECOM */
  "BHARTI AIRTEL":
    "BHARTIARTL",
  "AIRTEL":
    "BHARTIARTL",
  "BHARTI AIRTEL LIMITED":
    "BHARTIARTL",
  /* METALS */
  "TATA STEEL":
    "TATASTEEL",
  "JSW STEEL":
    "JSWSTEEL",
  "HINDALCO":
    "HINDALCO",
  "COAL INDIA":
    "COALINDIA",
  /* CONSUMER */
  "TITAN":
    "TITAN",
  "TRENT":
    "TRENT",
  "ASIAN PAINTS":
    "ASIANPAINT",
  "ULTRATECH CEMENT":
    "ULTRACEMCO",
  "ULTRATECH":
    "ULTRACEMCO"
};
/* =========================================
   NORMALIZE SYMBOL
   ========================================= */
function normalizeSymbol(input) {
  let value =
    String(input || "")
      .trim()
      .toUpperCase();
  /*
    Remove Yahoo NSE suffix
  */
  value =
    value.replace(
      /\.NS$/i,
      ""
    );
  /*
    Convert multiple spaces
  */
  value =
    value.replace(
      /\s+/g,
      " "
    );
  /*
    Company-name lookup
  */
  if (
    aliases[value]
  ) {
    return aliases[value];
  }
  /*
    Remove unsafe characters.
    Keep:
    A-Z
    0-9
    &
    -
  */
  value =
    value.replace(
      /[^A-Z0-9&-]/g,
      ""
    );
  return value;
}
/* =========================================
   MACD
   ========================================= */
function calculateEMA(
  data,
  period
) {
  if (
    data.length <
    period
  ) {
    return [];
  }
  const multiplier =
    2 / (period + 1);
  let ema =
    data
      .slice(
        0,
        period
      )
      .reduce(
        (a, b) => a + b,
        0
      ) / period;
  const result = [];
  result.push(
    ema
  );
  for (
    let i = period;
    i < data.length;
    i++
  ) {
    ema =
      (
        data[i] -
        ema
      ) *
      multiplier +
      ema;
    result.push(
      ema
    );
  }
  return result;
}
/* =========================================
   MACD VALUE
   ========================================= */
function calculateMACD(
  closes
) {
  if (
    closes.length < 35
  ) {
    return 0;
  }
  const ema12 =
    calculateEMA(
      closes,
      12
    );
  const ema26 =
    calculateEMA(
      closes,
      26
    );
  if (
    !ema12.length ||
    !ema26.length
  ) {
    return 0;
  }
  const latest12 =
    ema12[
      ema12.length - 1
    ];
  const latest26 =
    ema26[
      ema26.length - 1
    ];
  return (
    latest12 -
    latest26
  );
}
/* =========================================
   API
   ========================================= */
module.exports =
  async function handler(
    req,
    res
  ) {
    try {
      /* =====================================
         GET INPUT
      ===================================== */
      const originalInput =
        String(
          req.query.symbol ||
          ""
        ).trim();
      if (
        !originalInput
      ) {
        return res.status(400).json({
          error:
            "Please enter a stock symbol, for example TCS or HEROMOTOCO."
        });
      }
      const symbol =
        normalizeSymbol(
          originalInput
        );
      /* =====================================
         RANGE
      ===================================== */
      const allowedRanges = [
        "6mo",
        "1y",
        "2y",
        "5y"
      ];
      const range =
        allowedRanges.includes(
          req.query.range
        )
          ? req.query.range
          : "1y";
      /* =====================================
         YAHOO FINANCE URL
      ===================================== */
      const url =
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}.NS?range=${range}&interval=1d&events=history`;
      console.log(
        "MarketPulse request:",
        originalInput,
        "→",
        symbol
      );
      /* =====================================
         FETCH
      ===================================== */
      const response =
        await fetch(
          url,
          {
            headers: {
              "User-Agent":
                "Mozilla/5.0",
              "Accept":
                "application/json"
            }
          }
        );
      if (
        !response.ok
      ) {
        return res.status(404).json({
          error:
            `Stock "${originalInput}" was not found. Try the NSE symbol, e.g. HEROMOTOCO for Hero MotoCorp.`
        });
      }
      const json =
        await response.json();
      /* =====================================
         YAHOO RESULT
      ===================================== */
      const result =
        json &&
        json.chart &&
        json.chart.result &&
        json.chart.result[0];
      if (
        !result
      ) {
        return res.status(404).json({
          error:
            `No market data found for "${originalInput}".`
        });
      }
      const quote =
        result
          .indicators
          .quote[0];
      const timestamps =
        result.timestamp || [];
      const history = [];
      /* =====================================
         BUILD OHLCV
      ===================================== */
      for (
        let i = 0;
        i < timestamps.length;
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
        const date =
          new Date(
            timestamps[i] * 1000
          )
            .toISOString()
            .slice(
              0,
              10
            );
        history.push({
          date,
          open:
            Number(
              quote.open[i]
            ),
          high:
            Number(
              quote.high[i]
            ),
          low:
            Number(
              quote.low[i]
            ),
          close:
            Number(
              quote.close[i]
            ),
          volume:
            quote.volume &&
            quote.volume[i] != null
              ? Number(
                  quote.volume[i]
                )
              : 0
        });
      }
      /* =====================================
         MINIMUM DATA
      ===================================== */
      if (
        history.length < 50
      ) {
        return res.status(400).json({
          error:
            `${symbol} does not have enough historical data for technical analysis.`
        });
      }
      /* =====================================
         CLOSE PRICES
      ===================================== */
      const closes =
        history.map(
          item =>
            item.close
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
              (
                last -
                previous
              ) /
              previous
            ) * 100
          : 0;
      /* =====================================
         MOVING AVERAGES
      ===================================== */
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
      /* =====================================
         RSI
      ===================================== */
      const rsi =
        calculateRSI(
          closes
        );
      /* =====================================
         MACD
      ===================================== */
      const macd =
        calculateMACD(
          closes
        );
      /* =====================================
         MOMENTUM
         10 trading sessions
      ===================================== */
      const momentumIndex =
        Math.max(
          0,
          closes.length - 11
        );
      const momentum =
        closes[
          momentumIndex
        ] !== 0
          ? (
              (
                last -
                closes[
                  momentumIndex
                ]
              ) /
              closes[
                momentumIndex
              ]
            ) * 100
          : 0;
      /* =====================================
         VOLUME ANALYSIS
      ===================================== */
      const currentVolume =
        Number(
          history[
            history.length - 1
          ].volume || 0
        );
      const volumePeriod =
        history.slice(
          -20
        );
      const volumeValues =
        volumePeriod.map(
          item =>
            Number(
              item.volume || 0
            )
        );
      const averageVolume =
        volumeValues.length
          ? volumeValues.reduce(
              (
                sum,
                value
              ) =>
                sum + value,
              0
            ) /
            volumeValues.length
          : 0;
      const volumeRatio =
        averageVolume > 0
          ? currentVolume /
            averageVolume
          : 1;
      /* =====================================
         TREND
      ===================================== */
      let trend =
        "SIDEWAYS";
      if (
        last > ma20 &&
        ma20 > ma50
      ) {
        trend =
          "BULLISH";
      }
      else if (
        last < ma20 &&
        ma20 < ma50
      ) {
        trend =
          "BEARISH";
      }
      /* =====================================
         BUY / SELL SCORING
      ===================================== */
      let buyScore = 0;
      let sellScore = 0;
      /*
        PRICE VS MA20
      */
      if (
        last > ma20
      ) {
        buyScore += 15;
      } else {
        sellScore += 15;
      }
      /*
        MA20 VS MA50
      */
      if (
        ma20 > ma50
      ) {
        buyScore += 20;
      } else {
        sellScore += 20;
      }
      /*
        RSI
      */
      if (
        rsi >= 52 &&
        rsi <= 68
      ) {
        buyScore += 15;
      }
      else if (
        rsi <= 45
      ) {
        sellScore += 15;
      }
      else if (
        rsi > 70
      ) {
        sellScore += 10;
      }
      /*
        MACD
      */
      if (
        macd > 0
      ) {
        buyScore += 15;
      } else {
        sellScore += 15;
      }
      /*
        MOMENTUM
      */
      if (
        momentum > 1
      ) {
        buyScore += 15;
      }
      else if (
        momentum < -1
      ) {
        sellScore += 15;
      }
      /*
        VOLUME CONFIRMATION
      */
      if (
        volumeRatio > 1.05
      ) {
        if (
          last > previous
        ) {
          buyScore += 10;
        }
        else if (
          last < previous
        ) {
          sellScore += 10;
        }
      }
      /* =====================================
         FINAL SIGNAL
      ===================================== */
      const difference =
        Math.abs(
          buyScore -
          sellScore
        );
      let signal =
        "HOLD";
      if (
        buyScore >= 65 &&
        buyScore >
          sellScore + 10
      ) {
        signal =
          "BUY";
      }
      else if (
        sellScore >= 65 &&
        sellScore >
          buyScore + 10
      ) {
        signal =
          "SELL";
      }
      /* =====================================
         CONFIDENCE
      ===================================== */
      const strongestScore =
        Math.max(
          buyScore,
          sellScore
        );
      let confidence =
        Math.round(
          (
            strongestScore /
            100
          ) * 100
        );
      /*
        Don't show artificially
        high confidence for HOLD.
      */
      if (
        signal === "HOLD"
      ) {
        confidence =
          Math.min(
            60,
            Math.max(
              45,
              50 +
              Math.round(
                difference / 2
              )
            )
          );
      }
      /* =====================================
         RETURN DATA
      ===================================== */
      return res.status(200).json({
        symbol,
        input:
          originalInput,
        last,
        change,
        rsi,
        ma20,
        ma50,
        macd,
        momentum,
        currentVolume,
        averageVolume,
        volumeRatio,
        trend,
        buyScore,
        sellScore,
        confidence,
        signal,
        history:
          history.slice(-250)
      });
    }
    catch (
      error
    ) {
      console.error(
        "MarketPulse API error:",
        error
      );
      return res.status(500).json({
        error:
          error.message ||
          "Unexpected server error."
      });
    }
  };
