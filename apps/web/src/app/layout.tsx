import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import './globals.css';

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  weight: ['400', '500', '600', '700'],
});
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Lista de Presentes',
  description: 'Lista de presentes de casamento com pagamento integrado',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${playfair.variable} ${inter.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
