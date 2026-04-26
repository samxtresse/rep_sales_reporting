export const metadata = {
  title: 'Xtressé · Rep Tracker',
  description: 'Personal sales tracker for Xtressé reps',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
