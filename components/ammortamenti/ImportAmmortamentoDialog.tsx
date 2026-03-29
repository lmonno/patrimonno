"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  Button,
  Divider,
  IconButton,
  CircularProgress,
  Alert,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DownloadIcon from "@mui/icons-material/Download";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import DeleteIcon from "@mui/icons-material/Delete";

interface Conto {
  id: string;
  nome: string;
  rapporto: { id: string; nome: string; istituto: string };
}

interface ImportAmmortamentoDialogProps {
  open: boolean;
  onClose: () => void;
  onImportSuccess: (message: string, severity: "success" | "error") => void;
}

export default function ImportAmmortamentoDialog({ open, onClose, onImportSuccess }: ImportAmmortamentoDialogProps) {
  const [downloading, setDownloading] = useState(false);
  const [nome, setNome] = useState("");
  const [contoId, setContoId] = useState("");
  const [conti, setConti] = useState<Conto[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<{ message: string; severity: "success" | "error" } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      fetch("/api/conti?archiviato=false")
        .then((res) => res.json())
        .then((data) => setConti(data))
        .catch(() => {});
    }
  }, [open]);

  const handleDownloadTemplate = async () => {
    setDownloading(true);
    try {
      const res = await fetch("/api/piani-ammortamento/template");
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "template_piano_ammortamento.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setResult({ message: "Errore nel download del template", severity: "error" });
    } finally {
      setDownloading(false);
    }
  };

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.name.endsWith(".xlsx")) {
      setResult({ message: "Formato non supportato. Seleziona un file .xlsx", severity: "error" });
      return;
    }
    setFile(selectedFile);
    setResult(null);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleImport = async () => {
    if (!file || !nome.trim() || !contoId) return;
    setImporting(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("nome", nome.trim());
      formData.append("contoId", contoId);
      const res = await fetch("/api/piani-ammortamento/import", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setResult({ message: data.error ?? "Errore durante l'importazione", severity: "error" });
        return;
      }
      const msg = `Piano creato con ${data.count} rate${data.errors?.length ? ` (${data.errors.length} errori)` : ""}`;
      const severity = data.errors?.length ? "error" : "success";
      setResult({ message: msg, severity });
      onImportSuccess(msg, severity);
      setFile(null);
      setNome("");
      setContoId("");
    } catch {
      setResult({ message: "Errore di connessione durante l'importazione", severity: "error" });
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    if (importing) return;
    setFile(null);
    setResult(null);
    setNome("");
    setContoId("");
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        Importa Piano di Ammortamento
        <IconButton onClick={handleClose} disabled={importing} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {/* Sezione Template */}
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>
          Scarica Template
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Scarica il template Excel e compilalo con i dati del piano di ammortamento.
        </Typography>
        <Button
          variant="outlined"
          startIcon={downloading ? <CircularProgress size={16} /> : <DownloadIcon />}
          onClick={handleDownloadTemplate}
          disabled={downloading}
          sx={{ mb: 3 }}
        >
          Scarica Template
        </Button>

        <Divider sx={{ mb: 3 }} />

        {/* Sezione Import */}
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>
          Importa File
        </Typography>

        <TextField
          label="Nome Piano"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          fullWidth
          size="small"
          sx={{ mb: 2 }}
          placeholder="es. Mutuo Casa Principale"
        />

        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>Conto</InputLabel>
          <Select value={contoId} onChange={(e) => setContoId(e.target.value)} label="Conto">
            {conti.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.rapporto.nome} — {c.nome}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Trascina il file Excel compilato o clicca per selezionarlo.
        </Typography>

        {!file ? (
          <Box
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            sx={{
              border: "2px dashed",
              borderColor: dragOver ? "primary.main" : "grey.400",
              borderRadius: 2,
              p: 4,
              textAlign: "center",
              cursor: "pointer",
              backgroundColor: dragOver ? "action.hover" : "transparent",
              transition: "all 0.2s",
              "&:hover": { borderColor: "primary.main", backgroundColor: "action.hover" },
            }}
          >
            <UploadFileIcon sx={{ fontSize: 48, color: "grey.500", mb: 1 }} />
            <Typography variant="body1" color="text.secondary">
              Trascina qui il file .xlsx
            </Typography>
            <Typography variant="caption" color="text.secondary">
              oppure clicca per selezionare
            </Typography>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelect(f);
                e.target.value = "";
              }}
            />
          </Box>
        ) : (
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2, p: 2, bgcolor: "grey.50", borderRadius: 1 }}>
            <InsertDriveFileIcon color="primary" />
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" fontWeight={500}>{file.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {(file.size / 1024).toFixed(1)} KB
              </Typography>
            </Box>
            <IconButton size="small" onClick={() => { setFile(null); setResult(null); }} disabled={importing}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        )}

        {file && (
          <Button
            variant="contained"
            onClick={handleImport}
            disabled={importing || !nome.trim() || !contoId}
            startIcon={importing ? <CircularProgress size={16} /> : <UploadFileIcon />}
            sx={{ mt: 2 }}
          >
            {importing ? "Importazione in corso..." : "Importa"}
          </Button>
        )}

        {result && (
          <Alert severity={result.severity} sx={{ mt: 2 }}>
            {result.message}
          </Alert>
        )}
      </DialogContent>
    </Dialog>
  );
}
