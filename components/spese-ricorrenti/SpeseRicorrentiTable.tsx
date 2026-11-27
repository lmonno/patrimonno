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
  Box,
  Typography,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Snackbar,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  Stack,
  Divider,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SpesaRicorrenteForm, { type SpesaRicorrenteData } from "./SpesaRicorrenteForm";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EmptyState from "@/components/ui/EmptyState";
import { formatItalianNumber } from "@/lib/formatNumbers";
import { MESI_LUNGHI } from "@/components/ui/MonthYearPicker";

const PERIODICITA_LABELS: Record<string, string> = {
  MENSILE: "Mensile",
  TRIMESTRALE: "Trimestrale",
  SEMESTRALE: "Semestrale",
  ANNUALE: "Annuale",
};

const DIVISORE_MESE: Record<string, number> = {
  MENSILE: 1,
  TRIMESTRALE: 3,
  SEMESTRALE: 6,
  ANNUALE: 12,
};

function calcolaImportoMensile(importo: string | number, periodicita: string): number {
  const val = typeof importo === "string" ? parseFloat(importo) : importo;
  const divisore = DIVISORE_MESE[periodicita] ?? 1;
  return Math.round((val / divisore) * 100) / 100;
}

export default function SpeseRicorrentiTable() {
  const [spese, setSpese] = useState<SpesaRicorrenteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingSpesa, setEditingSpesa] = useState<SpesaRicorrenteData | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" as "success" | "error" });

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/spese-ricorrenti");
      if (res.ok) setSpese(await res.json());
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
      const res = await fetch(`/api/spese-ricorrenti/${deleteId}`, { method: "DELETE" });
      if (res.ok) {
        setSnackbar({ open: true, message: "Spesa eliminata", severity: "success" });
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

  const totaleMensile = spese.reduce(
    (sum, s) => sum + calcolaImportoMensile(s.importo, s.periodicita),
    0
  );

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, flexWrap: "wrap", gap: 2 }}>
        <Typography variant="h5" fontWeight={600}>
          Spese Ricorrenti
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setFormOpen(true)}
          size={isMobile ? "small" : "medium"}
        >
          {isMobile ? "Nuova" : "Nuova Spesa"}
        </Button>
      </Box>

      {/* Riepilogo totale mensile */}
      {spese.length > 0 && (
        <Paper sx={{ p: 2, mb: 3, bgcolor: "primary.50" }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="subtitle1" fontWeight={600}>
              Totale mensile complessivo
            </Typography>
            <Typography variant="h5" fontWeight={700} fontFamily="monospace" color="primary.main">
              {formatItalianNumber(totaleMensile)} €
            </Typography>
          </Box>
        </Paper>
      )}

      {spese.length === 0 ? (
        <EmptyState message="Nessuna spesa ricorrente registrata" />
      ) : isMobile ? (
        /* ─── MOBILE: Card layout ─── */
        <Stack spacing={1.5}>
          {spese.map((s) => {
            const mensile = calcolaImportoMensile(s.importo, s.periodicita);
            return (
              <Card key={s.id} variant="outlined">
                <CardContent sx={{ py: 1.5, px: 2, "&:last-child": { pb: 1.5 } }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body1" fontWeight={600} noWrap>
                        {s.nome}
                      </Typography>
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
                        <Chip label={PERIODICITA_LABELS[s.periodicita]} size="small" variant="outlined" color="primary" />
                        {s.meseScadenza && (
                          <Chip
                            label={`Scad. ${MESI_LUNGHI[s.meseScadenza - 1]}${s.annoScadenza ? ` ${s.annoScadenza}` : ""}`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                        {s.pagatori.map((p) => `${p.intestatario.nome} ${p.intestatario.cognome}`).join(", ")}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                      <Typography variant="body1" fontWeight={700} fontFamily="monospace">
                        {formatItalianNumber(s.importo)} €
                      </Typography>
                      {s.periodicita !== "MENSILE" && (
                        <Typography variant="caption" color="text.secondary" fontFamily="monospace">
                          {formatItalianNumber(mensile)} €/mese
                        </Typography>
                      )}
                    </Box>
                  </Box>
                  {s.note && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                      {s.note}
                    </Typography>
                  )}
                  <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 0.5 }}>
                    <IconButton size="small" onClick={() => setEditingSpesa(s)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => setDeleteId(s.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      ) : (
        /* ─── DESKTOP: Table layout ─── */
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Nome</strong></TableCell>
                <TableCell><strong>Periodicità</strong></TableCell>
                <TableCell align="right"><strong>Importo</strong></TableCell>
                <TableCell align="right"><strong>€/mese</strong></TableCell>
                <TableCell><strong>Pagatori</strong></TableCell>
                <TableCell><strong>Scadenza</strong></TableCell>
                <TableCell><strong>Note</strong></TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {spese.map((s) => {
                const mensile = calcolaImportoMensile(s.importo, s.periodicita);
                return (
                  <TableRow key={s.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {s.nome}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={PERIODICITA_LABELS[s.periodicita]} size="small" variant="outlined" color="primary" />
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, fontFamily: "monospace", fontSize: "0.95rem" }}>
                      {formatItalianNumber(s.importo)} €
                    </TableCell>
                    <TableCell align="right" sx={{ fontFamily: "monospace", fontSize: "0.95rem", color: "text.secondary" }}>
                      {formatItalianNumber(mensile)} €
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                        {s.pagatori.map((p) => (
                          <Chip
                            key={p.intestatario.id}
                            label={`${p.intestatario.nome} ${p.intestatario.cognome}`}
                            size="small"
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    </TableCell>
                    <TableCell>
                      {s.meseScadenza
                        ? `${MESI_LUNGHI[s.meseScadenza - 1]}${s.annoScadenza ? ` ${s.annoScadenza}` : ""}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {s.note || "—"}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ px: 1 }}>
                      <Tooltip title="Modifica">
                        <IconButton size="small" onClick={() => setEditingSpesa(s)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Elimina">
                        <IconButton size="small" color="error" onClick={() => setDeleteId(s.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow>
                <TableCell colSpan={3} align="right">
                  <Typography fontWeight={700}>Totale mensile</Typography>
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, fontFamily: "monospace", fontSize: "1rem" }}>
                  {formatItalianNumber(totaleMensile)} €
                </TableCell>
                <TableCell colSpan={4} />
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <SpesaRicorrenteForm
        open={formOpen || !!editingSpesa}
        onClose={() => { setFormOpen(false); setEditingSpesa(null); }}
        onSave={() => {
          fetchData();
          setSnackbar({ open: true, message: editingSpesa ? "Spesa aggiornata" : "Spesa salvata", severity: "success" });
        }}
        spesa={editingSpesa ?? undefined}
      />

      <ConfirmDialog
        open={!!deleteId}
        title="Elimina Spesa Ricorrente"
        message="Sei sicuro di voler eliminare questa spesa? L'operazione non è reversibile."
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
