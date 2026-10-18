import { WatchSocialBar } from '@/components/ads/MangaSocialBar';

export default function WatchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <WatchSocialBar />
    </>
  );
}
