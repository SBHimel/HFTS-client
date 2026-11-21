import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Dashboard | HFTS Horizon",
  description: "User Management and Administrative Control Center for HFTS Horizon",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
