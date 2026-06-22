import type { Metadata } from 'next';
import { Space_Grotesk, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' });
const ibmPlexMono = IBM_Plex_Mono({ subsets: ['latin'], variable: '--font-ibm-plex-mono', weight: ['400', '500'] });

export const metadata: Metadata = {
  title: 'NotebookLM RAG',
  description: 'A minimal production-style RAG app with Supabase pgvector.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} ${ibmPlexMono.variable} bg-background text-foreground antialiased`}>
        {children}
      </body>
    </html>
  );
}