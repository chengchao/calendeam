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
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';

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

	const user = await prisma.user.create({
		data: {},
	});

	return c.json(user);
});

app.put('/api/users/:id', async (c) => {
	const adapter = new PrismaD1(c.env.DB);
	const prisma = new PrismaClient({ adapter });

	const { steamId } = await c.req.json();

	const user = await prisma.user.update({
		where: { id: c.req.param('id') },
		data: {
			steamId: steamId,
		},
	});

	return c.json(user);
});

export default {
	// async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
	// 	try {
	// 		// Fetch data from DB
	// 		const adapter = new PrismaD1(env.DB);
	// 		const prisma = new PrismaClient({ adapter });

	// 		// Send data to queue
	// 		await env.STEAM_USER_QUEUE.send({}, { delaySeconds: 60 * 30 });
	// 	} catch (e) {
	// 		console.error(e);
	// 	}
	// },

	// async queue(batch: MessageBatch, env: Env, ctx: ExecutionContext) {},

	fetch: app.fetch,
} satisfies ExportedHandler<Env>;
