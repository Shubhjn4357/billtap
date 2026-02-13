
import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';
import type { Bill } from '../types';
import { generateBillHTML } from './billTemplate';
import { generateSalesReportHTML, type SalesReportPayload } from './reportTemplate';

export const printBill = async (bill: Bill) => {
    const html = generateBillHTML(bill);
    await Print.printAsync({
        html,
    });
};

export const shareBillPDF = async (bill: Bill) => {
    const html = generateBillHTML(bill);
    const { uri } = await Print.printToFileAsync({ html });
    await shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
};

export const shareSalesReportPDF = async (payload: SalesReportPayload) => {
    const html = generateSalesReportHTML(payload);
    const { uri } = await Print.printToFileAsync({ html });
    await shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
};
