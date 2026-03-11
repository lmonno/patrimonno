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
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import UploadIcon from "@mui/icons-material/Upload";
import SaldoForm from "./SaldoForm";
import EmptyState from "@/components/ui/EmptyState";
import MonthYearPicker, { MESI_LUNGHI } from "@/components/ui/MonthYearPicker";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

interface SaldoWithConto {
  id: string;
  contoId: string;
  anno: number;
  mese: number;
  valore: string;
  conto: {
    id: string;
    nome: string;
    iban: string | null;
    tipoConto: { id: string; nome: string };
    rapporto: { id: string; nome: string; istituto: string };
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

export default function SaldiTable() {
  const { anno: initAnno, mese: initMese } = getCurrentPeriod();
  const [anno, setAnno] = useState(initAnno);
  const [mese, setMese] = useState(initMese);
  const [saldi, setSaldi] = useState<SaldoWithConto[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" as "success" | "error" });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/saldi?anno=${anno}&mese=${mese}`);
      if (res.ok) {
        setSaldi(await res.json());
      }
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

  const handleDownloadTemplate = async () => {
    try {
      const res = await fetch("/api/saldi/template");
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "template_saldi_storici.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setSnackbar({ open: true, message: "Errore nel download del template", severity: "error" });
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImportLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/saldi/import", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setSnackbar({ open: true, message: data.error ?? "Errore durante l'importazione", severity: "error" });
        return;
      }
      const msg = `${data.count} saldi importati${data.errors?.length ? ` (${data.errors.length} errori)` : ""}`;
      setSnackbar({ open: true, message: msg, severity: data.errors?.length ? "error" : "success" });
      fetchData();
    } catch {
      setSnackbar({ open: true, message: "Errore di connessione durante l'importazione", severity: "error" });
    } finally {
      setImportLoading(false);
    }
  };

  const totale = saldi.reduce((sum, s) => sum + parseFloat(s.valore.toString()), 0);

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
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleDownloadTemplate}
          >
            Scarica Template
          </Button>
          <Button
            component="label"
            variant="outlined"
            startIcon={importLoading ? <CircularProgress size={16} /> : <UploadIcon />}
            disabled={importLoading}
          >
            Importa Storici
            <input type="file" accept=".xlsx" hidden onChange={handleImport} />
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setFormOpen(true)}
          >
            Inserisci Saldi
          </Button>
        </Box>
      </Box>

      {saldi.length === 0 ? (
        <EmptyState message={`Nessun saldo per ${MESI_LUNGHI[mese - 1]} ${anno}`} />
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Conto</strong></TableCell>
                <TableCell><strong>Tipo</strong></TableCell>
                <TableCell><strong>Rapporto / Istituto</strong></TableCell>
                <TableCell><strong>Intestatari</strong></TableCell>
                <TableCell align="right"><strong>Saldo</strong></TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {saldi.map((s) => (
                <TableRow key={s.id} hover>
                  <TableCell>{s.conto.nome}</TableCell>
                  <TableCell>
                    <Chip label={s.conto.tipoConto.nome} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{s.conto.rapporto.nome}</Typography>
                    <Typography variant="caption" color="text.secondary">{s.conto.rapporto.istituto}</Typography>
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
                  <TableCell align="right" sx={{ fontWeight: 600, fontFamily: "monospace", fontSize: "0.95rem" }}>
                    {parseFloat(s.valore.toString()).toLocaleString("it-IT", { minimumFractionDigits: 2 })} €
                  </TableCell>
                  <TableCell align="right" sx={{ px: 1 }}>
                    <Tooltip title="Elimina saldo">
                      <IconButton size="small" color="error" onClick={() => setDeleteId(s.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={4} align="right">
                  <Typography fontWeight={700}>Totale</Typography>
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, fontFamily: "monospace", fontSize: "1rem" }}>
                  {totale.toLocaleString("it-IT", { minimumFractionDigits: 2 })} €
                </TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
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
