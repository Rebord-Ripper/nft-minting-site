export const metadata = {
  title: "NFT Minting Site",
  description: "Mint your exclusive NFTs on Solana",
  openGraph: {
    type: "website",
    title: "NFT Minting Site",
    description: "Mint your exclusive NFTs on Solana",
    images: [
      {
        url: "/preview.png",
      },
    ],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>{children}</body>
    </html>
  );
}
