"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  IconButton,
  Alert,
  useMediaQuery,
  useTheme,
  Autocomplete,
  MenuItem,
  CircularProgress,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

interface Intestatario {
  id: string;
  nome: string;
  cognome: string;
}

interface Categoria {
  id: string;
  nome: string;
}

interface FlussoFormData {
  data: string;
  importo: string;
  descrizione: string;
  categoriaId: string;
  categoriaNome: string;
  intestatarioId: string | null;
}

interface FlussoFormProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  editData?: {
    id: string;
    data: string;
    importo: string;
    descrizione: string;
    categoriaId: string;
    categoriaNome: string;
    intestatarioId: string | null;
  } | null;
}

export default function FlussoForm({ open, onClose, onSave, editData }: FlussoFormProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [intestatari, setIntestatari] = useState<Intestatario[]>([]);
  const [categorie, setCategorie] = useState<Categoria[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const emptyForm: FlussoFormData = {
    data: new Date().toISOString().split("T")[0],
    importo: "",
    descrizione: "",
    categoriaId: "",
    categoriaNome: "",
    intestatarioId: null,
  };

  const [form, setForm] = useState<FlussoFormData>(emptyForm);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      fetch("/api/intestatari").then((r) => r.json()),
      fetch("/api/categorie-flusso").then((r) => r.json()),
    ]).then(([ints, cats]) => {
      setIntestatari(ints);
      setCategorie(cats);
    });
  }, [open]);

  useEffect(() => {
    if (open && editData) {
      setForm({
        data: editData.data,
        importo: editData.importo,
        descrizione: editData.descrizione,
        categoriaId: editData.categoriaId,
        categoriaNome: editData.categoriaNome,
        intestatarioId: editData.intestatarioId,
      });
    } else if (open) {
      setForm(emptyForm);
    }
    setError("");
  }, [open, editData]);

  const handleSave = async () => {
    if (!form.data || !form.importo || !form.descrizione || (!form.categoriaId && !form.categoriaNome)) {
      setError("Compila tutti i campi obbligatori");
      return;
    }

    setSaving(true);
    setError("");
    try {
      let categoriaId = form.categoriaId;

      // Se la categoria è nuova (nome senza id), creala
      if (!categoriaId && form.categoriaNome) {
        const catRes = await fetch("/api/categorie-flusso", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nome: form.categoriaNome }),
        });
        if (!catRes.ok) {
          setError("Errore nella creazione della categoria");
          setSaving(false);
          return;
        }
        const newCat = await catRes.json();
        categoriaId = newCat.id;
      }

      const body = {
        data: form.data,
        importo: form.importo,
        descrizione: form.descrizione,
        categoriaId,
        intestatarioId: form.intestatarioId,
      };

      const url = editData
        ? `/api/flussi-straordinari/${editData.id}`
        : "/api/flussi-straordinari";
      const method = editData ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Errore nel salvataggio");
        return;
      }

      onSave();
      onClose();
    } catch {
      setError("Errore di connessione");
    } finally {
      setSaving(false);
    }
  };

  const selectedCategoria = categorie.find((c) => c.id === form.categoriaId) || null;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={isMobile}>
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {editData ? "Modifica Flusso" : "Nuovo Flusso Straordinario"}
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            label="Data"
            type="date"
            value={form.data}
            onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />

          <TextField
            label="Importo"
            type="number"
            value={form.importo}
            onChange={(e) => setForm((f) => ({ ...f, importo: e.target.value }))}
            fullWidth
            helperText="Positivo per entrate, negativo per uscite"
            slotProps={{
              input: { endAdornment: <span style={{ color: "#666" }}>€</span> },
            }}
          />

          <TextField
            label="Descrizione"
            value={form.descrizione}
            onChange={(e) => setForm((f) => ({ ...f, descrizione: e.target.value }))}
            fullWidth
            multiline
            rows={2}
          />

          <Autocomplete
            freeSolo
            options={categorie}
            getOptionLabel={(opt) => (typeof opt === "string" ? opt : opt.nome)}
            value={selectedCategoria}
            inputValue={form.categoriaNome}
            onInputChange={(_e, value) => {
              setForm((f) => ({ ...f, categoriaNome: value }));
            }}
            onChange={(_e, value) => {
              if (typeof value === "string") {
                setForm((f) => ({ ...f, categoriaId: "", categoriaNome: value }));
              } else if (value) {
                setForm((f) => ({ ...f, categoriaId: value.id, categoriaNome: value.nome }));
              } else {
                setForm((f) => ({ ...f, categoriaId: "", categoriaNome: "" }));
              }
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Categoria"
                helperText="Seleziona o digita una nuova categoria"
              />
            )}
          />

          <TextField
            label="Pagante"
            select
            value={form.intestatarioId ?? "comune"}
            onChange={(e) => {
              const val = e.target.value;
              setForm((f) => ({ ...f, intestatarioId: val === "comune" ? null : val }));
            }}
            fullWidth
          >
            <MenuItem value="comune">Comune</MenuItem>
            {intestatari.map((int) => (
              <MenuItem key={int.id} value={int.id}>
                {int.nome} {int.cognome}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>
          Annulla
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={16} /> : undefined}
        >
          {saving ? "Salvataggio..." : editData ? "Salva" : "Aggiungi"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
