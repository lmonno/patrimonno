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
  // "comune" = entrate comuni divise tra tutti, oppure un singolo intestatarioId
  const [selectedChip, setSelectedChip] = useState<string>("comune");
  const [tipiEntrata, setTipiEntrata] = useState<TipoEntrata[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [prevValues, setPrevValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const loadData = useCallback(async (a: number, m: number, chip: string) => {
    setLoading(true);
    setError("");
    try {
      const prev = getPreviousMonth(a, m);

      // Se chip è un intestatarioId, filtriamo per quello; altrimenti carichiamo tutto
      const intFilter = chip !== "comune" ? `&intestatarioId=${chip}` : "";
      const [intRes, tipiRes, currentRes, prevRes] = await Promise.all([
        fetch("/api/intestatari"),
        fetch("/api/tipi-entrata"),
        fetch(`/api/entrate?anno=${a}&mese=${m}${intFilter}`),
        fetch(`/api/entrate?anno=${prev.anno}&mese=${prev.mese}${intFilter}`),
      ]);

      const intData: Intestatario[] = await intRes.json();
      const tipiData: TipoEntrata[] = await tipiRes.json();
      const currentData: { intestatarioId: string; tipoEntrataId: string; valore: string }[] = await currentRes.json();
      const prevData: { intestatarioId: string; tipoEntrataId: string; valore: string }[] = await prevRes.json();

      setIntestatari(intData);
      setTipiEntrata(tipiData);

      // Mappa valori precedenti: somma per tipo entrata
      const prevMap: Record<string, string> = {};
      for (const tipo of tipiData) {
        let sum = 0;
        let found = false;
        for (const e of prevData) {
          if (e.tipoEntrataId === tipo.id) {
            sum += parseFloat(e.valore.toString());
            found = true;
          }
        }
        if (found) prevMap[tipo.id] = sum.toString();
      }
      setPrevValues(prevMap);

      // Pre-popola: somma valori correnti per tipo entrata
      const newValues: Record<string, string> = {};
      for (const tipo of tipiData) {
        let sum = 0;
        let found = false;
        for (const e of currentData) {
          if (e.tipoEntrataId === tipo.id) {
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
      setSelectedChip("comune");
      loadData(defaultAnno, defaultMese, "comune");
    }
  }, [open, defaultAnno, defaultMese, loadData]);

  const handlePeriodChange = (newAnno: number, newMese: number) => {
    setAnno(newAnno);
    setMese(newMese);
    loadData(newAnno, newMese, selectedChip);
  };

  const handleChipSelect = (chip: string) => {
    setSelectedChip(chip);
    loadData(anno, mese, chip);
  };

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

    const entrate: { intestatarioId: string; tipoEntrataId: string; anno: number; mese: number; valore: string }[] = [];

    if (selectedChip === "comune") {
      // Comune: dividi equamente tra tutti gli intestatari
      const numIntestatari = intestatari.length;
      for (const tipo of tipiEntrata) {
        const resolved = resolveValue(tipo.id);
        if (resolved !== null) {
          const valorePerIntestatario = Math.round((parseFloat(resolved) / numIntestatari) * 100) / 100;
          for (const int of intestatari) {
            entrate.push({
              intestatarioId: int.id,
              tipoEntrataId: tipo.id,
              anno,
              mese,
              valore: valorePerIntestatario.toString(),
            });
          }
        }
      }
    } else {
      // Singolo intestatario: salva direttamente
      for (const tipo of tipiEntrata) {
        const resolved = resolveValue(tipo.id);
        if (resolved !== null) {
          entrate.push({
            intestatarioId: selectedChip,
            tipoEntrataId: tipo.id,
            anno,
            mese,
            valore: resolved,
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

        {/* Selettore intestatario */}
        {intestatari.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Intestatario
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              {intestatari.map((int) => (
                <Chip
                  key={int.id}
                  label={`${int.nome} ${int.cognome}`}
                  color={selectedChip === int.id ? "primary" : "default"}
                  variant={selectedChip === int.id ? "filled" : "outlined"}
                  onClick={() => handleChipSelect(int.id)}
                />
              ))}
              <Chip
                label="Comune"
                color={selectedChip === "comune" ? "primary" : "default"}
                variant={selectedChip === "comune" ? "filled" : "outlined"}
                onClick={() => handleChipSelect("comune")}
              />
            </Box>
            {selectedChip === "comune" && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                Il valore inserito viene diviso equamente tra tutti gli intestatari
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
