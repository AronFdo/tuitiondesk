// Pages made for paper: no app frame, white background.
export default function PrintLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="min-h-screen bg-white print:min-h-0">{children}</div>;
}
