"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Card,
  CardContent,
  Stack,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { parseItalianNumber } from "@/lib/formatNumbers";

interface Conto {
  id: string;
  nome: string;
  rapporto: { id: string; nome: string; istituto: string };
}

interface RataInput {
  key: number;
  data: string;
  quotaCapitale: string;
  quotaInteressi: string;
  rataTotale: string;
  debitoResiduo: string;
  contributo: string;
}

interface PianoFormProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  editPiano?: {
    id: string;
    nome: string;
    contoId: string;
    rate: {
      data: string;
      quotaCapitale: string;
      quotaInteressi: string;
      rataTotale: string;
      debitoResiduo: string;
      contributo: string;
    }[];
  } | null;
}

let nextKey = 0;

function emptyRata(): RataInput {
  return {
    key: nextKey++,
    data: "",
    quotaCapitale: "",
    quotaInteressi: "",
    rataTotale: "",
    debitoResiduo: "",
    contributo: "",
  };
}

export default function PianoForm({ open, onClose, onSave, editPiano }: PianoFormProps) {
  const [nome, setNome] = useState("");
  const [contoId, setContoId] = useState("");
  const [conti, setConti] = useState<Conto[]>([]);
  const [rate, setRate] = useState<RataInput[]>([emptyRata()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  useEffect(() => {
    if (open) {
      fetch("/api/conti?archiviato=false")
        .then((res) => res.json())
        .then((data) => setConti(data))
        .catch(() => {});

      if (editPiano) {
        setNome(editPiano.nome);
        setContoId(editPiano.contoId);
        setRate(
          editPiano.rate.map((r) => ({
            key: nextKey++,
            data: r.data.substring(0, 10),
            quotaCapitale: r.quotaCapitale,
            quotaInteressi: r.quotaInteressi,
            rataTotale: r.rataTotale,
            debitoResiduo: r.debitoResiduo,
            contributo: r.contributo,
          }))
        );
      } else {
        setNome("");
        setContoId("");
        setRate([emptyRata()]);
      }
      setError("");
    }
  }, [open, editPiano]);

  const updateRata = (index: number, field: keyof RataInput, value: string) => {
    setRate((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  };

  const addRata = () => {
    setRate((prev) => [...prev, emptyRata()]);
  };

  const removeRata = (index: number) => {
    setRate((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!nome.trim()) { setError("Nome obbligatorio"); return; }
    if (!contoId) { setError("Seleziona un conto"); return; }

    const validRate = rate.filter((r) => r.data && r.quotaCapitale && r.quotaInteressi && r.rataTotale && r.debitoResiduo);
    if (validRate.length === 0) { setError("Inserisci almeno una rata completa"); return; }

    setSaving(true);
    setError("");
    try {
      const payload = {
        nome: nome.trim(),
        contoId,
        rate: validRate.map((r) => ({
          data: r.data,
          quotaCapitale: parseItalianNumber(r.quotaCapitale).toString(),
          quotaInteressi: parseItalianNumber(r.quotaInteressi).toString(),
          rataTotale: parseItalianNumber(r.rataTotale).toString(),
          debitoResiduo: parseItalianNumber(r.debitoResiduo).toString(),
          contributo: r.contributo ? parseItalianNumber(r.contributo).toString() : "0",
        })),
      };

      const url = editPiano ? `/api/piani-ammortamento/${editPiano.id}` : "/api/piani-ammortamento";
      const method = editPiano ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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

  const renderRataFields = (r: RataInput, index: number) => (
    <>
      <TextField
        type="date"
        label="Data"
        value={r.data}
        onChange={(e) => updateRata(index, "data", e.target.value)}
        size="small"
        slotProps={{ inputLabel: { shrink: true } }}
        fullWidth={isMobile}
        sx={{ minWidth: isMobile ? undefined : 140 }}
      />
      <TextField label="Quota Capitale" value={r.quotaCapitale} onChange={(e) => updateRata(index, "quotaCapitale", e.target.value)} size="small" fullWidth={isMobile} />
      <TextField label="Quota Interessi" value={r.quotaInteressi} onChange={(e) => updateRata(index, "quotaInteressi", e.target.value)} size="small" fullWidth={isMobile} />
      <TextField label="Rata Totale" value={r.rataTotale} onChange={(e) => updateRata(index, "rataTotale", e.target.value)} size="small" fullWidth={isMobile} />
      <TextField label="Debito Residuo" value={r.debitoResiduo} onChange={(e) => updateRata(index, "debitoResiduo", e.target.value)} size="small" fullWidth={isMobile} />
      <TextField label="Contributo" value={r.contributo} onChange={(e) => updateRata(index, "contributo", e.target.value)} size="small" fullWidth={isMobile} />
    </>
  );

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg" fullScreen={isMobile}>
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {editPiano ? "Modifica Piano" : "Nuovo Piano di Ammortamento"}
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", gap: 2, mb: 3, mt: 1, flexDirection: isMobile ? "column" : "row" }}>
          <TextField
            label="Nome Piano"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            size="small"
            fullWidth
            placeholder="es. Mutuo Casa Principale"
          />
          <FormControl size="small" fullWidth>
            <InputLabel>Conto</InputLabel>
            <Select value={contoId} onChange={(e) => setContoId(e.target.value)} label="Conto">
              {conti.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.rapporto.nome} — {c.nome}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
          <Typography variant="subtitle1" fontWeight={600}>Rate</Typography>
          <Button startIcon={<AddIcon />} onClick={addRata} size="small">
            Aggiungi Rata
          </Button>
        </Box>

        {isMobile ? (
          <Stack spacing={2}>
            {rate.map((r, index) => (
              <Card key={r.key} variant="outlined">
                <CardContent sx={{ py: 1.5, px: 2, "&:last-child": { pb: 1.5 } }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                    <Typography variant="caption" color="text.secondary">Rata {index + 1}</Typography>
                    {rate.length > 1 && (
                      <IconButton size="small" color="error" onClick={() => removeRata(index)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                  <Stack spacing={1.5}>
                    {renderRataFields(r, index)}
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        ) : (
          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Data</strong></TableCell>
                  <TableCell><strong>Quota Capitale</strong></TableCell>
                  <TableCell><strong>Quota Interessi</strong></TableCell>
                  <TableCell><strong>Rata Totale</strong></TableCell>
                  <TableCell><strong>Debito Residuo</strong></TableCell>
                  <TableCell><strong>Contributo</strong></TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {rate.map((r, index) => (
                  <TableRow key={r.key}>
                    <TableCell>
                      <TextField
                        type="date"
                        value={r.data}
                        onChange={(e) => updateRata(index, "data", e.target.value)}
                        size="small"
                        sx={{ minWidth: 140 }}
                      />
                    </TableCell>
                    <TableCell><TextField value={r.quotaCapitale} onChange={(e) => updateRata(index, "quotaCapitale", e.target.value)} size="small" sx={{ minWidth: 110 }} /></TableCell>
                    <TableCell><TextField value={r.quotaInteressi} onChange={(e) => updateRata(index, "quotaInteressi", e.target.value)} size="small" sx={{ minWidth: 110 }} /></TableCell>
                    <TableCell><TextField value={r.rataTotale} onChange={(e) => updateRata(index, "rataTotale", e.target.value)} size="small" sx={{ minWidth: 110 }} /></TableCell>
                    <TableCell><TextField value={r.debitoResiduo} onChange={(e) => updateRata(index, "debitoResiduo", e.target.value)} size="small" sx={{ minWidth: 110 }} /></TableCell>
                    <TableCell><TextField value={r.contributo} onChange={(e) => updateRata(index, "contributo", e.target.value)} size="small" sx={{ minWidth: 110 }} /></TableCell>
                    <TableCell>
                      {rate.length > 1 && (
                        <IconButton size="small" color="error" onClick={() => removeRata(index)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {error && (
          <Typography color="error" variant="body2" sx={{ mt: 2 }}>
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>Annulla</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={16} /> : undefined}
        >
          {saving ? "Salvataggio..." : editPiano ? "Salva Modifiche" : "Crea Piano"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
