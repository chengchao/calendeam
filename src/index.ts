/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.toml`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { PrismaD1 } from '@prisma/adapter-d1';
import { PrismaClient } from '@prisma/client';

import { Hono } from 'hono';
import { bearerAuth } from 'hono/bearer-auth';
import { HTTPException } from 'hono/http-exception';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { WishlistItem, wishlistItemsSchema } from './types';
import { steamWishlistToIcs } from './utils/steamWishlistToIcs';

const app = new Hono<{ Bindings: Env }>();

app.get('/wishlists/steam-profiles/:steamProfileId/ics/:fileName', async (c) => {
	const adapter = new PrismaD1(c.env.DB);
	const prisma = new PrismaClient({ adapter });

	const steamProfileId = c.req.param('steamProfileId');
	const fileName = c.req.param('fileName');
	const steamProfile = await prisma.steamProfile.findFirst({
		where: {
			steamId: steamProfileId,
		},
	});
	if (steamProfile === null) {
		throw new HTTPException(404, { message: 'Steam profile not found' });
	}
	if (steamProfile.releaseDateIcsKey?.split('/')[1] !== fileName) {
		throw new HTTPException(404, { message: 'Ics not found' });
	}
	const object = await c.env.BUCKET.get(steamProfile.releaseDateIcsKey);
	if (object === null) {
		throw new HTTPException(404, { message: 'Ics not found' });
	}
	const ics = await object.text();
	return c.text(ics);
});

app.use('/api/*', prettyJSON(), logger(), async (c, next) => {
	const auth = bearerAuth({ token: c.env.API_KEY });
	return auth(c, next);
});

app.get('/api/users', async (c) => {
	const adapter = new PrismaD1(c.env.DB);
	const prisma = new PrismaClient({ adapter });

	const users = await prisma.user.findMany();
	const result = JSON.stringify(users);
	return c.text(result);
});

app.post('/api/users', async (c) => {
	const adapter = new PrismaD1(c.env.DB);
	const prisma = new PrismaClient({ adapter });

	const { email } = await c.req.json();

	try {
		const user = await prisma.user.create({
			data: {
				email,
			},
		});

		return c.json(user);
	} catch (e) {
		console.error(e);
		if (e instanceof Error) {
			throw new HTTPException(400, { message: e.message, cause: e });
		} else {
			throw new HTTPException(400, { message: 'An unknown error occurred', cause: e });
		}
	}
});

app.delete('api/users/:id', async (c) => {
	const adapter = new PrismaD1(c.env.DB);
	const prisma = new PrismaClient({ adapter });

	const id = c.req.param('id');

	try {
		const user = await prisma.user.delete({
			where: { id },
		});

		return c.json(user);
	} catch (e) {
		console.error(e);
		if (e instanceof Error) {
			throw new HTTPException(400, { message: e.message, cause: e });
		} else {
			throw new HTTPException(400, { message: 'An unknown error occurred', cause: e });
		}
	}
});

app.get('/api/users/:userId/steam-profiles', async (c) => {
	const adapter = new PrismaD1(c.env.DB);
	const prisma = new PrismaClient({ adapter });

	const userId = c.req.param('userId');

	const steamProfiles = await prisma.steamProfile.findMany({
		where: {
			userId,
		},
	});

	return c.json(steamProfiles);
});

app.post('/api/steam-profiles', async (c) => {
	const adapter = new PrismaD1(c.env.DB);
	const prisma = new PrismaClient({ adapter });

	const { userId, steamId } = await c.req.json();

	try {
		const steamProfile = await prisma.steamProfile.create({
			data: {
				userId,
				steamId,
			},
		});

		return c.json(steamProfile);
	} catch (e) {
		console.error(e);
		if (e instanceof Error) {
			throw new HTTPException(400, { message: e.message, cause: e });
		} else {
			throw new HTTPException(400, { message: 'An unknown error occurred', cause: e });
		}
	}
});

app.put('/api/steam-profiles/:id', async (c) => {
	const adapter = new PrismaD1(c.env.DB);
	const prisma = new PrismaClient({ adapter });

	const { userId, steamId } = await c.req.json();
	const id = c.req.param('id');

	try {
		const steamProfile = await prisma.steamProfile.update({
			where: { id },
			data: {
				userId,
				steamId,
			},
		});

		return c.json(steamProfile);
	} catch (e) {
		console.error(e);
		if (e instanceof Error) {
			throw new HTTPException(400, { message: e.message, cause: e });
		} else {
			throw new HTTPException(400, { message: 'An unknown error occurred', cause: e });
		}
	}
});

app.delete('/api/steam-profiles/:id', async (c) => {
	const adapter = new PrismaD1(c.env.DB);
	const prisma = new PrismaClient({ adapter });

	const id = c.req.param('id');

	try {
		const steamProfile = await prisma.steamProfile.delete({
			where: { id },
		});

		return c.json(steamProfile);
	} catch (e) {
		console.error(e);
		if (e instanceof Error) {
			throw new HTTPException(400, { message: e.message, cause: e });
		} else {
			throw new HTTPException(400, { message: 'An unknown error occurred', cause: e });
		}
	}
});

export default {
	async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
		const batchSize = parseInt(env.BATCH_SIZE, 10);
		const delaySeconds = parseInt(env.DELAY_SECONDS, 10);
		console.log(`Scheduled task started, batchSize: ${batchSize}, delaySeconds: ${delaySeconds}`);

		try {
			// Fetch data from DB
			const adapter = new PrismaD1(env.DB);
			const prisma = new PrismaClient({ adapter });

			let queryResults: {
				id: string;
				userId: string;
				steamId: string;
			}[];

			const userCount = await prisma.user.count();
			console.log('Total users:', userCount);

			const steamProfileCount = await prisma.steamProfile.count();
			console.log('Total steam profiles:', steamProfileCount);

			queryResults = await prisma.steamProfile.findMany({
				take: batchSize,
				orderBy: {
					updatedAt: 'asc',
				},
			});
			console.log('Sending data to queue:', queryResults);

			let n = 0;

			while (queryResults.length > 0) {
				// Send data to queue
				for (const result of queryResults) {
					console.log(`Sending single data to queue: ${JSON.stringify(result, null, 2)}`);
					await env.STEAM_USER_QUEUE.send(result, { delaySeconds: delaySeconds * n });
					console.log(`Sent single data to queue: ${JSON.stringify(result, null, 2)}`);
				}
				n++;

				const lastSteamProfileInResults = queryResults[queryResults.length - 1];
				const myCursor = lastSteamProfileInResults.id;

				queryResults = await prisma.steamProfile.findMany({
					cursor: {
						id: myCursor,
					},
					take: batchSize,
					skip: 1, // Skip the cursor
					orderBy: {
						updatedAt: 'asc',
					},
				});
			}
		} catch (e) {
			if (e instanceof Error) {
				console.error({ message: e.message });
			} else {
				console.error(e);
			}
		}
	},

	async queue(batch: MessageBatch<Message>, env: Env, ctx: ExecutionContext) {
		console.log('Queued task started');

		const adapter = new PrismaD1(env.DB);
		const prisma = new PrismaClient({ adapter });

		try {
			const steamProfiles = await Promise.all(
				batch.messages.map(async (message) => {
					const { id, userId, steamId } = message.body as Message;
					console.log('Processing message:', id, userId, steamId);

					const wishlistUrl = `https://store.steampowered.com/wishlist/profiles/${steamId}/wishlistdata?p=0`;
					console.log('Fetching data from:', wishlistUrl);

					const url = new URL('https://scraping.narf.ai/api/v1');
					url.searchParams.append('api_key', env.SCRAPING_FISH_API_KEY);
					url.searchParams.append('url', wishlistUrl);
					console.log('Fetching data from proxy:', url.toString());

					const response = await fetch(url);
					if (!response.ok) {
						const text = await response.text();
						console.error({ message: `Failed to fetch data for steamId: ${steamId}; ${text}` });
						return null;
					}

					const data = await response.json();
					const items = wishlistItemsSchema.parse(data);

					const ics = steamWishlistToIcs(items);
					await env.BUCKET.put(`wishlists/${steamId}.ics`, ics);

					const steamProfile = await prisma.steamProfile.update({
						where: { id },
						data: {
							releaseDateIcsKey: `wishlists/${steamId}.ics`,
						},
					});

					return steamProfile;
				})
			);
			const notNullSteamProfiles = steamProfiles.filter((profile) => profile !== null);
			console.log(`Processed messages: ${notNullSteamProfiles.length}`);
		} catch (e) {
			if (e instanceof Error) {
				console.error({ message: e.message });
			} else {
				console.error(e);
			}
		}
	},

	fetch: app.fetch,
} satisfies ExportedHandler<Env>;
