import * as ics from 'ics';
import { WishlistItem } from '../types';
import { fromUnixTime, getDay, getMonth, getYear } from 'date-fns';

export function steamWishlistToIcs(wishlistItems: WishlistItem[]): string {
	const events: ics.EventAttributes[] = wishlistItems.map((item) => {
		const date = fromUnixTime(item.release_date);

		const event = {
			start: [getYear(date), getMonth(date), getDay(date)] as [number, number, number], // Year, Month, Day, Hour, Minute
			title: item.name,
			description: item.review_desc,
			duration: { days: 1 },
			categories: ['Game release'],
		};

		return event;
	});

	const { error, value } = ics.createEvents(events);

	if (error) {
		console.error(error);
		throw error;
	}

	if (value === undefined) {
		throw new Error('value is undefined');
	}

	return value;
}
