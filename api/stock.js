export default async function handler(req, res) {
  try {
    const symbol = String(req.query.symbol || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9&.-]/g, "");

    const allowedRanges = ["6mo", "1y", "2y", "5y", "max"];
    const range = allowedRanges.includes(req.query.range)
      ? req.query.range
      : "1y";

    if (!symbol) {
      return res.status(400).json({
        error: "Please enter a stock symbol."
      });
    }

    const yahooUrl =
      `https://query1.finance.yahoo.com/v8/finance/chart/` +
      `${encodeURIComponent(symbol)}.NS?range=${range}&interval=1d&events=history`;

    const response = await fetch(yahooUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    if (!response.ok) {
      throw new Error(
        `Yahoo Finance request failed with status ${response.status}.`
      );
    }

    const json = await response.json();

    // ---------------------------------------------------------
    // YAHOO ERROR HANDLING
    // ---------------------------------------------------------

    if (json.chart && json.chart.error) {
      throw new Error(
        json.chart.error.description ||
          "Yahoo Finance could not retrieve this stock."
      );
    }

    if (
      !json.chart ||
      !json.chart.result ||
      !json.chart.result[0]
    ) {
      throw new Error(
        `No NSE data found for ${symbol}.`
      );
    }

    const result = json.chart.result[0];

    if (!result.timestamp || !result.indicators) {
      throw new Error(
        `No historical data available for ${symbol}.`
      );
    }

    const timestamps = result.timestamp || [];

    const quote =
      result.indicators.quote &&
      result.indicators.quote[0]
        ? result.indicators.quote[0]
        : {};

    const adjclose =
      result.indicators.adjclose &&
      result.indicators.adjclose[0]
        ? result.indicators.adjclose[0].adjclose
        : [];

    const opens = quote.open || [];
    const highs = quote.high || [];
    const lows = quote.low || [];
    const closes = quote.close || [];
    const volumes = quote.volume || [];

    // ---------------------------------------------------------
    // BUILD CLEAN HISTORY
    // ---------------------------------------------------------

    const history = [];

    for (let i = 0; i < timestamps.length; i++) {
      const close =
        closes[i] != null
          ? Number(closes[i])
          : adjclose && adjclose[i] != null
          ? Number(adjclose[i])
          : null;

      if (
        !Number.isFinite(close) ||
        !Number.isFinite(timestamps[i])
      ) {
        continue;
      }

      const open =
        opens[i] != null && Number.isFinite(Number(opens[i]))
          ? Number(opens[i])
          : close;

      const high =
        highs[i] != null && Number.isFinite(Number(highs[i]))
          ? Number(highs[i])
          : Math.max(open, close);

      const low =
        lows[i] != null && Number.isFinite(Number(lows[i]))
          ? Number(lows[i])
          : Math.min(open, close);

      const volume =
        volumes[i] != null && Number.isFinite(Number(volumes[i]))
          ? Number(volumes[i])
          : 0;

      const date = new Date(
        timestamps[i] * 1000
      )
        .toISOString()
        .split("T")[0];

      history.push({
        date,
        open,
        high,
        low,
        close,
        volume
      });
    }

    // ---------------------------------------------------------
    // IMPORTANT:
    // 35 candles are enough for the fallback analysis.
    // Old stocks with 60+ candles keep their old behavior.
    // ---------------------------------------------------------

    if (history.length < 35) {
      throw new Error(
        `Not enough historical data for ${symbol}. Yahoo Finance returned only ${history.length} trading days.`
      );
    }

    // ---------------------------------------------------------
    // BASIC INDICATORS
    // ---------------------------------------------------------

    function SMA(values, period) {
      if (values.length < period) return null;

      let sum = 0;

      for (
        let i = values.length - period;
        i < values.length;
        i++
      ) {
        sum += values[i];
      }

      return sum / period;
    }

    function historicalSMA(values, period) {
      const result = new Array(values.length).fill(null);

      let sum = 0;

      for (let i = 0; i < values.length; i++) {
        sum += values[i];

        if (i >= period) {
          sum -= values[i - period];
        }

        if (i >= period - 1) {
          result[i] = sum / period;
        }
      }

      return result;
    }

    function EMA(values, period) {
      if (values.length < period) return null;

      const multiplier = 2 / (period + 1);

      let ema =
        values
          .slice(0, period)
          .reduce((a, b) => a + b, 0) / period;

      for (let i = period; i < values.length; i++) {
        ema =
          (values[i] - ema) * multiplier + ema;
      }

      return ema;
    }

    function historicalEMA(values, period) {
      const result = new Array(values.length).fill(null);

      if (values.length < period) {
        return result;
      }

      const multiplier = 2 / (period + 1);

      let ema =
        values
          .slice(0, period)
          .reduce((a, b) => a + b, 0) / period;

      result[period - 1] = ema;

      for (let i = period; i < values.length; i++) {
        ema =
          (values[i] - ema) * multiplier + ema;

        result[i] = ema;
      }

      return result;
    }

    function RSI(values, period = 14) {
      if (values.length <= period) return null;

      let gains = 0;
      let losses = 0;

      for (let i = 1; i <= period; i++) {
        const diff = values[i] - values[i - 1];

        if (diff >= 0) {
          gains += diff;
        } else {
          losses += Math.abs(diff);
        }
      }

      let avgGain = gains / period;
      let avgLoss = losses / period;

      if (avgLoss === 0) {
        return 100;
      }

      let rs = avgGain / avgLoss;

      return 100 - 100 / (1 + rs);
    }

    function historicalRSI(values, period = 14) {
      const result = new Array(values.length).fill(null);

      if (values.length <= period) {
        return result;
      }

      let gains = 0;
      let losses = 0;

      for (let i = 1; i <= period; i++) {
        const diff = values[i] - values[i - 1];

        if (diff >= 0) {
          gains += diff;
        } else {
          losses += Math.abs(diff);
        }
      }

      let avgGain = gains / period;
      let avgLoss = losses / period;

      result[period] =
        avgLoss === 0
          ? 100
          : 100 -
            100 /
              (1 + avgGain / avgLoss);

      for (
        let i = period + 1;
        i < values.length;
        i++
      ) {
        const diff =
          values[i] - values[i - 1];

        const gain = diff > 0 ? diff : 0;
        const loss = diff < 0 ? Math.abs(diff) : 0;

        avgGain =
          (avgGain * (period - 1) + gain) /
          period;

        avgLoss =
          (avgLoss * (period - 1) + loss) /
          period;

        result[i] =
          avgLoss === 0
            ? 100
            : 100 -
              100 /
                (1 + avgGain / avgLoss);
      }

      return result;
    }

    // ---------------------------------------------------------
    // MACD
    // ---------------------------------------------------------

    function MACD(values) {
      const ema12 = historicalEMA(values, 12);
      const ema26 = historicalEMA(values, 26);

      const macd = new Array(values.length).fill(null);

      for (let i = 0; i < values.length; i++) {
        if (
          ema12[i] !== null &&
          ema26[i] !== null
        ) {
          macd[i] =
            ema12[i] - ema26[i];
        }
      }

      const signal = new Array(values.length).fill(null);

      const validMacd = [];

      for (let i = 0; i < macd.length; i++) {
        if (macd[i] !== null) {
          validMacd.push({
            index: i,
            value: macd[i]
          });
        }
      }

      if (validMacd.length >= 9) {
        let ema =
          validMacd
            .slice(0, 9)
            .reduce(
              (sum, item) => sum + item.value,
              0
            ) / 9;

        signal[validMacd[8].index] = ema;

        const multiplier = 2 / 10;

        for (
          let j = 9;
          j < validMacd.length;
          j++
        ) {
          ema =
            (validMacd[j].value - ema) *
              multiplier +
            ema;

          signal[validMacd[j].index] =
            ema;
        }
      }

      const histogram =
        new Array(values.length).fill(null);

      for (let i = 0; i < values.length; i++) {
        if (
          macd[i] !== null &&
          signal[i] !== null
        ) {
          histogram[i] =
            macd[i] - signal[i];
        }
      }

      return {
        macd,
        signal,
        histogram
      };
    }

    // ---------------------------------------------------------
    // ATR
    // ---------------------------------------------------------

    function ATR(historyData, period = 14) {
      if (historyData.length <= period) {
        return null;
      }

      const tr = [];

      for (let i = 0; i < historyData.length; i++) {
        if (i === 0) {
          tr.push(
            historyData[i].high -
              historyData[i].low
          );
        } else {
          const high = historyData[i].high;
          const low = historyData[i].low;
          const prevClose =
            historyData[i - 1].close;

          tr.push(
            Math.max(
              high - low,
              Math.abs(high - prevClose),
              Math.abs(low - prevClose)
            )
          );
        }
      }

      return (
        tr
          .slice(-period)
          .reduce((a, b) => a + b, 0) /
        period
      );
    }

    // ---------------------------------------------------------
    // HISTORICAL ATR
    // ---------------------------------------------------------

    function historicalATR(
      historyData,
      period = 14
    ) {
      const result =
        new Array(historyData.length).fill(
          null
        );

      if (historyData.length <= period) {
        return result;
      }

      const tr = [];

      for (let i = 0; i < historyData.length; i++) {
        if (i === 0) {
          tr.push(
            historyData[i].high -
              historyData[i].low
          );
        } else {
          const high = historyData[i].high;
          const low = historyData[i].low;
          const prevClose =
            historyData[i - 1].close;

          tr.push(
            Math.max(
              high - low,
              Math.abs(high - prevClose),
              Math.abs(low - prevClose)
            )
          );
        }
      }

      let sum = 0;

      for (let i = 1; i <= period; i++) {
        sum += tr[i];
      }

      result[period] = sum / period;

      for (
        let i = period + 1;
        i < historyData.length;
        i++
      ) {
        result[i] =
          (result[i - 1] * (period - 1) +
            tr[i]) /
          period;
      }

      return result;
    }

    // ---------------------------------------------------------
    // ADX
    // ---------------------------------------------------------

    function historicalADX(
      historyData,
      period = 14
    ) {
      const length = historyData.length;

      const result =
        new Array(length).fill(null);

      if (length <= period * 2) {
        return result;
      }

      const tr = new Array(length).fill(0);
      const plusDM =
        new Array(length).fill(0);
      const minusDM =
        new Array(length).fill(0);

      for (let i = 1; i < length; i++) {
        const high = historyData[i].high;
        const low = historyData[i].low;

        const prevHigh =
          historyData[i - 1].high;

        const prevLow =
          historyData[i - 1].low;

        const prevClose =
          historyData[i - 1].close;

        tr[i] = Math.max(
          high - low,
          Math.abs(high - prevClose),
          Math.abs(low - prevClose)
        );

        const upMove =
          high - prevHigh;

        const downMove =
          prevLow - low;

        plusDM[i] =
          upMove > downMove &&
          upMove > 0
            ? upMove
            : 0;

        minusDM[i] =
          downMove > upMove &&
          downMove > 0
            ? downMove
            : 0;
      }

      let atrSum = 0;
      let plusSum = 0;
      let minusSum = 0;

      for (let i = 1; i <= period; i++) {
        atrSum += tr[i];
        plusSum += plusDM[i];
        minusSum += minusDM[i];
      }

      let atrValue = atrSum;
      let plusValue = plusSum;
      let minusValue = minusSum;

      const dx =
        new Array(length).fill(null);

      for (
        let i = period;
        i < length;
        i++
      ) {
        if (i > period) {
          atrValue =
            atrValue -
            atrValue / period +
            tr[i];

          plusValue =
            plusValue -
            plusValue / period +
            plusDM[i];

          minusValue =
            minusValue -
            minusValue / period +
            minusDM[i];
        }

        if (atrValue === 0) {
          continue;
        }

        const plusDI =
          (100 * plusValue) /
          atrValue;

        const minusDI =
          (100 * minusValue) /
          atrValue;

        const denominator =
          plusDI + minusDI;

        if (denominator === 0) {
          continue;
        }

        dx[i] =
          (100 *
            Math.abs(
              plusDI - minusDI
            )) /
          denominator;
      }

      let firstADXIndex =
        period * 2 - 1;

      let dxSum = 0;
      let count = 0;

      for (
        let i = period;
        i <= firstADXIndex;
        i++
      ) {
        if (dx[i] !== null) {
          dxSum += dx[i];
          count++;
        }
      }

      if (count === 0) {
        return result;
      }

      let adx = dxSum / count;

      result[firstADXIndex] = adx;

      for (
        let i = firstADXIndex + 1;
        i < length;
        i++
      ) {
        if (dx[i] === null) continue;

        adx =
          (adx * (period - 1) +
            dx[i]) /
          period;

        result[i] = adx;
      }

      return result;
    }

    // ---------------------------------------------------------
    // OTHER HELPERS
    // ---------------------------------------------------------

    function averageVolume(
      values,
      period = 20
    ) {
      if (values.length < period) {
        return null;
      }

      return (
        values
          .slice(-period)
          .reduce((a, b) => a + b, 0) /
        period
      );
    }

    function momentum(
      values,
      period = 10
    ) {
      if (values.length <= period) {
        return null;
      }

      return (
        values[values.length - 1] -
        values[values.length - 1 - period]
      );
    }

    function supportResistance(
      values,
      lookback = 20
    ) {
      if (values.length < lookback) {
        return {
          support: null,
          resistance: null
        };
      }

      const recent = values.slice(-lookback);

      return {
        support: Math.min(...recent),
        resistance: Math.max(...recent)
      };
    }

    function candleDirection(candle) {
      if (!candle) return "NEUTRAL";

      if (candle.close > candle.open) {
        return "BULLISH";
      }

      if (candle.close < candle.open) {
        return "BEARISH";
      }

      return "NEUTRAL";
    }

    // ---------------------------------------------------------
    // GENERATE HISTORICAL BUY / SELL SIGNALS
    // ---------------------------------------------------------

    function generateSignals(historyData) {
      const closes = historyData.map(
        item => item.close
      );

      const volumes = historyData.map(
        item => item.volume
      );

      const sma20 =
        historicalSMA(closes, 20);

      const sma50 =
        historicalSMA(closes, 50);

      const ema20 =
        historicalEMA(closes, 20);

      const ema50 =
        historicalEMA(closes, 50);

      const ema200 =
        historicalEMA(closes, 200);

      const rsi =
        historicalRSI(closes, 14);

      const macdData =
        MACD(closes);

      const atr =
        historicalATR(historyData, 14);

      const adx =
        historicalADX(historyData, 14);

      const signals = [];

      // -------------------------------------------------------
      // IMPORTANT:
      //
      // 200+ candles:
      //     preserve old behavior
      //
      // 60-199 candles:
      //     preserve old behavior
      //
      // 35-59 candles:
      //     use fallback indicators
      // -------------------------------------------------------

      let startIndex;

      if (
        ema200.some(
          value => value !== null
        )
      ) {
        startIndex = 200;
      } else if (
        historyData.length >= 60
      ) {
        startIndex = 60;
      } else {
        startIndex = 35;
      }

      for (
        let i = startIndex;
        i < historyData.length;
        i++
      ) {
        const close =
          closes[i];

        // -----------------------------------------------------
        // Required indicators
        //
        // SMA50 is NOT required anymore because newer
        // stocks may not have 50+ candles.
        // EMA50 is handled with fallback below.
        // -----------------------------------------------------

        if (
          sma20[i] === null ||
          ema20[i] === null ||
          rsi[i] === null ||
          macdData.macd[i] === null
        ) {
          continue;
        }

        let buyScore = 0;
        let sellScore = 0;

        // -----------------------------------------------------
        // EMA 200 TREND
        //
        // Only used when available.
        // -----------------------------------------------------

        if (
          ema200[i] !== null
        ) {
          if (close > ema200[i]) {
            buyScore += 15;
          } else {
            sellScore += 15;
          }
        }

        // -----------------------------------------------------
        // EMA20 / EMA50 TREND
        //
        // Old stocks:
        //     original calculation remains.
        //
        // New stocks:
        //     EMA50 may not exist, so use price vs EMA20.
        // -----------------------------------------------------

        if (
          ema20[i] !== null &&
          ema50[i] !== null
        ) {
          if (ema20[i] > ema50[i]) {
            buyScore += 12;
          } else {
            sellScore += 12;
          }
        } else {
          if (close > ema20[i]) {
            buyScore += 8;
          } else {
            sellScore += 8;
          }
        }

        // -----------------------------------------------------
        // PRICE VS EMA20
        // -----------------------------------------------------

        if (close > ema20[i]) {
          buyScore += 8;
        } else {
          sellScore += 8;
        }

        // -----------------------------------------------------
        // RSI
        // -----------------------------------------------------

        const currentRSI =
          rsi[i];

        if (currentRSI >= 60) {
          buyScore += 12;
        } else if (
          currentRSI >= 50
        ) {
          buyScore += 5;
        } else if (
          currentRSI >= 45
        ) {
          buyScore += 2;
        } else if (
          currentRSI >= 35
        ) {
          sellScore += 8;
        } else {
          sellScore += 10;
        }

        // -----------------------------------------------------
        // MACD
        // -----------------------------------------------------

        const macd =
          macdData.macd[i];

        const signal =
          macdData.signal[i];

        const histogram =
          macdData.histogram[i];

        if (
          macd !== null &&
          signal !== null
        ) {
          if (macd > signal) {
            buyScore += 10;
          } else {
            sellScore += 10;
          }
        }

        // -----------------------------------------------------
        // MACD HISTOGRAM DIRECTION
        // -----------------------------------------------------

        if (
          histogram !== null &&
          i > 0 &&
          macdData.histogram[i - 1] !== null
        ) {
          if (
            histogram >
            macdData.histogram[i - 1]
          ) {
            buyScore += 5;
          } else {
            sellScore += 5;
          }
        }

        // -----------------------------------------------------
        // MACD CROSSOVER
        // -----------------------------------------------------

        if (
          i > 0 &&
          macdData.macd[i - 1] !== null &&
          macdData.signal[i - 1] !== null &&
          macd !== null &&
          signal !== null
        ) {
          const previousMacd =
            macdData.macd[i - 1];

          const previousSignal =
            macdData.signal[i - 1];

          if (
            previousMacd <= previousSignal &&
            macd > signal
          ) {
            buyScore += 10;
          }

          if (
            previousMacd >= previousSignal &&
            macd < signal
          ) {
            sellScore += 10;
          }
        }

        // -----------------------------------------------------
        // ADX
        // -----------------------------------------------------

        if (
          adx[i] !== null
        ) {
          if (adx[i] >= 20) {
            if (
              ema20[i] !== null &&
              ema50[i] !== null
            ) {
              if (
                ema20[i] > ema50[i]
              ) {
                buyScore += 8;
              } else {
                sellScore += 8;
              }
            } else {
              // Fallback for newer stocks
              if (
                close > ema20[i]
              ) {
                buyScore += 5;
              } else {
                sellScore += 5;
              }
            }
          }
        }

        // -----------------------------------------------------
        // VOLUME
        // -----------------------------------------------------

        const currentVolume =
          volumes[i];

        const volumeStart =
          Math.max(0, i - 20);

        const previousVolumes =
          volumes.slice(
            volumeStart,
            i
          );

        if (
          previousVolumes.length > 0
        ) {
          const avgVol =
            previousVolumes.reduce(
              (a, b) => a + b,
              0
            ) /
            previousVolumes.length;

          if (
            avgVol > 0 &&
            currentVolume >
              avgVol * 1.2
          ) {
            if (
              historyData[i].close >
              historyData[i].open
            ) {
              buyScore += 8;
            } else {
              sellScore += 8;
            }
          }
        }

        // -----------------------------------------------------
        // MOMENTUM
        // -----------------------------------------------------

        if (i >= 10) {
          const mom =
            closes[i] -
            closes[i - 10];

          if (mom > 0) {
            buyScore += 8;
          } else {
            sellScore += 8;
          }
        }

        // -----------------------------------------------------
        // BREAKOUT
        // -----------------------------------------------------

        if (i >= 15) {
          const previousHigh =
            Math.max(
              ...closes.slice(
                i - 15,
                i
              )
            );

          const previousLow =
            Math.min(
              ...closes.slice(
                i - 15,
                i
              )
            );

          if (close > previousHigh) {
            buyScore += 12;
          }

          if (close < previousLow) {
            sellScore += 12;
          }
        }

        // -----------------------------------------------------
        // SUPPORT / RESISTANCE
        // -----------------------------------------------------

        if (i >= 20) {
          const recent =
            closes.slice(
              i - 20,
              i
            );

          const support =
            Math.min(...recent);

          const resistance =
            Math.max(...recent);

          if (
            close <=
            support * 1.03
          ) {
            buyScore += 5;
          }

          if (
            close >=
            resistance * 0.97
          ) {
            sellScore += 5;
          }
        }

        // -----------------------------------------------------
        // CANDLE CONFIRMATION
        // -----------------------------------------------------

        if (
          historyData[i].close >
          historyData[i].open
        ) {
          buyScore += 5;
        } else if (
          historyData[i].close <
          historyData[i].open
        ) {
          sellScore += 5;
        }

        // -----------------------------------------------------
        // HIGH VOLATILITY PENALTY
        // -----------------------------------------------------

        if (
          atr[i] !== null &&
          close > 0
        ) {
          const atrPercent =
            (atr[i] / close) * 100;

          if (atrPercent > 6) {
            buyScore -= 5;
            sellScore -= 5;
          }
        }

        // -----------------------------------------------------
        // FINAL SIGNAL
        // -----------------------------------------------------

        let finalSignal = "HOLD";

        if (
          buyScore >= 72 &&
          buyScore >
            sellScore + 15
        ) {
          finalSignal = "BUY";
        } else if (
          sellScore >= 72 &&
          sellScore >
            buyScore + 15
        ) {
          finalSignal = "SELL";
        }

        // -----------------------------------------------------
        // SCORE
        // -----------------------------------------------------

        let score = 50;

        if (finalSignal === "BUY") {
          score = Math.min(
            95,
            Math.round(
              50 +
                (buyScore - sellScore) *
                  0.9
            )
          );
        } else if (
          finalSignal === "SELL"
        ) {
          score = Math.max(
            5,
            Math.round(
              50 -
                (sellScore - buyScore) *
                  0.9
            )
          );
        } else {
          score = Math.round(
            Math.max(
              20,
              Math.min(
                80,
                50 +
                  (buyScore - sellScore) *
                    0.4
              )
            )
          );
        }

        // -----------------------------------------------------
        // SAVE ONLY BUY / SELL MARKERS
        // -----------------------------------------------------

        if (
          finalSignal === "BUY" ||
          finalSignal === "SELL"
        ) {
          signals.push({
            date:
              historyData[i].date,

            signal:
              finalSignal,

            score,

            price:
              Number(
                close.toFixed(2)
              ),

            rsi:
              Number(
                currentRSI.toFixed(2)
              ),

            ma20:
              sma20[i] !== null
                ? Number(
                    sma20[i].toFixed(2)
                  )
                : null,

            ma50:
              sma50[i] !== null
                ? Number(
                    sma50[i].toFixed(2)
                  )
                : null,

            buyScore,

            sellScore
          });
        }
      }

      return signals;
    }

    // ---------------------------------------------------------
    // CURRENT SCORE
    // ---------------------------------------------------------

    function calculateCurrentScore(
      historyData
    ) {
      const closes =
        historyData.map(
          item => item.close
        );

      const volumes =
        historyData.map(
          item => item.volume
        );

      const currentClose =
        closes[closes.length - 1];

      const sma20 =
        SMA(closes, 20);

      const sma50 =
        SMA(closes, 50);

      const ema20 =
        EMA(closes, 20);

      const ema50 =
        EMA(closes, 50);

      const ema200 =
        EMA(closes, 200);

      const rsi =
        RSI(closes, 14);

      const macdData =
        MACD(closes);

      const latestMacd =
        macdData.macd[
          macdData.macd.length - 1
        ];

      const latestSignal =
        macdData.signal[
          macdData.signal.length - 1
        ];

      const latestHistogram =
        macdData.histogram[
          macdData.histogram.length - 1
        ];

      const adxData =
        historicalADX(
          historyData,
          14
        );

      const latestADX =
        adxData[
          adxData.length - 1
        ];

      const avgVol =
        averageVolume(
          volumes,
          20
        );

      const currentVolume =
        volumes[
          volumes.length - 1
        ];

      const mom =
        momentum(
          closes,
          10
        );

      let buyScore = 0;
      let sellScore = 0;

      // -------------------------------------------------------
      // EMA200
      // -------------------------------------------------------

      if (
        ema200 !== null
      ) {
        if (
          currentClose > ema200
        ) {
          buyScore += 15;
        } else {
          sellScore += 15;
        }
      }

      // -------------------------------------------------------
      // EMA20 / EMA50
      // -------------------------------------------------------

      if (
        ema20 !== null &&
        ema50 !== null
      ) {
        if (ema20 > ema50) {
          buyScore += 12;
        } else {
          sellScore += 12;
        }
      } else if (
        ema20 !== null
      ) {
        if (
          currentClose > ema20
        ) {
          buyScore += 8;
        } else {
          sellScore += 8;
        }
      }

      // -------------------------------------------------------
      // PRICE VS EMA20
      // -------------------------------------------------------

      if (
        ema20 !== null
      ) {
        if (
          currentClose > ema20
        ) {
          buyScore += 8;
        } else {
          sellScore += 8;
        }
      }

      // -------------------------------------------------------
      // RSI
      // -------------------------------------------------------

      if (rsi !== null) {
        if (rsi >= 60) {
          buyScore += 12;
        } else if (rsi >= 50) {
          buyScore += 5;
        } else if (rsi >= 45) {
          buyScore += 2;
        } else if (rsi >= 35) {
          sellScore += 8;
        } else {
          sellScore += 10;
        }
      }

      // -------------------------------------------------------
      // MACD
      // -------------------------------------------------------

      if (
        latestMacd !== null &&
        latestSignal !== null
      ) {
        if (
          latestMacd >
          latestSignal
        ) {
          buyScore += 10;
        } else {
          sellScore += 10;
        }
      }

      // -------------------------------------------------------
      // MACD HISTOGRAM
      // -------------------------------------------------------

      if (
        latestHistogram !== null &&
        macdData.histogram.length >= 2
      ) {
        const previousHistogram =
          macdData.histogram[
            macdData.histogram.length - 2
          ];

        if (
          previousHistogram !== null
        ) {
          if (
            latestHistogram >
            previousHistogram
          ) {
            buyScore += 5;
          } else {
            sellScore += 5;
          }
        }
      }

      // -------------------------------------------------------
      // ADX
      // -------------------------------------------------------

      if (
        latestADX !== null &&
        latestADX >= 20
      ) {
        if (
          ema20 !== null &&
          ema50 !== null
        ) {
          if (ema20 > ema50) {
            buyScore += 8;
          } else {
            sellScore += 8;
          }
        } else if (
          ema20 !== null
        ) {
          if (
            currentClose > ema20
          ) {
            buyScore += 5;
          } else {
            sellScore += 5;
          }
        }
      }

      // -------------------------------------------------------
      // VOLUME
      // -------------------------------------------------------

      if (
        avgVol !== null &&
        avgVol > 0 &&
        currentVolume >
          avgVol * 1.2
      ) {
        const latestCandle =
          historyData[
            historyData.length - 1
          ];

        if (
          latestCandle.close >
          latestCandle.open
        ) {
          buyScore += 8;
        } else {
          sellScore += 8;
        }
      }

      // -------------------------------------------------------
      // MOMENTUM
      // -------------------------------------------------------

      if (mom !== null) {
        if (mom > 0) {
          buyScore += 8;
        } else {
          sellScore += 8;
        }
      }

      // -------------------------------------------------------
      // BREAKOUT
      // -------------------------------------------------------

      if (
        closes.length >= 16
      ) {
        const previousHigh =
          Math.max(
            ...closes.slice(
              -16,
              -1
            )
          );

        const previousLow =
          Math.min(
            ...closes.slice(
              -16,
              -1
            )
          );

        if (
          currentClose >
          previousHigh
        ) {
          buyScore += 12;
        }

        if (
          currentClose <
          previousLow
        ) {
          sellScore += 12;
        }
      }

      // -------------------------------------------------------
      // SUPPORT / RESISTANCE
      // -------------------------------------------------------

      const sr =
        supportResistance(
          closes,
          20
        );

      if (
        sr.support !== null &&
        currentClose <=
          sr.support * 1.03
      ) {
        buyScore += 5;
      }

      if (
        sr.resistance !== null &&
        currentClose >=
          sr.resistance * 0.97
      ) {
        sellScore += 5;
      }

      // -------------------------------------------------------
      // CANDLE
      // -------------------------------------------------------

      const latestCandle =
        historyData[
          historyData.length - 1
        ];

      if (
        latestCandle.close >
        latestCandle.open
      ) {
        buyScore += 5;
      } else if (
        latestCandle.close <
        latestCandle.open
      ) {
        sellScore += 5;
      }

      // -------------------------------------------------------
      // ATR
      // -------------------------------------------------------

      const atrValue =
        ATR(historyData, 14);

      if (
        atrValue !== null &&
        currentClose > 0
      ) {
        const atrPercent =
          (atrValue /
            currentClose) *
          100;

        if (
          atrPercent > 6
        ) {
          buyScore -= 5;
          sellScore -= 5;
        }
      }

      // -------------------------------------------------------
      // VARIABLE SCORE
      //
      // This avoids the old problem where most stocks
      // became 95 BUY / 5 SELL.
      // -------------------------------------------------------

      const totalEvidence =
        Math.max(
          1,
          buyScore + sellScore
        );

      const bullishRatio =
        buyScore /
        totalEvidence;

      let score =
        50 +
        (bullishRatio - 0.5) *
          80;

      score = Math.round(
        Math.max(
          10,
          Math.min(
            90,
            score
          )
        )
      );

      // -------------------------------------------------------
      // CURRENT SIGNAL
      // -------------------------------------------------------

      let signal = "NEUTRAL";

      if (
        score >= 60 &&
        buyScore >
          sellScore + 10
      ) {
        signal = "BULLISH";
      } else if (
        score <= 40 &&
        sellScore >
          buyScore + 10
      ) {
        signal = "BEARISH";
      }

      return {
        last: currentClose,

        rsi:
          rsi !== null
            ? Number(
                rsi.toFixed(2)
              )
            : null,

        score,

        signal,

        ma20:
          sma20 !== null
            ? Number(
                sma20.toFixed(2)
              )
            : null,

        ma50:
          sma50 !== null
            ? Number(
                sma50.toFixed(2)
              )
            : null,

        ema20:
          ema20 !== null
            ? Number(
                ema20.toFixed(2)
              )
            : null,

        ema50:
          ema50 !== null
            ? Number(
                ema50.toFixed(2)
              )
            : null,

        ema200:
          ema200 !== null
            ? Number(
                ema200.toFixed(2)
              )
            : null,

        buyScore,

        sellScore
      };
    }

    // ---------------------------------------------------------
    // BACKTEST
    // ---------------------------------------------------------

    function backtestSignals(
      historyData,
      signals
    ) {
      const trades = [];

      for (
        let i = 0;
        i < signals.length;
        i++
      ) {
        const signal =
          signals[i];

        const signalIndex =
          historyData.findIndex(
            item =>
              item.date ===
              signal.date
          );

        if (
          signalIndex === -1
        ) {
          continue;
        }

        const entryIndex =
          signalIndex + 1;

        const exitIndex =
          entryIndex + 10;

        if (
          entryIndex >=
          historyData.length
        ) {
          continue;
        }

        if (
          exitIndex >=
          historyData.length
        ) {
          continue;
        }

        const entryPrice =
          historyData[
            entryIndex
          ].open;

        const exitPrice =
          historyData[
            exitIndex
          ].close;

        if (
          !Number.isFinite(
            entryPrice
          ) ||
          !Number.isFinite(
            exitPrice
          ) ||
          entryPrice <= 0
        ) {
          continue;
        }

        let returnPercent;

        if (
          signal.signal === "BUY"
        ) {
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

          signal:
            signal.signal,

          entry:
            Number(
              entryPrice.toFixed(2)
            ),

          exit:
            Number(
              exitPrice.toFixed(2)
            ),

          return:
            Number(
              returnPercent.toFixed(2)
            )
        });
      }

      if (
        trades.length === 0
      ) {
        return {
          trades: 0,
          winRate: 0,
          averageReturn: 0,
          totalReturn: 0,
          profitFactor: 0,
          maxDrawdown: 0
        };
      }

      const wins =
        trades.filter(
          trade =>
            trade.return > 0
        );

      const losses =
        trades.filter(
          trade =>
            trade.return <= 0
        );

      const winRate =
        (wins.length /
          trades.length) *
        100;

      const averageReturn =
        trades.reduce(
          (sum, trade) =>
            sum + trade.return,
          0
        ) /
        trades.length;

      const totalReturn =
        trades.reduce(
          (sum, trade) =>
            sum + trade.return,
          0
        );

      const grossProfit =
        wins.reduce(
          (sum, trade) =>
            sum + trade.return,
          0
        );

      const grossLoss =
        Math.abs(
          losses.reduce(
            (sum, trade) =>
              sum + trade.return,
            0
          )
        );

      const profitFactor =
        grossLoss === 0
          ? grossProfit > 0
            ? Infinity
            : 0
          : grossProfit /
            grossLoss;

      let equity = 100;
      let peak = 100;
      let maxDrawdown = 0;

      for (
        const trade of trades
      ) {
        equity *=
          1 +
          trade.return / 100;

        peak =
          Math.max(
            peak,
            equity
          );

        const drawdown =
          ((peak - equity) /
            peak) *
          100;

        maxDrawdown =
          Math.max(
            maxDrawdown,
            drawdown
          );
      }

      return {
        trades:
          trades.length,

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
            ? null
            : Number(
                profitFactor.toFixed(2)
              ),

        maxDrawdown:
          Number(
            maxDrawdown.toFixed(2)
          )
      };
    }

    // ---------------------------------------------------------
    // RUN ANALYSIS
    // ---------------------------------------------------------

    const current =
      calculateCurrentScore(
        history
      );

    const signals =
      generateSignals(
        history
      );

    const backtest =
      backtestSignals(
        history,
        signals
      );

    const last =
      history[
        history.length - 1
      ];

    const previous =
      history[
        history.length - 2
      ];

    const change =
      previous &&
      previous.close !== 0
        ? ((last.close -
            previous.close) /
            previous.close) *
          100
        : 0;

    // ---------------------------------------------------------
    // FINAL RESPONSE
    // ---------------------------------------------------------

    return res.status(200).json({
      symbol,

      last:
        Number(
          current.last.toFixed(2)
        ),

      change:
        Number(
          change.toFixed(2)
        ),

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
        error &&
        error.message
          ? error.message
          : "Unable to fetch stock data."
    });
  }
}
