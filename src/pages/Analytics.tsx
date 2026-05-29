import { useEffect, useState } from "react";
import { api, type HrAnalytics } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, XAxis, YAxis,
} from "recharts";
import {
  Activity, BriefcaseBusiness, CheckCircle2, Clock3, Loader2, Percent, TrendingUp, Users,
} from "lucide-react";

const chartConfig = {
  applications: { label: "Applications", color: "hsl(var(--chart-1))" },
  hired: { label: "Hired", color: "hsl(var(--chart-2))" },
  rejected: { label: "Rejected", color: "hsl(var(--chart-5))" },
  interviews: { label: "Interviews", color: "hsl(var(--chart-4))" },
  count: { label: "Count", color: "hsl(215 16% 47%)" },
} satisfies ChartConfig;

const statusColors: Record<string, string> = {
  Pending: "hsl(var(--muted-foreground))",
  Interview: "hsl(var(--chart-4))",
  Hired: "hsl(var(--chart-2))",
  Rejected: "hsl(var(--chart-5))",
};

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<HrAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.analytics.hr()
      .then(setAnalytics)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="container py-8">
        <div className="grid min-h-[50vh] place-items-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </main>
    );
  }

  if (!analytics) {
    return (
      <main className="container py-8">
        <div className="text-muted-foreground">Analytics unavailable</div>
      </main>
    );
  }

  const { overview } = analytics;

  return (
    <main className="container py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">HR Analytics</h1>
        <p className="text-muted-foreground">Hiring performance, funnel health, and screening quality</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <Metric label="Total Hiring" value={overview.total_hiring} icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />} />
        <Metric label="Candidates" value={overview.total_candidates} icon={<Users className="h-5 w-5" />} />
        <Metric label="Open Jobs" value={overview.total_jobs} icon={<BriefcaseBusiness className="h-5 w-5" />} />
        <Metric label="Rejection" value={`${overview.rejection_percent}%`} icon={<Percent className="h-5 w-5 text-red-500" />} />
        <Metric label="Avg ATS" value={`${overview.average_ats_score}%`} icon={<TrendingUp className="h-5 w-5 text-blue-500" />} />
        <Metric label="Time To Hire" value={`${overview.time_to_hire_days}d`} icon={<Clock3 className="h-5 w-5 text-amber-500" />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Hiring Funnel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-80 w-full">
              <BarChart data={analytics.funnel} layout="vertical" margin={{ left: 12, right: 24 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis dataKey="stage" type="category" width={80} />
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status Mix</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-80 w-full">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Pie data={analytics.status_breakdown} dataKey="count" nameKey="status" innerRadius={58} outerRadius={96} paddingAngle={3}>
                  {analytics.status_breakdown.map((row) => (
                    <Cell key={row.status} fill={statusColors[row.status] || "hsl(var(--chart-1))"} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="mt-2 flex flex-wrap gap-2">
              {analytics.status_breakdown.map((row) => (
                <Badge key={row.status} variant="outline">{row.status}: {row.count}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-72 w-full">
              <LineChart data={analytics.monthly_trend}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line dataKey="applications" stroke="var(--color-applications)" strokeWidth={2} dot={false} />
                <Line dataKey="interviews" stroke="var(--color-interviews)" strokeWidth={2} dot={false} />
                <Line dataKey="hired" stroke="var(--color-hired)" strokeWidth={2} dot={false} />
                <Line dataKey="rejected" stroke="var(--color-rejected)" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ATS Score Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-72 w-full">
              <AreaChart data={analytics.ats_distribution}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="range" />
                <YAxis allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area dataKey="count" type="monotone" fill="var(--color-count)" fillOpacity={0.25} stroke="var(--color-count)" strokeWidth={2} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Hiring By Job</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead className="text-center">Candidates</TableHead>
                    <TableHead className="text-center">Hired</TableHead>
                    <TableHead className="text-center">Rejected</TableHead>
                    <TableHead className="text-center">Avg ATS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.hiring_by_job.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No job data</TableCell></TableRow>
                  )}
                  {analytics.hiring_by_job.map((job) => (
                    <TableRow key={job.job_id}>
                      <TableCell className="font-medium">{job.title}</TableCell>
                      <TableCell className="text-center">{job.candidates}</TableCell>
                      <TableCell className="text-center">{job.accepted}</TableCell>
                      <TableCell className="text-center">{job.rejected}</TableCell>
                      <TableCell className="text-center">{job.average_ats_score}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Hires</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {analytics.recent_hires.length === 0 && (
              <div className="text-sm text-muted-foreground">No hires yet</div>
            )}
            {analytics.recent_hires.map((hire) => (
              <div key={hire.id} className="rounded-md border p-3">
                <div className="font-medium">{hire.candidate_name}</div>
                <div className="mt-1 text-sm text-muted-foreground">{hire.job_title}</div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="truncate text-xs text-muted-foreground">{hire.email || "No email"}</span>
                  <Badge variant="secondary">{hire.ats_score}% ATS</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function Metric({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm text-muted-foreground">{label}</div>
            <div className="mt-1 text-2xl font-bold">{value}</div>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-md bg-muted">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}
