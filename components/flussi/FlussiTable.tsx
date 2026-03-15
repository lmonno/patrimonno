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
  useMediaQuery,
  useTheme,
  TextField,
  MenuItem,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import UploadIcon from "@mui/icons-material/Upload";
import FlussoForm from "./FlussoForm";
import ImportFlussiDialog from "./ImportFlussiDialog";
import EmptyState from "@/components/ui/EmptyState";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

interface FlussoWithRelations {
  id: string;
  data: string;
  importo: string;
  descrizione: string;
  categoriaId: string;
  intestatarioId: string | null;
  categoria: { id: string; nome: string };
  intestatario: { id: string; nome: string; cognome: string } | null;
}

interface Intestatario {
  id: string;
  nome: string;
  cognome: string;
}

export default function FlussiTable() {
  const now = new Date();
  const [anno, setAnno] = useState(now.getFullYear());
  const [flussi, setFlussi] = useState<FlussoWithRelations[]>([]);
  const [intestatari, setIntestatari] = useState<Intestatario[]>([]);
  const [filtroIntestatario, setFiltroIntestatario] = useState<string>("tutti");
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editData, setEditData] = useState<{
    id: string;
    data: string;
    importo: string;
    descrizione: string;
    categoriaId: string;
    categoriaNome: string;
    intestatarioId: string | null;
  } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" as "success" | "error" });

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
      const params = new URLSearchParams({ anno: anno.toString() });
      if (filtroIntestatario !== "tutti") params.set("intestatarioId", filtroIntestatario);
      const res = await fetch(`/api/flussi-straordinari?${params}`);
      if (res.ok) setFlussi(await res.json());
    } catch {
      setSnackbar({ open: true, message: "Errore nel caricamento", severity: "error" });
    } finally {
      setLoading(false);
    }
  }, [anno, filtroIntestatario]);

  useEffect(() => { fetchIntestatari(); }, [fetchIntestatari]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/flussi-straordinari/${deleteId}`, { method: "DELETE" });
      if (res.ok) {
        setSnackbar({ open: true, message: "Flusso eliminato", severity: "success" });
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

  const handleEdit = (f: FlussoWithRelations) => {
    const d = new Date(f.data);
    setEditData({
      id: f.id,
      data: d.toISOString().split("T")[0],
      importo: parseFloat(f.importo.toString()).toString(),
      descrizione: f.descrizione,
      categoriaId: f.categoriaId,
      categoriaNome: f.categoria.nome,
      intestatarioId: f.intestatarioId,
    });
    setFormOpen(true);
  };

  const formatData = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const formatImporto = (val: string | number) => {
    const num = parseFloat(val.toString());
    const formatted = Math.abs(num).toLocaleString("it-IT", { minimumFractionDigits: 2 });
    return num >= 0 ? `+${formatted} €` : `-${formatted} €`;
  };

  const totale = flussi.reduce((sum, f) => sum + parseFloat(f.importo.toString()), 0);

  // Genera lista anni disponibili (ultimi 10 anni)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i);

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
          Flussi Straordinari
        </Typography>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
          <TextField
            select
            size="small"
            value={anno}
            onChange={(e) => setAnno(parseInt(e.target.value))}
            sx={{ minWidth: 100 }}
          >
            {years.map((y) => (
              <MenuItem key={y} value={y}>{y}</MenuItem>
            ))}
          </TextField>
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
            onClick={() => { setEditData(null); setFormOpen(true); }}
            size={isMobile ? "small" : "medium"}
          >
            {isMobile ? "Nuovo" : "Nuovo Flusso"}
          </Button>
        </Box>
      </Box>

      {/* Filtro intestatario */}
      {intestatari.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            Filtra per pagante
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            <Chip
              label="Tutti"
              color={filtroIntestatario === "tutti" ? "primary" : "default"}
              variant={filtroIntestatario === "tutti" ? "filled" : "outlined"}
              onClick={() => setFiltroIntestatario("tutti")}
            />
            <Chip
              label="Comune"
              color={filtroIntestatario === "comune" ? "primary" : "default"}
              variant={filtroIntestatario === "comune" ? "filled" : "outlined"}
              onClick={() => setFiltroIntestatario("comune")}
            />
            {intestatari.map((int) => (
              <Chip
                key={int.id}
                label={`${int.nome} ${int.cognome}`}
                color={filtroIntestatario === int.id ? "primary" : "default"}
                variant={filtroIntestatario === int.id ? "filled" : "outlined"}
                onClick={() => setFiltroIntestatario(int.id)}
              />
            ))}
          </Box>
        </Box>
      )}

      {flussi.length === 0 ? (
        <EmptyState message={`Nessun flusso straordinario per ${anno}`} />
      ) : isMobile ? (
        /* ─── MOBILE: Card layout ─── */
        <Stack spacing={1.5}>
          {flussi.map((f) => {
            const importo = parseFloat(f.importo.toString());
            return (
              <Card key={f.id} variant="outlined">
                <CardContent sx={{ py: 1.5, px: 2, "&:last-child": { pb: 1.5 } }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body1" fontWeight={600} noWrap>
                        {f.descrizione}
                      </Typography>
                      <Box sx={{ display: "flex", gap: 0.5, mt: 0.5, flexWrap: "wrap" }}>
                        <Chip label={f.categoria.nome} size="small" variant="outlined" />
                        <Chip
                          label={f.intestatario ? `${f.intestatario.nome} ${f.intestatario.cognome}` : "Comune"}
                          size="small"
                          variant="outlined"
                          color={f.intestatario ? "default" : "primary"}
                        />
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                        {formatData(f.data)}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                      <Typography
                        variant="body1"
                        fontWeight={700}
                        fontFamily="monospace"
                        color={importo >= 0 ? "success.main" : "error.main"}
                      >
                        {formatImporto(f.importo)}
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 0.5 }}>
                    <IconButton size="small" onClick={() => handleEdit(f)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => setDeleteId(f.id)}>
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
              <Typography
                fontWeight={700}
                fontFamily="monospace"
                fontSize="1.1rem"
                color={totale >= 0 ? "success.main" : "error.main"}
              >
                {formatImporto(totale)}
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
                <TableCell><strong>Data</strong></TableCell>
                <TableCell><strong>Descrizione</strong></TableCell>
                <TableCell><strong>Categoria</strong></TableCell>
                <TableCell><strong>Pagante</strong></TableCell>
                <TableCell align="right"><strong>Importo</strong></TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {flussi.map((f) => {
                const importo = parseFloat(f.importo.toString());
                return (
                  <TableRow key={f.id} hover>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      {formatData(f.data)}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{f.descrizione}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={f.categoria.nome} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {f.intestatario ? `${f.intestatario.nome} ${f.intestatario.cognome}` : "Comune"}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ minWidth: 140 }}>
                      <Typography
                        fontWeight={600}
                        fontFamily="monospace"
                        fontSize="0.95rem"
                        color={importo >= 0 ? "success.main" : "error.main"}
                      >
                        {formatImporto(f.importo)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ px: 1, whiteSpace: "nowrap" }}>
                      <Tooltip title="Modifica">
                        <IconButton size="small" onClick={() => handleEdit(f)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Elimina">
                        <IconButton size="small" color="error" onClick={() => setDeleteId(f.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow>
                <TableCell colSpan={4} align="right">
                  <Typography fontWeight={700}>Totale</Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography
                    fontWeight={700}
                    fontFamily="monospace"
                    fontSize="1rem"
                    color={totale >= 0 ? "success.main" : "error.main"}
                  >
                    {formatImporto(totale)}
                  </Typography>
                </TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <FlussoForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditData(null); }}
        onSave={() => {
          fetchData();
          setSnackbar({ open: true, message: editData ? "Flusso aggiornato" : "Flusso aggiunto", severity: "success" });
        }}
        editData={editData}
      />

      <ConfirmDialog
        open={!!deleteId}
        title="Elimina Flusso"
        message="Sei sicuro di voler eliminare questo flusso? L'operazione non è reversibile."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        loading={deleteLoading}
      />

      <ImportFlussiDialog
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
