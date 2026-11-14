"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { AdminAnalytics } from "@/lib/types/database";

type AnalyticsDashboardProps = {
  analytics: AdminAnalytics;
};

export default function AnalyticsDashboard({ analytics }: AnalyticsDashboardProps) {
  const pieData = [
    { name: "Occupied (Checked In)", value: analytics.currentlyOccupiedSeats, color: "#ee8903" },
    { name: "Reserved (Upcoming)", value: analytics.activeReservationsCount - analytics.currentlyOccupiedSeats, color: "#9a4703" },
    { name: "Available Desks", value: analytics.currentlyAvailableSeats, color: "#586354" },
  ];

  return (
    <div>
      <div className="admin-header">
        <div>
          <p className="tracked" style={{ color: "var(--rust)" }}>CAMPUS UTILISATION & DATA</p>
          <h1 className="h2" style={{ fontSize: "clamp(36px, 5vw, 64px)" }}>
            Usage Analytics
          </h1>
        </div>

        <div>
          <span style={{ fontSize: "14px", color: "var(--sage)" }}>
            Average Weekly Occupancy: <bold>{analytics.weeklyUtilisationRate}%</bold>
          </span>
        </div>
      </div>

      {/* Top Stat Summary */}
      <div className="metrics-grid">
        <div className="metric-card">
          <p className="tracked" style={{ fontSize: "10px", color: "var(--sage)" }}>TOTAL SEATS</p>
          <p className="metric-card__value">{analytics.totalSeats}</p>
          <p className="metric-card__sub">Across {analytics.totalSpaces} spaces</p>
        </div>

        <div className="metric-card">
          <p className="tracked" style={{ fontSize: "10px", color: "#38633d" }}>AVAILABLE NOW</p>
          <p className="metric-card__value" style={{ color: "#38633d" }}>{analytics.currentlyAvailableSeats}</p>
          <p className="metric-card__sub">{Math.round((analytics.currentlyAvailableSeats / analytics.totalSeats) * 100)}% of total desks</p>
        </div>

        <div className="metric-card">
          <p className="tracked" style={{ fontSize: "10px", color: "var(--sun)" }}>OCCUPIED DESKS</p>
          <p className="metric-card__value" style={{ color: "var(--sun)" }}>{analytics.currentlyOccupiedSeats}</p>
          <p className="metric-card__sub">Verified check-in events</p>
        </div>

        <div className="metric-card">
          <p className="tracked" style={{ fontSize: "10px", color: "var(--rust)" }}>WEEKLY UTILISATION</p>
          <p className="metric-card__value" style={{ color: "var(--rust)" }}>{analytics.weeklyUtilisationRate}%</p>
          <p className="metric-card__sub">Campus average</p>
        </div>
      </div>

      {/* Grid of Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: "28px" }}>
        {/* Chart 1: Daily Bookings Trend */}
        <div className="admin-card">
          <h3>Daily Bookings vs Verified Check-Ins</h3>
          <p style={{ color: "var(--sage)", fontSize: "13px", marginBottom: "20px" }}>
            7-day comparison between total reservations created and verified physical check-in events.
          </p>
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={analytics.dailyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(1, 38, 45, 0.15)" />
                <XAxis dataKey="date" stroke="var(--ink)" fontSize={12} />
                <YAxis stroke="var(--ink)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--paper)",
                    borderColor: "var(--ink)",
                    borderRadius: 0,
                    fontSize: "13px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "13px" }} />
                <Bar dataKey="bookings" name="Total Reservations" fill="#01262d" />
                <Bar dataKey="checkIns" name="Verified Check-Ins" fill="#ee8903" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Seat Breakdown Pie */}
        <div className="admin-card">
          <h3>Live Seat Occupancy Distribution</h3>
          <p style={{ color: "var(--sage)", fontSize: "13px", marginBottom: "20px" }}>
            Real-time balance between physically occupied desks, upcoming reserved seats, and open desks.
          </p>
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--paper)",
                    borderColor: "var(--ink)",
                    borderRadius: 0,
                    fontSize: "13px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Space Utilisation Bar Chart */}
        <div className="admin-card">
          <h3>Space-Wise Utilisation Rate (%)</h3>
          <p style={{ color: "var(--sage)", fontSize: "13px", marginBottom: "20px" }}>
            Percentage of total capacity occupied during peak campus hours across all 6 study spaces.
          </p>
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <BarChart
                data={analytics.spaceUtilisation}
                layout="vertical"
                margin={{ top: 10, right: 20, left: 40, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(1, 38, 45, 0.15)" />
                <XAxis type="number" domain={[0, 100]} stroke="var(--ink)" fontSize={12} unit="%" />
                <YAxis type="category" dataKey="name" stroke="var(--ink)" fontSize={11} width={100} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--paper)",
                    borderColor: "var(--ink)",
                    borderRadius: 0,
                    fontSize: "13px",
                  }}
                />
                <Bar dataKey="utilisationRate" name="Utilisation Rate (%)" fill="#ee8903" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 4: Peak Occupancy Hours Area Chart */}
        <div className="admin-card">
          <h3>Peak Occupancy Periods</h3>
          <p style={{ color: "var(--sage)", fontSize: "13px", marginBottom: "20px" }}>
            Hourly distribution of active students on campus across the operating hours.
          </p>
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <AreaChart data={analytics.peakOccupancyHours} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(1, 38, 45, 0.15)" />
                <XAxis dataKey="hour" stroke="var(--ink)" fontSize={12} />
                <YAxis stroke="var(--ink)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--paper)",
                    borderColor: "var(--ink)",
                    borderRadius: 0,
                    fontSize: "13px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="activeCount"
                  name="Active Students"
                  stroke="#9a4703"
                  fill="#f5c279"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
