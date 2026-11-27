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
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  OutlinedInput,
  CircularProgress,
  InputAdornment,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { MESI_LUNGHI } from "@/components/ui/MonthYearPicker";
import { formatItalianNumber } from "@/lib/formatNumbers";

interface Intestatario {
  id: string;
  nome: string;
  cognome: string;
}

export interface SpesaRicorrenteData {
  id: string;
  nome: string;
  importo: string;
  periodicita: string;
  meseScadenza: number | null;
  annoScadenza: number | null;
  note: string | null;
  pagatori: {
    intestatario: { id: string; nome: string; cognome: string };
  }[];
}

interface SpesaRicorrenteFormProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  spesa?: SpesaRicorrenteData;
}

const PERIODICITA_OPTIONS = [
  { value: "MENSILE", label: "Mensile" },
  { value: "TRIMESTRALE", label: "Trimestrale" },
  { value: "SEMESTRALE", label: "Semestrale" },
  { value: "ANNUALE", label: "Annuale" },
];

export default function SpesaRicorrenteForm({ open, onClose, onSave, spesa }: SpesaRicorrenteFormProps) {
  const isEdit = !!spesa;

  const [nome, setNome] = useState("");
  const [importo, setImporto] = useState("");
  const [periodicita, setPeriodicita] = useState("MENSILE");
  const [meseScadenza, setMeseScadenza] = useState<number | "">("");
  const [annoScadenza, setAnnoScadenza] = useState<number | "">("");
  const [note, setNote] = useState("");
  const [pagatoriIds, setPagatoriIds] = useState<string[]>([]);
  const [intestatari, setIntestatari] = useState<Intestatario[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/intestatari");
      if (res.ok) setIntestatari(await res.json());
    } catch {
      setError("Errore nel caricamento dei dati");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setNome(spesa?.nome ?? "");
    setImporto(spesa ? formatItalianNumber(spesa.importo) : "");
    setPeriodicita(spesa?.periodicita ?? "MENSILE");
    setMeseScadenza(spesa?.meseScadenza ?? "");
    setAnnoScadenza(spesa?.annoScadenza ?? "");
    setNote(spesa?.note ?? "");
    setPagatoriIds(spesa?.pagatori.map((p) => p.intestatario.id) ?? []);
    setError("");
    loadData();
  }, [open, spesa, loadData]);

  const handleSubmit = async () => {
    if (!nome.trim()) { setError("Il nome è obbligatorio"); return; }
    if (!importo.trim()) { setError("L'importo è obbligatorio"); return; }
    if (pagatoriIds.length === 0) { setError("Seleziona almeno un pagatore"); return; }

    setSaving(true);
    setError("");

    const payload = {
      nome: nome.trim(),
      importo: importo.trim(),
      periodicita,
      meseScadenza: meseScadenza === "" ? null : meseScadenza,
      annoScadenza: annoScadenza === "" ? null : annoScadenza,
      note: note.trim() || undefined,
      pagatoriIds,
    };

    try {
      const url = isEdit ? `/api/spese-ricorrenti/${spesa!.id}` : "/api/spese-ricorrenti";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth fullScreen={isMobile}>
      <DialogTitle>{isEdit ? "Modifica Spesa Ricorrente" : "Nuova Spesa Ricorrente"}</DialogTitle>
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
            <TextField
              label="Nome"
              size="small"
              fullWidth
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              autoFocus
            />

            <TextField
              label="Importo"
              size="small"
              fullWidth
              value={importo}
              onChange={(e) => setImporto(e.target.value)}
              placeholder="0,00"
              slotProps={{
                input: {
                  endAdornment: <InputAdornment position="end">€</InputAdornment>,
                },
              }}
            />

            <FormControl fullWidth size="small">
              <InputLabel>Periodicità</InputLabel>
              <Select
                value={periodicita}
                label="Periodicità"
                onChange={(e) => setPeriodicita(e.target.value)}
              >
                {PERIODICITA_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel>Pagatori</InputLabel>
              <Select
                multiple
                value={pagatoriIds}
                onChange={(e) => setPagatoriIds(e.target.value as string[])}
                input={<OutlinedInput label="Pagatori" />}
                renderValue={(selected) =>
                  selected
                    .map((id) => {
                      const int = intestatari.find((i) => i.id === id);
                      return int ? `${int.nome} ${int.cognome}` : id;
                    })
                    .join(", ")
                }
              >
                {intestatari.map((int) => (
                  <MenuItem key={int.id} value={int.id}>
                    {int.nome} {int.cognome}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box sx={{ display: "flex", gap: 2 }}>
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>Mese scadenza</InputLabel>
                <Select
                  value={meseScadenza}
                  label="Mese scadenza"
                  onChange={(e) => setMeseScadenza(e.target.value === ("" as unknown) ? "" : Number(e.target.value))}
                >
                  <MenuItem value="">
                    <em>Nessuno</em>
                  </MenuItem>
                  {MESI_LUNGHI.map((m, i) => (
                    <MenuItem key={i + 1} value={i + 1}>
                      {m}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Anno scadenza"
                size="small"
                type="number"
                sx={{ flex: 1 }}
                value={annoScadenza}
                onChange={(e) => setAnnoScadenza(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </Box>

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
        <Button variant="contained" onClick={handleSubmit} disabled={saving || loading}>
          {saving ? "Salvataggio..." : "Salva"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
