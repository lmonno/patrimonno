"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  Chip,
  Typography,
  CircularProgress,
  InputAdornment,
  TextField,
  Card,
  CardContent,
  Stack,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import MonthYearPicker from "@/components/ui/MonthYearPicker";

interface Intestatario {
  id: string;
  nome: string;
  cognome: string;
}

interface TipoEntrata {
  id: string;
  nome: string;
}

interface EntrataFormProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  defaultAnno: number;
  defaultMese: number;
}

export default function EntrataForm({ open, onClose, onSave, defaultAnno, defaultMese }: EntrataFormProps) {
  const [anno, setAnno] = useState(defaultAnno);
  const [mese, setMese] = useState(defaultMese);
  const [intestatari, setIntestatari] = useState<Intestatario[]>([]);
  const [tipiEntrata, setTipiEntrata] = useState<TipoEntrata[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const makeKey = (intId: string, tipoId: string) => `${intId}__${tipoId}`;

  const loadData = useCallback(async (a: number, m: number) => {
    setLoading(true);
    setError("");
    try {
      const [intRes, tipiRes, currentRes] = await Promise.all([
        fetch("/api/intestatari"),
        fetch("/api/tipi-entrata"),
        fetch(`/api/entrate?anno=${a}&mese=${m}`),
      ]);

      const intData: Intestatario[] = await intRes.json();
      const tipiData: TipoEntrata[] = await tipiRes.json();
      const currentData: { intestatarioId: string; tipoEntrataId: string; valore: string }[] = await currentRes.json();

      setIntestatari(intData);
      setTipiEntrata(tipiData);

      const newValues: Record<string, string> = {};
      for (const int of intData) {
        for (const tipo of tipiData) {
          const key = makeKey(int.id, tipo.id);
          const existing = currentData.find(
            (e) => e.intestatarioId === int.id && e.tipoEntrataId === tipo.id
          );
          newValues[key] = existing ? parseFloat(existing.valore.toString()).toString() : "";
        }
      }
      setValues(newValues);
    } catch {
      setError("Errore nel caricamento dei dati");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setAnno(defaultAnno);
      setMese(defaultMese);
      loadData(defaultAnno, defaultMese);
    }
  }, [open, defaultAnno, defaultMese, loadData]);

  const handlePeriodChange = (newAnno: number, newMese: number) => {
    setAnno(newAnno);
    setMese(newMese);
    loadData(newAnno, newMese);
  };

  const handleValueChange = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setError("");
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError("");

    const entrate: { intestatarioId: string; tipoEntrataId: string; anno: number; mese: number; valore: string }[] = [];

    for (const int of intestatari) {
      for (const tipo of tipiEntrata) {
        const key = makeKey(int.id, tipo.id);
        const raw = values[key]?.trim();
        if (!raw) continue;
        const num = parseFloat(raw);
        if (!isFinite(num)) continue;
        entrate.push({
          intestatarioId: int.id,
          tipoEntrataId: tipo.id,
          anno,
          mese,
          valore: num.toString(),
        });
      }
    }

    if (entrate.length === 0) {
      setError("Nessuna entrata da salvare");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/entrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entrate }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Errore durante il salvataggio");
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

  const renderField = (intId: string, tipoId: string) => {
    const key = makeKey(intId, tipoId);
    return (
      <TextField
        size="small"
        fullWidth
        value={values[key] ?? ""}
        onChange={(e) => handleValueChange(key, e.target.value)}
        placeholder="0,00"
        slotProps={{
          input: {
            endAdornment: <InputAdornment position="end">€</InputAdornment>,
          },
        }}
      />
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth fullScreen={isMobile}>
      <DialogTitle>Inserimento Entrate</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: "flex", gap: 2, mb: 3, mt: 1 }}>
          <MonthYearPicker anno={anno} mese={mese} onChange={handlePeriodChange} />
        </Box>

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : intestatari.length === 0 || tipiEntrata.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
            Nessun intestatario o tipo entrata disponibile.
          </Typography>
        ) : isMobile ? (
          /* ─── MOBILE: Card layout ─── */
          <Stack spacing={1.5}>
            {intestatari.map((int) => (
              <Card key={int.id} variant="outlined">
                <CardContent sx={{ py: 1.5, px: 2, "&:last-child": { pb: 1.5 } }}>
                  <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                    {int.nome} {int.cognome}
                  </Typography>
                  <Stack spacing={1}>
                    {tipiEntrata.map((tipo) => (
                      <Box key={tipo.id} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Chip label={tipo.nome} size="small" variant="outlined" sx={{ minWidth: 100 }} />
                        <Box sx={{ flex: 1 }}>
                          {renderField(int.id, tipo.id)}
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        ) : (
          /* ─── DESKTOP: Table layout ─── */
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>Intestatario</strong></TableCell>
                  <TableCell><strong>Tipo Entrata</strong></TableCell>
                  <TableCell sx={{ width: 200 }}><strong>Valore</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {intestatari.map((int) =>
                  tipiEntrata.map((tipo, tipoIdx) => (
                    <TableRow key={makeKey(int.id, tipo.id)}>
                      {tipoIdx === 0 ? (
                        <TableCell rowSpan={tipiEntrata.length}>
                          <Typography variant="body2" fontWeight={500}>
                            {int.nome} {int.cognome}
                          </Typography>
                        </TableCell>
                      ) : null}
                      <TableCell>
                        <Chip label={tipo.nome} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        {renderField(int.id, tipo.id)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Annulla
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={saving || loading || intestatari.length === 0}
        >
          {saving ? "Salvataggio..." : "Salva"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
