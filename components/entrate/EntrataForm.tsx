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

interface Intestatario {
  id: string;
  nome: string;
  cognome: string;
}

interface TipoEntrata {
  id: string;
  nome: string;
}

interface EntrataFormProps {
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

function getPreviousMonth(anno: number, mese: number) {
  if (mese === 1) return { anno: anno - 1, mese: 12 };
  return { anno, mese: mese - 1 };
}

export default function EntrataForm({ open, onClose, onSave, defaultAnno, defaultMese }: EntrataFormProps) {
  const [anno, setAnno] = useState(defaultAnno);
  const [mese, setMese] = useState(defaultMese);
  const [intestatari, setIntestatari] = useState<Intestatario[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [tipiEntrata, setTipiEntrata] = useState<TipoEntrata[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [prevValues, setPrevValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const loadData = useCallback(async (a: number, m: number, selIds: string[]) => {
    setLoading(true);
    setError("");
    try {
      const prev = getPreviousMonth(a, m);
      const [intRes, tipiRes, currentRes, prevRes] = await Promise.all([
        fetch("/api/intestatari"),
        fetch("/api/tipi-entrata"),
        fetch(`/api/entrate?anno=${a}&mese=${m}`),
        fetch(`/api/entrate?anno=${prev.anno}&mese=${prev.mese}`),
      ]);

      const intData: Intestatario[] = await intRes.json();
      const tipiData: TipoEntrata[] = await tipiRes.json();
      const currentData: { intestatarioId: string; tipoEntrataId: string; valore: string }[] = await currentRes.json();
      const prevData: { intestatarioId: string; tipoEntrataId: string; valore: string }[] = await prevRes.json();

      setIntestatari(intData);
      setTipiEntrata(tipiData);

      // Se nessun intestatario selezionato, seleziona tutti
      const activeIds = selIds.length > 0 ? selIds : intData.map((i) => i.id);
      if (selIds.length === 0) setSelectedIds([]);

      // Mappa valori precedenti: somma per tipo entrata degli intestatari selezionati
      const prevMap: Record<string, string> = {};
      for (const tipo of tipiData) {
        let sum = 0;
        let found = false;
        for (const e of prevData) {
          if (e.tipoEntrataId === tipo.id && activeIds.includes(e.intestatarioId)) {
            sum += parseFloat(e.valore.toString());
            found = true;
          }
        }
        if (found) prevMap[tipo.id] = sum.toString();
      }
      setPrevValues(prevMap);

      // Pre-popola: somma valori correnti per tipo entrata degli intestatari selezionati
      const newValues: Record<string, string> = {};
      for (const tipo of tipiData) {
        let sum = 0;
        let found = false;
        for (const e of currentData) {
          if (e.tipoEntrataId === tipo.id && activeIds.includes(e.intestatarioId)) {
            sum += parseFloat(e.valore.toString());
            found = true;
          }
        }
        if (found) {
          newValues[tipo.id] = Math.round(sum * 100) / 100 === 0 ? "" : (Math.round(sum * 100) / 100).toString();
        } else if (prevMap[tipo.id]) {
          newValues[tipo.id] = prevMap[tipo.id];
        } else {
          newValues[tipo.id] = "";
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
      setSelectedIds([]);
      loadData(defaultAnno, defaultMese, []);
    }
  }, [open, defaultAnno, defaultMese, loadData]);

  const handlePeriodChange = (newAnno: number, newMese: number) => {
    setAnno(newAnno);
    setMese(newMese);
    loadData(newAnno, newMese, selectedIds);
  };

  const toggleIntestatario = (id: string) => {
    const newIds = selectedIds.includes(id)
      ? selectedIds.filter((i) => i !== id)
      : [...selectedIds, id];
    setSelectedIds(newIds);
    loadData(anno, mese, newIds);
  };

  const tuttiSelezionati = selectedIds.length === 0;

  const handleValueChange = (tipoId: string, value: string) => {
    setValues((prev) => ({ ...prev, [tipoId]: value }));
    setError("");
  };

  const resolveValue = (tipoId: string): string | null => {
    const raw = values[tipoId]?.trim();
    if (!raw) return null;
    if (raw.startsWith("=")) {
      const prev = prevValues[tipoId] ? parseFloat(prevValues[tipoId]) : null;
      const result = evaluateFormula(raw, prev);
      return result !== null ? result.toString() : null;
    }
    const num = parseFloat(raw);
    return isFinite(num) ? num.toString() : null;
  };

  const getResolvedPreview = (tipoId: string): string | null => {
    const raw = values[tipoId]?.trim();
    if (!raw || !raw.startsWith("=")) return null;
    const prev = prevValues[tipoId] ? parseFloat(prevValues[tipoId]) : null;
    const result = evaluateFormula(raw, prev);
    return result !== null ? `= ${result.toLocaleString("it-IT", { minimumFractionDigits: 2 })} €` : "Formula non valida";
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError("");

    // Intestatari effettivi: se nessuno selezionato = tutti
    const activeIds = selectedIds.length > 0 ? selectedIds : intestatari.map((i) => i.id);
    const numIntestatari = activeIds.length;

    const entrate: { intestatarioId: string; tipoEntrataId: string; anno: number; mese: number; valore: string }[] = [];

    for (const tipo of tipiEntrata) {
      const resolved = resolveValue(tipo.id);
      if (resolved !== null) {
        const valorePerIntestatario = Math.round((parseFloat(resolved) / numIntestatari) * 100) / 100;
        for (const intId of activeIds) {
          entrate.push({
            intestatarioId: intId,
            tipoEntrataId: tipo.id,
            anno,
            mese,
            valore: valorePerIntestatario.toString(),
          });
        }
      }
    }

    if (entrate.length === 0) {
      setError("Nessuna entrata da salvare");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/entrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entrate }),
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

  const renderField = (tipoId: string) => {
    const preview = getResolvedPreview(tipoId);
    const hasFormula = values[tipoId]?.trim().startsWith("=");
    const prevVal = prevValues[tipoId];
    return (
      <TextField
        size="small"
        fullWidth
        value={values[tipoId] ?? ""}
        onChange={(e) => handleValueChange(tipoId, e.target.value)}
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
        helperText={preview ?? (prevVal ? `Prec: ${parseFloat(prevVal).toLocaleString("it-IT", { minimumFractionDigits: 2 })} €` : undefined)}
        error={preview === "Formula non valida"}
      />
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth fullScreen={isMobile}>
      <DialogTitle>Inserimento Entrate</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: "flex", gap: 2, mb: 2, mt: 1 }}>
          <MonthYearPicker anno={anno} mese={mese} onChange={handlePeriodChange} />
        </Box>

        {/* Selettore intestatari */}
        {intestatari.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Intestatari
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              <Chip
                label="Tutti"
                color={tuttiSelezionati ? "primary" : "default"}
                variant={tuttiSelezionati ? "filled" : "outlined"}
                onClick={() => { setSelectedIds([]); loadData(anno, mese, []); }}
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
            {!tuttiSelezionati && selectedIds.length > 1 && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                Il valore inserito viene diviso equamente tra gli intestatari selezionati
              </Typography>
            )}
          </Box>
        )}

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : tipiEntrata.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
            Nessun tipo entrata disponibile.
          </Typography>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Usa <code>=prev+100</code> per formule. <code>prev</code> = entrata mese precedente.
            </Typography>

            {isMobile ? (
              <Stack spacing={1.5}>
                {tipiEntrata.map((tipo) => (
                  <Box key={tipo.id} sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                    <Chip label={tipo.nome} size="small" variant="outlined" sx={{ minWidth: 100, mt: 0.5 }} />
                    <Box sx={{ flex: 1 }}>
                      {renderField(tipo.id)}
                    </Box>
                  </Box>
                ))}
              </Stack>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Tipo Entrata</strong></TableCell>
                      <TableCell sx={{ width: 220 }}><strong>Valore</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tipiEntrata.map((tipo) => (
                      <TableRow key={tipo.id}>
                        <TableCell>
                          <Chip label={tipo.nome} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>
                          {renderField(tipo.id)}
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
          disabled={saving || loading || tipiEntrata.length === 0}
        >
          {saving ? "Salvataggio..." : "Salva"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
