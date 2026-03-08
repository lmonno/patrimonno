"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
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
  Chip,
  CircularProgress,
  Alert,
  Snackbar,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import PosizioneForm from "./PosizioneForm";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EmptyState from "@/components/ui/EmptyState";

interface Posizione {
  id: string;
  nome: string;
  tipoContoId: string;
  iban: string | null;
  banca: string;
  note: string | null;
  tipoConto: { id: string; nome: string };
  intestatari: { user: { id: string; nome: string; cognome: string } }[];
}

export default function PosizioniTable() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.ruolo === "ADMIN";

  const [posizioni, setPosizioni] = useState<Posizione[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editData, setEditData] = useState<Posizione | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" as "success" | "error" });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/posizioni");
      if (res.ok) {
        setPosizioni(await res.json());
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
      const res = await fetch(`/api/posizioni/${deleteId}`, { method: "DELETE" });
      if (res.ok) {
        setSnackbar({ open: true, message: "Posizione eliminata", severity: "success" });
        fetchData();
      } else {
        setSnackbar({ open: true, message: "Errore durante l'eliminazione", severity: "error" });
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
          Posizioni
        </Typography>
        {isAdmin && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditData(null);
              setFormOpen(true);
            }}
          >
            Nuova Posizione
          </Button>
        )}
      </Box>

      {posizioni.length === 0 ? (
        <EmptyState message="Nessuna posizione trovata" />
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Nome</strong></TableCell>
                <TableCell><strong>Tipo</strong></TableCell>
                <TableCell><strong>Banca</strong></TableCell>
                <TableCell><strong>IBAN</strong></TableCell>
                <TableCell><strong>Intestatari</strong></TableCell>
                {isAdmin && <TableCell align="right"><strong>Azioni</strong></TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {posizioni.map((pos) => (
                <TableRow key={pos.id} hover>
                  <TableCell>{pos.nome}</TableCell>
                  <TableCell>
                    <Chip label={pos.tipoConto.nome} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>{pos.banca}</TableCell>
                  <TableCell sx={{ fontFamily: "monospace", fontSize: "0.85rem" }}>
                    {pos.iban || "—"}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                      {pos.intestatari.map((i) => (
                        <Chip
                          key={i.user.id}
                          label={`${i.user.nome} ${i.user.cognome}`}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  </TableCell>
                  {isAdmin && (
                    <TableCell align="right">
                      <Tooltip title="Modifica">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setEditData(pos);
                            setFormOpen(true);
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Elimina">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => setDeleteId(pos.id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <PosizioneForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={() => {
          fetchData();
          setSnackbar({ open: true, message: "Salvato con successo", severity: "success" });
        }}
        editData={editData}
      />

      <ConfirmDialog
        open={!!deleteId}
        title="Elimina Posizione"
        message="Sei sicuro di voler eliminare questa posizione?"
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
