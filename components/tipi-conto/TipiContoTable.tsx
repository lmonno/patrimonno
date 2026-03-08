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
  CircularProgress,
  Alert,
  Snackbar,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import TipoContoForm from "./TipoContoForm";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EmptyState from "@/components/ui/EmptyState";

interface TipoConto {
  id: string;
  nome: string;
}

export default function TipiContoTable() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.ruolo === "ADMIN";

  const [tipiConto, setTipiConto] = useState<TipoConto[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editData, setEditData] = useState<TipoConto | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" as "success" | "error" });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/tipi-conto");
      if (res.ok) {
        setTipiConto(await res.json());
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
      const res = await fetch(`/api/tipi-conto/${deleteId}`, { method: "DELETE" });
      if (res.ok) {
        setSnackbar({ open: true, message: "Tipo conto eliminato", severity: "success" });
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
          Tipi Conto
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
            Nuovo Tipo
          </Button>
        )}
      </Box>

      {tipiConto.length === 0 ? (
        <EmptyState message="Nessun tipo conto trovato" />
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Nome</strong></TableCell>
                {isAdmin && <TableCell align="right"><strong>Azioni</strong></TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {tipiConto.map((tc) => (
                <TableRow key={tc.id} hover>
                  <TableCell>{tc.nome}</TableCell>
                  {isAdmin && (
                    <TableCell align="right">
                      <Tooltip title="Modifica">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setEditData(tc);
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
                          onClick={() => setDeleteId(tc.id)}
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

      <TipoContoForm
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
        title="Elimina Tipo Conto"
        message="Sei sicuro di voler eliminare questo tipo conto?"
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
