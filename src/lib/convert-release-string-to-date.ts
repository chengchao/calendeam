import { lastDayOfMonth, lastDayOfQuarter, lastDayOfYear } from 'date-fns';

/**
 * Convert a release string to a Date object.
 * release_string are using the formats: 'Coming soon', 'Q1 2025', 'Jan 4, 2025', 'January 2025', '2025'
 *
 * @param releaseString
 * @returns A Date object
 */
export function convertReleaseStringToDate(releaseString: string): Date {
	// if no space in releaseString, it's a year
	if (!releaseString.includes(' ')) {
		return lastDayOfYear(new Date(parseInt(releaseString, 10)));
	}

	const [first, second] = releaseString.split(' ').slice(0, 2);

	if (first === 'Coming') {
		return lastDayOfYear(new Date());
	}

	if (first === 'Q1') {
		return lastDayOfQuarter(new Date(parseInt(second, 10), 0, 1));
	}

	if (first === 'Q2') {
		return lastDayOfQuarter(new Date(parseInt(second, 10), 3, 1));
	}

	if (first === 'Q3') {
		return lastDayOfQuarter(new Date(parseInt(second, 10), 6, 1));
	}

	if (first === 'Q4') {
		return lastDayOfQuarter(new Date(parseInt(second, 10), 9, 1));
	}

	const months: Record<string, number> = {
		January: 0,
		February: 1,
		March: 2,
		April: 3,
		May: 4,
		June: 5,
		July: 6,
		August: 7,
		September: 8,
		October: 9,
		November: 10,
		December: 11,
	};

	if (first in months) {
		return lastDayOfMonth(new Date(parseInt(second, 10), months[first], 1));
	}

	const monthsInAbbreviation: Record<string, number> = {
		Jan: 0,
		Feb: 1,
		Mar: 2,
		Apr: 3,
		May: 4,
		Jun: 5,
		Jul: 6,
		Aug: 7,
		Sep: 8,
		Oct: 9,
		Nov: 10,
		Dec: 11,
	};
	const [month, day] = first.split(',').splice(0, 2);
	if (month in monthsInAbbreviation) {
		return new Date(parseInt(second, 10), monthsInAbbreviation[month], parseInt(day, 10));
	}

	throw new Error(`Unknown release string: ${releaseString}`);
}
