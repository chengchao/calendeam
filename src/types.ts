import { z } from 'zod';

export const wishlistItemSchema = z.object({
	name: z.string(),
	capsule: z.string(),
	review_score: z.number(),
	review_desc: z.string(),
	reviews_total: z.string(),
	reviews_percent: z.number(),
	release_date: z.string().pipe(z.coerce.number()),
	release_string: z.string(),
	platform_icons: z.string(),
	subs: z.array(
		z.object({
			packageid: z.number(),
			bundleid: z.null(),
			discount_block: z.string(),
			discount_pct: z.number(),
			price: z.string(),
		})
	),
	type: z.string(),
	screenshots: z.array(z.string()),
	review_css: z.string(),
	priority: z.number(),
	added: z.number(),
	background: z.string(),
	rank: z.number(),
	tags: z.array(z.string()),
	is_free_game: z.boolean(),
	deck_compat: z.string(),
	win: z.number().optional(),
	mac: z.number().optional(),
	linux: z.number().optional(),
});

export const wishlistItemsSchema = z.array(wishlistItemSchema);

export type WishlistItem = z.infer<typeof wishlistItemSchema>;
