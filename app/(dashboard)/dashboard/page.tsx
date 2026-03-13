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

  // Carica patrimonio quando cambiano gli intestatari selezionati
  const fetchPatrimonio = useCallback(async () => {
    setLoading(true);
    try {
      const params = selectedIds.length > 0 ? `?intestatariIds=${selectedIds.join(",")}` : "";
      const res = await fetch(`/api/patrimonio${params}`);
      if (res.ok) {
        setPatrimonio(await res.json());
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [selectedIds]);

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
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Benvenuto, {user?.nome}
      </Typography>
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
                    Risparmio medio mensile
                    {patrimonio && patrimonio.mesiConDati > 0 && (
                      <> · su {patrimonio.mesiConDati} {patrimonio.mesiConDati === 1 ? "mese" : "mesi"} con dati</>
                    )}
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
