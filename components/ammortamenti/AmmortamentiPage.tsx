"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Snackbar,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Collapse,
  Chip,
  Card,
  CardContent,
  Stack,
  Divider,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import UploadIcon from "@mui/icons-material/Upload";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import PianoForm from "./PianoForm";
import ImportAmmortamentoDialog from "./ImportAmmortamentoDialog";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EmptyState from "@/components/ui/EmptyState";
import { formatItalianNumber } from "@/lib/formatNumbers";

interface Rata {
  id: string;
  data: string;
  quotaCapitale: string;
  quotaInteressi: string;
  rataTotale: string;
  debitoResiduo: string;
  contributo: string;
}

interface Piano {
  id: string;
  nome: string;
  contoId: string;
  conto: {
    id: string;
    nome: string;
    rapporto: { id: string; nome: string; istituto: string };
  };
  rate: Rata[];
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function AmmortamentiPage() {
  const [piani, setPiani] = useState<Piano[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editPiano, setEditPiano] = useState<Piano | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" as "success" | "error" });

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/piani-ammortamento");
      if (res.ok) setPiani(await res.json());
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
      const res = await fetch(`/api/piani-ammortamento/${deleteId}`, { method: "DELETE" });
      if (res.ok) {
        setSnackbar({ open: true, message: "Piano eliminato", severity: "success" });
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

  const handleEdit = (piano: Piano) => {
    setEditPiano(piano);
    setFormOpen(true);
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const renderRateTable = (rate: Rata[]) => (
    <TableContainer component={Paper} variant="outlined" sx={{ mt: 1, mb: 2 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell><strong>Data</strong></TableCell>
            <TableCell align="right"><strong>Quota Capitale</strong></TableCell>
            <TableCell align="right"><strong>Quota Interessi</strong></TableCell>
            <TableCell align="right"><strong>Rata Totale</strong></TableCell>
            <TableCell align="right"><strong>Debito Residuo</strong></TableCell>
            <TableCell align="right"><strong>Contributo</strong></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rate.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{formatDate(r.data)}</TableCell>
              <TableCell align="right" sx={{ fontFamily: "monospace" }}>{formatItalianNumber(r.quotaCapitale)} €</TableCell>
              <TableCell align="right" sx={{ fontFamily: "monospace" }}>{formatItalianNumber(r.quotaInteressi)} €</TableCell>
              <TableCell align="right" sx={{ fontFamily: "monospace", fontWeight: 600 }}>{formatItalianNumber(r.rataTotale)} €</TableCell>
              <TableCell align="right" sx={{ fontFamily: "monospace" }}>{formatItalianNumber(r.debitoResiduo)} €</TableCell>
              <TableCell align="right" sx={{ fontFamily: "monospace" }}>{formatItalianNumber(r.contributo)} €</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );

  const renderRateCards = (rate: Rata[]) => (
    <Stack spacing={1} sx={{ mt: 1, mb: 2 }}>
      {rate.map((r) => (
        <Card key={r.id} variant="outlined">
          <CardContent sx={{ py: 1, px: 2, "&:last-child": { pb: 1 } }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              {formatDate(r.data)}
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.5, mt: 0.5 }}>
              <Typography variant="body2">Capitale: <strong>{formatItalianNumber(r.quotaCapitale)} €</strong></Typography>
              <Typography variant="body2">Interessi: <strong>{formatItalianNumber(r.quotaInteressi)} €</strong></Typography>
              <Typography variant="body2">Rata: <strong>{formatItalianNumber(r.rataTotale)} €</strong></Typography>
              <Typography variant="body2">Residuo: <strong>{formatItalianNumber(r.debitoResiduo)} €</strong></Typography>
              <Typography variant="body2">Contributo: <strong>{formatItalianNumber(r.contributo)} €</strong></Typography>
            </Box>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );

  return (
    <>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, flexWrap: "wrap", gap: 2 }}>
        <Typography variant="h5" fontWeight={600}>
          Piani di Ammortamento
        </Typography>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <Button
            variant="outlined"
            startIcon={<UploadIcon />}
            onClick={() => setImportDialogOpen(true)}
            size={isMobile ? "small" : "medium"}
          >
            Importa
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => { setEditPiano(null); setFormOpen(true); }}
            size={isMobile ? "small" : "medium"}
          >
            {isMobile ? "Nuovo" : "Nuovo Piano"}
          </Button>
        </Box>
      </Box>

      {piani.length === 0 ? (
        <EmptyState message="Nessun piano di ammortamento" />
      ) : isMobile ? (
        /* ─── MOBILE: Card layout ─── */
        <Stack spacing={1.5}>
          {piani.map((piano) => {
            const isExpanded = expandedId === piano.id;
            return (
              <Card key={piano.id} variant="outlined">
                <CardContent sx={{ py: 1.5, px: 2, "&:last-child": { pb: 1.5 } }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <Box sx={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => toggleExpand(piano.id)}>
                      <Typography variant="body1" fontWeight={600}>{piano.nome}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {piano.conto.rapporto.nome} · {piano.conto.nome}
                      </Typography>
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0 }}>
                      <IconButton size="small" onClick={() => toggleExpand(piano.id)}>
                        {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                      <IconButton size="small" onClick={() => handleEdit(piano)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => setDeleteId(piano.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                  <Box sx={{ display: "flex", gap: 0.5, mt: 1 }}>
                    <Chip label={`${piano.rate.length} rate`} size="small" variant="outlined" />
                    {piano.rate.length > 0 && (
                      <Chip
                        label={`Residuo: ${formatItalianNumber(piano.rate[piano.rate.length - 1].debitoResiduo)} €`}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    )}
                  </Box>
                  <Collapse in={isExpanded}>
                    <Divider sx={{ mt: 1.5 }} />
                    {renderRateCards(piano.rate)}
                  </Collapse>
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
                <TableCell sx={{ width: 40 }} />
                <TableCell><strong>Nome Piano</strong></TableCell>
                <TableCell><strong>Rapporto / Conto</strong></TableCell>
                <TableCell align="center"><strong>Rate</strong></TableCell>
                <TableCell align="right"><strong>Debito Residuo</strong></TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {piani.map((piano) => {
                const isExpanded = expandedId === piano.id;
                const lastRata = piano.rate.length > 0 ? piano.rate[piano.rate.length - 1] : null;

                return (
                  <TableRow key={piano.id} sx={{ "& > *": { borderBottom: isExpanded ? "none !important" : undefined } }} hover>
                    <TableCell>
                      <IconButton size="small" onClick={() => toggleExpand(piano.id)}>
                        {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        sx={{ cursor: "pointer" }}
                        onClick={() => toggleExpand(piano.id)}
                      >
                        {piano.nome}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{piano.conto.rapporto.nome}</Typography>
                      <Typography variant="caption" color="text.secondary">{piano.conto.nome}</Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip label={piano.rate.length} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell align="right" sx={{ fontFamily: "monospace", fontWeight: 600 }}>
                      {lastRata ? `${formatItalianNumber(lastRata.debitoResiduo)} €` : "—"}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Modifica">
                        <IconButton size="small" onClick={() => handleEdit(piano)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Elimina">
                        <IconButton size="small" color="error" onClick={() => setDeleteId(piano.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Expanded rate details rendered outside table rows for proper layout */}
          {piani.map((piano) => (
            <Collapse key={piano.id} in={expandedId === piano.id}>
              <Box sx={{ px: 2, pb: 1 }}>
                <Typography variant="subtitle2" fontWeight={600} sx={{ mt: 1, mb: 0.5 }}>
                  Dettaglio rate — {piano.nome}
                </Typography>
                {renderRateTable(piano.rate)}
              </Box>
            </Collapse>
          ))}
        </TableContainer>
      )}

      <PianoForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditPiano(null); }}
        onSave={() => {
          fetchData();
          setSnackbar({ open: true, message: editPiano ? "Piano aggiornato" : "Piano creato con successo", severity: "success" });
        }}
        editPiano={editPiano ? {
          id: editPiano.id,
          nome: editPiano.nome,
          contoId: editPiano.contoId,
          rate: editPiano.rate.map((r) => ({
            data: r.data,
            quotaCapitale: r.quotaCapitale.toString(),
            quotaInteressi: r.quotaInteressi.toString(),
            rataTotale: r.rataTotale.toString(),
            debitoResiduo: r.debitoResiduo.toString(),
            contributo: r.contributo.toString(),
          })),
        } : null}
      />

      <ConfirmDialog
        open={!!deleteId}
        title="Elimina Piano"
        message="Sei sicuro di voler eliminare questo piano di ammortamento? Tutte le rate associate verranno eliminate. L'operazione non è reversibile."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        loading={deleteLoading}
      />

      <ImportAmmortamentoDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        onImportSuccess={(message, severity) => {
          setSnackbar({ open: true, message, severity });
          fetchData();
        }}
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
