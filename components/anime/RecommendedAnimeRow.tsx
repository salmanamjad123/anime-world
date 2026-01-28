/**
 * Recommended Anime Row
 * Horizontal scroll row of anime cards (screenshot-style).
 */
 
 'use client';
 
 import Link from 'next/link';
 import { ChevronRight } from 'lucide-react';
 import { AnimeCard } from '@/components/anime/AnimeCard';
 import type { Anime } from '@/types';
 
 type Props = {
   title: string;
   anime: Anime[];
   isLoading?: boolean;
   viewMoreHref?: string;
   className?: string;
 };
 
 export function RecommendedAnimeRow({ title, anime, isLoading, viewMoreHref, className }: Props) {
   return (
     <section className={className}>
       <div className="flex items-center justify-between mb-4">
         <h2 className="text-xl md:text-2xl font-bold text-white">{title}</h2>
         {viewMoreHref && (
           <Link
             href={viewMoreHref}
             className="text-sm text-gray-400 hover:text-white transition-colors inline-flex items-center gap-1"
           >
             View more <ChevronRight className="w-4 h-4" />
           </Link>
         )}
       </div>
 
      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto overflow-y-hidden pb-2">
           {Array.from({ length: 10 }).map((_, i) => (
             <div key={i} className="flex-none w-36 sm:w-40 md:w-44 animate-pulse">
               <div className="aspect-[2/3] bg-gray-800 rounded-lg" />
               <div className="mt-2 h-4 bg-gray-800 rounded w-3/4" />
               <div className="mt-2 h-3 bg-gray-800 rounded w-1/2" />
             </div>
           ))}
         </div>
       ) : !anime || anime.length === 0 ? (
         <div className="text-center py-8">
           <p className="text-gray-400">No recommendations right now.</p>
         </div>
       ) : (
         <div className="flex gap-4 overflow-x-auto overflow-y-hidden pb-2">
           {anime.map((item) => (
             <div key={item.id} className="flex-none w-36 sm:w-40 md:w-44">
               <AnimeCard anime={item} />
             </div>
           ))}
         </div>
       )}
     </section>
   );
 }
