import { lastDayOfMonth, lastDayOfQuarter, lastDayOfYear } from 'date-fns';

const invalidReleaseStrings = ['Coming soon', 'To be announced'];

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

/**
 * Get the month number from a month string.
 *
 * @param month
 * @returns The month number
 */
function getMonthFromString(month: string): number {
	if (month in months) {
		return months[month];
	}

	if (month in monthsInAbbreviation) {
		return monthsInAbbreviation[month];
	}

	throw new Error(`Unknown month: ${month}`);
}

/**
 * Convert a release string to a Date object.
 * release_string are using the formats: 'Coming soon', 'Q1 2025', 'Jan 4, 2025', 'January 2025', '2025', '27 May, 2010', 'To be announced'
 *
 * @param releaseString
 * @returns A Date object
 */
export function convertReleaseStringToDate(releaseString: string): Date | null {
	// if releaseString is invalid, return last day of the current year
	if (invalidReleaseStrings.includes(releaseString)) {
		return null;
	}

	// if no space in releaseString, it's a year
	if (!isNaN(Number(releaseString))) {
		console.log(`releaseString is only a year: ${parseInt(releaseString, 10)}`);
		return lastDayOfYear(new Date(parseInt(releaseString, 10), 0, 1));
	}

	// 'Jan 4, 2025' or '27 May, 2010'
	if (releaseString.includes(', ')) {
		const [first, second] = releaseString.split(', ').slice(0, 2);
		console.log(`first: ${first}, second: ${second}`);

		const [firstPart, secondPart] = first.split(' ');
		console.log(`firstPart: ${firstPart}, secondPart: ${secondPart}`);

		try {
			// if firstPart is a number, it's a day
			if (!isNaN(parseInt(firstPart, 10))) {
				const [day, month] = [firstPart, secondPart];
				return new Date(parseInt(second, 10), getMonthFromString(month), parseInt(day, 10));
			} else {
				const [month, day] = [firstPart, secondPart];
				return new Date(parseInt(second, 10), getMonthFromString(month), parseInt(day, 10));
			}
		} catch (e) {
			if (e instanceof Error) {
				console.error({ message: e.message });
				throw new Error(`Failed to parse date: ${releaseString}, error: ${e.message}`);
			} else {
				console.error({ message: e });
				throw new Error(`Failed to parse date: ${releaseString}, error: ${e}`);
			}
		}
	}

	// 'Q1 2025', 'January 2025'
	const [first, second] = releaseString.split(' ').slice(0, 2);
	console.log(`first: ${first}, second: ${second}`);

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

	if (first in months) {
		return lastDayOfMonth(new Date(parseInt(second, 10), getMonthFromString(first), 1));
	}

	throw new Error(`Unknown release string: ${releaseString}`);
}
