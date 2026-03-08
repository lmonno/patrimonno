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
} from "@mui/material";

interface IntestatarioFormProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  editData?: {
    id: string;
    nome: string;
    cognome: string;
    email: string;
    ruolo: string;
  } | null;
}

export default function IntestatarioForm({ open, onClose, onSave, editData }: IntestatarioFormProps) {
  const [form, setForm] = useState({
    nome: "",
    cognome: "",
    email: "",
    password: "",
    ruolo: "UTENTE",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        nome: editData?.nome ?? "",
        cognome: editData?.cognome ?? "",
        email: editData?.email ?? "",
        password: "",
        ruolo: editData?.ruolo ?? "UTENTE",
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
      const url = editData ? `/api/intestatari/${editData.id}` : "/api/intestatari";
      const method = editData ? "PUT" : "POST";

      const body: Record<string, string> = {
        nome: form.nome,
        cognome: form.cognome,
        email: form.email,
        ruolo: form.ruolo,
      };

      if (form.password) {
        body.password = form.password;
      } else if (!editData) {
        setError("La password è obbligatoria");
        setLoading(false);
        return;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
          {editData ? "Modifica Intestatario" : "Nuovo Intestatario"}
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
            label="Cognome"
            fullWidth
            required
            value={form.cognome}
            onChange={handleChange("cognome")}
            margin="normal"
          />
          <TextField
            label="Email"
            type="email"
            fullWidth
            required
            value={form.email}
            onChange={handleChange("email")}
            margin="normal"
          />
          <TextField
            label={editData ? "Nuova Password (lascia vuoto per non cambiare)" : "Password"}
            type="password"
            fullWidth
            required={!editData}
            value={form.password}
            onChange={handleChange("password")}
            margin="normal"
            inputProps={{ minLength: 8 }}
          />
          <TextField
            label="Ruolo"
            select
            fullWidth
            value={form.ruolo}
            onChange={handleChange("ruolo")}
            margin="normal"
          >
            <MenuItem value="UTENTE">Utente</MenuItem>
            <MenuItem value="ADMIN">Admin</MenuItem>
          </TextField>
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
