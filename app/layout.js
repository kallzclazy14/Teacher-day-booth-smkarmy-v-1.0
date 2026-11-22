import { Permanent_Marker, Inter, Space_Mono } from 'next/font/google';
import './globals.css';

const marker = Permanent_Marker({ weight: '400', subsets: ['latin'], variable: '--font-marker' });
const sans = Inter({ subsets: ['latin'], variable: '--font-sans' });
const mono = Space_Mono({ weight: ['400', '700'], subsets: ['latin'], variable: '--font-mono' });

export const metadata = {
  title: 'Photo Booth teacher day SMK ARRAHMAN',
  description: 'Photobooth retro yang berjalan sepenuhnya di browser. Fotomu tidak pernah diunggah ke server.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={`${marker.variable} ${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
