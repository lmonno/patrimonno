"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  Chip,
  Typography,
  CircularProgress,
  InputAdornment,
  TextField,
  Tooltip,
  Card,
  CardContent,
  Stack,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import FunctionsIcon from "@mui/icons-material/Functions";
import MonthYearPicker from "@/components/ui/MonthYearPicker";

interface Conto {
  id: string;
  nome: string;
  rapporto: { nome: string; istituto: string };
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

function evaluateFormula(input: string, prev: number | null): number | null {
  if (!input.startsWith("=")) return null;
  const expr = input.slice(1).trim();
  const prevValue = prev ?? 0;
  try {
    const sanitized = expr.replace(/prev/gi, prevValue.toString());
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
      const currentData: { contoId: string; valore: string; formula?: string | null }[] = await currentRes.json();

      setConti(contiData);
      setPrevSaldi(prevData);

      const currentMap: Record<string, { valore: string; formula?: string | null }> = {};
      for (const s of currentData) {
        currentMap[s.contoId] = {
          valore: parseFloat(s.valore.toString()).toString(),
          formula: s.formula,
        };
      }

      const newValues: Record<string, string> = {};
      for (const c of contiData) {
        if (currentMap[c.id]) {
          // Se esiste una formula storicizzata, mostrala; altrimenti il valore numerico
          newValues[c.id] = currentMap[c.id].formula ?? currentMap[c.id].valore;
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

    const saldi: { contoId: string; anno: number; mese: number; valore: string; formula?: string }[] = [];

    for (const c of conti) {
      const raw = values[c.id]?.trim();
      const resolved = resolveValue(c.id);
      if (resolved !== null) {
        saldi.push({
          contoId: c.id,
          anno,
          mese,
          valore: resolved,
          formula: raw?.startsWith("=") ? raw : undefined,
        });
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

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const renderSaldoField = (c: Conto) => {
    const preview = getResolvedPreview(c.id);
    const hasFormula = values[c.id]?.trim().startsWith("=");
    return (
      <TextField
        size="small"
        fullWidth
        value={values[c.id] ?? ""}
        onChange={(e) => handleValueChange(c.id, e.target.value)}
        placeholder="0,00"
        slotProps={{
          input: {
            startAdornment: hasFormula ? (
              <InputAdornment position="start">
                <Tooltip title="Formula attiva">
                  <FunctionsIcon fontSize="small" color="primary" />
                </Tooltip>
              </InputAdornment>
            ) : undefined,
            endAdornment: !preview ? (
              <InputAdornment position="end">€</InputAdornment>
            ) : undefined,
          },
        }}
        helperText={preview}
        error={preview === "Formula non valida"}
      />
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth fullScreen={isMobile}>
      <DialogTitle>Inserimento Saldi</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: "flex", gap: 2, mb: 3, mt: 1 }}>
          <MonthYearPicker anno={anno} mese={mese} onChange={handlePeriodChange} />
        </Box>

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : conti.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
            Nessun conto disponibile. Crea prima un rapporto con almeno un conto.
          </Typography>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Usa <code>=prev+100</code> per formule. <code>prev</code> = saldo mese precedente.
            </Typography>

            {isMobile ? (
              /* ─── MOBILE: Card layout ─── */
              <Stack spacing={1.5}>
                {conti.map((c) => (
                  <Card key={c.id} variant="outlined">
                    <CardContent sx={{ py: 1.5, px: 2, "&:last-child": { pb: 1.5 } }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600} noWrap>
                            {c.nome}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {c.rapporto.nome} · {c.rapporto.istituto}
                          </Typography>
                        </Box>
                        <Box sx={{ display: "flex", gap: 0.5, flexShrink: 0, alignItems: "center" }}>
                          <Chip label={c.tipoConto.nome} size="small" variant="outlined" />
                        </Box>
                      </Box>
                      {prevSaldi[c.id] && (
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
                          Prec: {parseFloat(prevSaldi[c.id]).toLocaleString("it-IT", { minimumFractionDigits: 2 })} €
                        </Typography>
                      )}
                      {renderSaldoField(c)}
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            ) : (
              /* ─── DESKTOP: Table layout ─── */
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
                    {conti.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>
                            {c.nome}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {c.rapporto.nome} · {c.rapporto.istituto}
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
                          {renderSaldoField(c)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
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
