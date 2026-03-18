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
  Divider,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import UploadIcon from "@mui/icons-material/Upload";
import DownloadIcon from "@mui/icons-material/Download";
import EditIcon from "@mui/icons-material/Edit";
import FunctionsIcon from "@mui/icons-material/Functions";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import SaldoForm from "./SaldoForm";
import ImportDialog from "./ImportDialog";
import EmptyState from "@/components/ui/EmptyState";
import MonthYearPicker, { MESI_LUNGHI } from "@/components/ui/MonthYearPicker";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

interface SaldoWithConto {
  id: string;
  contoId: string;
  anno: number;
  mese: number;
  valore: string;
  formula?: string | null;
  conto: {
    id: string;
    nome: string;
    tipoConto: { id: string; nome: string };
    rapporto: { id: string; nome: string; istituto: string; iban: string | null };
    intestatari: { intestatario: { id: string; nome: string; cognome: string } }[];
  };
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

function evaluateFormula(input: string, prev: number | null): number | null {
  if (!input.startsWith("=")) return null;
  const expr = input.slice(1).trim();
  const prevValue = prev ?? 0;
  try {
    const sanitized = expr.replace(/prev/gi, prevValue.toString());
    if (!/^[\d\s+\-*/().]+$/.test(sanitized)) return null;
    const result = new Function(`return (${sanitized})`)();
    if (typeof result !== "number" || !isFinite(result)) return null;
    return Math.round(result * 100) / 100;
  } catch {
    return null;
  }
}

// ─── Sortable Table Row ───
function SortableTableRow({
  saldo,
  reordering,
  children,
}: {
  saldo: SaldoWithConto;
  reordering: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: saldo.contoId,
    disabled: !reordering,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <TableRow ref={setNodeRef} style={style} hover={!reordering}>
      {reordering && (
        <TableCell sx={{ px: 0.5, width: 40, cursor: "grab" }} {...attributes} {...listeners}>
          <DragIndicatorIcon color="action" />
        </TableCell>
      )}
      {children}
    </TableRow>
  );
}

// ─── Sortable Card ───
function SortableCard({
  saldo,
  reordering,
  children,
}: {
  saldo: SaldoWithConto;
  reordering: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: saldo.contoId,
    disabled: !reordering,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <Card ref={setNodeRef} style={style} variant="outlined">
      <CardContent sx={{ py: 1.5, px: 2, "&:last-child": { pb: 1.5 } }}>
        {reordering && (
          <Box
            sx={{ display: "flex", justifyContent: "center", mb: 0.5, cursor: "grab", touchAction: "none" }}
            {...attributes}
            {...listeners}
          >
            <DragIndicatorIcon color="action" />
          </Box>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

export default function SaldiTable() {
  const { anno: initAnno, mese: initMese } = getCurrentPeriod();
  const [anno, setAnno] = useState(initAnno);
  const [mese, setMese] = useState(initMese);
  const [saldi, setSaldi] = useState<SaldoWithConto[]>([]);
  const [prevSaldi, setPrevSaldi] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" as "success" | "error" });

  // Inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Drag and drop
  const [reordering, setReordering] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 8 } });
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } });
  const keyboardSensor = useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates });
  const sensors = useSensors(pointerSensor, touchSensor, keyboardSensor);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [saldiRes, prevRes] = await Promise.all([
        fetch(`/api/saldi?anno=${anno}&mese=${mese}`),
        fetch(`/api/saldi/previous?anno=${anno}&mese=${mese}`),
      ]);
      if (saldiRes.ok) setSaldi(await saldiRes.json());
      if (prevRes.ok) setPrevSaldi(await prevRes.json());
    } catch {
      setSnackbar({ open: true, message: "Errore nel caricamento", severity: "error" });
    } finally {
      setLoading(false);
    }
  }, [anno, mese]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/saldi/${deleteId}`, { method: "DELETE" });
      if (res.ok) {
        setSnackbar({ open: true, message: "Saldo eliminato", severity: "success" });
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

  const startEdit = (s: SaldoWithConto) => {
    if (reordering) return;
    setEditingId(s.id);
    setEditValue(s.formula ?? parseFloat(s.valore.toString()).toString());
    setTimeout(() => editInputRef.current?.focus(), 50);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const saveInlineEdit = async (s: SaldoWithConto) => {
    const raw = editValue.trim();
    if (!raw) {
      cancelEdit();
      return;
    }

    let resolved: string;
    if (raw.startsWith("=")) {
      const prev = prevSaldi[s.contoId] ? parseFloat(prevSaldi[s.contoId]) : null;
      const result = evaluateFormula(raw, prev);
      if (result === null) {
        setSnackbar({ open: true, message: "Formula non valida", severity: "error" });
        return;
      }
      resolved = result.toString();
    } else {
      const num = parseFloat(raw);
      if (!isFinite(num)) {
        setSnackbar({ open: true, message: "Valore non valido", severity: "error" });
        return;
      }
      resolved = num.toString();
    }

    setEditSaving(true);
    try {
      const res = await fetch("/api/saldi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saldi: [{
            contoId: s.contoId,
            anno: s.anno,
            mese: s.mese,
            valore: resolved,
            formula: raw.startsWith("=") ? raw : undefined,
          }],
        }),
      });
      if (res.ok) {
        setEditingId(null);
        setEditValue("");
        fetchData();
        setSnackbar({ open: true, message: "Saldo aggiornato", severity: "success" });
      } else {
        setSnackbar({ open: true, message: "Errore nel salvataggio", severity: "error" });
      }
    } catch {
      setSnackbar({ open: true, message: "Errore di connessione", severity: "error" });
    } finally {
      setEditSaving(false);
    }
  };

  // ─── Drag handlers ───
  const contoIds = saldi.map((s) => s.contoId);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = contoIds.indexOf(active.id as string);
    const newIndex = contoIds.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;

    const newSaldi = arrayMove(saldi, oldIndex, newIndex);
    setSaldi(newSaldi);

    const ordine = newSaldi.map((s, i) => ({ id: s.contoId, ordine: i + 1 }));

    try {
      const res = await fetch("/api/conti/ordine", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordine }),
      });
      if (!res.ok) {
        setSaldi(saldi);
        setSnackbar({ open: true, message: "Errore nel salvataggio dell'ordine", severity: "error" });
      }
    } catch {
      setSaldi(saldi);
      setSnackbar({ open: true, message: "Errore di connessione", severity: "error" });
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/saldi/template?daAnno=${anno}&daMese=${mese}&aAnno=${anno}&aMese=${mese}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `saldi_${anno}_${String(mese).padStart(2, "0")}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setSnackbar({ open: true, message: "Errore nel download", severity: "error" });
    } finally {
      setDownloading(false);
    }
  };

  const totale = saldi.reduce((sum, s) => sum + parseFloat(s.valore.toString()), 0);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const activeSaldo = activeDragId ? saldi.find((s) => s.contoId === activeDragId) : null;

  const renderEditField = (s: SaldoWithConto) => {
    const editPreview = editValue.trim().startsWith("=")
      ? (() => {
          const prev = prevSaldi[s.contoId] ? parseFloat(prevSaldi[s.contoId]) : null;
          const result = evaluateFormula(editValue.trim(), prev);
          return result !== null
            ? `= ${result.toLocaleString("it-IT", { minimumFractionDigits: 2 })} €`
            : "Formula non valida";
        })()
      : null;

    return (
      <TextField
        inputRef={editInputRef}
        size="small"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") saveInlineEdit(s);
          if (e.key === "Escape") cancelEdit();
        }}
        onBlur={() => saveInlineEdit(s)}
        disabled={editSaving}
        helperText={editPreview}
        error={editPreview === "Formula non valida"}
        slotProps={{
          input: {
            startAdornment: editValue.trim().startsWith("=") ? (
              <InputAdornment position="start">
                <FunctionsIcon fontSize="small" color="primary" />
              </InputAdornment>
            ) : undefined,
            endAdornment: !editPreview ? (
              <InputAdornment position="end">€</InputAdornment>
            ) : undefined,
          },
        }}
        sx={{ width: isMobile ? "100%" : 180 }}
        autoFocus
      />
    );
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
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, flexWrap: "wrap", gap: 2 }}>
        <Typography variant="h5" fontWeight={600}>
          Saldi
        </Typography>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
          <MonthYearPicker anno={anno} mese={mese} onChange={(a, m) => { setAnno(a); setMese(m); }} />
          {saldi.length > 1 && (
            <Button
              variant={reordering ? "contained" : "outlined"}
              startIcon={<SwapVertIcon />}
              onClick={() => setReordering(!reordering)}
              size={isMobile ? "small" : "medium"}
              color={reordering ? "warning" : "inherit"}
            >
              {reordering ? "Fine" : "Riordina"}
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleDownload}
            disabled={downloading}
            size={isMobile ? "small" : "medium"}
          >
            {isMobile ? "Scarica" : "Scarica Excel"}
          </Button>
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
            {isMobile ? "Nuovo" : "Inserisci Saldi"}
          </Button>
        </Box>
      </Box>

      {saldi.length === 0 ? (
        <EmptyState message={`Nessun saldo per ${MESI_LUNGHI[mese - 1]} ${anno}`} />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={contoIds} strategy={verticalListSortingStrategy}>
            {isMobile ? (
              /* ─── MOBILE: Card layout ─── */
              <Stack spacing={1.5}>
                {saldi.map((s) => {
                  const isEditing = editingId === s.id;
                  return (
                    <SortableCard key={s.contoId} saldo={s} reordering={reordering}>
                      {/* Riga principale: nome conto + saldo */}
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body1" fontWeight={600} noWrap>
                            {s.conto.nome}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {s.conto.rapporto.nome} · {s.conto.rapporto.istituto}
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                          {isEditing ? (
                            renderEditField(s)
                          ) : (
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                              {s.formula && (
                                <FunctionsIcon fontSize="small" color="primary" sx={{ opacity: 0.7 }} />
                              )}
                              <Typography
                                variant="body1"
                                fontWeight={700}
                                fontFamily="monospace"
                                onClick={() => startEdit(s)}
                                sx={{ cursor: reordering ? "default" : "pointer" }}
                              >
                                {parseFloat(s.valore.toString()).toLocaleString("it-IT", { minimumFractionDigits: 2 })} €
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      </Box>

                      {/* Tags: tipo + intestatari + azioni */}
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 1 }}>
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                          <Chip label={s.conto.tipoConto.nome} size="small" variant="outlined" />
                          {s.conto.intestatari.map((i) => (
                            <Chip
                              key={i.intestatario.id}
                              label={`${i.intestatario.nome} ${i.intestatario.cognome[0]}.`}
                              size="small"
                              color="primary"
                              variant="outlined"
                            />
                          ))}
                        </Box>
                        {!reordering && (
                          <Box sx={{ display: "flex", gap: 0 }}>
                            <IconButton size="small" onClick={() => startEdit(s)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" color="error" onClick={() => setDeleteId(s.id)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        )}
                      </Box>
                    </SortableCard>
                  );
                })}

                {/* Totale mobile */}
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
                      {reordering && <TableCell sx={{ width: 40 }} />}
                      <TableCell><strong>Rapporto / Istituto</strong></TableCell>
                      <TableCell><strong>Conto</strong></TableCell>
                      <TableCell><strong>Tipo</strong></TableCell>
                      <TableCell><strong>Intestatari</strong></TableCell>
                      <TableCell align="right"><strong>Saldo</strong></TableCell>
                      {!reordering && <TableCell />}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {saldi.map((s) => {
                      const isEditing = editingId === s.id;

                      return (
                        <SortableTableRow key={s.contoId} saldo={s} reordering={reordering}>
                          <TableCell>
                            <Typography variant="body2">{s.conto.rapporto.nome}</Typography>
                            <Typography variant="caption" color="text.secondary">{s.conto.rapporto.istituto}</Typography>
                          </TableCell>
                          <TableCell>{s.conto.nome}</TableCell>
                          <TableCell>
                            <Chip label={s.conto.tipoConto.nome} size="small" variant="outlined" />
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                              {s.conto.intestatari.map((i) => (
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
                          <TableCell align="right" sx={{ minWidth: 200 }}>
                            {isEditing ? (
                              renderEditField(s)
                            ) : (
                              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 0.5 }}>
                                {s.formula && (
                                  <Tooltip title={`Formula: ${s.formula}`} arrow>
                                    <FunctionsIcon fontSize="small" color="primary" sx={{ opacity: 0.7, cursor: "default" }} />
                                  </Tooltip>
                                )}
                                <Typography
                                  component="span"
                                  sx={{ fontWeight: 600, fontFamily: "monospace", fontSize: "0.95rem", cursor: reordering ? "default" : "pointer" }}
                                  onClick={() => startEdit(s)}
                                >
                                  {parseFloat(s.valore.toString()).toLocaleString("it-IT", { minimumFractionDigits: 2 })} €
                                </Typography>
                                {!reordering && (
                                  <Tooltip title="Modifica saldo">
                                    <IconButton size="small" onClick={() => startEdit(s)} sx={{ opacity: 0, "&:hover": { opacity: 1 }, ".MuiTableRow-root:hover &": { opacity: 0.5 } }}>
                                      <EditIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}
                              </Box>
                            )}
                          </TableCell>
                          {!reordering && (
                            <TableCell align="right" sx={{ px: 1 }}>
                              <Tooltip title="Elimina saldo">
                                <IconButton size="small" color="error" onClick={() => setDeleteId(s.id)}>
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          )}
                        </SortableTableRow>
                      );
                    })}
                    <TableRow>
                      {reordering && <TableCell />}
                      <TableCell colSpan={4} align="right">
                        <Typography fontWeight={700}>Totale</Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontFamily: "monospace", fontSize: "1rem" }}>
                        {totale.toLocaleString("it-IT", { minimumFractionDigits: 2 })} €
                      </TableCell>
                      {!reordering && <TableCell />}
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </SortableContext>

          <DragOverlay>
            {activeSaldo && (
              <Paper elevation={8} sx={{ p: 2, opacity: 0.9 }}>
                <Typography fontWeight={600}>{activeSaldo.conto.nome}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {activeSaldo.conto.rapporto.nome} · {activeSaldo.conto.rapporto.istituto}
                </Typography>
              </Paper>
            )}
          </DragOverlay>
        </DndContext>
      )}

      <SaldoForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={() => {
          fetchData();
          setSnackbar({ open: true, message: "Saldi salvati con successo", severity: "success" });
        }}
        defaultAnno={anno}
        defaultMese={mese}
      />

      <ConfirmDialog
        open={!!deleteId}
        title="Elimina Saldo"
        message="Sei sicuro di voler eliminare questo saldo? L'operazione non è reversibile."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        loading={deleteLoading}
      />

      <ImportDialog
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
