/**
 * Discord webhook helper for daily social post drafts.
 */

import type { DailySocialPost } from './daily-post';

type DiscordEmbed = {
  title: string;
  description: string;
  url?: string;
  color?: number;
  image?: { url: string };
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
};

export async function sendDailySocialPostToDiscord(
  post: DailySocialPost,
  webhookUrl = process.env.DISCORD_WEBHOOK_URL
): Promise<void> {
  if (!webhookUrl) {
    throw new Error('DISCORD_WEBHOOK_URL is not configured');
  }

  const embed: DiscordEmbed = {
    title: `Daily social draft · ${post.title}`,
    description: [
      'Copy the caption below and post on Instagram / TikTok.',
      '',
      '```',
      post.caption,
      '```',
    ].join('\n'),
    url: post.pageUrl,
    color: 0x3b82f6,
    image: post.coverImage ? { url: post.coverImage } : undefined,
    fields: [
      { name: 'Page', value: post.pageUrl, inline: false },
      {
        name: 'Score',
        value: post.score ? `${post.score}/10` : 'N/A',
        inline: true,
      },
      {
        name: 'Genres',
        value: post.genres.slice(0, 4).join(', ') || 'N/A',
        inline: true,
      },
    ],
    footer: { text: 'Anime Village · auto draft (not posted to IG/TikTok)' },
  };

  const content = [
    '📱 **Ready to post**',
    '1) Save the cover image',
    '2) Copy the caption in the embed',
    '3) Post on Instagram Reels / TikTok',
  ].join('\n');

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content,
      embeds: [embed],
      allowed_mentions: { parse: [] },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Discord webhook failed (${res.status}): ${body}`);
  }
}
