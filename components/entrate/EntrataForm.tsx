"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Alert,
  Box,
  Typography,
  CircularProgress,
  InputAdornment,
  TextField,
  Tooltip,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Chip,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import FunctionsIcon from "@mui/icons-material/Functions";
import MonthYearPicker, { MESI_LUNGHI } from "@/components/ui/MonthYearPicker";
import { parseItalianNumber, evaluateFormula, formatItalianNumber } from "@/lib/formatNumbers";

interface Intestatario {
  id: string;
  nome: string;
  cognome: string;
}

interface TipoEntrata {
  id: string;
  nome: string;
}

interface EntrataData {
  id: string;
  intestatarioId: string;
  tipoEntrataId: string;
  anno: number;
  mese: number;
  valore: string;
  note: string | null;
  intestatario: { id: string; nome: string; cognome: string };
  tipoEntrata: { id: string; nome: string };
}

interface EntrataFormProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  defaultAnno: number;
  defaultMese: number;
  entrata?: EntrataData; // se presente, modalità modifica
}

function getPreviousMonth(anno: number, mese: number) {
  if (mese === 1) return { anno: anno - 1, mese: 12 };
  return { anno, mese: mese - 1 };
}

export default function EntrataForm({ open, onClose, onSave, defaultAnno, defaultMese, entrata }: EntrataFormProps) {
  const isEdit = !!entrata;

  const [anno, setAnno] = useState(defaultAnno);
  const [mese, setMese] = useState(defaultMese);
  const [intestatarioId, setIntestatarioId] = useState<string>("comune");
  const [tipoEntrataId, setTipoEntrataId] = useState<string>("");
  const [valore, setValore] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [intestatari, setIntestatari] = useState<Intestatario[]>([]);
  const [tipiEntrata, setTipiEntrata] = useState<TipoEntrata[]>([]);
  const [prevValue, setPrevValue] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const loadPrevValue = useCallback(async (a: number, m: number, intId: string, tipoId: string) => {
    if (!tipoId || intId === "comune") { setPrevValue(null); return; }
    const prev = getPreviousMonth(a, m);
    try {
      const res = await fetch(`/api/entrate?anno=${prev.anno}&mese=${prev.mese}&intestatarioId=${intId}`);
      if (!res.ok) return;
      const data: { tipoEntrataId: string; valore: string }[] = await res.json();
      const found = data.find((e) => e.tipoEntrataId === tipoId);
      setPrevValue(found ? parseFloat(found.valore.toString()) : null);
    } catch { /* ignore */ }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [intRes, tipiRes] = await Promise.all([
        fetch("/api/intestatari"),
        fetch("/api/tipi-entrata"),
      ]);
      setIntestatari(await intRes.json());
      setTipiEntrata(await tipiRes.json());
    } catch {
      setError("Errore nel caricamento dei dati");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const a = entrata?.anno ?? defaultAnno;
    const m = entrata?.mese ?? defaultMese;
    const intId = entrata?.intestatarioId ?? "comune";
    const tipoId = entrata?.tipoEntrataId ?? "";
    setAnno(a);
    setMese(m);
    setIntestatarioId(intId);
    setTipoEntrataId(tipoId);
    setValore(entrata ? formatItalianNumber(entrata.valore) : "");
    setNote(entrata?.note ?? "");
    setPrevValue(null);
    loadData();
    if (tipoId && intId !== "comune") loadPrevValue(a, m, intId, tipoId);
  }, [open, entrata, defaultAnno, defaultMese, loadData, loadPrevValue]);

  const handleTipoChange = (id: string) => {
    setTipoEntrataId(id);
    if (id && intestatarioId !== "comune") loadPrevValue(anno, mese, intestatarioId, id);
    else setPrevValue(null);
  };

  const handleIntestatarioChange = (id: string) => {
    setIntestatarioId(id);
    if (tipoEntrataId && id !== "comune") loadPrevValue(anno, mese, id, tipoEntrataId);
    else setPrevValue(null);
  };

  const handlePeriodChange = (newAnno: number, newMese: number) => {
    setAnno(newAnno);
    setMese(newMese);
    if (tipoEntrataId && intestatarioId !== "comune") loadPrevValue(newAnno, newMese, intestatarioId, tipoEntrataId);
  };

  const resolveValue = (): string | null => {
    const raw = valore.trim();
    if (!raw) return null;
    if (raw.startsWith("=")) {
      const result = evaluateFormula(raw, prevValue);
      return result !== null ? result.toString() : null;
    }
    const num = parseItalianNumber(raw);
    return isFinite(num) ? num.toString() : null;
  };

  const getPreview = (): string | null => {
    if (!valore.trim().startsWith("=")) return null;
    const result = evaluateFormula(valore.trim(), prevValue);
    return result !== null
      ? `= ${result.toLocaleString("it-IT", { minimumFractionDigits: 2 })} €`
      : "Formula non valida";
  };

  const handleSubmit = async () => {
    if (!isEdit && !tipoEntrataId) { setError("Seleziona un tipo di entrata"); return; }
    const resolved = resolveValue();
    if (resolved === null) { setError("Inserisci un valore valido"); return; }

    setSaving(true);
    setError("");

    const entrateToSave: { intestatarioId: string; tipoEntrataId: string; anno: number; mese: number; valore: string; note?: string }[] = [];
    const tipoId = isEdit ? entrata!.tipoEntrataId : tipoEntrataId;
    const noteValue = note.trim() || undefined;

    if (!isEdit && intestatarioId === "comune") {
      const valorePerInt = Math.round((parseFloat(resolved) / intestatari.length) * 100) / 100;
      for (const int of intestatari) {
        entrateToSave.push({ intestatarioId: int.id, tipoEntrataId: tipoId, anno, mese, valore: valorePerInt.toString(), note: noteValue });
      }
    } else {
      const intId = isEdit ? entrata!.intestatarioId : intestatarioId;
      entrateToSave.push({ intestatarioId: intId, tipoEntrataId: tipoId, anno: isEdit ? entrata!.anno : anno, mese: isEdit ? entrata!.mese : mese, valore: resolved, note: noteValue });
    }

    try {
      const res = await fetch("/api/entrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entrate: entrateToSave }),
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

  const preview = getPreview();
  const hasFormula = valore.trim().startsWith("=");

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth fullScreen={isMobile}>
      <DialogTitle>{isEdit ? "Modifica Entrata" : "Nuova Entrata"}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
            {/* Periodo */}
            {isEdit ? (
              <Box>
                <Typography variant="caption" color="text.secondary">Periodo</Typography>
                <Typography variant="body2">{MESI_LUNGHI[entrata!.mese - 1]} {entrata!.anno}</Typography>
              </Box>
            ) : (
              <MonthYearPicker anno={anno} mese={mese} onChange={handlePeriodChange} />
            )}

            {/* Intestatario */}
            {isEdit ? (
              <Box>
                <Typography variant="caption" color="text.secondary">Intestatario</Typography>
                <Typography variant="body2">{entrata!.intestatario.nome} {entrata!.intestatario.cognome}</Typography>
              </Box>
            ) : (
              <FormControl fullWidth size="small">
                <InputLabel>Intestatario</InputLabel>
                <Select
                  value={intestatarioId}
                  label="Intestatario"
                  onChange={(e) => handleIntestatarioChange(e.target.value)}
                >
                  {intestatari.map((int) => (
                    <MenuItem key={int.id} value={int.id}>
                      {int.nome} {int.cognome}
                    </MenuItem>
                  ))}
                  <MenuItem value="comune">
                    <em>Comune (diviso tra tutti)</em>
                  </MenuItem>
                </Select>
                {intestatarioId === "comune" && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                    Il valore viene diviso equamente tra tutti gli intestatari
                  </Typography>
                )}
              </FormControl>
            )}

            {/* Tipo entrata */}
            {isEdit ? (
              <Box>
                <Typography variant="caption" color="text.secondary">Tipo</Typography>
                <Box sx={{ mt: 0.5 }}>
                  <Chip label={entrata!.tipoEntrata.nome} size="small" variant="outlined" />
                </Box>
              </Box>
            ) : (
              <FormControl fullWidth size="small">
                <InputLabel>Tipo Entrata</InputLabel>
                <Select
                  value={tipoEntrataId}
                  label="Tipo Entrata"
                  onChange={(e) => handleTipoChange(e.target.value)}
                >
                  {tipiEntrata.map((tipo) => (
                    <MenuItem key={tipo.id} value={tipo.id}>
                      {tipo.nome}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {/* Valore */}
            <TextField
              label="Valore"
              size="small"
              fullWidth
              value={valore}
              onChange={(e) => setValore(e.target.value)}
              placeholder="0,00"
              autoFocus={isEdit}
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
              helperText={
                preview ??
                (prevValue !== null
                  ? `Prec: ${prevValue.toLocaleString("it-IT", { minimumFractionDigits: 2 })} €`
                  : "Usa =prev+100 per formule")
              }
              error={preview === "Formula non valida"}
            />

            {/* Note */}
            <TextField
              label="Note"
              size="small"
              fullWidth
              value={note}
              onChange={(e) => setNote(e.target.value)}
              multiline
              rows={2}
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Annulla
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={saving || loading}
        >
          {saving ? "Salvataggio..." : "Salva"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
