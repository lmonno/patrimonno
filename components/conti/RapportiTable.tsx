"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Snackbar,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  FormControlLabel,
  Switch,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import ArchiveIcon from "@mui/icons-material/Archive";
import UnarchiveIcon from "@mui/icons-material/Unarchive";
import RapportoForm from "./RapportoForm";
import ContoForm from "./ContoForm";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EmptyState from "@/components/ui/EmptyState";

interface Intestatario {
  id: string;
  nome: string;
  cognome: string;
}

interface Conto {
  id: string;
  nome: string;
  tipoContoId: string;
  liquido: boolean;
  archiviato: boolean;
  note: string | null;
  rapportoId: string;
  tipoConto: { id: string; nome: string };
  intestatari: { intestatario: Intestatario }[];
}

interface Rapporto {
  id: string;
  nome: string;
  istituto: string;
  iban: string | null;
  note: string | null;
  archiviato: boolean;
  conti: Conto[];
}

export default function RapportiTable() {
  const [rapporti, setRapporti] = useState<Rapporto[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostraArchiviati, setMostraArchiviati] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" as "success" | "error" });

  // Rapporto form
  const [rapportoFormOpen, setRapportoFormOpen] = useState(false);
  const [editRapporto, setEditRapporto] = useState<Rapporto | null>(null);
  const [deleteRapportoId, setDeleteRapportoId] = useState<string | null>(null);
  const [deleteRapportoLoading, setDeleteRapportoLoading] = useState(false);

  // Conto form
  const [contoFormOpen, setContoFormOpen] = useState(false);
  const [editConto, setEditConto] = useState<Conto | null>(null);
  const [contoRapportoId, setContoRapportoId] = useState<string>("");
  const [deleteContoId, setDeleteContoId] = useState<string | null>(null);
  const [deleteContoLoading, setDeleteContoLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/rapporti");
      if (res.ok) {
        setRapporti(await res.json());
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

  const handleDeleteRapporto = async () => {
    if (!deleteRapportoId) return;
    setDeleteRapportoLoading(true);
    try {
      const res = await fetch(`/api/rapporti/${deleteRapportoId}`, { method: "DELETE" });
      if (res.ok) {
        setSnackbar({ open: true, message: "Rapporto eliminato", severity: "success" });
        fetchData();
      } else {
        setSnackbar({ open: true, message: "Errore durante l'eliminazione", severity: "error" });
      }
    } catch {
      setSnackbar({ open: true, message: "Errore di connessione", severity: "error" });
    } finally {
      setDeleteRapportoLoading(false);
      setDeleteRapportoId(null);
    }
  };

  const handleDeleteConto = async () => {
    if (!deleteContoId) return;
    setDeleteContoLoading(true);
    try {
      const res = await fetch(`/api/conti/${deleteContoId}`, { method: "DELETE" });
      if (res.ok) {
        setSnackbar({ open: true, message: "Conto eliminato", severity: "success" });
        fetchData();
      } else {
        setSnackbar({ open: true, message: "Errore durante l'eliminazione", severity: "error" });
      }
    } catch {
      setSnackbar({ open: true, message: "Errore di connessione", severity: "error" });
    } finally {
      setDeleteContoLoading(false);
      setDeleteContoId(null);
    }
  };

  const toggleArchiviatoRapporto = async (rapporto: Rapporto) => {
    try {
      const res = await fetch(`/api/rapporti/${rapporto.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archiviato: !rapporto.archiviato }),
      });
      if (res.ok) {
        setSnackbar({
          open: true,
          message: rapporto.archiviato ? "Rapporto ripristinato" : "Rapporto archiviato",
          severity: "success",
        });
        fetchData();
      } else {
        setSnackbar({ open: true, message: "Errore durante l'operazione", severity: "error" });
      }
    } catch {
      setSnackbar({ open: true, message: "Errore di connessione", severity: "error" });
    }
  };

  const toggleArchiviatoConto = async (conto: Conto) => {
    try {
      const res = await fetch(`/api/conti/${conto.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archiviato: !conto.archiviato }),
      });
      if (res.ok) {
        setSnackbar({
          open: true,
          message: conto.archiviato ? "Conto ripristinato" : "Conto archiviato",
          severity: "success",
        });
        fetchData();
      } else {
        setSnackbar({ open: true, message: "Errore durante l'operazione", severity: "error" });
      }
    } catch {
      setSnackbar({ open: true, message: "Errore di connessione", severity: "error" });
    }
  };

  // Filtra rapporti e conti in base al toggle
  const rapportiFiltrati = rapporti
    .filter((r) => mostraArchiviati || !r.archiviato)
    .map((r) => ({
      ...r,
      conti: r.conti.filter((c) => mostraArchiviati || !c.archiviato),
    }));

  const numArchiviati = rapporti.filter((r) => r.archiviato).length
    + rapporti.reduce((sum, r) => sum + r.conti.filter((c) => c.archiviato).length, 0);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, flexWrap: "wrap", gap: 1 }}>
        <Typography variant="h5" fontWeight={600}>
          Rapporti e Conti
        </Typography>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          {numArchiviati > 0 && (
            <FormControlLabel
              control={
                <Switch
                  checked={mostraArchiviati}
                  onChange={(e) => setMostraArchiviati(e.target.checked)}
                  size="small"
                />
              }
              label={
                <Typography variant="body2" color="text.secondary">
                  Archiviati ({numArchiviati})
                </Typography>
              }
              sx={{ mr: 1 }}
            />
          )}
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditRapporto(null);
              setRapportoFormOpen(true);
            }}
          >
            Nuovo Rapporto
          </Button>
        </Box>
      </Box>

      {rapportiFiltrati.length === 0 ? (
        <EmptyState message="Nessun rapporto trovato. Crea il primo rapporto per iniziare." />
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {rapportiFiltrati.map((rapporto) => (
            <Accordion
              key={rapporto.id}
              defaultExpanded={rapportiFiltrati.length === 1}
              sx={rapporto.archiviato ? { opacity: 0.6 } : undefined}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flex: 1, mr: 1 }}>
                  <AccountBalanceIcon color={rapporto.archiviato ? "disabled" : "primary"} fontSize="small" />
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Typography fontWeight={600}>{rapporto.nome}</Typography>
                      {rapporto.archiviato && (
                        <Chip label="Archiviato" size="small" color="default" variant="outlined" />
                      )}
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {rapporto.istituto}
                      {rapporto.iban && <> · <Box component="span" sx={{ fontFamily: "monospace" }}>{rapporto.iban}</Box></>}
                      {" · "}{rapporto.conti.length} {rapporto.conti.length === 1 ? "conto" : "conti"}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", gap: 0.5 }} onClick={(e) => e.stopPropagation()}>
                    {!rapporto.archiviato && (
                      <Tooltip title="Aggiungi conto">
                        <IconButton
                          component="div"
                          role="button"
                          tabIndex={0}
                          size="small"
                          color="primary"
                          onClick={() => {
                            setEditConto(null);
                            setContoRapportoId(rapporto.id);
                            setContoFormOpen(true);
                          }}
                        >
                          <AddIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title={rapporto.archiviato ? "Ripristina rapporto" : "Archivia rapporto"}>
                      <IconButton
                        size="small"
                        onClick={() => toggleArchiviatoRapporto(rapporto)}
                      >
                        {rapporto.archiviato ? <UnarchiveIcon fontSize="small" /> : <ArchiveIcon fontSize="small" />}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Modifica rapporto">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setEditRapporto(rapporto);
                          setRapportoFormOpen(true);
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Elimina rapporto">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => setDeleteRapportoId(rapporto.id)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0 }}>
                {rapporto.note && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontStyle: "italic" }}>
                    {rapporto.note}
                  </Typography>
                )}
                {rapporto.conti.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 1, textAlign: "center" }}>
                    Nessun conto. Usa il + per aggiungerne uno.
                  </Typography>
                ) : (
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell><strong>Nome conto</strong></TableCell>
                          <TableCell><strong>Tipo</strong></TableCell>
                          <TableCell><strong>Intestatari</strong></TableCell>
                          <TableCell align="right"><strong>Azioni</strong></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {rapporto.conti.map((conto) => (
                          <TableRow key={conto.id} hover sx={conto.archiviato ? { opacity: 0.6 } : undefined}>
                            <TableCell>
                              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                {conto.nome}
                                {!conto.liquido && (
                                  <Chip label="Non liquido" size="small" color="warning" variant="outlined" />
                                )}
                                {conto.archiviato && (
                                  <Chip label="Archiviato" size="small" color="default" variant="outlined" />
                                )}
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Chip label={conto.tipoConto.nome} size="small" variant="outlined" />
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                                {conto.intestatari.map((i) => (
                                  <Chip
                                    key={i.intestatario.id}
                                    label={`${i.intestatario.nome} ${i.intestatario.cognome}`}
                                    size="small"
                                    color="primary"
                                    variant="outlined"
                                  />
                                ))}
                              </Box>
                            </TableCell>
                            <TableCell align="right">
                              <Tooltip title={conto.archiviato ? "Ripristina" : "Archivia"}>
                                <IconButton
                                  size="small"
                                  onClick={() => toggleArchiviatoConto(conto)}
                                >
                                  {conto.archiviato ? <UnarchiveIcon fontSize="small" /> : <ArchiveIcon fontSize="small" />}
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Modifica">
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    setEditConto(conto);
                                    setContoRapportoId(conto.rapportoId);
                                    setContoFormOpen(true);
                                  }}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Elimina">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => setDeleteContoId(conto.id)}
                                >
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
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      )}

      <RapportoForm
        open={rapportoFormOpen}
        onClose={() => setRapportoFormOpen(false)}
        onSave={() => {
          fetchData();
          setSnackbar({ open: true, message: "Rapporto salvato con successo", severity: "success" });
        }}
        editData={editRapporto}
      />

      <ContoForm
        open={contoFormOpen}
        onClose={() => setContoFormOpen(false)}
        onSave={() => {
          fetchData();
          setSnackbar({ open: true, message: "Conto salvato con successo", severity: "success" });
        }}
        rapportoId={contoRapportoId}
        editData={editConto}
      />

      <ConfirmDialog
        open={!!deleteRapportoId}
        title="Elimina Rapporto"
        message="Sei sicuro di voler eliminare questo rapporto? Verranno eliminati anche tutti i conti associati."
        onConfirm={handleDeleteRapporto}
        onCancel={() => setDeleteRapportoId(null)}
        loading={deleteRapportoLoading}
      />

      <ConfirmDialog
        open={!!deleteContoId}
        title="Elimina Conto"
        message="Sei sicuro di voler eliminare questo conto?"
        onConfirm={handleDeleteConto}
        onCancel={() => setDeleteContoId(null)}
        loading={deleteContoLoading}
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
