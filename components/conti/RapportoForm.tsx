"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Alert,
} from "@mui/material";

interface RapportoFormProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  editData?: {
    id: string;
    nome: string;
    istituto: string;
    note: string | null;
  } | null;
}

export default function RapportoForm({ open, onClose, onSave, editData }: RapportoFormProps) {
  const [form, setForm] = useState({ nome: "", istituto: "", note: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        nome: editData?.nome ?? "",
        istituto: editData?.istituto ?? "",
        note: editData?.note ?? "",
      });
      setError("");
    }
  }, [open, editData]);

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [field]: e.target.value });
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const url = editData ? `/api/rapporti/${editData.id}` : "/api/rapporti";
      const method = editData ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: form.nome,
          istituto: form.istituto,
          note: form.note || null,
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
          {editData ? "Modifica Rapporto" : "Nuovo Rapporto"}
        </DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
              {error}
            </Alert>
          )}
          <TextField
            label="Nome rapporto"
            fullWidth
            required
            value={form.nome}
            onChange={handleChange("nome")}
            margin="normal"
            autoFocus
            placeholder="es. Fineco principale"
          />
          <TextField
            label="Istituto / Banca"
            fullWidth
            required
            value={form.istituto}
            onChange={handleChange("istituto")}
            margin="normal"
            placeholder="es. Fineco Bank"
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
