/* =========================================================
   MarketPulse AI
   Advanced NSE Stock Analysis API

   KEEP EXISTING FRONTEND/UI

   FEATURES
   ---------------------------------------------------------
   • 6M / 1Y / 2Y / 5Y / MAX
   • OHLCV
   • SMA20 / SMA50
   • EMA20 / EMA50 / EMA200
   • RSI14
   • MACD + Signal + Histogram
   • ADX14
   • ATR14
   • Volume confirmation
   • Momentum
   • Breakout detection
   • Support / Resistance
   • Candle confirmation
   • Trend confirmation
   • Strong BUY / SELL filtering
   • Historical BUY / SELL signals
   • Backtesting
   • Win rate
   • Average return
   • Profit factor
   • Maximum drawdown
========================================================= */


/* =========================================================
   SIMPLE MOVING AVERAGE
========================================================= */

function sma(values, period) {

  if (
    !Array.isArray(values) ||
    values.length < period
  ) {
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


/* =========================================================
   HISTORICAL SMA
========================================================= */

function historicalSMA(values, period) {

  const result =
    new Array(values.length)
      .fill(null);

  if (values.length < period) {
    return result;
  }

  let sum = 0;

  for (
    let i = 0;
    i < values.length;
    i++
  ) {

    sum += values[i];

    if (i >= period) {
      sum -= values[i - period];
    }

    if (i >= period - 1) {
      result[i] =
        sum / period;
    }
  }

  return result;
}


/* =========================================================
   EMA
========================================================= */

function calculateEMA(
  values,
  period
) {

  if (
    !Array.isArray(values) ||
    values.length < period
  ) {
    return [];
  }

  const multiplier =
    2 / (period + 1);

  const result = [];

  let ema =
    values
      .slice(0, period)
      .reduce(
        (sum, value) =>
          sum + value,
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


/* =========================================================
   HISTORICAL EMA
========================================================= */

function calculateHistoricalEMA(
  values,
  period
) {

  const result =
    new Array(values.length)
      .fill(null);

  if (values.length < period) {
    return result;
  }

  const multiplier =
    2 / (period + 1);

  let ema =
    values
      .slice(0, period)
      .reduce(
        (sum, value) =>
          sum + value,
        0
      ) / period;

  result[period - 1] =
    ema;

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

    result[i] =
      ema;
  }

  return result;
}


/* =========================================================
   RSI
========================================================= */

function calculateRSI(
  values,
  period = 14
) {

  if (
    !Array.isArray(values) ||
    values.length < period + 1
  ) {
    return 50;
  }

  let gains = 0;
  let losses = 0;

  for (
    let i =
      values.length - period;
    i < values.length;
    i++
  ) {

    const difference =
      values[i] -
      values[i - 1];

    if (difference > 0) {

      gains += difference;

    } else {

      losses +=
        Math.abs(
          difference
        );
    }
  }

  if (losses === 0) {
    return 100;
  }

  const rs =
    gains / losses;

  return (
    100 -
    (
      100 /
      (1 + rs)
    )
  );
}


/* =========================================================
   HISTORICAL RSI
========================================================= */

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
      let j =
        i - period + 1;
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
          Math.abs(
            difference
          );
      }
    }

    if (losses === 0) {

      result[i] = 100;

    } else {

      const rs =
        gains / losses;

      result[i] =
        100 -
        (
          100 /
          (1 + rs)
        );
    }
  }

  return result;
}


/* =========================================================
   MACD
========================================================= */

function calculateHistoricalMACD(
  values
) {

  const ema12 =
    calculateHistoricalEMA(
      values,
      12
    );

  const ema26 =
    calculateHistoricalEMA(
      values,
      26
    );

  const macd =
    new Array(values.length)
      .fill(null);

  for (
    let i = 0;
    i < values.length;
    i++
  ) {

    if (
      ema12[i] !== null &&
      ema26[i] !== null
    ) {

      macd[i] =
        ema12[i] -
        ema26[i];
    }
  }

  const validMACD =
    macd.filter(
      value =>
        value !== null
    );

  const signalValues =
    calculateEMA(
      validMACD,
      9
    );

  const signal =
    new Array(values.length)
      .fill(null);

  let signalIndex = 0;

  for (
    let i = 0;
    i < values.length;
    i++
  ) {

    if (
      macd[i] !== null
    ) {

      if (
        signalValues[
          signalIndex
        ] !== undefined
      ) {

        signal[i] =
          signalValues[
            signalIndex
          ];
      }

      signalIndex++;
    }
  }

  return {
    macd,
    signal
  };
}


/* =========================================================
   ATR
========================================================= */

function calculateHistoricalATR(
  history,
  period = 14
) {

  const result =
    new Array(history.length)
      .fill(null);

  const trueRanges = [];

  for (
    let i = 0;
    i < history.length;
    i++
  ) {

    if (i === 0) {

      trueRanges.push(
        history[i].high -
        history[i].low
      );

      continue;
    }

    const high =
      history[i].high;

    const low =
      history[i].low;

    const previousClose =
      history[i - 1].close;

    const tr =
      Math.max(
        high - low,

        Math.abs(
          high -
          previousClose
        ),

        Math.abs(
          low -
          previousClose
        )
      );

    trueRanges.push(tr);
  }

  for (
    let i = period - 1;
    i < trueRanges.length;
    i++
  ) {

    const slice =
      trueRanges.slice(
        i - period + 1,
        i + 1
      );

    result[i] =
      slice.reduce(
        (sum, value) =>
          sum + value,
        0
      ) / period;
  }

  return result;
}


/* =========================================================
   ADX
========================================================= */

function calculateADX(
  history,
  period = 14
) {

  const length =
    history.length;

  const adx =
    new Array(length)
      .fill(null);

  if (
    length <
    period * 2
  ) {
    return adx;
  }

  const tr = [];
  const plusDM = [];
  const minusDM = [];

  for (
    let i = 1;
    i < length;
    i++
  ) {

    const high =
      history[i].high;

    const low =
      history[i].low;

    const previousHigh =
      history[i - 1].high;

    const previousLow =
      history[i - 1].low;

    const previousClose =
      history[i - 1].close;

    const trueRange =
      Math.max(
        high - low,

        Math.abs(
          high -
          previousClose
        ),

        Math.abs(
          low -
          previousClose
        )
      );

    const upMove =
      high -
      previousHigh;

    const downMove =
      previousLow -
      low;

    tr.push(trueRange);

    plusDM.push(
      upMove > downMove &&
      upMove > 0
        ? upMove
        : 0
    );

    minusDM.push(
      downMove > upMove &&
      downMove > 0
        ? downMove
        : 0
    );
  }

  const dx = [];

  for (
    let i = period;
    i <= tr.length;
    i++
  ) {

    const trSlice =
      tr.slice(
        i - period,
        i
      );

    const plusSlice =
      plusDM.slice(
        i - period,
        i
      );

    const minusSlice =
      minusDM.slice(
        i - period,
        i
      );

    const trSum =
      trSlice.reduce(
        (a, b) =>
          a + b,
        0
      );

    if (
      trSum === 0
    ) {
      continue;
    }

    const plusDI =
      (
        plusSlice.reduce(
          (a, b) =>
            a + b,
          0
        ) /
        trSum
      ) * 100;

    const minusDI =
      (
        minusSlice.reduce(
          (a, b) =>
            a + b,
          0
        ) /
        trSum
      ) * 100;

    const denominator =
      plusDI +
      minusDI;

    if (
      denominator === 0
    ) {
      continue;
    }

    const currentDX =
      (
        Math.abs(
          plusDI -
          minusDI
        ) /
        denominator
      ) * 100;

    dx.push({
      index: i,
      value: currentDX,
      plusDI,
      minusDI
    });
  }

  if (
    dx.length < period
  ) {
    return adx;
  }

  for (
    let i = period - 1;
    i < dx.length;
    i++
  ) {

    const slice =
      dx.slice(
        i - period + 1,
        i + 1
      );

    const average =
      slice.reduce(
        (sum, item) =>
          sum + item.value,
        0
      ) / period;

    const originalIndex =
      slice[
        slice.length - 1
      ].index;

    adx[originalIndex] =
      average;
  }

  return adx;
}


/* =========================================================
   AVERAGE VOLUME
========================================================= */

function averageVolume(
  volumes,
  index,
  period = 20
) {

  if (
    index < period
  ) {
    return null;
  }

  let sum = 0;

  for (
    let i =
      index - period;
    i < index;
    i++
  ) {

    sum +=
      volumes[i] || 0;
  }

  return (
    sum / period
  );
}


/* =========================================================
   MOMENTUM
========================================================= */

function calculateMomentum(
  closes,
  index,
  period = 10
) {

  if (
    index < period
  ) {
    return 0;
  }

  const previous =
    closes[
      index - period
    ];

  if (!previous) {
    return 0;
  }

  return (
    (
      closes[index] -
      previous
    ) /
    previous
  ) * 100;
}


/* =========================================================
   SUPPORT / RESISTANCE
========================================================= */

function getSupportResistance(
  history,
  index,
  period = 30
) {

  const start =
    Math.max(
      0,
      index - period
    );

  const candles =
    history.slice(
      start,
      index
    );

  if (
    !candles.length
  ) {

    return {
      support: null,
      resistance: null
    };
  }

  const support =
    Math.min(
      ...candles.map(
        item => item.low
      )
    );

  const resistance =
    Math.max(
      ...candles.map(
        item => item.high
      )
    );

  return {
    support,
    resistance
  };
}


/* =========================================================
   CANDLE CONFIRMATION
========================================================= */

function candleDirection(
  candle
) {

  const body =
    candle.close -
    candle.open;

  const range =
    candle.high -
    candle.low;

  if (
    range <= 0
  ) {
    return 0;
  }

  const bodyStrength =
    Math.abs(body) /
    range;

  if (
    body > 0 &&
    bodyStrength >= 0.55
  ) {

    return 1;
  }

  if (
    body < 0 &&
    bodyStrength >= 0.55
  ) {

    return -1;
  }

  return 0;
}


/* =========================================================
   GENERATE HISTORICAL SIGNALS
========================================================= */

function generateSignals(
  history
) {

  const closes =
    history.map(
      item => item.close
    );

  const volumes =
    history.map(
      item =>
        item.volume || 0
    );

  const sma20 =
    historicalSMA(
      closes,
      20
    );

  const sma50 =
    historicalSMA(
      closes,
      50
    );

  const ema20 =
    calculateHistoricalEMA(
      closes,
      20
    );

  const ema50 =
    calculateHistoricalEMA(
      closes,
      50
    );

  const ema200 =
    calculateHistoricalEMA(
      closes,
      200
    );

  const rsi =
    calculateHistoricalRSI(
      closes,
      14
    );

  const macdData =
    calculateHistoricalMACD(
      closes
    );

  const atr =
    calculateHistoricalATR(
      history,
      14
    );

  const adx =
    calculateADX(
      history,
      14
    );

  const signals = [];

  /*
    If 200-day EMA exists,
    use it.

    For 6M data, there may
    not be enough history, so
    the algorithm automatically
    works without EMA200.
  */

  const startIndex =
    Math.max(
      60,
      ema200.some(
        value =>
          value !== null
      )
        ? 200
        : 60
    );


  for (
    let i = startIndex;
    i < history.length;
    i++
  ) {

    const close =
      closes[i];

    if (
      sma20[i] === null ||
      sma50[i] === null ||
      ema20[i] === null ||
      ema50[i] === null ||
      rsi[i] === null ||
      macdData.macd[i] === null
    ) {
      continue;
    }


    const currentRSI =
      rsi[i];

    const currentMACD =
      macdData.macd[i];

    const currentMACDSignal =
      macdData.signal[i];

    const previousMACD =
      macdData.macd[i - 1];

    const previousMACDSignal =
      macdData.signal[i - 1];

    const currentADX =
      adx[i];

    const currentATR =
      atr[i];


    let buyScore = 0;
    let sellScore = 0;


    /* =====================================================
       MAJOR TREND
    ===================================================== */

    if (
      ema200[i] !== null
    ) {

      if (
        close >
        ema200[i]
      ) {

        buyScore += 15;

      } else {

        sellScore += 15;
      }
    }


    /* =====================================================
       EMA20 / EMA50 TREND
    ===================================================== */

    if (
      ema20[i] >
      ema50[i]
    ) {

      buyScore += 12;

    } else {

      sellScore += 12;
    }


    /* =====================================================
       PRICE VS EMA20
    ===================================================== */

    if (
      close >
      ema20[i]
    ) {

      buyScore += 8;

    } else {

      sellScore += 8;
    }


    /* =====================================================
       RSI
    ===================================================== */

    if (
      currentRSI >= 52 &&
      currentRSI <= 68
    ) {

      buyScore += 12;

    } else if (
      currentRSI > 68 &&
      currentRSI <= 75
    ) {

      buyScore += 5;

    } else if (
      currentRSI < 30
    ) {

      /*
        Oversold alone does
        NOT produce a BUY.
      */

      buyScore += 2;

    } else if (
      currentRSI < 45
    ) {

      sellScore += 8;

    } else if (
      currentRSI > 75
    ) {

      sellScore += 10;
    }


    /* =====================================================
       MACD
    ===================================================== */

    if (
      currentMACD !== null &&
      currentMACDSignal !== null
    ) {

      if (
        currentMACD >
        currentMACDSignal
      ) {

        buyScore += 10;

      } else {

        sellScore += 10;
      }


      const histogram =
        currentMACD -
        currentMACDSignal;

      const previousHistogram =
        previousMACD !== null &&
        previousMACDSignal !== null
          ? previousMACD -
            previousMACDSignal
          : 0;


      if (
        histogram >
        previousHistogram
      ) {

        buyScore += 5;

      } else if (
        histogram <
        previousHistogram
      ) {

        sellScore += 5;
      }
    }


    /* =====================================================
       MACD CROSSOVER
    ===================================================== */

    if (
      previousMACD !== null &&
      previousMACDSignal !== null &&
      currentMACD !== null &&
      currentMACDSignal !== null
    ) {

      const bullishCross =
        previousMACD <=
          previousMACDSignal &&
        currentMACD >
          currentMACDSignal;

      const bearishCross =
        previousMACD >=
          previousMACDSignal &&
        currentMACD <
          currentMACDSignal;


      if (
        bullishCross
      ) {

        buyScore += 10;
      }


      if (
        bearishCross
      ) {

        sellScore += 10;
      }
    }


    /* =====================================================
       ADX TREND STRENGTH
    ===================================================== */

    if (
      currentADX !== null &&
      currentADX !== undefined
    ) {

      if (
        currentADX >= 25
      ) {

        if (
          ema20[i] >
          ema50[i]
        ) {

          buyScore += 8;

        } else {

          sellScore += 8;
        }
      }
    }


    /* =====================================================
       VOLUME CONFIRMATION
    ===================================================== */

    const avgVol =
      averageVolume(
        volumes,
        i,
        20
      );

    const currentVolume =
      volumes[i];


    if (
      avgVol &&
      currentVolume >
        avgVol * 1.30
    ) {

      if (
        close >
        history[i].open
      ) {

        buyScore += 8;

      } else {

        sellScore += 8;
      }
    }


    /* =====================================================
       MOMENTUM
    ===================================================== */

    const momentum =
      calculateMomentum(
        closes,
        i,
        10
      );


    if (
      momentum > 2.5
    ) {

      buyScore += 8;

    } else if (
      momentum < -2.5
    ) {

      sellScore += 8;
    }


    /* =====================================================
       BREAKOUT
    ===================================================== */

    const lookbackStart =
      Math.max(
        0,
        i - 20
      );

    const previousCandles =
      history.slice(
        lookbackStart,
        i
      );


    if (
      previousCandles.length >= 15
    ) {

      const resistance =
        Math.max(
          ...previousCandles.map(
            item =>
              item.high
          )
        );

      const support =
        Math.min(
          ...previousCandles.map(
            item =>
              item.low
          )
        );


      /*
        Breakout only gets
        strong confirmation
        when volume is high.
      */

      if (
        close >
          resistance &&
        avgVol &&
        currentVolume >
          avgVol * 1.30
      ) {

        buyScore += 12;
      }


      if (
        close <
          support &&
        avgVol &&
        currentVolume >
          avgVol * 1.30
      ) {

        sellScore += 12;
      }
    }


    /* =====================================================
       SUPPORT / RESISTANCE
    ===================================================== */

    const sr =
      getSupportResistance(
        history,
        i,
        30
      );


    if (
      sr.resistance !== null &&
      close >
        sr.resistance
    ) {

      buyScore += 5;
    }


    if (
      sr.support !== null &&
      close <
        sr.support
    ) {

      sellScore += 5;
    }


    /* =====================================================
       CANDLE CONFIRMATION
    ===================================================== */

    const candle =
      candleDirection(
        history[i]
      );


    if (
      candle > 0 &&
      buyScore > sellScore
    ) {

      buyScore += 5;
    }


    if (
      candle < 0 &&
      sellScore > buyScore
    ) {

      sellScore += 5;
    }


    /* =====================================================
       VOLATILITY FILTER
    ===================================================== */

    if (
      currentATR !== null &&
      currentATR > 0
    ) {

      const atrPercentage =
        (
          currentATR /
          close
        ) * 100;


      /*
        Very high volatility
        reduces confidence.
      */

      if (
        atrPercentage > 6
      ) {

        buyScore -= 5;
        sellScore -= 5;
      }
    }


    /* =====================================================
       FINAL SIGNAL
    ===================================================== */

    let signal = "HOLD";
    let score = 50;


    /*
      Strong BUY requires:

      72+ technical score
      AND
      15 point separation
    */

    if (
      buyScore >= 72 &&
      buyScore >
        sellScore + 15
    ) {

      signal =
        "BUY";


      score =
        Math.min(
          95,
          Math.round(
            50 +
            (
              buyScore -
              sellScore
            ) * 0.9
          )
        );


    } else if (
      sellScore >= 72 &&
      sellScore >
        buyScore + 15
    ) {

      signal =
        "SELL";


      score =
        Math.max(
          5,
          Math.round(
            50 -
            (
              sellScore -
              buyScore
            ) * 0.9
          )
        );


    } else {

      signal =
        "HOLD";


      score =
        Math.round(
          50 +
          (
            buyScore -
            sellScore
          ) * 0.4
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


    /* =====================================================
       SAVE ONLY STRONG SIGNALS
    ===================================================== */

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
            currentRSI.toFixed(2)
          ),

        ma20:
          Number(
            sma20[i].toFixed(2)
          ),

        ma50:
          Number(
            sma50[i].toFixed(2)
          ),

        ema200:
          ema200[i] !== null
            ? Number(
                ema200[i]
                  .toFixed(2)
              )
            : null,

        adx:
          currentADX !== null &&
          currentADX !== undefined
            ? Number(
                currentADX
                  .toFixed(2)
              )
            : null
      });
    }
  }


  return signals;
}


/* =========================================================
   BACKTEST
   ---------------------------------------------------------
   Entry:
   Next trading day's OPEN

   Exit:
   10 trading days later CLOSE

   This avoids using the signal-day
   closing price as the entry price.
========================================================= */

function backtestSignals(
  history,
  signals
) {

  const trades = [];

  const signalMap =
    new Map();


  for (
    const signal of signals
  ) {

    signalMap.set(
      signal.date,
      signal
    );
  }


  for (
    let i = 0;
    i < history.length - 10;
    i++
  ) {

    const signal =
      signalMap.get(
        history[i].date
      );


    if (!signal) {
      continue;
    }


    const entryIndex =
      i + 1;

    const exitIndex =
      i + 10;


    if (
      !history[entryIndex] ||
      !history[exitIndex]
    ) {
      continue;
    }


    const entry =
      history[
        entryIndex
      ].open;

    const exit =
      history[
        exitIndex
      ].close;


    if (
      !Number.isFinite(entry) ||
      !Number.isFinite(exit) ||
      entry <= 0
    ) {

      continue;
    }


    let returnPercent;


    if (
      signal.signal === "BUY"
    ) {

      returnPercent =
        (
          (
            exit -
            entry
          ) /
          entry
        ) * 100;

    } else {

      returnPercent =
        (
          (
            entry -
            exit
          ) /
          entry
        ) * 100;
    }


    trades.push({

      signalDate:
        signal.date,

      entryDate:
        history[
          entryIndex
        ].date,

      exitDate:
        history[
          exitIndex
        ].date,

      signal:
        signal.signal,

      score:
        signal.score,

      entry:
        Number(
          entry.toFixed(2)
        ),

      exit:
        Number(
          exit.toFixed(2)
        ),

      returnPercent:
        Number(
          returnPercent.toFixed(2)
        )
    });
  }


  /* =====================================================
     NO TRADES
  ===================================================== */

  if (
    trades.length === 0
  ) {

    return {

      totalTrades: 0,

      winningTrades: 0,

      losingTrades: 0,

      winRate: 0,

      averageReturn: 0,

      totalReturn: 0,

      profitFactor: 0,

      maxDrawdown: 0,

      trades: []
    };
  }


  /* =====================================================
     WIN / LOSS
  ===================================================== */

  const winningTrades =
    trades.filter(
      trade =>
        trade.returnPercent > 0
    );


  const losingTrades =
    trades.filter(
      trade =>
        trade.returnPercent <= 0
    );


  /* =====================================================
     WIN RATE
  ===================================================== */

  const winRate =
    (
      winningTrades.length /
      trades.length
    ) * 100;


  /* =====================================================
     AVERAGE RETURN
  ===================================================== */

  const averageReturn =
    trades.reduce(
      (
        sum,
        trade
      ) =>
        sum +
        trade.returnPercent,
      0
    ) /
    trades.length;


  /* =====================================================
     TOTAL RETURN
  ===================================================== */

  const totalReturn =
    trades.reduce(
      (
        sum,
        trade
      ) =>
        sum +
        trade.returnPercent,
      0
    );


  /* =====================================================
     PROFIT FACTOR
  ===================================================== */

  const grossProfit =
    winningTrades.reduce(
      (
        sum,
        trade
      ) =>
        sum +
        trade.returnPercent,
      0
    );


  const grossLoss =
    Math.abs(
      losingTrades.reduce(
        (
          sum,
          trade
        ) =>
          sum +
          trade.returnPercent,
        0
      )
    );


  const profitFactor =
    grossLoss > 0
      ? grossProfit /
        grossLoss
      : grossProfit > 0
        ? 999
        : 0;


  /* =====================================================
     EQUITY / MAX DRAWDOWN
  ===================================================== */

  let equity = 100;
  let peak = 100;
  let maxDrawdown = 0;


  for (
    const trade of trades
  ) {

    equity *=
      1 +
      (
        trade.returnPercent /
        100
      );


    if (
      equity > peak
    ) {

      peak =
        equity;
    }


    const drawdown =
      (
        (
          peak -
          equity
        ) /
        peak
      ) * 100;


    if (
      drawdown >
      maxDrawdown
    ) {

      maxDrawdown =
        drawdown;
    }
  }


  return {

    totalTrades:
      trades.length,

    winningTrades:
      winningTrades.length,

    losingTrades:
      losingTrades.length,

    winRate:
      Number(
        winRate.toFixed(2)
      ),

    averageReturn:
      Number(
        averageReturn.toFixed(2)
      ),

    totalReturn:
      Number(
        totalReturn.toFixed(2)
      ),

    profitFactor:
      Number(
        profitFactor.toFixed(2)
      ),

    maxDrawdown:
      Number(
        maxDrawdown.toFixed(2)
      ),

    holdingPeriod:
      10,

    trades
  };
}


/* =========================================================
   CURRENT SCORE
========================================================= */

function calculateCurrentScore(
  history
) {

  const closes =
    history.map(
      item => item.close
    );

  const volumes =
    history.map(
      item =>
        item.volume || 0
    );


  const lastIndex =
    closes.length - 1;


  const last =
    closes[lastIndex];


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


  const ema20Values =
    calculateHistoricalEMA(
      closes,
      20
    );


  const ema50Values =
    calculateHistoricalEMA(
      closes,
      50
    );


  const ema200Values =
    calculateHistoricalEMA(
      closes,
      200
    );


  const ema20 =
    ema20Values[
      lastIndex
    ];


  const ema50 =
    ema50Values[
      lastIndex
    ];


  const ema200 =
    ema200Values[
      lastIndex
    ];


  const rsi =
    calculateRSI(
      closes,
      14
    );


  const macdData =
    calculateHistoricalMACD(
      closes
    );


  const macd =
    macdData.macd[
      lastIndex
    ];


  const macdSignal =
    macdData.signal[
      lastIndex
    ];


  const adxValues =
    calculateADX(
      history,
      14
    );


  const adx =
    adxValues[
      lastIndex
    ];


  let buyScore = 0;
  let sellScore = 0;


  /* =====================================================
     MAJOR TREND
  ===================================================== */

  if (
    ema200 !== null &&
    ema200 !== undefined
  ) {

    if (
      last >
      ema200
    ) {

      buyScore += 18;

    } else {

      sellScore += 18;
    }
  }


  /* =====================================================
     EMA20 / EMA50
  ===================================================== */

  if (
    ema20 !== null &&
    ema50 !== null
  ) {

    if (
      ema20 >
      ema50
    ) {

      buyScore += 14;

    } else {

      sellScore += 14;
    }
  }


  /* =====================================================
     PRICE VS EMA20
  ===================================================== */

  if (
    ema20 !== null
  ) {

    if (
      last >
      ema20
    ) {

      buyScore += 10;

    } else {

      sellScore += 10;
    }
  }


  /* =====================================================
     RSI
  ===================================================== */

  if (
    rsi >= 52 &&
    rsi <= 68
  ) {

    buyScore += 14;

  } else if (
    rsi > 68 &&
    rsi <= 75
  ) {

    buyScore += 5;

  } else if (
    rsi < 42
  ) {

    sellScore += 8;

  } else if (
    rsi > 75
  ) {

    sellScore += 10;
  }


  /* =====================================================
     MACD
  ===================================================== */

  if (
    macd !== null &&
    macdSignal !== null
  ) {

    if (
      macd >
      macdSignal
    ) {

      buyScore += 12;

    } else {

      sellScore += 12;
    }
  }


  /* =====================================================
     ADX
  ===================================================== */

  if (
    adx !== null &&
    adx !== undefined &&
    adx >= 25
  ) {

    if (
      ema20 !== null &&
      ema50 !== null &&
      ema20 >
      ema50
    ) {

      buyScore += 8;

    } else {

      sellScore += 8;
    }
  }


  /* =====================================================
     VOLUME
  ===================================================== */

  const avgVol =
    averageVolume(
      volumes,
      lastIndex,
      20
    );


  if (
    avgVol &&
    volumes[lastIndex] >
      avgVol * 1.25
  ) {

    if (
      last >
      history[
        lastIndex
      ].open
    ) {

      buyScore += 6;

    } else {

      sellScore += 6;
    }
  }


  /* =====================================================
     MOMENTUM
  ===================================================== */

  const momentum =
    calculateMomentum(
      closes,
      lastIndex,
      10
    );


  if (
    momentum > 2
  ) {

    buyScore += 6;

  } else if (
    momentum < -2
  ) {

    sellScore += 6;
  }


  /* =====================================================
     FINAL SCORE
  ===================================================== */

  let score =
    50 +
    (
      buyScore -
      sellScore
    ) * 0.85;


  score =
    Math.round(
      Math.max(
        5,
        Math.min(
          95,
          score
        )
      )
    );


  let signal =
    "NEUTRAL";


  if (
    buyScore >= 60 &&
    buyScore >
      sellScore + 12
  ) {

    signal =
      "BULLISH";

  } else if (
    sellScore >= 60 &&
    sellScore >
      buyScore + 12
  ) {

    signal =
      "BEARISH";
  }


  return {

    score,

    signal,

    rsi,

    ma20,

    ma50,

    ema20,

    ema50,

    ema200,

    macd,

    macdSignal,

    adx
  };
}


/* =========================================================
   API
========================================================= */

module.exports =
async function(req, res) {

  try {

    /* =====================================================
       SYMBOL
    ===================================================== */

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


    /* =====================================================
       RANGE
    ===================================================== */

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


    /* =====================================================
       YAHOO FINANCE
    ===================================================== */

    const url =
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}.NS?range=${range}&interval=1d&events=history`;


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


    /* =====================================================
       MARKET DATA
    ===================================================== */

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
            timestamps[i] *
            1000
          )
          .toISOString()
          .slice(
            0,
            10
          ),

        open:
          Number(open),

        high:
          Number(high),

        low:
          Number(low),

        close:
          Number(close),

        volume:
          Number(
            volume || 0
          )
      });
    }


    /* =====================================================
       MINIMUM DATA
    ===================================================== */

    if (
      history.length < 60
    ) {

      throw new Error(
        "Not enough historical data for technical analysis."
      );
    }


    /* =====================================================
       CURRENT PRICE
    ===================================================== */

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


    /* =====================================================
       CURRENT ANALYSIS
    ===================================================== */

    const current =
      calculateCurrentScore(
        history
      );


    /* =====================================================
       HISTORICAL SIGNALS
    ===================================================== */

    const signals =
      generateSignals(
        history
      );


    /* =====================================================
       BACKTEST
    ===================================================== */

    const backtest =
      backtestSignals(
        history,
        signals
      );


    /* =====================================================
       RESPONSE
    ===================================================== */

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

      ema20:
        current.ema20,

      ema50:
        current.ema50,

      ema200:
        current.ema200,

      macd:
        current.macd,

      macdSignal:
        current.macdSignal,

      adx:
        current.adx,

      history,

      signals,

      backtest

    });

  } catch (
    error
  ) {

    res.status(400).json({

      error:
        error.message ||
        "Unexpected error."

    });
  }
};
