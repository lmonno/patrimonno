"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Snackbar,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EmptyState from "@/components/ui/EmptyState";

interface Utente {
  id: string;
  nome: string;
  email: string;
  ruolo: "ADMIN" | "UTENTE";
  createdAt: string;
}

function NuovoUtenteForm({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  const [form, setForm] = useState({ nome: "", email: "", password: "", ruolo: "UTENTE" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ nome: "", email: "", password: "", ruolo: "UTENTE" });
      setError("");
    }
  }, [open]);

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [field]: e.target.value });
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/utenti", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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
        <DialogTitle>Nuovo Utente</DialogTitle>
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
            label="Email"
            type="email"
            fullWidth
            required
            value={form.email}
            onChange={handleChange("email")}
            margin="normal"
          />
          <TextField
            label="Password"
            type="password"
            fullWidth
            required
            value={form.password}
            onChange={handleChange("password")}
            margin="normal"
            helperText="Minimo 8 caratteri"
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

function CambiaRuoloForm({
  utente,
  onClose,
  onSave,
}: {
  utente: Utente | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [ruolo, setRuolo] = useState<"ADMIN" | "UTENTE">("UTENTE");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (utente) {
      setRuolo(utente.ruolo);
      setError("");
    }
  }, [utente]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!utente) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/utenti/${utente.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruolo }),
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
    <Dialog open={!!utente} onClose={onClose} maxWidth="xs" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>Modifica Ruolo</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
              {error}
            </Alert>
          )}
          <Typography variant="body2" sx={{ mb: 2 }}>
            Utente: <strong>{utente?.nome}</strong>
          </Typography>
          <TextField
            label="Ruolo"
            select
            fullWidth
            value={ruolo}
            onChange={(e) => setRuolo(e.target.value as "ADMIN" | "UTENTE")}
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

export default function UtentiTable() {
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editUtente, setEditUtente] = useState<Utente | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error",
  });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/utenti");
      if (res.ok) {
        setUtenti(await res.json());
      }
    } catch {
      setSnackbar({ open: true, message: "Errore nel caricamento", severity: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/admin/utenti/${deleteId}`, { method: "DELETE" });
      if (res.ok) {
        setSnackbar({ open: true, message: "Utente eliminato", severity: "success" });
        fetchData();
      } else {
        const data = await res.json();
        setSnackbar({ open: true, message: data.error || "Errore durante l'eliminazione", severity: "error" });
      }
    } catch {
      setSnackbar({ open: true, message: "Errore di connessione", severity: "error" });
    } finally {
      setDeleteLoading(false);
      setDeleteId(null);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h5" fontWeight={600}>
          Gestione Utenti
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setFormOpen(true)}>
          Nuovo Utente
        </Button>
      </Box>

      {utenti.length === 0 ? (
        <EmptyState message="Nessun utente trovato" />
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Nome</strong></TableCell>
                <TableCell><strong>Email</strong></TableCell>
                <TableCell><strong>Ruolo</strong></TableCell>
                <TableCell><strong>Creato il</strong></TableCell>
                <TableCell align="right"><strong>Azioni</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {utenti.map((u) => (
                <TableRow key={u.id} hover>
                  <TableCell>{u.nome}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    <Chip
                      label={u.ruolo}
                      size="small"
                      color={u.ruolo === "ADMIN" ? "warning" : "default"}
                    />
                  </TableCell>
                  <TableCell>
                    {new Date(u.createdAt).toLocaleDateString("it-IT")}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Modifica ruolo">
                      <IconButton size="small" onClick={() => setEditUtente(u)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Elimina">
                      <IconButton size="small" color="error" onClick={() => setDeleteId(u.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <NuovoUtenteForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={() => {
          fetchData();
          setSnackbar({ open: true, message: "Utente creato con successo", severity: "success" });
        }}
      />

      <CambiaRuoloForm
        utente={editUtente}
        onClose={() => setEditUtente(null)}
        onSave={() => {
          fetchData();
          setSnackbar({ open: true, message: "Ruolo aggiornato", severity: "success" });
        }}
      />

      <ConfirmDialog
        open={!!deleteId}
        title="Elimina Utente"
        message="Sei sicuro di voler eliminare questo utente?"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        loading={deleteLoading}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}
