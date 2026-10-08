// /api/stock.js

export default async function handler(req, res) {
  try {
    const { symbol, range = "1y" } = req.query;

    if (!symbol) {
      return res.status(400).json({
        error: "Stock symbol is required"
      });
    }

    const cleanSymbol = String(symbol)
      .trim()
      .toUpperCase()
      .replace(".NS", "");

    const allowedRanges = ["6mo", "1y", "2y", "5y", "max"];

    const selectedRange = allowedRanges.includes(range)
      ? range
      : "1y";

    const yahooUrl =
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
        cleanSymbol
      )}.NS?range=${selectedRange}&interval=1d&events=history`;

    const response = await fetch(yahooUrl);

    if (!response.ok) {
      return res.status(500).json({
        error: "Unable to fetch stock data"
      });
    }

    const json = await response.json();

    const result = json?.chart?.result?.[0];

    if (!result) {
      return res.status(404).json({
        error: `No stock data found for ${cleanSymbol}`
      });
    }

    const timestamps = result.timestamp || [];

    const quote = result.indicators?.quote?.[0] || {};

    const opens = quote.open || [];
    const highs = quote.high || [];
    const lows = quote.low || [];
    const closes = quote.close || [];
    const volumes = quote.volume || [];

    const history = [];

    for (let i = 0; i < timestamps.length; i++) {
      const open = opens[i];
      const high = highs[i];
      const low = lows[i];
      const close = closes[i];
      const volume = volumes[i];

      if (
        open == null ||
        high == null ||
        low == null ||
        close == null
      ) {
        continue;
      }

      const date = new Date(timestamps[i] * 1000)
        .toISOString()
        .slice(0, 10);

      history.push({
        date,
        open: Number(open),
        high: Number(high),
        low: Number(low),
        close: Number(close),
        volume: Number(volume || 0)
      });
    }

    if (history.length < 50) {
      return res.status(400).json({
        error: "Not enough historical data for analysis"
      });
    }

    // =========================================================
    // BASIC INDICATORS
    // =========================================================

    function sma(values, period) {
      if (values.length < period) return null;

      let sum = 0;

      for (let i = values.length - period; i < values.length; i++) {
        sum += values[i];
      }

      return sum / period;
    }

    function historicalSMA(values, period) {
      const output = new Array(values.length).fill(null);

      let sum = 0;

      for (let i = 0; i < values.length; i++) {
        sum += values[i];

        if (i >= period) {
          sum -= values[i - period];
        }

        if (i >= period - 1) {
          output[i] = sum / period;
        }
      }

      return output;
    }

    function ema(values, period) {
      if (values.length < period) return null;

      const multiplier = 2 / (period + 1);

      let previous = 0;

      for (let i = 0; i < period; i++) {
        previous += values[i];
      }

      previous /= period;

      for (let i = period; i < values.length; i++) {
        previous =
          (values[i] - previous) * multiplier +
          previous;
      }

      return previous;
    }

    function historicalEMA(values, period) {
      const output = new Array(values.length).fill(null);

      if (values.length < period) {
        return output;
      }

      const multiplier = 2 / (period + 1);

      let previous = 0;

      for (let i = 0; i < period; i++) {
        previous += values[i];
      }

      previous /= period;

      output[period - 1] = previous;

      for (let i = period; i < values.length; i++) {
        previous =
          (values[i] - previous) * multiplier +
          previous;

        output[i] = previous;
      }

      return output;
    }

    // =========================================================
    // RSI
    // =========================================================

    function rsi(values, period = 14) {
      if (values.length <= period) return null;

      let gains = 0;
      let losses = 0;

      for (let i = 1; i <= period; i++) {
        const difference = values[i] - values[i - 1];

        if (difference >= 0) {
          gains += difference;
        } else {
          losses += Math.abs(difference);
        }
      }

      let averageGain = gains / period;
      let averageLoss = losses / period;

      for (let i = period + 1; i < values.length; i++) {
        const difference = values[i] - values[i - 1];

        const gain = difference > 0 ? difference : 0;
        const loss = difference < 0 ? Math.abs(difference) : 0;

        averageGain =
          ((averageGain * (period - 1)) + gain) /
          period;

        averageLoss =
          ((averageLoss * (period - 1)) + loss) /
          period;
      }

      if (averageLoss === 0) {
        return 100;
      }

      const rs = averageGain / averageLoss;

      return 100 - 100 / (1 + rs);
    }

    function historicalRSI(values, period = 14) {
      const output = new Array(values.length).fill(null);

      if (values.length <= period) {
        return output;
      }

      let gains = 0;
      let losses = 0;

      for (let i = 1; i <= period; i++) {
        const difference = values[i] - values[i - 1];

        if (difference >= 0) {
          gains += difference;
        } else {
          losses += Math.abs(difference);
        }
      }

      let averageGain = gains / period;
      let averageLoss = losses / period;

      if (averageLoss === 0) {
        output[period] = 100;
      } else {
        const rs = averageGain / averageLoss;
        output[period] = 100 - 100 / (1 + rs);
      }

      for (let i = period + 1; i < values.length; i++) {
        const difference = values[i] - values[i - 1];

        const gain = difference > 0 ? difference : 0;
        const loss = difference < 0 ? Math.abs(difference) : 0;

        averageGain =
          ((averageGain * (period - 1)) + gain) /
          period;

        averageLoss =
          ((averageLoss * (period - 1)) + loss) /
          period;

        if (averageLoss === 0) {
          output[i] = 100;
        } else {
          const rs = averageGain / averageLoss;

          output[i] =
            100 - 100 / (1 + rs);
        }
      }

      return output;
    }

    // =========================================================
    // MACD
    // =========================================================

    function calculateMACD(values) {
      if (values.length < 35) {
        return {
          macd: null,
          signal: null,
          histogram: null
        };
      }

      const ema12 = historicalEMA(values, 12);
      const ema26 = historicalEMA(values, 26);

      const macdValues = [];

      for (let i = 0; i < values.length; i++) {
        if (
          ema12[i] != null &&
          ema26[i] != null
        ) {
          macdValues[i] = ema12[i] - ema26[i];
        } else {
          macdValues[i] = null;
        }
      }

      const validMacd = macdValues.filter(
        value => value != null
      );

      const signalValues =
        historicalEMA(validMacd, 9);

      const currentMacd =
        macdValues[macdValues.length - 1];

      const currentSignal =
        signalValues[signalValues.length - 1];

      return {
        macd: currentMacd,
        signal: currentSignal,
        histogram:
          currentMacd != null &&
          currentSignal != null
            ? currentMacd - currentSignal
            : null
      };
    }

    // =========================================================
    // ATR
    // =========================================================

    function calculateATR(data, period = 14) {
      if (data.length <= period) {
        return null;
      }

      const trueRanges = [];

      for (let i = 1; i < data.length; i++) {
        const high = data[i].high;
        const low = data[i].low;
        const previousClose = data[i - 1].close;

        const tr = Math.max(
          high - low,
          Math.abs(high - previousClose),
          Math.abs(low - previousClose)
        );

        trueRanges.push(tr);
      }

      if (trueRanges.length < period) {
        return null;
      }

      let atr = 0;

      for (let i = 0; i < period; i++) {
        atr += trueRanges[i];
      }

      atr /= period;

      for (
        let i = period;
        i < trueRanges.length;
        i++
      ) {
        atr =
          ((atr * (period - 1)) +
            trueRanges[i]) /
          period;
      }

      return atr;
    }

    // =========================================================
    // ADX
    // =========================================================

    function calculateADX(data, period = 14) {
      if (data.length < period * 2) {
        return null;
      }

      const trs = [];
      const plusDM = [];
      const minusDM = [];

      for (let i = 1; i < data.length; i++) {
        const current = data[i];
        const previous = data[i - 1];

        const tr = Math.max(
          current.high - current.low,
          Math.abs(current.high - previous.close),
          Math.abs(current.low - previous.close)
        );

        const upMove =
          current.high - previous.high;

        const downMove =
          previous.low - current.low;

        let plus = 0;
        let minus = 0;

        if (
          upMove > downMove &&
          upMove > 0
        ) {
          plus = upMove;
        }

        if (
          downMove > upMove &&
          downMove > 0
        ) {
          minus = downMove;
        }

        trs.push(tr);
        plusDM.push(plus);
        minusDM.push(minus);
      }

      if (trs.length < period) {
        return null;
      }

      let atr = 0;
      let plus = 0;
      let minus = 0;

      for (let i = 0; i < period; i++) {
        atr += trs[i];
        plus += plusDM[i];
        minus += minusDM[i];
      }

      atr /= period;
      plus /= period;
      minus /= period;

      const dxValues = [];

      function addDX() {
        if (atr === 0) {
          dxValues.push(0);
          return;
        }

        const plusDI =
          (plus / atr) * 100;

        const minusDI =
          (minus / atr) * 100;

        const denominator =
          plusDI + minusDI;

        if (denominator === 0) {
          dxValues.push(0);
          return;
        }

        const dx =
          Math.abs(
            plusDI - minusDI
          ) /
          denominator *
          100;

        dxValues.push(dx);
      }

      addDX();

      for (
        let i = period;
        i < trs.length;
        i++
      ) {
        atr =
          ((atr * (period - 1)) +
            trs[i]) /
          period;

        plus =
          ((plus * (period - 1)) +
            plusDM[i]) /
          period;

        minus =
          ((minus * (period - 1)) +
            minusDM[i]) /
          period;

        addDX();
      }

      if (dxValues.length < period) {
        return null;
      }

      let adx = 0;

      for (let i = 0; i < period; i++) {
        adx += dxValues[i];
      }

      adx /= period;

      for (
        let i = period;
        i < dxValues.length;
        i++
      ) {
        adx =
          ((adx * (period - 1)) +
            dxValues[i]) /
          period;
      }

      return adx;
    }

    // =========================================================
    // AVERAGE VOLUME
    // =========================================================

    function averageVolume(data, period = 20) {
      if (data.length < period) {
        return null;
      }

      let total = 0;

      for (
        let i = data.length - period;
        i < data.length;
        i++
      ) {
        total += data[i].volume || 0;
      }

      return total / period;
    }

    // =========================================================
    // SUPPORT / RESISTANCE
    // =========================================================

    function calculateSupportResistance(data, period = 20) {
      if (data.length < period) {
        return {
          support: null,
          resistance: null
        };
      }

      const recent =
        data.slice(-period);

      let support = Infinity;
      let resistance = -Infinity;

      recent.forEach(item => {
        support =
          Math.min(support, item.low);

        resistance =
          Math.max(resistance, item.high);
      });

      return {
        support,
        resistance
      };
    }

    // =========================================================
    // MOMENTUM
    // =========================================================

    function calculateMomentum(values, period = 10) {
      if (values.length <= period) {
        return 0;
      }

      const current =
        values[values.length - 1];

      const previous =
        values[values.length - 1 - period];

      if (!previous) {
        return 0;
      }

      return (
        ((current - previous) /
          previous) *
        100
      );
    }

    // =========================================================
    // CANDLE STRENGTH
    // =========================================================

    function candleStrength(candle) {
      const range =
        candle.high - candle.low;

      if (range <= 0) {
        return 0;
      }

      const body =
        Math.abs(
          candle.close - candle.open
        );

      return body / range;
    }

    // =========================================================
    // CURRENT SCORE
    // =========================================================

    function calculateCurrentScore(data) {
      const closes =
        data.map(item => item.close);

      const current =
        data[data.length - 1];

      const previous =
        data[data.length - 2];

      const ma20 =
        sma(closes, 20);

      const ma50 =
        sma(closes, 50);

      const ema20 =
        ema(closes, 20);

      const ema50 =
        ema(closes, 50);

      const ema200 =
        closes.length >= 200
          ? ema(closes, 200)
          : null;

      const currentRSI =
        rsi(closes, 14);

      const macd =
        calculateMACD(closes);

      const adx =
        calculateADX(data, 14);

      const atr =
        calculateATR(data, 14);

      const avgVol =
        averageVolume(data, 20);

      const volumeRatio =
        avgVol && avgVol > 0
          ? current.volume / avgVol
          : 1;

      const momentum =
        calculateMomentum(closes, 10);

      const sr =
        calculateSupportResistance(data, 20);

      const candle =
        candleStrength(current);

      let buyScore = 0;
      let sellScore = 0;

      // -------------------------------------------------------
      // TREND
      // -------------------------------------------------------

      if (
        ema20 != null &&
        ema50 != null
      ) {
        if (ema20 > ema50) {
          buyScore += 15;
        } else if (ema20 < ema50) {
          sellScore += 15;
        }
      }

      // EMA200 trend filter
      if (ema200 != null) {
        if (current.close > ema200) {
          buyScore += 12;
        } else if (current.close < ema200) {
          sellScore += 12;
        }
      }

      // SMA trend
      if (
        ma20 != null &&
        ma50 != null
      ) {
        if (ma20 > ma50) {
          buyScore += 8;
        } else if (ma20 < ma50) {
          sellScore += 8;
        }
      }

      // -------------------------------------------------------
      // RSI
      // -------------------------------------------------------

      if (currentRSI != null) {
        if (
          currentRSI >= 55 &&
          currentRSI <= 70
        ) {
          buyScore += 12;
        } else if (
          currentRSI >= 45 &&
          currentRSI < 55
        ) {
          buyScore += 4;
        }

        if (
          currentRSI <= 45 &&
          currentRSI >= 30
        ) {
          sellScore += 12;
        } else if (
          currentRSI > 45 &&
          currentRSI <= 50
        ) {
          sellScore += 4;
        }

        // Avoid blindly buying overbought stocks
        if (currentRSI > 75) {
          sellScore += 8;
        }

        // Avoid blindly selling deeply oversold stocks
        if (currentRSI < 25) {
          buyScore += 8;
        }
      }

      // -------------------------------------------------------
      // MACD
      // -------------------------------------------------------

      if (
        macd.macd != null &&
        macd.signal != null
      ) {
        if (macd.macd > macd.signal) {
          buyScore += 10;
        } else {
          sellScore += 10;
        }

        if (macd.histogram > 0) {
          buyScore += 4;
        } else if (
          macd.histogram < 0
        ) {
          sellScore += 4;
        }
      }

      // -------------------------------------------------------
      // ADX
      // -------------------------------------------------------

      if (adx != null) {
        if (adx >= 25) {
          // Strong trend: strengthen existing direction
          if (
            ema20 != null &&
            ema50 != null
          ) {
            if (ema20 > ema50) {
              buyScore += 8;
            } else if (
              ema20 < ema50
            ) {
              sellScore += 8;
            }
          }
        }
      }

      // -------------------------------------------------------
      // MOMENTUM
      // -------------------------------------------------------

      if (momentum > 5) {
        buyScore += 8;
      } else if (momentum > 2) {
        buyScore += 4;
      } else if (momentum < -5) {
        sellScore += 8;
      } else if (momentum < -2) {
        sellScore += 4;
      }

      // -------------------------------------------------------
      // VOLUME CONFIRMATION
      // -------------------------------------------------------

      if (volumeRatio >= 1.5) {
        if (
          current.close >
          previous.close
        ) {
          buyScore += 8;
        } else if (
          current.close <
          previous.close
        ) {
          sellScore += 8;
        }
      } else if (volumeRatio >= 1.2) {
        if (
          current.close >
          previous.close
        ) {
          buyScore += 4;
        } else if (
          current.close <
          previous.close
        ) {
          sellScore += 4;
        }
      }

      // -------------------------------------------------------
      // SUPPORT / RESISTANCE
      // -------------------------------------------------------

      if (
        sr.support != null &&
        sr.resistance != null
      ) {
        const range =
          sr.resistance -
          sr.support;

        if (range > 0) {
          const supportDistance =
            (current.close -
              sr.support) /
            range;

          const resistanceDistance =
            (sr.resistance -
              current.close) /
            range;

          if (
            supportDistance < 0.20
          ) {
            buyScore += 6;
          }

          if (
            resistanceDistance < 0.15
          ) {
            sellScore += 6;
          }
        }
      }

      // -------------------------------------------------------
      // CANDLE STRENGTH
      // -------------------------------------------------------

      if (candle >= 0.65) {
        if (
          current.close >
          current.open
        ) {
          buyScore += 5;
        } else if (
          current.close <
          current.open
        ) {
          sellScore += 5;
        }
      }

      // -------------------------------------------------------
      // SHORT-TERM PRICE DIRECTION
      // -------------------------------------------------------

      if (
        current.close >
        previous.close
      ) {
        buyScore += 3;
      } else if (
        current.close <
        previous.close
      ) {
        sellScore += 3;
      }

      // =======================================================
      // NORMALIZED SCORE
      //
      // IMPORTANT:
      // Do NOT calculate:
      //
      // 50 + (buyScore - sellScore) * 0.85
      //
      // because that causes score saturation at 95/5.
      // =======================================================

      const totalEvidence =
        buyScore + sellScore;

      let score = 50;

      if (totalEvidence > 0) {
        const bullishRatio =
          buyScore / totalEvidence;

        // 10 -> 90 range
        score =
          50 +
          (bullishRatio - 0.5) *
            80;
      }

      score = Math.round(
        Math.max(
          10,
          Math.min(90, score)
        )
      );

      // =======================================================
      // SIGNAL
      // =======================================================

      const difference =
        Math.abs(
          buyScore - sellScore
        );

      const bullishRatio =
        totalEvidence > 0
          ? buyScore / totalEvidence
          : 0.5;

      let signal = "NEUTRAL";

      if (
        buyScore >= 42 &&
        bullishRatio >= 0.62 &&
        difference >= 8
      ) {
        signal = "BULLISH";
      } else if (
        sellScore >= 42 &&
        bullishRatio <= 0.38 &&
        difference >= 8
      ) {
        signal = "BEARISH";
      }

      return {
        score,
        signal,
        ma20,
        ma50,
        ema20,
        ema50,
        ema200,
        rsi: currentRSI,
        macd: macd.macd,
        macdSignal: macd.signal,
        macdHistogram: macd.histogram,
        adx,
        atr,
        volumeRatio,
        momentum,
        support: sr.support,
        resistance: sr.resistance,
        buyScore,
        sellScore
      };
    }

    // =========================================================
    // HISTORICAL SIGNAL GENERATION
    // =========================================================

    function generateSignals(data) {
      const closes =
        data.map(item => item.close);

      const ema20Values =
        historicalEMA(closes, 20);

      const ema50Values =
        historicalEMA(closes, 50);

      const ema200Values =
        historicalEMA(closes, 200);

      const rsiValues =
        historicalRSI(closes, 14);

      const signals = [];

      // Start after enough data exists
      const startIndex =
        Math.max(50, 200);

      for (
        let i = startIndex;
        i < data.length;
        i++
      ) {
        const current =
          data[i];

        const previous =
          data[i - 1];

        if (
          ema20Values[i] == null ||
          ema50Values[i] == null ||
          rsiValues[i] == null
        ) {
          continue;
        }

        let buyScore = 0;
        let sellScore = 0;

        // -----------------------------------------------------
        // EMA TREND
        // -----------------------------------------------------

        if (
          ema20Values[i] >
          ema50Values[i]
        ) {
          buyScore += 15;
        } else {
          sellScore += 15;
        }

        // EMA200
        if (
          ema200Values[i] != null
        ) {
          if (
            current.close >
            ema200Values[i]
          ) {
            buyScore += 12;
          } else {
            sellScore += 12;
          }
        }

        // -----------------------------------------------------
        // RSI
        // -----------------------------------------------------

        if (
          rsiValues[i] >= 55 &&
          rsiValues[i] <= 70
        ) {
          buyScore += 12;
        } else if (
          rsiValues[i] >= 45 &&
          rsiValues[i] < 55
        ) {
          buyScore += 4;
        }

        if (
          rsiValues[i] <= 45 &&
          rsiValues[i] >= 30
        ) {
          sellScore += 12;
        } else if (
          rsiValues[i] > 45 &&
          rsiValues[i] <= 50
        ) {
          sellScore += 4;
        }

        if (rsiValues[i] > 75) {
          sellScore += 8;
        }

        if (rsiValues[i] < 25) {
          buyScore += 8;
        }

        // -----------------------------------------------------
        // MACD
        // -----------------------------------------------------

        const historicalCloses =
          closes.slice(0, i + 1);

        const macd =
          calculateMACD(
            historicalCloses
          );

        if (
          macd.macd != null &&
          macd.signal != null
        ) {
          if (
            macd.macd >
            macd.signal
          ) {
            buyScore += 10;
          } else {
            sellScore += 10;
          }

          if (
            macd.histogram > 0
          ) {
            buyScore += 4;
          } else {
            sellScore += 4;
          }
        }

        // -----------------------------------------------------
        // MOMENTUM
        // -----------------------------------------------------

        if (i >= 10) {
          const oldPrice =
            closes[i - 10];

          const momentum =
            ((current.close -
              oldPrice) /
              oldPrice) *
            100;

          if (momentum > 5) {
            buyScore += 8;
          } else if (
            momentum > 2
          ) {
            buyScore += 4;
          } else if (
            momentum < -5
          ) {
            sellScore += 8;
          } else if (
            momentum < -2
          ) {
            sellScore += 4;
          }
        }

        // -----------------------------------------------------
        // VOLUME
        // -----------------------------------------------------

        if (i >= 20) {
          let totalVolume = 0;

          for (
            let j = i - 20;
            j < i;
            j++
          ) {
            totalVolume +=
              data[j].volume || 0;
          }

          const avgVolume =
            totalVolume / 20;

          if (avgVolume > 0) {
            const ratio =
              current.volume /
              avgVolume;

            if (ratio >= 1.5) {
              if (
                current.close >
                previous.close
              ) {
                buyScore += 8;
              } else {
                sellScore += 8;
              }
            } else if (
              ratio >= 1.2
            ) {
              if (
                current.close >
                previous.close
              ) {
                buyScore += 4;
              } else {
                sellScore += 4;
              }
            }
          }
        }

        // -----------------------------------------------------
        // ADX
        // -----------------------------------------------------

        const historicalData =
          data.slice(0, i + 1);

        const adx =
          calculateADX(
            historicalData,
            14
          );

        if (
          adx != null &&
          adx >= 25
        ) {
          if (
            ema20Values[i] >
            ema50Values[i]
          ) {
            buyScore += 8;
          } else {
            sellScore += 8;
          }
        }

        // -----------------------------------------------------
        // CANDLE STRENGTH
        // -----------------------------------------------------

        const candle =
          candleStrength(current);

        if (candle >= 0.65) {
          if (
            current.close >
            current.open
          ) {
            buyScore += 5;
          } else {
            sellScore += 5;
          }
        }

        // -----------------------------------------------------
        // PRICE DIRECTION
        // -----------------------------------------------------

        if (
          current.close >
          previous.close
        ) {
          buyScore += 3;
        } else if (
          current.close <
          previous.close
        ) {
          sellScore += 3;
        }

        // -----------------------------------------------------
        // EMA CROSSOVER BONUS
        // -----------------------------------------------------

        if (
          ema20Values[i - 1] != null &&
          ema50Values[i - 1] != null
        ) {
          const bullishCross =
            ema20Values[i - 1] <=
              ema50Values[i - 1] &&
            ema20Values[i] >
              ema50Values[i];

          const bearishCross =
            ema20Values[i - 1] >=
              ema50Values[i - 1] &&
            ema20Values[i] <
              ema50Values[i];

          if (bullishCross) {
            buyScore += 10;
          }

          if (bearishCross) {
            sellScore += 10;
          }
        }

        // =====================================================
        // NORMALIZED HISTORICAL SCORE
        // =====================================================

        const totalEvidence =
          buyScore + sellScore;

        if (totalEvidence === 0) {
          continue;
        }

        const bullishRatio =
          buyScore / totalEvidence;

        let score =
          50 +
          (bullishRatio - 0.5) *
            80;

        score = Math.round(
          Math.max(
            10,
            Math.min(90, score)
          )
        );

        const difference =
          Math.abs(
            buyScore - sellScore
          );

        // =====================================================
        // ONLY CREATE STRONG BUY / SELL MARKERS
        // =====================================================

        let signal = null;

        if (
          buyScore >= 42 &&
          bullishRatio >= 0.62 &&
          difference >= 8
        ) {
          signal = "BUY";
        } else if (
          sellScore >= 42 &&
          bullishRatio <= 0.38 &&
          difference >= 8
        ) {
          signal = "SELL";
        }

        if (signal) {
          signals.push({
            date: current.date,
            signal,
            score
          });
        }
      }

      return signals;
    }

    // =========================================================
    // BACKTEST
    // =========================================================

    function backtestSignals(
      data,
      signals
    ) {
      const trades = [];

      if (
        !Array.isArray(signals) ||
        signals.length === 0
      ) {
        return {
          totalTrades: 0,
          wins: 0,
          losses: 0,
          winRate: 0,
          averageReturn: 0,
          totalReturn: 0,
          profitFactor: 0,
          maxDrawdown: 0,
          averageHoldingDays: 0,
          trades: []
        };
      }

      const dateIndex =
        new Map();

      data.forEach((item, index) => {
        dateIndex.set(
          item.date,
          index
        );
      });

      for (const signal of signals) {
        const signalIndex =
          dateIndex.get(signal.date);

        if (
          signalIndex == null
        ) {
          continue;
        }

        // Enter on next trading day
        const entryIndex =
          signalIndex + 1;

        // Exit 10 trading sessions later
        const exitIndex =
          signalIndex + 10;

        if (
          entryIndex >= data.length ||
          exitIndex >= data.length
        ) {
          continue;
        }

        const entryPrice =
          data[entryIndex].open;

        const exitPrice =
          data[exitIndex].close;

        if (
          !entryPrice ||
          !exitPrice
        ) {
          continue;
        }

        let returnPercent = 0;

        if (signal.signal === "BUY") {
          returnPercent =
            ((exitPrice -
              entryPrice) /
              entryPrice) *
            100;
        } else {
          returnPercent =
            ((entryPrice -
              exitPrice) /
              entryPrice) *
            100;
        }

        trades.push({
          date: signal.date,
          signal: signal.signal,
          score: signal.score,
          entryDate:
            data[entryIndex].date,
          exitDate:
            data[exitIndex].date,
          entryPrice:
            Number(entryPrice.toFixed(2)),
          exitPrice:
            Number(exitPrice.toFixed(2)),
          returnPercent:
            Number(
              returnPercent.toFixed(2)
            ),
          holdingDays:
            exitIndex -
            entryIndex
        });
      }

      if (trades.length === 0) {
        return {
          totalTrades: 0,
          wins: 0,
          losses: 0,
          winRate: 0,
          averageReturn: 0,
          totalReturn: 0,
          profitFactor: 0,
          maxDrawdown: 0,
          averageHoldingDays: 0,
          trades: []
        };
      }

      const wins =
        trades.filter(
          trade =>
            trade.returnPercent > 0
        );

      const losses =
        trades.filter(
          trade =>
            trade.returnPercent <= 0
        );

      const totalReturn =
        trades.reduce(
          (sum, trade) =>
            sum +
            trade.returnPercent,
          0
        );

      const averageReturn =
        totalReturn /
        trades.length;

      const winRate =
        (wins.length /
          trades.length) *
        100;

      const grossProfit =
        wins.reduce(
          (sum, trade) =>
            sum +
            trade.returnPercent,
          0
        );

      const grossLoss =
        Math.abs(
          losses.reduce(
            (sum, trade) =>
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
          ? Infinity
          : 0;

      // -------------------------------------------------------
      // MAX DRAWDOWN
      // -------------------------------------------------------

      let equity = 100;

      let peak = 100;

      let maxDrawdown = 0;

      for (const trade of trades) {
        equity +=
          trade.returnPercent;

        if (equity > peak) {
          peak = equity;
        }

        const drawdown =
          ((peak - equity) /
            peak) *
          100;

        if (
          drawdown >
          maxDrawdown
        ) {
          maxDrawdown =
            drawdown;
        }
      }

      const averageHoldingDays =
        trades.reduce(
          (sum, trade) =>
            sum +
            trade.holdingDays,
          0
        ) /
        trades.length;

      return {
        totalTrades:
          trades.length,

        wins:
          wins.length,

        losses:
          losses.length,

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
          profitFactor === Infinity
            ? "Infinity"
            : Number(
                profitFactor.toFixed(2)
              ),

        maxDrawdown:
          Number(
            maxDrawdown.toFixed(2)
          ),

        averageHoldingDays:
          Number(
            averageHoldingDays.toFixed(2)
          ),

        trades
      };
    }

    // =========================================================
    // CALCULATE CURRENT ANALYSIS
    // =========================================================

    const current =
      calculateCurrentScore(history);

    // =========================================================
    // HISTORICAL SIGNALS
    // =========================================================

    const signals =
      generateSignals(history);

    // =========================================================
    // BACKTEST
    // =========================================================

    const backtest =
      backtestSignals(
        history,
        signals
      );

    // =========================================================
    // LAST PRICE / CHANGE
    // =========================================================

    const last =
      history[history.length - 1];

    const previous =
      history[history.length - 2];

    const lastPrice =
      last.close;

    const change =
      previous && previous.close
        ? ((last.close -
            previous.close) /
            previous.close) *
          100
        : 0;

    // =========================================================
    // FINAL RESPONSE
    // =========================================================

    return res.status(200).json({
      symbol: cleanSymbol,

      last: Number(
        lastPrice.toFixed(2)
      ),

      change: Number(
        change.toFixed(2)
      ),

      rsi:
        current.rsi != null
          ? Number(
              current.rsi.toFixed(2)
            )
          : null,

      score:
        current.score,

      signal:
        current.signal,

      ma20:
        current.ma20 != null
          ? Number(
              current.ma20.toFixed(2)
            )
          : null,

      ma50:
        current.ma50 != null
          ? Number(
              current.ma50.toFixed(2)
            )
          : null,

      ema20:
        current.ema20 != null
          ? Number(
              current.ema20.toFixed(2)
            )
          : null,

      ema50:
        current.ema50 != null
          ? Number(
              current.ema50.toFixed(2)
            )
          : null,

      ema200:
        current.ema200 != null
          ? Number(
              current.ema200.toFixed(2)
            )
          : null,

      macd:
        current.macd != null
          ? Number(
              current.macd.toFixed(4)
            )
          : null,

      macdSignal:
        current.macdSignal != null
          ? Number(
              current.macdSignal.toFixed(4)
            )
          : null,

      macdHistogram:
        current.macdHistogram != null
          ? Number(
              current.macdHistogram.toFixed(4)
            )
          : null,

      adx:
        current.adx != null
          ? Number(
              current.adx.toFixed(2)
            )
          : null,

      atr:
        current.atr != null
          ? Number(
              current.atr.toFixed(2)
            )
          : null,

      volumeRatio:
        current.volumeRatio != null
          ? Number(
              current.volumeRatio.toFixed(2)
            )
          : null,

      momentum:
        current.momentum != null
          ? Number(
              current.momentum.toFixed(2)
            )
          : null,

      support:
        current.support != null
          ? Number(
              current.support.toFixed(2)
            )
          : null,

      resistance:
        current.resistance != null
          ? Number(
              current.resistance.toFixed(2)
            )
          : null,

      history,

      signals,

      backtest
    });

  } catch (error) {
    console.error(
      "Stock API error:",
      error
    );

    return res.status(500).json({
      error:
        error?.message ||
        "Internal server error"
    });
  }
}
