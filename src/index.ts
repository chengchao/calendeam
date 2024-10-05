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
app.use('*', prettyJSON(), logger(), async (c, next) => {
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
					await env.STEAM_USER_QUEUE.send(result, { delaySeconds: delaySeconds * n });
				}
				n++;

				const lastSteamProfileInResults = queryResults[queryResults.length - 1];
				const myCursor = lastSteamProfileInResults.id;

				queryResults = await prisma.steamProfile.findMany({
					cursor: {
						id: myCursor,
					},
					take: batchSize,
					orderBy: {
						updatedAt: 'asc',
					},
				});
			}
		} catch (e) {
			console.error(e);
		}
	},

	async queue(batch: MessageBatch<Message>, env: Env, ctx: ExecutionContext) {
		const adapter = new PrismaD1(env.DB);
		const prisma = new PrismaClient({ adapter });

		await Promise.all(
			batch.messages.map(async (message) => {
				const { id, userId, steamId } = message as Message;
				const response = await fetch(`https://store.steampowered.com/wishlist/profiles/${steamId}/wishlistdata?p=0`);
				if (!response.ok) {
					console.error(`Failed to fetch data for steamId: ${steamId}`);
					return null;
				}

				const data = await response.json();
				const items: WishlistItem[] = wishlistItemsSchema.parse(data);

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
	},

	fetch: app.fetch,
} satisfies ExportedHandler<Env>;
