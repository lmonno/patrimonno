"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Box,
  Divider,
} from "@mui/material";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PeopleIcon from "@mui/icons-material/People";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import CategoryIcon from "@mui/icons-material/Category";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";

const DRAWER_WIDTH = 260;

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: <DashboardIcon /> },
  { label: "Intestatari", href: "/intestatari", icon: <PeopleIcon /> },
  { label: "Conti", href: "/conti", icon: <AccountBalanceIcon /> },
  { label: "Saldi", href: "/saldi", icon: <TrendingUpIcon /> },
  { label: "Tipi Conto", href: "/tipi-conto", icon: <CategoryIcon /> },
];

const adminItems = [
  { label: "Utenti", href: "/admin/utenti", icon: <AdminPanelSettingsIcon /> },
];

const itemSx = {
  mx: 1,
  borderRadius: 1,
  "&.Mui-selected": {
    backgroundColor: "primary.main",
    color: "white",
    "& .MuiListItemIcon-root": { color: "white" },
    "&:hover": { backgroundColor: "primary.dark" },
  },
};

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.ruolo === "ADMIN";

  const drawerContent = (
    <>
      <Toolbar>
        <Typography variant="h6" noWrap fontWeight={700} color="primary">
          Wealth Tracker
        </Typography>
      </Toolbar>
      <List>
        {navItems.map((item) => (
          <ListItemButton
            key={item.href}
            component={Link}
            href={item.href}
            selected={pathname.startsWith(item.href)}
            onClick={onClose}
            sx={itemSx}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
      </List>
      {isAdmin && (
        <>
          <Divider sx={{ mx: 2, my: 1 }} />
          <Typography variant="caption" color="text.secondary" sx={{ px: 2, pb: 0.5, display: "block" }}>
            Amministrazione
          </Typography>
          <List>
            {adminItems.map((item) => (
              <ListItemButton
                key={item.href}
                component={Link}
                href={item.href}
                selected={pathname.startsWith(item.href)}
                onClick={onClose}
                sx={itemSx}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            ))}
          </List>
        </>
      )}
    </>
  );

  return (
    <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
      {/* Mobile drawer */}
      <Drawer
        variant="temporary"
        open={open}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": { width: DRAWER_WIDTH },
        }}
      >
        {drawerContent}
      </Drawer>
      {/* Desktop drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: "none", md: "block" },
          "& .MuiDrawer-paper": { width: DRAWER_WIDTH, boxSizing: "border-box" },
        }}
        open
      >
        {drawerContent}
      </Drawer>
    </Box>
  );
}

export { DRAWER_WIDTH };
