"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  MenuItem,
  Alert,
  FormControl,
  InputLabel,
  Select,
  Chip,
  Box,
  OutlinedInput,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";

interface TipoConto {
  id: string;
  nome: string;
}

interface Intestatario {
  id: string;
  nome: string;
  cognome: string;
}

interface PosizioneFormProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  editData?: {
    id: string;
    nome: string;
    tipoContoId: string;
    iban: string | null;
    banca: string;
    note: string | null;
    intestatari: { user: Intestatario }[];
  } | null;
}

export default function PosizioneForm({ open, onClose, onSave, editData }: PosizioneFormProps) {
  const [form, setForm] = useState({
    nome: "",
    tipoContoId: "",
    iban: "",
    banca: "",
    note: "",
    intestatariIds: [] as string[],
  });
  const [tipiConto, setTipiConto] = useState<TipoConto[]>([]);
  const [intestatari, setIntestatari] = useState<Intestatario[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetch("/api/tipi-conto").then((r) => r.json()).then(setTipiConto).catch(() => {});
      fetch("/api/intestatari").then((r) => r.json()).then(setIntestatari).catch(() => {});

      setForm({
        nome: editData?.nome ?? "",
        tipoContoId: editData?.tipoContoId ?? "",
        iban: editData?.iban ?? "",
        banca: editData?.banca ?? "",
        note: editData?.note ?? "",
        intestatariIds: editData?.intestatari?.map((i) => i.user.id) ?? [],
      });
      setError("");
    }
  }, [open, editData]);

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [field]: e.target.value });
    setError("");
  };

  const handleIntestatariChange = (e: SelectChangeEvent<string[]>) => {
    setForm({ ...form, intestatariIds: e.target.value as string[] });
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.intestatariIds.length === 0) {
      setError("Seleziona almeno un intestatario");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const url = editData ? `/api/posizioni/${editData.id}` : "/api/posizioni";
      const method = editData ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: form.nome,
          tipoContoId: form.tipoContoId,
          iban: form.iban || null,
          banca: form.banca,
          note: form.note || null,
          intestatariIds: form.intestatariIds,
        }),
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
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>
          {editData ? "Modifica Posizione" : "Nuova Posizione"}
        </DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
              {error}
            </Alert>
          )}
          <TextField
            label="Nome"
            fullWidth
            required
            value={form.nome}
            onChange={handleChange("nome")}
            margin="normal"
            autoFocus
          />
          <TextField
            label="Tipo Conto"
            select
            fullWidth
            required
            value={form.tipoContoId}
            onChange={handleChange("tipoContoId")}
            margin="normal"
          >
            {tipiConto.map((tc) => (
              <MenuItem key={tc.id} value={tc.id}>
                {tc.nome}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="IBAN (opzionale)"
            fullWidth
            value={form.iban}
            onChange={handleChange("iban")}
            margin="normal"
          />
          <TextField
            label="Banca / Istituto"
            fullWidth
            required
            value={form.banca}
            onChange={handleChange("banca")}
            margin="normal"
          />
          <TextField
            label="Note (opzionale)"
            fullWidth
            multiline
            rows={3}
            value={form.note}
            onChange={handleChange("note")}
            margin="normal"
          />
          <FormControl fullWidth margin="normal" required>
            <InputLabel>Intestatari</InputLabel>
            <Select
              multiple
              value={form.intestatariIds}
              onChange={handleIntestatariChange}
              input={<OutlinedInput label="Intestatari" />}
              renderValue={(selected) => (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {selected.map((id) => {
                    const int = intestatari.find((i) => i.id === id);
                    return (
                      <Chip
                        key={id}
                        label={int ? `${int.nome} ${int.cognome}` : id}
                        size="small"
                      />
                    );
                  })}
                </Box>
              )}
            >
              {intestatari.map((int) => (
                <MenuItem key={int.id} value={int.id}>
                  {int.nome} {int.cognome}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={loading}>
            Annulla
          </Button>
          <Button type="submit" variant="contained" disabled={loading}>
            Salva
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
