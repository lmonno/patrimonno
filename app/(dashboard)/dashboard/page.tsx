"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Chip,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import SavingsIcon from "@mui/icons-material/Savings";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import MonthYearPicker from "@/components/ui/MonthYearPicker";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface Intestatario {
  id: string;
  nome: string;
  cognome: string;
}

interface Patrimonio {
  saldoAttuale: number;
  risparmioMedioMensile: number;
  mesiConDati: number;
  storico: { anno: number; mese: number; totale: number }[];
}

interface EntrataStorico {
  anno: number;
  mese: number;
  totale: number;
  mediana: number;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const user = session?.user;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // Default: mese precedente
  const now = new Date();
  const defaultMese = now.getMonth() === 0 ? 12 : now.getMonth(); // getMonth() 0-based = mese precedente in 1-based
  const defaultAnno = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

  const [anno, setAnno] = useState(defaultAnno);
  const [mese, setMese] = useState(defaultMese);
  const [intestatari, setIntestatari] = useState<Intestatario[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [patrimonio, setPatrimonio] = useState<Patrimonio | null>(null);
  const [entrateStorico, setEntrateStorico] = useState<EntrataStorico[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingEntrate, setLoadingEntrate] = useState(true);

  // Carica intestatari al mount
  useEffect(() => {
    fetch("/api/intestatari")
      .then((r) => r.json())
      .then(setIntestatari)
      .catch(() => {});
  }, []);

  // Carica patrimonio quando cambiano intestatari selezionati o mese
  const fetchPatrimonio = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({ anno: String(anno), mese: String(mese) });
      if (selectedIds.length > 0) queryParams.set("intestatariIds", selectedIds.join(","));
      const res = await fetch(`/api/patrimonio?${queryParams}`);
      if (res.ok) {
        setPatrimonio(await res.json());
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [selectedIds, anno, mese]);

  // Carica storico entrate
  const fetchEntrateStorico = useCallback(async () => {
    setLoadingEntrate(true);
    try {
      const queryParams = new URLSearchParams({ anno: String(anno), mese: String(mese) });
      if (selectedIds.length > 0) queryParams.set("intestatariIds", selectedIds.join(","));
      const res = await fetch(`/api/entrate/storico?${queryParams}`);
      if (res.ok) {
        const data = await res.json();
        setEntrateStorico(data.storico);
      }
    } catch {
      // silent
    } finally {
      setLoadingEntrate(false);
    }
  }, [selectedIds, anno, mese]);

  useEffect(() => {
    fetchPatrimonio();
    fetchEntrateStorico();
  }, [fetchPatrimonio, fetchEntrateStorico]);

  const toggleIntestatario = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const tuttiSelezionati = selectedIds.length === 0;

  const formatEuro = (value: number) =>
    Math.round(value).toLocaleString("de-DE") + " €";

  const risparmioPositivo = (patrimonio?.risparmioMedioMensile ?? 0) >= 0;

  // Dati grafico
  const chartData = entrateStorico.map((e) => ({
    label: `${String(e.mese).padStart(2, "0")}/${String(e.anno).slice(-2)}`,
    entrate: e.totale,
    mediana: e.mediana,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formatTooltipValue = (value: any) => formatEuro(Number(value));

  return (
    <>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2, mb: 1 }}>
        <Typography variant="h4" fontWeight={700}>
          Benvenuto, {user?.nome}
        </Typography>
        <MonthYearPicker anno={anno} mese={mese} onChange={(a, m) => { setAnno(a); setMese(m); }} />
      </Box>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Panoramica del patrimonio familiare
      </Typography>

      {/* Selettore intestatari */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          Filtra per intestatario
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          <Chip
            label="Tutti"
            color={tuttiSelezionati ? "primary" : "default"}
            variant={tuttiSelezionati ? "filled" : "outlined"}
            onClick={() => setSelectedIds([])}
          />
          {intestatari.map((int) => {
            const isSelected = selectedIds.includes(int.id);
            return (
              <Chip
                key={int.id}
                label={`${int.nome} ${int.cognome}`}
                color={isSelected ? "primary" : "default"}
                variant={isSelected ? "filled" : "outlined"}
                onClick={() => toggleIntestatario(int.id)}
              />
            );
          })}
        </Box>
      </Box>

      {/* Cards patrimonio */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {/* Saldo Attuale */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <Card sx={{ bgcolor: "#e3f2fd", height: "100%" }}>
              <CardContent sx={{ display: "flex", alignItems: "center", gap: 2, py: 3 }}>
                <SavingsIcon sx={{ fontSize: 48, color: "primary.main" }} />
                <Box>
                  <Typography variant="h4" fontWeight={700}>
                    {formatEuro(patrimonio?.saldoAttuale ?? 0)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Saldo attuale
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Risparmio Medio Mensile */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <Card sx={{ bgcolor: risparmioPositivo ? "#e8f5e9" : "#fce4ec", height: "100%" }}>
              <CardContent sx={{ display: "flex", alignItems: "center", gap: 2, py: 3 }}>
                {risparmioPositivo ? (
                  <TrendingUpIcon sx={{ fontSize: 48, color: "success.main" }} />
                ) : (
                  <TrendingDownIcon sx={{ fontSize: 48, color: "error.main" }} />
                )}
                <Box>
                  <Typography
                    variant="h4"
                    fontWeight={700}
                    color={risparmioPositivo ? "success.main" : "error.main"}
                  >
                    {(patrimonio?.risparmioMedioMensile ?? 0) >= 0 ? "+" : ""}
                    {formatEuro(patrimonio?.risparmioMedioMensile ?? 0)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Risparmio medio su 12 mesi
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Grafico Entrate */}
      <Box sx={{ mt: 4 }}>
        <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
          Entrate mensili
        </Typography>
        {loadingEntrate ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress />
          </Box>
        ) : chartData.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
            Nessun dato sulle entrate disponibile
          </Typography>
        ) : (
          <Card>
            <CardContent sx={{ px: isMobile ? 1 : 3 }}>
              <ResponsiveContainer width="100%" height={isMobile ? 280 : 350}>
                <ComposedChart data={chartData} margin={{ top: 10, right: isMobile ? 5 : 20, left: isMobile ? -15 : 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: isMobile ? 10 : 12 }}
                    interval={isMobile ? 2 : 0}
                    angle={isMobile ? -45 : 0}
                    textAnchor={isMobile ? "end" : "middle"}
                  />
                  <YAxis
                    tick={{ fontSize: isMobile ? 10 : 12 }}
                    tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                  />
                  <Tooltip
                    formatter={formatTooltipValue}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: isMobile ? 11 : 13 }}
                  />
                  <Bar
                    dataKey="entrate"
                    name="Entrate"
                    fill="#2e7d32"
                    opacity={0.7}
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    dataKey="mediana"
                    name="Mediana 12 mesi"
                    stroke="#ff9800"
                    strokeWidth={2.5}
                    dot={false}
                    type="monotone"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </Box>
    </>
  );
}
