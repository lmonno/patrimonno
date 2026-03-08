"use client";

import { Box, Typography } from "@mui/material";
import InboxIcon from "@mui/icons-material/Inbox";

interface EmptyStateProps {
  message?: string;
}

export default function EmptyState({ message = "Nessun elemento trovato" }: EmptyStateProps) {
  return (
    <Box sx={{ textAlign: "center", py: 6, color: "text.secondary" }}>
      <InboxIcon sx={{ fontSize: 48, mb: 1 }} />
      <Typography>{message}</Typography>
    </Box>
  );
}
