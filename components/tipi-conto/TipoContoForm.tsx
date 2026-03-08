"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
} from "@mui/material";

interface TipoContoFormProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  editData?: { id: string; nome: string } | null;
}

export default function TipoContoForm({ open, onClose, onSave, editData }: TipoContoFormProps) {
  const [nome, setNome] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setNome(editData?.nome ?? "");
      setError("");
    }
  }, [open, editData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      setError("Il nome è obbligatorio");
      return;
    }

    setLoading(true);
    try {
      const url = editData ? `/api/tipi-conto/${editData.id}` : "/api/tipi-conto";
      const method = editData ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: nome.trim() }),
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
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>{editData ? "Modifica Tipo Conto" : "Nuovo Tipo Conto"}</DialogTitle>
        <DialogContent>
          <TextField
            label="Nome"
            fullWidth
            required
            value={nome}
            onChange={(e) => {
              setNome(e.target.value);
              setError("");
            }}
            error={!!error}
            helperText={error}
            margin="normal"
            autoFocus
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
