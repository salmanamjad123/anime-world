'use client';

import { useQuery } from '@tanstack/react-query';
import { getUserPhotoURL } from '@/lib/firebase/users';

export function useUserPhoto(userId: string | undefined) {
  const { data: photoURL } = useQuery({
    queryKey: ['user-photo', userId],
    queryFn: async () => (await getUserPhotoURL(userId!)) ?? null,
    enabled: !!userId,
  });
  return photoURL;
}
