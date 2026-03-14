"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  TextField,
  InputAdornment,
  Card,
  CardContent,
  Stack,
  useMediaQuery,
  useTheme,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import UploadIcon from "@mui/icons-material/Upload";
import EditIcon from "@mui/icons-material/Edit";
import EntrataForm from "./EntrataForm";
import ImportEntrateDialog from "./ImportEntrateDialog";
import EmptyState from "@/components/ui/EmptyState";
import MonthYearPicker, { MESI_LUNGHI } from "@/components/ui/MonthYearPicker";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

interface EntrataWithRelations {
  id: string;
  intestatarioId: string;
  tipoEntrataId: string;
  anno: number;
  mese: number;
  valore: string;
  note: string | null;
  intestatario: { id: string; nome: string; cognome: string };
  tipoEntrata: { id: string; nome: string };
}

interface Intestatario {
  id: string;
  nome: string;
  cognome: string;
}

function getCurrentPeriod() {
  const now = new Date();
  let mese = now.getMonth();
  let anno = now.getFullYear();
  if (mese === 0) {
    mese = 12;
    anno -= 1;
  }
  return { anno, mese };
}

export default function EntrateTable() {
  const { anno: initAnno, mese: initMese } = getCurrentPeriod();
  const [anno, setAnno] = useState(initAnno);
  const [mese, setMese] = useState(initMese);
  const [entrate, setEntrate] = useState<EntrataWithRelations[]>([]);
  const [intestatari, setIntestatari] = useState<Intestatario[]>([]);
  const [filtroIntestatario, setFiltroIntestatario] = useState<string>("tutti");
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" as "success" | "error" });

  // Inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const fetchIntestatari = useCallback(async () => {
    try {
      const res = await fetch("/api/intestatari");
      if (res.ok) setIntestatari(await res.json());
    } catch { /* ignore */ }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ anno: anno.toString(), mese: mese.toString() });
      if (filtroIntestatario !== "tutti") params.set("intestatarioId", filtroIntestatario);
      const res = await fetch(`/api/entrate?${params}`);
      if (res.ok) setEntrate(await res.json());
    } catch {
      setSnackbar({ open: true, message: "Errore nel caricamento", severity: "error" });
    } finally {
      setLoading(false);
    }
  }, [anno, mese, filtroIntestatario]);

  useEffect(() => {
    fetchIntestatari();
  }, [fetchIntestatari]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/entrate/${deleteId}`, { method: "DELETE" });
      if (res.ok) {
        setSnackbar({ open: true, message: "Entrata eliminata", severity: "success" });
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

  const startEdit = (e: EntrataWithRelations) => {
    setEditingId(e.id);
    setEditValue(parseFloat(e.valore.toString()).toString());
    setTimeout(() => editInputRef.current?.focus(), 50);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const saveInlineEdit = async (e: EntrataWithRelations) => {
    const raw = editValue.trim();
    if (!raw) { cancelEdit(); return; }

    const num = parseFloat(raw);
    if (!isFinite(num)) {
      setSnackbar({ open: true, message: "Valore non valido", severity: "error" });
      return;
    }

    setEditSaving(true);
    try {
      const res = await fetch("/api/entrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entrate: [{
            intestatarioId: e.intestatarioId,
            tipoEntrataId: e.tipoEntrataId,
            anno: e.anno,
            mese: e.mese,
            valore: num.toString(),
          }],
        }),
      });
      if (res.ok) {
        setEditingId(null);
        setEditValue("");
        fetchData();
        setSnackbar({ open: true, message: "Entrata aggiornata", severity: "success" });
      } else {
        setSnackbar({ open: true, message: "Errore nel salvataggio", severity: "error" });
      }
    } catch {
      setSnackbar({ open: true, message: "Errore di connessione", severity: "error" });
    } finally {
      setEditSaving(false);
    }
  };

  const totale = entrate.reduce((sum, e) => sum + parseFloat(e.valore.toString()), 0);

  const renderEditField = (e: EntrataWithRelations) => (
    <TextField
      inputRef={editInputRef}
      size="small"
      value={editValue}
      onChange={(ev) => setEditValue(ev.target.value)}
      onKeyDown={(ev) => {
        if (ev.key === "Enter") saveInlineEdit(e);
        if (ev.key === "Escape") cancelEdit();
      }}
      onBlur={() => saveInlineEdit(e)}
      disabled={editSaving}
      slotProps={{
        input: {
          endAdornment: <InputAdornment position="end">€</InputAdornment>,
        },
      }}
      sx={{ width: isMobile ? "100%" : 150 }}
      autoFocus
    />
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
          Entrate
        </Typography>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
          <MonthYearPicker anno={anno} mese={mese} onChange={(a, m) => { setAnno(a); setMese(m); }} />
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
            onClick={() => setFormOpen(true)}
            size={isMobile ? "small" : "medium"}
          >
            {isMobile ? "Nuova" : "Nuova Entrata"}
          </Button>
        </Box>
      </Box>

      {/* Filtro intestatario */}
      {intestatari.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            Filtra per intestatario
          </Typography>
          <ToggleButtonGroup
            value={filtroIntestatario}
            exclusive
            onChange={(_, v) => { if (v !== null) setFiltroIntestatario(v); }}
            size="small"
          >
            <ToggleButton value="tutti">Tutti</ToggleButton>
            {intestatari.map((int) => (
              <ToggleButton key={int.id} value={int.id}>
                {int.nome} {int.cognome}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
      )}

      {entrate.length === 0 ? (
        <EmptyState message={`Nessuna entrata per ${MESI_LUNGHI[mese - 1]} ${anno}`} />
      ) : isMobile ? (
        /* ─── MOBILE: Card layout ─── */
        <Stack spacing={1.5}>
          {entrate.map((e) => {
            const isEditing = editingId === e.id;
            return (
              <Card key={e.id} variant="outlined">
                <CardContent sx={{ py: 1.5, px: 2, "&:last-child": { pb: 1.5 } }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body1" fontWeight={600} noWrap>
                        {e.intestatario.nome} {e.intestatario.cognome}
                      </Typography>
                      <Chip label={e.tipoEntrata.nome} size="small" variant="outlined" sx={{ mt: 0.5 }} />
                    </Box>
                    <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                      {isEditing ? renderEditField(e) : (
                        <Typography
                          variant="body1"
                          fontWeight={700}
                          fontFamily="monospace"
                          onClick={() => startEdit(e)}
                          sx={{ cursor: "pointer" }}
                        >
                          {parseFloat(e.valore.toString()).toLocaleString("it-IT", { minimumFractionDigits: 2 })} €
                        </Typography>
                      )}
                    </Box>
                  </Box>
                  {e.note && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                      {e.note}
                    </Typography>
                  )}
                  <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 0.5 }}>
                    <IconButton size="small" onClick={() => startEdit(e)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => setDeleteId(e.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </CardContent>
              </Card>
            );
          })}
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Typography fontWeight={700}>Totale</Typography>
              <Typography fontWeight={700} fontFamily="monospace" fontSize="1.1rem">
                {totale.toLocaleString("it-IT", { minimumFractionDigits: 2 })} €
              </Typography>
            </Box>
          </Paper>
        </Stack>
      ) : (
        /* ─── DESKTOP: Table layout ─── */
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Intestatario</strong></TableCell>
                <TableCell><strong>Tipo</strong></TableCell>
                <TableCell align="right"><strong>Valore</strong></TableCell>
                <TableCell><strong>Note</strong></TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {entrate.map((e) => {
                const isEditing = editingId === e.id;
                return (
                  <TableRow key={e.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {e.intestatario.nome} {e.intestatario.cognome}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={e.tipoEntrata.nome} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell align="right" sx={{ minWidth: 160 }}>
                      {isEditing ? renderEditField(e) : (
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 0.5 }}>
                          <Typography
                            component="span"
                            sx={{ fontWeight: 600, fontFamily: "monospace", fontSize: "0.95rem", cursor: "pointer" }}
                            onClick={() => startEdit(e)}
                          >
                            {parseFloat(e.valore.toString()).toLocaleString("it-IT", { minimumFractionDigits: 2 })} €
                          </Typography>
                          <Tooltip title="Modifica">
                            <IconButton size="small" onClick={() => startEdit(e)} sx={{ opacity: 0, "&:hover": { opacity: 1 }, ".MuiTableRow-root:hover &": { opacity: 0.5 } }}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {e.note || "—"}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ px: 1 }}>
                      <Tooltip title="Elimina">
                        <IconButton size="small" color="error" onClick={() => setDeleteId(e.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow>
                <TableCell colSpan={2} align="right">
                  <Typography fontWeight={700}>Totale</Typography>
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, fontFamily: "monospace", fontSize: "1rem" }}>
                  {totale.toLocaleString("it-IT", { minimumFractionDigits: 2 })} €
                </TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <EntrataForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={() => {
          fetchData();
          setSnackbar({ open: true, message: "Entrate salvate con successo", severity: "success" });
        }}
        defaultAnno={anno}
        defaultMese={mese}
      />

      <ConfirmDialog
        open={!!deleteId}
        title="Elimina Entrata"
        message="Sei sicuro di voler eliminare questa entrata? L'operazione non è reversibile."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        loading={deleteLoading}
      />

      <ImportEntrateDialog
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
