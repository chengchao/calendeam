import { wishlistItemsSchema } from '../types';
import { steamWishlistToIcs } from './steam-wishlist-to-ics';

export async function updateWishlist(steamId: string, env: Env): Promise<R2Object> {
	const wishlistUrl = `https://store.steampowered.com/wishlist/profiles/${steamId}/wishlistdata?p=0`;
	console.log('Fetching data from:', wishlistUrl);

	const url = new URL('https://scraping.narf.ai/api/v1');
	url.searchParams.append('api_key', env.SCRAPING_FISH_API_KEY);
	url.searchParams.append('url', wishlistUrl);
	console.log('Fetching data from proxy:', url.toString());

	const response = await fetch(url);
	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Failed to fetch data for steamId: ${steamId}; ${text}`);
	}

	const data = await response.json();
	const items = wishlistItemsSchema.parse(data);

	const ics = steamWishlistToIcs(items);
	const r2object = await env.BUCKET.put(`wishlists/${steamId}.ics`, ics);
	if (r2object === null) {
		throw new Error('Failed to upload ics file');
	}

	return r2object;
}
