"use client";

import { useState } from "react";
import { Box, Toolbar } from "@mui/material";
import Sidebar, { DRAWER_WIDTH } from "./Sidebar";
import TopBar from "./TopBar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <Box sx={{ display: "flex" }}>
      <TopBar onMenuToggle={() => setMobileOpen(!mobileOpen)} />
      <Sidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}
