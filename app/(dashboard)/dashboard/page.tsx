"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  CircularProgress,
} from "@mui/material";
import PeopleIcon from "@mui/icons-material/People";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import CategoryIcon from "@mui/icons-material/Category";

interface Counts {
  intestatari: number;
  conti: number;
  tipiConto: number;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const user = session?.user;
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/intestatari").then((r) => r.json()),
      fetch("/api/conti").then((r) => r.json()),
      fetch("/api/tipi-conto").then((r) => r.json()),
    ]).then(([intestatari, conti, tipiConto]) => {
      setCounts({
        intestatari: intestatari.length,
        conti: conti.length,
        tipiConto: tipiConto.length,
      });
    }).catch(() => {});
  }, []);

  const cards = [
    {
      label: "Intestatari",
      value: counts?.intestatari,
      icon: <PeopleIcon sx={{ fontSize: 40, color: "primary.main" }} />,
      color: "#e3f2fd",
    },
    {
      label: "Conti",
      value: counts?.conti,
      icon: <AccountBalanceIcon sx={{ fontSize: 40, color: "secondary.main" }} />,
      color: "#e8f5e9",
    },
    {
      label: "Tipi Conto",
      value: counts?.tipiConto,
      icon: <CategoryIcon sx={{ fontSize: 40, color: "warning.main" }} />,
      color: "#fff3e0",
    },
  ];

  return (
    <>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Benvenuto, {user?.nome}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Panoramica del patrimonio familiare
      </Typography>

      <Grid container spacing={3}>
        {cards.map((card) => (
          <Grid size={{ xs: 12, sm: 4 }} key={card.label}>
            <Card sx={{ bgcolor: card.color }}>
              <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                {card.icon}
                <Box>
                  <Typography variant="h3" fontWeight={700}>
                    {card.value !== undefined ? card.value : <CircularProgress size={24} />}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {card.label}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </>
  );
}
