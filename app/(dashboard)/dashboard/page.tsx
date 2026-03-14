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
} from "@mui/material";
import SavingsIcon from "@mui/icons-material/Savings";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import MonthYearPicker from "@/components/ui/MonthYearPicker";

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

export default function DashboardPage() {
  const { data: session } = useSession();
  const user = session?.user;

  // Default: mese precedente
  const now = new Date();
  const defaultMese = now.getMonth() === 0 ? 12 : now.getMonth(); // getMonth() 0-based = mese precedente in 1-based
  const defaultAnno = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

  const [anno, setAnno] = useState(defaultAnno);
  const [mese, setMese] = useState(defaultMese);
  const [intestatari, setIntestatari] = useState<Intestatario[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [patrimonio, setPatrimonio] = useState<Patrimonio | null>(null);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    fetchPatrimonio();
  }, [fetchPatrimonio]);

  const toggleIntestatario = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const tuttiSelezionati = selectedIds.length === 0;

  const formatEuro = (value: number) =>
    value.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

  const risparmioPositivo = (patrimonio?.risparmioMedioMensile ?? 0) >= 0;

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
    </>
  );
}
