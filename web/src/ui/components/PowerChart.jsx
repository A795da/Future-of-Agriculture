import { useEffect, useRef } from "react";
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
function monthly(daily) {
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
            label: "Rain (mm/month)",
            data: m.rain,
            backgroundColor: c("--rain"),
            yAxisID: "rain",
            order: 2,
          },
          {
            type: "line",
            label: "Avg max temp (°C)",
            data: m.tmax,
            borderColor: c("--hot"),
            backgroundColor: c("--hot"),
            tension: 0.3,
            yAxisID: "temp",
            order: 1,
          },
          {
            type: "line",
            label: "Avg min temp (°C)",
            data: m.tmin,
            borderColor: c("--cold"),
            backgroundColor: c("--cold"),
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
        plugins: { legend: { position: "bottom", labels: { boxWidth: 12, color: c("--text") } } },
        scales: {
          x: { ticks: { color: c("--muted") }, grid: { display: false } },
          temp: {
            position: "left",
            title: { display: true, text: "°C", color: c("--muted") },
            ticks: { color: c("--muted") },
            grid: { color: c("--grid") },
          },
          rain: {
            position: "right",
            beginAtZero: true,
            title: { display: true, text: "mm", color: c("--muted") },
            ticks: { color: c("--muted") },
            grid: { display: false },
          },
        },
      },
    });
    return () => chart.destroy();
  }, [conditions]);

  return (
    <div className="chart-box">
      <canvas ref={canvas} aria-label="Monthly rain and temperature from NASA POWER" />
    </div>
  );
}
