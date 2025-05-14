// app/layout.jsx or app/layout.tsx (depending on your setup)

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head />
      <body>{children}</body>
    </html>
  );
}
