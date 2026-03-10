"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  MenuItem,
  Box,
  Chip,
  Typography,
  CircularProgress,
  InputAdornment,
} from "@mui/material";

interface Conto {
  id: string;
  nome: string;
  banca: string;
  tipoConto: { nome: string };
  intestatari: { intestatario: { nome: string; cognome: string } }[];
}

interface SaldoFormProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  defaultAnno: number;
  defaultMese: number;
}

const MESI = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

function evaluateFormula(input: string, prev: number | null): number | null {
  if (!input.startsWith("=")) return null;
  const expr = input.slice(1).trim();
  const prevValue = prev ?? 0;
  try {
    const sanitized = expr.replace(/prev/gi, prevValue.toString());
    // Valida che contenga solo numeri, operatori e spazi
    if (!/^[\d\s+\-*/().]+$/.test(sanitized)) return null;
    const result = new Function(`return (${sanitized})`)();
    if (typeof result !== "number" || !isFinite(result)) return null;
    return Math.round(result * 100) / 100;
  } catch {
    return null;
  }
}

export default function SaldoForm({ open, onClose, onSave, defaultAnno, defaultMese }: SaldoFormProps) {
  const [anno, setAnno] = useState(defaultAnno);
  const [mese, setMese] = useState(defaultMese);
  const [conti, setConti] = useState<Conto[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [prevSaldi, setPrevSaldi] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadData = useCallback(async (a: number, m: number) => {
    setLoading(true);
    setError("");
    try {
      const [contiRes, prevRes, currentRes] = await Promise.all([
        fetch("/api/conti"),
        fetch(`/api/saldi/previous?anno=${a}&mese=${m}`),
        fetch(`/api/saldi?anno=${a}&mese=${m}`),
      ]);

      const contiData: Conto[] = await contiRes.json();
      const prevData: Record<string, string> = await prevRes.json();
      const currentData: { contoId: string; valore: string }[] = await currentRes.json();

      setConti(contiData);
      setPrevSaldi(prevData);

      // Pre-compila: saldo corrente > saldo mese precedente > vuoto
      const currentMap: Record<string, string> = {};
      for (const s of currentData) {
        currentMap[s.contoId] = parseFloat(s.valore.toString()).toString();
      }

      const newValues: Record<string, string> = {};
      for (const c of contiData) {
        if (currentMap[c.id]) {
          newValues[c.id] = currentMap[c.id];
        } else if (prevData[c.id]) {
          newValues[c.id] = prevData[c.id];
        } else {
          newValues[c.id] = "";
        }
      }
      setValues(newValues);
    } catch {
      setError("Errore nel caricamento dei dati");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setAnno(defaultAnno);
      setMese(defaultMese);
      loadData(defaultAnno, defaultMese);
    }
  }, [open, defaultAnno, defaultMese, loadData]);

  const handlePeriodChange = (newAnno: number, newMese: number) => {
    setAnno(newAnno);
    setMese(newMese);
    loadData(newAnno, newMese);
  };

  const handleValueChange = (contoId: string, value: string) => {
    setValues((prev) => ({ ...prev, [contoId]: value }));
    setError("");
  };

  const resolveValue = (contoId: string): string | null => {
    const raw = values[contoId]?.trim();
    if (!raw) return null;

    if (raw.startsWith("=")) {
      const prev = prevSaldi[contoId] ? parseFloat(prevSaldi[contoId]) : null;
      const result = evaluateFormula(raw, prev);
      return result !== null ? result.toString() : null;
    }

    const num = parseFloat(raw);
    return isFinite(num) ? num.toString() : null;
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError("");

    const saldi: { contoId: string; anno: number; mese: number; valore: string }[] = [];

    for (const c of conti) {
      const resolved = resolveValue(c.id);
      if (resolved !== null) {
        saldi.push({ contoId: c.id, anno, mese, valore: resolved });
      }
    }

    if (saldi.length === 0) {
      setError("Nessun saldo da salvare");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/saldi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saldi }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Errore durante il salvataggio");
        return;
      }

      onSave();
      onClose();
    } catch {
      setError("Errore di connessione");
    } finally {
      setSaving(false);
    }
  };

  const getResolvedPreview = (contoId: string): string | null => {
    const raw = values[contoId]?.trim();
    if (!raw || !raw.startsWith("=")) return null;
    const prev = prevSaldi[contoId] ? parseFloat(prevSaldi[contoId]) : null;
    const result = evaluateFormula(raw, prev);
    return result !== null ? `= ${result.toLocaleString("it-IT", { minimumFractionDigits: 2 })} €` : "Formula non valida";
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Inserimento Saldi</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: "flex", gap: 2, mb: 3, mt: 1 }}>
          <TextField
            label="Mese"
            select
            value={mese}
            onChange={(e) => handlePeriodChange(anno, parseInt(e.target.value))}
            sx={{ minWidth: 160 }}
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
            onChange={(e) => handlePeriodChange(parseInt(e.target.value), mese)}
            sx={{ width: 120 }}
            size="small"
            slotProps={{ htmlInput: { min: 2000, max: 2100 } }}
          />
        </Box>

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : conti.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
            Nessun conto disponibile. Crea prima un conto.
          </Typography>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Usa <code>=prev+100</code> per formule. <code>prev</code> = saldo mese precedente.
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Conto</strong></TableCell>
                    <TableCell><strong>Tipo</strong></TableCell>
                    <TableCell><strong>Precedente</strong></TableCell>
                    <TableCell sx={{ width: 220 }}><strong>Saldo</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {conti.map((c) => {
                    const preview = getResolvedPreview(c.id);
                    return (
                      <TableRow key={c.id}>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>
                            {c.nome}
                          </Typography>
                          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
                            {c.intestatari.map((i) => (
                              <Chip
                                key={`${c.id}-${i.intestatario.nome}`}
                                label={`${i.intestatario.nome} ${i.intestatario.cognome}`}
                                size="small"
                                variant="outlined"
                              />
                            ))}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip label={c.tipoConto.nome} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>
                          {prevSaldi[c.id]
                            ? parseFloat(prevSaldi[c.id]).toLocaleString("it-IT", { minimumFractionDigits: 2 }) + " €"
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            fullWidth
                            value={values[c.id] ?? ""}
                            onChange={(e) => handleValueChange(c.id, e.target.value)}
                            placeholder="0,00"
                            slotProps={{
                              input: {
                                endAdornment: !preview ? (
                                  <InputAdornment position="end">€</InputAdornment>
                                ) : undefined,
                              },
                            }}
                            helperText={preview}
                            error={preview === "Formula non valida"}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Annulla
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={saving || loading || conti.length === 0}
        >
          {saving ? "Salvataggio..." : "Salva"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
