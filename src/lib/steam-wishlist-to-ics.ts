import * as ics from 'ics';
import { WishlistItem } from '../types';
import { getDate, getMonth, getYear } from 'date-fns';
import { convertReleaseStringToDate } from './convert-release-string-to-date';

export function steamWishlistToIcs(wishlistItems: Record<string, WishlistItem>): string {
	const events: ics.EventAttributes[] = Object.values(wishlistItems)
		.map((item) => {
			// the use of item.release_date is not clear yet, so we use item.release_string instead
			const date = convertReleaseStringToDate(item.release_string);
			if (date === null) {
				return null;
			}

			const event = {
				start: [getYear(date), getMonth(date) + 1, getDate(date)] as [number, number, number], // Year, Month, Day, Hour, Minute
				title: item.name,
				description: item.review_desc,
				duration: { days: 1 },
				categories: ['Game release'],
			};

			return event;
		})
		.filter((event) => event !== null);

	const { error, value } = ics.createEvents(events);

	if (error) {
		throw error;
	}

	if (value === undefined) {
		throw new Error('value is undefined');
	}

	return value;
}
