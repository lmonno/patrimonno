"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  Typography,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Snackbar,
  TextField,
  MenuItem,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SaldoForm from "./SaldoForm";
import EmptyState from "@/components/ui/EmptyState";

interface SaldoWithConto {
  id: string;
  contoId: string;
  anno: number;
  mese: number;
  valore: string;
  conto: {
    id: string;
    nome: string;
    banca: string;
    iban: string | null;
    tipoConto: { id: string; nome: string };
    intestatari: { intestatario: { id: string; nome: string; cognome: string } }[];
  };
}

const MESI = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

function getCurrentPeriod() {
  const now = new Date();
  // Default: mese precedente (il saldo più recente da compilare)
  let mese = now.getMonth(); // 0-indexed → getMonth() di marzo = 2
  let anno = now.getFullYear();
  if (mese === 0) {
    mese = 12;
    anno -= 1;
  }
  return { anno, mese };
}

export default function SaldiTable() {
  const { anno: initAnno, mese: initMese } = getCurrentPeriod();
  const [anno, setAnno] = useState(initAnno);
  const [mese, setMese] = useState(initMese);
  const [saldi, setSaldi] = useState<SaldoWithConto[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" as "success" | "error" });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/saldi?anno=${anno}&mese=${mese}`);
      if (res.ok) {
        setSaldi(await res.json());
      }
    } catch {
      setSnackbar({ open: true, message: "Errore nel caricamento", severity: "error" });
    } finally {
      setLoading(false);
    }
  }, [anno, mese]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totale = saldi.reduce((sum, s) => sum + parseFloat(s.valore.toString()), 0);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, flexWrap: "wrap", gap: 2 }}>
        <Typography variant="h5" fontWeight={600}>
          Saldi
        </Typography>
        <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
          <TextField
            label="Mese"
            select
            value={mese}
            onChange={(e) => setMese(parseInt(e.target.value))}
            sx={{ minWidth: 140 }}
            size="small"
          >
            {MESI.map((label, i) => (
              <MenuItem key={i + 1} value={i + 1}>
                {label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Anno"
            type="number"
            value={anno}
            onChange={(e) => setAnno(parseInt(e.target.value))}
            sx={{ width: 100 }}
            size="small"
            slotProps={{ htmlInput: { min: 2000, max: 2100 } }}
          />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setFormOpen(true)}
          >
            Inserisci Saldi
          </Button>
        </Box>
      </Box>

      {saldi.length === 0 ? (
        <EmptyState message={`Nessun saldo per ${MESI[mese - 1]} ${anno}`} />
      ) : (
        <>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Conto</strong></TableCell>
                  <TableCell><strong>Tipo</strong></TableCell>
                  <TableCell><strong>Banca</strong></TableCell>
                  <TableCell><strong>Intestatari</strong></TableCell>
                  <TableCell align="right"><strong>Saldo</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {saldi.map((s) => (
                  <TableRow key={s.id} hover>
                    <TableCell>{s.conto.nome}</TableCell>
                    <TableCell>
                      <Chip label={s.conto.tipoConto.nome} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>{s.conto.banca}</TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                        {s.conto.intestatari.map((i) => (
                          <Chip
                            key={i.intestatario.id}
                            label={`${i.intestatario.nome} ${i.intestatario.cognome}`}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, fontFamily: "monospace", fontSize: "0.95rem" }}>
                      {parseFloat(s.valore.toString()).toLocaleString("it-IT", { minimumFractionDigits: 2 })} €
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={4} align="right">
                    <Typography fontWeight={700}>Totale</Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontFamily: "monospace", fontSize: "1rem" }}>
                    {totale.toLocaleString("it-IT", { minimumFractionDigits: 2 })} €
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      <SaldoForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={() => {
          fetchData();
          setSnackbar({ open: true, message: "Saldi salvati con successo", severity: "success" });
        }}
        defaultAnno={anno}
        defaultMese={mese}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}
