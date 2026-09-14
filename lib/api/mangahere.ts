/**
 * Direct MangaHere chapter page scraper.
 * Consumet's Docker instance often fails on /manga/mangahere/read; this runs
 * the same chapter_bar / chapterfun flow from the Next.js server.
 */

import axios from 'axios';
import type { MangaChapterPage } from '@/types';

const BASE = 'https://www.mangahere.cc';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function unpackEval(script: string): string {
  const body = script.replace(/^eval/, '').trim();
  // Packed Dean Edwards form — must execute; only used on MangaHere HTML we request.
  // eslint-disable-next-line no-new-func -- required to unpack site obfuscation
  const result = new Function(`"use strict"; return (${body})`)();
  return String(result);
}

function extractKey(html: string): string {
  const skss = html.indexOf('eval(function(p,a,c,k,e,d)');
  if (skss < 0) return '';
  const skse = html.indexOf('</script>', skss);
  if (skse < 0) return '';
  const unpacked = unpackEval(html.substring(skss, skse));
  const sksl = unpacked.indexOf("'");
  const skel = unpacked.indexOf(';');
  if (sksl < 0 || skel < 0) return '';
  // eslint-disable-next-line no-new-func -- key expression from unpacked script
  return String(new Function(`"use strict"; return (${unpacked.substring(sksl, skel)})`)());
}

function toHttps(url: string): string {
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('http://')) return `https://${url.slice(7)}`;
  return url;
}

function pagesFromNewImgs(unpacked: string): MangaChapterPage[] {
  const chunk = unpacked.split("['")[1]?.split("']")[0];
  if (!chunk) return [];
  return chunk
    .split("','")
    .map((u) => u.trim())
    .filter(Boolean)
    .map((u, i) => ({
      page: i + 1,
      img: toHttps(u),
    }));
}

async function pagesViaChapterFun(
  html: string,
  chapterUrl: string
): Promise<MangaChapterPage[]> {
  let sKey = extractKey(html);
  const chapterIdsl = html.indexOf('chapterid');
  if (chapterIdsl < 0) return [];
  const cid = html
    .substring(chapterIdsl + 11, html.indexOf(';', chapterIdsl))
    .trim();
  if (!cid) return [];

  const dataPages = [...html.matchAll(/data-page=["'](\d+)["']/g)].map((m) =>
    parseInt(m[1], 10)
  );
  const pages =
    dataPages.length > 0
      ? Math.max(...dataPages)
      : parseInt(
          (html.match(/(\d+)\s*<\/a>\s*<a[^>]*>\s*(?:Next|>)/i) || [])[1] ||
            '0',
          10
        );
  if (pages < 1) return [];

  const pageBase = chapterUrl.substring(0, chapterUrl.lastIndexOf('/'));
  const out: MangaChapterPage[] = [];

  for (let i = 1; i <= pages; i++) {
    let resText = '';
    for (let j = 1; j <= 3; j++) {
      const pageLink = `${pageBase}/chapterfun.ashx?cid=${cid}&page=${i}&key=${encodeURIComponent(sKey)}`;
      try {
        const { data } = await axios.get<string>(pageLink, {
          timeout: 15000,
          responseType: 'text',
          headers: {
            Referer: chapterUrl,
            'X-Requested-With': 'XMLHttpRequest',
            cookie: 'isAdult=1',
            'User-Agent': UA,
          },
        });
        resText = typeof data === 'string' ? data : String(data);
        if (resText) break;
        sKey = '';
      } catch {
        sKey = '';
      }
    }
    if (!resText) continue;

    const ds = unpackEval(resText.startsWith('eval') ? resText : `eval${resText}`);
    const baseLinksp = ds.indexOf('pix=') + 5;
    const baseLinkes = ds.indexOf(';', baseLinksp) - 1;
    const baseLink = ds.substring(baseLinksp, baseLinkes);
    const imageLinksp = ds.indexOf('pvalue=') + 9;
    const imageLinkes = ds.indexOf('"', imageLinksp);
    const imageLink = ds.substring(imageLinksp, imageLinkes);
    if (!baseLink || !imageLink) continue;
    out.push({
      page: i,
      img: toHttps(`${baseLink}${imageLink}`),
    });
  }

  return out;
}

/**
 * Fetch page image URLs for a MangaHere chapter id like `absolute_sword_sense/c001`.
 */
export async function getMangaHereChapterPages(
  chapterId: string
): Promise<MangaChapterPage[]> {
  const id = chapterId.replace(/^\/+|\/+$/g, '');
  if (!id || !id.includes('/')) return [];

  const chapterUrl = `${BASE}/manga/${id}/1.html`;
  const { data } = await axios.get<string>(chapterUrl, {
    timeout: 25000,
    responseType: 'text',
    headers: {
      cookie: 'isAdult=1',
      'User-Agent': UA,
      Referer: `${BASE}/`,
      Accept: 'text/html,application/xhtml+xml',
    },
  });

  const html = typeof data === 'string' ? data : String(data);

  if (/p\.detail-block-content[\s\S]{0,200}Dear user/i.test(html) || /Dear user[\s\S]{0,80}blocked/i.test(html)) {
    throw new Error('MangaHere blocked this chapter');
  }

  const hasChapterBar = /script[^>]+src=["'][^"']*chapter_bar/i.test(html);
  const ss = html.indexOf('eval(function(p,a,c,k,e,d)');
  if (hasChapterBar && ss >= 0) {
    const se = html.indexOf('</script>', ss);
    if (se > ss) {
      const unpacked = unpackEval(html.substring(ss, se));
      const fromImgs = pagesFromNewImgs(unpacked);
      if (fromImgs.length > 0) return fromImgs;
    }
  }

  return pagesViaChapterFun(html, chapterUrl);
}

export function isMangaHereChapterId(chapterId: string): boolean {
  return /^[a-z0-9_]+\/c\d+/i.test(chapterId.trim());
}
