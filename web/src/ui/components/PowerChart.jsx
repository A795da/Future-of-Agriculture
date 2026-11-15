import { useEffect, useRef } from "react";
import { useLang } from "../../i18n/LangContext.jsx";
import {
  Chart,
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Legend,
  Tooltip,
  Filler,
} from "chart.js";

Chart.register(
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Legend,
  Tooltip,
  Filler
);

// Monthly summary keeps the chart readable on a phone.
export function monthly(daily) {
  const by = new Map();
  daily.date.forEach((d, i) => {
    const m = d.slice(0, 7);
    if (!by.has(m)) by.set(m, { rain: 0, tmax: [], tmin: [] });
    const b = by.get(m);
    if (daily.PRECTOTCORR[i] != null) b.rain += daily.PRECTOTCORR[i];
    if (daily.T2M_MAX[i] != null) b.tmax.push(daily.T2M_MAX[i]);
    if (daily.T2M_MIN[i] != null) b.tmin.push(daily.T2M_MIN[i]);
  });
  const avg = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
  const months = [...by.keys()];
  return {
    labels: months,
    rain: months.map((m) => Math.round(by.get(m).rain)),
    tmax: months.map((m) => +avg(by.get(m).tmax).toFixed(1)),
    tmin: months.map((m) => +avg(by.get(m).tmin).toFixed(1)),
  };
}

export default function PowerChart({ conditions }) {
  const { t } = useLang();
  const canvas = useRef(null);

  useEffect(() => {
    if (!conditions) return;
    const m = monthly(conditions.daily);
    const css = getComputedStyle(document.documentElement);
    const c = (n) => css.getPropertyValue(n).trim();
    const chart = new Chart(canvas.current, {
      data: {
        labels: m.labels,
        datasets: [
          {
            type: "bar",
            label: t("chart_rain"),
            data: m.rain,
            backgroundColor: c("--rain"),
            borderRadius: 3,
            yAxisID: "rain",
            order: 2,
          },
          {
            type: "line",
            label: t("chart_tmax"),
            data: m.tmax,
            borderColor: c("--accent"),
            backgroundColor: c("--accent"),
            borderWidth: 2,
            pointRadius: 2,
            tension: 0.3,
            yAxisID: "temp",
            order: 1,
          },
          {
            type: "line",
            label: t("chart_tmin"),
            data: m.tmin,
            borderColor: c("--muted"),
            backgroundColor: c("--muted"),
            borderWidth: 2,
            borderDash: [4, 4],
            pointRadius: 0,
            tension: 0.3,
            yAxisID: "temp",
            order: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: { legend: { position: "bottom", labels: { boxWidth: 8, boxHeight: 8, usePointStyle: true, pointStyle: "circle", color: c("--muted"), font: { family: c("--mono"), size: 12 } } } },
        scales: {
          x: { ticks: { color: c("--muted"), font: { family: c("--mono"), size: 11 } }, grid: { display: false }, border: { display: false } },
          temp: {
            position: "left",
            title: { display: true, text: "°C", color: c("--muted") },
            ticks: { color: c("--muted"), font: { family: c("--mono"), size: 11 } },
            grid: { color: c("--grid") },
            border: { display: false },
          },
          rain: {
            position: "right",
            beginAtZero: true,
            title: { display: true, text: "mm", color: c("--muted") },
            ticks: { color: c("--muted"), font: { family: c("--mono"), size: 11 } },
            grid: { display: false },
            border: { display: false },
          },
        },
      },
    });
    return () => chart.destroy();
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conditions, t]);

  return (
    <div className="chart-box">
      <canvas ref={canvas} aria-label="Monthly rain and temperature from NASA POWER" />
    </div>
  );
}
