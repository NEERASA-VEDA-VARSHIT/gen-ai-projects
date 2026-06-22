import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Website Automation Agent',
  description: 'Dashboard for the Website Automation Agent - intelligent browser automation with LLM-based form detection',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  );
}
