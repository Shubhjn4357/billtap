import { Share } from 'react-native';

type Primitive = string | number | boolean | null | undefined;

const formatCsvCell = (value: Primitive): string => {
    if (value === null || value === undefined) return '';
    const text = String(value);
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
};

export const buildCsv = (headers: string[], rows: Primitive[][]): string => {
    const headerLine = headers.map(formatCsvCell).join(',');
    const rowLines = rows.map((row) => row.map(formatCsvCell).join(','));
    return [headerLine, ...rowLines].join('\n');
};

export const shareExportContent = async (params: {
    title: string;
    format: 'csv' | 'json';
    payload: string | Record<string, unknown>;
}): Promise<void> => {
    const message = typeof params.payload === 'string'
        ? params.payload
        : JSON.stringify(params.payload, null, 2);

    await Share.share({
        title: `${params.title} (${params.format.toUpperCase()})`,
        message,
    });
};
