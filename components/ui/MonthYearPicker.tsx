"use client";

import { useState } from "react";
import {
  Box,
  Button,
  IconButton,
  Popover,
  Typography,
  Grid,
} from "@mui/material";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

const MESI = [
  "Gen", "Feb", "Mar", "Apr", "Mag", "Giu",
  "Lug", "Ago", "Set", "Ott", "Nov", "Dic",
];

const MESI_LUNGHI = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

interface MonthYearPickerProps {
  anno: number;
  mese: number; // 1-12
  onChange: (anno: number, mese: number) => void;
  size?: "small" | "medium";
}

export default function MonthYearPicker({ anno, mese, onChange, size = "small" }: MonthYearPickerProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [viewAnno, setViewAnno] = useState(anno);

  const open = Boolean(anchorEl);

  const handleOpen = (e: React.MouseEvent<HTMLButtonElement>) => {
    setViewAnno(anno);
    setAnchorEl(e.currentTarget);
  };

  const handleClose = () => setAnchorEl(null);

  const handleSelectMese = (m: number) => {
    onChange(viewAnno, m);
    handleClose();
  };

  return (
    <>
      <Button
        variant="outlined"
        size={size}
        onClick={handleOpen}
        startIcon={<CalendarMonthIcon />}
        sx={{ minWidth: 180, justifyContent: "flex-start", textTransform: "none" }}
      >
        {MESI_LUNGHI[mese - 1]} {anno}
      </Button>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
      >
        <Box sx={{ p: 2, width: 280 }}>
          {/* Navigazione anno */}
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
            <IconButton size="small" onClick={() => setViewAnno((y) => y - 1)}>
              <ChevronLeftIcon />
            </IconButton>
            <Typography fontWeight={600}>{viewAnno}</Typography>
            <IconButton size="small" onClick={() => setViewAnno((y) => y + 1)}>
              <ChevronRightIcon />
            </IconButton>
          </Box>

          {/* Griglia mesi */}
          <Grid container spacing={0.5}>
            {MESI.map((label, i) => {
              const m = i + 1;
              const isSelected = m === mese && viewAnno === anno;
              return (
                <Grid size={4} key={m}>
                  <Button
                    fullWidth
                    size="small"
                    variant={isSelected ? "contained" : "text"}
                    onClick={() => handleSelectMese(m)}
                    sx={{ fontSize: "0.8rem", py: 0.75 }}
                  >
                    {label}
                  </Button>
                </Grid>
              );
            })}
          </Grid>
        </Box>
      </Popover>
    </>
  );
}

export { MESI_LUNGHI };
